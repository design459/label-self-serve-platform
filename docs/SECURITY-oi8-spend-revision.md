# oi-8 — secure `lg_spend_revision` (revision-burn ownership check)

**Status:** `0013` **applied live** 2026-09-05 (exploit closed); `0014` gated on the app deploy · **Verified live on MULTI-X (`troxvvwkiontbliwuvkn`) 2026-09-04** · CEO ruling 2026-08-17: FIX.

## The defect (both halves confirmed live)
1. **Anyone can burn a paid revision.** `public.lg_spend_revision(uuid)` is `SECURITY DEFINER` and `EXECUTE` is granted to `anon`. It checks only order-exists / not-approved / under-cap — **never that the caller owns the order.** Order UUIDs travel in customer emails and workspace URLs, and the anon key is public in the browser bundle, so a direct `POST /rest/v1/rpc/lg_spend_revision` (bypassing the app) burns a revision the customer paid for and writes an `lg_audit_log` row falsely attributed to `'customer'`. A forwarded email is enough — no real attack needed.
2. **Cap reverts to 5.** `label_orders.revision_limit` still **defaults to 5**. The 29 existing rows are 3, but every *new* order comes back at 5, against the ruled cap of 3.

The app's own path is fine — `/api/workspace/[token]/generate` resolves the order by `access_token` (`getOrderByToken`) and calls the RPC via `service_role`. The hole is purely the direct-anon path.

## The fix — EXPAND / CONTRACT (zero broken window)
A signature change with a single migration breaks the live app for the window between the migration and the deploy (either order breaks — old app calls 1-arg, new app calls 2-arg). Split in two so the app never breaks:

**`0013_secure_spend_revision.sql` — expand + secure (applied live 2026-09-05):**
- `revision_limit` default 5 → **3** (existing rows already 3, untouched).
- `REVOKE EXECUTE` on the legacy `lg_spend_revision(uuid)` from `anon, authenticated` — **closes the exploit immediately.** `service_role` keeps it, so the currently-deployed app is unaffected.
- **Add** `lg_spend_revision(p_order_id uuid, p_access_token text)` — same body plus a `not authorized` raise unless `p_access_token` matches the locked row's `access_token`; `GRANT` to `service_role` only.
- **Add** `lg_staff_by_email(text)` — the SSO staff resolver (SECURITY DEFINER, service_role only).

**`0014_drop_legacy_spend_revision.sql` — contract (apply AFTER the new app deploy is live):**
- `DROP FUNCTION lg_spend_revision(uuid)` — removes the legacy overload for good.

## Matching app change (`app/api/workspace/[token]/generate/route.ts`)
The single caller now passes `p_access_token: params.token`, and maps a `not authorized` error to HTTP 403.

## Apply order (no broken window)
1. **`0013` applied to MULTI-X 2026-09-05** — exploit already closed; old app still works (service_role).
2. Merge this PR + let Netlify deploy the new app (which calls the 2-arg function `0013` added).
3. Once `curl .../api/selftest` shows the new build and a real "Generate artwork" succeeds, apply **`0014`** to drop the legacy 1-arg.

Because 0013 is additive + a revoke, it was safe for this session to apply directly. 0014 is the only step gated on the deploy.
