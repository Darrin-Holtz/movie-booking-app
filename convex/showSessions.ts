import { v } from "convex/values";
import { getShowtimePrice } from "../lib/showtimePricing";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

const seatLabelValidator = v.string();
const HOLD_DURATION_MS = 5 * 60 * 1000;

const isActiveReservation = (
  reservation: {
    holdExpiresAt?: number;
    status?: "held" | "confirmed";
  },
  now: number
) => {
  if (reservation.status === "confirmed") {
    return true;
  }

  if (reservation.holdExpiresAt === undefined) {
    return true;
  }

  return reservation.holdExpiresAt > now;
};

const parseSessionDateTime = (date: string, time: string) => {
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

  return new Date(year, month - 1, day, hours, rawMinutes).getTime();
};

export const ensureSessions = mutation({
  args: {
    movieId: v.string(),
    movieTitle: v.string(),
    posterPath: v.optional(v.string()),
    date: v.string(),
    times: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existingSessions = await ctx.db
      .query("showSessions")
      .withIndex("movieId_date", (query) =>
        query.eq("movieId", args.movieId).eq("date", args.date)
      )
      .collect();

    const existingTimes = new Set(existingSessions.map((session) => session.time));
    const now = Date.now();

    for (const session of existingSessions) {
      if (
        session.movieTitle !== args.movieTitle ||
        session.posterPath !== args.posterPath
      ) {
        await ctx.db.patch(session._id, {
          movieTitle: args.movieTitle,
          posterPath: args.posterPath,
          updatedAt: now,
        });
      }
    }

    for (const time of args.times) {
      if (existingTimes.has(time)) {
        continue;
      }

      await ctx.db.insert("showSessions", {
        movieId: args.movieId,
        movieTitle: args.movieTitle,
        posterPath: args.posterPath,
        date: args.date,
        time,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { created: args.times.filter((time) => !existingTimes.has(time)).length };
  },
});

export const getSessionsByDate = query({
  args: {
    movieId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const currentUser = await authComponent.safeGetAuthUser(ctx);
    const sessions = await ctx.db
      .query("showSessions")
      .withIndex("movieId_date", (query) =>
        query.eq("movieId", args.movieId).eq("date", args.date)
      )
      .collect();

    const sessionsWithAvailability = await Promise.all(
      sessions.map(async (session) => {
        const reservations = await ctx.db
          .query("seatReservations")
          .withIndex("sessionId", (query) => query.eq("sessionId", session._id))
          .collect();

        const activeReservations = reservations.filter((reservation) =>
          isActiveReservation(reservation, now)
        );
        const currentUserHolds = currentUser
          ? activeReservations.filter(
              (reservation) =>
                reservation.status === "held" &&
                reservation.reservedByUserId === currentUser._id
            )
          : [];

        return {
          id: session._id,
          movieId: session.movieId,
          movieTitle: session.movieTitle,
          date: session.date,
          time: session.time,
          reservedSeats: activeReservations
            .map((reservation) => reservation.seatLabel)
            .sort((left, right) => left.localeCompare(right)),
          reservedCount: activeReservations.length,
          availableCount: Math.max(0, 48 - activeReservations.length),
          currentUserHeldSeats: currentUserHolds
            .map((reservation) => reservation.seatLabel)
            .sort((left, right) => left.localeCompare(right)),
          currentUserHoldExpiresAt:
            currentUserHolds.length > 0
              ? Math.min(
                  ...currentUserHolds
                    .map((reservation) => reservation.holdExpiresAt)
                    .filter((expiresAt): expiresAt is number => expiresAt !== undefined)
                )
              : null,
        };
      })
    );

    return sessionsWithAvailability.sort((left, right) => left.time.localeCompare(right.time));
  },
});

export const getMyBookings = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const currentUser = await authComponent.safeGetAuthUser(ctx);

    if (!currentUser) {
      return [];
    }

    const reservations = await ctx.db
      .query("seatReservations")
      .withIndex("reservedByUserId", (query) =>
        query.eq("reservedByUserId", currentUser._id)
      )
      .collect();

    const activeReservations = reservations.filter((reservation) =>
      isActiveReservation(reservation, now)
    );
    const groupedReservations = new Map<
      string,
      {
        id: string;
        movieId: string;
        movieTitle: string;
        posterPath?: string;
        date: string;
        time: string;
        seats: string[];
        status: "held" | "confirmed";
        isPaid: boolean;
        seatPrice: number;
        totalPrice: number;
        holdExpiresAt: number | null;
        reservedAt: number;
      }
    >();

    for (const reservation of activeReservations) {
      const session = await ctx.db.get(reservation.sessionId);

      if (!session) {
        continue;
      }

      const existingGroup = groupedReservations.get(session._id);

      if (!existingGroup) {
        const seatPrice = getShowtimePrice(session.time);
        groupedReservations.set(session._id, {
          id: session._id,
          movieId: session.movieId,
          movieTitle: session.movieTitle,
          posterPath: session.posterPath,
          date: session.date,
          time: session.time,
          seats: [reservation.seatLabel],
          status: reservation.status === "confirmed" ? "confirmed" : "held",
          isPaid: reservation.status === "confirmed",
          seatPrice,
          totalPrice: seatPrice,
          holdExpiresAt: reservation.holdExpiresAt ?? null,
          reservedAt: reservation.reservedAt,
        });
        continue;
      }

      existingGroup.seats.push(reservation.seatLabel);
      existingGroup.status =
        reservation.status === "confirmed" || existingGroup.status === "confirmed"
          ? "confirmed"
          : "held";
      existingGroup.isPaid = existingGroup.status === "confirmed";
      existingGroup.totalPrice = existingGroup.seatPrice * existingGroup.seats.length;
      existingGroup.holdExpiresAt =
        existingGroup.status === "confirmed"
          ? null
          : Math.min(
              existingGroup.holdExpiresAt ?? reservation.holdExpiresAt ?? now,
              reservation.holdExpiresAt ?? existingGroup.holdExpiresAt ?? now
            );
      existingGroup.reservedAt = Math.min(existingGroup.reservedAt, reservation.reservedAt);
    }

    return [...groupedReservations.values()]
      .map((booking) => ({
        ...booking,
        seats: booking.seats.sort((left, right) => left.localeCompare(right)),
        totalPrice: booking.seatPrice * booking.seats.length,
      }))
      .sort(
        (left, right) =>
          parseSessionDateTime(left.date, left.time) - parseSessionDateTime(right.date, right.time)
      );
  },
});

export const reserveSeats = mutation({
  args: {
    movieId: v.string(),
    date: v.string(),
    time: v.string(),
    seats: v.array(seatLabelValidator),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);

    if (!user) {
      throw new Error("You must be signed in to hold seats.");
    }

    const normalizedSeats = Array.from(new Set(args.seats)).sort((left, right) =>
      left.localeCompare(right)
    );

    const session = await ctx.db
      .query("showSessions")
      .withIndex("movieId_date_time", (query) =>
        query
          .eq("movieId", args.movieId)
          .eq("date", args.date)
          .eq("time", args.time)
      )
      .unique();

    if (!session) {
      throw new Error("Show session not found.");
    }

    const now = Date.now();
    const existingReservations = await ctx.db
      .query("seatReservations")
      .withIndex("sessionId", (query) => query.eq("sessionId", session._id))
      .collect();

    for (const reservation of existingReservations) {
      if (
        reservation.status === "held" &&
        reservation.holdExpiresAt !== undefined &&
        reservation.holdExpiresAt <= now
      ) {
        await ctx.db.delete(reservation._id);
      }
    }

    const activeReservations = existingReservations.filter((reservation) => {
      if (
        reservation.status === "held" &&
        reservation.holdExpiresAt !== undefined &&
        reservation.holdExpiresAt <= now
      ) {
        return false;
      }

      return isActiveReservation(reservation, now);
    });

    const currentUserActiveHolds = activeReservations.filter(
      (reservation) =>
        reservation.status === "held" && reservation.reservedByUserId === user._id
    );

    for (const reservation of currentUserActiveHolds) {
      await ctx.db.delete(reservation._id);
    }

    if (normalizedSeats.length === 0) {
      await ctx.db.patch(session._id, { updatedAt: now });

      return {
        sessionId: session._id,
        reservedSeats: [],
        holdExpiresAt: null,
      };
    }

    for (const seatLabel of normalizedSeats) {
      const existingReservation = activeReservations.find(
        (reservation) =>
          reservation.seatLabel === seatLabel &&
          reservation.reservedByUserId !== user._id
      );

      if (existingReservation) {
        throw new Error(`${seatLabel} is no longer available.`);
      }
    }

    const holdExpiresAt = now + HOLD_DURATION_MS;

    for (const seatLabel of normalizedSeats) {
      const holdId = await ctx.db.insert("seatReservations", {
        sessionId: session._id,
        seatLabel,
        reservedAt: now,
        reservedByName: user.name,
        reservedByEmail: user.email,
        reservedByUserId: user._id,
        holdExpiresAt,
        status: "held",
      });

      await ctx.scheduler.runAfter(
        HOLD_DURATION_MS,
        internal.showSessions.releaseExpiredSeatHold,
        {
          reservationId: holdId,
          expectedExpiresAt: holdExpiresAt,
        }
      );
    }

    await ctx.db.patch(session._id, { updatedAt: now });

    return {
      sessionId: session._id,
      reservedSeats: normalizedSeats,
      holdExpiresAt,
    };
  },
});

export const releaseExpiredSeatHold = internalMutation({
  args: {
    reservationId: v.id("seatReservations"),
    expectedExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);

    if (!reservation) {
      return null;
    }

    if (reservation.status !== "held") {
      return null;
    }

    if (
      reservation.holdExpiresAt === undefined ||
      reservation.holdExpiresAt !== args.expectedExpiresAt ||
      reservation.holdExpiresAt > Date.now()
    ) {
      return null;
    }

    await ctx.db.delete(reservation._id);
    return null;
  },
});