# RIDEON V12 — Business System Upgrade

V12 builds on V11.1 Stable and adds a persistent business layer for parts orders, inventory, service jobs, notifications, and staff operations.

## New capabilities
- Parts checkout creates a real Supabase `orders` record and persistent `order_items`.
- No real payment is charged; the existing demo payment flow remains demo-only.
- Workshop/admin/mechanic operations dashboard reads live Supabase counts.
- Inventory table with starter stock for the real product names already shown in Parts.
- Service job table for future assignment/status workflow.
- Notifications table for customer-facing operational notifications.
- Existing login, garage, booking, roadside GPS, chat, consultation, Google Maps, product-image proxy, and favicon fixes are preserved.

## Required migration
Run `RIDEON_V12_MIGRATION.sql` once in Supabase SQL Editor after the existing migrations.

Do not reset or delete the existing database.
