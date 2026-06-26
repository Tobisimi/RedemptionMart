import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  sellerId: string;
  shopName: string;
  initial?: {
    bank_account_name: string | null;
    bank_account_number: string | null;
    bank_code: string | null;
  };
  onSaved: () => void;
};

export default function BankDetailsForm({ sellerId, shopName, initial, onSaved }: Props) {
  const [accountName, setAccountName] = useState(initial?.bank_account_name ?? shopName);
  const [accountNumber, setAccountNumber] = useState(initial?.bank_account_number ?? "");
  const [bankCode, setBankCode] = useState(initial?.bank_code ?? "057");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const { error: updateError } = await supabase
      .from("seller_profiles")
      .update({
        bank_account_name: accountName.trim(),
        bank_account_number: accountNumber.trim(),
        bank_code: bankCode,
      })
      .eq("id", sellerId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onSaved();
  }

  return (
    <section className="card">
      <h3>Bank details for payouts</h3>
      <p className="muted small">
        Required to receive payment after buyers confirm their orders (Paystack transfer).
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Account name
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          />
        </label>
        <label>
          Account number
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{10}"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
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
            <option value="070">Fidelity Bank</option>
            <option value="035">Wema Bank</option>
          </select>
        </label>
        {error && <p className="feedback error">{error}</p>}
        <button type="submit" className="btn secondary" disabled={saving}>
          {saving ? "Saving…" : "Save bank details"}
        </button>
      </form>
    </section>
  );
}
