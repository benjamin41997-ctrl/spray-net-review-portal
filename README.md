# Spray-Net South Charlotte review portal

A working application for preparing customer pages and permanently assigning preprinted QR stickers. Customers need no account. Administrators use Sign in with ChatGPT and a server-side email allowlist.

## Preview

Open http://127.0.0.1:5173/admin and choose **Sign in with ChatGPT**. Loopback development uses an explicitly labeled simulated account; production uses the three approved emails configured in ignored `.dev.vars`.

The sample kitchen uses Spray-Net network photos copied from the existing portfolio assets. It is clearly identified as a sample, not a South Charlotte job. No real review destinations are configured. Test PDFs point to this computer's loopback address: do not distribute them to customers or use them to test another phone.

Restart the installed preview from this directory:

```powershell
node scripts/run-framework.mjs dev --hostname 127.0.0.1
```

## Daily workflow

1. Generate 100 stickers. Set the permanent HTTPS domain before live printing. Select your batch and label dimensions, download the PDF, and print at Actual size / 100%.
2. Scan an unused sticker while signed in, or enter its printed label under **Assign a sticker**.
3. Choose an existing job or create one. Creating from a scanned sticker retains that sticker and asks you to assign it explicitly.
4. Add an internal job name, a public title without identifying details, source, official review links, and labeled before/after photos. Preview the layout before assignment if desired.
5. Assign and activate. Draft pages are unavailable to customers. Archive disables public page/photo access; reactivation restores the original link.
6. Hand over the card or copy the personalized link for texting.

Assignments are permanent immediately, including draft jobs. Concurrent assignments cannot overwrite each other. Deleting a job retires its codes. Updates to its content never change the printed URL.

Customers can type or dictate, check/edit their text, approve it for copying, select supplied photos, and continue to external platforms. They choose their own rating and submit their own text/photos there. Nothing is automatically published or attached.

## Hosting and GitHub

Use GitHub for source/checks and a managed full-stack host for the app, database, and private photos. This build uses Sites Vinext with Cloudflare D1 and R2. GitHub Pages alone cannot run these protected APIs, storage controls, or server-side transcription.

Sites-managed hosting is the simplest deployment path for this build because it supplies authentication dispatch and storage bindings. No hosted resources, subscriptions, remote repo, or public deployment have been created. Confirm hosting entitlement, custom-domain support, limits, backup arrangements, and any plan cost before launch. OpenAI usage is billed separately and can remain disconnected. Reusing Supabase would require adapting authentication/storage and maintaining an additional integration.

**Do not expose this Worker directly on another public host with the current authentication helper.** Hosted authentication relies on Sites removing untrusted identity headers and injecting verified identity. Another host must replace this boundary with validated sessions. The simulated local identity is excluded from production builds.

Keep the QR domain under your control. Hosting migrations must retain `/q/<token>`, the database including assignments, photo objects, and DNS. Printed URLs must use your permanent domain, not a provider preview address.

## Fresh checkout

Requires Node >=22.13.0. Install the committed lockfile:

```powershell
npm run install:ci
Copy-Item .env.example .dev.vars
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_high_rictor.sql
npm run dev -- --hostname 127.0.0.1
```

Apply each migration once per database. The current local preview is already migrated. Production migration is separate. Do not commit `.dev.vars`, customer data, database state, token sheets, or credentials; these are ignored.

| Runtime value | Purpose |
| --- | --- |
| `ADMIN_EMAILS` | Comma-separated administrator emails; the three supplied addresses are configured locally. |
| `PUBLIC_ORIGIN` | Permanent HTTPS domain origin without a path; required for live printing. |
| `OPENAI_API_KEY` | Server-only secret; leave empty to use typing/direct links without transcription. |
| `ENABLE_AI_CLEANUP` | Independent switch, default `false`; also requires the API key. |

Set hosted values through secret/configuration controls. Never paste keys into GitHub or customer fields. Sites key provisioning uses the OpenAI Developers plugin when available.

Transcription uses `gpt-4o-mini-transcribe`. Optional editing uses the Responses API with `gpt-4.1-mini`. Recordings stop at two minutes. Daily quotas: five transcription and five editing attempts per QR; 100 globally for each operation. Set an API account spending limit when connecting it. Audio is not stored in D1/R2. Failed recordings remain in the browser until the page closes and can be saved or retried.

Editing instructions preserve facts, sentiment, criticism, uncertainty, and training context, correct grammar/spelling only, and prohibit added praise/details or unnecessary length. Customers may reject suggestions or restore the transcript. Models can make mistakes. Approval does not establish platform permission: keep cleanup disabled until business-provided AI editing is confirmed for your chosen destinations. This research did not establish blanket permission.

## Platform findings, checked October 2, 2026

Use account-issued links, including per-customer native links when available. Test URLs are placeholders. Actual authenticated mobile submission flows still need your listing links and phones.

| Platform | Implementation and documented limits |
| --- | --- |
| Google | Official review link; first for direct/training customers. Customer signs in/rates/submits on Google. [Google guidance](https://support.google.com/business/answer/3474122) supports link/QR requests for genuine experiences. |
| Angi | Per-job review-request link; first for Angi customers. [Angi request guidance](https://www.angi.com/articles/how-to-ask-for-reviews.htm) describes its request-review feature. [Import documentation](https://intercom.help/angi/en/articles/11172686-how-to-add-reviews-from-google) allows a one-time import of up to five most recent Google reviews; they affect public count/rating, do not undergo Angi verification, and do not count toward Super Service Award requirements. Native verified eligibility is not promised. |
| Thumbtack | Native project link when obtained; first for Thumbtack customers. [Official November 2025 announcement](https://community.thumbtack.com/discussion/2019/your-feedback-in-action-refresh-your-google-reviews-anytime) supports importing up to 100 Google reviews and refreshing them. Imports occur in your account, not automatically through this app. No verified badge is promised. |
| Apple Maps | Add only after checking the listing's ratings/photos controls. [Apple documentation](https://support.apple.com/guide/iphone/rate-places-and-add-photos-iphc3e29e15d/ios) describes ratings/photos subject to listing/region availability. No written-review form is promised. |
| Yelp | Optional neutral **Business information on Yelp** footer link, outside solicited review buttons. [Yelp guidance](https://www.yelp-support.com/article/Don-t-Ask-for-Reviews) discourages review solicitation. Inclusion alone does not establish compliance. |

No automatic imports, form prefill, photo transfers, verification claims, sentiment gating, or publication confirmation are implemented. Customers provide their own honest training-job context; the editor must preserve it.

## Privacy and activity

Links use 192-bit random tokens. Anyone holding an active link can see that job/photos: treat the card as a private bearer link. Internal names and object keys are withheld. Noindex/no-referrer complement token secrecy but do not prevent access through a shared link.

Admin uploads are resized/re-encoded as JPEG to remove metadata and stored in private R2. JPEG/PNG/WebP supported; HEIC may require JPEG export. Every photo request checks access. Public pages never receive bucket URLs. Archive revokes access. Delete removes job/photos/activity and retires assigned codes. Storage deletion failures are reported for follow-up; provider backups and device copies have separate retention.

Drafts, approval, photo selections, and confirmations persist in the same browser for up to 30 days. Another device/browser or cleared/private storage can lose the draft. **Clear my draft** removes the editable draft. Admin deletion cannot remotely remove device-local data.

Metrics distinguish visits (once per browser session), link clicks, and device-deduplicated customer-reported completions. None establish publication or unique customers. Direct platform activity is invisible here. Admin previews do not record events. Review text, recordings, IP addresses, and ratings are not saved in the activity table.

## Validation

```powershell
npm run typecheck
npm run build
# With the migrated dev server running:
node node_modules/@playwright/test/cli.js install chromium webkit
npm test
```

Browser/API tests cover authentication/header spoofing/CSRF, concurrent permanent assignment, job lifecycle and photo access, malformed uploads/links, edit conflicts, mobile photo resizing, retained drafts, platform order, accurate activity, protected preassignment preview, scanned-sticker creation, PDF export, responsive layouts, and Axe accessibility checks.

Chromium Pixel 7 and WebKit iPhone 13 emulation are used. Chromium recording uses synthetic audio and mocked transcription/editing responses. Permission denial and edit rejection are tested. Windows Playwright WebKit lacks MediaRecorder; its unavailable-recording typing fallback is tested. This is not physical-device testing or live transcription validation.

A 100-code test PDF was rendered at 300 DPI and all 100 unique links decoded. `scripts/check-qr.mjs` checks Poppler-generated `.sites-runtime/qa/qr-render-N.png`. Physical printing/scanning has not been performed. Print at 100%, measure stock alignment, and scan a live sample on both phones before distributing a batch.

Launch still requires: permanent domain and hosting plan, production secrets/allowlist and migration, genuine account links, actual iPhone/Android sign-in and photo-saving checks, live transcription if enabled, and Apple listing eligibility. Production authentication is implemented but only simulated local auth was exercised. Feature-detected WebMCP draft/editor tools do not approve or publish; real WebMCP browser support was not exercised.

GitHub build/typecheck checks are included. No remote repository was pushed and nothing was publicly deployed.
