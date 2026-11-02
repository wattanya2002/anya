# Schema plan and milestones

## Implemented — `db/migrations/0001_foundation.sql`
| Area | Tables |
|---|---|
| Identity & access | `organizations` (is_demo flag), `users`, `roles` (owner/executive/marketing/inventory), `permissions`, `role_permissions`, `memberships`, `login_attempts` |
| Audit & provenance | `audit_events` (actor/action/before/after/source/time), `import_jobs` (kind, source manual/import/api, status, counts) |
| Bookings (imported, read-only copy) | `court_types`, `bookings_imported` (unique `org_id + external_id` → re-import cannot duplicate), `promotion_feedback` |
| Marketing | `campaigns`, `promotions` (status workflow, discount in basis points), `social_metric_snapshots` (unique per platform/metric/day, source + editor), `social_targets` (per platform/metric/month) |
| Operations | `tasks` (status/completed consistency check), `notifications` |

Server enforcement: every query is scoped by the signed-in user's `org_id`; permissions are read from `role_permissions` per request (UI hiding is not relied on).

## Next migrations (not yet created — built only after the Home visual gate passes)
| Migration | Tables | Screens |
|---|---|---|
| 0002_inventory | `products`, `skus` (unique brand/type/flavour/size/pack/barcode), `inventory_locations` (Warehouse / Vending Cabinet …), `stock_movements` (immutable ledger: PURCHASE_RECEIPT, TRANSFER_IN/OUT, SALE, RETURN, DAMAGE, EXPIRED, COUNT_ADJUSTMENT), `stock_balances` (maintained in the same transaction, negative stock rejected) | S17–S19 |
| 0003_purchasing | `suppliers`, `supplier_products` (MOQ, lead time, pack), `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `goods_receipt_lines` (idempotency key per receipt) | S20–S22, S24 |
| 0004_stock_counts | `stock_counts`, `stock_count_lines`, variance approvals | S23 |
| 0005_content | `content_items`, `content_publications`, `content_assets`, `media_assets` (object storage — needs a Blob store), `task_comments`, `task_approvals` | S10–S13, S27 |
| 0006_crm | `leads`, `customer_profiles`, `lead_activities`, `lead_campaign_sources`, consent fields (PDPA) | S14–S16 (P1) |
| 0007_imports | `import_rows` (preview, mapping, validation errors), `data_sources`, `source_sync_runs` | S28 |
| 0008_promotion_sim | `promotion_scenarios`, `promotion_approvals` (no self-approval) | S08–S09 |

## Milestones
1. **Visual gate (this delivery)** — Home PC → iPad → iPhone screenshots vs master; sign-off required.
2. **Shared components** — AppShell / Card / KPI / Chart / Control / Sidebar / BottomNav reused unchanged on every screen.
3. **P0 data entry** — S28 Data Import (bookings CSV/XLSX + social metrics) so Home fills with real data; S03/S04 Social KPI + targets.
4. **P0 inventory** — S17–S24 with ledger tests (receive 24 → transfer 12 → sell 3 ⇒ cabinet 9, global 21).
5. **P0 marketing** — S02, S05–S08, S10–S13 (promotion simulator uses `lib/calc/promotion.ts`, already unit-tested).
6. **P0 admin** — S27, S29, S30 (roles UI, audit viewer, settings).
7. **P1** — CRM/LINE follow-ups (manual), approvals, executive PDF/Excel.
8. **P2** — approved integrations only (booking feed, Meta/TikTok/LINE metrics, vending export).

## Dependencies still to confirm on site (RCM §11)
- Booking site export format (fields for paid / cancelled / court type / customer id) — needed for S28 bookings import.
- Real court types and price table (350/450/600 THB/h are historical examples only).
- Vending cabinet model and whether it can export sales; SKU list, pack sizes, suppliers, lead times.
- Approvers for promotions, POs and stock adjustments.
- Official logo and banner photo (current hero/promo images are crops of the master reference; brand mark is a provisional SVG).
