-- Wonder Courts — inventory (RCM R-INV-01, S17–S19, S24 subset).
-- Additive only. Quantities are whole units; money is integer satang.

insert into permissions (key, description) values
  ('inventory.manage', 'Create/edit products, suppliers and record stock movements')
on conflict (key) do nothing;
insert into role_permissions (role_key, permission_key) values
  ('owner', 'inventory.manage'), ('inventory', 'inventory.manage')
on conflict do nothing;

create table product_categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index product_categories_org_name_uq on product_categories(org_id, lower(name));

create table brands (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  created_at  timestamptz not null default now()
);
create unique index brands_org_name_uq on brands(org_id, lower(name));

create table suppliers (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null check (length(btrim(name)) between 1 and 120),
  contact_name    text check (contact_name is null or length(contact_name) <= 80),
  phone           text check (phone is null or phone ~ '^[0-9+][0-9 -]{5,19}$'),
  line_url        text check (line_url is null or line_url ~ '^https://(line\.me|lin\.ee|page\.line\.me)/'),
  lead_time_days  integer check (lead_time_days is null or lead_time_days between 0 and 365),
  note            text check (note is null or length(note) <= 500),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index suppliers_org_name_uq on suppliers(org_id, lower(name));

create table inventory_locations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  kind        text not null check (kind in ('warehouse','cabinet','other')),
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);
create unique index inventory_locations_org_name_uq on inventory_locations(org_id, lower(name));

create table products (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  sku                   text not null check (sku ~ '^[A-Za-z0-9._-]{1,40}$'),
  name                  text not null check (length(btrim(name)) between 1 and 160),
  category_id           uuid references product_categories(id) on delete set null,
  brand_id              uuid references brands(id) on delete set null,
  supplier_id           uuid references suppliers(id) on delete set null,
  unit                  text not null default 'ชิ้น' check (length(unit) between 1 and 20),
  pack_size             integer not null default 1 check (pack_size between 1 and 10000),
  cost_satang           bigint not null default 0 check (cost_satang >= 0),
  price_satang          bigint check (price_satang is null or price_satang >= 0),
  reorder_point         integer not null default 0 check (reorder_point >= 0),
  reorder_qty           integer not null default 0 check (reorder_qty >= 0),
  barcode               text check (barcode is null or barcode ~ '^[0-9A-Za-z-]{4,32}$'),
  note                  text check (note is null or length(note) <= 500),
  is_active             boolean not null default true,
  created_by            uuid references users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index products_org_sku_uq on products(org_id, lower(sku));
create index products_org_category_idx on products(org_id, category_id);
create index products_org_brand_idx on products(org_id, brand_id);
create index products_supplier_idx on products(supplier_id);

-- Current quantity per product per location; changed only together with a stock_movements row.
create table stock_balances (
  org_id       uuid not null references organizations(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  location_id  uuid not null references inventory_locations(id) on delete cascade,
  qty          integer not null default 0 check (qty >= 0),
  updated_at   timestamptz not null default now(),
  primary key (product_id, location_id)
);
create index stock_balances_org_idx on stock_balances(org_id);

-- Immutable ledger. Corrections are new ADJUST rows, never edits.
create table stock_movements (
  id               bigserial primary key,
  org_id           uuid not null references organizations(id) on delete cascade,
  product_id       uuid not null references products(id),
  location_id      uuid not null references inventory_locations(id),
  type             text not null check (type in ('OPENING','RECEIVE','ISSUE','SALE','DAMAGE','EXPIRED','ADJUST','TRANSFER_OUT','TRANSFER_IN')),
  qty_delta        integer not null check (qty_delta <> 0),
  balance_after    integer not null check (balance_after >= 0),
  unit_cost_satang bigint check (unit_cost_satang is null or unit_cost_satang >= 0),
  note             text check (note is null or length(note) <= 300),
  reference        text check (reference is null or length(reference) <= 80),
  transfer_group   uuid,
  import_job_id    uuid references import_jobs(id),
  idempotency_key  text,
  actor_user_id    uuid references users(id),
  created_at       timestamptz not null default now(),
  check (
    (type in ('RECEIVE','OPENING','TRANSFER_IN') and qty_delta > 0) or
    (type in ('ISSUE','SALE','DAMAGE','EXPIRED','TRANSFER_OUT') and qty_delta < 0) or
    (type = 'ADJUST')
  )
);
create index stock_movements_org_time_idx on stock_movements(org_id, created_at desc);
create index stock_movements_product_idx on stock_movements(product_id, created_at desc);
create unique index stock_movements_idem_uq on stock_movements(org_id, idempotency_key, product_id, location_id)
  where idempotency_key is not null;

create or replace function forbid_ledger_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'stock_movements is append-only';
end $$;
-- UPDATE is always refused. Rows disappear only when their organization is deleted (cascade).
create trigger stock_movements_append_only before update on stock_movements
  for each row execute function forbid_ledger_mutation();

-- Upload preview rows (validated before the user confirms the import).
create table import_rows (
  import_job_id  uuid not null references import_jobs(id) on delete cascade,
  row_no         integer not null,
  data           jsonb not null,
  errors         jsonb not null default '[]'::jsonb,
  primary key (import_job_id, row_no)
);
