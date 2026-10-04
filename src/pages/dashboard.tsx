// src/pages/dashboard.tsx — admin view of usage and feedback.
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { getAdminStats, type AdminStats } from "../lib/api";
import { Notice, Spinner } from "../components/ui";

const NAVY = "#164C82", OLIVE = "#809725", MID = "#54A4E2", WARN = "#D99A1A", RED = "#A32D2D", GREY = "#B9C2CE";
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = (v: number | null | undefined) => v == null ? "—" : v < 0.01 ? `$${v.toFixed(4)}` : v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`;
const tok = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : String(v);
const short = (m: string) => m.replace(/^(us|global)\./, "").replace(/-\d{8}-v\d:\d$/, "");
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="kpi"><div className="kpi-v">{value}</div><div className="kpi-l">{label}</div>{hint && <div className="kpi-h">{hint}</div>}</div>;
}
function Card({ title, children, span }: { title: string; children: React.ReactNode; span?: number }) {
  return <section className="dcard" style={span ? { gridColumn: `span ${span}` } : undefined}><h3>{title}</h3>{children}</section>;
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AdminStats | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); setErr("");
    getAdminStats(days).then(setData).catch((e) => setErr(e?.message || "Could not load")).finally(() => setLoading(false));
  }, [days]);

  if (err) return <div className="page"><div className="page-head"><h1>Dashboard</h1></div><Notice kind="error">{err.includes("403") || /admin/i.test(err) ? "This page is for administrators. Ask an admin to add you to the admin group." : err}</Notice></div>;
  if (loading || !data) return <div className="page"><div className="page-head"><h1>Dashboard</h1></div><Spinner label="Loading usage and feedback…" /></div>;

  const k = data.kpis;
  const trustData = [{ name: "Verified", value: data.trust.verified, c: OLIVE }, { name: "Checked", value: data.trust.checked, c: NAVY }, { name: "Estimated", value: data.trust.estimated, c: WARN }];

  return (
    <div className="page page-wide">
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div><h1>Dashboard</h1><p>What people are quoting and how accurate they say it is.</p></div>
        <div className="seg" role="radiogroup" aria-label="Period">
          {[7, 30, 90, 365].map((d) => <button key={d} type="button" className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d === 365 ? "1 year" : `${d} days`}</button>)}
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Quotes" value={fmt.format(k.quotes)} hint={`${k.hwLines} hardware · ${k.swLines} software lines`} />
        <Kpi label="Active users" value={fmt.format(k.users)} />
        <Kpi label="Satisfaction" value={k.satisfaction == null ? "—" : `${k.satisfaction}%`} hint={`${k.feedback} feedback item${k.feedback === 1 ? "" : "s"}`} />
        <Kpi label="Dimensions with a source" value={k.verifiedRate == null ? "—" : `${k.verifiedRate}%`} hint="verified or checked, not estimated" />
        <Kpi label="Avg shipment" value={`${fmt.format(k.avgWeightKg)} kg`} />
        <Kpi label="Used negotiated rates" value={k.quotes ? `${Math.round(100 * k.withNegotiated / k.quotes)}%` : "—"} />
        <Kpi label="AI spend (Bedrock)" value={usd(data.ai?.total.cost)} hint={`${tok(data.ai?.total.tokIn ?? 0)} in · ${tok(data.ai?.total.tokOut ?? 0)} out · ${data.ai?.total.calls ?? 0} calls`} />
        <Kpi label="AI cost per quote" value={usd(data.ai?.total.costPerQuote)} hint="list price, on-demand" />
      </div>

      <div className="dgrid">
        <Card title="Quotes per day" span={2}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.series}><CartesianGrid strokeDasharray="3 3" stroke="#EAEEF2" /><XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="quotes" fill={NAVY} radius={[3, 3, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Feedback per day">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.series}><CartesianGrid strokeDasharray="3 3" stroke="#EAEEF2" /><XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="up" name="👍" stackId="a" fill={OLIVE} /><Bar dataKey="down" name="👎" stackId="a" fill={RED} /></BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Feedback by area">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.feedbackByCategory} layout="vertical"><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Bar dataKey="up" name="👍" stackId="a" fill={OLIVE} /><Bar dataKey="down" name="👎" stackId="a" fill={RED} /></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Dimension trust mix">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={trustData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>{trustData.map((t) => <Cell key={t.name} fill={t.c} />)}</Pie><Tooltip /><Legend /></PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="By mode">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byMode}><XAxis dataKey="key" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill={MID} radius={[3, 3, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top lanes" span={2}>
          <ResponsiveContainer width="100%" height={Math.max(160, 28 * data.byLane.length)}>
            <BarChart data={data.byLane} layout="vertical"><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="key" width={180} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="count" fill={NAVY} radius={[0, 3, 3, 0]} /></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="By user">
          <table className="history"><tbody>{data.byUser.map((u) => <tr key={u.key}><td>{u.key}</td><td className="r">{u.count}</td></tr>)}</tbody></table>
          <div className="dsmall">Files: {data.byFile.map((f) => `${f.key} ${f.count}`).join(" · ")} · Incoterms: {data.byIncoterm.map((f) => `${f.key} ${f.count}`).join(" · ")}</div>
          <div className="dsmall">Engines: {data.engines.map((f) => `${f.key} ${f.count}`).join(" · ")}</div>
        </Card>

        <Card title="AI spend by user (FinOps)" span={2}>
          <div className="table-wrap"><table className="history">
            <thead><tr><th>User</th><th className="r">Quotes</th><th className="r">AI requests</th><th className="r">Model calls</th><th className="r">Tokens in</th><th className="r">Tokens out</th><th className="r">Cost</th><th className="r">Per quote</th></tr></thead>
            <tbody>{(data.ai?.byUser ?? []).map((u) => (
              <tr key={u.user}><td>{u.user}</td><td className="r">{u.quotes}</td><td className="r">{u.requests}</td><td className="r">{u.calls}</td><td className="r">{tok(u.tokIn)}</td><td className="r">{tok(u.tokOut)}</td><td className="r"><strong>{usd(u.cost)}</strong></td><td className="r">{usd(u.costPerQuote)}</td></tr>
            ))}</tbody>
          </table></div>
          <div className="dsmall">{data.ai?.note}</div>
        </Card>
        <Card title="AI spend by model">
          <table className="history"><thead><tr><th>Model</th><th className="r">Calls</th><th className="r">Cost</th></tr></thead>
            <tbody>{(data.ai?.byModel ?? []).map((m) => <tr key={m.model}><td className="mono" style={{ fontSize: 12 }}>{short(m.model)}</td><td className="r">{m.calls}</td><td className="r">{usd(m.cost)}</td></tr>)}</tbody></table>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.series}><XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => usd(v)} /><Bar dataKey="cost" name="USD" fill={OLIVE} /></BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Recent feedback" span={3}>
          {data.recentFeedback.length === 0 ? <p className="empty">No feedback yet.</p> : (
            <div className="table-wrap"><table className="history">
              <thead><tr><th>When</th><th>User</th><th></th><th>Area</th><th>Lane</th><th>Comment</th></tr></thead>
              <tbody>{data.recentFeedback.map((f, i) => (
                <tr key={i}><td>{when(f.ts)}</td><td>{f.user}</td><td style={{ fontSize: 16 }}>{f.thumbs === "up" ? "👍" : "👎"}</td><td>{f.category}</td><td className="muted">{f.lane} · {f.mode}</td><td>{f.comment || <span className="muted">—</span>}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>

        <Card title="Recent quotes" span={3}>
          <div className="table-wrap"><table className="history">
            <thead><tr><th>When</th><th>User</th><th>Lane</th><th>Mode</th><th>File</th><th className="r">HW/SW</th><th className="r">kg</th><th className="r">m³</th><th>Trust V/C/E</th><th className="r">Indicative</th><th className="r">Negotiated</th><th>Engine</th></tr></thead>
            <tbody>{data.recentQuotes.map((q, i) => (
              <tr key={i}><td>{when(q.ts)}</td><td>{q.user}</td><td>{q.lane}</td><td>{q.mode} · {q.incoterm}</td><td className="muted">{q.fileType || "manual"}</td><td className="r">{q.hwLines}/{q.swLines}</td><td className="r">{fmt.format(q.weightKg)}</td><td className="r">{q.volumeM3}</td><td className="mono">{q.trust?.verified ?? 0}/{q.trust?.checked ?? 0}/{q.trust?.estimated ?? 0}</td><td className="r">{q.cheapestIndicative != null ? fmt.format(q.cheapestIndicative) : "—"}</td><td className="r olive">{q.cheapestNegotiated != null ? fmt.format(q.cheapestNegotiated) : "—"}</td><td className="muted mono">{(q.engine || "").split("+")[0].replace(/^us\./, "")}</td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      </div>
    </div>
  );
}
