import type { QuoteRequest, Rate } from "./types";

// ─── Your FreightIQ backend URL ───────────────────────────────────
const API = import.meta.env.VITE_API_URL ?? "";

// ─── Parse a quote file using Claude AI ──────────────────────────
export async function parseQuoteFile(file: File): Promise<ParsedProduct[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const isImage = ["jpg", "jpeg", "png"].includes(ext ?? "");
  const isPDF = ext === "pdf";
  const isExcel = ["xlsx", "xls"].includes(ext ?? "");

  let body: string;
  let contentField: "content" | "base64";

  if (isImage || isPDF) {
    // Send as base64
    const base64 = await fileToBase64(file);
    body = JSON.stringify({
      base64,
      mediaType: file.type || (isPDF ? "application/pdf" : "image/png"),
    });
    contentField = "base64";
  } else if (isExcel) {
    // Convert Excel to text using SheetJS
    const text = await excelToText(file);
    body = JSON.stringify({ content: text });
    contentField = "content";
  } else {
    // Plain text / CSV
    const text = await file.text();
    body = JSON.stringify({ content: text });
    contentField = "content";
  }

  const res = await fetch(`${API}/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Parse failed: ${err}`);
  }

  const json = await res.json();
  return json.data?.items ?? [];
}

// ─── Convert File to base64 string ───────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:...;base64,
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Convert Excel to plain text using SheetJS ───────────────────
async function excelToText(file: File): Promise<string> {
  // Dynamically import SheetJS (already available via CDN in browser)
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs" as any);
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  // Use the "Quote" sheet if it exists, otherwise first sheet
  const sheetName =
    wb.SheetNames.find((n: string) =>
      ["quote", "summary", "sheet1"].includes(n.toLowerCase())
    ) ?? wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(ws);
}

// ─── Parsed product type returned by backend ─────────────────────
export interface ParsedProduct {
  id: number;
  name: string;
  model: string | null;
  type: "hardware" | "software";
  qty: number;
  unitPrice: number;
  dimensions: string | null;
  weight: number;
}

// ─── Everything below stays the same (mock) ──────────────────────

const hash = (s: string) =>
  [...s].reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0) | 0, 0);

const volumetricWeight_g = (l: number, w: number, h: number, mode: string) => {
  const l_cm = l / 10, w_cm = w / 10, h_cm = h / 10;
  const divisor = mode === "air" || mode === "courier" ? 6000 : 10000;
  return (l_cm * w_cm * h_cm / divisor) * 1000;
};

export async function mockQuote(req: QuoteRequest): Promise<Rate[]> {
  const key = JSON.stringify(req);
  const h = Math.abs(hash(key));
  const weight_g = req.parcels.reduce(
    (acc, p) => acc + Math.max(p.weight_g, volumetricWeight_g(p.l_mm, p.w_mm, p.h_mm, req.mode)),
    0
  );
  const weight_kg = weight_g / 1000;
  const distanceFactor = 1 + (h % 900) / 1000;
  const modeFactor = { air: 1.6, courier: 1.8, road: 1.2, sea: 0.8 }[
    req.mode as "air" | "courier" | "road" | "sea"
  ];
  const base = Math.max(25, weight_kg * 3.2 * distanceFactor * modeFactor);
  const fuelPct = 0.14 + (h % 8) / 100;
  const oversized = req.parcels.some((p) => Math.max(p.l_mm, p.w_mm, p.h_mm) > 1200) ? 18 : 0;
  const remote = h % 5 === 0 ? 12 : 0;
  const surcharges = base * fuelPct + oversized + remote;
  const incotermFees =
    req.incoterm === "CIP" ? base * 0.05 + 5 :
    req.incoterm === "DDP" ? base * 0.12 + 20 : 0;
  const total = Math.round((base + surcharges + incotermFees) * 100) / 100;
  const carriers = ["DHL", "ARAMEX", "FEDEX"];
  return carriers.map((c, i) => ({
    carrier: c,
    service: i === 0 ? "EXPRESS" : i === 1 ? "PRIORITY" : "ECONOMY",
    transitDays: i === 0 ? 3 : i === 1 ? 4 : 6,
    base: Math.round(base * (1 + i * 0.05)),
    surcharges: Math.round(surcharges * (1 + i * 0.03)),
    incotermFees: Math.round(incotermFees),
    total: Math.round(total * (1 + i * 0.04) * 100) / 100,
    currency: req.currency,
    breakdown: { fuelPct, oversized, remote },
  }));
}

export async function mockProductLookupByName(q: { name: string; brand?: string; sku?: string }) {
  const seed = Math.abs([...q.name].reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0) | 0, 0));
  const dims = { l_mm: 250 + (seed % 150), w_mm: 180 + (seed % 120), h_mm: 20 + (seed % 60) };
  const weight_g = 1200 + (seed % 2000);
  return { ...dims, weight_g, confidence: 0.8, source_url: "https://example.com/specs" };
}

export async function getUploadUrl(file: File) {
  const res = await fetch(`${import.meta.env.VITE_API_BASE}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  if (!res.ok) throw new Error("Failed to get upload URL");
  return res.json() as Promise<{ url: string; key: string; quoteId: string }>;
}

export async function putToS3Presigned(url: string, file: File) {
  const r = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
}

export function productsToParcels(
  products: { l_mm?: number; w_mm?: number; h_mm?: number; weight_g?: number; qty: number }[]
) {
  const parcels = [];
  for (const p of products) {
    const count = Math.max(1, p.qty);
    for (let i = 0; i < count; i++) {
      parcels.push({
        l_mm: p.l_mm ?? 400,
        w_mm: p.w_mm ?? 300,
        h_mm: p.h_mm ?? 200,
        weight_g: p.weight_g ?? 5000,
      });
    }
  }
  return parcels;
}
