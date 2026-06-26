declare module "@paystack/inline-js" {
  export default class PaystackPop {
    newTransaction(options: {
      accessCode?: string;
      key?: string;
      email?: string;
      amount?: number;
      reference?: string;
      onSuccess: (transaction: { reference: string; trans?: string }) => void;
      onCancel?: () => void;
    }): void;
  }
}
