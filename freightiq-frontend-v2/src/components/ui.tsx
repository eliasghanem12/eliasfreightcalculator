// src/components/ui.tsx — small shared pieces used by the quote page.
import type { ReactNode } from "react";
import type { Rate } from "../lib/api";
import { transitDaysOf } from "../lib/api";

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </span>
  );
}

export function TypeBadge({ type }: { type: "hardware" | "software" }) {
  const sw = type === "software";
  return (
    <span className={`badge ${sw ? "badge-sw" : "badge-hw"}`} title={sw ? "Software: no shipping" : "Hardware: ships"}>
      {sw ? "SW" : "HW"}
    </span>
  );
}

export function Notice({ kind, children }: { kind: "error" | "warn" | "ok"; children: ReactNode }) {
  return <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

export function Stage({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="stage" aria-labelledby={`stage-${n}`}>
      <div className="stage-rail"><span className="stage-dot">{n}</span><span className="stage-line" /></div>
      <div className="stage-body">
        <header className="stage-head">
          <h2 id={`stage-${n}`}>{title}</h2>
          {hint && <p>{hint}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function RateColumn({ title, tone, rates, loading, message, emptyText, onFetch, buttonLabel }: {
  title: string;
  tone: "public" | "special";
  rates: Rate[] | null;
  loading: boolean;
  message?: string;
  emptyText: string;
  onFetch: () => void;
  buttonLabel: string;
}) {
  let cheapest = -1, fastest = -1;
  if (rates && rates.length) {
    const priced = rates.map((r, i) => ({ i, p: r.price > 0 ? r.price : Infinity, d: transitDaysOf(r.transit) }));
    cheapest = priced.reduce((a, b) => (b.p < a.p ? b : a)).i;
    fastest = priced.reduce((a, b) => (b.d < a.d ? b : a)).i;
  }
  return (
    <div className={`rates-col rates-${tone}`}>
      <div className="rates-head">
        <h3>{title}</h3>
        <button type="button" className={`btn ${tone === "special" ? "btn-olive" : "btn-navy"}`} onClick={onFetch} disabled={loading}>
          {loading ? <Spinner /> : buttonLabel}
        </button>
      </div>
      {loading && <p className="rates-loading"><Spinner label={tone === "public" ? "Searching carrier rates…" : "Reading your rate sheet…"} /></p>}
      {!loading && message && <Notice kind="warn">{message}</Notice>}
      {!loading && rates && rates.length > 0 && (
        <ol className="rate-list">
          {rates.map((r, i) => (
            <li key={i} className="rate">
              <div className="rate-main">
                <div className="rate-carrier">{r.carrier}<span>{r.service}</span></div>
                <div className="rate-price"><small>{r.currency}</small>{money.format(r.price)}</div>
              </div>
              <div className="rate-meta">
                <span>Transit {r.transit}</span>
                {r.pricePerKg != null && <span>{money.format(r.pricePerKg)}/kg</span>}
                {r.validTo && <span>Valid to {r.validTo}</span>}
                {r.source === "simulated" && <span className="muted">estimate</span>}
                {i === cheapest && isFinite(r.price) && r.price > 0 && <span className="tag tag-best">Lowest price</span>}
                {i === fastest && <span className="tag tag-fast">Fastest</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {!loading && rates && rates.length === 0 && !message && <p className="empty">{emptyText}</p>}
      {!loading && rates === null && <p className="empty">{emptyText}</p>}
    </div>
  );
}
