-- Contract step of the oi-8 fix (pairs with 0013). Apply ONLY after the app
-- deploy that calls the 2-arg lg_spend_revision(p_order_id, p_access_token) is
-- live — this removes the legacy 1-arg overload for good, so the anon-writable
-- signature stops existing entirely.
--
-- Safe to run once `curl https://customlabel.netlify.app/api/selftest` shows the
-- new build and a real "Generate artwork" succeeds (proving the 2-arg path).

drop function if exists public.lg_spend_revision(uuid);
