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
  InvoiceResponse,
  KkhayConfig,
  TelegramInvoiceRenderOptions,
  WebhookEvent,
} from "./types.js";

export class KkhayTelegram {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly webhookSecret?: string;
  private readonly defaultCurrency: string;
  private readonly timeout: number;

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
          "User-Agent": "@kkhay/telegram/1.0.0 (Node.js)",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || response.statusText || "API Error";
        throw new Error(`K Khay API error (${response.status}): ${errorMsg}`);
      }

      return data as T;
    } catch (err: any) {
      if (err.name === "AbortError") {
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
      amount: input.amount,
      currency: (input.currency || this.defaultCurrency).toUpperCase(),
      title: input.title || `Invoice #${input.orderId || "Payment"}`,
      description: input.description,
      customer: input.customer,
      metadata: {
        source: "telegram",
        ...input.metadata,
      },
      returnUrl: input.returnUrl,
      callbackUrl: input.callbackUrl,
    };

    const res = await this.request<InvoiceResponse>("/v1/merchant/invoices", "POST", payload);

    const invoice: InvoiceData =
      (res.data as InvoiceData) ||
      ({
        id: res.id || (res as any).invoiceId,
        orderId: res.orderId || payload.orderId,
        amount: res.amount || payload.amount,
        currency: res.currency || payload.currency,
        status: (res.status as any) || "PENDING",
        checkoutUrl: res.checkoutUrl || res.paymentUrl || (res as any).url,
        createdAt: new Date().toISOString(),
      } as InvoiceData);

    if (!invoice.checkoutUrl) {
      throw new Error("K Khay API did not return a checkoutUrl for the invoice.");
    }

    return invoice;
  }

  /**
   * Retrieve invoice status.
   */
  public async getInvoice(invoiceId: string): Promise<InvoiceData> {
    const res = await this.request<InvoiceResponse>(
      `/v1/merchant/invoices/${encodeURIComponent(invoiceId.trim())}`,
      "GET"
    );

    return (
      (res.data as InvoiceData) ||
      ({
        id: res.id || invoiceId,
        orderId: res.orderId,
        amount: res.amount,
        currency: res.currency,
        status: res.status,
        checkoutUrl: res.checkoutUrl || res.paymentUrl,
        createdAt: (res as any).createdAt || new Date().toISOString(),
      } as InvoiceData)
    );
  }

  /**
   * Builds an inline keyboard markup for a Telegram message.
   */
  public createInvoiceKeyboard(
    invoice: InvoiceData,
    options: TelegramInvoiceRenderOptions = {}
  ): InlineKeyboardMarkup {
    const useMiniApp = options.useMiniApp ?? true;
    const payText = options.payButtonText || "💳 Pay with Crypto (USDT, USDC, BNB, ETH)";
    const checkText = options.checkStatusButtonText || "🔄 Check Status";

    const payButton = useMiniApp
      ? { text: payText, web_app: { url: invoice.checkoutUrl } }
      : { text: payText, url: invoice.checkoutUrl };

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
      `⚡ <b>Supported:</b> USDT, USDC, BNB, ETH`,
      `🌐 <b>Networks:</b> BSC, Polygon, Arbitrum, Base, Ethereum`,
      `⏳ <b>Status:</b> <b>${invoice.status || "PENDING"}</b>`,
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
    const txHash = invoice.txHash ? `<code>${invoice.txHash.substring(0, 10)}...${invoice.txHash.slice(-8)}</code>` : "Confirmed";

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

