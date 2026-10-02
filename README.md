# Spray-Net South Charlotte review portal

The customer portal and admin interface now build as a static **GitHub Pages** website. Protected APIs run separately. The previous Sites/Vinext login and hosting dependency have been removed. Customer/job information and private photos never go into the Pages artifact or public repository.

## Permanent stickers and personalization

The proposed permanent portal address is:

```text
https://benjamin41997-ctrl.github.io/spray-net-review-portal/
```

Every preprinted sticker contains that same page path plus its own random token:

```text
https://benjamin41997-ctrl.github.io/spray-net-review-portal/?code=RANDOM_TOKEN
```

The static application asks the secure backend which job belongs to that token and displays the matching photos/review options. You can generate 100 stickers, grab any unused one, assign it later, and keep updating the original job. Assignment is permanent; deleted jobs retire their codes. Tokens have 192 bits of randomness. This uses one reusable page and needs no GitHub redirects or rewrite rules.

The printed link points to GitHub Pages even if the backend moves. Update the public configuration and migrate the database/photos while preserving token assignments. Keep the GitHub account, repository name/path, and published page available. **No repository has been pushed or published yet; this is the prepared URL, not a live site.**

## Working local preview

Open http://127.0.0.1:5173/spray-net-review-portal/?admin=1 and choose **Enter local admin preview**. This explicit simulated sign-in only works with the loopback development API. Production never accepts its token or exposes its sign-in endpoint.

The sample kitchen is clearly labeled as Spray-Net network imagery, not a South Charlotte job. No real review links or transcription credentials are connected. Sample data from the earlier prototype has been retained locally.

```powershell
# Installed checkout:
node scripts/dev.mjs
```

For a fresh checkout, use Node >=22.13.0:

```powershell
npm ci --no-audit --no-fund
Copy-Item .env.example .dev.vars
npm run db:local
npm run dev
```

The local database is already migrated. Apply the SQL only once on a new database. The dev script starts a static Vite frontend on 5173 and a separate local Worker on 8787, creates a random local-only admin token when needed, and stores runtime state in ignored directories. Ctrl+C stops the preview. The three supplied admin emails remain in the ignored `.dev.vars` file.

## Architecture and authentication

| Part | Implementation |
| --- | --- |
| Public pages and admin UI | React/Vite static build, uploaded to GitHub Pages from `dist/site`. |
| Protected API | Standalone Cloudflare Worker, `backend/worker.ts`. It can now be hosted independently of Sites. |
| Project/QR/activity records | Private Cloudflare D1 database, with the existing SQL schema and permanent assignment protections. |
| Project photos | Private R2 bucket; the API checks access before serving each image. |
| Administrator sign-in | Supabase email magic links. The Worker verifies the access token with Supabase's Auth server and checks a confirmed, non-anonymous email against its own allowlist. |
| Customer drafts | Browser-local storage for up to 30 days, with no customer registration. |

The workspace already contains a Supabase project used by the networking app. Its authentication can be reused after reviewing that project's settings. This build has not modified it, created accounts, sent invitations, or sent sign-in emails. Supabase handles identity only; review data/photos stay in D1/R2. The split retains the tested database/storage implementation but means maintaining Supabase and Cloudflare configuration as well as GitHub Pages.

Client-supplied identity headers are never trusted. Neither the static site nor a hidden admin button can authorize writes. The backend validates every protected request, accepts CORS only from configured origins, and rejects mutations from other origins. Frontend images fetch through authenticated requests when necessary; access tokens are never put in image URLs. Production does not depend on ChatGPT/Sites sign-in.

## Public Pages configuration

`public/portal-config.json` contains only public connection settings. Its checked-in backend/auth fields are intentionally blank until launch. Development serves local values without changing this file.

| Field | Value |
| --- | --- |
| `apiBaseURL` | HTTPS origin of the deployed Worker, without `/api`. |
| `portalURL` | Full permanent GitHub Pages URL including the repository path and trailing slash. |
| `supabaseURL` | Chosen Supabase project's public HTTPS URL. |
| `supabasePublishableKey` | Public publishable key or legacy anon key only. Never a secret/service-role key. |
| `localPreview` | Always `false` in a production artifact; a client setting cannot enable production mock authentication. |

The configuration script rejects credentials in URLs and private Supabase keys. **OpenAI keys, SMTP passwords, admin access tokens, and service-role keys never belong here or in repository variables used to build the website.** Backend secrets are separate from public Pages settings.

## Prepare deployment; publish after review

1. Create the intended GitHub repository and push the reviewed source. Select **GitHub Actions** as its Pages publishing source. Confirm the permanent URL before live printing.
2. In Cloudflare, prepare the D1 database and private R2 bucket. Replace the placeholder database ID in `wrangler.jsonc`. `wrangler.local.jsonc` uses only local preview storage. No cloud resources have been provisioned by this build.
3. Configure Worker secrets: `ADMIN_EMAILS` with the three approved addresses, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and optionally `OPENAI_API_KEY`. Keep `ENVIRONMENT=production` and `ENABLE_AI_CLEANUP=false`. Set `PUBLIC_PORTAL_URL` to the full GitHub URL and `ALLOWED_ORIGINS` to its origin, e.g. `https://benjamin41997-ctrl.github.io`. Do not upload `LOCAL_ADMIN_TOKEN`.
4. Apply `drizzle/0000_high_rictor.sql` to the production database once, then deploy the Worker. Local preview state is not automatically copied to production. Start production sticker batches in that production database.
5. In Supabase, prepare existing confirmed admin accounts for the three approved emails and allow the exact callback URL `https://benjamin41997-ctrl.github.io/spray-net-review-portal/?admin=1`. The UI uses `shouldCreateUser:false`, so login does not create accounts. Check [passwordless setup](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [email delivery requirements](https://supabase.com/docs/guides/auth/auth-smtp); configure reliable delivery for all approved recipients before launch. Do not change another application's Site URL or email template without reviewing its impact.
6. Set GitHub repository variables `REVIEW_API_BASE_URL`, `REVIEW_SUPABASE_URL`, and `REVIEW_SUPABASE_PUBLISHABLE_KEY`. These values are public. The manual Pages workflow computes the portal URL/repository base path and refuses to publish if the connection settings are missing.
7. Run **Publish review portal to GitHub Pages** manually after approval. Only `dist/site` is uploaded; the Worker, database files, credentials, customer records, and local test sheets are excluded.
8. Test the actual hosted email sign-in, job creation/assignment, photo saving, native platform links, and optional transcription. Print and scan one live sticker at 100% scale on the intended stock before distributing a batch.

`npm run backend:build` is a **dry run** that produces `dist/api` without deploying. No automated backend deployment or paid-service provisioning is included. The static build and Worker bundle are both prepared and checked locally.

## Costs and maintenance

No paid plan or new service has been purchased. GitHub Pages hosting depends on repository visibility and your GitHub plan. Existing public Pages projects can use the current workflow. [GitHub documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) describes availability.

As checked October 2, 2026, [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) includes 100,000 requests/day and a 10 ms CPU limit per invocation; D1 has free allowances. Workers Paid starts at $5/month. Free-plan suitability still needs testing on the deployed workload, especially bulk operations. [R2 Standard](https://developers.cloudflare.com/r2/pricing/) includes 10 GB-month of storage plus operation allowances; excess usage is metered. Confirm billing activation and account settings before provisioning.

[Supabase](https://supabase.com/pricing) has a free plan; reusing the existing project's authentication avoids adding another database project, but its current plan, shared quotas, availability, and email provider still need review. Email delivery and OpenAI usage can add separate costs. No plan change is implied or authorized by this implementation.

## Review editing and daily use

Prepare page, upload/reorder/label photos, add official platform links, preview, assign a sticker, and activate. Draft/unassigned codes show that the page is not ready. Archive disables access and can later be reversed for the same job. Delete removes customer data and permanently retires its codes.

Customers see supplied before/after photos, type or dictate honest feedback, edit/check it, select photos themselves, copy approved text, save images, and continue to the originating platform. Direct/training customers start with Google; Angi/Thumbtack jobs prioritize their native link. Publication and ratings occur on the external platform.

Transcription uses `gpt-4o-mini-transcribe` when a server key is connected. Optional cleanup uses `gpt-4.1-mini` and is independently disabled by default. Instructions preserve facts, criticism, sentiment, uncertainty and training disclosures and forbid invented praise, keywords, or needless expansion. Customers can reject edits or restore the transcript. Customer approval does not establish platform permission; keep AI cleanup off until verified for the intended destinations.

Recordings stop at two minutes. Daily limits are five transcription and five cleanup requests per QR, with 100 global requests per operation. Audio is not stored in D1/R2. Failed recordings remain in the browser until the page closes and may be saved or retried. API spending limits should be configured when connecting paid transcription.

## Verification

```powershell
npm run typecheck
npm run build
npm run backend:build
# While the frontend/API preview is running:
node scripts/preview-static.mjs
# In another terminal, with browsers installed:
npm test
```

The 30-check suite passes in Chromium Pixel 7 and WebKit iPhone 13 emulation. It covers static repository paths, permanent query links, job content updates with unchanged links, concurrent immutable assignments, archived/deleted access, authenticated images, cross-origin downloads, scanned-sticker creation, protected previews, draft restoration after external navigation, accurate metrics, QR PDFs, mobile layout and Axe checks. Auth tests require provider-verified confirmed allowlisted identity and reject forged tokens, anonymous users and production mock sign-in.

Production tests serve only `dist/site` with no application server, bridge its requests to the local API using test interception, and verify that mock login cannot be enabled through public configuration. No live Supabase or OpenAI calls are made. Chromium recording uses synthetic audio/mocked processing; Windows WebKit lacks MediaRecorder, so its typing fallback is tested. Physical iOS/Android app flows, real email delivery, live transcription, and printer readability remain launch checks.

Both local and GitHub-address TEST PDFs are generated. The GitHub-address version is a layout/URL-format sample tied to preview tokens, **not a production sticker batch**. Render it at 300 DPI and run `node scripts/check-qr.mjs .sites-runtime/qa github-qr-render` to check all 100 query-token codes. Actual customer sheets must be generated from the activated production backend.

GitHub checks build both artifacts and run the local/browser suite. The deployment workflow is manual. The previous prototype remains recoverable in Git history and ignored local backup files.

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
