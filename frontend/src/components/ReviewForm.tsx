import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  orderId: string;
  onSubmitted: () => void;
};

export default function ReviewForm({ orderId, onSubmitted }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: reviewError } = await supabase.rpc("submit_review", {
      p_order_id: orderId,
      p_rating: rating,
      p_comment: comment.trim() || null,
    });

    setSubmitting(false);

    if (reviewError) {
      setError(reviewError.message);
      return;
    }

    onSubmitted();
  }

  return (
    <form className="form review-form" onSubmit={handleSubmit}>
      <h4>Rate this seller</h4>
      <label>
        Stars (1–5)
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {"★".repeat(value)} ({value})
            </option>
          ))}
        </select>
      </label>
      <label>
        Comment (optional)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="How was your experience?"
        />
      </label>
      {error && <p className="feedback error">{error}</p>}
      <button type="submit" className="btn secondary small" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
