-- Wonder Courts — foundation schema (RCM §5, P0 subset needed by Home S01).
-- Inventory / PO / content tables are added in later migrations per the milestone plan.
-- Money is stored as integer satang (bigint). Timestamps are timestamptz (UTC);
-- business dates are `date` values already expressed in Asia/Bangkok.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------- identity
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 120),
  timezone    text not null default 'Asia/Bangkok',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table users (
  id                    uuid primary key default gen_random_uuid(),
  email                 citext not null unique,
  display_name          text not null check (length(display_name) between 1 and 80),
  password_hash         text not null,
  status                text not null default 'active' check (status in ('active','disabled')),
  must_change_password  boolean not null default false,
  session_version       integer not null default 1,
  created_at            timestamptz not null default now(),
  last_login_at         timestamptz
);

create table roles (
  key      text primary key,
  name_th  text not null
);

create table permissions (
  key          text primary key,
  description  text not null
);

create table role_permissions (
  role_key        text not null references roles(key) on delete cascade,
  permission_key  text not null references permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

create table memberships (
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role_key    text not null references roles(key),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on memberships(user_id);

create table login_attempts (
  id            bigserial primary key,
  ip            text not null,
  email         citext,
  succeeded     boolean not null,
  attempted_at  timestamptz not null default now()
);
create index login_attempts_ip_time_idx on login_attempts(ip, attempted_at desc);

create table audit_events (
  id             bigserial primary key,
  org_id         uuid references organizations(id) on delete cascade,
  actor_user_id  uuid references users(id),
  action         text not null,
  entity_type    text not null,
  entity_id      text,
  before         jsonb,
  after          jsonb,
  source         text not null default 'web',
  created_at     timestamptz not null default now()
);
create index audit_events_org_time_idx on audit_events(org_id, created_at desc);

-- ---------------------------------------------------------------- data provenance
create table import_jobs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  kind         text not null check (kind in ('bookings','social_metrics','customers','products','stock','other')),
  source       text not null check (source in ('manual','import','api')),
  status       text not null default 'pending' check (status in ('pending','validating','completed','failed','rolled_back')),
  file_name    text,
  row_count    integer not null default 0,
  error_count  integer not null default 0,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index import_jobs_org_kind_idx on import_jobs(org_id, kind, finished_at desc);

-- ---------------------------------------------------------------- courts & imported bookings
create table court_types (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_-]{1,40}$'),
  name_th     text not null,
  color       text not null default 'pink' check (color in ('pink','blue','purple','green','amber')),
  sort_order  integer not null default 0,
  unique (org_id, key)
);

create table campaigns (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  name                  text not null check (length(name) between 1 and 160),
  objective             text,
  status                text not null default 'draft' check (status in ('draft','approval','live','ended')),
  starts_on             date,
  ends_on               date,
  planned_spend_satang  bigint not null default 0 check (planned_spend_satang >= 0),
  tracking_code         text,
  owner_user_id         uuid references users(id),
  created_by            uuid references users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (org_id, tracking_code)
);

create table promotions (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  name              text not null check (length(name) between 1 and 160),
  code              text,
  status            text not null default 'draft'
                    check (status in ('draft','pending_approval','approved','rejected','live','expired','cancelled')),
  discount_bps      integer not null default 0 check (discount_bps between 0 and 10000),
  starts_at         timestamptz,
  ends_at           timestamptz,
  cover_image_path  text,
  campaign_id       uuid references campaigns(id) on delete set null,
  created_by        uuid references users(id),
  approved_by       uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, code),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table bookings_imported (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  import_job_id   uuid not null references import_jobs(id),
  external_id     text not null,
  play_date       date not null,
  start_time      time,
  hours           numeric(6,2) not null check (hours > 0),
  court_type_id   uuid references court_types(id),
  amount_satang   bigint not null check (amount_satang >= 0),
  status          text not null check (status in ('paid','pending','cancelled','refunded')),
  customer_ref    text,
  promotion_id    uuid references promotions(id) on delete set null,
  campaign_id     uuid references campaigns(id) on delete set null,
  source_channel  text check (source_channel in ('facebook','instagram','tiktok','line','site','referral','other')),
  verified_at     timestamptz,
  synced_at       timestamptz not null default now(),
  unique (org_id, external_id)
);
create index bookings_imported_org_date_idx on bookings_imported(org_id, play_date) where status = 'paid';
create index bookings_imported_customer_idx on bookings_imported(org_id, customer_ref, play_date) where status = 'paid';
create index bookings_imported_promo_idx on bookings_imported(promotion_id) where promotion_id is not null;

create table promotion_feedback (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  promotion_id  uuid not null references promotions(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comment       text,
  source        text not null check (source in ('manual','import','api')),
  received_on   date not null,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);
create index promotion_feedback_promo_idx on promotion_feedback(promotion_id, received_on);

-- ---------------------------------------------------------------- social KPI (R-SOC-01)
create table social_metric_snapshots (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  platform       text not null check (platform in ('facebook','instagram','tiktok','line')),
  metric         text not null check (metric in ('reach','impressions','views','engagement','profile_visits','link_clicks','leads','paid_bookings','spend_satang','friends')),
  snapshot_date  date not null,
  value          numeric(16,2) not null check (value >= 0),
  source         text not null check (source in ('manual','import','api')),
  import_job_id  uuid references import_jobs(id),
  entered_by     uuid references users(id),
  updated_at     timestamptz not null default now(),
  unique (org_id, platform, metric, snapshot_date)
);
create index social_snapshots_org_metric_idx on social_metric_snapshots(org_id, metric, snapshot_date);

create table social_targets (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  platform     text not null check (platform in ('facebook','instagram','tiktok','line')),
  metric       text not null,
  month        date not null check (extract(day from month) = 1),
  target       numeric(16,2) not null check (target >= 0),
  updated_by   uuid references users(id),
  updated_at   timestamptz not null default now(),
  unique (org_id, platform, metric, month)
);

-- ---------------------------------------------------------------- tasks & notifications (R-OPS-01)
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  title          text not null check (length(btrim(title)) between 1 and 200),
  due_date       date not null,
  due_time       time,
  status         text not null default 'open' check (status in ('open','done','cancelled')),
  priority       text not null default 'normal' check (priority in ('low','normal','high')),
  owner_user_id  uuid references users(id),
  created_by     uuid not null references users(id),
  completed_by   uuid references users(id),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((status = 'done') = (completed_at is not null))
);
create index tasks_org_due_idx on tasks(org_id, due_date, due_time);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null,
  body        text,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_unread_idx on notifications(user_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------- reference data
insert into roles (key, name_th) values
  ('owner', 'ผู้จัดการระบบ'),
  ('executive', 'ผู้บริหาร'),
  ('marketing', 'ฝ่ายการตลาด'),
  ('inventory', 'ฝ่ายสต็อก');

insert into permissions (key, description) values
  ('dashboard.view', 'View Home dashboard'),
  ('dashboard.view_financial', 'View revenue and financial KPIs'),
  ('marketing.view', 'View marketing and social performance'),
  ('promotions.view', 'View promotions'),
  ('customers.view_aggregate', 'View aggregate customer KPIs'),
  ('tasks.manage', 'Create and complete tasks in own organization'),
  ('inventory.view', 'View inventory'),
  ('admin.manage', 'Manage users, roles and integrations'),
  ('audit.view', 'View audit log');

insert into role_permissions (role_key, permission_key)
select 'owner', key from permissions;

insert into role_permissions (role_key, permission_key) values
  ('executive','dashboard.view'), ('executive','dashboard.view_financial'), ('executive','marketing.view'),
  ('executive','promotions.view'), ('executive','customers.view_aggregate'), ('executive','tasks.manage'),
  ('executive','inventory.view'), ('executive','audit.view'),
  ('marketing','dashboard.view'), ('marketing','marketing.view'), ('marketing','promotions.view'),
  ('marketing','customers.view_aggregate'), ('marketing','tasks.manage'),
  ('inventory','dashboard.view'), ('inventory','tasks.manage'), ('inventory','inventory.view');
