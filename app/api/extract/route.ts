import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { extractionSchema } from "@/lib/schema";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const MAX_BASE64_CHARS = 7_000_000; // ~5MB 文件

const SYSTEM_PROMPT = `You extract structured data from receipts and invoices.

Rules:
- Read only what is visibly on the document. If a field is not present or not readable, use null — never guess or invent values.
- Amounts are plain numbers without currency symbols. Discounts are positive numbers.
- Dates in ISO 8601 (YYYY-MM-DD) when the document makes the date unambiguous; otherwise copy the printed form.
- Put anything ambiguous or worth flagging in "notes".`;

// 视觉调用成本更高，限流比聊天更紧
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute." },
      { status: 429 },
    );
  }

  let body: { data?: unknown; media_type?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { data, media_type } = body;
  const isPdf = media_type === "application/pdf";
  const isImage = IMAGE_TYPES.includes(media_type as (typeof IMAGE_TYPES)[number]);
  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PNG, JPEG, WebP, GIF, or PDF." },
      { status: 400 },
    );
  }
  if (typeof data !== "string" || !data || data.length > MAX_BASE64_CHARS) {
    return NextResponse.json(
      { error: "File is missing or larger than 5 MB." },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is not configured: ANTHROPIC_API_KEY is missing." },
      { status: 500 },
    );
  }

  const fileBlock = isPdf
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data,
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: media_type as (typeof IMAGE_TYPES)[number],
          data,
        },
      };

  const client = new Anthropic();
  const started = Date.now();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: extractionSchema },
      },
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            { type: "text", text: "Extract the structured data from this document." },
          ],
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model could not process this document." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      extraction: JSON.parse(text.text),
      meta: {
        model: MODEL,
        elapsed_ms: Date.now() - started,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Server API key is invalid." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "The service is busy right now. Try again shortly." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "Upstream model error. Try again shortly." },
        { status: 502 },
      );
    }
    throw error;
  }
}
