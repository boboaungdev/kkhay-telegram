/**
 * @fileoverview Type definitions for @kkhay/telegram
 * @license MIT
 */

export type InvoiceStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PAID"
  | "PARTIAL"
  | "EXPIRED"
  | "CANCELLED";

export interface KkhayConfig {
  /**
   * K Khay Merchant API Key.
   * Obtain from your K Khay Merchant Dashboard under API Keys.
   */
  apiKey: string;

  /**
   * Base API endpoint.
   * @default "https://api.kkhay.com"
   */
  baseUrl?: string;

  /**
   * Webhook secret used for HMAC-SHA256 signature verification.
   */
  webhookSecret?: string;

  /**
   * Default currency code.
   * @default "USD"
   */
  defaultCurrency?: string;

  /**
   * Request timeout in milliseconds.
   * @default 15000
   */
  timeout?: number;
}

export interface CustomerDetails {
  name?: string;
  email?: string;
  telegramUserId?: number | string;
  telegramUsername?: string;
}

export interface CreateInvoiceInput {
  /**
   * Unique order/reference ID on your system.
   */
  orderId?: string;

  /**
   * Invoice amount (e.g., 25.00).
   */
  amount: number;

  /**
   * 3-letter currency code (e.g., USD, EUR, USDT).
   * @default "USD"
   */
  currency?: string;

  /**
   * Invoice title shown to customer.
   */
  title?: string;

  /**
   * Detailed description of purchase.
   */
  description?: string;

  /**
   * Customer details (supports telegram user info).
   */
  customer?: CustomerDetails;

  /**
   * Custom key-value metadata to attach to invoice.
   */
  metadata?: Record<string, unknown>;

  /**
   * Custom return URL after completion.
   */
  returnUrl?: string;

  /**
   * Webhook URL to receive IPN notifications.
   */
  callbackUrl?: string;
}

export interface InvoiceData {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  checkoutUrl: string;
  createdAt: string;
  expiresAt?: string;
  txHash?: string;
  network?: string;
  amountPaid?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface InvoiceResponse {
  ok?: boolean;
  data?: InvoiceData;
  id?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  status?: InvoiceStatus;
  checkoutUrl?: string;
  paymentUrl?: string;
  [key: string]: unknown;
}

export interface TelegramInvoiceRenderOptions {
  /**
   * Whether to open checkout inside a Telegram Mini App (TMA) WebView.
   * If true, uses `{ web_app: { url } }`.
   * If false, opens standard browser URL link.
   * @default true
   */
  useMiniApp?: boolean;

  /**
   * Custom text for the payment button.
   * @default "💳 Pay with Crypto (USDT, USDC, BNB, ETH)"
   */
  payButtonText?: string;

  /**
   * Custom text for status check button.
   * @default "🔄 Check Status"
   */
  checkStatusButtonText?: string;

  /**
   * Whether to include a cancel button.
   * @default false
   */
  showCancelButton?: boolean;

  /**
   * Custom cancel button text.
   * @default "❌ Cancel"
   */
  cancelButtonText?: string;

  /**
   * Message formatting style.
   * @default "HTML"
   */
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  web_app?: { url: string };
  callback_data?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface FormattedMessageResult {
  text: string;
  reply_markup: InlineKeyboardMarkup;
  parse_mode: "HTML" | "Markdown" | "MarkdownV2";
}

export interface WebhookEvent<T = Record<string, unknown>> {
  event:
    | "invoice.paid"
    | "invoice.completed"
    | "invoice.partial"
    | "invoice.expired"
    | "invoice.cancelled"
    | string;
  data: InvoiceData & T;
  timestamp?: number | string;
}

export interface WebhookHandlerCallbacks {
  onPaid?: (event: WebhookEvent) => Promise<void> | void;
  onPartial?: (event: WebhookEvent) => Promise<void> | void;
  onExpired?: (event: WebhookEvent) => Promise<void> | void;
  onCancelled?: (event: WebhookEvent) => Promise<void> | void;
  onAny?: (event: WebhookEvent) => Promise<void> | void;
}

