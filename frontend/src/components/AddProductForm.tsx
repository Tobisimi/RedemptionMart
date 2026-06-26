import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  sellerId: string;
  onAdded: () => void;
};

export default function AddProductForm({ sellerId, onAdded }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    setSubmitting(true);

    const { error: insertError } = await supabase.from("products").insert({
      seller_id: sellerId,
      name: name.trim(),
      description: description.trim() || null,
      price: parsedPrice,
      image_url: imageUrl.trim() || null,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    onAdded();
  }

  return (
    <section className="card">
      <h3>Add a product</h3>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Product name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </label>

        <label>
          Price (₦)
          <input
            type="number"
            min="1"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>

        <label>
          Image URL (optional)
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>

        {error && <p className="feedback error">{error}</p>}

        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? "Adding…" : "Add product"}
        </button>
      </form>
    </section>
  );
}
