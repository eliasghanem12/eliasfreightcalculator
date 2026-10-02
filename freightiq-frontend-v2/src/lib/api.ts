// src/lib/api.ts — the only place the frontend talks to the FreightIQ backend.
const API = import.meta.env.VITE_API_URL ?? "";

export type ItemType = "hardware" | "software";

export interface ParsedProduct {
  id: number;
  name: string;
  model: string | null;
  type: ItemType;
  qty: number;
  unitPrice: number;
  dimensions: string | null; // "L x W x H in"
  weight: number;            // lbs per unit
  dimSource?: string | null; // "verified" | "fallback" | "cache"
}

export interface Rate {
  carrier: string;
  service: string;
  price: number;
  currency: string;
  transit: string;
  billableWeightKg?: number;
  pricePerKg?: number;
  fixedFee?: number;
  validFrom?: string;
  validTo?: string;
  rateType?: "public" | "special";
  source?: string;
  recommended?: boolean;
}

export interface RatesResponse {
  rates: Rate[];
  message?: string;
  billableWeightKg?: number;
  shipment?: { totalWeightKg: number; totalVolumeM3: number; volWeightAir: number; volWeightSea: number; hwItems: number };
}

export interface QuoteItemPayload {
  name: string;
  type: ItemType;
  qty: number;
  weight_g: number;
  l_mm?: number;
  w_mm?: number;
  h_mm?: number;
}

export interface QuoteRequestPayload {
  items: QuoteItemPayload[];
  origin: { country: string; portId?: string };
  destination: { country: string; portId?: string };
  mode: string;
  incoterm: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (json && json.success === false) throw new Error(json.error || "Request failed");
  return (json?.data ?? json) as T;
}

// ─── Parse a quotation file ──────────────────────────────────────
export async function parseQuoteFile(file: File): Promise<ParsedProduct[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext);
  const isPDF = ext === "pdf";
  const isExcel = ["xlsx", "xls"].includes(ext);

  let body: Record<string, unknown>;
  if (isImage || isPDF) {
    body = { base64: await fileToBase64(file), mediaType: file.type || (isPDF ? "application/pdf" : "image/png") };
  } else if (isExcel) {
    body = { content: trimLegalText(await excelToText(file)) };
  } else {
    body = { content: trimLegalText(await file.text()) };
  }
  const data = await post<{ items: ParsedProduct[] }>("/parse", body);
  return data.items ?? [];
}

// Strip terms-and-conditions boilerplate so long vendor quotes stay under the API time limit.
function trimLegalText(text: string): string {
  const markers = [/TERMS\s+AND\s+CONDITIONS/i, /Lenovo Agreement for Machines/i, /^\s*1\.\s*Definitions/im, /LIMITATION OF LIABILITY/i];
  for (const m of markers) {
    const at = text.search(m);
    if (at > 0) { text = text.slice(0, at); break; }
  }
  return text.length > 25000 ? text.slice(0, 25000) + "\n[truncated]" : text;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function excelToText(file: File): Promise<string> {
  const url = "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";
  const XLSX: any = await import(/* @vite-ignore */ url);
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const name = wb.SheetNames.find((n: string) => ["quote", "summary", "sheet1"].includes(n.toLowerCase())) ?? wb.SheetNames[0];
  return XLSX.utils.sheet_to_csv(wb.Sheets[name]);
}

// ─── Dimensions for one manually-added product ──────────────────
export async function fetchSingleDimensions(name: string, sku: string): Promise<ParsedProduct | null> {
  const text = sku ? `1x ${name} (${sku})` : `1x ${name}`;
  const data = await post<{ items: ParsedProduct[] }>("/parse", { content: text });
  return data.items?.[0] ?? null;
}

// ─── Rates ───────────────────────────────────────────────────────
export async function getPublicRates(req: QuoteRequestPayload): Promise<RatesResponse> {
  const data = await post<any>("/quotes", { ...req, rateType: "public" });
  return normaliseRates(data);
}

export async function getSpecialRates(req: QuoteRequestPayload): Promise<RatesResponse> {
  const data = await post<any>("/quotes", { ...req, rateType: "special" });
  return normaliseRates(data);
}

function normaliseRates(data: any): RatesResponse {
  const raw: any[] = data?.rates ?? data?.quotes ?? [];
  const rates: Rate[] = raw.map((r) => ({
    carrier: r.carrier ?? "Unknown",
    service: r.service ?? "Standard",
    price: Number(r.price ?? r.total ?? 0),
    currency: r.currency ?? "USD",
    transit: r.transit ?? (r.transitDays != null ? `${r.transitDays} days` : "n/a"),
    billableWeightKg: r.billableWeightKg,
    pricePerKg: r.pricePerKg,
    fixedFee: r.fixedFee,
    validFrom: r.validFrom,
    validTo: r.validTo,
    rateType: r.rateType,
    source: r.source,
    recommended: r.recommended,
  }));
  return { rates, message: data?.message, billableWeightKg: data?.billableWeightKg, shipment: data?.shipment };
}

// ─── Unit helpers ────────────────────────────────────────────────
export function inchesToMm(dims: string | null | undefined): { l_mm?: number; w_mm?: number; h_mm?: number } {
  if (!dims) return {};
  const parts = dims.replace(/in$/i, "").trim().split(/\s*x\s*/i).map((p) => parseFloat(p));
  if (parts.length !== 3 || parts.some((n) => !isFinite(n))) return {};
  return { l_mm: Math.round(parts[0] * 25.4), w_mm: Math.round(parts[1] * 25.4), h_mm: Math.round(parts[2] * 25.4) };
}
export const lbsToGrams = (lbs: number) => Math.round(lbs * 453.592);

// Parse the first number out of a transit string like "3-5 days" or "By 10:30 next business day".
export function transitDaysOf(transit: string): number {
  const m = transit.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}
