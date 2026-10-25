import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { KkhayTelegram, KkhayWebhookHandler } from "../src/index.js";
import type { InvoiceData } from "../src/types.js";

describe("KkhayTelegram Client", () => {
  const dummyApiKey = "kkhay_test_key_abc123";
  const dummySecret = "whsec_supersecretkey123";
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should initialize with valid configuration", () => {
    const client = new KkhayTelegram({
      apiKey: dummyApiKey,
      webhookSecret: dummySecret,
    });
    expect(client).toBeDefined();
    expect(client.apiKey).toBe(dummyApiKey);
    expect(client.baseUrl).toBe("https://api.kkhay.com");
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
      status: "WAITING",
      checkoutUrl: "https://kkhay.com/gateway/invoice/inv_12345",
      createdAt: new Date().toISOString(),
    };

    const keyboard = client.createInvoiceKeyboard(mockInvoice);
    expect(keyboard.inline_keyboard).toHaveLength(2);

    // Button 1: Web App payment button
    const payBtn = keyboard.inline_keyboard[0][0];
    expect(payBtn.text).toContain("Pay with Crypto");
    expect(payBtn.web_app?.url).toBe("https://kkhay.com/gateway/invoice/inv_12345");

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
      status: "WAITING",
      checkoutUrl: "https://kkhay.com/gateway/invoice/inv_12345",
      createdAt: new Date().toISOString(),
    };

    const keyboard = client.createInvoiceKeyboard(mockInvoice, { useMiniApp: false });
    const payBtn = keyboard.inline_keyboard[0][0];
    expect(payBtn.url).toBe("https://kkhay.com/gateway/invoice/inv_12345");
    expect(payBtn.web_app).toBeUndefined();
  });

  it("should format formatted HTML message for Telegram with 190+ chains", () => {
    const client = new KkhayTelegram({ apiKey: dummyApiKey });
    const mockInvoice: InvoiceData = {
      id: "inv_12345",
      orderId: "order_999",
      amount: 25.0,
      currency: "USDT",
      status: "WAITING",
      checkoutUrl: "https://kkhay.com/gateway/invoice/inv_12345",
      createdAt: new Date().toISOString(),
    };

    const result = client.formatInvoiceMessage(mockInvoice);
    expect(result.text).toContain("25.00 USDT");
    expect(result.text).toContain("order_999");
    expect(result.text).toContain("190+ Chains");
    expect(result.parse_mode).toBe("HTML");
    expect(result.reply_markup).toBeDefined();
  });

  it("should create invoice calling /v1/gateway/invoices", async () => {
    const mockResponse = {
      ok: true,
      invoice: {
        id: "inv_gateway_1",
        gatewayId: "gw_123",
        amount: 50.0,
        currency: "USD",
        status: "WAITING",
        hostedUrl: "https://kkhay.com/gateway/invoice/inv_gateway_1",
        createdAt: "2026-10-26T00:00:00Z",
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockResponse),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new KkhayTelegram({ apiKey: dummyApiKey });
    const invoice = await client.createInvoice({
      amount: 50.0,
      currency: "USD",
      payNetwork: "solana",
      payToken: "USDC",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.kkhay.com/v1/gateway/invoices");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": dummyApiKey,
      "User-Agent": "@kkhay/telegram/1.0.4 (Node.js)",
    });

    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    expect(body.payNetwork).toBe("solana");
    expect(body.payToken).toBe("USDC");

    expect(invoice.id).toBe("inv_gateway_1");
    expect(invoice.gatewayId).toBe("gw_123");
    expect(invoice.checkoutUrl).toBe("https://kkhay.com/gateway/invoice/inv_gateway_1");
  });

  it("should get invoice calling /v1/gateway/invoices/:id", async () => {
    const mockResponse = {
      ok: true,
      data: {
        id: "inv_status_check",
        gatewayId: "gw_456",
        amount: 100.0,
        currency: "USDT",
        status: "PAID",
        hostedUrl: "https://kkhay.com/gateway/invoice/inv_status_check",
        createdAt: "2026-10-26T00:00:00Z",
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockResponse),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new KkhayTelegram({ apiKey: dummyApiKey });
    const invoice = await client.getInvoice("inv_status_check");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.kkhay.com/v1/gateway/invoices/inv_status_check");
    expect(options.method).toBe("GET");
    expect(invoice.id).toBe("inv_status_check");
    expect(invoice.status).toBe("PAID");
  });

  it("should check health calling /health", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new KkhayTelegram({ apiKey: dummyApiKey });
    const health = await client.checkHealth();
    expect(health.status).toBe("ok");
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
