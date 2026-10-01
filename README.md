# RIDEON UCOXX — Production Web/PWA (No Real Payments)

This version is designed for Vercel + Supabase. It keeps the RIDEON UCOXX frontend and adds real user accounts, permanent database storage, roadside GPS, workshop dispatch, and live mechanic tracking.

## Included
- Supabase Auth: email/password accounts
- PostgreSQL data: profiles, vehicles, bookings, roadside requests, orders, mechanic locations
- Permanent customer data and order history
- Customer GPS capture for roadside requests
- Workshop/admin mechanic assignment
- Mechanic GPS sharing with Supabase Realtime
- Live customer tracking map
- PWA support
- Demo payment only: orders can be marked `demo-paid`, but no money is charged and no payment gateway is contacted

## Deploy to Vercel
1. Create a Supabase project.
2. Run `schema.sql` in Supabase SQL Editor.
3. In Vercel, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as environment variables.
4. Import this folder/repository into Vercel and deploy.
5. Open the deployed site and create a RIDEON account.

## Important security note
Keep `SUPABASE_SERVICE_ROLE_KEY` only in Vercel/server-side environment variables. Never put it into frontend JavaScript.

## Demo payment behavior
The app deliberately does NOT include Midtrans, Xendit, bank payment, card charging, or any real-money payment flow. When a user clicks `Mark demo paid`, the order is simply updated in Supabase with `payment_status = paid` and `payment_type = demo`. This is for prototype/operational testing only.

## Live GPS
Customer GPS requires browser location permission. A workshop/admin user assigns a mechanic to a roadside request. The mechanic signs in, enters the request UUID, and starts live GPS sharing. The customer's screen subscribes to `mechanic_locations` through Supabase Realtime.

## Before public commercial launch
Add a real payment provider, stronger dispatch/notification logic, rate limiting, monitoring, privacy/consent controls, and a dedicated mechanic mobile workflow.
