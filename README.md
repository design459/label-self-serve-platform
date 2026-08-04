# Label workspace — customer self-serve label platform

Implements the SPINE build spec `label-generator` (v1, issued 3 Aug 2026):
a link-based workspace where an AN/SFC private-label or contract-manufacturing
customer designs their own label artwork against a template, and a staff
reviewer signs off before it's print-ready. Not the same app as
`ancient-nutra-label-generator` ("PackLabel") elsewhere in this folder — that
one is staff's own internal wizard; this one is customer-facing with a
revision cap and a human compliance-review queue. See that project's
`CLAUDE.md` for why they're kept separate.

## What it does

- **`/workspace/<token>`** — customer picks a template by pack format,
  uploads a logo, chooses a theme, generates a proof, and submits it for
  review. Generation is template compositing only (deterministic HTML/CSS →
  PDF) — no AI image generation, so mandatory regulatory text is always
  exact, never AI-paraphrased.
- **`/admin/orders/new`** — staff create a label workspace (customer, SKU,
  pack format, regulatory content) and get a link to hand to the customer.
- **`/admin/review`** — queue of submitted labels; approve (produces the
  unwatermarked print-ready PDF) or reject with a reason. Nothing in this
  codebase can mark a label print-ready except this action by a signed-in
  staff account.

## Compliance boundaries, enforced in code

- Every generated proof is watermarked "PROOF — NOT APPROVED FOR PRINT"
  until a staff reviewer approves it; only then does an unwatermarked print
  file get produced (`app/api/admin/review/[id]/route.ts`).
- The revision cap is enforced by a Postgres function
  (`lg_spend_revision` in `supabase/migrations/0001_init.sql`), not the UI —
  it row-locks the order and raises once `revisions_used >= revision_limit`.
  The remaining count is always visible in the workspace before the
  customer clicks Generate.
- Every table has RLS enabled with **no** anon/authenticated policies —
  reads/writes only ever happen server-side with the service-role key
  (`lib/supabaseServer.ts`), gated by validating the order's `access_token`
  (customer side) or a `lg_staff_users` row (admin side).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

Opens on `http://localhost:3002`. PDF rendering uses your machine's own
installed Chrome/Edge locally (`lib/findChrome.ts`) — install one if you
don't have it, or set `CHROME_PATH`.

## Setting up Supabase (run yourself — see "Why I'm not running this")

**Deploy target: the shared MULTI-X project** (`troxvvwkiontbliwuvkn`, Silk
Route Ventures org, PRO, production) — chosen deliberately over a fresh
dedicated project, after being told that project already hosts 17+
unrelated migrations and PackLabel's own `labels` table. Because of that,
every table/type/function name in `supabase/migrations/0001_init.sql` that
was generic enough to plausibly collide is prefixed `lg_`
(`lg_pack_format`, `lg_order_status`, `lg_review_decision`,
`lg_staff_users`, `lg_audit_log`, `lg_spend_revision`) — see the comment at
the top of that file.

1. **You need Owner or Admin on this project** to retrieve the
   `service_role` key in step 5 — this is exactly what blocked Sahan on this
   same project for PackLabel. Check Project Settings → API first; if you
   only see an `anon` key and no `service_role` value, stop here and ask
   whoever owns MULTI-X to either grant you Admin or hand you that key
   directly (never over chat/Slack in plaintext if avoidable — a password
   manager or a one-time secret link is safer).
2. **Run this pre-flight check in the SQL Editor first**, to confirm none of
   this migration's object names already exist in MULTI-X's schema:
   ```sql
   select 'type' as kind, typname as name from pg_type
     where typname in ('lg_pack_format','lg_order_status','lg_review_decision')
   union all
   select 'table', tablename from pg_tables
     where schemaname = 'public' and tablename in (
       'lg_staff_users','lg_audit_log','pack_format_templates','label_orders',
       'label_regulatory_content','label_assets','label_designs','compliance_reviews'
     )
   union all
   select 'function', proname from pg_proc where proname = 'lg_spend_revision';
   ```
   This should return **zero rows**. If it returns anything, stop and tell
   me — something already uses one of these names and the migration needs
   to be adjusted before applying it here.
3. **Apply the schema by hand via the Dashboard SQL Editor** — paste the
   full contents of `supabase/migrations/0001_init.sql` and run it. Do
   **not** run `supabase db push` against this project: it doesn't have
   MULTI-X's other 17+ migrations locally, and pushing would rewrite
   MULTI-X's migration-history bookkeeping for unrelated codebases (the same
   reason PackLabel's schema was applied this way — see its `CLAUDE.md`).
   This also creates the `label-assets` Storage bucket and seeds the 4
   starter pack-format templates.
4. In the Supabase dashboard, enable the **Email** auth provider and create
   your first staff/reviewer user (Authentication → Users → Add user).
5. In the SQL Editor, add that user to staff:
   ```sql
   insert into public.lg_staff_users (user_id, role)
   values ('<the-user-id-from-step-4>', 'reviewer');
   ```
6. Copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API into `.env.local`
   yourself (and into Netlify's environment variables for the deployed
   site) — don't paste the `service_role` key into chat with an AI agent,
   it's a full-database-bypass secret.

## Deploying to Netlify (run yourself)

```bash
npx netlify-cli sites:create
npx netlify-cli deploy --prod
```

Run these in your own terminal, not through an AI agent's shell — the
sibling PackLabel project documented that invoking `netlify-cli` from an
agent's Bash tool has reset a saved Netlify CLI login twice. Set the four
env vars above in the Netlify site's environment settings before deploying.
`netlify.toml` already has the build command and `@netlify/plugin-nextjs`.

Serverless PDF rendering on Netlify Functions uses `@sparticuz/chromium`
(`lib/launchBrowser.ts`) — this mirrors PackLabel's setup verbatim, which is
confirmed working on a live Netlify deploy, but it has **not been verified
live from this repo** since deploying requires your own accounts. If the
Function fails on cold start with a size-limit error, switch to
`@sparticuz/chromium-min` and set `CHROMIUM_REMOTE_PACK_URL` per the comment
in `lib/launchBrowser.ts`.

## Open items this MVP resolved with a default

The build spec explicitly leaves these owned by Sahan and unresolved. This
build picked a default for each so there'd be something real to test —
revisit them, they're not meant to be permanent:

- **Revision cap**: defaulted to 5 per label. It's a column
  (`label_orders.revision_limit`), settable per order from `/admin/orders/new`
  and editable directly in the database — no redeploy needed to change it.
- **Reviewer**: single `reviewer` role, no named-reviewer routing or SLA.
- **Order-confirmation trigger**: `/admin/orders/new` is a manual stand-in.
  The real trigger (spec suggests the `b1` order flow, not `pricing-costing`)
  isn't integrated — nothing here calls out to another system.
- **Pack-format template library**: one working zone layout per format
  (pouch/capsule bottle/jar/sachet) at placeholder trim dimensions, not
  co-packer-verified dielines. Editable via the `pack_format_templates`
  table's `zone_layout` jsonb.
- **Barcode**: QR code only (`lib/labelCodes.ts`), no CODE128 barcode
  graphic — avoided a native `canvas` dependency that's fragile to build on
  Windows without Cairo/node-gyp set up. Batch/SKU codes render as plain
  text instead.
- **Pricing for repeat customers**: not built. Always free up to the cap.
- **SPINE launch-token SSO** for the staff side: not implemented — `/admin`
  uses plain Supabase Auth email/password. Wiring the real SPINE SSO needs
  access to that fleet infrastructure.

## Known gaps / next steps

- No email delivery of the workspace link — staff copy/paste it manually
  from `/admin/orders/new`.
- No customer-facing edit of regulatory content (ingredients, nutrition
  panel, claims, batch/expiry) — staff enter it once at order creation.
  Add an edit path if customers need to correct it themselves.
- No automated pre-check against the existing `ancient-nutra-label-check`
  skill before a human review — the spec calls for pairing with it, this
  build only wires the human review queue.
- Verify the Netlify serverless-Chromium path on your first real deploy —
  see the `lib/launchBrowser.ts` note above.
