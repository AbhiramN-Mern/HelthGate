import crypto from "crypto";
import {
  IPaymentGateway,
  PaymentOrderResult,
  RefundPaymentParams,
  RefundPaymentResult,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from "../IPaymentGateway.js";

export class RazorpayGateway implements IPaymentGateway {
  readonly providerName = "RAZORPAY" as const;
  private keyId: string;
  private keySecret: string;

  constructor(keyId?: string, keySecret?: string) {
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID || "";
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET || "";
  }

  async createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, any>;
  }): Promise<PaymentOrderResult> {
    // Razorpay amounts are in the smallest currency unit (e.g., paise for INR)
    const amountInSubunits = Math.round(params.amount * 100);

    // If live credentials exist and we can call the Razorpay API:
    if (this.keyId && this.keySecret && this.keyId.startsWith("rzp_")) {
      try {
        const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
        const response = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${authHeader}`,
          },
          body: JSON.stringify({
            amount: amountInSubunits,
            currency: params.currency || "INR",
            receipt: params.receipt,
            notes: params.notes,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          return {
            providerOrderId: data.id,
            amount: params.amount,
            currency: params.currency || "INR",
            provider: "RAZORPAY",
            keyId: this.keyId,
            notes: params.notes,
          };
        } else {
          const errData = (await response.json()) as any;
          console.error("Razorpay API order error:", errData);
          throw new Error(
            `Razorpay order creation failed: ${errData?.error?.description || response.statusText}`,
          );
        }
      } catch (err: any) {
        console.error("Razorpay API exception:", err);
        throw err;
      }
    }

    // Razorpay format order ID for testing or when credentials aren't live
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString("hex");
    const providerOrderId = `order_rzp_${timestamp}_${randomHex}`;

    return {
      providerOrderId,
      amount: params.amount,
      currency: params.currency || "INR",
      provider: "RAZORPAY",
      keyId: this.keyId || "rzp_test_placeholder",
      notes: params.notes,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const { providerOrderId, providerPaymentId, razorpaySignature, simulateStatus } = params;

    if (!providerOrderId || !providerPaymentId) {
      return {
        success: false,
        providerPaymentId: providerPaymentId || "",
        failureReason: "Missing provider order ID or payment ID",
      };
    }

    // If simulating failure in test environment
    if (simulateStatus === "FAILED") {
      return {
        success: false,
        providerPaymentId,
        failureReason: params.failureReason || "Payment declined by customer bank",
      };
    }

    // Server-side HMAC SHA256 signature verification
    if (this.keySecret && razorpaySignature) {
      const payload = `${providerOrderId}|${providerPaymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", this.keySecret)
        .update(payload)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        return {
          success: false,
          providerPaymentId,
          failureReason: "Razorpay server-side signature verification failed",
        };
      }
    } else if (!razorpaySignature && this.keySecret) {
      return {
        success: false,
        providerPaymentId,
        failureReason: "Missing razorpay signature for server verification",
      };
    }

    return {
      success: true,
      providerPaymentId,
    };
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    const { providerPaymentId, amount, reason, notes, idempotencyKey } = params;
    const amountInSubunits = Math.round(amount * 100);

    if (
      this.keyId &&
      this.keySecret &&
      this.keyId.startsWith("rzp_") &&
      !providerPaymentId.startsWith("pay_mock_")
    ) {
      try {
        const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Basic ${authHeader}`,
        };

        if (idempotencyKey) {
          headers["X-Refund-Idempotency"] = idempotencyKey;
        }

        const response = await fetch(
          `https://api.razorpay.com/v1/payments/${providerPaymentId}/refund`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              amount: amountInSubunits,
              notes: {
                reason: reason || "Late payment received after booking reservation expired",
                ...notes,
              },
            }),
          },
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          const status = data.status === "processed" ? "processed" : "pending";
          return {
            success: true,
            refundId: data.id,
            amount,
            status,
          };
        } else {
          const errData = (await response.json()) as any;
          console.error("Razorpay API refund error:", errData);
          return {
            success: false,
            refundId: "",
            status: "failed",
            failureReason: errData?.error?.description || "Razorpay refund request failed",
          };
        }
      } catch (err: any) {
        console.error("Razorpay API refund exception:", err);
        return {
          success: false,
          refundId: "",
          status: "failed",
          failureReason: err.message || "Network error during Razorpay refund",
        };
      }
    }

    // Fallback / Simulated mode:
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString("hex");
    return {
      success: true,
      refundId: `rfnd_rzp_${timestamp}_${randomHex}`,
      amount,
      status: "processed",
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret?: string): boolean {
    const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || this.keySecret;
    if (!webhookSecret || !signature) return false;
    try {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");
      const expectedBuf = Buffer.from(expectedSignature);
      const sigBuf = Buffer.from(signature);
      if (expectedBuf.length !== sigBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedBuf, sigBuf);
    } catch {
      return false;
    }
  }
}
