/**
 * @fileoverview Webhook dispatcher and utilities for @kkhay/telegram
 * @license MIT
 */

import type { KkhayTelegram } from "./client.js";
import type { WebhookEvent, WebhookHandlerCallbacks } from "./types.js";

export class KkhayWebhookHandler {
  private client: KkhayTelegram;
  private callbacks: WebhookHandlerCallbacks;

  constructor(client: KkhayTelegram, callbacks: WebhookHandlerCallbacks = {}) {
    this.client = client;
    this.callbacks = callbacks;
  }

  /**
   * Process incoming webhook request.
   *
   * @param rawBody Raw request body string or buffer.
   * @param signature Contents of x-kkhay-signature header.
   */
  public async handle(
    rawBody: string | Buffer,
    signature?: string
  ): Promise<{ status: "ok" | "ignored"; event: WebhookEvent }> {
    const event = this.client.parseWebhookEvent(rawBody, signature);

    if (this.callbacks.onAny) {
      await this.callbacks.onAny(event);
    }

    switch (event.event) {
      case "invoice.paid":
      case "invoice.completed":
        if (this.callbacks.onPaid) {
          await this.callbacks.onPaid(event);
        }
        break;

      case "invoice.partial":
        if (this.callbacks.onPartial) {
          await this.callbacks.onPartial(event);
        }
        break;

      case "invoice.expired":
        if (this.callbacks.onExpired) {
          await this.callbacks.onExpired(event);
        }
        break;

      case "invoice.cancelled":
        if (this.callbacks.onCancelled) {
          await this.callbacks.onCancelled(event);
        }
        break;

      default:
        return { status: "ignored", event };
    }

    return { status: "ok", event };
  }
}

