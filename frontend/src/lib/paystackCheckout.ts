import PaystackPop from "@paystack/inline-js";
import { initializeOrderPayment, verifyOrderPayment } from "./api";

const PENDING_KEY = "rm_pending_payment";

export type PendingPayment = {
  orderId: string;
  reference: string;
};

export type CheckoutResult = {
  reference: string;
  orderId: string;
  amount: number;
};

export function savePendingPayment(pending: PendingPayment) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingPayment;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  sessionStorage.removeItem(PENDING_KEY);
}

/**
 * Opens Paystack's card form (card number, expiry, CVV) in a popup on this page.
 * When payment succeeds we immediately tell our server so the seller sees "Paid".
 */
export async function openPaystackCheckout(orderId: string): Promise<CheckoutResult> {
  const payment = await initializeOrderPayment(orderId);

  savePendingPayment({
    orderId,
    reference: payment.reference,
  });

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    try {
      const popup = new PaystackPop();
      popup.newTransaction({
        accessCode: payment.accessCode,
        onSuccess: async (transaction) => {
          const reference = transaction.reference || payment.reference;
          try {
            const verified = await verifyOrderPayment(
              reference,
              `?orderId=${encodeURIComponent(orderId)}`
            );
            clearPendingPayment();
            finish(() =>
              resolve({
                reference,
                orderId: verified.orderId,
                amount: payment.amount,
              })
            );
          } catch (verifyError) {
            finish(() =>
              reject(
                verifyError instanceof Error
                  ? verifyError
                  : new Error("Payment went through but we could not confirm it. Tap “Check payment” on your order.")
              )
            );
          }
        },
        onCancel: () => {
          finish(() => reject(new Error("Payment cancelled. You can try again when ready.")));
        },
      });
    } catch {
      // Popup blocked or failed — full-page Paystack checkout (still has card fields)
      window.location.assign(payment.authorizationUrl);
    }
  });
}

/** After Paystack redirects back to our site, confirm payment with our server. */
export async function verifyPaystackReturn(reference: string, orderId?: string) {
  const query = orderId ? `?orderId=${encodeURIComponent(orderId)}` : "";
  return verifyOrderPayment(reference, query);
}

export const redirectToPaystackCheckout = openPaystackCheckout;
