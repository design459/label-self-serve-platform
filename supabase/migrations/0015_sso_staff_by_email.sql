-- SPINE-as-sole-identity: staff sign in via the SPINE launch token (like every
-- other SRV app) and are identified by EMAIL — no per-app Supabase Auth account.
-- SPINE only mints a token for a granted surface, so a verified token is the
-- authorization. The two write paths that recorded a staff auth.users id now
-- record the email instead (and keep the id only for legacy native sign-ins).

begin;

-- compliance_reviews.reviewer_id was NOT NULL + FK to auth.users. SSO staff have
-- no auth.users row, so allow null and carry the email alongside.
alter table public.compliance_reviews add column if not exists reviewer_email text;
alter table public.compliance_reviews alter column reviewer_id drop not null;
alter table public.compliance_reviews
  add constraint compliance_reviews_reviewer_present
  check (reviewer_id is not null or reviewer_email is not null);

-- label_regulation_documents.uploaded_by is already nullable; add the email too.
alter table public.label_regulation_documents add column if not exists uploaded_by_email text;

commit;
