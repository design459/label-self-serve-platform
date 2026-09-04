# SPINE SSO — build spec for the staff side

**Owner:** Sakuni · **Status:** not built (open item `oi-9` in the SPINE Fleet Catalogue) · **Written:** 2026-09-04

This is the app-side work that connects **Label Generator** to SPINE. It is deliberately scoped to the **staff** surface (`/admin/*`). The customer flow (`/workspace/[token]`) is unchanged — customers keep entering by their per-order `access_token` link, they never touch SPINE.

Nothing here has been applied to the live app. It is a spec to build against; the code samples are copy-adaptable but must be reviewed and tested before they ship to `customlabel.netlify.app`.

---

## What SSO does here

Today: a staff member opens `/admin/login` and signs in with Supabase Auth; `lib/supabaseAuth.ts` then checks they exist in `lg_staff_users`.

After SSO: a staff member clicks the **Label Generator** tile in SPINE, arrives already signed in — no second password — because SPINE hands the app a signed, short-lived launch token proving who they are. The `lg_staff_users` membership check stays exactly as it is; SSO only replaces the *password step*, not the *authorization step*.

The SPINE tile is already registered (`module_label-generator`). Until this spec is built, that tile just lands staff on the app's own `/admin/login`.

---

## The five pieces to build

### 1. Secrets on the Netlify deploy
Add two environment variables to the `customlabel` Netlify site (Site settings → Environment), then redeploy (function env only takes effect on redeploy):

| Var | Where it comes from | Note |
|---|---|---|
| `ATLAS_BRIDGE_SECRET` | **Copied from SPINE** (Sahan / SPINE admin gives you the value) | Verifies the launch token. |
| `LABELGEN_SESSION_SECRET` | **You generate it:** `openssl rand -base64 48` | Signs the app's *own* session cookie. This is the one everyone forgets — SSO verifies perfectly and then dies at the last step without it. |

Do **not** put either value in the repo or in `.env.example` (names only there).

### 2. Token verifier — `lib/spineLaunch.ts` (new)
The launch token shape is `base64url(payload).base64url(HMAC_SHA256(payload, ATLAS_BRIDGE_SECRET))`. Drop-in verifier:

```ts
import crypto from 'node:crypto'

export function verifyLaunchToken(token: string, secret: string, now = Date.now()) {
  if (!token || !secret) return null
  const dot = token.indexOf('.')
  if (dot < 1 || dot === token.length - 1) return null
  const payload = token.slice(0, dot), sig = token.slice(dot + 1)
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  let obj: any
  try { obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { return null }
  if (!obj?.email || !obj?.surface || !obj?.exp || now > Number(obj.exp)) return null
  return { email: String(obj.email).toLowerCase(), surface: String(obj.surface), admin: !!obj.admin }
}
```

### 3. Exchange route — `app/api/sso/exchange/route.ts` (new)
The token arrives in the URL **hash** (`#srv_token=…`), which the browser never sends to the server — so a small client page reads it and POSTs it here. This route:

1. verifies the token with `ATLAS_BRIDGE_SECRET`;
2. checks `surface === 'module_label-generator'` (reject otherwise);
3. looks the email up in `lg_staff_users` — **if not a staff row, deny** (this is the existing authorization gate, unchanged);
4. mints the app's own session: a signed, httpOnly, `Secure`, `SameSite=Lax` cookie (JWT or HMAC) valid for hours, signed with `LABELGEN_SESSION_SECRET`;
5. returns `{ ok: true }` (or `{ ok:false, reason }` — never fall through silently).

The reason strings matter: on failure the UI must say *why* (bad token / wrong surface / not a staff member / missing secret), never bounce to `/admin/login` with no explanation.

### 4. SSO landing page — `app/sso/page.tsx` (new, client)
```tsx
// reads location.hash, POSTs the token, strips the hash, redirects
'use client'
useEffect(() => {
  const h = new URLSearchParams(location.hash.slice(1))
  const token = h.get('srv_token')
  history.replaceState(null, '', location.pathname) // STRIP the hash before any router work
  if (!token) { location.href = '/admin/login'; return }
  fetch('/api/sso/exchange', { method: 'POST', body: JSON.stringify({ token }) })
    .then(r => r.json())
    .then(d => { location.href = d.ok ? '/admin/review' : `/admin/login?sso=${d.reason}` })
}, [])
```
Stripping the hash **before** any redirect is the single most common bug — a router redirect that carries the `#srv_token` forward loops or leaks it.

> SPINE opens the tile at the app URL with `#srv_token=…`. The tile currently points at `/admin/login`; once this page exists, change the tile URL to `https://customlabel.netlify.app/sso` (one line in the SPINE PR — ping Sahan).

### 5. Accept the SSO session in the staff guard — `lib/supabaseAuth.ts` (edit)
The existing staff check does: *Supabase session → email → `lg_staff_users` row*. Add a second accepted credential **before** that: *valid `LABELGEN_SESSION_SECRET` cookie → email → same `lg_staff_users` row*. Either path satisfies the guard; the `lg_staff_users` lookup is shared and unchanged. This is the "bridge" step — SSO gives identity, you turn it into a real app session; do not try to reuse the 90-second launch token as the session, and restore the session on reload from the cookie.

---

## Also ship: `selftest` — `app/api/selftest/route.ts` (new, unauthenticated)
Presence booleans only — never a value, never a prefix.
```ts
const present = (k: string) => Boolean(process.env[k])
return Response.json({
  ok: present('ATLAS_BRIDGE_SECRET') && present('LABELGEN_SESSION_SECRET'),
  surface: 'module_label-generator',
  secrets: {
    ATLAS_BRIDGE_SECRET:    present('ATLAS_BRIDGE_SECRET'),
    LABELGEN_SESSION_SECRET: present('LABELGEN_SESSION_SECRET'),
  },
})
```
`curl -s https://customlabel.netlify.app/api/selftest` must return `ok:true` **before** the first tile click. If it is false, it names the missing secret — fix that, don't debug the browser.

---

## Order of operations
1. Generate `LABELGEN_SESSION_SECRET`, get `ATLAS_BRIDGE_SECRET` from Sahan, set both on Netlify, redeploy.
2. Build files 2–5 + `selftest`, deploy.
3. `curl …/api/selftest` → confirm `ok:true`.
4. Sahan flips the SPINE tile URL to `/sso` and grants you + QA the `module_label-generator` surface in App access.
5. Click the tile in SPINE → should land on `/admin/review` already signed in. Test a wrong/expired token and a non-staff email → both must show a reason, not a blank login.

## Out of scope (deliberately)
- Customer `/workspace/[token]` flow — untouched.
- ATLAS task push (a label submitted for compliance → a task routed to QA/Sakuni) — a later rung once SSO is solid; not required for this item.
