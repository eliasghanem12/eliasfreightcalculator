import { Link } from "react-router-dom";
export default function QuoteView() {
  return <div className="page"><div className="page-head"><h1>Quote</h1><p>Saved quotes are listed under <Link to="/quotes">History</Link>.</p></div></div>;
}
