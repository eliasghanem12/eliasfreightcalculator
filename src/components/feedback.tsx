// src/components/feedback.tsx — thumbs up / down with a category and a comment, sent to the admin dashboard.
import { useState } from "react";

export function FeedbackBox({ onSubmit }: { onSubmit: (f: { thumbs: "up" | "down"; category: string; comment?: string }) => Promise<void> }) {
  const [thumbs, setThumbs] = useState<"up" | "down" | null>(null);
  const [category, setCategory] = useState("parsing");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const submit = async () => {
    if (!thumbs) return;
    setState("busy");
    try { await onSubmit({ thumbs, category, comment: comment.trim() || undefined }); setState("done"); }
    catch { setState("error"); }
  };

  if (state === "done") return <section className="fb fb-done">Thanks — your feedback helps improve the accuracy for everyone.</section>;

  return (
    <section className="fb" aria-label="Feedback on this quote">
      <div className="fb-head">
        <strong>Was this quote accurate?</strong>
        <div className="fb-thumbs" role="radiogroup">
          <button type="button" role="radio" aria-checked={thumbs === "up"} className={thumbs === "up" ? "on" : ""} onClick={() => setThumbs("up")} aria-label="Thumbs up">👍</button>
          <button type="button" role="radio" aria-checked={thumbs === "down"} className={thumbs === "down" ? "on" : ""} onClick={() => setThumbs("down")} aria-label="Thumbs down">👎</button>
        </div>
      </div>
      {thumbs && (
        <div className="fb-body">
          <label className="field field-inline">
            <span>About</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 200 }}>
              <option value="parsing">Reading the quotation</option>
              <option value="dimensions">Dimensions and weights</option>
              <option value="rates">Rates and prices</option>
              <option value="other">Something else</option>
            </select>
          </label>
          <textarea className="cell" rows={2} placeholder={thumbs === "down" ? "What was wrong? e.g. the switch weight should be 10 kg" : "Anything we should keep doing?"} value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="toolbar">
            <button type="button" className="btn btn-navy" onClick={submit} disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send feedback"}</button>
            {state === "error" && <span className="warn">Could not send. Try again.</span>}
          </div>
        </div>
      )}
    </section>
  );
}
