// src/lib/packaging.ts — convert cartons to pallets for freight calculation.
export type PackagingMode = "loose" | "pallet";
export interface Carton { l_mm: number; w_mm: number; h_mm: number; weight_g: number; qty: number }
export interface Package { l_mm: number; w_mm: number; h_mm: number; weight_g: number; qty: number; kind: "carton" | "pallet" }

// Standard ISO pallet 1200 x 1000, deck height 150 mm, 25 kg tare, max load height 1.45 m above deck, 85% volumetric fill.
export const PALLET = { l_mm: 1200, w_mm: 1000, deck_mm: 150, tare_g: 25000, maxStack_mm: 1450, fill: 0.85 };

export function palletise(cartons: Carton[]): Package[] {
  const usable = cartons.filter((c) => c.l_mm && c.w_mm && c.h_mm);
  if (!usable.length) return [];
  const totalVol = usable.reduce((s, c) => s + c.l_mm * c.w_mm * c.h_mm * c.qty, 0);
  const totalWt = usable.reduce((s, c) => s + c.weight_g * c.qty, 0);
  const capacity = PALLET.l_mm * PALLET.w_mm * PALLET.maxStack_mm * PALLET.fill;
  // oversize cartons (longer than the pallet) each take their own pallet footprint
  const oversize = usable.filter((c) => Math.max(c.l_mm, c.w_mm) > 1200 || Math.min(c.l_mm, c.w_mm) > 1000);
  const oversizeVol = oversize.reduce((s, c) => s + c.l_mm * c.w_mm * c.h_mm * c.qty, 0);
  const normalVol = totalVol - oversizeVol;
  const normalPallets = Math.ceil(normalVol / capacity);
  const oversizePallets = oversize.reduce((s, c) => s + c.qty, 0);
  const n = Math.max(1, normalPallets + oversizePallets);
  // stack height: spread volume evenly over the pallets used
  const stack = Math.min(PALLET.maxStack_mm, Math.ceil((totalVol / n) / (PALLET.l_mm * PALLET.w_mm * PALLET.fill) / 10) * 10);
  const perPalletWt = Math.round(totalWt / n + PALLET.tare_g);
  return [{ l_mm: PALLET.l_mm, w_mm: PALLET.w_mm, h_mm: PALLET.deck_mm + stack, weight_g: perPalletWt, qty: n, kind: "pallet" }];
}
