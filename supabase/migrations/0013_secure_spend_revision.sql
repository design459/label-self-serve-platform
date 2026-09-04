-- Security fix for oi-8 (SPINE Fleet Catalogue) — verified live on MULTI-X
-- 2026-09-04. Two live defects on a PAID service:
--
--   1. public.lg_spend_revision(uuid) is SECURITY DEFINER and EXECUTE is granted
--      to `anon`. It checks only that the order exists, isn't approved, and is
--      under its revision cap — NOT that the caller owns the order. Order UUIDs
--      appear in customer emails/URLs, so anyone with the public anon key and an
--      order id could POST /rest/v1/rpc/lg_spend_revision and burn a paid
--      revision, writing an lg_audit_log row falsely attributed to 'customer'.
--      (The app's own /api/workspace/[token]/generate route already proves the
--      token before calling this via service_role — the hole is the direct
--      anon path that bypasses the app.)
--
--   2. label_orders.revision_limit still DEFAULTS to 5, so every new order
--      reverts to 5 despite the ruled cap of 3 (the 29 existing rows are 3).
--
-- Fix: bring the default to 3; replace the 1-arg function with a 2-arg version
-- that requires the order's access_token and verifies it against the locked
-- row before any write; drop the old 1-arg overload so the anon-exploitable
-- signature stops existing; and grant EXECUTE only to service_role (the app
-- calls it server-side, never from the browser).
--
-- APPLY TOGETHER with the matching app change in
-- app/api/workspace/[token]/generate/route.ts (passes p_access_token). The old
-- 1-arg call breaks the moment this migration lands, so migration + deploy must
-- ship in the same release.

begin;

-- 1. enforce the ruled cap on NEW orders (existing rows are already 3)
alter table public.label_orders alter column revision_limit set default 3;

-- 2. remove the anon-exploitable 1-arg function entirely
drop function if exists public.lg_spend_revision(uuid);

-- 3. recreate with an ownership check (same body, plus the token gate)
create function public.lg_spend_revision(p_order_id uuid, p_access_token text)
  returns public.label_designs
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_token text;
  v_limit int;
  v_used int;
  v_next int;
  v_status lg_order_status;
  v_design public.label_designs;
begin
  select access_token, revision_limit, revisions_used, status
    into v_token, v_limit, v_used, v_status
  from public.label_orders
  where id = p_order_id
  for update;

  if v_limit is null then
    raise exception 'label order % not found', p_order_id;
  end if;

  -- ownership gate: the caller must hold this order's access_token
  if p_access_token is null or v_token is null or v_token <> p_access_token then
    raise exception 'not authorized for order %', p_order_id;
  end if;

  if v_status = 'approved' then
    raise exception 'label order % is already approved — no further revisions', p_order_id;
  end if;

  if v_used >= v_limit then
    raise exception 'revision cap reached (% of %)', v_used, v_limit;
  end if;

  v_next := v_used + 1;

  update public.label_orders
  set revisions_used = v_next,
      status = 'in_progress',
      updated_at = now()
  where id = p_order_id;

  insert into public.label_designs (label_order_id, revision_number)
  values (p_order_id, v_next)
  returning * into v_design;

  insert into public.lg_audit_log (label_order_id, actor, action, detail)
  values (
    p_order_id,
    'customer',
    'revision_spent',
    jsonb_build_object('revision_number', v_next, 'revisions_used', v_next, 'revision_limit', v_limit)
  );

  return v_design;
end;
$function$;

-- 4. only the server (service_role) may spend a revision; never anon/authenticated
revoke all on function public.lg_spend_revision(uuid, text) from public, anon, authenticated;
grant execute on function public.lg_spend_revision(uuid, text) to service_role;

commit;
