
import { Outlet, Link } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-brand" />
          <span className="font-semibold">Freight Calculator</span>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link to="/quote/new">New Quote</Link>
          <Link to="/quotes">History</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>
      <main className="p-4 max-w-6xl mx-auto"><Outlet /></main>
    </div>
  );
}
