/**
 * Example Telegram Bot using grammY and @kkhay/telegram
 *
 * Usage:
 *   export TELEGRAM_BOT_TOKEN="your_bot_token"
 *   export KKHAY_API_KEY="your_kkhay_merchant_api_key"
 *   npx tsx examples/grammy-bot.ts
 */

import { Bot } from "grammy";
import { KkhayTelegram, kkhayPlugin, sendKkhayInvoice } from "../src/index.js";

const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const kkhayKey = process.env.KKHAY_API_KEY || "";

if (!botToken || !kkhayKey) {
  console.error("Please set TELEGRAM_BOT_TOKEN and KKHAY_API_KEY environment variables.");
  process.exit(1);
}

const bot = new Bot(botToken);
const kkhay = new KkhayTelegram({
  apiKey: kkhayKey,
  webhookSecret: process.env.KKHAY_WEBHOOK_SECRET,
});

// Install K Khay plugin for automatic status callbacks & cancel handling
bot.use(
  kkhayPlugin({
    apiKey: kkhayKey,
  })
);

// Welcome message
bot.command("start", async (ctx) => {
  await ctx.reply(
    `👋 <b>Welcome to K Khay Crypto Bot Demo!</b>\n\n` +
      `Commands:\n` +
      `• /buy - Purchase 1 Month VIP ($10.00 USDT/USDC/BNB/ETH)\n` +
      `• /coffee - Tip creator $3.00\n` +
      `• /pay &lt;amount&gt; - Custom payment amount`,
    { parse_mode: "HTML" }
  );
});

// Fixed product checkout
bot.command("buy", async (ctx) => {
  await sendKkhayInvoice(ctx, kkhay, {
    title: "1 Month VIP Membership",
    description: "Access to private trading signals channel",
    amount: 10.0,
    currency: "USD",
    metadata: {
      productId: "vip_1_month",
      telegramId: ctx.from?.id,
    },
  });
});

// Tip coffee
bot.command("coffee", async (ctx) => {
  await sendKkhayInvoice(ctx, kkhay, {
    title: "Buy Creator a Coffee ☕",
    amount: 3.0,
    currency: "USD",
  });
});

// Dynamic amount payment
bot.command("pay", async (ctx) => {
  const args = ctx.match?.trim();
  const amount = parseFloat(args);

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply("Usage: /pay <amount> (e.g. /pay 25)");
  }

  await sendKkhayInvoice(ctx, kkhay, {
    title: `Custom Payment of $${amount.toFixed(2)}`,
    amount,
    currency: "USD",
  });
});

console.log("🚀 Starting K Khay grammY bot...");
bot.start();

