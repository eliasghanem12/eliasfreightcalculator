// src/lib/api.ts — the only place the frontend talks to the FreightIQ backend.
import { getIdToken } from "./auth";
const API = import.meta.env.VITE_API_URL ?? "";

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token ? { ...extra, Authorization: token } : extra;
}

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
  dimSource?: string | null; // "verified" | "checked" | "fallback"
  trust?: "verified" | "checked" | "estimated" | null;
  basis?: string | null;       // carton | chassis+uplift | category
  source?: string | null;      // URL the lookup used
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
  breakdown?: Record<string, number | string>;
  indicative?: boolean;
  reference?: string | null;
  sourceUrl?: string | null;
  transitBasis?: string | null;
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
  packages?: { l_mm: number; w_mm: number; h_mm: number; weight_g: number; qty: number; kind: string }[];
  packaging?: "loose" | "pallet";
  declaredValue?: number;
  origin: { country: string; portId?: string };
  destination: { country: string; portId?: string };
  mode: string;
  incoterm: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("Your session has expired. Sign in again.");
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
  const data = await post<{ items: ParsedProduct[]; engine?: string }>("/parse", body);
  const items = (data.items ?? []) as ParsedProduct[] & { engine?: string };
  items.engine = data.engine;           // carried along for usage reporting
  return items;
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
    breakdown: r.breakdown,
    indicative: r.indicative,
    reference: r.reference,
    sourceUrl: r.sourceUrl,
    transitBasis: r.transitBasis,
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
export const lbsToGrams = (lbs: number) => Math.round(lbs * 453.592 / 100) * 100; // 0.1 kg precision, matches what is displayed

// Parse the first number out of a transit string like "3-5 days" or "By 10:30 next business day".
export function transitDaysOf(transit: string): number {
  const m = transit.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}

// ─── Locations (countries, airports, seaports, warehouses) ───────
export interface Country { code: string; name: string }
export interface Place { id: string; name: string; country: string; city?: string; type?: "airport" | "seaport" | "warehouse" }
export interface LocationsDoc { version?: number; updatedAt?: string; countries: Country[]; airports: Place[]; seaports: Place[]; warehouses: Place[] }

export async function getLocations(): Promise<LocationsDoc> {
  const res = await fetch(`${API}/locations`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Locations unavailable (HTTP ${res.status})`);
  const json = await res.json();
  return (json?.data ?? json) as LocationsDoc;
}

export async function saveLocations(doc: LocationsDoc, adminKey: string): Promise<LocationsDoc> {
  const res = await fetch(`${API}/locations`, {
    method: "PUT",
    headers: await authHeaders({ "Content-Type": "application/json", "X-Admin-Key": adminKey }),
    body: JSON.stringify(doc),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(json?.error || `Save failed (HTTP ${res.status})`);
  return (json?.data ?? json) as LocationsDoc;
}

// ─── Usage events, feedback, admin stats ─────────────────────────
export interface QuoteEventPayload {
  quoteId: string; origin: string; destination: string; mode: string; incoterm: string;
  fileType?: string; fileName?: string; engine?: string; packaging?: string;
  hwLines: number; swLines: number; units: number; weightKg: number; volumeM3: number; chargeableKg: number;
  trust: { verified: number; checked: number; estimated: number };
  cheapestIndicative?: number | null; cheapestNegotiated?: number | null; parseMs?: number | null;
}
export async function logQuoteEvent(p: QuoteEventPayload): Promise<void> {
  try { await post("/events", p); } catch (e) { console.warn("event not logged", e); }
}
export async function sendFeedback(p: { quoteId?: string; thumbs: "up" | "down"; category: string; comment?: string; origin?: string; destination?: string; mode?: string }): Promise<void> {
  await post("/feedback", p);
}
export interface AdminStats {
  days: number; since: string;
  kpis: { quotes: number; users: number; feedback: number; satisfaction: number | null; verifiedRate: number | null; avgWeightKg: number; hwLines: number; swLines: number; withNegotiated: number };
  series: { day: string; quotes: number; up: number; down: number; cost: number }[];
  ai: { total: { calls: number; tokIn: number; tokOut: number; cost: number; requests: number; costPerQuote: number | null }; byUser: { user: string; quotes: number; requests: number; calls: number; tokIn: number; tokOut: number; cost: number; costPerQuote: number | null }[]; byModel: { model: string; calls: number; tokIn: number; tokOut: number; cost: number }[]; note: string };
  byMode: { key: string; count: number }[]; byLane: { key: string; count: number }[]; byUser: { key: string; count: number }[];
  byIncoterm: { key: string; count: number }[]; byFile: { key: string; count: number }[]; engines: { key: string; count: number }[];
  trust: { verified: number; checked: number; estimated: number };
  feedbackByCategory: { category: string; up: number; down: number }[];
  recentFeedback: { ts: string; user: string; thumbs: string; category: string; comment: string; lane: string; mode: string; quoteId: string }[];
  recentQuotes: { ts: string; user: string; lane: string; mode: string; incoterm: string; fileType: string; hwLines: number; swLines: number; weightKg: number; volumeM3: number; trust: { verified: number; checked: number; estimated: number }; cheapestIndicative: number | null; cheapestNegotiated: number | null; engine: string; quoteId: string }[];
}
export async function getAdminStats(days = 30): Promise<AdminStats> {
  const res = await fetch(`${API}/admin/stats?days=${days}`, { headers: await authHeaders() });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(json?.error || `HTTP ${res.status}`);
  return (json?.data ?? json) as AdminStats;
}
