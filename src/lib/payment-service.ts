import crypto from 'node:crypto';

export type PaymentGatewayMode = 'razorpay' | 'sandbox';

export interface GatewayConfigStatus {
  mode: PaymentGatewayMode;
  isLiveConfigured: boolean;
  keyId: string | null;
  supportedMethods: Array<'upi' | 'card' | 'netbanking'>;
  notice: string;
}

export interface CreateGatewayOrderInput {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreatedGatewayOrder {
  gateway: PaymentGatewayMode;
  gatewayOrderId: string;
  amountPaise: number;
  currency: 'INR';
  keyId: string | null;
}

export interface VerifyGatewayPaymentInput {
  gateway: PaymentGatewayMode;
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  simulateFailure?: boolean;
}

export interface VerifyGatewayPaymentResult {
  verified: boolean;
  gatewayPaymentId: string;
  failureReason?: string;
}

export function getGatewayStatus(): GatewayConfigStatus {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  const isLiveConfigured = Boolean(keyId && keySecret);

  if (isLiveConfigured) {
    return {
      mode: 'razorpay',
      isLiveConfigured: true,
      keyId,
      supportedMethods: ['upi', 'card', 'netbanking'],
      notice: 'Razorpay payment gateway active (UPI, Cards & NetBanking).',
    };
  }

  return {
    mode: 'sandbox',
    isLiveConfigured: false,
    keyId: null,
    supportedMethods: ['upi', 'card', 'netbanking'],
    notice:
      'Sandbox Checkout Mode active (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set). No real money is charged; configure Razorpay env credentials to switch to live payments.',
  };
}

export async function createGatewayOrder(
  input: CreateGatewayOrderInput
): Promise<CreatedGatewayOrder> {
  const status = getGatewayStatus();
  const amountPaise = Math.round(input.amountInr * 100);

  if (status.mode === 'razorpay' && status.keyId) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET!.trim();
    const authToken = Buffer.from(`${status.keyId}:${keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: input.receipt.slice(0, 40),
        notes: input.notes || {},
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Razorpay API error');
      throw new Error(`Payment gateway order initialization failed: ${errText}`);
    }

    const orderJson = (await response.json()) as { id: string; amount: number };
    return {
      gateway: 'razorpay',
      gatewayOrderId: orderJson.id,
      amountPaise: orderJson.amount || amountPaise,
      currency: 'INR',
      keyId: status.keyId,
    };
  }

  // Sandbox mode order initialization
  const randomSuffix = crypto.randomBytes(6).toString('hex').toUpperCase();
  return {
    gateway: 'sandbox',
    gatewayOrderId: `sandbox_ord_${randomSuffix}`,
    amountPaise,
    currency: 'INR',
    keyId: null,
  };
}

export function verifyGatewayPayment(
  input: VerifyGatewayPaymentInput
): VerifyGatewayPaymentResult {
  const status = getGatewayStatus();

  if (input.simulateFailure) {
    return {
      verified: false,
      gatewayPaymentId:
        input.gatewayPaymentId || `pay_fail_${crypto.randomBytes(5).toString('hex')}`,
      failureReason: 'Payment declined or cancelled by payer at gateway.',
    };
  }

  if (status.mode === 'razorpay') {
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    if (!input.gatewayPaymentId || !input.gatewaySignature || !keySecret) {
      return {
        verified: false,
        gatewayPaymentId: input.gatewayPaymentId || '',
        failureReason: 'Missing Razorpay payment ID or cryptographic signature.',
      };
    }

    const expectedSig = crypto
      .createHmac('sha256', keySecret)
      .update(`${input.gatewayOrderId}|${input.gatewayPaymentId}`)
      .digest('hex');

    const a = Buffer.from(expectedSig, 'utf8');
    const b = Buffer.from(input.gatewaySignature, 'utf8');
    const sigMatch = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!sigMatch) {
      return {
        verified: false,
        gatewayPaymentId: input.gatewayPaymentId,
        failureReason: 'Invalid Razorpay signature verification.',
      };
    }

    return {
      verified: true,
      gatewayPaymentId: input.gatewayPaymentId,
    };
  }

  // Sandbox mode: never allow sandbox verification if live gateway was requested
  if (input.gateway === 'razorpay') {
    return {
      verified: false,
      gatewayPaymentId: input.gatewayPaymentId || '',
      failureReason: 'Live Razorpay verification cannot run without gateway credentials.',
    };
  }

  const sandboxPayId =
    input.gatewayPaymentId?.trim() ||
    `sandbox_pay_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  return {
    verified: true,
    gatewayPaymentId: sandboxPayId,
  };
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined
): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret || !signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
