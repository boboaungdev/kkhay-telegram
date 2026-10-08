/**
 * @fileoverview grammY adapter for @kkhay/telegram
 * @license MIT
 */

import type { Context, Middleware, MiddlewareFn } from "grammy";
import { KkhayTelegram } from "../client.js";
import type {
  CreateInvoiceInput,
  InvoiceData,
  KkhayConfig,
  TelegramInvoiceRenderOptions,
} from "../types.js";

export interface KkhayGrammyContextFlavor {
  kkhay: KkhayTelegram;
}

export interface KkhayGrammyOptions extends KkhayConfig {
  renderOptions?: TelegramInvoiceRenderOptions;
}

/**
 * Creates grammY middleware for K Khay Crypto Payments.
 */
export function kkhayPlugin<C extends Context = Context>(
  options: KkhayGrammyOptions
): MiddlewareFn<C & KkhayGrammyContextFlavor> {
  const client = new KkhayTelegram(options);

  return async (ctx, next) => {
    (ctx as any).kkhay = client;

    // Handle "Check Status" callback query
    if (ctx.callbackQuery?.data?.startsWith("kkhay_check:")) {
      const invoiceId = ctx.callbackQuery.data.split(":")[1];
      if (invoiceId) {
        try {
          const invoice = await client.getInvoice(invoiceId);

          if (invoice.status === "PAID" || invoice.status === "CONFIRMED") {
            const paidText = client.formatPaidMessage(invoice);
            await ctx.editMessageText(paidText, {
              parse_mode: "HTML",
              reply_markup: undefined,
            });
            await ctx.answerCallbackQuery({
              text: "✅ Payment confirmed! Thank you.",
              show_alert: true,
            });
            return;
          } else {
            await ctx.answerCallbackQuery({
              text: `Status: ${invoice.status || "PENDING"} (Waiting for blockchain confirmation)`,
              show_alert: true,
            });
            return;
          }
        } catch (err: any) {
          await ctx.answerCallbackQuery({
            text: `Error checking status: ${err.message}`,
            show_alert: true,
          });
          return;
        }
      }
    }

    // Handle "Cancel" callback query
    if (ctx.callbackQuery?.data?.startsWith("kkhay_cancel:")) {
      await ctx.editMessageText("❌ <i>Invoice cancelled.</i>", {
        parse_mode: "HTML",
        reply_markup: undefined,
      });
      await ctx.answerCallbackQuery({ text: "Invoice cancelled." });
      return;
    }

    return next();
  };
}

/**
 * High-level helper to send a K Khay invoice message in grammY.
 */
export async function sendKkhayInvoice(
  ctx: Context,
  client: KkhayTelegram,
  input: CreateInvoiceInput,
  renderOptions?: TelegramInvoiceRenderOptions
): Promise<InvoiceData> {
  // Extract Telegram user details if available
  const customer = {
    telegramUserId: ctx.from?.id,
    telegramUsername: ctx.from?.username,
    name: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || undefined,
    ...input.customer,
  };

  const invoice = await client.createInvoice({
    ...input,
    customer,
  });

  const formatted = client.formatInvoiceMessage(invoice, renderOptions);

  await ctx.reply(formatted.text, {
    parse_mode: formatted.parse_mode as any,
    reply_markup: formatted.reply_markup as any,
  });

  return invoice;
}

