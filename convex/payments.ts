import { v } from "convex/values";
import Stripe from "stripe";
import { getShowtimePrice } from "../lib/showtimePricing";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  httpAction,
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { authComponent } from "./auth";

const PAYMENT_HOLD_DURATION_MS = 15 * 60 * 1000;
const STRIPE_RECONCILIATION_DELAYS_MS = [60 * 1000, 5 * 60 * 1000, 14 * 60 * 1000];

type StripeReconciliationResult =
  | { status: "completed" }
  | { status: "failed"; reason: string }
  | { status: "expired" }
  | { status: "ignored" }
  | { status: "missing" }
  | { status: "pending"; paymentStatus: string; checkoutStatus: string | null }
  | { status: "missing_config" }
  | { status: "error" };

const isReservationHeldByUser = (
  reservation: Doc<"seatReservations">,
  userId: string,
  now: number
) => {
  return (
    reservation.reservedByUserId === userId &&
    reservation.status === "held" &&
    reservation.holdExpiresAt !== undefined &&
    reservation.holdExpiresAt > now
  );
};

const patchCheckoutStatus = async (
  ctx: MutationCtx,
  checkoutId: Id<"paymentCheckouts">,
  status: "completed" | "expired" | "failed",
  extras: Partial<Doc<"paymentCheckouts">> = {}
) => {
  await ctx.db.patch(checkoutId, {
    status,
    updatedAt: Date.now(),
    ...extras,
  });
};

const finalizeCheckout = async (
  ctx: MutationCtx,
  checkout: Doc<"paymentCheckouts">,
  stripeCheckoutSessionId: string,
  stripePaymentIntentId?: string
) => {
  if (checkout.status === "completed") {
    return { status: "completed" as const };
  }

  const now = Date.now();

  for (const item of checkout.items) {
    const reservations = await ctx.db
      .query("seatReservations")
      .withIndex("sessionId", (query) => query.eq("sessionId", item.sessionId))
      .collect();

    const relevantReservations = reservations.filter(
      (reservation) =>
        reservation.reservedByUserId === checkout.userId &&
        item.seatLabels.includes(reservation.seatLabel)
    );

    if (relevantReservations.length !== item.seatLabels.length) {
      await patchCheckoutStatus(ctx, checkout._id, "failed");
      return { status: "failed" as const, reason: "missing_reservations" };
    }

    const hasExpiredHold = relevantReservations.some(
      (reservation) =>
        reservation.status === "held" &&
        (reservation.holdExpiresAt === undefined || reservation.holdExpiresAt <= now)
    );

    if (hasExpiredHold) {
      await patchCheckoutStatus(ctx, checkout._id, "failed");
      return { status: "failed" as const, reason: "expired_hold" };
    }

    for (const reservation of relevantReservations) {
      if (reservation.status !== "confirmed") {
        await ctx.db.patch(reservation._id, {
          status: "confirmed",
        });
      }
    }
  }

  await patchCheckoutStatus(ctx, checkout._id, "completed", {
    completedAt: now,
    stripeCheckoutSessionId,
    stripePaymentIntentId,
  });

  return { status: "completed" as const };
};

export const prepareCheckout = mutation({
  args: {
    bookingIds: v.array(v.id("showSessions")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);

    if (!user) {
      throw new Error("You must be signed in to complete checkout.");
    }

    const uniqueBookingIds = Array.from(new Set(args.bookingIds));

    if (uniqueBookingIds.length === 0) {
      throw new Error("Select at least one held booking to continue.");
    }

    const now = Date.now();
    const expiresAt = now + PAYMENT_HOLD_DURATION_MS;
    const items: Doc<"paymentCheckouts">["items"] = [];

    for (const bookingId of uniqueBookingIds) {
      const session = await ctx.db.get(bookingId);

      if (!session) {
        throw new Error("A selected booking could not be found.");
      }

      const reservations = await ctx.db
        .query("seatReservations")
        .withIndex("sessionId", (query) => query.eq("sessionId", bookingId))
        .collect();

      const activeHeldReservations = reservations.filter((reservation) =>
        isReservationHeldByUser(reservation, user._id, now)
      );

      if (activeHeldReservations.length === 0) {
        throw new Error(
          `Your hold for ${session.movieTitle} at ${session.time} is no longer active.`
        );
      }

      const seatLabels = activeHeldReservations
        .map((reservation) => reservation.seatLabel)
        .sort((left, right) => left.localeCompare(right));
      const seatPrice = getShowtimePrice(session.time);
      const totalPrice = seatPrice * seatLabels.length;

      for (const reservation of activeHeldReservations) {
        await ctx.db.patch(reservation._id, {
          holdExpiresAt: expiresAt,
        });

        await ctx.scheduler.runAfter(
          PAYMENT_HOLD_DURATION_MS,
          internal.showSessions.releaseExpiredSeatHold,
          {
            reservationId: reservation._id,
            expectedExpiresAt: expiresAt,
          }
        );
      }

      items.push({
        sessionId: bookingId,
        movieId: session.movieId,
        movieTitle: session.movieTitle,
        posterPath: session.posterPath,
        date: session.date,
        time: session.time,
        seatLabels,
        seatPrice,
        totalPrice,
      });
    }

    const totalPrice = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const seatCount = items.reduce((sum, item) => sum + item.seatLabels.length, 0);

    const checkoutId = await ctx.db.insert("paymentCheckouts", {
      userId: user._id,
      status: "pending",
      currency: "usd",
      seatCount,
      totalPrice,
      expiresAt,
      items,
      createdAt: now,
      updatedAt: now,
    });

    return {
      checkoutId,
      customerEmail: user.email,
      currency: "usd",
      expiresAt,
      items,
      totalPrice,
    };
  },
});

export const attachStripeCheckoutSession = mutation({
  args: {
    checkoutId: v.id("paymentCheckouts"),
    stripeCheckoutSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);

    if (!user) {
      throw new Error("You must be signed in to update checkout.");
    }

    const checkout = await ctx.db.get(args.checkoutId);

    if (!checkout || checkout.userId !== user._id) {
      throw new Error("Checkout session not found.");
    }

    if (checkout.status !== "pending") {
      throw new Error("This checkout is no longer pending.");
    }

    await ctx.db.patch(args.checkoutId, {
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      updatedAt: Date.now(),
    });

    for (const delayMs of STRIPE_RECONCILIATION_DELAYS_MS) {
      await ctx.scheduler.runAfter(delayMs, internal.payments.reconcileStripeCheckout, {
        checkoutId: args.checkoutId,
        stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      });
    }

    return { ok: true };
  },
});

export const getMyCheckoutByStripeSessionId = query({
  args: {
    stripeCheckoutSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);

    if (!user) {
      return null;
    }

    const checkout = await ctx.db
      .query("paymentCheckouts")
      .withIndex("stripeCheckoutSessionId", (query) =>
        query.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
      )
      .unique();

    if (!checkout || checkout.userId !== user._id) {
      return null;
    }

    return checkout;
  },
});

export const confirmPaidCheckout = mutation({
  args: {
    checkoutId: v.optional(v.id("paymentCheckouts")),
    stripeCheckoutSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);

    if (!user) {
      throw new Error("You must be signed in to confirm checkout.");
    }

    const checkout = args.checkoutId
      ? await ctx.db.get(args.checkoutId)
      : await ctx.db
          .query("paymentCheckouts")
          .withIndex("stripeCheckoutSessionId", (query) =>
            query.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
          )
          .unique();

    if (!checkout || checkout.userId !== user._id) {
      throw new Error("Checkout session not found.");
    }

    if (checkout.status === "expired" || checkout.status === "failed") {
      return { status: checkout.status };
    }

    return finalizeCheckout(
      ctx,
      checkout,
      args.stripeCheckoutSessionId,
      args.stripePaymentIntentId
    );
  },
});

export const completeStripeCheckout = internalMutation({
  args: {
    checkoutId: v.optional(v.id("paymentCheckouts")),
    stripeCheckoutSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const checkout = args.checkoutId
      ? await ctx.db.get(args.checkoutId)
      : await ctx.db
          .query("paymentCheckouts")
          .withIndex("stripeCheckoutSessionId", (query) =>
            query.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
          )
          .unique();

    if (!checkout) {
      return { status: "missing" as const };
    }

    return finalizeCheckout(
      ctx,
      checkout,
      args.stripeCheckoutSessionId,
      args.stripePaymentIntentId
    );
  },
});

export const expireStripeCheckout = internalMutation({
  args: {
    stripeCheckoutSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const checkout = await ctx.db
      .query("paymentCheckouts")
      .withIndex("stripeCheckoutSessionId", (query) =>
        query.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
      )
      .unique();

    if (!checkout || checkout.status !== "pending") {
      return { status: "ignored" as const };
    }

    await patchCheckoutStatus(ctx, checkout._id, "expired");
    return { status: "expired" as const };
  },
});

export const reconcileStripeCheckout: ReturnType<typeof internalAction> = internalAction({
  args: {
    checkoutId: v.id("paymentCheckouts"),
    stripeCheckoutSessionId: v.string(),
  },
  handler: async (ctx, args): Promise<StripeReconciliationResult> => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      console.error("Missing STRIPE_SECRET_KEY for Stripe reconciliation.");
      return { status: "missing_config" as const };
    }

    try {
      const stripe = new Stripe(stripeSecretKey);
      const session = await stripe.checkout.sessions.retrieve(
        args.stripeCheckoutSessionId
      );

      if (session.payment_status === "paid" && session.status === "complete") {
        return await ctx.runMutation(internal.payments.completeStripeCheckout, {
          checkoutId: args.checkoutId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : undefined,
        });
      }

      if (session.status === "expired") {
        return await ctx.runMutation(internal.payments.expireStripeCheckout, {
          stripeCheckoutSessionId: session.id,
        });
      }

      return {
        status: "pending" as const,
        paymentStatus: session.payment_status,
        checkoutStatus: session.status,
      };
    } catch (error) {
      console.error("Stripe reconciliation failed.", error);
      return { status: "error" as const };
    }
  },
});

export const stripeWebhook = httpAction(async (ctx, request) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error("Stripe webhook invoked without complete Stripe configuration.");
    return new Response("Stripe is not configured.", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing Stripe signature.", { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Invalid Stripe webhook signature.", error);
    return new Response("Invalid Stripe signature.", { status: 400 });
  }

  console.info(`Received Stripe webhook event ${event.type}.`);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await ctx.runMutation(internal.payments.completeStripeCheckout, {
      checkoutId:
        typeof session.metadata?.convexCheckoutId === "string"
          ? (session.metadata.convexCheckoutId as Id<"paymentCheckouts">)
          : undefined,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : undefined,
    });
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    await ctx.runMutation(internal.payments.expireStripeCheckout, {
      stripeCheckoutSessionId: session.id,
    });
  }

  return new Response("ok", { status: 200 });
});