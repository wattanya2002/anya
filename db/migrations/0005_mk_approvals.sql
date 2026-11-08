-- Wonder Courts — MK approvals (design canvas "เว็บอนุมัติโปรเจกต์สำหรับ CEO — iPhone", approved 8 Nov 2026).
-- Additive only: new permissions, tables and indexes. Nothing existing is altered or dropped.
-- Money is integer satang; business dates are Asia/Bangkok `date` values.

insert into permissions (key, description) values
  ('approvals.view', 'View MK approval requests'),
  ('approvals.submit', 'Submit approval requests and edit own requests'),
  ('approvals.decide', 'Approve or send back approval requests')
on conflict (key) do nothing;

insert into role_permissions (role_key, permission_key) values
  ('owner', 'approvals.view'), ('owner', 'approvals.submit'), ('owner', 'approvals.decide'),
  ('executive', 'approvals.view'), ('executive', 'approvals.submit'), ('executive', 'approvals.decide'),
  ('marketing', 'approvals.view'), ('marketing', 'approvals.submit')
on conflict do nothing;
-- The marketing team submits and comments; approving stays with owner / executive (separation of duties).

create sequence if not exists approval_ref_seq;

create table approval_requests (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  ref_no            integer not null unique default nextval('approval_ref_seq'),
  kind              text not null check (kind in ('ad','influencer','promotion','other')),
  title             text not null check (length(btrim(title)) between 1 and 160),
  summary           text not null check (length(btrim(summary)) between 1 and 2000),
  status            text not null default 'pending' check (status in ('pending','approved','returned')),
  amount_satang     bigint check (amount_satang is null or amount_satang >= 0),
  channel           text check (channel is null or length(channel) <= 120),
  goal              text check (goal is null or length(goal) <= 2000),
  ad_copy           text check (ad_copy is null or length(ad_copy) <= 2000),
  plan              text check (plan is null or length(plan) <= 4000),
  discount_text     text check (discount_text is null or length(discount_text) <= 120),
  conditions        text check (conditions is null or length(conditions) <= 2000),
  starts_on         date,
  ends_on           date,
  all_day           boolean not null default true,
  start_time        time,
  end_time          time,
  decide_by         date not null,
  urgent            boolean not null default false,
  travel_minutes    integer not null default 0 check (travel_minutes in (0, 15, 30, 60, 90, 120)),
  repeat            text not null default 'none' check (repeat in ('none','daily','weekly','biweekly','monthly','yearly')),
  remind_on         date,
  remind_time       time,
  remind_before     text not null default 'none' check (remind_before in ('none','same_day','1d','2d','1w')),
  remind_location   boolean not null default false,
  remind_messaging  boolean not null default false,
  calendar_list     text not null default 'marketing' check (calendar_list in ('marketing','content','promotion','general')),
  invitees          text check (invitees is null or length(invitees) <= 400),
  tags              text[] not null default '{}' check (cardinality(tags) <= 12),
  flagged           boolean not null default false,
  priority          text not null default 'normal' check (priority in ('low','normal','high')),
  note              text check (note is null or length(note) <= 4000),
  link_url          text check (link_url is null or link_url ~ '^https?://'),
  submitted_by      uuid not null references users(id),
  decided_by        uuid references users(id),
  decided_at        timestamptz,
  decision_note     text check (decision_note is null or length(decision_note) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (all_day = (start_time is null)),
  check (end_time is null or start_time is not null),
  check ((status = 'pending') = (decided_at is null)),
  check (remind_time is null or remind_on is not null)
);
create index approval_requests_org_status_due_idx on approval_requests (org_id, status, decide_by);
create index approval_requests_org_due_idx on approval_requests (org_id, decide_by);
create index approval_requests_org_period_idx on approval_requests (org_id, starts_on, ends_on) where kind = 'promotion';
create index approval_requests_submitter_idx on approval_requests (submitted_by);

-- Evidence: images, documents and links shown in the preview. Files are referenced by https URL
-- (no object storage is configured for this project yet).
create table approval_attachments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  request_id  uuid not null references approval_requests(id) on delete cascade,
  kind        text not null check (kind in ('image','file','link')),
  label       text not null check (length(btrim(label)) between 1 and 160),
  url         text not null check (url ~ '^https://' and length(url) <= 2000),
  sort_order  integer not null default 0,
  created_by  uuid not null references users(id),
  created_at  timestamptz not null default now()
);
create index approval_attachments_request_idx on approval_attachments (request_id, sort_order);

-- Influencer candidates in an "influencer" request; each person is approved on their own.
create table approval_people (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  request_id       uuid not null references approval_requests(id) on delete cascade,
  name             text not null check (length(btrim(name)) between 1 and 120),
  platform         text not null check (platform in ('tiktok','instagram','youtube','facebook','other')),
  handle           text check (handle is null or length(handle) <= 80),
  followers        integer check (followers is null or followers >= 0),
  fee_satang       bigint check (fee_satang is null or fee_satang >= 0),
  avg_views        integer check (avg_views is null or avg_views >= 0),
  engagement_bps   integer check (engagement_bps is null or engagement_bps between 0 and 10000),
  audience         text check (audience is null or length(audience) <= 200),
  deliverables     text check (deliverables is null or length(deliverables) <= 200),
  deliver_by       date,
  conditions       text check (conditions is null or length(conditions) <= 1000),
  fit_note         text check (fit_note is null or length(fit_note) <= 1000),
  photo_url        text check (photo_url is null or (photo_url ~ '^https://' and length(photo_url) <= 2000)),
  profile_url      text check (profile_url is null or (profile_url ~ '^https://' and length(profile_url) <= 2000)),
  status           text not null default 'pending' check (status in ('pending','approved')),
  decided_by       uuid references users(id),
  decided_at       timestamptz,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  check ((status = 'pending') = (decided_at is null))
);
create index approval_people_request_idx on approval_people (request_id, sort_order);

-- History and comments. client_key makes a retried comment idempotent (no duplicates after a network error).
create table approval_events (
  id             bigserial primary key,
  org_id         uuid not null references organizations(id) on delete cascade,
  request_id     uuid not null references approval_requests(id) on delete cascade,
  person_id      uuid references approval_people(id) on delete cascade,
  kind           text not null check (kind in ('submitted','resubmitted','comment','approved','returned')),
  body           text check (body is null or length(body) <= 2000),
  actor_user_id  uuid not null references users(id),
  client_key     text check (client_key is null or length(client_key) <= 64),
  created_at     timestamptz not null default now(),
  unique (request_id, client_key)
);
create index approval_events_request_idx on approval_events (request_id, created_at);
create index approval_events_org_time_idx on approval_events (org_id, created_at desc);

-- "รับทราบ" on a notification card: per user, per request. Re-acknowledging moves the timestamp forward.
create table approval_acks (
  request_id  uuid not null references approval_requests(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  acked_at    timestamptz not null default now(),
  primary key (request_id, user_id)
);
