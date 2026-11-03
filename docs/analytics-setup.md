# Kitchen Studio visitor analytics

The connected Amplitude project is `870640` (`default`) in organization `blue-bar-623719`.
The ChatGPT plugin can query this project, but does not return its ingestion API key.

## Activation

Get the project's **public API Key** from Amplitude project settings. Do not use its
Secret Key or a Data API token. Set `AMPLITUDE_API_KEY` in the Cloudflare build
environment, or set `amplitudeApiKey` in `site.config.json` (the ingestion key is public
and will appear in browser source). `AMPLITUDE_SERVER_ZONE` / `amplitudeServerZone`
defaults to `US`; use `EU` only for an EU project. Rebuild and deploy.

Without a key the integration stays disabled. Offline and artifact builds do not
include analytics. Only the production domain is measured; automation, authentication
screens, Do Not Track and Global Privacy Control are excluded.

## Events and interpretation

- `Kitchen Studio Page Viewed`: one event per eligible page load. Use **unique users**
  for estimated visitors, and **event totals** for page views.
- `Kitchen Studio Builder Opened`: eligible loads of `/app/` or `/app`, not proof that
  someone edited or saved a kitchen.
- SDK session events: use session reporting for visits. A browser identifier persists
  in local storage across pages. Clearing storage or changing browsers/devices can
  count the same person again. No installation can recover uncollected historical data.

The event properties are limited to site, page category, a normalized path and referrer
hostname. No page titles, query strings, fragments, kitchen IDs/content, account emails,
form fields or session recordings are collected by this integration. The SDK's optional
autocapture, remote configuration and diagnostics are disabled; IP collection is disabled.
Guide and documentation paths are grouped by category.

To exclude the owner's current browser from future events, run
`window.KS_analytics.excludeThisBrowser()` in the site's console. This affects this
browser only, not historical events. Remove `KS_analytics_disabled` from local storage
to reverse it. Existing analytics queued before exclusion may already have been sent.

## Verification

Run `node --test analytics.test.mjs` and `npm run build`. After deploying with a real
key, open an eligible production page with privacy blocking disabled and confirm the
events through the connected Amplitude plugin. An SDK marked `active` alone does not
verify ingestion: confirm an ingested event in Amplitude before calling setup complete.
