// src/lib/history.ts — quotes saved in the browser. Phase 2 moves this to DynamoDB.
import type { Rate } from "./api";

export interface SavedQuote {
  id: string;
  savedAt: string; // ISO
  fileName?: string;
  origin: string;
  destination: string;
  mode: string;
  incoterm: string;
  hwItems: number;
  swItems: number;
  totalWeightKg: number;
  publicRates: Rate[];
  specialRates: Rate[];
}

const KEY = "freightiq.history.v1";

export function loadHistory(): SavedQuote[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedQuote[]) : [];
  } catch { return []; }
}

export function saveQuote(q: Omit<SavedQuote, "id" | "savedAt">): SavedQuote {
  const entry: SavedQuote = { ...q, id: `q_${Date.now().toString(36)}`, savedAt: new Date().toISOString() };
  const all = [entry, ...loadHistory()].slice(0, 50);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full or disabled */ }
  return entry;
}

export function deleteQuote(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(loadHistory().filter((q) => q.id !== id))); } catch { /* ignore */ }
}

export function clearHistory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
