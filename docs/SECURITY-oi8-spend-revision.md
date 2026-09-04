# oi-8 — secure `lg_spend_revision` (revision-burn ownership check)

**Status:** fix ready in this PR · **Verified live on MULTI-X (`troxvvwkiontbliwuvkn`) 2026-09-04** · CEO ruling 2026-08-17: FIX.

## The defect (both halves confirmed live)
1. **Anyone can burn a paid revision.** `public.lg_spend_revision(uuid)` is `SECURITY DEFINER` and `EXECUTE` is granted to `anon`. It checks only order-exists / not-approved / under-cap — **never that the caller owns the order.** Order UUIDs travel in customer emails and workspace URLs, and the anon key is public in the browser bundle, so a direct `POST /rest/v1/rpc/lg_spend_revision` (bypassing the app) burns a revision the customer paid for and writes an `lg_audit_log` row falsely attributed to `'customer'`. A forwarded email is enough — no real attack needed.
2. **Cap reverts to 5.** `label_orders.revision_limit` still **defaults to 5**. The 29 existing rows are 3, but every *new* order comes back at 5, against the ruled cap of 3.

The app's own path is fine — `/api/workspace/[token]/generate` resolves the order by `access_token` (`getOrderByToken`) and calls the RPC via `service_role`. The hole is purely the direct-anon path.

## The fix (`supabase/migrations/0013_secure_spend_revision.sql`)
- `revision_limit` default 5 → **3** (existing rows already 3, untouched).
- **Drop** the 1-arg `lg_spend_revision(uuid)` so the exploitable signature stops existing.
- **Recreate** `lg_spend_revision(p_order_id uuid, p_access_token text)` — same body, plus: after locking the row it raises `not authorized` unless `p_access_token` matches the row's `access_token`.
- `REVOKE EXECUTE` from `public/anon/authenticated`; `GRANT` to `service_role` only.

## Matching app change (`app/api/workspace/[token]/generate/route.ts`)
The single caller now passes `p_access_token: params.token`, and maps a `not authorized` error to HTTP 403.

## ⚠️ Apply order — migration and deploy ship together
Dropping the 1-arg function breaks the old call the instant the migration lands. So:
1. Merge this PR.
2. Apply `0013` to MULTI-X (`supabase db push`, or run the SQL) **and** deploy the app from this commit **in the same release** — not minutes apart.
3. Smoke test: in a real workspace, "Generate artwork" still works (proves the 2-arg call + token match). Optionally confirm a direct anon `rpc/lg_spend_revision` with only `p_order_id` now fails.

This is customer-facing, paid, and live — review and apply it yourself (Sakuni); it is not applied by this PR.
