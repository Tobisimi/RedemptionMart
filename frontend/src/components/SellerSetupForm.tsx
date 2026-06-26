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
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("057");
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
      bank_account_name: accountName.trim() || shopName.trim(),
      bank_account_number: accountNumber.trim(),
      bank_code: bankCode,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onComplete();
  }

  return (
    <section className="card seller-setup-card">
      <p className="eyebrow">Become a seller</p>
      <h2>Set up your shop</h2>
      <p className="muted">Tell buyers who you are and where to find you in Redemption City.</p>

      <form className="form" onSubmit={handleSubmit}>
        <fieldset className="form-section">
          <legend>Shop details</legend>
          <label>
            Shop name
            <input
              type="text"
              value={shopName}
              onChange={(e) => {
                setShopName(e.target.value);
                if (!accountName) setAccountName(e.target.value);
              }}
              placeholder="e.g. Tobi's Snacks"
              required
            />
          </label>

          <label>
            What do you sell?
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for buyers"
              rows={2}
            />
          </label>

          <label>
            Shop address in Redemption City
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
                () => setError("Could not get location — you can still save your address.")
              );
            }}
          >
            📍 Pin my shop on the map
          </button>
        </fieldset>

        <fieldset className="form-section payout-section-setup">
          <legend>🏦 Bank account (how you get paid)</legend>
          <p className="muted small">
            When buyers confirm their orders, Paystack sends your money to this account (minus 3%
            platform fee).
          </p>
          <label>
            Account name
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Name on your bank account"
              required
            />
          </label>
          <label>
            Account number (10 digits)
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{10}"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="0123456789"
              required
            />
          </label>
          <label>
            Bank
            <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
              <option value="057">Zenith Bank</option>
              <option value="058">GTBank</option>
              <option value="044">Access Bank</option>
              <option value="033">UBA</option>
              <option value="011">First Bank</option>
              <option value="214">FCMB</option>
            </select>
          </label>
        </fieldset>

        {error && <p className="feedback error">{error}</p>}

        <button type="submit" className="btn primary full" disabled={submitting}>
          {submitting ? "Creating shop…" : "Create my shop"}
        </button>
      </form>
    </section>
  );
}
