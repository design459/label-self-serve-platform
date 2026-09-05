-- Security fix for oi-8 (SPINE Fleet Catalogue) — verified live on MULTI-X
-- 2026-09-04 — PLUS the SSO staff resolver. Applied as an EXPAND/CONTRACT pair
-- (this file expands + secures; 0014 contracts) so the live app never breaks:
-- the currently-deployed app calls lg_spend_revision(uuid) via service_role, so
-- this migration keeps that 1-arg function working while adding the secure
-- 2-arg version and closing the anon hole immediately.
--
-- Defects (both confirmed live 2026-09-04):
--   1. public.lg_spend_revision(uuid) is SECURITY DEFINER with EXECUTE granted to
--      `anon` and no ownership check — anyone with an order UUID + the public
--      anon key could burn a paid revision (audit row falsely attributed to
--      'customer'). The app itself calls it via service_role, so revoking anon
--      breaks nothing.
--   2. label_orders.revision_limit still DEFAULTS to 5 (existing 29 rows are 3),
--      so new orders reverted to 5 against the ruled cap of 3.

begin;

-- 1. enforce the ruled cap on NEW orders (existing rows already 3)
alter table public.label_orders alter column revision_limit set default 3;

-- 2. close the anon exploit on the legacy 1-arg function NOW.
--    service_role keeps EXECUTE, so the currently-deployed app is unaffected.
revoke execute on function public.lg_spend_revision(uuid) from anon, authenticated;

-- 3. add the secure 2-arg version the new app deploy will call (ownership check;
--    service_role only). 0014 drops the legacy 1-arg once that deploy is live.
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

revoke all on function public.lg_spend_revision(uuid, text) from public, anon, authenticated;
grant execute on function public.lg_spend_revision(uuid, text) to service_role;

-- 4. SSO staff resolver: map a SPINE email to its lg_staff_users row so
--    /api/sso/exchange can confirm staff without listing all auth users.
--    Reads auth.users, so SECURITY DEFINER + service_role only.
create function public.lg_staff_by_email(p_email text)
  returns table (user_id uuid, role text)
  language sql
  security definer
  set search_path to 'public', 'auth'
as $function$
  select s.user_id, s.role
  from public.lg_staff_users s
  join auth.users u on u.id = s.user_id
  where lower(u.email) = lower(p_email)
$function$;

revoke all on function public.lg_staff_by_email(text) from public, anon, authenticated;
grant execute on function public.lg_staff_by_email(text) to service_role;

commit;
