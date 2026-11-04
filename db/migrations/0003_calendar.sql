-- Wonder Courts — Global Master Calendar (RCM Addition, docs/RCM_ADDITION_MASTER_CALENDAR.md).
-- Additive only. Only manually added items are stored here; promotions, campaigns, tasks and
-- stock alerts are read from their own tables at query time (no duplicated data).

insert into permissions (key, description) values
  ('calendar.view', 'View the master calendar (team items and permitted sources)'),
  ('calendar.manage', 'Add and edit own calendar items'),
  ('calendar.view_executive', 'See calendar items marked executive-only'),
  ('crm.followup', 'See customer follow-up items in the calendar')
on conflict (key) do nothing;

insert into role_permissions (role_key, permission_key) values
  ('owner', 'calendar.view'), ('owner', 'calendar.manage'), ('owner', 'calendar.view_executive'), ('owner', 'crm.followup'),
  ('executive', 'calendar.view'), ('executive', 'calendar.manage'), ('executive', 'calendar.view_executive'), ('executive', 'crm.followup'),
  ('marketing', 'calendar.view'), ('marketing', 'calendar.manage'), ('marketing', 'crm.followup'),
  ('inventory', 'calendar.view'), ('inventory', 'calendar.manage')
on conflict do nothing;

create table calendar_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  title           text not null check (length(btrim(title)) between 1 and 160),
  kind            text not null check (kind in ('promotion','content','appointment','general','stock','court_event','report','followup')),
  starts_on       date not null,
  ends_on         date not null,
  all_day         boolean not null default true,
  start_time      time,
  end_time        time,
  repeat          text not null default 'none' check (repeat in ('none','daily','weekly','monthly')),
  repeat_until    date,
  owner_user_id   uuid references users(id) on delete set null,
  status          text not null default 'planned' check (status in ('planned','in_progress','done','cancelled')),
  remind_minutes  integer check (remind_minutes is null or remind_minutes between 0 and 10080),
  details         text check (details is null or length(details) <= 4000),
  link_url        text check (link_url is null or link_url ~ '^https?://'),
  visibility      text not null default 'team' check (visibility in ('private','team','executive')),
  created_by      uuid not null references users(id),
  updated_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (ends_on - starts_on <= 366),
  check (all_day = (start_time is null)),
  check (end_time is null or start_time is not null),
  check (end_time is null or ends_on > starts_on or end_time > start_time),
  check (repeat_until is null or (repeat <> 'none' and repeat_until >= starts_on))
);
create index calendar_events_org_start_idx on calendar_events (org_id, starts_on);
create index calendar_events_org_end_idx on calendar_events (org_id, ends_on);
create index calendar_events_owner_idx on calendar_events (owner_user_id);
create index calendar_events_creator_idx on calendar_events (created_by);

-- In-app alerts are generated idempotently: one notification per (user, dedupe_key).
alter table notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_user_dedupe_uq on notifications (user_id, dedupe_key) where dedupe_key is not null;
