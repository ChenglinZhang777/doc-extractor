# LedgerLens — receipts & invoices → structured data

Upload a receipt or invoice, get verified structured fields, line items, and CSV in seconds. Built with Next.js and Claude vision.

**Live demo:** https://doc-extractor-chenglin-s-projects.vercel.app

## Why this exists

Manual data entry from receipts is slow and error-prone, and regex-based OCR breaks on every new layout. This demo shows the modern approach: a vision model reads the document like a human, and **schema-enforced structured outputs** guarantee the result is always valid JSON — no parsing surprises, no brittle templates.

## How it works

```
receipt/invoice ──▶ Claude vision ──▶ schema-validated JSON ──▶ review UI ──▶ CSV / JSON
 (PNG/JPEG/PDF)      (claude-haiku-4-5)   (structured outputs)     (split view)
```

- **Any layout** — thermal receipts, formal B2B invoices, handwritten tips; no per-vendor templates
- **Honest about unknowns** — unreadable fields come back as `null` (shown as “n/a”), never guessed; ambiguities are flagged in a `notes` field
- **Schema-enforced** — the [JSON schema](lib/schema.ts) is enforced by the API itself via structured outputs
- **Review-first UX** — split view (document left, fields right) modeled on how professional document-AI tools present extractions for human verification

## Quick start

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # https://platform.claude.com
npm run dev                            # open http://localhost:3000
```

Two sample documents are built in (a café thermal receipt and a B2B invoice with discount and zero tax) — click and extract, no upload needed.

## Adapt it to your workflow

- **Different document types** — edit the schema in [lib/schema.ts](lib/schema.ts) (purchase orders, IDs, delivery notes…); the API contract stays the same
- **Pipeline mode** — POST `{data: <base64>, media_type}` to `/api/extract` from any backend; wire the JSON into your bookkeeping tool, spreadsheet, or database
- **Batch processing** — for high volume, the same extraction runs on the Anthropic Batch API at 50% cost

## Cost

A typical receipt costs **~1–2¢** to process with `claude-haiku-4-5` (vision input + structured output). Set a monthly spend cap in the Anthropic console. Per-IP rate limiting (5/min) is built in; files are processed in memory and never stored.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · `@anthropic-ai/sdk` (vision + structured outputs)
