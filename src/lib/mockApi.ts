
import type { QuoteRequest, Rate } from "./types";

const hash = (s:string) => [...s].reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0,0);

const volumetricWeight_g = (l:number,w:number,h:number, mode:string) => {
  const l_cm=l/10, w_cm=w/10, h_cm=h/10;
  const divisor = (mode==="air"||mode==="courier") ? 6000 : 10000;
  return (l_cm*w_cm*h_cm/divisor)*1000;
};

export async function mockQuote(req: QuoteRequest): Promise<Rate[]> {
  const key = JSON.stringify(req);
  const h = Math.abs(hash(key));
  const weight_g = req.parcels.reduce((acc,p)=> acc + Math.max(p.weight_g, volumetricWeight_g(p.l_mm,p.w_mm,p.h_mm, req.mode)), 0);
  const weight_kg = weight_g/1000;

  const distanceFactor = 1 + ((h % 900) / 1000);
  const modeFactor = { air:1.6, courier:1.8, road:1.2, sea:0.8 }[req.mode as "air"|"courier"|"road"|"sea"];
  const base = Math.max(25, weight_kg * 3.2 * distanceFactor * modeFactor);

  const fuelPct = 0.14 + ((h % 8)/100);
  const oversized = req.parcels.some(p=> Math.max(p.l_mm,p.w_mm,p.h_mm) > 1200) ? 18 : 0;
  const remote = (h % 5===0) ? 12 : 0;
  const surcharges = base * fuelPct + oversized + remote;

  const incotermFees = req.incoterm==="CIP" ? (base*0.05+5) :
                       req.incoterm==="DDP" ? (base*0.12+20) : 0;

  const total = Math.round((base + surcharges + incotermFees) * 100)/100;

  const carriers = ["DHL","ARAMEX","FEDEX"];
  return carriers.map((c,i)=>({
    carrier: c,
    service: i===0 ? "EXPRESS" : i===1 ? "PRIORITY" : "ECONOMY",
    transitDays: i===0 ? 3 : i===1 ? 4 : 6,
    base: Math.round(base*(1+i*0.05)),
    surcharges: Math.round(surcharges*(1+i*0.03)),
    incotermFees: Math.round(incotermFees),
    total: Math.round((total*(1+i*0.04))*100)/100,
    currency: req.currency,
    breakdown: { fuelPct, oversized, remote }
  }));
}

export async function mockProductLookupByName(q:{name:string; brand?:string; sku?:string}) {
  const seed = Math.abs(([...q.name].reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0,0)));
  const dims = { l_mm: 250 + (seed%150), w_mm: 180 + (seed%120), h_mm: 20 + (seed%60) };
  const weight_g = 1200 + (seed%2000);
  return { ...dims, weight_g, confidence: 0.8, source_url: "https://example.com/specs" };
}

export function productsToParcels(products: {l_mm?:number; w_mm?:number; h_mm?:number; weight_g?:number; qty:number}[]) {
  const parcels = [];
  for (const p of products) {
    const count = Math.max(1, p.qty);
    for (let i=0;i<count;i++) {
      parcels.push({
        l_mm: p.l_mm ?? 400, w_mm: p.w_mm ?? 300, h_mm: p.h_mm ?? 200, weight_g: p.weight_g ?? 5000
      });
    }
  }
  return parcels;
}
