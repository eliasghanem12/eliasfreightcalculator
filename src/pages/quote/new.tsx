// src/pages/quote/new.tsx — Route → Products → Rates, in that order.
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import type { QuoteFormValues, ProductRow } from "../../lib/validation";
import {
  parseQuoteFile, fetchSingleDimensions, getPublicRates, getSpecialRates,
  inchesToMm, lbsToGrams, type Rate, type RatesResponse, type QuoteRequestPayload,
} from "../../lib/api";
import { saveQuote } from "../../lib/history";
import { palletise, type PackagingMode } from "../../lib/packaging";
import { useLocations, countryName } from "../../lib/useLocations";
import { Stage, Spinner, TypeBadge, Notice, RateColumn, TrustBadge } from "../../components/ui";

const INCOTERMS = ["EXW", "FOB", "CIF", "CIP", "DDP"] as const;
const MODES = ["air", "sea", "road", "courier"] as const;
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export default function QuoteNew() {
  const [packaging, setPackaging] = useState<PackagingMode>("loose");
  const [declared, setDeclared] = useState<string>("");
  const { register, setValue, watch, control } = useForm<QuoteFormValues>({
    defaultValues: { origin: { country: "AE" }, destination: { country: "RW" }, incoterm: "CIP", mode: "sea", products: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "products" });

  const mode = watch("mode");
  const incoterm = watch("incoterm");
  const originCountry = watch("origin.country");
  const destCountry = watch("destination.country");
  const products = watch("products") ?? [];

  const { doc: loc } = useLocations();
  const portList = (c: string) => (mode === "air" ? loc.airports : mode === "sea" ? loc.seaports : loc.warehouses).filter((p) => p.country === c);
  const originPorts = useMemo(() => portList(originCountry), [mode, originCountry, loc]);
  const destPorts = useMemo(() => portList(destCountry), [mode, destCountry, loc]);
  const countries = useMemo(() => [...loc.countries].sort((a, b) => a.name.localeCompare(b.name)), [loc]);
  const portLabel = mode === "air" ? "airport" : mode === "sea" ? "seaport" : "warehouse or city";

  // ── Upload ──────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [uploadMsg, setUploadMsg] = useState("");

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadStatus("busy"); setUploadMsg("");
    resetRates();
    try {
      const parsed = await parseQuoteFile(file);
      const rows: ProductRow[] = parsed.map((p) => ({
        name: p.name,
        sku: p.model ?? "",
        qty: p.qty,
        itemType: p.type,
        ...(p.type === "hardware" ? inchesToMm(p.dimensions) : {}),
        weight_g: p.type === "hardware" && p.weight > 0 ? lbsToGrams(p.weight) : undefined,
        dimSource: p.dimSource ?? undefined,
      }));
      setValue("products", rows);
      const hw = rows.filter((r) => r.itemType === "hardware").length;
      setUploadStatus("done");
      setUploadMsg(`${rows.length} line${rows.length === 1 ? "" : "s"} read: ${hw} hardware, ${rows.length - hw} software.`);
    } catch (err: any) {
      setUploadStatus("error");
      setUploadMsg(err?.message || "The file could not be read.");
    } finally {
      e.target.value = "";
    }
  };

  // ── Per-row dimension lookup ────────────────────────────────────
  const [fetchingIdx, setFetchingIdx] = useState<number | null>(null);
  const [rowErr, setRowErr] = useState<Record<number, string>>({});
  const fetchDims = async (idx: number) => {
    const name = watch(`products.${idx}.name`) || "";
    const sku = watch(`products.${idx}.sku`) || "";
    if (!name && !sku) { setRowErr((e) => ({ ...e, [idx]: "Enter a product name or SKU first." })); return; }
    setFetchingIdx(idx); setRowErr((e) => ({ ...e, [idx]: "" }));
    try {
      const r = await fetchSingleDimensions(name, sku);
      if (!r) throw new Error("No result.");
      setValue(`products.${idx}.itemType`, r.type);
      if (r.type === "hardware") {
        const mm = inchesToMm(r.dimensions);
        if (mm.l_mm) { setValue(`products.${idx}.l_mm`, mm.l_mm); setValue(`products.${idx}.w_mm`, mm.w_mm); setValue(`products.${idx}.h_mm`, mm.h_mm); }
        if (r.weight > 0) setValue(`products.${idx}.weight_g`, lbsToGrams(r.weight));
        setValue(`products.${idx}.dimSource`, r.dimSource ?? undefined);
        setValue(`products.${idx}.trust`, r.trust ?? undefined);
        setValue(`products.${idx}.basis`, r.basis ?? undefined);
        setValue(`products.${idx}.source`, r.source ?? undefined);
        if (r.model && !sku) setValue(`products.${idx}.sku`, r.model);
      }
    } catch (err: any) {
      setRowErr((e) => ({ ...e, [idx]: err?.message || "Lookup failed." }));
    } finally { setFetchingIdx(null); }
  };

  // ── Totals ──────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const hw = products.filter((p) => p.itemType !== "software");
    const units = hw.reduce((s, p) => s + (p.qty || 0), 0);
    const cartons = hw.map((p) => ({ l_mm: p.l_mm || 0, w_mm: p.w_mm || 0, h_mm: p.h_mm || 0, weight_g: p.weight_g || 0, qty: p.qty || 0 }));
    const cartonKg = cartons.reduce((s, c) => s + (c.weight_g / 1000) * c.qty, 0);
    const cartonM3 = cartons.reduce((s, c) => s + (c.l_mm * c.w_mm * c.h_mm / 1e9) * c.qty, 0);
    const pallets = packaging === "pallet" ? palletise(cartons) : [];
    const kg = pallets.length ? pallets.reduce((s, p) => s + (p.weight_g / 1000) * p.qty, 0) : cartonKg;
    const m3 = pallets.length ? pallets.reduce((s, p) => s + (p.l_mm * p.w_mm * p.h_mm / 1e9) * p.qty, 0) : cartonM3;
    const volKg = m3 * (mode === "air" || mode === "courier" ? 167 : mode === "road" ? 333 : 1000);
    const missing = hw.filter((p) => !p.weight_g || !p.l_mm).length;
    const chargeableKg = mode === "sea" ? Math.max(kg, volKg, 1000) : Math.max(kg, volKg);
    return { hwLines: hw.length, swLines: products.length - hw.length, units, kg, m3, cartonKg, cartonM3, pallets, chargeableKg, missing, seaMin: mode === "sea" && Math.max(kg, volKg) < 1000 };
  }, [products, mode, packaging]);

  // ── Rates ───────────────────────────────────────────────────────
  const [pub, setPub] = useState<RatesResponse | null>(null);
  const [spc, setSpc] = useState<RatesResponse | null>(null);
  const [loading, setLoading] = useState<"" | "public" | "special">("");
  const [rateErr, setRateErr] = useState("");
  const resetRates = () => { setPub(null); setSpc(null); setRateErr(""); };

  const payload = (): QuoteRequestPayload => ({
    items: products.filter((p) => p.name && p.qty > 0).map((p) => ({
      name: p.name, type: p.itemType, qty: p.qty, weight_g: p.weight_g ?? 0, l_mm: p.l_mm, w_mm: p.w_mm, h_mm: p.h_mm,
    })),
    origin: { country: originCountry, portId: watch("origin.portId") || undefined },
    destination: { country: destCountry, portId: watch("destination.portId") || undefined },
    mode, incoterm,
  });

  const canQuote = totals.hwLines > 0 && !!originCountry && !!destCountry;

  const fetchRates = async (kind: "public" | "special") => {
    if (!canQuote) { setRateErr("Add at least one hardware line and choose both countries before getting rates."); return; }
    setLoading(kind); setRateErr("");
    try {
      const res = kind === "public" ? await getPublicRates(payload()) : await getSpecialRates(payload());
      if (kind === "public") setPub(res); else setSpc(res);
      saveQuote({
        fileName, origin: originCountry, destination: destCountry, mode, incoterm,
        hwItems: totals.hwLines, swItems: totals.swLines, totalWeightKg: Math.round(totals.kg * 10) / 10,
        publicRates: kind === "public" ? res.rates : pub?.rates ?? [],
        specialRates: kind === "special" ? res.rates : spc?.rates ?? [],
      });
    } catch (err: any) {
      setRateErr(err?.message || "Rates could not be fetched.");
    } finally { setLoading(""); }
  };

  const addRow = () => append({ name: "", sku: "", qty: 1, itemType: "hardware" } as ProductRow);

  // Incoterm or mode changed after rates were fetched: refresh them so prices follow the selection.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (pub) fetchRates("public");
    if (spc) fetchRates("special");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoterm, mode, packaging]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>New quote</h1>
        <p>Upload a supplier quotation, confirm what ships, then compare carrier rates with your negotiated rates.</p>
      </div>

      {/* ── 1. Route ────────────────────────────────────────────── */}
      <Stage n={1} title="Route" hint="Where it ships from and to, how, and on which incoterm.">
        <div className="grid2">
          <label className="field">
            <span>Origin country</span>
            <select {...register("origin.country", { onChange: () => setValue("origin.portId", "") })}>
              <option value="">Choose a country</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Destination country</span>
            <select {...register("destination.country", { onChange: () => setValue("destination.portId", "") })}>
              <option value="">Choose a country</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Origin {portLabel}</span>
            <select {...register("origin.portId")}>
              <option value="">Any</option>
              {originPorts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Destination {portLabel}</span>
            <select {...register("destination.portId")}>
              <option value="">Any</option>
              {destPorts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <div className="seg-row">
          <div className="seg" role="radiogroup" aria-label="Transport mode">
            {MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""}
                onClick={() => { setValue("mode", m); setValue("origin.portId", ""); setValue("destination.portId", ""); }}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <label className="field field-inline">
            <span>Cargo value USD</span>
            <input className="cell num" type="number" min={0} placeholder="for insurance and duties" value={declared} onChange={(e) => setDeclared(e.target.value)} style={{ width: 160 }} />
          </label>
          <div className="seg" role="radiogroup" aria-label="Incoterm">
            {INCOTERMS.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={incoterm === t} className={incoterm === t ? "on" : ""} onClick={() => setValue("incoterm", t)}>{t}</button>
            ))}
          </div>
        </div>
      </Stage>

      {/* ── 2. Products ─────────────────────────────────────────── */}
      <Stage n={2} title="Products" hint="Software lines are kept for reference but never shipped. Dimensions come from the manufacturer spec where found, otherwise an estimate you can edit.">
        <div className="toolbar">
          <input ref={fileRef} type="file" className="sr-only" accept=".pdf,.csv,.xlsx,.xls,.txt,.jpg,.jpeg,.png,.webp" onChange={onFile} />
          <button type="button" className="btn btn-navy" onClick={() => fileRef.current?.click()} disabled={uploadStatus === "busy"}>
            {uploadStatus === "busy" ? <Spinner label="Reading quotation…" /> : "Upload quotation"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={addRow}>Add a product</button>
          <div className="seg" role="radiogroup" aria-label="Packaging">
            <button type="button" role="radio" aria-checked={packaging === "loose"} className={packaging === "loose" ? "on" : ""} onClick={() => setPackaging("loose")}>Loose cartons</button>
            <button type="button" role="radio" aria-checked={packaging === "pallet"} className={packaging === "pallet" ? "on" : ""} onClick={() => setPackaging("pallet")}>Palletised</button>
          </div>
          {fileName && <span className="file-name">{fileName}</span>}
        </div>
        {uploadStatus === "done" && <Notice kind="ok">{uploadMsg}</Notice>}
        {uploadStatus === "error" && <Notice kind="error">Upload failed: {uploadMsg}</Notice>}

        {fields.length === 0 ? (
          <div className="empty-box">
            <strong>No products yet.</strong>
            <span>Upload a Dell, Lenovo or HP quotation as Excel, PDF or a screenshot, or add products one by one.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="products">
              <thead>
                <tr><th>Type</th><th>Product</th><th>SKU</th><th className="r">Qty</th><th className="r">Packed kg/unit</th><th>Packed L × W × H mm</th><th></th></tr>
              </thead>
              <tbody>
                {fields.map((f, i) => {
                  const row = products[i] ?? ({} as ProductRow);
                  const sw = row.itemType === "software";
                  const hasDims = !!row.l_mm;
                  return (
                    <tr key={f.id} className={sw ? "sw" : ""}>
                      <td>
                        <TypeBadge type={sw ? "software" : "hardware"} />
                        <input type="hidden" {...register(`products.${i}.itemType` as const)} />
                      </td>
                      <td><input className="cell" placeholder="Product name" {...register(`products.${i}.name` as const)} /></td>
                      <td><input className="cell mono" placeholder="Part number" {...register(`products.${i}.sku` as const)} /></td>
                      <td className="r"><input className="cell num" type="number" min={1} {...register(`products.${i}.qty` as const, { valueAsNumber: true })} /></td>
                      <td className="r">
                        {sw ? <span className="muted">—</span> : (
                          <input className="cell num" type="number" step="0.1" min={0} placeholder="0.0"
                            value={row.weight_g != null ? (row.weight_g / 1000).toFixed(1) : ""}
                            onChange={(e) => setValue(`products.${i}.weight_g`, e.target.value === "" ? undefined : Math.round(parseFloat(e.target.value) * 1000))} />
                        )}
                      </td>
                      <td className="dims">
                        {sw ? <span className="muted">No shipping</span> : hasDims ? (
                          <span className="mono">{row.l_mm} × {row.w_mm} × {row.h_mm} <TrustBadge trust={row.trust ?? (row.dimSource === "fallback" ? "estimated" : undefined)} basis={row.basis} source={row.source} /></span>
                        ) : <span className="muted">—</span>}
                        {rowErr[i] && <div className="row-err">{rowErr[i]}</div>}
                      </td>
                      <td className="actions">
                        {!sw && !hasDims && (
                          <button type="button" className="btn btn-small btn-olive" onClick={() => fetchDims(i)} disabled={fetchingIdx === i}>
                            {fetchingIdx === i ? <Spinner /> : "Look up"}
                          </button>
                        )}
                        <button type="button" className="btn btn-small btn-ghost" onClick={() => { remove(i); resetRates(); }} aria-label={`Remove ${row.name || "row"}`}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>{totals.hwLines} hardware line{totals.hwLines === 1 ? "" : "s"} · {totals.swLines} software</td>
                  <td className="r">{totals.units}</td>
                  <td className="r">{num.format(totals.kg)} kg</td>
                  <td colSpan={2}>
                    {totals.pallets.length > 0 && <span>{totals.pallets[0].qty} pallet{totals.pallets[0].qty === 1 ? "" : "s"} {totals.pallets[0].l_mm}×{totals.pallets[0].w_mm}×{totals.pallets[0].h_mm}, {num.format(totals.pallets[0].weight_g / 1000)} kg each · </span>}{totals.m3.toFixed(3)} m³ · chargeable {num.format(totals.chargeableKg)} kg ({mode === "air" || mode === "courier" ? "167 kg/m³" : mode === "road" ? "333 kg/m³" : "W/M, min 1 CBM"}){totals.seaMin && <span className="muted"> · below the 1 CBM minimum</span>}
                    {totals.missing > 0 && <span className="warn"> · {totals.missing} line{totals.missing === 1 ? "" : "s"} missing weight or size</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Stage>

      {/* ── 3. Rates ────────────────────────────────────────────── */}
      <Stage n={3} title="Rates" hint={`${countryName(loc, originCountry)} → ${countryName(loc, destCountry)}, ${mode}, ${incoterm}. Chargeable weight ${num.format(totals.chargeableKg)} kg.`}>
        {rateErr && <Notice kind="error">{rateErr}</Notice>}
        <div className="rates-grid">
          <RateColumn
            title="Indicative estimate" tone="public" buttonLabel="Get indicative rates"
            rates={pub?.rates ?? null} loading={loading === "public"} message={pub?.message}
            emptyText="Indicative only. A carrier or forwarder quote is required before booking."
            onFetch={() => fetchRates("public")} />
          <RateColumn
            title="Your negotiated rates" tone="special" buttonLabel="Get negotiated rates"
            rates={spc?.rates ?? null} loading={loading === "special"} message={spc?.message}
            emptyText="Rates from your freight forwarder's monthly rate sheet."
            onFetch={() => fetchRates("special")} />
        </div>
      </Stage>
    </div>
  );
}
