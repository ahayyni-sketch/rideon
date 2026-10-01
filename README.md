# RIDEON UCOXX — No Real Payment

Vercel-ready RIDEON PWA prototype with Supabase configuration endpoint.

## Important structure
- `index.html` at repository root
- `production.js` at repository root
- `api/config.js` -> `/api/config`
- `api/health.js` -> `/api/health`
- `schema.sql` is the database schema (do not rerun if already successfully applied)

## Environment variables in Vercel
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not expose the service-role key to frontend code.

## Deploy
Push the repository root to GitHub and connect the repository to Vercel. After deployment, test:
- `/api/health`
- `/api/config`

Then test Register/Login in the app.
