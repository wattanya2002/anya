-- Wonder Courts — KOL Recruitment & Marketing Approval (Master RCM v1.0, 12 Nov 2026).
-- Additive only: new permissions, tables and indexes. Nothing existing is altered or dropped.
-- Reused as-is: organizations, users, roles, memberships (identity & RBAC), campaigns (campaign master),
-- promotions + bookings_imported (promo-code usage comes only from imported booking data),
-- notifications (in-web alerts, dedupe_key) and audit_events (who / what / before / after / when).
-- Money is integer satang; business dates are Asia/Bangkok `date` values.

-- ---------------------------------------------------------------- permissions (RCM §3)
insert into permissions (key, description) values
  ('kol.view', 'View KOL applicants, CEO cards and campaign progress'),
  ('kol.review', 'Screen KOL applicants, add notes, send to CEO, manage KOL campaigns'),
  ('kol.decide', 'Approve, reject or request more information on KOL approval cards'),
  ('forms.manage', 'Create, edit, publish and close forms'),
  ('forms.responses', 'View, export and annotate form responses'),
  ('forms.edit_responses', 'Correct form answers (history is kept)'),
  ('privacy.manage', 'Erase personal data of an applicant')
on conflict (key) do nothing;

-- owner = System Admin; marketing = Marketing Admin; executive = CEO. Marketing cannot decide (separation of duties).
insert into role_permissions (role_key, permission_key) values
  ('owner', 'kol.view'), ('owner', 'kol.review'), ('owner', 'kol.decide'), ('owner', 'forms.manage'),
  ('owner', 'forms.responses'), ('owner', 'forms.edit_responses'), ('owner', 'privacy.manage'),
  ('executive', 'kol.view'), ('executive', 'kol.decide'),
  ('marketing', 'kol.view'), ('marketing', 'kol.review'), ('marketing', 'forms.manage'),
  ('marketing', 'forms.responses'), ('marketing', 'forms.edit_responses')
on conflict do nothing;

-- ---------------------------------------------------------------- campaign template (versioned terms)
-- One row per version; editing the template inserts a new version, so earlier participants keep theirs.
create table kol_campaign_terms (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id) on delete cascade,
  campaign_id          uuid not null references campaigns(id) on delete cascade,
  version_no           integer not null check (version_no >= 1),
  title                text not null check (length(btrim(title)) between 1 and 160),
  items                text[] not null check (cardinality(items) between 1 and 30),
  deliverables         jsonb not null check (jsonb_typeof(deliverables) = 'array'),
  credit_hours         numeric(6,2) not null check (credit_hours >= 0),
  credit_value_satang  bigint not null check (credit_value_satang >= 0),
  promo_discount_bps   integer not null check (promo_discount_bps between 0 and 10000),
  promo_max_uses       integer check (promo_max_uses is null or promo_max_uses >= 0),
  promo_valid_days     integer check (promo_valid_days is null or promo_valid_days between 1 and 3650),
  min_followers        integer not null default 0 check (min_followers >= 0),
  deliver_within_days  integer check (deliver_within_days is null or deliver_within_days between 1 and 365),
  is_current           boolean not null default true,
  created_by           uuid references users(id),
  created_at           timestamptz not null default now(),
  unique (campaign_id, version_no)
);
create unique index kol_campaign_terms_current_uq on kol_campaign_terms (campaign_id) where is_current;

-- KOL extension of the shared campaigns table (1:1). `key` lets the system find the default campaign.
create table kol_campaigns (
  campaign_id  uuid primary key references campaigns(id) on delete cascade,
  org_id       uuid not null references organizations(id) on delete cascade,
  key          text not null check (key ~ '^[a-z0-9_-]{1,40}$'),
  created_at   timestamptz not null default now(),
  unique (org_id, key)
);

-- ---------------------------------------------------------------- forms (Module B)
create sequence if not exists form_submission_ref_seq;

create table forms (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  purpose             text not null check (purpose in ('kol_application', 'kol_registration', 'general')),
  system_key          text check (system_key is null or system_key ~ '^[a-z0-9_-]{1,40}$'),
  title               text not null check (length(btrim(title)) between 1 and 160),
  slug                text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  status              text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  campaign_id         uuid references campaigns(id) on delete set null,
  draft               jsonb not null check (jsonb_typeof(draft) = 'object'),
  draft_rev           integer not null default 1,
  draft_dirty         boolean not null default true,
  current_version_id  uuid,
  created_by          uuid references users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  closed_at           timestamptz,
  unique (org_id, system_key)
);
create index forms_org_idx on forms (org_id, updated_at desc);

-- Published snapshots. Answers always point at the version they were given against.
create table form_versions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  form_id       uuid not null references forms(id) on delete cascade,
  version_no    integer not null check (version_no >= 1),
  schema        jsonb not null check (jsonb_typeof(schema) = 'object'),
  terms_id      uuid references kol_campaign_terms(id),
  published_by  uuid references users(id),
  published_at  timestamptz not null default now(),
  unique (form_id, version_no)
);
alter table forms add constraint forms_current_version_fk foreign key (current_version_id) references form_versions(id) on delete set null;

-- Normalised field list per version. field_key is the stable internal Field ID (labels may change freely).
create table form_fields (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  form_id      uuid not null references forms(id) on delete cascade,
  version_id   uuid not null references form_versions(id) on delete cascade,
  field_key    text not null check (field_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  section_key  text not null,
  position     integer not null,
  type         text not null,
  label        text not null,
  required     boolean not null,
  maps_to      text,
  config       jsonb not null default '{}',
  unique (version_id, field_key)
);
create index form_fields_form_key_idx on form_fields (form_id, field_key);

create table form_submissions (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  form_id          uuid not null references forms(id) on delete cascade,
  version_id       uuid not null references form_versions(id),
  ref_no           integer not null unique default nextval('form_submission_ref_seq'),
  answers          jsonb not null check (jsonb_typeof(answers) = 'object'),
  client_key       text not null check (length(client_key) between 8 and 64),
  applicant_id     uuid,
  incomplete       boolean not null default false,
  internal_note    text check (internal_note is null or length(internal_note) <= 4000),
  terms_id         uuid references kol_campaign_terms(id),
  consent_at       timestamptz,
  ip_hash          text,
  user_agent       text check (user_agent is null or length(user_agent) <= 400),
  submitted_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references users(id),
  unique (form_id, client_key)
);
create index form_submissions_form_time_idx on form_submissions (form_id, submitted_at desc);
create index form_submissions_applicant_idx on form_submissions (applicant_id) where applicant_id is not null;

-- Corrections made by the team: one row per changed answer.
create table form_submission_edits (
  id             bigserial primary key,
  org_id         uuid not null references organizations(id) on delete cascade,
  submission_id  uuid not null references form_submissions(id) on delete cascade,
  field_key      text not null,
  before         jsonb,
  after          jsonb,
  reason         text check (reason is null or length(reason) <= 500),
  edited_by      uuid not null references users(id),
  edited_at      timestamptz not null default now()
);
create index form_submission_edits_sub_idx on form_submission_edits (submission_id, edited_at desc);

-- Uploaded files are kept in Postgres (no object storage is configured for this project).
-- A public upload is "claimed" by exactly one submission using a secret claim token (stored hashed).
create table form_files (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  form_id        uuid not null references forms(id) on delete cascade,
  field_key      text not null,
  purpose        text not null default 'answer' check (purpose in ('answer', 'hero')),
  submission_id  uuid references form_submissions(id) on delete cascade,
  claim_hash     text,
  file_name      text not null check (length(file_name) between 1 and 200),
  mime           text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes     integer not null check (size_bytes between 1 and 10485760),
  sha256         text not null,
  data           bytea not null,
  ip_hash        text,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  attached_at    timestamptz
);
create index form_files_submission_idx on form_files (submission_id) where submission_id is not null;
create index form_files_orphan_idx on form_files (created_at) where submission_id is null and purpose = 'answer';

-- ---------------------------------------------------------------- applicants (Module A / C)
create sequence if not exists kol_applicant_ref_seq;

create table kol_applicants (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  campaign_id        uuid not null references campaigns(id),
  ref_no             integer not null unique default nextval('kol_applicant_ref_seq'),
  source_submission  uuid not null unique references form_submissions(id),
  full_name          text not null check (length(btrim(full_name)) between 1 and 160),
  creator_name       text not null check (length(btrim(creator_name)) between 1 and 160),
  phone              text check (phone is null or length(phone) <= 40),
  line_id            text check (line_id is null or length(line_id) <= 80),
  email              text check (email is null or length(email) <= 200),
  photo_file_id      uuid references form_files(id) on delete set null,
  channels           text[] not null default '{}',
  categories         text[] not null default '{}',
  tennis_experience  text check (tennis_experience is null or length(tennis_experience) <= 200),
  bio                text check (bio is null or length(bio) <= 4000),
  motivation         text check (motivation is null or length(motivation) <= 4000),
  sample_links       text[] not null default '{}' check (cardinality(sample_links) <= 30),
  status             text not null default 'submitted' check (status in (
                       'submitted', 'shortlisted', 'info_requested', 'pending_ceo', 'ceo_info_requested',
                       'approved', 'rejected', 'registered')),
  rejected_stage     text check (rejected_stage is null or rejected_stage in ('screening', 'ceo')),
  terms_id           uuid references kol_campaign_terms(id),
  terms_accepted_at  timestamptz,
  first_viewed_at    timestamptz,
  status_changed_at  timestamptz not null default now(),
  erased_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((status = 'rejected') = (rejected_stage is not null))
);
create index kol_applicants_org_status_idx on kol_applicants (org_id, status, created_at desc);
create index kol_applicants_org_created_idx on kol_applicants (org_id, created_at desc);
alter table form_submissions add constraint form_submissions_applicant_fk foreign key (applicant_id) references kol_applicants(id) on delete set null;

create table kol_social_accounts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  applicant_id  uuid not null references kol_applicants(id) on delete cascade,
  platform      text not null check (platform ~ '^[a-z0-9_]{2,24}$'),
  url           text check (url is null or (url ~ '^https?://' and length(url) <= 500)),
  followers     integer check (followers is null or followers >= 0),
  source        text not null check (source in ('application', 'registration', 'team')),
  updated_at    timestamptz not null default now(),
  unique (applicant_id, platform)
);

-- Status history: who moved the applicant, from what, to what, when.
create table kol_status_history (
  id            bigserial primary key,
  org_id        uuid not null references organizations(id) on delete cascade,
  applicant_id  uuid not null references kol_applicants(id) on delete cascade,
  from_status   text,
  to_status     text not null,
  actor_user_id uuid references users(id),
  actor_kind    text not null check (actor_kind in ('user', 'applicant', 'system')),
  note          text check (note is null or length(note) <= 2000),
  created_at    timestamptz not null default now()
);
create index kol_status_history_applicant_idx on kol_status_history (applicant_id, created_at);

-- Marketing review log (internal notes, shortlist, info requests, screening rejections).
create table kol_reviews (
  id            bigserial primary key,
  org_id        uuid not null references organizations(id) on delete cascade,
  applicant_id  uuid not null references kol_applicants(id) on delete cascade,
  kind          text not null check (kind in ('note', 'shortlist', 'request_info', 'reject')),
  body          text check (body is null or length(body) <= 4000),
  reviewer_id   uuid not null references users(id),
  client_key    text check (client_key is null or length(client_key) <= 64),
  created_at    timestamptz not null default now(),
  unique (applicant_id, client_key)
);
create index kol_reviews_applicant_idx on kol_reviews (applicant_id, created_at);

-- ---------------------------------------------------------------- CEO approval (Module D)
create table kol_approval_requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  applicant_id    uuid not null references kol_applicants(id) on delete cascade,
  round_no        integer not null check (round_no >= 1),
  campaign_id     uuid not null references campaigns(id),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'info_requested')),
  short_pitch     text not null check (length(btrim(short_pitch)) between 1 and 200),
  opinion         text not null check (length(btrim(opinion)) between 1 and 2000),
  reason          text check (reason is null or length(reason) <= 2000),
  highlights      text check (highlights is null or length(highlights) <= 2000),
  cautions        text check (cautions is null or length(cautions) <= 2000),
  submitted_by    uuid not null references users(id),
  submitted_at    timestamptz not null default now(),
  decided_at      timestamptz,
  unique (applicant_id, round_no),
  check ((status = 'pending') = (decided_at is null))
);
create unique index kol_approval_one_pending_uq on kol_approval_requests (applicant_id) where status = 'pending';
create index kol_approval_requests_org_status_idx on kol_approval_requests (org_id, status, submitted_at);

-- Exactly one decision per request: a second Approve from another device fails on the unique key.
create table kol_approval_decisions (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id) on delete cascade,
  approval_request_id  uuid not null unique references kol_approval_requests(id) on delete cascade,
  decision             text not null check (decision in ('approved', 'rejected', 'info_requested')),
  note                 text check (note is null or length(note) <= 2000),
  decided_by           uuid not null references users(id),
  decided_at           timestamptz not null default now(),
  check (decision = 'approved' or length(btrim(coalesce(note, ''))) > 0)
);

-- Internal comments (team + CEO). Never shown to applicants. client_key makes retries idempotent.
create table kol_comments (
  id                   bigserial primary key,
  org_id               uuid not null references organizations(id) on delete cascade,
  applicant_id         uuid not null references kol_applicants(id) on delete cascade,
  approval_request_id  uuid references kol_approval_requests(id) on delete set null,
  author_id            uuid not null references users(id),
  body                 text not null check (length(btrim(body)) between 1 and 2000),
  client_key           text check (client_key is null or length(client_key) <= 64),
  created_at           timestamptz not null default now(),
  unique (applicant_id, client_key)
);
create index kol_comments_applicant_idx on kol_comments (applicant_id, created_at);

-- ---------------------------------------------------------------- applicant access links (status view + STEP 2)
-- Only a SHA-256 of the token is used for lookup; token_enc (AES-GCM, key derived from SESSION_SECRET)
-- lets the team copy the same link again without re-issuing it.
create table kol_access_tokens (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  applicant_id  uuid not null references kol_applicants(id) on delete cascade,
  purpose       text not null check (purpose in ('status', 'registration')),
  token_hash    text not null unique check (length(token_hash) = 64),
  token_enc     text,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);
create index kol_access_tokens_applicant_idx on kol_access_tokens (applicant_id, purpose, created_at desc);

-- ---------------------------------------------------------------- STEP 2 + campaign tracking (Module E)
create table kol_registrations (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  applicant_id     uuid not null unique references kol_applicants(id) on delete cascade,
  submission_id    uuid not null references form_submissions(id),
  visit_date       date,
  visit_time       time,
  coach_required   boolean,
  membership_name  text check (membership_name is null or length(membership_name) <= 120),
  notes            text check (notes is null or length(notes) <= 4000),
  terms_id         uuid references kol_campaign_terms(id),
  submitted_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table kol_participants (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  applicant_id    uuid not null references kol_applicants(id) on delete cascade,
  campaign_id     uuid not null references campaigns(id),
  terms_id        uuid not null references kol_campaign_terms(id),
  approved_at     timestamptz not null,
  visit_date      date,
  visit_time      time,
  visit_status    text not null default 'not_scheduled' check (visit_status in (
                    'not_scheduled', 'scheduled', 'confirmed', 'visited', 'no_show', 'cancelled')),
  coach_required  boolean,
  status          text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes           text check (notes is null or length(notes) <= 4000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (applicant_id, campaign_id)
);
create index kol_participants_org_idx on kol_participants (org_id, status, visit_date);

create table kol_deliverables (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  participant_id      uuid not null references kol_participants(id) on delete cascade,
  key                 text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label               text not null check (length(btrim(label)) between 1 and 120),
  sort_order          integer not null default 0,
  status              text not null default 'not_started' check (status in ('not_started', 'in_progress', 'submitted', 'verified')),
  url                 text check (url is null or (url ~ '^https?://' and length(url) <= 500)),
  submitted_at        timestamptz,
  verified_by         uuid references users(id),
  verified_at         timestamptz,
  views               integer check (views is null or views >= 0),
  likes               integer check (likes is null or likes >= 0),
  comments            integer check (comments is null or comments >= 0),
  shares              integer check (shares is null or shares >= 0),
  metrics_source      text check (metrics_source is null or metrics_source in ('manual', 'api')),
  metrics_updated_at  timestamptz,
  metrics_updated_by  uuid references users(id),
  note                text check (note is null or length(note) <= 1000),
  updated_at          timestamptz not null default now(),
  unique (participant_id, key),
  check ((status = 'verified') = (verified_at is not null))
);

-- Court credit ledger. source = 'internal_tracking' means the team recorded it here only;
-- nothing is deducted in the booking system (no booking integration is connected).
create table kol_court_credits (
  id              bigserial primary key,
  org_id          uuid not null references organizations(id) on delete cascade,
  participant_id  uuid not null references kol_participants(id) on delete cascade,
  kind            text not null check (kind in ('entitlement', 'usage', 'adjustment')),
  hours           numeric(6,2) not null,
  value_satang    bigint not null default 0,
  occurred_on     date not null,
  source          text not null default 'internal_tracking' check (source in ('internal_tracking', 'booking_system')),
  booking_ref     text check (booking_ref is null or length(booking_ref) <= 80),
  note            text check (note is null or length(note) <= 500),
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  check (kind <> 'usage' or hours > 0),
  check (kind <> 'entitlement' or hours >= 0)
);
create unique index kol_court_credits_one_entitlement_uq on kol_court_credits (participant_id) where kind = 'entitlement';
create index kol_court_credits_participant_idx on kol_court_credits (participant_id, occurred_on);

-- Promo codes given to a KOL. Usage is never stored here: it is read from bookings_imported through
-- the promotion that carries the same code (imported booking data), or shown as "not connected".
create table kol_promo_codes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  participant_id  uuid not null references kol_participants(id) on delete cascade,
  code            text not null check (code ~ '^[A-Z0-9_-]{3,40}$'),
  discount_bps    integer not null check (discount_bps between 1 and 10000),
  max_uses        integer check (max_uses is null or max_uses >= 1),
  valid_until     date,
  status          text not null default 'active' check (status in ('active', 'void')),
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  unique (org_id, code)
);
create index kol_promo_codes_participant_idx on kol_promo_codes (participant_id);

-- ---------------------------------------------------------------- abuse protection for public endpoints
create table public_rate_events (
  id          bigserial primary key,
  bucket      text not null,
  key_hash    text not null,
  created_at  timestamptz not null default now()
);
create index public_rate_events_lookup_idx on public_rate_events (bucket, key_hash, created_at desc);
