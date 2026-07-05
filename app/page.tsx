"use client";

import { useCallback, useState } from "react";
import type { Extraction } from "@/lib/schema";

interface Meta {
  model: string;
  elapsed_ms: number;
  input_tokens: number;
  output_tokens: number;
}

interface LoadedFile {
  name: string;
  mediaType: string;
  base64: string;
  previewUrl: string;
}

const SAMPLES = [
  { name: "Café receipt", path: "/samples/cafe-receipt.svg" },
  { name: "B2B invoice", path: "/samples/hardware-invoice.svg" },
];

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

// 浏览器端把 SVG 示例栅格化为 PNG（API 只收位图/PDF）
async function rasterizeSvg(url: string): Promise<{ base64: string; previewUrl: string }> {
  const svgText = await (await fetch(url)).text();
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const objectUrl = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("SVG load failed"));
    img.src = objectUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth * 2;
  canvas.height = img.naturalHeight * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(objectUrl);
  return {
    base64: canvas.toDataURL("image/png").split(",")[1],
    previewUrl: url,
  };
}

function money(v: number | null, currency: string | null): string {
  if (v === null) return "n/a";
  const prefix = currency === "USD" ? "$" : currency ? `${currency} ` : "";
  return `${prefix}${v.toFixed(2)}`;
}

function toCsv(x: Extraction): string {
  const esc = (s: unknown) => `"${String(s ?? "").replaceAll('"', '""')}"`;
  const lines = [
    "field,value",
    ...(
      [
        ["vendor", x.vendor],
        ["document_number", x.document_number],
        ["date", x.date],
        ["currency", x.currency],
        ["subtotal", x.subtotal],
        ["discount", x.discount],
        ["tax", x.tax],
        ["tip", x.tip],
        ["total", x.total],
        ["payment_method", x.payment_method],
      ] as const
    ).map(([k, v]) => `${k},${esc(v)}`),
    "",
    "description,quantity,unit_price,amount",
    ...x.line_items.map(
      (li) => `${esc(li.description)},${li.quantity ?? ""},${li.unit_price ?? ""},${li.amount ?? ""}`,
    ),
  ];
  return lines.join("\n");
}

export default function Home() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [result, setResult] = useState<Extraction | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadSample = useCallback(async (path: string, name: string) => {
    setError(null);
    setResult(null);
    const { base64, previewUrl } = await rasterizeSvg(path);
    setFile({ name, mediaType: "image/png", base64, previewUrl });
  }, []);

  const loadUpload = useCallback((f: File) => {
    setError(null);
    setResult(null);
    if (!ACCEPTED.includes(f.type)) {
      setError("Unsupported file type. Use PNG, JPEG, WebP, GIF, or PDF.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File is larger than 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFile({
        name: f.name,
        mediaType: f.type,
        base64: dataUrl.split(",")[1],
        previewUrl: f.type === "application/pdf" ? "" : dataUrl,
      });
    };
    reader.readAsDataURL(f);
  }, []);

  async function extract() {
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: file.base64, media_type: file.mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setResult(data.extraction);
        setMeta(data.meta);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!result) return;
    const blob = new Blob([toCsv(result)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "extraction.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const fields: [string, string][] = result
    ? [
        ["Vendor", result.vendor ?? "n/a"],
        ["Doc #", result.document_number ?? "n/a"],
        ["Date", result.date ?? "n/a"],
        ["Currency", result.currency ?? "n/a"],
        ["Subtotal", money(result.subtotal, result.currency)],
        ["Discount", money(result.discount, result.currency)],
        ["Tax", money(result.tax, result.currency)],
        ["Tip", money(result.tip, result.currency)],
        ["Total", money(result.total, result.currency)],
        ["Payment", result.payment_method ?? "n/a"],
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col">
      {/* 顶栏 */}
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink font-mono text-sm font-semibold text-verify-soft">
            ▦
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-tight tracking-tight">
              LedgerLens
            </p>
            <p className="text-[11px] text-ink-soft leading-tight">
              receipts &amp; invoices → structured data
            </p>
          </div>
          <span className="ml-auto rounded-full border border-line bg-paper px-3 py-1 text-[11px] text-ink-soft">
            Portfolio demo · Claude vision · nothing is stored
          </span>
        </div>
      </header>

      <main className="blueprint mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        <div className="grid gap-5 lg:grid-cols-[5fr_6fr]">
          {/* 左栏:文档 */}
          <section className="flex flex-col rounded-xl border border-line bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                1 · Document
              </h2>
              {file && (
                <span className="max-w-[180px] truncate font-mono text-[11px] text-ink-soft">
                  {file.name}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-4">
              {!file ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) loadUpload(f);
                  }}
                  className={`flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors ${
                    dragOver ? "border-verify bg-verify-soft/40" : "border-line"
                  }`}
                >
                  <p className="text-[14px] font-medium">
                    Drop a receipt or invoice here
                  </p>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    PNG · JPEG · WebP · PDF, up to 5 MB
                  </p>
                  <label className="mt-4 cursor-pointer rounded-lg border border-line bg-paper px-4 py-2 text-[12.5px] font-medium hover:border-verify hover:text-verify transition-colors">
                    Browse files
                    <input
                      type="file"
                      accept={ACCEPTED.join(",")}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) loadUpload(f);
                      }}
                    />
                  </label>
                  <div className="mt-8 w-full border-t border-line pt-5">
                    <p className="text-[11px] uppercase tracking-wide text-ink-soft mb-2.5">
                      or try a sample
                    </p>
                    <div className="flex justify-center gap-2">
                      {SAMPLES.map((s) => (
                        <button
                          key={s.path}
                          onClick={() => loadSample(s.path, s.name)}
                          className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium hover:border-verify hover:text-verify transition-colors"
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative flex-1 overflow-auto rounded-lg border border-line bg-paper p-3">
                    {file.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.previewUrl}
                        alt="Document preview"
                        className="mx-auto max-h-[460px] rounded shadow-[0_4px_20px_-6px_rgba(22,24,29,0.25)]"
                      />
                    ) : (
                      <div className="flex h-full min-h-[200px] items-center justify-center font-mono text-[12px] text-ink-soft">
                        PDF loaded — preview not shown
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={extract}
                      disabled={loading}
                      className="flex-1 rounded-lg bg-verify px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-verify/90 disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Extracting…" : "Extract data →"}
                    </button>
                    <button
                      onClick={() => {
                        setFile(null);
                        setResult(null);
                        setError(null);
                      }}
                      className="rounded-lg border border-line px-4 py-2.5 text-[13px] text-ink-soft hover:text-ink transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 右栏:提取结果 */}
          <section className="flex flex-col rounded-xl border border-line bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                2 · Extracted fields
              </h2>
              {meta && result && (
                <span className="font-mono text-[11px] text-ink-soft">
                  {meta.model} · {(meta.elapsed_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            <div className="flex-1 p-4">
              {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                  {error}
                </div>
              )}

              {loading && (
                <div className="space-y-2.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="skeleton h-9 rounded-md" />
                  ))}
                </div>
              )}

              {!loading && !result && !error && (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                  <span className="font-mono text-3xl text-line">{"{ }"}</span>
                  <p className="mt-3 text-[13px] text-ink-soft">
                    Load a document and hit{" "}
                    <span className="font-medium text-verify">Extract data</span> —
                    fields appear here for review.
                  </p>
                </div>
              )}

              {result && (
                <div>
                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
                    {fields.map(([label, value], i) => (
                      <div
                        key={label}
                        className="row-in bg-white px-3.5 py-2.5"
                        style={{ animationDelay: `${i * 0.04}s` }}
                      >
                        <p className="text-[10.5px] uppercase tracking-wide text-ink-soft">
                          {label}
                        </p>
                        <p
                          className={`mt-0.5 font-mono text-[13px] font-medium ${
                            value === "n/a" ? "text-ink-soft/50" : "text-ink"
                          } ${label === "Total" ? "text-verify font-semibold" : ""}`}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {result.line_items.length > 0 && (
                    <div className="row-in mt-4 overflow-x-auto rounded-lg border border-line" style={{ animationDelay: "0.4s" }}>
                      <table className="w-full text-[12.5px]">
                        <thead>
                          <tr className="border-b border-line bg-paper text-left text-[10.5px] uppercase tracking-wide text-ink-soft">
                            <th className="px-3.5 py-2 font-medium">Item</th>
                            <th className="px-3 py-2 text-right font-medium">Qty</th>
                            <th className="px-3 py-2 text-right font-medium">Unit</th>
                            <th className="px-3.5 py-2 text-right font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {result.line_items.map((li, i) => (
                            <tr key={i} className="border-b border-line/60 last:border-0">
                              <td className="px-3.5 py-2 font-sans">{li.description ?? "n/a"}</td>
                              <td className="px-3 py-2 text-right">{li.quantity ?? "—"}</td>
                              <td className="px-3 py-2 text-right">{money(li.unit_price, result.currency)}</td>
                              <td className="px-3.5 py-2 text-right">{money(li.amount, result.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {result.notes && (
                    <p className="row-in mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[12px] text-warn" style={{ animationDelay: "0.5s" }}>
                      <span className="font-semibold">Flag:</span> {result.notes}
                    </p>
                  )}

                  <div className="row-in mt-4 flex gap-2" style={{ animationDelay: "0.55s" }}>
                    <button
                      onClick={downloadCsv}
                      className="rounded-lg bg-ink px-4 py-2.5 text-[13px] font-medium text-white hover:bg-ink/85 transition-colors"
                    >
                      Download CSV
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                      className="rounded-lg border border-line px-4 py-2.5 text-[13px] text-ink-soft hover:text-ink hover:border-ink-soft transition-colors"
                    >
                      Copy JSON
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 作品集说明 */}
        <section className="mt-6 rounded-xl border border-line bg-white p-5 sm:p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-3 text-[12.5px] leading-relaxed text-ink-soft">
            <div>
              <p className="font-semibold text-ink mb-1">Schema-enforced output</p>
              Claude vision reads the document; structured outputs guarantee the
              JSON always matches the schema — no parsing surprises.
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Honest about unknowns</p>
              Unreadable fields come back as <span className="font-mono">null</span>{" "}
              and display as “n/a” — the model is instructed never to guess.
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Drop-in workflow</p>
              Point it at your expense inbox or bookkeeping pipeline: same API,
              CSV/JSON out, ~1–2¢ per document.
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-5 text-center text-[11.5px] text-ink-soft/70">
        Fictional documents · Built with Next.js &amp; Claude · files are processed
        in memory, never stored
      </footer>
    </div>
  );
}
