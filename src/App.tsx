import { Outlet, NavLink } from "react-router-dom";

function Mark() {
  // FreightIQ mark: a box with a route line through it.
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="2" y="6" width="24" height="18" rx="3" fill="#164C82" />
      <path d="M6 18 L12 12 L17 16 L23 10" fill="none" stroke="#ACCB32" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/quote/new" className="brand"><Mark /><span>FreightIQ</span><small>by Mindware</small></NavLink>
        <nav>
          <NavLink to="/quote/new">New quote</NavLink>
          <NavLink to="/quotes">History</NavLink>
          <NavLink to="/admin">Settings</NavLink>
        </nav>
      </header>
      <main><Outlet /></main>
      <footer className="foot">Built on AWS · Amazon Bedrock, Lambda, S3, Amplify</footer>
    </div>
  );
}
