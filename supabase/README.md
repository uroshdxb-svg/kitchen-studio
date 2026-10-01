# Supabase release order

The customer-data hardening release is intentionally split so the live app and
database remain compatible throughout deployment.

1. Apply `20261001102201_harden_customer_data.sql`.
2. Deploy the application commit that reads project versions and writes
   waitlist consent.
3. Confirm the landing page can join the waitlist and a signed-in user can
   create, edit and reopen a kitchen.
4. Apply `20261001103128_enforce_waitlist_consent.sql`.
5. Run the Supabase security and performance advisors again.

The first migration is backwards-compatible with the previous frontend. The
second migration rejects anonymous waitlist inserts that do not carry explicit
consent.

## Dashboard checks

The Supabase Management connector does not expose Auth redirect configuration.
Before releasing, confirm these entries in Authentication > URL Configuration:

- Site URL: `https://kitchenstudio.design`
- Redirect URL: `https://kitchenstudio.design/app/`
- Local development redirect, if needed: `http://localhost:5173/app/`

Also enable leaked-password protection. Full bot protection requires a
Cloudflare Turnstile site key and secret; the frontend currently adds a
honeypot, bounded payloads, normalized unique emails and recorded consent.
