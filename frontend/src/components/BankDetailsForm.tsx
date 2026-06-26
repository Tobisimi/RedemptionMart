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
  prominent?: boolean;
};

function hasBankDetails(initial?: Props["initial"]) {
  return Boolean(initial?.bank_account_number && initial?.bank_code);
}

export default function BankDetailsForm({
  sellerId,
  shopName,
  initial,
  onSaved,
  prominent = false,
}: Props) {
  const [expanded, setExpanded] = useState(prominent || !hasBankDetails(initial));
  const [accountName, setAccountName] = useState(initial?.bank_account_name ?? shopName);
  const [accountNumber, setAccountNumber] = useState(initial?.bank_account_number ?? "");
  const [bankCode, setBankCode] = useState(initial?.bank_code ?? "057");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const complete = hasBankDetails(initial);

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

    setSaved(true);
    onSaved();
  }

  return (
    <section
      className={`card payout-card ${prominent ? "payout-card-prominent" : ""} ${complete ? "payout-card-complete" : "payout-card-missing"}`}
      id="seller-bank-details"
    >
      <div className="payout-card-head">
        <div className="payout-icon" aria-hidden>
          🏦
        </div>
        <div>
          <p className="eyebrow">Get paid</p>
          <h3>Bank account for payouts</h3>
          <p className="muted small">
            {complete
              ? "Saved — you will receive money here after buyers confirm their orders."
              : "Required before you can receive money. Buyers pay through Paystack; we send your share to this account."}
          </p>
        </div>
        {complete && (
          <span className="badge active">Saved ✓</span>
        )}
      </div>

      {!complete && (
        <div className="alert-banner warning">
          <strong>Action needed:</strong> Add your bank details so Paystack can pay you when orders
          complete.
        </div>
      )}

      {complete && !expanded ? (
        <button type="button" className="btn ghost small" onClick={() => setExpanded(true)}>
          Update bank details
        </button>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Account name (as on bank account)
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Tobi Ilori"
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
              <option value="070">Fidelity Bank</option>
              <option value="035">Wema Bank</option>
            </select>
          </label>
          {error && <p className="feedback error">{error}</p>}
          {saved && <p className="feedback success">Bank details saved.</p>}
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Saving…" : "Save bank details"}
          </button>
        </form>
      )}
    </section>
  );
}

export { hasBankDetails };
