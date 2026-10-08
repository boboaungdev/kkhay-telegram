import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { KkhayTelegram, KkhayWebhookHandler } from "../src/index.js";
import type { InvoiceData } from "../src/types.js";

describe("KkhayTelegram Client", () => {
  const dummyApiKey = "kkhay_test_key_abc123";
  const dummySecret = "whsec_supersecretkey123";

  it("should initialize with valid configuration", () => {
    const client = new KkhayTelegram({
      apiKey: dummyApiKey,
      webhookSecret: dummySecret,
    });
    expect(client).toBeDefined();
  });

  it("should throw error if apiKey is missing", () => {
    expect(() => new KkhayTelegram({ apiKey: "" })).toThrow();
  });

  it("should build proper Telegram Mini App inline keyboard by default", () => {
    const client = new KkhayTelegram({ apiKey: dummyApiKey });
    const mockInvoice: InvoiceData = {
      id: "inv_12345",
      orderId: "order_999",
      amount: 15.5,
      currency: "USD",
      status: "PENDING",
      checkoutUrl: "https://kkhay.com/pay/inv_12345",
      createdAt: new Date().toISOString(),
    };

    const keyboard = client.createInvoiceKeyboard(mockInvoice);
    expect(keyboard.inline_keyboard).toHaveLength(2);

    // Button 1: Web App payment button
    const payBtn = keyboard.inline_keyboard[0][0];
    expect(payBtn.text).toContain("Pay with Crypto");
    expect(payBtn.web_app?.url).toBe("https://kkhay.com/pay/inv_12345");

    // Button 2: Check status callback query
    const checkBtn = keyboard.inline_keyboard[1][0];
    expect(checkBtn.callback_data).toBe("kkhay_check:inv_12345");
  });

  it("should support direct URL payment button if useMiniApp is false", () => {
    const client = new KkhayTelegram({ apiKey: dummyApiKey });
    const mockInvoice: InvoiceData = {
      id: "inv_12345",
      orderId: "order_999",
      amount: 15.5,
      currency: "USD",
      status: "PENDING",
      checkoutUrl: "https://kkhay.com/pay/inv_12345",
      createdAt: new Date().toISOString(),
    };

    const keyboard = client.createInvoiceKeyboard(mockInvoice, { useMiniApp: false });
    const payBtn = keyboard.inline_keyboard[0][0];
    expect(payBtn.url).toBe("https://kkhay.com/pay/inv_12345");
    expect(payBtn.web_app).toBeUndefined();
  });

  it("should format formatted HTML message for Telegram", () => {
    const client = new KkhayTelegram({ apiKey: dummyApiKey });
    const mockInvoice: InvoiceData = {
      id: "inv_12345",
      orderId: "order_999",
      amount: 25.0,
      currency: "USDT",
      status: "PENDING",
      checkoutUrl: "https://kkhay.com/pay/inv_12345",
      createdAt: new Date().toISOString(),
    };

    const result = client.formatInvoiceMessage(mockInvoice);
    expect(result.text).toContain("25.00 USDT");
    expect(result.text).toContain("order_999");
    expect(result.parse_mode).toBe("HTML");
    expect(result.reply_markup).toBeDefined();
  });

  it("should accurately verify HMAC-SHA256 signatures", () => {
    const client = new KkhayTelegram({
      apiKey: dummyApiKey,
      webhookSecret: dummySecret,
    });

    const payload = JSON.stringify({
      event: "invoice.paid",
      data: { id: "inv_test", amount: 50 },
    });

    const validSignature = createHmac("sha256", dummySecret).update(payload).digest("hex");
    const invalidSignature = "deadbeef1234567890abcdef";

    expect(client.verifyWebhookSignature(payload, validSignature)).toBe(true);
    expect(client.verifyWebhookSignature(payload, invalidSignature)).toBe(false);
  });

  it("should dispatch webhook events via KkhayWebhookHandler", async () => {
    const client = new KkhayTelegram({
      apiKey: dummyApiKey,
      webhookSecret: dummySecret,
    });

    let paidTriggered = false;

    const handler = new KkhayWebhookHandler(client, {
      onPaid: (event) => {
        expect(event.event).toBe("invoice.paid");
        expect(event.data.id).toBe("inv_paid_123");
        paidTriggered = true;
      },
    });

    const payload = JSON.stringify({
      event: "invoice.paid",
      data: { id: "inv_paid_123", amount: 100, currency: "USD", status: "PAID" },
    });

    const sig = createHmac("sha256", dummySecret).update(payload).digest("hex");

    const res = await handler.handle(payload, sig);
    expect(res.status).toBe("ok");
    expect(paidTriggered).toBe(true);
  });
});

