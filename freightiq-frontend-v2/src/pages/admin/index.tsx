export default function Admin() {
  const api = import.meta.env.VITE_API_URL ?? "(not set)";
  return (
    <div className="page">
      <div className="page-head"><h1>Settings</h1><p>Where FreightIQ reads its data from.</p></div>
      <dl className="settings">
        <dt>Backend API</dt><dd className="mono">{api}</dd>
        <dt>Negotiated rate sheet</dt><dd>S3 bucket <span className="mono">freightiq-special-rates</span>, key <span className="mono">rates/current.csv</span>. Upload a new CSV with the same columns to replace it; rows outside their validity window are ignored.</dd>
        <dt>SKU dimension cache</dt><dd>S3 bucket <span className="mono">freightiq-dimensions-cache</span>. One JSON file per SKU; delete a file to force a fresh lookup.</dd>
        <dt>Locations</dt><dd>Countries, airports, seaports and warehouses are in <span className="mono">src/lib/locations.ts</span>. Managing them here is planned.</dd>
      </dl>
    </div>
  );
}
