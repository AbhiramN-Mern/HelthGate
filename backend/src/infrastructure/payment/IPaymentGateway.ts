export type PaymentOrderResult = {
  providerOrderId: string;
  amount: number;
  currency: string;
  provider: "MOCK" | "RAZORPAY";
  keyId?: string;
  mockCheckoutToken?: string;
  notes?: Record<string, any>;
};

export type VerifyPaymentParams = {
  providerOrderId: string;
  providerPaymentId?: string;
  razorpaySignature?: string;
  simulateStatus?: "SUCCESS" | "FAILED";
  failureReason?: string;
  mockToken?: string;
};

export type VerifyPaymentResult = {
  success: boolean;
  providerPaymentId: string;
  failureReason?: string;
};

export type RefundPaymentParams = {
  providerPaymentId: string;
  amount: number;
  currency?: string;
  reason?: string;
  notes?: Record<string, any>;
  idempotencyKey?: string;
};

export type RefundPaymentResult = {
  success: boolean;
  refundId: string;
  amount?: number;
  status: "processed" | "pending" | "failed";
  failureReason?: string;
};

export interface IPaymentGateway {
  readonly providerName: "MOCK" | "RAZORPAY";

  createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, any>;
  }): Promise<PaymentOrderResult>;

  verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;

  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret?: string): boolean;
}
