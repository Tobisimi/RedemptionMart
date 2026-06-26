import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";
import { ensureProfile } from "../lib/ensureProfile";
import { useAuth } from "../contexts/AuthContext";

type Props = {
  onComplete: () => void;
};

export default function SellerSetupForm({ onComplete }: Props) {
  const { user } = useAuth();
  const [shopName, setShopName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    setError(null);
    setSubmitting(true);

    const profileError = await ensureProfile();
    if (profileError) {
      setSubmitting(false);
      setError(profileError);
      return;
    }

    const { error: insertError } = await supabase.from("seller_profiles").insert({
      user_id: user.id,
      shop_name: shopName.trim(),
      description: description.trim() || null,
      address: address.trim(),
      latitude,
      longitude,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onComplete();
  }

  return (
    <section className="card">
      <h2>Set up your shop</h2>
      <p className="muted">Add your shop details so buyers can find you in Redemption City.</p>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Shop name
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="e.g. Tobi's Electronics"
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What do you sell?"
            rows={3}
          />
        </label>

        <label>
          Address in Redemption City
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Block 4, Redemption City"
            required
          />
        </label>

        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            if (!navigator.geolocation) {
              setError("Location is not available on this device.");
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (position) => {
                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
                setError(null);
              },
              () => setError("Could not get your location. You can still save your address.")
            );
          }}
        >
          Use my current location on map
        </button>
        {latitude != null && longitude != null && (
          <p className="muted small">
            Location saved ({latitude.toFixed(4)}, {longitude.toFixed(4)})
          </p>
        )}

        {error && <p className="feedback error">{error}</p>}

        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? "Saving…" : "Create shop"}
        </button>
      </form>
    </section>
  );
}
