/**
 * @fileoverview Type definitions for @kkhay/telegram
 * @license MIT
 */

export type InvoiceStatus =
  | "WAITING"
  | "PAID"
  | "EXPIRED"
  | "CANCELED"
  | "PENDING"
  | "CONFIRMED"
  | "PARTIAL"
  | "CANCELLED";

export type CryptoNetwork =
  | "bsc"
  | "polygon"
  | "arbitrum"
  | "base"
  | "ethereum"
  | "solana"
  | "ton"
  | "tron"
  | "bitcoin"
  | "xrpl"
  | "dogecoin"
  | "litecoin"
  | (string & {});

export type CryptoToken =
  | "USDT"
  | "USDC"
  | "BTC"
  | "ETH"
  | "SOL"
  | "TON"
  | "BNB"
  | "DOGE"
  | "XRP"
  | "TRX"
  | "LTC"
  | (string & {});

export interface KkhayConfig {
  /**
   * K Khay Gateway API Key.
   * Obtain from your K Khay Gateway Dashboard under API Keys.
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
   * Price amount alias.
   */
  priceAmount?: number;

  /**
   * Price currency alias.
   */
  priceCurrency?: string;

  /**
   * Pre-selected crypto network (e.g., bsc, solana, ton, tron, polygon).
   */
  payNetwork?: CryptoNetwork | string;

  /**
   * Pre-selected crypto token (e.g., USDT, USDC, BTC, SOL).
   */
  payToken?: CryptoToken | string;

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
   * Custom redirect URL alias.
   */
  redirectUrl?: string;

  /**
   * Custom cancel URL.
   */
  cancelUrl?: string;

  /**
   * Webhook URL to receive IPN notifications.
   */
  callbackUrl?: string;
}

export interface InvoiceData {
  id: string;
  gatewayId?: string;
  gateway_id?: string;
  orderId: string;
  amount: number;
  currency: string;
  priceAmount?: number;
  priceCurrency?: string;
  payAmount?: string;
  payToken?: string;
  payNetwork?: string;
  status: InvoiceStatus | string;
  checkoutUrl: string;
  hostedUrl?: string;
  depositAddress?: string;
  network?: CryptoNetwork | string;
  amountPaid?: number;
  txHash?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface InvoiceResponse {
  ok?: boolean;
  data?: InvoiceData;
  invoice?: InvoiceData;
  id?: string;
  gatewayId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  status?: InvoiceStatus | string;
  checkoutUrl?: string;
  hostedUrl?: string;
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
   * @default "💳 Pay with Crypto (190+ Chains)"
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
