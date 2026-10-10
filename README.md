# self-learning

Turn a PDF into an overview, topic-based lessons, related YouTube videos and five-question quizzes. Built with Next.js App Router, TypeScript, React, the official Gemini SDK, Zod and KaTeX.

English is the default. The language selector is available on every screen and remembers English / Tiếng Việt in the browser. Generated content follows the selected language even when the PDF uses another language.

## Run locally

Requires Node.js 24 and npm.

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Fill in `.env.local` with your own credentials:

```dotenv
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-3.5-flash-lite
YOUTUBE_API_KEY=your_youtube_key
```

- Create a Gemini key in [Google AI Studio](https://aistudio.google.com/apikey). The configured model must be available to your project and support PDF input and structured output. The default preserves the model tested by this project. The app does not enable billing, select fallback models or automatically retry failed requests.
- In [Google Cloud Console](https://console.cloud.google.com/), select a project, enable **YouTube Data API v3**, then create an API key under **APIs & Services → Credentials**. Restrict the key to YouTube Data API v3. Backend requests need compatible application restrictions; browser referrer restrictions are unsuitable. Public video search does not require OAuth. See [Google's setup guide](https://developers.google.com/youtube/registering_an_application).
- Both keys are backend-only. Never use `NEXT_PUBLIC_` for credentials. Restart the server after changing environment variables. `.env.local`, PDFs and diagnostic outputs are ignored by Git.

```powershell
npm run dev
```

Open [localhost:3000](http://localhost:3000). For a local production build:

```powershell
npm run build
npm start
```

## Features and usage

1. Select an unencrypted, valid PDF up to 3 MiB (3,145,728 bytes; approximately 3.15 MB). Analyze it to view the title, subject, summary and topics with physical PDF page references.
2. Open a topic to generate a lesson using the original PDF and selected topic. Lessons include objectives, explanations, formulas and symbols/units, worked examples, misconceptions and five multiple-choice questions. Added examples are explicitly labeled.
3. Answer all questions and submit. Scoring runs in code: each correct answer earns two points. Correct answers and explanations appear after submission. Retaking clears only that topic's answers and result.
4. Related videos load independently. Each card links to the original YouTube video and displays its original title, channel, thumbnail and reported language, when available. There is no embedded player.
5. Change language at any point. Existing overviews and lessons are translated, preserving topic IDs, question IDs, option positions and correct answers. Your choices and score remain attached to the topic. Only the overview and currently opened lesson are requested; unopened lessons are created on demand.
6. Return to a cached topic or language without additional API calls. Choose another PDF to clear all document content, videos and quiz state. Reloading also clears document state; only the language preference persists.

## Data flow and code map

| File | Responsibility |
| --- | --- |
| `app/page.tsx` | PDF selection, screen navigation, requests, language-specific content lookup and frontend Zod validation |
| `app/components/language-provider.tsx` | Language context, selector, browser preference and document `lang` |
| `lib/i18n.ts` | English/Vietnamese UI dictionary and error-code translations |
| `lib/language.ts` | Allowed language values and backend FormData validation |
| `lib/document-session.ts` | In-memory document cache, canonical content, language variants, request deduplication, cancellation and shared quiz state |
| `app/components/document-overview.tsx` | Document summary and topic selection |
| `app/components/lesson-view.tsx` | Topic navigation, lesson content, quiz controls and results |
| `app/components/math-text.tsx`, `lib/math-format.ts` | Safe text-based rendering of LaTeX with KaTeX |
| `app/components/topic-videos.tsx` | Independent video loading, errors, language labels and YouTube links |
| `app/globals.css`, `app/layout.tsx` | Responsive layout, metadata and shared providers/styles |
| `app/api/*/route.ts` | Server route entry points |
| `lib/pdf-upload.ts` | Bounded multipart parsing and PDF validation |
| `lib/analyze-handler.ts`, `lib/lesson-handler.ts` | Input/context validation and validated Gemini responses |
| `lib/translate-handler.ts` | Translation input validation and protected-field comparison |
| `lib/gemini.ts`, `lib/gemini-config.ts` | Server-only SDK calls, language-aware prompts, structured output, shared model/timeout settings |
| `lib/analysis-schema.ts`, `lib/lesson-schema.ts` | Runtime schemas, page checks and deterministic quiz scoring |
| `lib/video-handler.ts`, `lib/youtube.ts`, `lib/video-schema.ts` | Validated video requests, real YouTube metadata and query construction |
| `lib/analysis-errors.ts`, `lib/video-errors.ts` | Safe upstream error mapping; credentials never sent to the browser |

**Overview:** original browser `File` → FormData `{file, language}` → `/api/analyze` → PDF validation → Gemini → Zod → language cache → overview.

**Lesson:** original PDF + `{topic, language}` → `/api/lesson` → validated topic/page context → Gemini → Zod → topic/language cache. Quiz answers live in a separate topic-ID map shared by all language variants.

**Translation:** original PDF + `{kind, source, language}` → `/api/translate` → source schema/page validation → Gemini translates existing content → target Zod validation and structural comparison → target-language cache. The comparison rejects changed IDs, array sizes/order of protected values, source pages, answers, example origin, formula fields, symbol fields, delimited math and numeric values within each text field. It cannot mechanically prove semantic equivalence of every prose sentence or option; review AI explanations against the PDF. The source document remains the context for translation.

**Video:** `{topicId, name, subject, concepts, language}` → `/api/videos` → YouTube `search.list` with `relevanceLanguage=en|vi`, relevance ordering and up to six candidates → `videos.list` for reported language → prefer matching reported language among relevant candidates → at most three cards. Titles are never translated. YouTube's language preference permits other languages, and metadata can be absent or inaccurate. See [search.list](https://developers.google.com/youtube/v3/docs/search/list) and [video snippet metadata](https://developers.google.com/youtube/v3/docs/videos#snippet).

Requests are deduplicated by document, content kind, topic ID and language. Concurrent language requests share one initial generation per topic, then translate that same content. Late responses populate only their own cache entry. Replacing the PDF aborts requests and invalidates late results, including responses with the same topic ID. Cached errors require an explicit retry. YouTube failures do not block lessons or quizzes. No sample data is substituted for errors.

`lib/lesson-session.ts` and `lib/video-session.ts` retain legacy session helpers covered by regression tests; the current UI uses `DocumentSession`. `lib/demo-data.ts` is an unused historical fixture, not imported by the active UI or APIs.

## Checks and manual verification

```powershell
npm run typecheck
npm test
npm run build
npm run check:secrets
```

Tests use controlled fixtures and do not call Google. The secret audit checks staged files and browser build assets for configured keys and private-file paths. See [MVP-QA.md](MVP-QA.md) for the exact scope of live verification.

Manual checklist:

- With no stored preference, run upload → overview → lesson → videos → quiz entirely in English.
- Select Tiếng Việt before uploading. Confirm generated content is Vietnamese even for an English PDF.
- Change language from the overview, during a lesson and after quiz submission. Compare question IDs/option positions, checked choices, correct answers and score. Return to cached languages/topics and confirm no extra POST requests in DevTools Network or backend logs.
- Switch languages/topics rapidly while a request loads. Confirm the visible content always belongs to the current selection. Replace the PDF during loading and verify that old content never appears.
- Test invalid, empty, oversized and broken PDFs. Test missing API configuration in a separate server process; never publish credentials. Errors should be localized and explicit retry should work. Video errors must leave the lesson and quiz usable.
- At a 375 px mobile width, inspect the language selector, horizontally scrolling topic list, formula/table scrolling, radio controls and result panel. Check keyboard navigation and accessible control labels.

Live bilingual diagnostic (calls configured Google services and consumes quota):

```powershell
node --experimental-strip-types --conditions=react-server scripts/verify-languages.mjs path/to/private.pdf [base-URL]
```

It checks English generation, Vietnamese translation with preserved protected fields, and video requests in both languages. Outputs go to ignored `tmp/diagnostics/`. Historical troubleshooting is recorded in [GEMINI-DIAGNOSIS.md](GEMINI-DIAGNOSIS.md).

## MVP limits

- No authentication, database, server cache, persistent learning progress or cross-device synchronization. Only the language preference is in localStorage; PDF/content/answers stay in browser memory for the current page session.
- PDF limit: 3 MiB. Multipart body limit: 3 MiB + 256 KiB (3,407,872 bytes), below Vercel’s 4.5 MB payload cap. Translation source limit: 192 KiB. Video JSON limit: 8 KiB. Oversized generated content may need a shorter source document.
- Gemini SDK timeout: 90 seconds; browser timeout: 110 seconds. YouTube backend timeout: 15 seconds across search/metadata requests; browser timeout: 35 seconds. Retries are user-triggered and bounded to one attempt per action.
- AI may omit topics, misinterpret diagrams or produce incorrect explanations and translations. Schema/invariant checks validate structure and protected values, not all scientific claims. Original source pages should be reviewed.
- Video language labels use reported audio language, falling back to reported default snippet language. Unknown language is labeled explicitly. Search does not guarantee spoken language, relevance, availability or playback.
- Quiz answers are part of frontend data, suitable for self-study rather than secure examinations.
- PDFs are sent to Gemini. Only topic metadata is sent to YouTube. The app does not persist uploads; external providers have their own data policies.
- A public deployment still needs rate limiting, abuse controls and appropriate credential restrictions. Request-duration/upload limits are configured for Vercel as documented below. This change does not deploy the site.

## Deploy to Vercel

The repository is [NRCEM/self-learning](https://github.com/NRCEM/self-learning); production branch: `main`.

### Hosting configuration

Vercel Functions cap both request and response payloads at **4.5 MB**. PDFs go through the function as multipart FormData; the same original PDF is sent again for lessons and translations. The app therefore uses a shared frontend/backend **3 MiB PDF limit**, with **256 KiB** reserved for translation JSON and multipart framing. Maximum accepted multipart body is **3,407,872 bytes**. This applies locally too, so local behavior matches hosting. Increasing a Next.js body-size setting cannot increase Vercel's function payload cap. Larger PDFs require a different upload/storage architecture, which is outside this deployment preparation. See [Vercel Function limits](https://vercel.com/docs/functions/limitations).

All API routes use the **Node.js runtime**. `package.json` pins `engines.node` to `24.x`, a [supported Vercel Node.js version](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). No custom server, filesystem persistence, database or Blob storage is required. Credentials are read inside server-only modules at request time; Google requests use the official Gemini SDK and backend `fetch`.

| Route | Vercel maximum duration | Upstream timeout | Browser timeout |
| --- | --- | --- | --- |
| `/api/analyze` | 120 seconds | Gemini: 90 seconds, one attempt | 110 seconds |
| `/api/lesson` | 120 seconds | Gemini: 90 seconds, one attempt | 110 seconds |
| `/api/translate` | 120 seconds | Gemini: 90 seconds, one attempt | 110 seconds |
| `/api/videos` | 30 seconds | YouTube: 15 seconds across search and metadata | 35 seconds |

Each route declares a literal `maxDuration`; `vercel.json` enables Fluid Compute explicitly with `fluid: true`. These durations include headroom for PDF parsing and response validation and are not promised response times. **Keep Fluid Compute enabled** in the project settings. Hobby with Fluid Compute supports a 300-second maximum; legacy Hobby without it has a 60-second maximum and cannot honor these 120-second Gemini routes. See [duration configuration](https://vercel.com/docs/functions/configuring-functions/duration) and [limits](https://vercel.com/docs/functions/limitations). This setup does not require a Pro upgrade or changing the working Gemini model.

A platform-generated HTTP 413/504/5xx can arrive without the app's JSON error envelope. The frontend maps those statuses to localized upload-limit, timeout or server-unavailable messages with retry controls. Provider JSON errors still retain their specific error codes. The production smoke-test overview and lesson responses are below the platform response cap; oversized requests are rejected without a sample fallback.

### Import and configure

1. Open [Vercel New Project](https://vercel.com/new), connect GitHub and import **NRCEM/self-learning**. If the repository is private or missing, grant the Vercel GitHub integration access to that repository.
2. Select the **Next.js** framework preset and repository root (`./`). Use **Node.js 24.x**, install command `npm ci`, build command `npm run build`, and the framework's default output directory. Do not configure a static export, custom output directory or `npm run dev` as the build command.
3. Add these exact environment variables before deploying. Select **Production** and also **Preview** if preview deployments will be tested:

   | Variable | Value | Required |
   | --- | --- | --- |
   | `GEMINI_API_KEY` | Your existing working Google AI Studio API key | Yes, for analysis/lessons/translations |
   | `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Optional in code, recommended explicitly; this is the model successfully tested locally |
   | `YOUTUBE_API_KEY` | Your existing key with YouTube Data API v3 enabled | Yes, for videos; lessons/quizzes work without it |

   These are the only application environment variables. Never prefix keys with `NEXT_PUBLIC_`, commit `.env.local`, or upload private PDFs to GitHub. The project does not enable Google billing or use Vercel AI Gateway. Server API keys need restrictions compatible with requests from Vercel; local-machine IP restrictions or browser referrer restrictions can reject server requests. Standard Vercel functions do not provide this project's local IP address.

4. Click **Deploy**. In project **Settings → Functions**, verify Fluid Compute is enabled and the deployed routes have the above durations. If settings changed after deployment, redeploy from the current `main` commit. New projects normally enable Fluid Compute by default; confirm it rather than assuming it for older projects.
5. Open the deployment URL. Subsequent pushes to the connected production branch trigger deployments. Environment variable changes apply to new deployments, so redeploy after changing them. See [Vercel deployment documentation](https://vercel.com/docs/deployments).

### Verify the deployed application

- Use a real PDF under 3 MiB. Run upload → overview → topic → lesson → videos → quiz. Test English and Vietnamese, translation after submission, cached return and document replacement.
- Reject a PDF above 3 MiB in the browser. For request limits, use a controlled API request and confirm HTTP 413; this avoids spending Gemini quota on invalid uploads.
- Check **Logs** for the relevant route if something fails. `FUNCTION_PAYLOAD_TOO_LARGE` indicates a platform body limit; `FUNCTION_INVOCATION_TIMEOUT` indicates a function duration/configuration problem. Gemini/YouTube codes in the app indicate a provider/configuration failure. Do not paste credentials or private PDF contents into shared logs.
- Keep a Vercel Preview deployment protected while checking keys and provider access. No database is needed; document cache is browser memory and works across stateless function invocations.

For a local production-runtime smoke test, first build and start on a separate port:

```powershell
npm run build
npm start -- --port 3001
# In another terminal:
node --experimental-strip-types --conditions=react-server scripts/verify-languages.mjs path/to/private.pdf http://localhost:3001
```

The same diagnostic accepts a public deployment URL after deployment. Protected previews may require browser verification or Vercel access credentials; the script does not bypass deployment protection.

Deployment preparation validates code, Node.js production routes and provider calls locally. An actual Vercel deployment, its account settings, key restrictions and cloud-specific behavior remain unverified until the imported project is deployed and the smoke checklist is completed.
