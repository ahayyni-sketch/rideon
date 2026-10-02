# RIDEON UCOXX — No Real Payment

Vercel-ready RIDEON PWA with Supabase.

## Important structure
- `index.html` at repository root
- `production.js` at repository root
- `api/health.js` -> `/api/health` (also supplies the public Supabase URL + anon key)
- `api/config.js` is no longer required by the frontend
- `schema.sql` is the database schema (do not rerun if already successfully applied)

## Environment variables in Vercel
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not expose the service-role key to frontend code.

## Deploy
Push the repository root to GitHub and connect the repository to Vercel. After deployment, test `/api/health`. Then test Register/Login.


## RIDEON Final security & customer service update

This build adds:
- dynamic "Welcome back, [registered name]"
- 15-minute inactivity auto logout; if the site was closed, a session older than 15 minutes is forced to sign in again on next open
- explicit logout from the sidebar/account page
- real browser GPS for roadside requests, including live customer location updates while an active request is open
- OpenStreetMap + Overpass nearby motorcycle workshop discovery with available opening-hours status
- customer service consultation tickets stored in Supabase
- staff/customer-service inbox and reply flow in Workshop Console

### Required after updating the files
If the original `schema.sql` was already executed before this build, run `SUPPORT_MIGRATION.sql` once in Supabase SQL Editor. It adds the `support_messages` table, RLS policies, realtime publication, and the customer roadside-location update policy.

The workshop map depends on browser geolocation permission and public OpenStreetMap/Overpass data. Opening status can only be determined when a workshop has usable `opening_hours` data.

No real payment gateway is used in this build.
