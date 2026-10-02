// src/pages/admin/index.tsx — Settings: manage locations stored in S3 through the API.
import { useMemo, useState } from "react";
import { saveLocations, type LocationsDoc, type Place, type Country } from "../../lib/api";
import { useLocations } from "../../lib/useLocations";
import { Notice, Spinner } from "../../components/ui";

type ListKey = "airports" | "seaports" | "warehouses";
const LISTS: { key: ListKey; label: string; idHint: string }[] = [
  { key: "airports", label: "Airports", idHint: "IATA code, e.g. DXB" },
  { key: "seaports", label: "Seaports", idHint: "UN/LOCODE, e.g. AEJEA" },
  { key: "warehouses", label: "Warehouses / cities", idHint: "Any unique id, e.g. AE-DXB-WH1" },
];

export default function Admin() {
  const api = import.meta.env.VITE_API_URL ?? "(not set)";
  const { doc, setDoc, source, error, reload } = useLocations();
  const [tab, setTab] = useState<"countries" | ListKey>("seaports");
  const [filter, setFilter] = useState("");
  const [adminKey, setAdminKey] = useState<string>(() => localStorage.getItem("freightiq.adminKey") ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const countries = useMemo(() => [...doc.countries].sort((a, b) => a.name.localeCompare(b.name)), [doc]);
  const cname = (code: string) => doc.countries.find((c) => c.code === code)?.name ?? code;

  const update = (next: LocationsDoc) => { setDoc(next); setDirty(true); setMsg(null); };

  // ── places ──
  const [draft, setDraft] = useState<Place>({ id: "", name: "", country: "AE", city: "" });
  const addPlace = (key: ListKey) => {
    const id = draft.id.trim().toUpperCase(), name = draft.name.trim();
    if (!id || !name || !draft.country) { setMsg({ kind: "error", text: "Id, name and country are required." }); return; }
    const all = [...doc.airports, ...doc.seaports, ...doc.warehouses];
    if (all.some((p) => p.id === id)) { setMsg({ kind: "error", text: `Id ${id} already exists.` }); return; }
    update({ ...doc, [key]: [...doc[key], { id, name, country: draft.country, city: draft.city?.trim() || undefined }] });
    setDraft({ id: "", name: "", country: draft.country, city: "" });
  };
  const removePlace = (key: ListKey, id: string) => update({ ...doc, [key]: doc[key].filter((p) => p.id !== id) });

  // ── countries ──
  const [cDraft, setCDraft] = useState<Country>({ code: "", name: "" });
  const addCountry = () => {
    const code = cDraft.code.trim().toUpperCase(), name = cDraft.name.trim();
    if (!/^[A-Z]{2}$/.test(code) || !name) { setMsg({ kind: "error", text: "Country needs a 2-letter code and a name." }); return; }
    if (doc.countries.some((c) => c.code === code)) { setMsg({ kind: "error", text: `${code} already exists.` }); return; }
    update({ ...doc, countries: [...doc.countries, { code, name }] });
    setCDraft({ code: "", name: "" });
  };
  const removeCountry = (code: string) => {
    const used = [...doc.airports, ...doc.seaports, ...doc.warehouses].filter((p) => p.country === code).length;
    if (used) { setMsg({ kind: "error", text: `${cname(code)} still has ${used} location${used === 1 ? "" : "s"}. Remove them first.` }); return; }
    update({ ...doc, countries: doc.countries.filter((c) => c.code !== code) });
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      localStorage.setItem("freightiq.adminKey", adminKey);
      const saved = await saveLocations(doc, adminKey);
      setDoc(saved); setDirty(false);
      setMsg({ kind: "ok", text: `Saved. ${saved.countries.length} countries, ${saved.airports.length} airports, ${saved.seaports.length} seaports, ${saved.warehouses.length} warehouses.` });
    } catch (e: any) { setMsg({ kind: "error", text: e?.message || "Save failed." }); }
    finally { setSaving(false); }
  };

  const q = filter.trim().toLowerCase();
  const rows = tab === "countries" ? [] : doc[tab].filter((p) => !q || p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || cname(p.country).toLowerCase().includes(q));
  const crows = tab === "countries" ? countries.filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : [];

  return (
    <div className="page">
      <div className="page-head"><h1>Settings</h1><p>Locations used in the route picker. Changes apply to everyone once saved.</p></div>

      {source === "bundled" && <Notice kind="warn">Showing the built-in list because the locations API did not answer{error ? `: ${error}` : ""}. Saving will still try the API. <button className="link" type="button" onClick={reload}>Retry</button></Notice>}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <div className="stage-body">
        <div className="toolbar">
          <div className="seg" role="tablist">
            <button type="button" className={tab === "countries" ? "on" : ""} onClick={() => setTab("countries")}>Countries ({doc.countries.length})</button>
            {LISTS.map((l) => <button key={l.key} type="button" className={tab === l.key ? "on" : ""} onClick={() => setTab(l.key)}>{l.label} ({doc[l.key].length})</button>)}
          </div>
          <input className="cell" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 220 }} />
        </div>

        {tab === "countries" ? (
          <>
            <div className="toolbar">
              <input className="cell mono" placeholder="Code (e.g. KE)" maxLength={2} value={cDraft.code} onChange={(e) => setCDraft({ ...cDraft, code: e.target.value })} style={{ width: 130 }} />
              <input className="cell" placeholder="Country name" value={cDraft.name} onChange={(e) => setCDraft({ ...cDraft, name: e.target.value })} style={{ width: 260 }} />
              <button type="button" className="btn btn-ghost" onClick={addCountry}>Add country</button>
            </div>
            <div className="table-wrap"><table className="history">
              <thead><tr><th>Code</th><th>Name</th><th className="r">Locations</th><th></th></tr></thead>
              <tbody>{crows.map((c) => {
                const n = [...doc.airports, ...doc.seaports, ...doc.warehouses].filter((p) => p.country === c.code).length;
                return <tr key={c.code}><td className="mono">{c.code}</td><td>{c.name}</td><td className="r">{n}</td><td className="r"><button type="button" className="btn btn-small btn-ghost" onClick={() => removeCountry(c.code)}>Remove</button></td></tr>;
              })}</tbody>
            </table></div>
          </>
        ) : (
          <>
            <div className="toolbar">
              <input className="cell mono" placeholder={LISTS.find((l) => l.key === tab)?.idHint} value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} style={{ width: 180 }} />
              <input className="cell" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: 260 }} />
              <select value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} style={{ width: 220 }}>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              <input className="cell" placeholder="City (optional)" value={draft.city ?? ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} style={{ width: 160 }} />
              <button type="button" className="btn btn-ghost" onClick={() => addPlace(tab)}>Add</button>
            </div>
            <div className="table-wrap"><table className="history">
              <thead><tr><th>Id</th><th>Name</th><th>Country</th><th>City</th><th></th></tr></thead>
              <tbody>{rows.map((p) => (
                <tr key={p.id}><td className="mono">{p.id}</td><td>{p.name}</td><td>{cname(p.country)}</td><td className="muted">{p.city ?? ""}</td>
                  <td className="r"><button type="button" className="btn btn-small btn-ghost" onClick={() => removePlace(tab, p.id)}>Remove</button></td></tr>
              ))}</tbody>
            </table></div>
            {rows.length === 0 && <p className="empty">Nothing here yet. Add the first one above.</p>}
          </>
        )}

        <div className="toolbar" style={{ marginTop: 16, justifyContent: "space-between" }}>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span>Admin key</span>
            <input className="cell" type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="from Secrets Manager" style={{ width: 240 }} />
          </label>
          <button type="button" className="btn btn-navy" onClick={save} disabled={saving || !dirty}>{saving ? <Spinner label="Saving…" /> : dirty ? "Save changes" : "Saved"}</button>
        </div>
      </div>

      <dl className="settings" style={{ marginTop: 18 }}>
        <dt>Backend API</dt><dd className="mono">{api}</dd>
        <dt>Locations file</dt><dd>S3 <span className="mono">freightiq-locations/locations.json</span>{doc.updatedAt ? `, last saved ${new Date(doc.updatedAt).toLocaleString()}` : ""}</dd>
        <dt>Negotiated rate sheet</dt><dd>S3 <span className="mono">freightiq-special-rates/rates/current.csv</span>. Upload a new CSV with the same columns to replace it.</dd>
        <dt>SKU dimension cache</dt><dd>S3 <span className="mono">freightiq-dimensions-cache</span>. Delete a SKU's file to force a fresh lookup.</dd>
      </dl>
    </div>
  );
}
