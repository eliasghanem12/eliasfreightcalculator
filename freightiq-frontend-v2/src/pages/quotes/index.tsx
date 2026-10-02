import { useState } from "react";
import { loadHistory, deleteQuote, clearHistory, type SavedQuote } from "../../lib/history";
import { COUNTRY_NAMES } from "../../lib/locations";

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const best = (rs: SavedQuote["publicRates"]) => rs.filter((r) => r.price > 0).sort((a, b) => a.price - b.price)[0];

export default function QuotesIndex() {
  const [items, setItems] = useState<SavedQuote[]>(loadHistory());
  const refresh = () => setItems(loadHistory());
  return (
    <div className="page">
      <div className="page-head">
        <h1>Quote history</h1>
        <p>Every rate request is saved in this browser. {items.length > 0 && <button type="button" className="link" onClick={() => { clearHistory(); refresh(); }}>Clear all</button>}</p>
      </div>
      {items.length === 0 ? (
        <div className="empty-box"><strong>No quotes yet.</strong><span>Rates you fetch on the New quote page will appear here.</span></div>
      ) : (
        <div className="table-wrap">
          <table className="history">
            <thead><tr><th>When</th><th>Lane</th><th>Mode</th><th>File</th><th className="r">HW / SW</th><th className="r">Weight kg</th><th className="r">Best carrier</th><th className="r">Best negotiated</th><th></th></tr></thead>
            <tbody>
              {items.map((q) => {
                const bp = best(q.publicRates), bs = best(q.specialRates);
                return (
                  <tr key={q.id}>
                    <td>{when(q.savedAt)}</td>
                    <td>{COUNTRY_NAMES[q.origin] ?? q.origin} → {COUNTRY_NAMES[q.destination] ?? q.destination}</td>
                    <td>{q.mode} · {q.incoterm}</td>
                    <td className="muted">{q.fileName || "manual"}</td>
                    <td className="r">{q.hwItems} / {q.swItems}</td>
                    <td className="r">{q.totalWeightKg}</td>
                    <td className="r">{bp ? `${bp.carrier} ${money.format(bp.price)} ${bp.currency}` : "—"}</td>
                    <td className="r olive">{bs ? `${bs.carrier} ${money.format(bs.price)} ${bs.currency}` : "—"}</td>
                    <td><button type="button" className="btn btn-small btn-ghost" onClick={() => { deleteQuote(q.id); refresh(); }}>Delete</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
