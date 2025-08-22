
export type PortLike = {
  id: string;
  name: string;
  country: string;
  type: "airport" | "seaport" | "warehouse";
  city?: string;
  notes?: string;
};

export const AIRPORTS: PortLike[] = [
  { id:"DXB", name:"Dubai Intl (DXB)", country:"AE", type:"airport", city:"Dubai", notes:"Major ME hub" },
  { id:"DWC", name:"Al Maktoum (DWC)", country:"AE", type:"airport", city:"Dubai", notes:"Cargo-focused" },
  { id:"AUH", name:"Abu Dhabi (AUH)", country:"AE", type:"airport", city:"Abu Dhabi" },
  { id:"KGL", name:"Kigali (KGL)", country:"RW", type:"airport", city:"Kigali" },
];

export const SEAPORTS: PortLike[] = [
  { id:"AEJEA", name:"Jebel Ali Port", country:"AE", type:"seaport", city:"Dubai", notes:"Largest in ME" },
  { id:"AEKHL", name:"Khalifa Port", country:"AE", type:"seaport", city:"Abu Dhabi" },
  { id:"RWDAR", name:"Dar es Salaam (gateway to RW)", country:"TZ", type:"seaport", city:"Dar es Salaam", notes:"Common sea gateway for Rwanda" },
  { id:"MOMCT", name:"Port of Mombasa", country:"KE", type:"seaport", city:"Mombasa", notes:"East Africa hub" },
];

export const WAREHOUSES: PortLike[] = [
  { id:"AE-DXB-WH1", name:"Dubai Logistics WH #1", country:"AE", type:"warehouse", city:"Dubai", notes:"Generic warehouse example" },
  { id:"AE-DXB-WH2", name:"JAFZA Warehouse", country:"AE", type:"warehouse", city:"Dubai" },
  { id:"RW-KGL-WH1", name:"Kigali Warehouse", country:"RW", type:"warehouse", city:"Kigali" },
];

export const byCountry = (list: PortLike[], iso2?:string) =>
  !iso2 ? list : list.filter(x => x.country === (iso2||"").toUpperCase());
