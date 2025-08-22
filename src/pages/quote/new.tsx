
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteSchema, type QuoteFormValues } from "../../lib/validation";
import { useMemo, useState } from "react";
import { mockQuote, mockProductLookupByName, productsToParcels } from "../../lib/mockApi";
import type { Rate } from "../../lib/types";
import { AIRPORTS, SEAPORTS, WAREHOUSES, byCountry } from "../../lib/locations";

const Help = ({text}:{text:string}) => (
  <span title={text} className="ml-2 text-xs opacity-70 cursor-help">?</span>
);

export default function QuoteNew() {
  const [rates,setRates] = useState<Rate[]|null>(null);

  const { register, handleSubmit, setValue, watch, control, formState:{errors} } =
    useForm<QuoteFormValues>({
      resolver: zodResolver(quoteSchema),
      defaultValues: {
        origin:{ country:"AE" }, destination:{ country:"RW" },
        incoterm:"CIP", mode:"sea",
        products: [{ name:"Dell PowerEdge R760xs", qty:1 }, { name:"Dell ME5024", qty:1 }],
        parcels:[{ l_mm:1200, w_mm:800, h_mm:600, weight_g:100000 }],
        declaredValue: 15000, currency:"USD", options:{ insurance:true }
      }
    });

  const { fields: productFields, append, remove } = useFieldArray({ control, name: "products" as const });

  const mode = watch("mode");
  const originCountry = watch("origin.country");
  const destCountry = watch("destination.country");

  const originList = useMemo(() => {
    if (mode==="air") return byCountry(AIRPORTS, originCountry);
    if (mode==="sea") return byCountry(SEAPORTS, originCountry);
    return byCountry(WAREHOUSES, originCountry);
  }, [mode, originCountry]);

  const destList = useMemo(() => {
    if (mode==="air") return byCountry(AIRPORTS, destCountry);
    if (mode==="sea") return byCountry(SEAPORTS, destCountry);
    return byCountry(WAREHOUSES, destCountry);
  }, [mode, destCountry]);

  const onAutoFetch = async () => {
    const products = [...(watch("products") ?? [])];
    for (let i=0;i<products.length;i++){
      const p = products[i];
      if (!p?.name) continue;
      const found = await mockProductLookupByName({ name:p.name, brand:p.brand, sku:p.sku });
      products[i] = { ...p, ...found };
    }
    setValue("products", products);

    const parcels = productsToParcels(products.map(p=>({ l_mm:p.l_mm, w_mm:p.w_mm, h_mm:p.h_mm, weight_g:p.weight_g, qty:p.qty })));
    if (parcels.length>0) setValue("parcels", parcels);
  };

  const onSubmit = async (data:QuoteFormValues) => {
    const res = await mockQuote(data); setRates(res);
    localStorage.setItem("lastQuote", JSON.stringify({req:data,res}));
  };

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">New Quote</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        {/* Countries */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Origin Country<Help text="Where the shipment starts. Use ISO2 (e.g., AE, RW)."/></label>
            <input className="input" placeholder="AE" {...register("origin.country")} />
          </div>
          <div>
            <label className="text-sm font-medium">Destination Country<Help text="Where the shipment ends. Use ISO2 (e.g., RW)."/></label>
            <input className="input" placeholder="RW" {...register("destination.country")} />
          </div>
        </div>

        {/* Mode / Incoterm / Declared */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">Incoterm<Help text="Trade term that defines who pays and where risk transfers (EXW/FOB/CIF/CIP/DDP)."/></label>
            <select className="input" {...register("incoterm")}>
              <option>EXW</option><option>FOB</option><option>CIF</option><option>CIP</option><option>DDP</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Mode<Help text="Transport type: Air shows airports; Sea shows seaports; Road/Courier shows warehouses/cities."/></label>
            <select className="input" {...register("mode")}>
              <option>air</option><option>sea</option><option>road</option><option>courier</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Declared Value<Help text="Goods value for insurance and some fees (in selected currency)."/></label>
            <input className="input" type="number" placeholder="15000" {...register("declaredValue",{valueAsNumber:true})}/>
          </div>
        </div>

        {/* Mode-based port pickers */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">
              {mode==="air" ? "Origin Airport" : mode==="sea" ? "Origin Seaport" : "Origin Warehouse/City"}
              <Help text="Choose the specific airport/port/warehouse for pickup."/>
            </label>
            <select className="input" {...register("origin.portId")}>
              <option value="">-- Select --</option>
              {originList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.country})</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">
              {mode==="air" ? "Destination Airport" : mode==="sea" ? "Destination Seaport" : "Destination Warehouse/City"}
              <Help text="Choose the specific airport/port/warehouse for delivery."/>
            </label>
            <select className="input" {...register("destination.portId")}>
              <option value="">-- Select --</option>
              {destList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.country})</option>)}
            </select>
          </div>
        </div>

        {/* Products table */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Products <Help text="Add product name and quantity. Click Auto-Fetch to pull dims/weight from the internet (mock in Part 1)."/>
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={()=>append({ name:"", qty:1 })}>Add Row</button>
              <button type="button" className="btn" onClick={onAutoFetch}>Auto-Fetch</button>
            </div>
          </div>
          <div className="grid gap-2">
            {productFields.map((f,idx)=>(
              <div key={f.id} className="grid grid-cols-8 gap-2">
                <input className="input col-span-3" placeholder="Product name" {...register(`products.${idx}.name` as const)} />
                <input className="input" placeholder="Brand (opt)" {...register(`products.${idx}.brand` as const)} />
                <input className="input" placeholder="SKU (opt)" {...register(`products.${idx}.sku` as const)} />
                <input className="input" type="number" placeholder="Qty" {...register(`products.${idx}.qty` as const, {valueAsNumber:true})} />
                <button type="button" className="btn col-span-1" onClick={()=>remove(idx)}>Remove</button>
              </div>
            ))}
          </div>
          <p className="text-xs opacity-70">After Auto-Fetch, the system converts products to parcels (1 per unit) for the quote.</p>
        </div>

        {/* Parcels quick view */}
        <div>
          <label className="text-sm font-medium">Parcels (computed)<Help text="Auto-filled from products for MVP; later we’ll support advanced packing."/></label>
          <pre className="text-xs p-3 rounded border bg-white dark:bg-neutral-800 overflow-auto">
            {JSON.stringify(watch("parcels"), null, 2)}
          </pre>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" className="btn">Get Rates</button>
        </div>

        {Object.keys(errors).length>0 && (
          <pre className="text-xs text-red-600">{JSON.stringify(errors,null,2)}</pre>
        )}
      </form>

      {/* Results */}
      {rates && (
        <div className="grid gap-3">
          <h2 className="font-medium">Results</h2>
          {rates.map((r,i)=>(
            <div key={i} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.carrier} – {r.service}</div>
                <div className="text-lg">{r.total} {r.currency}</div>
              </div>
              <div className="text-sm opacity-80">Transit: {r.transitDays} days</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
