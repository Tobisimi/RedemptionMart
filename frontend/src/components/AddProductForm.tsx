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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function uploadImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${sellerId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    setSubmitting(true);

    try {
      let primaryImage = imageUrl.trim() || null;
      const imageList: string[] = [];

      if (imageFile) {
        const uploaded = await uploadImage(imageFile);
        imageList.push(uploaded);
        if (!primaryImage) primaryImage = uploaded;
      }

      if (primaryImage && !imageList.includes(primaryImage)) {
        imageList.unshift(primaryImage);
      }

      const { error: insertError } = await supabase.from("products").insert({
        seller_id: sellerId,
        name: name.trim(),
        description: description.trim() || null,
        price: parsedPrice,
        image_url: primaryImage,
        images: imageList,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setName("");
      setDescription("");
      setPrice("");
      setImageUrl("");
      setImageFile(null);
      onAdded();
    } catch (uploadOrInsertError) {
      setError(
        uploadOrInsertError instanceof Error
          ? uploadOrInsertError.message
          : "Could not add product."
      );
    } finally {
      setSubmitting(false);
    }
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
          Photo (upload)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label>
          Or image URL
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
