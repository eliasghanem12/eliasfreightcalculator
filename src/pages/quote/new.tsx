// src/pages/quote/new.tsx
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteSchema, type QuoteFormValues } from "../../lib/validation";
import { useMemo, useState, useRef } from "react";
import { getPublicRates, getSpecialRates, fetchSingleDimensions, parseQuoteFile } from "../../lib/mockApi";
import type { Rate } from "../../lib/types";
import {
  AIRPORTS,
  SEAPORTS,
  WAREHOUSES,
  byCountry,
  COUNTRY_NAMES,
} from "../../lib/locations";

const Help = ({ text }: { text: string }) => (
  <span title={text} className="ml-2 text-xs opacity-70 cursor-help">?</span>
);

export default function QuoteNew() {
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [specialRates, setSpecialRates] = useState<Rate[] | null>(null);
  const [ratesMessage, setRatesMessage] = useState<string>("");
  const [loadingRates, setLoadingRates] = useState<"" | "public" | "special">("");
  const [fetchingDimIdx, setFetchingDimIdx] = useState<number | null>(null);

  const {
    register,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      origin: { country: "AE" },
      destination: { country: "RW" },
      incoterm: "CIP",
      mode: "sea",
      products: [],
      parcels: [{ l_mm: 1, w_mm: 1, h_mm: 1, weight_g: 1 }],
      declaredValue: 15000,
      currency: "USD",
      options: { insurance: true },
    },
  });

  const { fields: productFields, append, remove } = useFieldArray({
    control,
    name: "products" as const,
  });

  const mode = watch("mode");
  const originCountry = watch("origin.country");
  const destCountry = watch("destination.country");

  const originList = useMemo(() => {
    const base = mode === "air" ? AIRPORTS : mode === "sea" ? SEAPORTS : WAREHOUSES;
    return byCountry(base, originCountry);
  }, [mode, originCountry]);

  const destList = useMemo(() => {
    const base = mode === "air" ? AIRPORTS : mode === "sea" ? SEAPORTS : WAREHOUSES;
    return byCountry(base, destCountry);
  }, [mode, destCountry]);

  const [quoteFileName, setQuoteFileName] = useState<string>("");
  const [uploadState, setUploadState] = useState<"idle"|"signing"|"uploading"|"done"|"error">("idle");
  const [uploadedQuoteId, setUploadedQuoteId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onQuoteSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQuoteFileName(file.name);

    try {
      setUploadState("uploading");
      const parsed = await parseQuoteFile(file);

      const allProducts = parsed.map(p => {
        let l_mm: number | undefined;
        let w_mm: number | undefined;
        let h_mm: number | undefined;
        if (p.type === "hardware" && p.dimensions) {
          const parts = p.dimensions.replace(/in$/i, "").trim().split(/\s*x\s*/i);
          if (parts.length === 3) {
            l_mm = Math.round(parseFloat(parts[0]) * 25.4);
            w_mm = Math.round(parseFloat(parts[1]) * 25.4);
            h_mm = Math.round(parseFloat(parts[2]) * 25.4);
          }
        }
        return {
          name: p.model ? `${p.name} (${p.model})` : p.name,
          brand: "",
          sku: p.model ?? "",
          qty: p.qty,
          itemType: p.type as "hardware" | "software",
          l_mm,
          w_mm,
          h_mm,
          weight_g: (p.type === "hardware" && p.weight > 0) ? Math.round(p.weight * 453.592) : undefined,
        };
      });

      if (allProducts.length > 0) {
        setValue("products", allProducts);
      }

      setUploadState("done");
      setUploadedQuoteId(`${parsed.length} items parsed (${parsed.filter(p=>p.type==="hardware").length} HW, ${parsed.filter(p=>p.type==="software").length} SW)`);
    } catch (err) {
      console.error(err);
      setUploadState("error");
    } finally {
      e.target.value = "";
    }
  };

  // Fetch dimensions for a single row
  const onFetchSingleDims = async (idx: number) => {
    const name = watch(`products.${idx}.name`) || "";
    const sku = watch(`products.${idx}.sku`) || "";
    if (!name && !sku) return;

    setFetchingDimIdx(idx);
    try {
      const result = await fetchSingleDimensions(name, sku);
      if (result) {
        // Set type
        setValue(`products.${idx}.itemType`, result.type as "hardware" | "software");

        if (result.type === "hardware") {
          // Parse dimensions
          if (result.dimensions) {
            const parts = result.dimensions.replace(/in$/i, "").trim().split(/\s*x\s*/i);
            if (parts.length === 3) {
              setValue(`products.${idx}.l_mm`, Math.round(parseFloat(parts[0]) * 25.4));
              setValue(`products.${idx}.w_mm`, Math.round(parseFloat(parts[1]) * 25.4));
              setValue(`products.${idx}.h_mm`, Math.round(parseFloat(parts[2]) * 25.4));
            }
          }
          // Set weight
          if (result.weight > 0) {
            setValue(`products.${idx}.weight_g`, Math.round(result.weight * 453.592));
          }
          // Update name with model if returned
          if (result.model && !name.includes(result.model)) {
            setValue(`products.${idx}.name`, `${result.name} (${result.model})`);
            setValue(`products.${idx}.sku`, result.model);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch dims:", err);
    } finally {
      setFetchingDimIdx(null);
    }
  };

  const buildQuotePayload = () => {
    const products = watch("products") ?? [];
    const items = products
      .filter(p => p?.name && p.qty > 0)
      .map(p => ({
        name: p.name,
        type: p.itemType || "hardware",
        qty: p.qty,
        weight_g: typeof p.weight_g === "number" ? p.weight_g : 0,
        l_mm: p.l_mm,
        w_mm: p.w_mm,
        h_mm: p.h_mm,
      }));

    return {
      items,
      origin: { country: watch("origin.country") },
      destination: { country: watch("destination.country") },
      mode: watch("mode"),
    };
  };

  const onGetPublicRates = async () => {
    setLoadingRates("public");
    setRates(null);
    setRatesMessage("");
    try {
      const result = await getPublicRates(buildQuotePayload());
      setRates(result);
    } catch (err: any) {
      setRatesMessage(err.message || "Failed to get public rates");
    } finally {
      setLoadingRates("");
    }
  };

  const onGetSpecialRates = async () => {
    setLoadingRates("special");
    setSpecialRates(null);
    setRatesMessage("");
    try {
      const result = await getSpecialRates(buildQuotePayload());
      setSpecialRates(result.rates);
      if (result.message) setRatesMessage(result.message);
    } catch (err: any) {
      setRatesMessage(err.message || "Failed to get special rates");
    } finally {
      setLoadingRates("");
    }
  };

  const allCountries = useMemo(
    () =>
      Object.entries(COUNTRY_NAMES)
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">New Quote</h1>

      <div className="grid gap-5">
        {/* Countries */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">
              Origin Country <Help text="Choose the origin country." />
            </label>
            <select className="input" value={watch("origin.country")} onChange={(e) => { setValue("origin.country", e.target.value); setValue("origin.portId", ""); }}>
              <option value="">-- Select Country --</option>
              {allCountries.map(({ code, name }) => (<option key={code} value={code}>{name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">
              Destination Country <Help text="Choose the destination country." />
            </label>
            <select className="input" value={watch("destination.country")} onChange={(e) => { setValue("destination.country", e.target.value); setValue("destination.portId", ""); }}>
              <option value="">-- Select Country --</option>
              {allCountries.map(({ code, name }) => (<option key={code} value={code}>{name}</option>))}
            </select>
          </div>
        </div>

        {/* Mode / Incoterm */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Incoterm <Help text="Trade term that defines who pays and where risk transfers." /></label>
            <select className="input" value={watch("incoterm")} onChange={(e) => setValue("incoterm", e.target.value as any)}>
              <option>EXW</option><option>FOB</option><option>CIF</option><option>CIP</option><option>DDP</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Mode <Help text="Transport type." /></label>
            <select className="input" value={watch("mode")} onChange={(e) => { setValue("mode", e.target.value as any); setValue("origin.portId", ""); setValue("destination.portId", ""); }}>
              <option>air</option><option>sea</option><option>road</option><option>courier</option>
            </select>
          </div>
        </div>

        {/* Port pickers */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">
              {mode === "air" ? "Origin Airport" : mode === "sea" ? "Origin Seaport" : "Origin Warehouse/City"}
            </label>
            <select className="input" value={watch("origin.portId") || ""} onChange={(e) => setValue("origin.portId", e.target.value)}>
              <option value="">-- Select --</option>
              {originList.map((p) => (<option key={p.id} value={p.id}>{p.name} ({COUNTRY_NAMES[p.country] ?? p.country})</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">
              {mode === "air" ? "Destination Airport" : mode === "sea" ? "Destination Seaport" : "Destination Warehouse/City"}
            </label>
            <select className="input" value={watch("destination.portId") || ""} onChange={(e) => setValue("destination.portId", e.target.value)}>
              <option value="">-- Select --</option>
              {destList.map((p) => (<option key={p.id} value={p.id}>{p.name} ({COUNTRY_NAMES[p.country] ?? p.country})</option>))}
            </select>
          </div>
        </div>

        {/* Upload Quote */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Quote Upload</div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".pdf,.csv,.xlsx,.xls,.json,.txt,.jpg,.jpeg,.png" className="hidden" onChange={onQuoteSelect} />
            <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploadState === "uploading"}>
              {uploadState === "uploading" ? "Parsing…" : "Upload Quote"}
            </button>
            {quoteFileName && <span className="text-xs opacity-70">Selected: {quoteFileName}</span>}
          </div>
        </div>
        {uploadState === "done" && uploadedQuoteId && (
          <div className="text-xs text-green-700">Uploaded ✅ {uploadedQuoteId}</div>
        )}
        {uploadState === "error" && (
          <div className="text-xs text-red-600">Upload failed. Check console.</div>
        )}

        {/* Products table */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Products</label>
            <button type="button" className="btn" onClick={() => append({ name: "", qty: 1, sku: "", itemType: "hardware" })}>
              + Add Product
            </button>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 text-xs font-medium opacity-70 px-1">
            <div className="col-span-1">Type</div>
            <div className="col-span-3">Product Name</div>
            <div className="col-span-2">SKU</div>
            <div className="col-span-1">Qty</div>
            <div className="col-span-1">Wt (g)</div>
            <div className="col-span-2">Dims (mm)</div>
            <div className="col-span-2"></div>
          </div>

          <div className="grid gap-2">
            {productFields.map((f, idx) => {
              const itemType = watch(`products.${idx}.itemType`);
              const isSW = itemType === "software";
              const hasDims = !!watch(`products.${idx}.l_mm`);
              const isFetching = fetchingDimIdx === idx;

              return (
                <div key={f.id} className={`grid grid-cols-12 gap-2 items-center ${isSW ? "opacity-60" : ""}`}>
                  {/* Type badge */}
                  <div className="col-span-1">
                    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${
                      isSW ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                           : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    }`}>{isSW ? "SW" : "HW"}</span>
                    <input type="hidden" {...register(`products.${idx}.itemType` as const)} />
                  </div>
                  {/* Product name */}
                  <input className="input col-span-3" placeholder="Product name" {...register(`products.${idx}.name` as const)} />
                  {/* SKU */}
                  <input className="input col-span-2" placeholder="SKU / Part #" {...register(`products.${idx}.sku` as const)} />
                  {/* Qty */}
                  <input className="input col-span-1" type="number" placeholder="Qty" {...register(`products.${idx}.qty` as const, { valueAsNumber: true })} />
                  {/* Weight */}
                  <input
                    className={`input col-span-1 ${isSW ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
                    type="number" placeholder={isSW ? "—" : "Wt"}
                    disabled={isSW}
                    {...register(`products.${idx}.weight_g` as const, { valueAsNumber: true })}
                  />
                  {/* Dimensions */}
                  <div className="col-span-2 text-xs">
                    {isSW ? (
                      <span className="opacity-40 italic">No shipping</span>
                    ) : hasDims ? (
                      <span className="opacity-70">
                        {watch(`products.${idx}.l_mm`)}×{watch(`products.${idx}.w_mm`)}×{watch(`products.${idx}.h_mm`)}
                      </span>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="col-span-2 flex gap-1">
                    {!isSW && !hasDims && (
                      <button
                        type="button"
                        className="px-2 py-1 text-xs rounded font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                        onClick={() => onFetchSingleDims(idx)}
                        disabled={isFetching}
                      >
                        {isFetching ? "..." : "Fetch"}
                      </button>
                    )}
                    <button type="button" className="px-2 py-1 text-xs rounded font-medium text-white bg-sky-500 hover:bg-sky-600" onClick={() => remove(idx)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {productFields.length === 0 && (
            <div className="text-sm text-center opacity-50 py-4">No products yet. Upload a quote or add products manually.</div>
          )}
        </div>

        {/* Rate Buttons */}
        <div className="flex gap-3">
          <button type="button" className="btn" onClick={onGetPublicRates} disabled={loadingRates !== ""}>
            {loadingRates === "public" ? "Loading..." : "Get Rates"}
          </button>
          <button type="button" className="px-4 py-2 rounded font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50" onClick={onGetSpecialRates} disabled={loadingRates !== ""}>
            {loadingRates === "special" ? "Loading..." : "Get Special Rates"}
          </button>
        </div>

        {ratesMessage && <div className="text-sm text-amber-600">{ratesMessage}</div>}

{/* Public Rates */}
        {rates && rates.length > 0 && (
          <div className="grid gap-3">
            <h2 className="font-medium">Public Rates</h2>
            {rates.map((r: any, i) => (
              <div key={i} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{r.carrier} – {r.service}</div>
                  <div className="text-lg font-bold">${r.price ?? r.total} {r.currency}</div>
                </div>
                <div className="text-sm opacity-80">
                  Transit: {r.transit ?? `${r.transitDays} days`}
                  {r.recommended && <span className="ml-2 text-green-600 font-medium">★ Recommended</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Special Rates */}
        {specialRates && specialRates.length > 0 && (
          <div className="grid gap-3">
            <h2 className="font-medium text-purple-700">Special Rates (Freight Forwarder)</h2>
            {specialRates.map((r: any, i) => (
              <div key={i} className="rounded border border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{r.carrier} – {r.service}</div>
                  <div className="text-lg font-bold text-purple-700 dark:text-purple-300">${r.price ?? r.total} {r.currency}</div>
                </div>
                <div className="text-sm opacity-80">
                  Transit: {r.transit ?? `${r.transitDays} days`}
                  {r.validFrom && ` · Valid: ${r.validFrom} to ${r.validTo}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
