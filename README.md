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

The sample kitchen is clearly labeled as Spray-Net network imagery, not a South Charlotte job. The supplied Google review link is connected; transcription credentials are not connected. Do not submit sample feedback to the real listing. Sample data from the earlier prototype has been retained locally.

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

## Google handoff

New jobs default to the supplied official link: [Spray-Net South Charlotte on Google](https://g.page/r/CdBR4AUNk5DkEAI/review). Administrators can change or remove it while editing a job. Existing job destinations are preserved; the local demo has been connected explicitly. Angi/Thumbtack source ordering remains unchanged.

After the customer approves their wording on the check screen, **Paste my review to Google** copies the approved text and opens that exact link in the same tab. This avoids asynchronous pop-up blocking. The customer pastes into Google, chooses their own stars, optionally attaches saved photos, and submits. No customer text is added to a URL or sent through an import endpoint. Clipboard failure keeps the portal open, selects the draft, and gives manual-copy instructions. **Go directly to review options** remains available from the guided screens; **Continue to Google** opens Google without a draft or approval. The primary button explicitly explains that copying happens here and the customer taps Paste on Google.

[Google requires a Google Account](https://support.google.com/business/answer/3474122?hl=en), including accounts with a non-Gmail email. Google handles its own sign-in; the portal cannot inspect Google cookies or guarantee that a browser and the Maps app share a session. Opening Google first is available for customers who want to sign in before drafting. A separate portal Google login would add friction and would not establish a Maps/browser session.

The [documented Business Profile review API](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews) supports reading reviews and managing business replies; it has no method to create/import customer reviews or prefill the public review form. This integration uses the official review link and customer-controlled clipboard handoff.

The real supplied link was opened read-only in the available signed-in browser and displayed the Spray-Net South Charlotte review composer. No rating, text, photos, or review was submitted. The signed-out native flow was not exercised because this browser already has a Google session. Automated mobile tests intercept the external link and cover exact approved copying, denied clipboard, direct access, Back/draft recovery, default/override links, and accurate click-only metrics. They do not verify live Google sign-in or publication.

## Customer photo handoff

The Photos step initially has exactly three choices: **Share all photos**, **Select which photos to include**, and **Don't share my photos, I don't want neighbors to be envious**. Supplied images are visible without selection checkboxes until the customer chooses the selection option.

**Share all photos** requests downloads of every supplied image as a separate JPEG directly from the customer's tap. It uses browser downloads rather than the phone share menu, a ZIP archive, or an automatic upload to Google. Files are fetched and prepared before the tap; the button waits until all photos are ready. **Select which photos to include** reveals checkboxes and downloads only the chosen images. The customer then taps Next to continue to Google sharing.

The opt-out deselects the photos for review inclusion and shows **Download photos for myself** alongside Next. Personal downloads do not reselect photos for the review. Customers can continue without downloading anything. The opt-out and individual selections survive reload and returning from Google.

Browsers may prompt to allow multiple downloads, save automatically, or block some files. The portal requests the downloads; it cannot force a particular save dialog, confirm that files were saved, or place files in Camera Roll. After a download request, **Download didn't start?** provides individual buttons as a fallback. Status says downloads requested, never Saved, Uploaded, or Published. Missing files can be retried or excluded without blocking the opt-out.

On Google, customers choose Add photos and attach the downloaded images from Downloads/Files or Recents when available. Physical iPhone/Android verification is still needed for the actual save dialog, folder, and Google file picker. Automated Chromium/WebKit tests verify all-file JPEG download events, exactly three initial choices, chosen-file downloads, private opt-out downloads with empty review selection, individual retry downloads, missing-photo recovery, and selections surviving a mocked Google trip. No real Google uploads are attempted.

## Review editing and daily use

Prepare page, upload/reorder/label photos, add official platform links, preview, assign a sticker, and activate. Draft/unassigned codes show that the page is not ready. Archive disables access and can later be reversed for the same job. Delete removes customer data and permanently retires its codes.

The customer sees **We loved working with you, [name]!** with **Type my review** and **Speak my review** as the first choices. Admins enter an optional first/display name, stored as the public greeting in the existing title field, independently of the private internal job name. Legacy project titles fall back to **We loved working with you!** until a greeting name is set. Both paths use the same spelling, grammar, sentence-flow, and formatting editor by default. Typed reviews are prepared on **Next**; voice reviews go from **Done recording** through transcription and optional editing directly to the check screen, without requiring another tap to format. **Automatically format my review** starts checked; unchecking it bypasses AI and the preference persists. The next screen remains editable and Next explicitly approves the wording. Next they edit/approve their words, select/save supplied photos, and choose **Paste my review to Google** or their originating platform. Only one step is displayed at a time. The final screen leads with six numbered Google instructions and the copy/open button. Edit my review is removed; the collapsed See my review and photo-download shortcut sit at the bottom. Customers can use Back to revisit the earlier check step. Photo instructions use the current selected-image count, including after returning to change a selection. Download requests do not establish that files were saved. Opt-outs receive instructions for posting without pictures. Clipboard failure opens that disclosure and selects the text. Direct/training customers start with Google; Angi/Thumbtack jobs prioritize their native link. Publication and ratings occur on the external platform.

Transcription defaults to `gpt-transcribe`. Local testing uses `gpt-6-luna`; production configuration and the backend fallback retain `gpt-6.1-sol`. Both editors send `reasoning: { effort: "low" }` in the server-side Responses request and use the same editing prompt. Worker-only `TRANSCRIPTION_MODEL` and `REVIEW_EDITOR_MODEL` variables allow a supported alternative without changing the public site. Legacy non-reasoning model overrides omit the reasoning parameter. Cleanup remains independently disabled until an API key and `ENABLE_AI_CLEANUP=true` are configured. Both typed and voice input respect the customer's persistent **Automatically format my review** opt-out.

To change the editor model, edit `REVIEW_EDITOR_MODEL` in `wrangler.local.jsonc` for local use and `wrangler.jsonc` for production. A value in the ignored `.dev.vars` file overrides local configuration. Restart the local backend after changing configuration; production changes require a backend deployment. The API key grants access and billing, but does not choose the model. Edit `reviewEditingInstructions` in `backend/review-editor.ts` to change the prompt. The backend sends those instructions with every customer text/transcript through the Responses API's `instructions` field; no prompt setup in the OpenAI dashboard or Codex model selection is needed. The existing 4,000 output-token cap includes reasoning and visible review text; incomplete outputs are rejected and the original retained. Sol supports low reasoning according to the [official model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

For late-stage Sol testing, change `REVIEW_EDITOR_MODEL` to `gpt-6.1-sol` in both `.dev.vars` (if present) and `wrangler.local.jsonc`. The ignored local configuration currently explicitly selects Luna so live connection checks also use the cheaper editor. Automated request/voice/preparation tests mock the OpenAI responses and do not consume API credits. Manual transcription and AI formatting in the portal do consume API credits. No model comparison or paid live API request was needed to change this setting. Luna's low reasoning setting is supported by the [official model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna).

During transcription or editing, customers see a dedicated **Preparing your review…** screen with an animated indeterminate bar and the actual processing stage. After 25 seconds it says **Still working. This is taking a little longer.** The timer is reassurance only: it never reports a completion percentage or finishes the request. The check screen appears as soon as the real request completes; failure restores the editor with the original draft and retry/fallback controls. Microphone permission has a separate setup message. Stage updates use a polite screen-reader announcement, and reduced-motion settings stop the animations.

The editor allows substantial stylistic rewriting: a clearer opening, coherent sentence order, unpacked shorthand, connected fragments, natural equivalent word choices, and short paragraphs. It gives customer-supplied work a specific ordinary service description (for example, 'painted our kitchen cabinets' can become 'our kitchen cabinet painting project') and retains customer-supplied company/location details without keyword repetition. This improves clarity for readers; it is not a promise of ranking improvement. It keeps the degree of satisfaction, distinct experience details, criticism, uncertainty and training disclosures. It does not add company/city names purely for SEO, invent behavior or responsiveness, infer advance communication, or pad short reviews with new claims. The prompt includes detailed positive, mixed, negative and short-feedback examples in `backend/review-editor.ts`. Transcription remains literal and unchanged. Prompt instructions guide the model; they do not prove factual preservation. Live output quality remains unverified; the request tests use simulated AI responses and incur no API charges.

Reviews under 25 whitespace-separated words receive a neutral, optional **Add more detail** choice on the check screen. **Next** continues with the short review unchanged; no minimum length is enforced. Adding detail returns to the existing typed/voice editor, and only the customer-supplied words are processed. This is a UI hint, not a platform requirement or review-quality score.

Output is plain text; incomplete, empty, or oversized edits and empty/malformed/oversized transcripts are rejected. The Responses request uses `store:false`; this is not a promise about all provider retention. The original remains available to inspect/restore; retrying the same recording replaces that recording's contribution rather than duplicating it. Recordings can be retried or saved on both the compose and check steps. Customers can edit the result or continue after an AI failure. Nothing is approved until they tap **Next** on the check screen, alongside the statement that the text reflects their own experience.

A local OpenAI key is configured in the ignored `.dev.vars` file with `ENABLE_AI_CLEANUP=true`, and the preview has been restarted. The first live connection check used synthetic test audio and sample text; both API operations were blocked with HTTP 429 (`credit_balance_exhausted` / `insufficient_quota`). API billing credits must be added before live transcription/editing and quality can be verified. Permission sufficiency is not established by a quota failure. No customer data or real review submissions were used in this check. For production, set the key only as a Worker secret and enable the independent Worker cleanup flag after checking rules for the destinations you enable. Never put the key in GitHub Pages, public config, or frontend code. Without the key/flag the portal visibly offers manual checking, typing, and keyboard dictation; it does not pretend that AI ran. Failed editing retains the original words.

Google's [content policy applies to human and AI-generated contributions](https://support.google.com/contributionpolicy/answer/7400113?hl=en), and its [Maps contribution policy](https://support.google.com/contributionpolicy/answer/7400114?hl=en) requires genuine experience and disallows manipulated or promotional contributions. These pages do not establish that a business-provided editor is approved by Google. Google also prohibits merchants from requesting specific review contents or influencing ratings/content. The editor is intended to retain the actual experience and sentiment rather than create promotional text; customer approval alone does not establish platform compliance. Other destinations need their own policy review before using AI-edited text there. This remains a configurable capability, separate from transcription and direct links.

The implementation follows OpenAI's [text generation](https://developers.openai.com/api/docs/guides/text) and [file transcription](https://developers.openai.com/api/docs/guides/speech-to-text) documentation.

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

The 56-check suite passes in Chromium Pixel 7 and WebKit iPhone 13 emulation. It covers static repository paths, permanent query links, job content updates with unchanged links, concurrent immutable assignments, archived/deleted access, authenticated images, cross-origin downloads, scanned-sticker creation, protected previews, draft restoration after external navigation, accurate metrics, QR PDFs, mobile layout and Axe checks. Auth tests require provider-verified confirmed allowlisted identity and reject forged tokens, anonymous users and production mock sign-in.

Production tests serve only `dist/site` with no application server, bridge its requests to the local API using test interception, and verify that mock login cannot be enabled through public configuration. No live Supabase or OpenAI calls are made. Chromium recording uses synthetic audio/mocked processing; Windows WebKit lacks MediaRecorder, so its native typing fallback and the automatic voice flow with a deterministic recording stub are tested. Automated checks cover optional short-review detail collection, recording retries without duplication, empty transcripts, formatting opt-out, and failed editing without losing customer text. Physical iOS/Android app flows, real email delivery, live transcription, and printer readability remain launch checks.

Both local and GitHub-address TEST PDFs are generated. The GitHub-address version is a layout/URL-format sample tied to preview tokens, **not a production sticker batch**. Render it at 300 DPI and run `node scripts/check-qr.mjs .sites-runtime/qa github-qr-render` to check all 100 query-token codes. Actual customer sheets must be generated from the activated production backend.

GitHub checks build both artifacts and run the local/browser suite. The deployment workflow is manual. The previous prototype remains recoverable in Git history and ignored local backup files.

## Platform findings, checked October 2, 2026

Use account-issued links, including per-customer native links when available. Google uses the supplied business link; other test URLs are placeholders. Native mobile app flows still need physical-device checks.

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

Drafts, the current guided step, original wording, approval, photo selections, and confirmations persist in the same browser for up to 30 days. Another device/browser or cleared/private storage can lose the draft. **Clear my draft** removes the editable draft. Admin deletion cannot remotely remove device-local data.

Metrics distinguish visits (once per browser session), link clicks, and device-deduplicated customer-reported completions. None establish publication or unique customers. Direct platform activity is invisible here. Admin previews do not record events. Review text, recordings, IP addresses, and ratings are not saved in the activity table.
