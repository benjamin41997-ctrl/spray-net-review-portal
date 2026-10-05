# Spray-Net South Charlotte review portal

The customer portal and admin interface now build as a static **GitHub Pages** website. Protected APIs run separately. The previous Sites/Vinext login and hosting dependency have been removed. Customer/job information and private photos never go into the Pages artifact or public repository.

## Permanent stickers and personalization

The permanent portal address is:

```text
https://benjamin41997-ctrl.github.io/spray-net-review-portal/
```

Every preprinted sticker contains that same page path plus its own random token:

```text
https://benjamin41997-ctrl.github.io/spray-net-review-portal/?code=RANDOM_TOKEN
```

The static application asks the secure backend which job belongs to that token and displays the matching photos/review options. You can generate 100 stickers, grab any unused one, assign it later, and keep updating the original job. Assignment is permanent; deleted jobs retire their codes. Tokens have 192 bits of randomness. This uses one reusable page and needs no GitHub redirects or rewrite rules.

Each project also has a separate permanent customer link for email/text, displayed directly below **Preview project layout** with **Copy customer link**. It uses its own random token in `customer_links`, does not consume a sticker, and applies the same activation, photo access, archiving, and deletion controls. Existing projects receive this link when an administrator opens them. Layout previews use the backend's actual AI capabilities and administrator-authenticated editing/transcription routes, including for draft projects without stickers. Preview processing uses real API credits when connected; preview visits/clicks are not counted as customer activity.

The printed link points to GitHub Pages even if the backend moves. Update the public configuration and migrate the database/photos while preserving token assignments. Keep the GitHub account, repository name/path, and published page available. Check the Pages deployment in GitHub Actions for the current publishing status. **The online preview is for device testing; live customer stickers require the hosted backend and production token assignments.**

## Online device preview

When backend connection settings are blank, the main Pages URL opens a clearly labeled sample customer flow. Without a backend it explicitly says AI formatting is unavailable, hides the automatic-formatting checkbox, and keeps the customer's words unchanged on Next. It uses only the checked-in Spray-Net network sample images and a fictional display name. Typed drafts, approval, photo selection, JPEG downloads, copy-to-clipboard, and device-local draft recovery work without a server. It does not simulate AI or transcription, collect activity, permit admin access, or open the real Google listing. The copy button demonstrates copying and then explains that Google was not opened. A customer `?code=...` link never silently falls back to a sample project.

The intermediate **AI-connected preview** uses `wrangler.preview.jsonc`: the same protected Worker and D1 schema, Luna with low reasoning, and server-only OpenAI credentials. It does not require R2 photo storage or Supabase admin setup for testing the editor. The Worker-only `PREVIEW_QR_TOKEN` identifies one active project explicitly marked as a demo; `/api/preview` returns only that demo's token and current processing capabilities. It refuses unmarked, missing or archived projects. Preview editing goes through the normal server-side customer endpoint, capped at 25 edits per UTC day for this shared preview and the existing 100/day global limit. Recorded voice retains the 5/day per-token and 100/day global limits. Normal customer projects keep their existing limits. No preview route grants admin access or publishes reviews. The preview uses the stable `public-demo` draft-storage key even after a server token is connected, preserving previously typed drafts.

Set GitHub variables `REVIEW_API_BASE_URL` and `REVIEW_PREVIEW_API_ONLY=true` after deploying and checking that API. The preview-only build requires a backend URL and rejects supplied Supabase authentication settings; full connected mode still requires all auth settings. While admin setup is absent, the main page opens the AI-connected sample. With full admin configuration, `?demo=1` explicitly opens it. The banner reports actual AI/voice capabilities rather than assuming they are disconnected. If an old unformatted draft is already at the check step, use **Check spelling & formatting again** to edit it; approval on that step remains a separate action.

The approved preview API is `https://spray-net-review-api.spray-net-south-charlotte.workers.dev`. On October 3, 2026, one synthetic live editing request and one short synthetic transcription request both returned usable text (approximately 2.4 and 2.2 seconds respectively). These are single measured examples, not an average or latency guarantee. The edited sample retained its late-arrival criticism and training disclosure. The deployed API also passed allowed-origin preflight, rejected a foreign-origin write, and denied unauthenticated admin access. Those two live processing checks used API credits; all automated browser/request tests remain mocked.

Pushing changes to `master` publishes the Pages interface automatically. The manual **Publish review portal to GitHub Pages** action is also available. When no backend URL is set, it can publish the sample preview without credentials. Once `REVIEW_API_BASE_URL` is configured, it requires all public backend/auth settings unless the explicit preview-only variable is enabled. Manually checking **Require the hosted backend and admin configuration** always applies the full requirement. This workflow publishes only the static interface; backend code and model/prompt changes need a separate Worker deployment after backend launch.

## Working local preview

Open http://127.0.0.1:5173/spray-net-review-portal/?admin=1 and choose **Enter local admin preview**. This explicit simulated sign-in only works with the loopback development API. Production never accepts its token or exposes its sign-in endpoint.

The sample kitchen is clearly labeled as Spray-Net network imagery, not a South Charlotte job. The supplied Google review link is connected; transcription and editing availability depend on the ignored local credentials. Do not submit sample feedback to the real listing. Sample data from the earlier prototype has been retained locally.

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

## Connect the hosted backend

1. Create the intended GitHub repository and push the reviewed source. Select **GitHub Actions** as its Pages publishing source. Confirm the permanent URL before live printing.
2. The approved Cloudflare account now has the D1 database configured in `wrangler.jsonc` and `wrangler.preview.jsonc`, initialized with the reviewed schema and a sample-only online preview project. The private Standard R2 bucket `spray-net-review-photos` is now provisioned and bound as `BUCKET` to the live API after the account owner activated R2. `wrangler.local.jsonc` uses only local preview storage. `wrangler.jsonc` matches the existing live Luna/transcription settings; `wrangler.preview.jsonc` retains the same storage binding so later deployments do not remove photo access.
3. Configure Worker secrets: `ADMIN_EMAILS` with the three approved addresses, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and optionally `OPENAI_API_KEY`. Keep `ENVIRONMENT=production` and `ENABLE_AI_CLEANUP=false`. Set `PUBLIC_PORTAL_URL` to the full GitHub URL and `ALLOWED_ORIGINS` to its origin, e.g. `https://benjamin41997-ctrl.github.io`. Do not upload `LOCAL_ADMIN_TOKEN`.
4. The initial schema has already been applied once to the configured cloud database; do not reapply it. Deploy the fully configured Worker when adding admin/photo operation. Local customer records and sticker assignments are not copied to production. Start production sticker batches in that production database. Keep any demo-token secret separate from customer assignments.
5. In Supabase, prepare existing confirmed admin accounts for the three approved emails and allow the exact callback URL `https://benjamin41997-ctrl.github.io/spray-net-review-portal/?admin=1`. The UI uses `shouldCreateUser:false`, so login does not create accounts. Check [passwordless setup](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [email delivery requirements](https://supabase.com/docs/guides/auth/auth-smtp); configure reliable delivery for all approved recipients before launch. Do not change another application's Site URL or email template without reviewing its impact.
6. Set GitHub repository variables `REVIEW_API_BASE_URL`, `REVIEW_SUPABASE_URL`, and `REVIEW_SUPABASE_PUBLISHABLE_KEY`. These values are public. The Pages workflow computes the portal URL/repository base path and requires complete connection settings when a backend URL is supplied or connected mode is requested.
7. Run **Publish review portal to GitHub Pages**, or push the next interface update. Only `dist/site` is uploaded; the Worker, database files, credentials, customer records, and local test sheets are excluded.
8. Test the actual hosted email sign-in, job creation/assignment, photo saving, native platform links, and optional transcription. Print and scan one live sticker at 100% scale on the intended stock before distributing a batch.

`npm run backend:build` is a **dry run** that produces `dist/api` without deploying. No automated backend deployment or paid-service provisioning is included. The static build and Worker bundle are both prepared and checked locally.

## Costs and maintenance

No paid plan or new service has been purchased. GitHub Pages hosting depends on repository visibility and your GitHub plan. Existing public Pages projects can use the current workflow. [GitHub documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) describes availability.

As checked October 2, 2026, [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) includes 100,000 requests/day and a 10 ms CPU limit per invocation; D1 has free allowances. Workers Paid starts at $5/month. Free-plan suitability still needs testing on the deployed workload, especially bulk operations. [R2 Standard](https://developers.cloudflare.com/r2/pricing/) includes 10 GB-month of storage plus operation allowances; excess usage is metered. Confirm billing activation and account settings before provisioning.

[Supabase](https://supabase.com/pricing) has a free plan; reusing the existing project's authentication avoids adding another database project, but its current plan, shared quotas, availability, and email provider still need review. Email delivery and OpenAI usage can add separate costs. No plan change is implied or authorized by this implementation.

## Google handoff

### Administrator review sources

New Project and the project editor use **Include these review sources** toggles instead of customer-source and URL inputs. New projects default to Google only. Angi, Thumbtack and Yelp are optional, using the business destinations in `lib/business.ts`; Yelp uses the verified public listing rather than the owner dashboard and appears as a full-size business-information card on the final share screen, with Copy review and Open Yelp business page controls. Google may be switched off. Each project's choices persist, and existing customer-specific links are preserved while enabled. Previously recorded sources remain in the database; new projects use `direct`. Apple Maps is hidden from administrator choices and customer handoffs, including older records containing an Apple link. The backend's optional `include_google:false` respects an explicit Google opt-out at creation; legacy clients retain the Google default.

New jobs default to the supplied official link: [Spray-Net South Charlotte on Google](https://g.page/r/CdBR4AUNk5DkEAI/review). Administrators can switch it off while editing a job. Business destination URLs are maintained in `lib/business.ts`; no URL entry is required per project. Existing job destinations are preserved; the local demo has been connected explicitly. Angi/Thumbtack source ordering remains unchanged for existing records.

After the customer approves their wording on the check screen, **Paste my review to Google** copies the approved text and opens that exact link in a new tab, leaving the portal available. Angi and Thumbtack use the same single-button copy/open flow through `ReviewHandoff`. The browser tab is reserved during the original tap to avoid asynchronous popup blocking; a blocked tab has an explicit new-tab fallback. Yelp retains its separate Copy review and Open Yelp business page controls and also opens in a new tab. Customers paste, choose their own rating, attach saved photos if desired, and submit on the external platform. No customer text is added to a URL or sent through an import endpoint. Clipboard failure keeps the portal open, selects the draft, and gives manual-copy instructions with a **Continue to Google** button after manual copying.

Opening a destination automatically replaces its action with **Thank you!** and **Something went wrong? Try again**; no extra completion confirmation is requested. Once every destination enabled for that project has been opened, the portal shows the final thank-you screen with retries for each site and photo-saving/draft access. Google/Angi/Thumbtack retries copy the approved review again before opening a new tab. Progress is saved on the device and checked against the project's current destinations on reload. Blocked tabs, failed clipboard operations, and static-demo handoffs do not advance progress. This is customer-flow completion only: analytics record link clicks, never an inferred customer-reported or published review.

[Google requires a Google Account](https://support.google.com/business/answer/3474122?hl=en), including accounts with a non-Gmail email. Google handles its own sign-in; the portal cannot inspect Google cookies or guarantee that a browser and the Maps app share a session. A separate portal Google login would add friction and would not establish a Maps/browser session.

The [documented Business Profile review API](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews) supports reading reviews and managing business replies; it has no method to create/import customer reviews or prefill the public review form. This integration uses the official review link and customer-controlled clipboard handoff.

The real supplied link was opened read-only in the available signed-in browser and displayed the Spray-Net South Charlotte review composer. No rating, text, photos, or review was submitted. The signed-out native flow was not exercised because this browser already has a Google session. Automated mobile tests intercept the external link and cover exact approved copying, denied clipboard and manual-copy recovery, Back/draft recovery, default/override links, and accurate click-only metrics. They do not verify live Google sign-in or publication.

## Customer photo handoff

The Photos step initially has exactly three choices: **Save and share all photos**, **Select photos to include and save**, and **Don't share my photos, I don't want neighbors to be jealous…**. Supplied images are visible without selection checkboxes until the customer chooses the selection option.

**Save and share all photos** requests downloads of every supplied image as a separate JPEG directly from the customer's tap. It uses browser downloads rather than the phone share menu, a ZIP archive, or an automatic upload to Google. Files are fetched and prepared before the tap; the button waits until all photos are ready. **Select photos to include and save** reveals checkboxes and downloads only the chosen images. Both all-photo and selected-photo download requests move directly to **Ready to share**, with the selected count in the Google instructions. There is no intermediate downloaded-photos screen.

The opt-out deselects the photos for review inclusion and shows **Download photos for myself** alongside Next. Personal downloads do not reselect photos for the review. Customers can continue without downloading anything. The opt-out and individual selections survive reload and returning from Google.

Browsers may prompt to allow multiple downloads, save automatically, or block some files. The portal requests the downloads; it cannot force a particular save dialog, confirm that files were saved, or place files in Camera Roll. The final sharing screen has a collapsed **Download didn’t start?** fallback with individual download buttons. Personal downloads retain the same fallback on the opt-out screen. Ordinary-download status says downloads requested, never Saved, Uploaded, or Published. On repeat saves in desktop browsers with a supported explicit save picker, each JPEG is saved in sequence and the portal waits for the file write to finish. Cancel stops the sequence, keeps the Photos screen open, and permits a fresh retry. Write failures retain the retry option. The individual-photo fallback uses the same explicit picker where supported. Only a completed explicit file write is labeled saved. Browsers without that picker retain ordinary downloads; their Save As cancellation remains invisible to the portal. File handles are not retained. Automated tests mock picker acceptance, cancellation, and write failures; actual Windows dialog behavior still requires device testing. Missing files can be retried or excluded without blocking the opt-out.

On Google, customers choose Add photos and attach the downloaded images from Downloads/Files or Recents when available. Physical iPhone/Android verification is still needed for the actual save dialog, folder, and Google file picker. Automated Chromium/WebKit tests verify all-file JPEG download events, exactly three initial choices, chosen-file downloads, private opt-out downloads with empty review selection, individual retry downloads, missing-photo recovery, and selections surviving a mocked Google trip. No real Google uploads are attempted.

## Review editing and daily use

Prepare page, upload/reorder/label photos, add official platform links, preview, assign a sticker, and activate. Draft/unassigned codes show that the page is not ready. Archive disables access and can later be reversed for the same job. Delete removes customer data and permanently retires its codes.

The customer sees **We loved working with you, [name]!** with **Type my review** and **Speak my review** as the first choices. New projects start with a greeting based on the customer name. In **Project details → Customer greeting**, administrators can edit the full public message (up to 160 characters), independently of the private project label. Custom greetings survive saving, archiving, and reactivation and appear on the existing customer link. Leaving the field blank restores **We loved working with you!**. Both paths use the same spelling, grammar, sentence-flow, and formatting editor by default. Typed reviews are prepared on **Next**; voice reviews go from **Done recording** through transcription and optional editing directly to the check screen, without requiring another tap to format. **Automatically format my review** starts checked; unchecking it bypasses AI and the preference persists. The next screen remains editable and Next explicitly approves the wording. Next they edit/approve their words, select/save supplied photos, and choose **Paste my review to Google** or their originating platform. Only one step is displayed at a time. The final screen leads with six numbered Google instructions and the copy/open button. Edit my review is removed; the collapsed See my review and photo-download shortcut sit at the bottom. Customers can use Back to revisit the earlier check step. Photo instructions use the current selected-image count, including after returning to change a selection. Download requests do not establish that files were saved. Opt-outs receive instructions for posting without pictures. Clipboard failure opens that disclosure and selects the text. Direct/training customers start with Google; Angi/Thumbtack jobs prioritize their native link. Publication and ratings occur on the external platform.

Transcription defaults to `gpt-transcribe`. Local testing uses `gpt-6-luna`; production configuration and the backend fallback retain `gpt-6.1-sol`. Both editors send `reasoning: { effort: "low" }` in the server-side Responses request and use the same editing prompt. Worker-only `TRANSCRIPTION_MODEL` and `REVIEW_EDITOR_MODEL` variables allow a supported alternative without changing the public site. Legacy non-reasoning model overrides omit the reasoning parameter. Cleanup remains independently disabled until an API key and `ENABLE_AI_CLEANUP=true` are configured. Both typed and voice input respect the customer's persistent **Automatically format my review** opt-out.

To change the editor model, edit `REVIEW_EDITOR_MODEL` in `wrangler.local.jsonc` for local use and `wrangler.jsonc` for production. A value in the ignored `.dev.vars` file overrides local configuration. Restart the local backend after changing configuration; production changes require a backend deployment. The API key grants access and billing, but does not choose the model. Edit `reviewEditingInstructions` in `backend/review-editor.ts` to change the prompt. The backend sends those instructions with every customer text/transcript through the Responses API's `instructions` field; no prompt setup in the OpenAI dashboard or Codex model selection is needed. The existing 4,000 output-token cap includes reasoning and visible review text; incomplete outputs are rejected and the original retained. Sol supports low reasoning according to the [official model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

For late-stage Sol testing, change `REVIEW_EDITOR_MODEL` to `gpt-6.1-sol` in both `.dev.vars` (if present) and `wrangler.local.jsonc`. The ignored local configuration currently explicitly selects Luna so live connection checks also use the cheaper editor. Automated request/voice/preparation tests mock the OpenAI responses and do not consume API credits. Manual transcription and AI formatting in the portal do consume API credits. No model comparison or paid live API request was needed to change this setting. Luna's low reasoning setting is supported by the [official model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna).

During transcription or editing, customers see a dedicated **Preparing your review…** screen with an animated indeterminate bar and the actual processing stage. After 25 seconds it says **Still working. This is taking a little longer.** The timer is reassurance only: it never reports a completion percentage or finishes the request. The check screen appears as soon as the real request completes; failure restores the editor with the original draft and retry/fallback controls. Microphone permission has a separate setup message. Stage updates use a polite screen-reader announcement, and reduced-motion settings stop the animations.

The editor allows substantial stylistic rewriting: a clearer opening, coherent sentence order, unpacked shorthand, connected fragments, expressive equivalent word choices, and short paragraphs. SEO-aware phrasing and natural service terminology are explicitly permitted when supported by the meaning of the customer's experience; the service phrase need not appear verbatim in the input. For example, 'painted our kitchen cabinets' can become 'our kitchen cabinet painting project', and 'painted brick outside our house' can become 'exterior brick painting'. The editor can characterize customer-described behavior accurately: quick answers to questions may become 'responsive when we had questions', but one reply must not become responsiveness throughout the project. Trusted portal context identifies **Spray-Net South Charlotte** as the provider, and the editor should naturally include the full business name at least once in an ordinary project review, even when omitted or shortened in the input. It does not treat the business name as a customer location or overwrite feedback explicitly about another provider. **Ben and his crew** may be used when the customer describes both Ben and the crew working on the project; the portal has no verified per-job crew field, so generic crew feedback does not establish Ben's involvement. A mention of Ben alone does not establish a crew, and a phone conversation does not establish onsite work. Other locations and experience details remain customer-supplied. This improves clarity for readers; it is not a promise of ranking improvement. It keeps the overall enthusiasm, distinct experience details, criticism, uncertainty and training disclosures. It does not manufacture methods, coatings, new behavior, advance communication, or length by adding claims. The prompt includes service-specific, named-crew, positive, mixed, negative and short-feedback examples in `backend/review-editor.ts`. Transcription remains literal and unchanged. Prompt instructions guide the model; they do not prove factual preservation. Live output quality remains unverified; the request tests use simulated AI responses and incur no API charges.

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
| Apple Maps | Currently hidden from admin choices and customer handoffs. Existing stored links are retained for compatibility. |
| Yelp | Optional full-size **Yelp** card on the final share screen, with **Copy review** and **Open Yelp business page** controls. Opens the public listing; no review form is prefilled or submitted. [Yelp guidance](https://www.yelp-support.com/article/Don-t-Ask-for-Reviews) discourages review solicitation. Inclusion alone does not establish compliance. |

No automatic imports, form prefill, photo transfers, verification claims, sentiment gating, or publication confirmation are implemented. Customers provide their own honest training-job context; the editor must preserve it.

## Privacy and activity

Links use 192-bit random tokens. Anyone holding an active link can see that job/photos: treat the card as a private bearer link. Internal names and object keys are withheld. Noindex/no-referrer complement token secrecy but do not prevent access through a shared link.

Admin uploads are resized/re-encoded as JPEG to remove source metadata and stored in private R2. `tests/metadata.spec.ts` uploads a synthetic JPEG containing camera, author, date and GPS EXIF through the administrator UI in Chromium and WebKit, confirms EXIF/XMP/IPTC are absent from the stored output, confirms the customer download has identical bytes, and checks unauthenticated admin access and archive revocation. This does not claim removal of all technical metadata or information visible within the photo. JPEG/PNG/WebP supported; HEIC may require JPEG export. Every photo request checks access. Public pages never receive bucket URLs. Archive revokes access. Delete removes job/photos/activity and retires assigned codes. Storage deletion failures are reported for follow-up; provider backups and device copies have separate retention.

Drafts, the current guided step, original wording, approval, photo selections, and download-request history persist in the same browser for up to 30 days. Another device/browser or cleared/private storage can lose the draft. **Clear my draft** removes the editable draft. Admin deletion cannot remotely remove device-local data.

Metrics distinguish visits (once per browser session), link clicks, and historical device-deduplicated customer-reported completions. The current customer interface advances automatically after opening review links and does not collect completion confirmations or emit reported-completion events. The thank-you screen is not evidence of publication. None of these metrics establish publication or unique customers. Direct platform activity is invisible here. Admin previews do not record events. Review text, recordings, IP addresses, and ratings are not saved in the activity table.
