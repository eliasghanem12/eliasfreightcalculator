// src/pages/quote/new.tsx
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteSchema, type QuoteFormValues } from "../../lib/validation";
import { useMemo, useState, useRef } from "react";
import { mockQuote, mockProductLookupByName, productsToParcels, parseQuoteFile } from "../../lib/mockApi";
import type { Rate, QuoteRequest, Parcel, Product } from "../../lib/types";
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

  const {
    register,
    handleSubmit,
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
      products: [
        { name: "Dell PowerEdge R760xs", qty: 1 },
        { name: "Dell ME5024", qty: 1 },
      ],
      parcels: [{ l_mm: 1200, w_mm: 800, h_mm: 600, weight_g: 100000 }],
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

  // Country-filtered lists only (no popular hubs, no fallbacks)
  const originList = useMemo(() => {
    const base = mode === "air" ? AIRPORTS : mode === "sea" ? SEAPORTS : WAREHOUSES;
    return byCountry(base, originCountry);
  }, [mode, originCountry]);

  const destList = useMemo(() => {
    const base = mode === "air" ? AIRPORTS : mode === "sea" ? SEAPORTS : WAREHOUSES;
    return byCountry(base, destCountry);
  }, [mode, destCountry]);

  // Upload state + handler (S3 presigned → upload)
  const [quoteFileName, setQuoteFileName] = useState<string>("");
  const [uploadState, setUploadState] = useState<"idle"|"signing"|"uploading"|"done"|"error">("idle");
  const [uploadedQuoteId, setUploadedQuoteId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onQuoteSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQuoteFileName(file.name);

    try {
      setUploadState("signing");
      const { url, quoteId } = await getUploadUrl(file);
      setUploadState("uploading");
      await putToS3Presigned(url, file);
      setUploadedQuoteId(quoteId);
      setUploadState("done");
    } catch (err) {
      console.error(err);
      setUploadState("error");
    } finally {
      // allow re-selecting the same filename
      e.target.value = "";
    }
  };

  const onAutoFetch = async () => {
    const products = [...(watch("products") ?? [])];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p?.name) continue;
      const found = await mockProductLookupByName({
        name: p.name,
        brand: p.brand,
        sku: p.sku,
      });
      products[i] = { ...p, ...found };
    }
    setValue("products", products);

    const parcels = productsToParcels(
      products.map((p) => ({
        l_mm: p.l_mm,
        w_mm: p.w_mm,
        h_mm: p.h_mm,
        weight_g: p.weight_g,
        qty: p.qty,
      }))
    );
    if (parcels.length > 0) setValue("parcels", parcels);
  };

  const onSubmit = async (data: QuoteFormValues) => {
    // Coerce parcels -> Parcel[]
    const parcels: Parcel[] = (data.parcels ?? [])
      .map(p => ({
        l_mm: p.l_mm!,
        w_mm: p.w_mm!,
        h_mm: p.h_mm!,
        weight_g: p.weight_g!,
      }))
      .filter(p =>
        [p.l_mm, p.w_mm, p.h_mm, p.weight_g].every(
          n => typeof n === "number" && !Number.isNaN(n)
        )
      );

    // Coerce products -> Product[]
    const products: Product[] = (data.products ?? [])
      .filter(p => p?.name && typeof p.qty === "number" && p.qty! > 0)
      .map(p => ({
        name: p.name!,
        qty: p.qty!,
        brand: p.brand || undefined,
        sku: p.sku || undefined,
        l_mm: typeof p.l_mm === "number" ? p.l_mm : undefined,
        w_mm: typeof p.w_mm === "number" ? p.w_mm : undefined,
        h_mm: typeof p.h_mm === "number" ? p.h_mm : undefined,
        weight_g: typeof p.weight_g === "number" ? p.weight_g : undefined,
        confidence: typeof p.confidence === "number" ? p.confidence : undefined,
        source_url: p.source_url || undefined,
      }));

    const req: QuoteRequest = {
      incoterm: data.incoterm!,
      mode: data.mode!,
      declaredValue: data.declaredValue!,
      currency: data.currency!,
      parcels,
      ...(products.length ? { products } : {}),
      origin: { country: data.origin.country!, portId: data.origin.portId || undefined },
      destination: { country: data.destination.country!, portId: data.destination.portId || undefined },
      options: data.options ?? {},
    };

    const res = await mockQuote(req);
    setRates(res);
    localStorage.setItem("lastQuote", JSON.stringify({ req, res }));
  };

  // Build a globally sorted country list from COUNTRY_NAMES
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

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        {/* Countries */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">
              Origin Country
              <Help text="Choose the origin country." />
            </label>
            <select
              className="input"
              {...register("origin.country", {
                onChange: () => setValue("origin.portId", ""),
              })}
            >
              <option value="">-- Select Country --</option>
              {allCountries.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">
              Destination Country
              <Help text="Choose the destination country." />
            </label>
            <select
              className="input"
              {...register("destination.country", {
                onChange: () => setValue("destination.portId", ""),
              })}
            >
              <option value="">-- Select Country --</option>
              {allCountries.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode / Incoterm / Declared */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">
              Incoterm
              <Help text="Trade term that defines who pays and where risk transfers (EXW/FOB/CIF/CIP/DDP)." />
            </label>
            <select className="input" {...register("incoterm")}>
              <option>EXW</option>
              <option>FOB</option>
              <option>CIF</option>
              <option>CIP</option>
              <option>DDP</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">
              Mode
              <Help text="Transport type: Air shows airports; Sea shows seaports; Road/Courier shows warehouses/cities." />
            </label>
            <select
              className="input"
              {...register("mode", {
                onChange: () => {
                  setValue("origin.portId", "");
                  setValue("destination.portId", "");
                },
              })}
            >
              <option>air</option>
              <option>sea</option>
              <option>road</option>
              <option>courier</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">
              Declared Value
            </label>
            <input
              className="input"
              type="number"
              placeholder="15000"
              {...register("declaredValue", { valueAsNumber: true })}
            />
          </div>
        </div>

        {/* Mode-based port pickers */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">
              {mode === "air"
                ? "Origin Airport"
                : mode === "sea"
                ? "Origin Seaport"
                : "Origin Warehouse/City"}
            </label>
            <select className="input" {...register("origin.portId")}>
              <option value="">-- Select --</option>
              {originList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({COUNTRY_NAMES[p.country] ?? p.country})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">
              {mode === "air"
                ? "Destination Airport"
                : mode === "sea"
                ? "Destination Seaport"
                : "Destination Warehouse/City"}
            </label>
            <select className="input" {...register("destination.portId")}>
              <option value="">-- Select --</option>
              {destList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({COUNTRY_NAMES[p.country] ?? p.country})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload Quote */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Quote Upload</div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.xlsx,.xls,.json,.txt,.jpg,.jpeg,.png"
              className="hidden"
              onChange={onQuoteSelect}
            />
            <button
              type="button"
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload a quote file"
              disabled={uploadState === "signing" || uploadState === "uploading"}
            >
              {uploadState === "signing"
                ? "Preparing…"
                : uploadState === "uploading"
                ? "Uploading…"
                : "Upload Quote"}
            </button>
            {quoteFileName && (
              <span className="text-xs opacity-70">Selected: {quoteFileName}</span>
            )}
          </div>
        </div>
        {uploadState === "done" && uploadedQuoteId && (
          <div className="text-xs text-green-700">
            Uploaded ✅ Quote ID: <code>{uploadedQuoteId}</code>
          </div>
        )}
        {uploadState === "error" && (
          <div className="text-xs text-red-600">Upload failed. Check console.</div>
        )}

        {/* Products table */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Products
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => append({ name: "", qty: 1 })}
              >
                Add Row
              </button>
              <button type="button" className="btn" onClick={onAutoFetch}>
                Auto-Fetch
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            {productFields.map((f, idx) => (
              <div key={f.id} className="grid grid-cols-8 gap-2">
                <input
                  className="input col-span-3"
                  placeholder="Product name"
                  {...register(`products.${idx}.name` as const)}
                />
                <input
                  className="input"
                  placeholder="Brand (opt)"
                  {...register(`products.${idx}.brand` as const)}
                />
                <input
                  className="input"
                  placeholder="SKU (opt)"
                  {...register(`products.${idx}.sku` as const)}
                />
                <input
                  className="input"
                  type="number"
                  placeholder="Qty"
                  {...register(`products.${idx}.qty` as const, {
                    valueAsNumber: true,
                  })}
                />
                <button
                  type="button"
                  className="btn col-span-1"
                  onClick={() => remove(idx)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs opacity-70">
            After Auto-Fetch, the system converts products to parcels (1 per unit) for the quote.
          </p>
        </div>

        {/* Parcels quick view */}
        <div>
          <label className="text-sm font-medium">
            Parcels (computed)
          </label>
          <pre className="text-xs p-3 rounded border bg-white dark:bg-neutral-800 overflow-auto">
            {JSON.stringify(watch("parcels"), null, 2)}
          </pre>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" className="btn">
            Get Rates
          </button>
        </div>

        {Object.keys(errors).length > 0 && (
          <pre className="text-xs text-red-600">
            {JSON.stringify(errors, null, 2)}
          </pre>
        )}
      </form>

      {/* Results */}
      {rates && (
        <div className="grid gap-3">
          <h2 className="font-medium">Results</h2>
          {rates.map((r, i) => (
            <div key={i} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {r.carrier} – {r.service}
                </div>
                <div className="text-lg">
                  {r.total} {r.currency}
                </div>
              </div>
              <div className="text-sm opacity-80">
                Transit: {r.transitDays} days
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
