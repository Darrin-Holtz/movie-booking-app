import { v } from "convex/values";
import Stripe from "stripe";
import { getShowtimePrice } from "../lib/showtimePricing";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  action,
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { authComponent } from "./auth";

const PAYMENT_HOLD_DURATION_MS = 15 * 60 * 1000;
const STRIPE_RECONCILIATION_DELAYS_MS = [60 * 1000, 5 * 60 * 1000, 14 * 60 * 1000];
const SHOWTIME_TIME_ZONE = "America/New_York";

const createTicketCode = () => {
  return `QS-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
};

const parseSessionStartTime = (date: string, time: string) => {
  const [month, day, year] = date.split("-").map(Number);

  if (!month || !day || !year) {
    return 0;
  }

  const [clockTime, meridiem] = time.split(" ");
  const [rawHours, rawMinutes] = clockTime.split(":").map(Number);

  if (!rawHours || rawMinutes === undefined || !meridiem) {
    return 0;
  }

  const hours = meridiem === "PM" && rawHours !== 12
    ? rawHours + 12
    : meridiem === "AM" && rawHours === 12
      ? 0
      : rawHours;

  const utcGuess = Date.UTC(year, month - 1, day, hours, rawMinutes);
  const offset = getTimeZoneOffsetMs(SHOWTIME_TIME_ZONE, new Date(utcGuess));

  return utcGuess - offset;
};

const getTimeZoneOffsetMs = (timeZone: string, date: Date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  const yearPart = Number(partMap.get("year"));
  const monthPart = Number(partMap.get("month"));
  const dayPart = Number(partMap.get("day"));
  const hourPart = Number(partMap.get("hour"));
  const minutePart = Number(partMap.get("minute"));
  const secondPart = Number(partMap.get("second"));

  if (
    !yearPart ||
    !monthPart ||
    !dayPart ||
    Number.isNaN(hourPart) ||
    Number.isNaN(minutePart) ||
    Number.isNaN(secondPart)
  ) {
    return 0;
  }

  const asUtcTimestamp = Date.UTC(
    yearPart,
    monthPart - 1,
    dayPart,
    hourPart,
    minutePart,
    secondPart
  );

  return asUtcTimestamp - date.getTime();
};

type StripeReconciliationResult =
  | { status: "completed" }
  | { status: "failed"; reason: string }
  | { status: "expired" }
  | { status: "ignored" }
  | { status: "missing" }
  | { status: "pending"; paymentStatus: string; checkoutStatus: string | null }
  | { status: "missing_config" }
  | { status: "error" };

type CancelableTicketContext = {
  checkoutId: Id<"paymentCheckouts"> | null;
  stripePaymentIntentId: string | null;
  refundAmount: number | null;
  refundedAt: number | null;
  ticketUsedAt: number | null;
  sessionStartsAt: number;
};

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
  const completedItems: Doc<"paymentCheckouts">["items"] = [];

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

    const ticketCode =
      item.ticketCode ??
      relevantReservations.find((reservation) => reservation.ticketCode)?.ticketCode ??
      createTicketCode();

    for (const reservation of relevantReservations) {
      if (
        reservation.status !== "confirmed" ||
        reservation.ticketCode !== ticketCode ||
        reservation.ticketIssuedAt === undefined
      ) {
        await ctx.db.patch(reservation._id, {
          status: "confirmed",
          ticketCode,
          ticketIssuedAt: reservation.ticketIssuedAt ?? now,
        });
      }
    }

    completedItems.push({
      ...item,
      ticketCode,
    });
  }

  await patchCheckoutStatus(ctx, checkout._id, "completed", {
    completedAt: now,
    stripeCheckoutSessionId,
    stripePaymentIntentId,
    items: completedItems,
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
        theatreName: session.theatreName,
        theatreLocationLabel: session.theatreLocationLabel,
        auditoriumName: session.auditoriumName,
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

export const getCancelableTicketContext = internalQuery({
  args: {
    userId: v.string(),
    ticketCode: v.string(),
  },
  handler: async (ctx, args) => {
    const reservations = await ctx.db
      .query("seatReservations")
      .withIndex("ticketCode", (query) => query.eq("ticketCode", args.ticketCode))
      .collect();

    const relevantReservations = reservations.filter(
      (reservation) => reservation.reservedByUserId === args.userId
    );

    if (relevantReservations.length === 0) {
      return null;
    }

    const session = await ctx.db.get(relevantReservations[0].sessionId);

    if (!session) {
      return null;
    }

    const userCheckouts = await ctx.db
      .query("paymentCheckouts")
      .withIndex("userId", (query) => query.eq("userId", args.userId))
      .collect();

    const checkoutMatch = userCheckouts.find((checkout) =>
      checkout.items.some((item) => item.ticketCode === args.ticketCode)
    );
    const checkoutItem = checkoutMatch?.items.find((item) => item.ticketCode === args.ticketCode);

    return {
      checkoutId: checkoutMatch?._id ?? null,
      stripePaymentIntentId: checkoutMatch?.stripePaymentIntentId ?? null,
      refundAmount: checkoutItem?.totalPrice ?? null,
      refundedAt: checkoutItem?.refundedAt ?? null,
      ticketUsedAt:
        relevantReservations.find((reservation) => reservation.ticketUsedAt !== undefined)?.ticketUsedAt ??
        null,
      sessionStartsAt: parseSessionStartTime(session.date, session.time),
    };
  },
});

export const applyCanceledTicketRefund = internalMutation({
  args: {
    userId: v.string(),
    ticketCode: v.string(),
    checkoutId: v.id("paymentCheckouts"),
    refundAmount: v.number(),
    refundId: v.string(),
    refundStatus: v.union(v.literal("pending"), v.literal("succeeded")),
  },
  handler: async (ctx, args) => {
    const checkout = await ctx.db.get(args.checkoutId);

    if (!checkout || checkout.userId !== args.userId) {
      throw new Error("Checkout session not found.");
    }

    const matchingItem = checkout.items.find((item) => item.ticketCode === args.ticketCode);

    if (!matchingItem) {
      throw new Error("Ticket checkout item not found.");
    }

    if (matchingItem.refundedAt !== undefined) {
      return {
        canceled: false,
        alreadyRefunded: true,
      };
    }

    const now = Date.now();
    const reservations = await ctx.db
      .query("seatReservations")
      .withIndex("ticketCode", (query) => query.eq("ticketCode", args.ticketCode))
      .collect();

    for (const reservation of reservations) {
      if (reservation.reservedByUserId !== args.userId) {
        continue;
      }

      await ctx.db.patch(reservation._id, {
        canceledAt: now,
        canceledByUserId: args.userId,
        refundId: args.refundId,
        refundedAmount: args.refundAmount,
      });

      await ctx.db.delete(reservation._id);
    }

    await ctx.db.patch(checkout._id, {
      items: checkout.items.map((item) =>
        item.ticketCode === args.ticketCode
          ? {
              ...item,
              refundedAt: now,
              refundedAmount: args.refundAmount,
              refundId: args.refundId,
              refundStatus: args.refundStatus,
            }
          : item
      ),
      updatedAt: now,
    });

    return {
      canceled: true,
      alreadyRefunded: false,
    };
  },
});

export const cancelTicketBooking: ReturnType<typeof action> = action({
  args: {
    ticketCode: v.string(),
  },
  handler: async (ctx, args): Promise<{
    refundId: string;
    refundStatus: "pending" | "succeeded";
    refundedAmount: number;
  }> => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);

    if (!currentUser) {
      throw new Error("You must be signed in to cancel tickets.");
    }

    const ticketContext = await ctx.runQuery(internal.payments.getCancelableTicketContext, {
      userId: currentUser._id,
      ticketCode: args.ticketCode,
    }) as CancelableTicketContext | null;

    if (!ticketContext) {
      throw new Error("Ticket not found.");
    }

    if (ticketContext.refundedAt) {
      throw new Error("This ticket has already been refunded.");
    }

    if (ticketContext.ticketUsedAt) {
      throw new Error("Used tickets cannot be canceled.");
    }

    if (ticketContext.sessionStartsAt <= Date.now()) {
      throw new Error("This ticket can only be canceled before showtime.");
    }

    if (!ticketContext.checkoutId || !ticketContext.stripePaymentIntentId || ticketContext.refundAmount === null) {
      throw new Error("Refund details could not be found for this ticket.");
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured.");
    }

    const stripe = new Stripe(stripeSecretKey);
    const refund = await stripe.refunds.create(
      {
        payment_intent: ticketContext.stripePaymentIntentId,
        amount: Math.round(ticketContext.refundAmount * 100),
        reason: "requested_by_customer",
        metadata: {
          ticketCode: args.ticketCode,
          userId: currentUser._id,
        },
      },
      {
        idempotencyKey: `cancel-ticket-${args.ticketCode}`,
      }
    );

    const refundStatus = refund.status === "succeeded" ? "succeeded" : "pending";

    await ctx.runMutation(internal.payments.applyCanceledTicketRefund, {
      userId: currentUser._id,
      ticketCode: args.ticketCode,
      checkoutId: ticketContext.checkoutId,
      refundAmount: ticketContext.refundAmount,
      refundId: refund.id,
      refundStatus,
    });

    return {
      refundId: refund.id,
      refundStatus,
      refundedAmount: ticketContext.refundAmount,
    };
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