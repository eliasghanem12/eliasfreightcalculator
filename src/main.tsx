
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles/globals.css";
import App from "./App";
import Login from "./pages/login";
import QuoteNew from "./pages/quote/new";
import QuoteView from "./pages/quote/view";
import QuotesIndex from "./pages/quotes";
import Admin from "./pages/admin";

const router = createBrowserRouter([
  { path: "/", element: <App />, children: [
    { index: true, element: <QuoteNew/> },
    { path: "login", element: <Login/> },
    { path: "quote/new", element: <QuoteNew/> },
    { path: "quote/:id", element: <QuoteView/> },
    { path: "quotes", element: <QuotesIndex/> },
    { path: "admin", element: <Admin/> },
  ]},
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>
);
