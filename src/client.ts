/**
 * @fileoverview Core Kkhay Telegram Client
 * @license MIT
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateInvoiceInput,
  FormattedMessageResult,
  InlineKeyboardMarkup,
  InvoiceData,
  InvoiceStatus,
  KkhayConfig,
  TelegramInvoiceRenderOptions,
  WebhookEvent,
} from "./types.js";

function normalizeInvoice(raw: unknown): InvoiceData {
  const inv = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hostedUrl =
    typeof inv.hostedUrl === "string"
      ? inv.hostedUrl
      : typeof inv.checkoutUrl === "string"
      ? inv.checkoutUrl
      : typeof inv.paymentUrl === "string"
      ? inv.paymentUrl
      : undefined;
  const checkoutUrl = hostedUrl || "https://kkhay.com/pay";
  const amount = Number(inv.amount ?? inv.priceAmount ?? 0);
  const currency = String(inv.currency ?? inv.priceCurrency ?? "USD").toUpperCase();

  return {
    ...inv,
    id: String(inv.id || inv.invoiceId || ""),
    gatewayId: inv.gatewayId || inv.gateway_id ? String(inv.gatewayId || inv.gateway_id) : undefined,
    gateway_id: inv.gateway_id || inv.gatewayId ? String(inv.gateway_id || inv.gatewayId) : undefined,
    orderId: String(inv.orderId || inv.id || ""),
    amount,
    currency,
    priceAmount: inv.priceAmount !== undefined ? Number(inv.priceAmount) : amount,
    priceCurrency: inv.priceCurrency !== undefined ? String(inv.priceCurrency).toUpperCase() : currency,
    payAmount: inv.payAmount !== undefined ? String(inv.payAmount) : undefined,
    payToken: inv.payToken !== undefined ? String(inv.payToken) : undefined,
    payNetwork: inv.payNetwork !== undefined ? String(inv.payNetwork) : undefined,
    status: (inv.status as InvoiceStatus) || "WAITING",
    checkoutUrl,
    hostedUrl,
    depositAddress: typeof inv.depositAddress === "string" ? inv.depositAddress : undefined,
    network:
      typeof inv.network === "string"
        ? inv.network
        : typeof inv.payNetwork === "string"
        ? inv.payNetwork
        : undefined,
    amountPaid: inv.amountPaid !== undefined ? Number(inv.amountPaid) : undefined,
    txHash: typeof inv.txHash === "string" ? inv.txHash : undefined,
    createdAt: typeof inv.createdAt === "string" ? inv.createdAt : new Date().toISOString(),
    expiresAt: typeof inv.expiresAt === "string" ? inv.expiresAt : undefined,
    metadata:
      typeof inv.metadata === "object" && inv.metadata !== null
        ? (inv.metadata as Record<string, unknown>)
        : undefined,
  };
}

export class KkhayTelegram {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly webhookSecret?: string;
  readonly defaultCurrency: string;
  readonly timeout: number;

  constructor(config: KkhayConfig) {
    if (!config.apiKey || typeof config.apiKey !== "string") {
      throw new Error("KkhayTelegram requires a valid apiKey string.");
    }

    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || "https://api.kkhay.com").replace(/\/+$/, "");
    this.webhookSecret = config.webhookSecret?.trim();
    this.defaultCurrency = (config.defaultCurrency || "USD").toUpperCase();
    this.timeout = config.timeout || 15000;
  }

  private buildUrl(path: string): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (this.baseUrl.endsWith("/api") || this.baseUrl.includes("api.")) {
      return `${this.baseUrl}${cleanPath}`;
    }
    return `${this.baseUrl}/api${cleanPath}`;
  }

  /**
   * Internal HTTP request helper.
   */
  private async request<T = unknown>(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: unknown
  ): Promise<T> {
    const url = this.buildUrl(path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "User-Agent": "@kkhay/telegram/1.0.4 (Node.js)",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const errorMsg =
          (typeof data.message === "string" ? data.message : undefined) ||
          (typeof data.error === "string" ? data.error : undefined) ||
          response.statusText ||
          "API Error";
        throw new Error(`K Khay API error (${response.status}): ${errorMsg}`);
      }

      return data as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`K Khay API request timed out after ${this.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Create a crypto checkout invoice.
   */
  public async createInvoice(input: CreateInvoiceInput): Promise<InvoiceData> {
    const payload = {
      orderId: input.orderId || `tg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount: input.amount ?? input.priceAmount,
      currency: (input.currency || input.priceCurrency || this.defaultCurrency).toUpperCase(),
      priceAmount: input.priceAmount ?? input.amount,
      priceCurrency: (input.priceCurrency || input.currency || this.defaultCurrency).toUpperCase(),
      payNetwork: input.payNetwork,
      payToken: input.payToken,
      title: input.title || `Invoice #${input.orderId || "Payment"}`,
      description: input.description,
      customer: input.customer,
      metadata: {
        source: "telegram",
        ...input.metadata,
      },
      returnUrl: input.returnUrl || input.redirectUrl,
      redirectUrl: input.redirectUrl || input.returnUrl,
      cancelUrl: input.cancelUrl,
      callbackUrl: input.callbackUrl,
    };

    const res = await this.request<Record<string, unknown>>("/v1/gateway/invoices", "POST", payload);
    const raw = (res.invoice || res.data || res) as Record<string, unknown>;
    const invoice = normalizeInvoice({ ...raw, orderId: raw.orderId || payload.orderId });

    if (!invoice.checkoutUrl) {
      throw new Error("K Khay API did not return a checkoutUrl for the invoice.");
    }

    return invoice;
  }

  /**
   * Retrieve invoice status.
   */
  public async getInvoice(invoiceId: string): Promise<InvoiceData> {
    const res = await this.request<Record<string, unknown>>(
      `/v1/gateway/invoices/${encodeURIComponent(invoiceId.trim())}`,
      "GET"
    );

    const raw = (res.invoice || res.data || res) as Record<string, unknown>;
    return normalizeInvoice({ ...raw, id: raw.id || invoiceId });
  }

  /**
   * Health check for Gateway API.
   */
  public async checkHealth(): Promise<{ status: string }> {
    const res = await this.request<Record<string, unknown>>("/health", "GET");
    const data = (res.data || res) as { status: string };
    return data;
  }

  /**
   * Builds an inline keyboard markup for a Telegram message.
   */
  public createInvoiceKeyboard(
    invoice: InvoiceData,
    options: TelegramInvoiceRenderOptions = {}
  ): InlineKeyboardMarkup {
    const useMiniApp = options.useMiniApp ?? true;
    const payText = options.payButtonText || "💳 Pay with Crypto (190+ Chains)";
    const checkText = options.checkStatusButtonText || "🔄 Check Status";
    const targetUrl = invoice.hostedUrl || invoice.checkoutUrl;

    const payButton = useMiniApp
      ? { text: payText, web_app: { url: targetUrl } }
      : { text: payText, url: targetUrl };

    const checkButton = {
      text: checkText,
      callback_data: `kkhay_check:${invoice.id}`,
    };

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [[payButton], [checkButton]],
    };

    if (options.showCancelButton) {
      keyboard.inline_keyboard.push([
        {
          text: options.cancelButtonText || "❌ Cancel",
          callback_data: `kkhay_cancel:${invoice.id}`,
        },
      ]);
    }

    return keyboard;
  }

  /**
   * Formats a complete Telegram invoice message and inline keyboard ready to send via send_message.
   */
  public formatInvoiceMessage(
    invoice: InvoiceData,
    options: TelegramInvoiceRenderOptions = {}
  ): FormattedMessageResult {
    const parseMode = options.parseMode || "HTML";
    const amountStr = Number(invoice.amount).toFixed(2);
    const currencyStr = invoice.currency.toUpperCase();
    const orderTitle = invoice.orderId ? `Invoice <code>#${invoice.orderId}</code>` : "Crypto Invoice";

    const text = [
      `🧾 <b>${orderTitle}</b>`,
      ``,
      `💰 <b>Amount:</b> <code>${amountStr} ${currencyStr}</code>`,
      `⚡ <b>Supported:</b> USDT, USDC, BTC, ETH, SOL, TON, BNB, TRX, DOGE, XRP, LTC`,
      `🌐 <b>Networks:</b> 190+ Chains (BSC, Polygon, Arbitrum, Base, Ethereum, Solana, TON, Tron, Bitcoin, etc.)`,
      `⏳ <b>Status:</b> <b>${invoice.status || "WAITING"}</b>`,
      ``,
      `<i>Tap below to complete payment with instant on-chain settlement.</i>`,
    ].join("\n");

    const reply_markup = this.createInvoiceKeyboard(invoice, options);

    return {
      text,
      reply_markup,
      parse_mode: parseMode,
    };
  }

  /**
   * Formats a paid settlement confirmation message.
   */
  public formatPaidMessage(invoice: InvoiceData): string {
    const amountStr = Number(invoice.amountPaid || invoice.amount).toFixed(2);
    const network = invoice.network || "Blockchain";
    const txHash = invoice.txHash
      ? `<code>${invoice.txHash.substring(0, 10)}...${invoice.txHash.slice(-8)}</code>`
      : "Confirmed";

    return [
      `✅ <b>Payment Received!</b>`,
      ``,
      `🧾 <b>Order:</b> <code>#${invoice.orderId}</code>`,
      `💵 <b>Amount Paid:</b> <code>${amountStr} ${invoice.currency}</code>`,
      `🔗 <b>Network:</b> ${network}`,
      `🔍 <b>Tx Hash:</b> ${txHash}`,
      ``,
      `✨ <i>Thank you for your payment! Your transaction is settled on-chain.</i>`,
    ].join("\n");
  }

  /**
   * Verify cryptographic HMAC-SHA256 signature from webhook header.
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!this.webhookSecret) {
      throw new Error("Cannot verify webhook signature: webhookSecret is not configured.");
    }
    if (!signature) {
      return false;
    }

    const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
    const computed = createHmac("sha256", this.webhookSecret).update(payload).digest("hex");

    const sigBuf = Buffer.from(signature.trim(), "hex");
    const compBuf = Buffer.from(computed, "hex");

    if (sigBuf.length !== compBuf.length) {
      return false;
    }

    return timingSafeEqual(sigBuf, compBuf);
  }

  /**
   * Parse and validate webhook payload.
   */
  public parseWebhookEvent(rawBody: string | Buffer, signature?: string): WebhookEvent {
    if (this.webhookSecret) {
      if (!signature) {
        throw new Error("Missing x-kkhay-signature header.");
      }
      if (!this.verifyWebhookSignature(rawBody, signature)) {
        throw new Error("Invalid x-kkhay-signature HMAC verification failed.");
      }
    }

    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
    return JSON.parse(bodyStr) as WebhookEvent;
  }
}
