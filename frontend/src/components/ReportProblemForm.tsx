import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  orderId: string;
  onSubmitted: () => void;
  onCancel: () => void;
};

export default function ReportProblemForm({ orderId, onSubmitted, onCancel }: Props) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: disputeError } = await supabase.rpc("report_order_problem", {
      p_order_id: orderId,
      p_message: message.trim(),
    });

    setSubmitting(false);

    if (disputeError) {
      setError(disputeError.message);
      return;
    }

    onSubmitted();
  }

  return (
    <form className="form dispute-form" onSubmit={handleSubmit}>
      <h4>Report a problem</h4>
      <p className="muted small">
        Describe what went wrong. An admin will review your order and decide on a refund or
        release to the seller.
      </p>
      <label>
        What is the issue?
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          required
          minLength={5}
          placeholder="e.g. Wrong item received, damaged product…"
        />
      </label>
      {error && <p className="feedback error">{error}</p>}
      <div className="row-actions wrap">
        <button type="button" className="btn ghost small" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn secondary small" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </form>
  );
}
