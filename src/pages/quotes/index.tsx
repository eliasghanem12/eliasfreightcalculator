
export default function QuotesIndex(){
  const last = typeof window !== "undefined" ? localStorage.getItem("lastQuote") : null;
  return <div className="grid gap-4">
    <h1 className="text-xl font-semibold">Quote History</h1>
    {last ? <pre className="text-xs p-3 rounded border bg-white dark:bg-neutral-800">{last}</pre> : <p>No local quotes yet.</p>}
  </div>;
}
