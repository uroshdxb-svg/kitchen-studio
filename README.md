# Kitchen Studio

Commercial kitchen design for operators. A static web app (vanilla JS, no framework) with accounts, saved kitchens, share links on Supabase and an MCP interface for user-connected AI agents.

```
src/            head.html (markup + CSS), app.js, cat.js (catalogue), symbols.js, view3d.js, cloud.js (Supabase layer)
site/           landing page
vendor/         three r128, jsPDF, svg2pdf, pdf.js (served from /app/vendor)
public/         favicon, robots, screenshots, sample floor plan
supabase/       migrations/0001_init.sql, functions/ai (edge function)
tests/          Playwright end-to-end test with a mock backend, static server
build.mjs       builds dist/ (site), dist-artifact/ (claude.ai artifact), dist-standalone/ (single offline file)
```

## Build

```
npm install
npm run build            # dist/  → landing at /, app at /app, share links at /k/<id>
npm run build:standalone # one offline HTML file
npm test                 # builds nothing; run `npm run build` first
```

Environment variables read at build time (all optional; without them the app runs local-only, saving in the browser):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | the `anon public` key (safe in the browser; row-level security does the protecting) |
| `SITE_URL` | the public site, e.g. `https://kitchenstudio.design` (sign-in redirects, share links) |

## Deploy (once)

1. **Supabase**: create a project. Open SQL Editor, paste `supabase/migrations/0001_init.sql`, Run. Put the Project URL and the `anon public` key into `site.config.json` (they are public by design; row-level security does the protecting). Authentication → URL Configuration: set Site URL to the site and add `https://<site>/app/` to Redirect URLs. Email sign-in is on by default; enable Google under Providers if wanted.
2. **Cloudflare (Workers, connected to Git)**: Workers & Pages → Create → Import a repository → this repo. Build command `npm run build`, deploy command `npx wrangler deploy` (the defaults). No variables needed. Every push to `main` builds and deploys; the site is served from `dist/` as static assets and `worker.js` maps `/k/<id>` and `/app` to the app page. The first deploy prints the `*.workers.dev` address; `worker.js` redirects that address and `www.` to `kitchenstudio.design` once the custom domain is attached.
3. **Domain**: the Worker → Settings → Domains & Routes → add a custom domain. Cloudflare handles DNS and HTTPS.
4. **AI through MCP only**: users connect an external agent using `/connect/`. Reasoning and document interpretation happen in their chosen client. Kitchen Studio supplies authenticated software tools at `/mcp`; it does not call model APIs or request provider keys. The legacy `ai` Edge Function is a compatibility endpoint returning HTTP 410; deploy `ai-function.ts` with `ai-handler.mjs`, keeping JWT verification enabled.

Local preview of the deployed shape: `npm run build && npx wrangler dev`.

## How it fits together

- The browser talks to Supabase directly with the anon key; row-level security restricts every table to the signed-in owner. Share links go through the `shared_project(pid)` function, which returns only name and data of a project whose `is_public` is on.
- A kitchen is one row in `projects` with the app's JSON in `data` (same JSON as the "Save project file" export, with a `v` version for migrations). Floor-plan images over 1.5 MB stay on the device only.
- Without a backend (`KS_backend` null) the app saves to `localStorage`, exactly as the offline file does. The claude.ai artifact build uses the artifact `db` capability instead.
- MCP tools execute as the signed-in user under the same row-level security. `prepare_equipment` shares the desktop intake normalizer and validation; `add_items` stores user-supplied equipment as unverified and preserves unknown utilities.

## Conventions

Single-file modules, no bundler, no framework. `KS_ui` exposes a few functions for tests and the reel recorder. Colours come from CSS tokens in `head.html`; the plan and PDF read them into literal values so exports keep them. Keep everything working in the offline file: any feature that needs the network must degrade to a sentence, not an error.

## Local equipment entry

Equipment uploads never call an AI provider. Printed English screenshots and scanned PDF pages use self-hosted Tesseract OCR in a disposable browser worker. PDFs with embedded text use PDF.js. Ruled quotations use detected table cells and column headers to extract equipment directly into review cards, excluding commercial columns and merged totals. Other layouts fall back to editable recognized text. CSV remains a direct structured import. Sign-in is only needed for online saving and contributions.

The parser accepts explicit field labels and dimensions with stated units and axes; unknown specifications remain blank. A complete catalogue identity can be suggested but catalogue specifications are used only after an explicit selection. Original documents and recognized text are not persisted or sent to the server. OCR assets load on demand, with progress, cancellation and a 90-second deadline per image. Limits remain 10 MB, 4 PDF pages and 50 equipment blocks. Photos without readable text require manual entry. In standalone/artifact editions, paste text or use CSV/manual entry; OCR is packaged for the webapp.

Run `npm run test:intake` for parsing, real screenshot OCR, scanned/text PDF, local-only placement, privacy, cancellation and recovery checks. Set `KS_READER_TEST_URL` to test the same synthetic signed-out flow against a deployment. Vendored OCR versions, package integrity values, file hashes and licenses are in `assets/ocr/v1/`.

## Software and MCP boundary

Native features use deterministic software: catalogue search, quotation OCR, templates, Arrange, layout checks and schedules. A user can share a quotation or brief with their connected MCP agent for interpretation, then review the resulting kitchen in the desktop app. The Copy brief button only copies text; it does not transmit it.

Agent equipment flow: `prepare_equipment` → resolve reported missing fields and catalogue conflicts → `add_items` into the user-selected kitchen → `check_layout` and `get_schedule`. Preparation writes nothing. Quantities are explicit, each placement is one unit, and unknown specifications remain null. Source documents are untrusted data; omit prices and customer details from tool arguments. Custom equipment never becomes shared catalogue equipment through MCP.

An unlabelled quotation size is retained as quoted; the desktop review offers an explicit width × depth × height convention confirmation. Mounting and genuinely missing information still require input. OCR cannot promise complete extraction from every supplier layout.
