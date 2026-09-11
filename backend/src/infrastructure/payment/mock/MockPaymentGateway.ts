import crypto from "crypto";
import {
  IPaymentGateway,
  PaymentOrderResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "../IPaymentGateway.js";

export class MockPaymentGateway implements IPaymentGateway {
  readonly providerName = "MOCK" as const;
  private secretSalt: string;

  constructor(secretSalt = "healthgate_mock_gateway_secret") {
    this.secretSalt = secretSalt;
  }

  async createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, any>;
  }): Promise<PaymentOrderResult> {
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString("hex");
    const providerOrderId = `order_mock_${timestamp}_${randomHex}`;

    // Generate mock checkout signature token to guard against arbitrary spoofing
    const mockCheckoutToken = crypto
      .createHmac("sha256", this.secretSalt)
      .update(`${providerOrderId}:${params.amount}:${params.currency}`)
      .digest("hex");

    return {
      providerOrderId,
      amount: params.amount,
      currency: params.currency || "INR",
      provider: "MOCK",
      mockCheckoutToken,
      notes: params.notes,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const { providerOrderId, providerPaymentId, simulateStatus, failureReason } = params;

    if (!providerOrderId || !providerOrderId.startsWith("order_mock_")) {
      return {
        success: false,
        providerPaymentId: "",
        failureReason: "Invalid mock provider order identifier",
      };
    }

    // Realistic simulation: if user/client requested FAILED simulation
    if (simulateStatus === "FAILED") {
      return {
        success: false,
        providerPaymentId: "",
        failureReason: failureReason || "Payment declined by issuing bank (Simulation)",
      };
    }

    // Successful simulation
    const payId = providerPaymentId || `pay_mock_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    return {
      success: true,
      providerPaymentId: payId,
    };
  }
}
