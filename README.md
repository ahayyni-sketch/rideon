# RIDEON V11 – Customer Experience Upgrade

## Main changes
- Fresh customer state: no demo motorcycle, no fake mileage, no fake service history.
- Motorcycle registration is stored in Supabase `vehicles`.
- Book a Service requires a registered motorcycle and attaches the booking to the selected vehicle.
- Roadside Assistance can optionally use a registered motorcycle and includes Google Maps links for the customer's captured GPS location.
- Book a Service includes nearby workshop discovery plus Google Maps.
- Parts & Accessories expanded with real-market brand/model examples: MOTUL, Shell Advance, KYT, NJS, MAXXIS, Pirelli, GS Astra, MotoBatt and maintenance items.
- Product cards include product images, fitment notes and source/product links.
- Pricing is marked as indicative and should be replaced with RIDEON supplier pricing before production checkout.
- No car workshop service is shown; car repair remains mobile/on-demand call-out only.
- Existing Supabase Auth, service history, chat, mechanic GPS tracking and 5-minute auto logout are preserved.

## Supabase
No new database migration is required for these V11 customer UI changes beyond the V10 migration already used for chat/tracking. Vehicle registration uses the existing `vehicles` table.

## Product image note
Images are linked to manufacturer/retailer-hosted product assets. Because remote assets can change or disappear, RIDEON should eventually host licensed product images in its own storage/CDN.
