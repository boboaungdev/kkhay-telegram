# @kkhay/telegram

[![npm version](https://img.shields.io/npm/v/@kkhay/telegram.svg?color=10b981)](https://www.npmjs.com/package/@kkhay/telegram)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-3178C6.svg)](https://www.typescriptlang.org/)
[![grammY](https://img.shields.io/badge/grammY-Plugin-2CA5E0.svg)](https://grammy.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933.svg)](https://nodejs.org/)

The official **grammY & Telegram Mini Apps (TMA)** crypto payment gateway SDK for **[K Khay](https://kkhay.com)**.

Accept non-custodial and custodial crypto payments (**USDT, USDC, BNB, ETH** across **BNB Smart Chain, Polygon, Arbitrum, Base, and Ethereum**) directly in your Telegram bots and Mini Apps with **instant on-chain verification** and **zero chargebacks**.

---

## 🌟 Features

* **100% TypeScript**: Built from the ground up for **[grammY](https://grammy.dev)** with strict type safety and autocomplete.
* **Telegram Mini App (TMA) Native**: Opens checkout directly in Telegram's popup/full-screen WebApp (`web_app: { url }`) — users never leave Telegram!
* **Multi-Chain Stablecoins**: Accept **USDT** & **USDC** across BSC, Polygon, Arbitrum, Base, and Ethereum mainnet.
* **Native Tokens**: Accept **BNB** and **ETH** natively.
* **Interactive Inline Keyboards**: Automatic message formatting with dynamic payment buttons, status re-checkers, and cancellation handlers.
* **Auto-Message Updates**: Clicking **"🔄 Check Status"** queries the blockchain and edits the Telegram message to *"✅ Payment Confirmed!"* in real time.
* **Cryptographic IPN Webhooks**: Built-in HMAC-SHA256 signature verification and event dispatching.
* **Dual ESM / CJS**: Modern ES modules and CommonJS distribution.

---

## 📦 Installation

```bash
# npm
npm install @kkhay/telegram grammy

# pnpm
pnpm add @kkhay/telegram grammy

# yarn
yarn add @kkhay/telegram grammy
```

---

## 🚀 Quickstart

```typescript
import { Bot } from "grammy";
import { KkhayTelegram, kkhayPlugin, sendKkhayInvoice } from "@kkhay/telegram";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
const kkhay = new KkhayTelegram({
  apiKey: process.env.KKHAY_API_KEY!,
  webhookSecret: process.env.KKHAY_WEBHOOK_SECRET,
});

// 1. Install K Khay plugin to handle status button clicks & auto-message updates
bot.use(kkhayPlugin({ apiKey: process.env.KKHAY_API_KEY! }));

// 2. Command to create and send a crypto invoice
bot.command("buy", async (ctx) => {
  await sendKkhayInvoice(ctx, kkhay, {
    title: "1 Month VIP Membership",
    description: "Access to private trading signals channel",
    amount: 15.00,
    currency: "USD",
    metadata: {
      planId: "vip_monthly",
      userId: ctx.from?.id,
    },
  });
});

bot.start();
```

---

## 📱 Telegram Mini App (TMA) vs External Browser Link

By default, `@kkhay/telegram` renders payment buttons using **Telegram Mini App WebViews** (`web_app: { url }`), allowing customers to complete payment without switching apps.

If you prefer opening the checkout in an external browser instead, simply pass `useMiniApp: false`:

```typescript
await sendKkhayInvoice(ctx, kkhay, {
  title: "Game Item Pack",
  amount: 9.99,
  currency: "USD",
}, {
  useMiniApp: false, // Opens standard external browser link
  payButtonText: "💳 Pay in Browser ↗",
});
```

---

## 🛡️ Webhook Handling & Auto-Fulfillment

Handle incoming webhook notifications securely using `KkhayWebhookHandler`:

```typescript
import express from "express";
import { KkhayTelegram, KkhayWebhookHandler } from "@kkhay/telegram";

const app = express();
const kkhay = new KkhayTelegram({
  apiKey: process.env.KKHAY_API_KEY!,
  webhookSecret: process.env.KKHAY_WEBHOOK_SECRET!,
});

const webhookHandler = new KkhayWebhookHandler(kkhay, {
  onPaid: async (event) => {
    const { orderId, amount, currency, metadata } = event.data;
    console.log(`✅ Order #${orderId} paid: ${amount} ${currency}`);

    // Grant user VIP role or deliver digital item!
    const telegramUserId = metadata?.userId;
    // bot.api.sendMessage(telegramUserId, "🎉 Your VIP membership is active!");
  },
  onPartial: async (event) => {
    console.warn(`⚠️ Underpaid order:`, event.data);
  },
  onExpired: async (event) => {
    console.log(`⌛ Invoice expired:`, event.data.orderId);
  },
});

app.post("/webhook/kkhay", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-kkhay-signature"] as string;

  try {
    await webhookHandler.handle(req.body, signature);
    res.status(200).json({ received: true });
  } catch (err: any) {
    res.status(400).send(`Webhook error: ${err.message}`);
  }
});

app.listen(3000, () => console.log("Webhook listener running on port 3000"));
```

---

## ⚙️ Configuration Reference

### `KkhayConfig`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiKey` | `string` | **Required** | Your K Khay Merchant API Key. |
| `baseUrl` | `string` | `https://api.kkhay.com` | Custom self-hosted gateway URL if applicable. |
| `webhookSecret` | `string` | `undefined` | Secret key used for HMAC-SHA256 signature verification. |
| `defaultCurrency` | `string` | `USD` | Default 3-letter currency code for invoices. |
| `timeout` | `number` | `15000` | HTTP request timeout in milliseconds. |

---

## 📄 License

This library is licensed under the [MIT License](LICENSE).

---

## 💬 Community & Support

* **Website**: [https://kkhay.com](https://kkhay.com)
* **GitHub Issues**: [https://github.com/boboaungdev/kkhay-telegram/issues](https://github.com/boboaungdev/kkhay-telegram/issues)
* **Telegram**: [@kkhaysupport](https://t.me/kkhay)
