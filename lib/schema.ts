// 提取结果的 JSON Schema（供 Claude 结构化输出）与对应 TS 类型。
// 所有字段可为 null——识别不出就留空，绝不编造。

export interface LineItem {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
}

export interface Extraction {
  vendor: string | null;
  document_number: string | null;
  date: string | null;
  currency: string | null;
  subtotal: number | null;
  discount: number | null;
  tax: number | null;
  tip: number | null;
  total: number | null;
  payment_method: string | null;
  line_items: LineItem[];
  notes: string | null;
}

const nullable = (type: "string" | "number") => ({ type: [type, "null"] });

export const extractionSchema = {
  type: "object",
  properties: {
    vendor: nullable("string"),
    document_number: nullable("string"),
    date: { ...nullable("string"), description: "ISO 8601 (YYYY-MM-DD) when possible" },
    currency: { ...nullable("string"), description: "ISO 4217 code, e.g. USD" },
    subtotal: nullable("number"),
    discount: { ...nullable("number"), description: "Positive number; null if none" },
    tax: nullable("number"),
    tip: nullable("number"),
    total: nullable("number"),
    payment_method: nullable("string"),
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: nullable("string"),
          quantity: nullable("number"),
          unit_price: nullable("number"),
          amount: nullable("number"),
        },
        required: ["description", "quantity", "unit_price", "amount"],
        additionalProperties: false,
      },
    },
    notes: {
      ...nullable("string"),
      description: "Anything ambiguous, unreadable, or worth flagging",
    },
  },
  required: [
    "vendor",
    "document_number",
    "date",
    "currency",
    "subtotal",
    "discount",
    "tax",
    "tip",
    "total",
    "payment_method",
    "line_items",
    "notes",
  ],
  additionalProperties: false,
} as const;
