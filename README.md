# LedgerLens — receipts & invoices → structured data

Upload a receipt or invoice, get verified structured fields, line items, and CSV in seconds. Built with Next.js and AI vision.

**Live example:** https://doc-extractor-chenglin-s-projects.vercel.app

## Why this exists

Manual data entry from receipts is slow and error-prone, and regex-based OCR breaks on every new layout. This is the modern approach: a vision model reads the document like a human, and **schema-enforced output** guarantees the result is always valid JSON — no parsing surprises, no brittle templates.

## How it works

```
receipt/invoice ──▶ AI vision ──▶ schema-validated JSON ──▶ review UI ──▶ CSV / JSON
 (PNG/JPEG/PDF)     (typed API)   (structured output)      (split view)
```

- **Any layout** — thermal receipts, formal B2B invoices, handwritten tips; no per-vendor templates
- **Honest about unknowns** — unreadable fields come back as `null` (shown as “n/a”), never guessed; ambiguities are flagged in a `notes` field
- **Schema-enforced** — the [JSON schema](lib/schema.ts) is enforced by the API itself, so the response shape is guaranteed
- **Review-first UX** — split view (document left, fields right) modeled on how professional document-AI tools present extractions for human verification

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in your LLM endpoint, key, and model
npm run dev                    # open http://localhost:3000
```

Two sample documents are built in (a café thermal receipt and a B2B invoice with discount and zero tax) — click and extract, no upload needed.

## Adapt it to your workflow

- **Different document types** — edit the schema in [lib/schema.ts](lib/schema.ts) (purchase orders, IDs, delivery notes…); the API contract stays the same
- **Pipeline mode** — POST `{data: <base64>, media_type}` to `/api/extract` from any backend; wire the JSON into your bookkeeping tool, spreadsheet, or database
- **Batch processing** — for high volume, run the same extraction as a batch job to cut per-document cost

## Cost

A typical receipt costs **~1–2¢** to process (vision input + structured output). Per-IP rate limiting (5/min) is built in; files are processed in memory and never stored. Set a monthly spend cap with your provider.

## Configuration

The model is reached through the [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) client, so any Anthropic-API-compatible endpoint works. Set three environment variables:

| Variable | Purpose |
|----------|---------|
| `LLM_BASE_URL` | API endpoint |
| `LLM_API_KEY`  | API key |
| `LLM_MODEL`    | Vision-capable model id |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · `@anthropic-ai/sdk` (vision + structured output)
