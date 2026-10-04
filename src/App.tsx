import { Outlet, NavLink } from "react-router-dom";
import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { useEffect, useState } from "react";
import { authEnabled, signOut, getGroups } from "./lib/auth";

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="2" y="6" width="24" height="18" rx="3" fill="#164C82" />
      <path d="M6 18 L12 12 L17 16 L23 10" fill="none" stroke="#ACCB32" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Shell({ email }: { email?: string }) {
  const [admin, setAdmin] = useState(false);
  useEffect(() => { getGroups().then((g) => setAdmin(g.includes("admin"))); }, [email]);
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/quote/new" className="brand"><Mark /><span>FreightIQ</span><small>by Mindware</small></NavLink>
        <nav>
          <NavLink to="/quote/new">New quote</NavLink>
          <NavLink to="/quotes">History</NavLink>
          <NavLink to="/admin">Settings</NavLink>
          {admin && <NavLink to="/dashboard">Dashboard</NavLink>}
          {authEnabled && (
            <button type="button" className="nav-signout" onClick={() => signOut()} title={email}>
              Sign out{email ? ` (${email})` : ""}
            </button>
          )}
        </nav>
      </header>
      <main><Outlet /></main>
      <footer className="foot">Built on AWS · Amazon Cognito, Lambda, S3, Amplify</footer>
    </div>
  );
}

function Gate() {
  const { user } = useAuthenticator((ctx) => [ctx.user]);
  const email = (user as any)?.signInDetails?.loginId ?? user?.username;
  return <Shell email={email} />;
}

export default function App() {
  if (!authEnabled) return <Shell />;
  return (
    <div className="auth-wrap">
      <Authenticator hideSignUp loginMechanisms={["email"]} components={{ Header: () => (
        <div className="auth-head"><Mark /><span>FreightIQ</span><small>Sign in to continue</small></div>
      ) }}>
        <Gate />
      </Authenticator>
    </div>
  );
}
