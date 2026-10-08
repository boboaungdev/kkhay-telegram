/**
 * @fileoverview Official grammY & Telegram Mini Apps SDK for K Khay Crypto Gateway
 * @license MIT
 */

export { KkhayTelegram } from "./client.js";
export { KkhayWebhookHandler } from "./webhook.js";
export { kkhayPlugin, sendKkhayInvoice } from "./adapters/grammy.js";

export type {
  InvoiceStatus,
  KkhayConfig,
  CustomerDetails,
  CreateInvoiceInput,
  InvoiceData,
  InvoiceResponse,
  TelegramInvoiceRenderOptions,
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  FormattedMessageResult,
  WebhookEvent,
  WebhookHandlerCallbacks,
} from "./types.js";

export type { KkhayGrammyContextFlavor, KkhayGrammyOptions } from "./adapters/grammy.js";
