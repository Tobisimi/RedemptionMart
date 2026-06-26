import PaystackPop from "@paystack/inline-js";
import { initializeOrderPayment, verifyOrderPayment } from "./api";

/** Opens Paystack's secure checkout modal (real Paystack UI, not a fake screen). */
export async function openPaystackCheckout(orderId: string): Promise<{
  reference: string;
  orderId: string;
}> {
  const payment = await initializeOrderPayment(orderId);

  const paystack = new PaystackPop();

  return new Promise((resolve, reject) => {
    paystack.newTransaction({
      accessCode: payment.accessCode,
      onSuccess: async (transaction) => {
        try {
          const ref = transaction.reference || payment.reference;
          const verified = await verifyOrderPayment(ref);
          resolve({ reference: ref, orderId: verified.orderId });
        } catch (error) {
          reject(error);
        }
      },
      onCancel: () => {
        reject(new Error("Payment was cancelled."));
      },
    });
  });
}
