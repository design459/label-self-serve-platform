-- Staff-managed reference library of label regulation PDFs (e.g. Sri
-- Lanka's food labelling gazette notifications) — global, not tied to any
-- one order, uploaded/removed anytime from the Management Dashboard. Used
-- by the "Quality Assurance (QA) Review" check on each label's review page
-- (app/api/admin/review/[id]/compliance-check/route.ts), which sends these
-- PDFs to Claude alongside the label's own content and asks for a list of
-- what needs to change to comply — nothing here is hardcoded into app
-- logic, so a regulation update is just a re-upload, no redeploy.

create table if not exists public.label_regulation_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  size_bytes integer not null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.label_regulation_documents enable row level security;
