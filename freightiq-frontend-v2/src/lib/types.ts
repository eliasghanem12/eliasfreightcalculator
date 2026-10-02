
export type Parcel = { l_mm:number; w_mm:number; h_mm:number; weight_g:number };

export type Product = {
  name: string;
  brand?: string;
  sku?: string;
  qty: number;
  l_mm?: number; w_mm?: number; h_mm?: number; weight_g?: number;
  confidence?: number; source_url?: string;
};

export type QuoteRequest = {
  origin: { country:string; portId?:string };
  destination: { country:string; portId?:string };
  incoterm: "EXW"|"FOB"|"CIF"|"CIP"|"DDP";
  mode: "air"|"sea"|"road"|"courier";
  products?: Product[];
  parcels: Parcel[];
  declaredValue:number;
  currency:"USD"|"AED"|string;
  options?: { insurance?:boolean; coo?:boolean; coc?:boolean };
};

export type Rate = {
  carrier:string;
  service:string;
  transitDays:number;
  base:number;
  surcharges:number;
  incotermFees:number;
  total:number;
  currency:string;
  breakdown?: Record<string,number>;
};
