# Design — Add a book by photographing its cover (vision metadata extraction)

Status: Proposed · Scope: new catalog feature · Author: design draft for review

## Problem

Chinese book-metadata providers (番薯 et al.) are not freely available, and Open
Library / Google Books have poor coverage for CJK ISBNs. When an admin cannot
look up a book by ISBN, they currently fall back to typing the title/author by
hand. We want a faster path: **the admin photographs the book cover, and we
extract the title and author automatically** so the Add Book form is pre-filled.

## Key decision: vision-LLM, not classic OCR

I evaluated two approaches:

1. **Client-side OCR (Tesseract.js, `chi_sim`)** — runs in the browser, free, no
   server cost. BUT: Tesseract is built for clean printed body text and performs
   **poorly on book covers specifically** (stylized/decorative fonts, vertical
   text, art backgrounds, mixed title/subtitle/author layout). Multiple upstream
   reports confirm garbled/missing cover text for Chinese. It also only produces
   a flat text blob — we'd still have to guess which line is the title vs author.

2. **Server-side vision-language model (Cloudflare Workers AI)** — e.g.
   `@cf/meta/llama-3.2-11b-vision-instruct`. We send the cover image + a prompt
   ("read this book cover; return the title and author as JSON") and the model
   **reads the text AND reasons about layout**, returning structured fields
   directly. Far better for Chinese covers, and no "parse the OCR blob" step.

**Chosen: approach 2 (Workers AI vision model).** It fits our existing Cloudflare
stack (add an `AI` binding), handles CJK, and returns structured output. We keep
Tesseract.js explicitly out of scope.

> Cost note: Llama 3.2 11B Vision is ~$0.0485 / M input tokens and ~$0.676 / M
> output tokens. A single cover extraction is well under a cent. Admin-only +
> rate-limited, so volume is tiny.

## User flow

1. Admin opens **Add Book**, taps **"Scan cover" (拍封面识别)** (next to the
   existing "Scan ISBN").
2. Camera opens (reuse the `IsbnScanner` capture UX; here we grab a single still
   frame instead of continuously decoding barcodes).
3. On capture, the still image is sent to `book.extractFromCover`.
4. The server calls the vision model, which returns `{ title, author, confidence }`.
5. The form's Title/Author fields are **pre-filled and remain editable** — the
   admin always confirms before saving. The captured image is also offered as the
   **cover image** (stored to R2 like today), since we already have it.
6. Admin edits if needed, sets quantity, and submits via the existing `book.add`.

This is a *pre-fill assist*, never an auto-save. The human stays in the loop,
which is the right posture given OCR/vision is imperfect.

## Architecture (fits existing bounded contexts)

Catalog Management context. No schema changes — this only produces inputs to the
existing `book.add`.

```
apps/app/components/books/CoverScanner.tsx   (new) camera → single still → onCapture(blob)
apps/app/routes/_app/books/add.tsx           (edit) "Scan cover" button + prefill
apps/api/routers/book.ts                     (edit) + extractFromCover procedure (adminProcedure)
apps/api/services/coverExtraction.ts         (new) vision-model call + JSON parse + validation
apps/api/lib/env.ts                           (edit) + AI binding
wrangler.jsonc / wrangler.preview.jsonc       (edit) + "ai": { "binding": "AI" }
```

### Server: `extractFromCover` (tRPC, adminProcedure)

Input: the image bytes (base64 or multipart). Because tRPC transports JSON, send
base64; cap size (e.g. ≤ 4 MB after client downscale). Output:
`{ title: string | null, author: string | null, confidence: 'high'|'low' }`.

```ts
// apps/api/services/coverExtraction.ts
const SYSTEM = `You read book covers. The image is a book cover that may be in
Chinese or English. Return ONLY compact JSON: {"title": string, "author": string}.
- title: the book's main title exactly as printed (omit series/subtitle noise).
- author: the author/译者 name(s); empty string if not visible.
Do not translate. Do not invent text that is not on the cover.`

export async function extractCoverMetadata(ai: Ai, imageBytes: Uint8Array) {
  const res = await ai.run('@cf/meta/llama-3.2-11b-vision-instruct', {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: 'Extract the title and author from this cover.' },
    ],
    image: [...imageBytes],          // model expects an array of byte values
    max_tokens: 128,
    temperature: 0,                   // deterministic extraction
  })
  // res.response is text; parse the JSON object out of it defensively.
  const parsed = safeParseTitleAuthor(res.response)
  return {
    title: parsed.title || null,
    author: parsed.author || null,
    confidence: parsed.title ? 'high' : 'low',
  } as const
}
```

Notes:
- **One-time license agreement**: Llama 3.2 Vision requires sending
  `{ prompt: "agree" }` once per account before first use. We do this manually
  during setup (documented in AGENTS.md), not in request path.
- **Defensive JSON parse**: the model may wrap JSON in prose/```json fences;
  `safeParseTitleAuthor` extracts the first `{...}` and validates with Zod,
  returning empty fields on failure (never throws into the request).
- **Tenant/role**: `adminProcedure` (only librarians add books); no libraryId
  needed for the extraction itself, but keep it admin-gated to limit AI spend.

### Client: `CoverScanner`

Reuse `IsbnScanner`'s camera setup (`getUserMedia({ facingMode: 'environment' })`,
the iOS-safe playsInline video, permission/error handling). Difference: instead of
a decode loop, show a **"Capture" button** that draws the current video frame to a
canvas, downscales to ~1024px on the long edge (keeps upload small + within model
limits), exports a JPEG blob, and calls `onCapture(blob)`. Then stop the stream.

In `add.tsx`:
- Add a "Scan cover" toggle beside "Scan ISBN".
- On capture → set a `coverExtracting` spinner → call
  `trpcClient.book.extractFromCover.query({ imageBase64 })`.
- Pre-fill `title`/`author` from the result (only overwrite empty fields, or
  always prefill but keep editable — TBD, see Open questions).
- Keep the captured image as `meta.coverImageUrl` candidate: upload path can reuse
  R2 by passing a data URL / a dedicated upload; simplest is to also store it on
  `book.add` via a new "cover from upload" path. (Phase 2 — see below.)

## Phasing (keep scope tight)

**Phase 1 (this feature):** camera capture → vision extraction → prefill
title/author → admin confirms → `book.add`. Cover image handling stays as-is
(ISBN-based external cover or none). Ship the smallest useful slice.

**Phase 2 (follow-up):** persist the *captured* photo as the book's cover in R2
(so photographed-only books get a cover). Needs a small upload path
(`storeCoverFromBytes`) since today `storeCoverImage` fetches a URL.

**Phase 3 (optional):** also OCR the ISBN/barcode region to auto-trigger the
existing `lookupIsbn` (best of both: try providers first, fall back to vision).

## Testing (TDD, matches our pyramid)

- **Unit** (`coverExtraction.test.ts`): mock `ai.run`; assert we parse clean JSON,
  JSON-in-fences, and garbage (→ null fields, `confidence:'low'`); assert we never
  throw. Mock pattern mirrors `googleBooks.test.ts` / `openLibrary.test.ts`.
- **Component** (`CoverScanner.test.tsx`): camera-unavailable path shows the manual
  fallback message; "Capture" calls `onCapture`. (Mock `getUserMedia`/canvas like
  the existing scanner tests.)
- **Router**: `extractFromCover` rejects non-admin (reuse adminProcedure tests).
- **E2E**: hard to exercise a real camera + real model in CI deterministically;
  gate behind a stubbed AI response (inject a fake `AI` binding in the E2E worker)
  OR keep E2E to the UI wiring (button opens scanner, manual entry still works).
  Prefer: unit/component cover the logic; E2E asserts the form still works manually.

## Security / cost / privacy

- **Admin-only** + consider a simple per-user rate limit (e.g. N extractions/min)
  to cap Workers AI spend and abuse.
- **Image size cap** (downscale client-side to ~1024px, reject > 4 MB server-side).
- **No PII concerns** beyond the cover image itself; we don't persist the raw
  image in Phase 1 (only the derived title/author, which the admin confirms).
- **Data usage**: Workers AI inputs are not used to train models (per Cloudflare
  data-usage policy) — worth confirming/linking in the ADR.
- **Fail open to manual entry**: any extraction failure (model error, low
  confidence, empty result) must leave the admin on the normal manual form with a
  friendly message — never block adding a book.

## Open questions (need your call)

1. **Prefill behavior**: overwrite existing Title/Author fields, or only fill
   empties? (I lean: fill empties, and show the extracted values as a suggestion
   chip the admin taps to accept.)
2. **Store the photo as cover in Phase 1 or defer to Phase 2?** (I lean defer.)
3. **Which model**: `llama-3.2-11b-vision-instruct` (good, cheap) vs a newer
   multimodal (Llama 4 Scout / Moondream 3) — want me to benchmark 2–3 on a
   handful of real Chinese covers before committing?
4. **Rate limiting**: add now (Workers Rate Limiting binding) or rely on
   admin-only for v1?
```
