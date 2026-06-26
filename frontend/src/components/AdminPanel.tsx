import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { resolveDispute } from "../lib/api";
import { formatNaira } from "../lib/format";

type DisputeRow = {
  id: string;
  order_id: string;
  buyer_message: string;
  admin_notes: string | null;
  status: "open" | "resolved";
  resolution: "refund_full" | "refund_partial" | "released_to_seller" | null;
  created_at: string;
  orders: {
    total: number;
    status: string;
    seller_profiles: { shop_name: string } | null;
    profiles: { display_name: string | null } | null;
  } | null;
};

export default function AdminPanel() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("disputes")
      .select(
        "*, orders(total, status, seller_profiles(shop_name), profiles:buyer_id(display_name))"
      )
      .order("created_at", { ascending: false });

    setLoading(false);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setDisputes((data as unknown as DisputeRow[]) ?? []);
  }, []);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  async function handleResolve(
    disputeId: string,
    resolution: "refund_full" | "refund_partial" | "released_to_seller"
  ) {
    setActionError(null);
    setResolvingId(disputeId);
    try {
      await resolveDispute({
        disputeId,
        resolution,
        adminNotes: notes[disputeId],
      });
      await loadDisputes();
    } catch (resolveError) {
      setActionError(
        resolveError instanceof Error ? resolveError.message : "Could not resolve dispute"
      );
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) return <p className="muted">Loading admin panel…</p>;

  return (
    <section className="stack">
      <section className="card">
        <p className="eyebrow">Admin</p>
        <h2>Dispute handling</h2>
        <p className="muted small">
          Review open disputes and manually choose refund or release payment (spec Section 12).
        </p>
      </section>

      {error && <p className="feedback error">{error}</p>}
      {actionError && <p className="feedback error">{actionError}</p>}

      {disputes.length === 0 ? (
        <section className="card">
          <p className="muted">No disputes yet.</p>
        </section>
      ) : (
        <ul className="order-list">
          {disputes.map((dispute) => (
            <li key={dispute.id} className="order-card">
              <div className="order-header">
                <div>
                  <strong>
                    {dispute.orders?.seller_profiles?.shop_name ?? "Shop"} —{" "}
                    {dispute.orders?.profiles?.display_name ?? "Buyer"}
                  </strong>
                  <p className="muted small">
                    {new Date(dispute.created_at).toLocaleString()} · Order{" "}
                    {formatNaira(Number(dispute.orders?.total ?? 0))}
                  </p>
                </div>
                <span className={`badge ${dispute.status === "open" ? "pending" : "completed"}`}>
                  {dispute.status}
                </span>
              </div>

              <p>
                <strong>Buyer message:</strong> {dispute.buyer_message}
              </p>

              {dispute.admin_notes && (
                <p className="muted small">
                  <strong>Admin notes:</strong> {dispute.admin_notes}
                </p>
              )}

              {dispute.status === "open" && (
                <>
                  <label>
                    Admin notes
                    <textarea
                      value={notes[dispute.id] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [dispute.id]: e.target.value }))
                      }
                      rows={2}
                      placeholder="Notes for your records…"
                    />
                  </label>
                  <div className="row-actions wrap">
                    <button
                      type="button"
                      className="btn secondary small"
                      disabled={resolvingId === dispute.id}
                      onClick={() => handleResolve(dispute.id, "refund_full")}
                    >
                      Full refund
                    </button>
                    <button
                      type="button"
                      className="btn secondary small"
                      disabled={resolvingId === dispute.id}
                      onClick={() => handleResolve(dispute.id, "refund_partial")}
                    >
                      Partial refund (manual)
                    </button>
                    <button
                      type="button"
                      className="btn primary small"
                      disabled={resolvingId === dispute.id}
                      onClick={() => handleResolve(dispute.id, "released_to_seller")}
                    >
                      Release to seller
                    </button>
                  </div>
                </>
              )}

              {dispute.resolution && (
                <p className="muted small">Resolution: {dispute.resolution.replace(/_/g, " ")}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
