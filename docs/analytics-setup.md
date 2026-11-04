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

The event properties include site, page category, normalized path, referrer hostname,
country_code, internal_test, measurement_version, and allowlisted action details. Version 3
also adds account status and the selected profile country, profession and use case.
No page titles, query strings, fragments, kitchen IDs/content, account emails,
free-text form values or session recordings are collected by this integration. The SDK's optional
autocapture, remote configuration and diagnostics are disabled; IP collection is disabled.
Guide and documentation paths are grouped by category.

To exclude the owner's current browser before the next page view, open
`https://kitchenstudio.design/?analytics_exclude=1` on each device/browser.
Use `analytics_exclude=0` to resume counting. Alternatively run
`window.KS_analytics.excludeThisBrowser()` in the site's console. This affects this
browser only, not historical events. Remove `KS_analytics_disabled` from local storage
to reverse it. Existing analytics queued before exclusion may already have been sent.

## Verification

Run `node --test analytics.test.mjs` and `npm run build`. After deploying with a real
key, open an eligible production page with privacy blocking disabled and confirm the
events through the connected Amplitude plugin. An SDK marked `active` alone does not
verify ingestion: confirm an ingested event in Amplitude before calling setup complete.


## Engagement and country reporting (measurement version 2)

- `Kitchen Studio App Engaged`: once per page after a layout edit/import, equipment
  placement, explicit project creation/save, generated export, or enabled share link.
  Opening the builder, viewing its example, signing in, or restoring a project alone
  does not count. This measures browser actions, not changes made through MCP agents.
- `Kitchen Studio Equipment Added`: catalogue, custom, fabricated, duplicate or intake
  placement. `quantity` counts the items added; no model names or specifications leave.
- `Kitchen Studio Project Saved`: after successful storage, `storage=local` or `cloud`.
  Autosaves count once per edited revision per storage destination. These are successful
  save operations, not numbers of distinct projects or explicit Save-button clicks.
- `Kitchen Studio Project Created`: successful explicit new cloud kitchen.
- `Kitchen Studio Export Generated`: file generated and handed to the browser download
  mechanism (or accepted by the host downloads API). `format` and `destination` identify
  the output. This cannot prove the user retained a file on disk. `example_layout=true`
  identifies exports of the untouched example; filter these out when assessing adoption.
- `Kitchen Studio Share Enabled`: share link successfully enabled, not recipient visits.

Cloudflare returns only the request's two-letter country code from `/analytics-country`.
Responses are private/no-store. Amplitude IP collection stays disabled; no city, coordinates,
kitchen data or content is sent. Version 3 uses the opaque Supabase account UUID as the
Amplitude user ID after verified sign-in. Missing/blocked geolocation becomes `Unknown`
without interrupting the app. Country estimates can reflect a VPN or proxy location.
The SDK's `pageUrlEnrichment` is explicitly disabled (it otherwise defaults on).

Verification uses `?analytics_test=1`, retained for that tab's session. All subsequent
page, action, and SDK session events carry `internal_test=true`. Every normal new event
has `internal_test=false`; this originally used `measurement_version=2`, and the current
signup/profile integration uses `measurement_version=3`. Exclude tests in every report.
Do not use the original pre-version-2 verification events as customer traffic.

## Standard report / dashboard specification

Project: https://app.amplitude.com/analytics/blue-bar-623719/home/project/870640

Use event filters `measurement_version` in `[2,3]` and `internal_test=false` for clean
traffic reporting across both releases. Existing charts that filter only version 2
must be updated or they will stop displaying new traffic. Use version 3 for the new
signup and profile breakdowns.
Use all available dates, but clearly state collection start: page tracking began
3 November 2026; geography and engagement begin with this version's deployment.
Earlier Cloudflare screenshots are a separate 30-day visits snapshot, not unique people.

| Report | Definition |
| --- | --- |
| All-time unique visitors | Unique users of Kitchen Studio Page Viewed over the whole range |
| Weekly / monthly visitors | Same event, calendar week / calendar month intervals; never sum interval uniques into all-time uniques |
| Location | Same event grouped by event property country_code; retain Unknown |
| Landing visitors | Page Viewed with page=landing, unique users |
| Builder openings | Builder Opened, unique users |
| Actual app users | App Engaged, unique users |
| Equipment placement | Equipment Added unique users, event totals, and quantity sum separately |
| Saves | Project Saved unique users split by storage |
| Exports | Export Generated unique users split by format and example_layout |
| Return frequency | Session count distribution per user and weekly retention of Page Viewed / App Engaged |
| Acquisition / devices | Page Viewed by referrer_host / Amplitude device_type |
| Landing funnel | Page Viewed(page=landing) → Builder Opened → App Engaged, ordered, seven-day conversion window |
| Save / export conversion | App Engaged → Project Saved and App Engaged → Export Generated as separate funnels |

Treat save and export as independent outcomes: visitors can export without saving online.
Report direct-to-builder users separately, since they need not pass through the landing page.
One browser's stored anonymous identifier is not a verified human identity; clearing storage,
changing devices, blockers and privacy preferences affect coverage.

The Amplitude MCP connector can query these reports. At setup time it exposes dashboard
creation but not chart creation/saving; permanent charts must be saved through the
Amplitude UI before their IDs can be used in create_dashboard. Never pass query edit IDs
as saved chart IDs or claim an empty text dashboard is a completed reporting dashboard.

## Account conversion and profile reporting (measurement version 3)

The app calls `KS_analytics.identify(user.id, profile)` after verified sign-in and after
profile completion. `user.id` must be a Supabase UUID; email-shaped or arbitrary IDs
are ignored. The `profile` object accepts only `country_code`, `professional_role`
and `use_case`; email and display name are never forwarded. Sign-out calls
`KS_analytics.reset()` so another visitor on the same device does not inherit the
previous account's identity. Direct account switches also reset the device identity.
Do not reset on ordinary guest initialization: that would overcount returning guests.
Early queued actions retain the account/profile context they had when they occurred.

These properties accompany eligible custom events and SDK sessions, and signed-in
profiles also update the matching Amplitude user properties:

| Property | Values / meaning |
| --- | --- |
| `account_status` | `guest` or `signed_in` |
| `profile_country_code` | Selected two-letter country code, or `Unknown` |
| `country_code` | Network-derived country; remains separate from selected country |
| `professional_role` | `operator`, `chef`, `restaurant_manager`, `general_manager`, `owner`, `supplier`, `other`; missing/invalid is `unknown` |
| `use_case` | `new_opening`, `redesign`, `client_project`, `equipment_sales`, `exploring`; missing/invalid is `unknown` |

New events all retain the `Kitchen Studio ` prefix:

| Event | Meaning |
| --- | --- |
| `Signup Prompt Viewed` | A signup or profile prompt is shown |
| `Signup Prompt Dismissed` | The visitor closes the prompt |
| `Sign In Requested` | A sign-in request succeeds; this is not a completed account |
| `Sign In Completed` | The app receives a verified signed-in session |
| `Profile Completed` | Required profile choices successfully persist |
| `Feature Gated` | A restricted action is stopped and sign-in/profile completion is requested |
| `Guest Trial Started` | First guest planning activity starts the three-day browser trial |
| `Guest Trial Expired` | The app first observes that browser trial's expiry |

Controlled details are `reason` (`engagement`, `export`, `save`, `mcp`,
`custom_equipment`, `trial_expired`, `account`, `profile_required`), `feature`
(`export`, `save`, `mcp`, `custom_equipment`), and `action` (`email`, `google`,
`profile`, `dismiss`, `continue`). No free-text reason or form value is accepted.

Recommended reports:

- Signup funnel: `Signup Prompt Viewed` → `Sign In Requested` → `Sign In Completed`
  → `Profile Completed`, with prompt reason and role breakdowns.
- Export volume: `Export Generated` event totals by format, profile country, role and
  use case; exclude internal tests and untouched example layouts. Unique users gives
  exporters, not export files.
- Kitchen creation: `Project Created` event totals and unique creators. This measures
  new online kitchens created through the app after tracking began.
- Save activity: `Project Saved` event totals with `storage=cloud` and unique savers.
  Repeated saves of one kitchen produce multiple events. Do not call this a count of
  distinct saved kitchens.
- Current saved kitchens: query `public.projects` for the authoritative current row
  count and distinct owners, optionally joining `profiles` for country/role/use case.
  Browser analytics cannot reconstruct historical projects or edits made solely by MCP.

Authenticated events can now join one account across devices; anonymous visits still
depend on browser storage. Blockers and privacy choices limit analytics coverage.
