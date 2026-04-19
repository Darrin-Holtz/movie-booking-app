import { v } from "convex/values";
import { getShowtimePrice } from "../lib/showtimePricing";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { buildStaffAccessSummary, normalizeStaffEmail } from "./staffAccess";

const seatLabelValidator = v.string();
const HOLD_DURATION_MS = 5 * 60 * 1000;
const DEFAULT_SHOWTIMES = ["12:00 PM", "3:30 PM", "6:45 PM", "9:15 PM"];
const SHOWTIME_TIME_ZONE = "America/New_York";
const DEFAULT_SESSION_RUNTIME_MINUTES = 120;

type SeatMapCellKind = "standard" | "premium" | "accessible" | "companion" | "gap";

type SeatMapCell = {
  kind: SeatMapCellKind;
  label?: string;
};

type SeatMapRow = {
  rowLabel: string;
  seats: SeatMapCell[];
};

const createSeatMapRow = (rowLabel: string, kinds: SeatMapCellKind[]): SeatMapRow => {
  let seatNumber = 1;

  return {
    rowLabel,
    seats: kinds.map((kind) => {
      if (kind === "gap") {
        return { kind };
      }

      const label = `${rowLabel}${seatNumber}`;
      seatNumber += 1;

      return {
        kind,
        label,
      };
    }),
  };
};

const cloneSeatMapRows = (seatMapRows: readonly SeatMapRow[]): SeatMapRow[] => {
  return seatMapRows.map((row) => ({
    rowLabel: row.rowLabel,
    seats: row.seats.map((seat) => ({
      kind: seat.kind,
      label: seat.label,
    })),
  }));
};

const countSeatMapSeats = (seatMapRows: readonly SeatMapRow[]) => {
  return seatMapRows.reduce(
    (total, row) => total + row.seats.filter((seat) => seat.kind !== "gap").length,
    0
  );
};

const areSeatMapsEqual = (left: readonly SeatMapRow[], right: readonly SeatMapRow[]) => {
  return JSON.stringify(left) === JSON.stringify(right);
};

const getSeatLabelsFromMap = (seatMapRows: readonly SeatMapRow[]) => {
  return seatMapRows.flatMap((row) =>
    row.seats.flatMap((seat) => (seat.label ? [seat.label] : []))
  );
};

const getDefaultSeatMapRows = (theatreSlug?: string | null): SeatMapRow[] => {
  return cloneSeatMapRows(
    DEFAULT_THEATRES.find((theatre) => theatre.slug === theatreSlug)?.seatMapRows ??
    DEFAULT_THEATRES[0].seatMapRows
  );
};

const DEFAULT_THEATRES = [
  {
    slug: "quickshow-downtown-8",
    name: "QuickShow Downtown 8",
    city: "Buffalo",
    state: "NY",
    address: "145 Main Street",
    screens: 8,
    amenities: ["Recliners", "Laser", "Dolby 7.1"],
    auditoriumName: "House 1",
    schedule: ["12:00 PM", "3:30 PM", "6:45 PM", "9:15 PM"],
    seatMapRows: [
      createSeatMapRow("A", ["premium", "premium", "premium", "premium", "gap", "premium", "premium", "premium", "premium"]),
      createSeatMapRow("B", ["standard", "standard", "standard", "standard", "gap", "standard", "standard", "standard", "standard"]),
      createSeatMapRow("C", ["standard", "standard", "standard", "standard", "gap", "standard", "standard", "standard", "standard"]),
      createSeatMapRow("D", ["standard", "standard", "standard", "standard", "gap", "standard", "standard", "standard", "standard"]),
      createSeatMapRow("E", ["standard", "standard", "standard", "standard", "gap", "standard", "standard", "standard", "standard"]),
      createSeatMapRow("F", ["accessible", "accessible", "companion", "companion", "gap", "standard", "standard", "standard", "standard"]),
    ],
  },
  {
    slug: "quickshow-riverfront-10",
    name: "QuickShow Riverfront 10",
    city: "Amherst",
    state: "NY",
    address: "28 Riverfront Plaza",
    screens: 10,
    amenities: ["IMAX", "Premium Large Format", "Reserved Seating"],
    auditoriumName: "IMAX Auditorium",
    schedule: ["12:20 PM", "3:50 PM", "7:05 PM", "9:40 PM"],
    seatMapRows: [
      createSeatMapRow("A", ["premium", "premium", "premium", "premium", "premium", "gap", "premium", "premium", "premium", "premium", "premium"]),
      createSeatMapRow("B", ["premium", "premium", "premium", "premium", "premium", "gap", "premium", "premium", "premium", "premium", "premium"]),
      createSeatMapRow("C", ["standard", "standard", "standard", "standard", "standard", "gap", "standard", "standard", "standard", "standard", "standard"]),
      createSeatMapRow("D", ["standard", "standard", "standard", "standard", "standard", "gap", "standard", "standard", "standard", "standard", "standard"]),
      createSeatMapRow("E", ["standard", "standard", "standard", "standard", "standard", "gap", "standard", "standard", "standard", "standard", "standard"]),
      createSeatMapRow("F", ["standard", "standard", "standard", "standard", "standard", "gap", "standard", "standard", "standard", "standard", "standard"]),
      createSeatMapRow("G", ["standard", "standard", "standard", "standard", "standard", "gap", "standard", "standard", "standard", "standard", "standard"]),
      createSeatMapRow("H", ["accessible", "accessible", "accessible", "companion", "companion", "gap", "companion", "standard", "standard", "standard", "standard"]),
    ],
  },
  {
    slug: "quickshow-eastgate-6",
    name: "QuickShow Eastgate 6",
    city: "Cheektowaga",
    state: "NY",
    address: "510 Transit Road",
    screens: 6,
    amenities: ["Family Pricing", "Late Shows", "Reserved Seating"],
    auditoriumName: "Screen 3",
    schedule: ["11:45 AM", "3:10 PM", "6:30 PM", "9:05 PM"],
    seatMapRows: [
      createSeatMapRow("A", ["premium", "premium", "premium", "gap", "premium", "premium", "premium"]),
      createSeatMapRow("B", ["standard", "standard", "standard", "gap", "standard", "standard", "standard"]),
      createSeatMapRow("C", ["standard", "standard", "standard", "gap", "standard", "standard", "standard"]),
      createSeatMapRow("D", ["standard", "standard", "standard", "gap", "standard", "standard", "standard"]),
      createSeatMapRow("E", ["accessible", "accessible", "companion", "gap", "standard", "standard", "standard"]),
    ],
  },
] as const;

const getTheatreLocationLabel = (city: string, state: string) => `${city}, ${state}`;

const slugifyTheatreName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "quickshow-theatre";

const normalizeAmenityList = (amenities: string[]) =>
  Array.from(
    new Set(
      amenities
        .map((amenity) => amenity.trim())
        .filter(Boolean)
    )
  );

const normalizeShowtimeInput = (time: string) => {
  const normalizedTime = time.trim().toUpperCase().replace(/\s+/g, " ");

  if (!/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(normalizedTime)) {
    throw new Error(`Invalid showtime: ${time}. Use formats like 3:30 PM.`);
  }

  return normalizedTime;
};

const normalizeShowtimeList = (times: string[]) => {
  const normalizedTimes = Array.from(new Set(times.map(normalizeShowtimeInput)));

  return normalizedTimes.sort((left, right) => {
    return parseSessionDateTime("01-01-2026", left) - parseSessionDateTime("01-01-2026", right);
  });
};

const getBaseTheatreDefinition = (theatreSlug?: string | null) => {
  return DEFAULT_THEATRES.find((theatre) => theatre.slug === theatreSlug) ?? DEFAULT_THEATRES[0];
};

const buildManagedTheatreConfig = (theatre: {
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
  screens: number;
  amenities: string[];
  auditoriumName?: string;
  defaultShowtimes?: string[];
}) => {
  const baseTheatre = getBaseTheatreDefinition(theatre.slug);

  return {
    slug: theatre.slug,
    name: theatre.name,
    city: theatre.city,
    state: theatre.state,
    address: theatre.address,
    screens: theatre.screens,
    amenities: [...theatre.amenities],
    auditoriumName: theatre.auditoriumName ?? baseTheatre.auditoriumName,
    schedule:
      theatre.defaultShowtimes && theatre.defaultShowtimes.length > 0
        ? normalizeShowtimeList(theatre.defaultShowtimes)
        : [...baseTheatre.schedule],
    seatMapRows: cloneSeatMapRows(baseTheatre.seatMapRows),
  };
};

const requireStaffCapabilityOrThrow = async (
  ctx: QueryCtx | MutationCtx,
  capability: "scan" | "lookup" | "recentCheckIns" | "attendance" | "manageTheatres"
) => {
  const currentUser = await authComponent.safeGetAuthUser(ctx);

  if (!currentUser) {
    throw new Error("You must be signed in to scan tickets.");
  }

  if (!currentUser.email) {
    throw new Error("Your account must have an email before it can scan tickets.");
  }

  const staffMember = await ctx.db
    .query("ticketScannerStaff")
    .withIndex("email", (query) => query.eq("email", normalizeStaffEmail(currentUser.email)))
    .collect();

  const access = buildStaffAccessSummary(currentUser, staffMember);

  const isAllowed =
    capability === "scan"
      ? access.canScanTickets
      : capability === "lookup"
        ? access.canLookupTickets
        : capability === "recentCheckIns"
          ? access.canViewRecentCheckIns
          : capability === "attendance"
            ? access.canViewAttendance
            : access.canManageTheatres;

  if (!isAllowed) {
    throw new Error("You do not have permission to use this staff tool.");
  }

  return currentUser;
};

const getReservationTicketStatus = (
  reservations: Array<{
    status?: "held" | "confirmed";
    ticketUsedAt?: number;
  }>
) => {
  const isConfirmed = reservations.every((reservation) => reservation.status === "confirmed");
  const usedAt = reservations.find((reservation) => reservation.ticketUsedAt !== undefined)?.ticketUsedAt ?? null;

  return {
    isConfirmed,
    usedAt,
    status: !isConfirmed ? "not_confirmed" : usedAt ? "used" : "valid",
  } as const;
};

const buildStaffTicketRecord = (
  session: {
    movieTitle: string;
    theatreName?: string;
    theatreLocationLabel?: string;
    auditoriumName?: string;
    date: string;
    time: string;
  },
  reservations: Array<{
    seatLabel: string;
    ticketCode?: string;
    reservedByEmail?: string;
    reservedByName?: string;
    reservedAt: number;
    ticketIssuedAt?: number;
    ticketUsedAt?: number;
    ticketScannedByEmail?: string;
    status?: "held" | "confirmed";
  }>
) => {
  const sortedSeats = reservations
    .map((reservation) => reservation.seatLabel)
    .sort((left, right) => left.localeCompare(right));
  const { status, usedAt } = getReservationTicketStatus(reservations);
  const customerEmail = reservations.find((reservation) => reservation.reservedByEmail)?.reservedByEmail ?? null;
  const customerName = reservations.find((reservation) => reservation.reservedByName)?.reservedByName ?? null;
  const issuedAt =
    reservations.find((reservation) => reservation.ticketIssuedAt !== undefined)?.ticketIssuedAt ??
    reservations[0]?.reservedAt ??
    0;

  return {
    ticketCode: reservations[0]?.ticketCode ?? "",
    movieTitle: session.movieTitle,
    theatreName: session.theatreName ?? "QuickShow Cinema",
    theatreLocationLabel: session.theatreLocationLabel ?? "In-app location",
    auditoriumName: session.auditoriumName ?? "Main House",
    date: session.date,
    time: session.time,
    seats: sortedSeats,
    customerEmail,
    customerName,
    status,
    usedAt,
    issuedAt,
    scannedByEmail:
      reservations.find((reservation) => reservation.ticketScannedByEmail !== undefined)?.ticketScannedByEmail ?? null,
  };
};

const ensureDefaultTheatres = async (ctx: MutationCtx) => {
  const existingTheatres = await ctx.db.query("theatres").collect();
  const existingBySlug = new Map(existingTheatres.map((theatre) => [theatre.slug, theatre]));
  const now = Date.now();

  for (const theatre of DEFAULT_THEATRES) {
    const existingTheatre = existingBySlug.get(theatre.slug);

    if (!existingTheatre) {
      await ctx.db.insert("theatres", {
        slug: theatre.slug,
        name: theatre.name,
        city: theatre.city,
        state: theatre.state,
        address: theatre.address,
        screens: theatre.screens,
        amenities: [...theatre.amenities],
        auditoriumName: theatre.auditoriumName,
        defaultShowtimes: [...theatre.schedule],
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }

    if (
      existingTheatre.auditoriumName === undefined ||
      existingTheatre.defaultShowtimes === undefined
    ) {
      await ctx.db.patch(existingTheatre._id, {
        auditoriumName: existingTheatre.auditoriumName ?? theatre.auditoriumName,
        defaultShowtimes: existingTheatre.defaultShowtimes ?? [...theatre.schedule],
        updatedAt: now,
      });
    }
  }

  const managedTheatres = await ctx.db.query("theatres").collect();

  return managedTheatres
    .map((theatre) => buildManagedTheatreConfig(theatre))
    .sort((left, right) => left.name.localeCompare(right.name));
};

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

export const ensureSessions = mutation({
  args: {
    movieId: v.string(),
    movieTitle: v.string(),
    posterPath: v.optional(v.string()),
    runtimeMinutes: v.optional(v.number()),
    date: v.string(),
    times: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const theatres = await ensureDefaultTheatres(ctx);
    const existingSessions = await ctx.db
      .query("showSessions")
      .withIndex("movieId_date", (query) =>
        query.eq("movieId", args.movieId).eq("date", args.date)
      )
      .collect();

    const existingSessionKeys = new Set(
      existingSessions.map(
        (session) => `${session.theatreSlug ?? "legacy"}::${session.time}`
      )
    );
    const now = Date.now();
    const fallbackTimes = args.times?.length ? args.times : DEFAULT_SHOWTIMES;

    for (const session of existingSessions) {
      const matchingTheatre = theatres.find((theatre) => theatre.slug === session.theatreSlug);
      const nextSeatMapRows = matchingTheatre
        ? cloneSeatMapRows(matchingTheatre.seatMapRows)
        : getDefaultSeatMapRows(session.theatreSlug);
      const nextSeatCount = countSeatMapSeats(nextSeatMapRows);
      const currentSeatMapRows = session.seatMapRows?.length
        ? session.seatMapRows
        : getDefaultSeatMapRows(session.theatreSlug);
      const currentSeatCount = typeof session.seatCount === "number" ? session.seatCount : countSeatMapSeats(currentSeatMapRows);

      if (
        session.movieTitle !== args.movieTitle ||
        session.posterPath !== args.posterPath ||
        session.runtimeMinutes !== args.runtimeMinutes ||
        currentSeatCount !== nextSeatCount ||
        !areSeatMapsEqual(currentSeatMapRows, nextSeatMapRows) ||
        (matchingTheatre && (
          session.theatreName !== matchingTheatre.name ||
          session.theatreLocationLabel !== getTheatreLocationLabel(matchingTheatre.city, matchingTheatre.state) ||
          session.auditoriumName !== matchingTheatre.auditoriumName
        ))
      ) {
        await ctx.db.patch(session._id, {
          movieTitle: args.movieTitle,
          posterPath: args.posterPath,
          runtimeMinutes: args.runtimeMinutes,
          seatMapRows: nextSeatMapRows,
          seatCount: nextSeatCount,
          theatreName: matchingTheatre?.name ?? session.theatreName,
          theatreLocationLabel:
            matchingTheatre
              ? getTheatreLocationLabel(matchingTheatre.city, matchingTheatre.state)
              : session.theatreLocationLabel,
          auditoriumName: matchingTheatre?.auditoriumName ?? session.auditoriumName,
          updatedAt: now,
        });
      }
    }

    let created = 0;

    for (const theatre of theatres) {
      const schedule = theatre.schedule.length > 0 ? theatre.schedule : fallbackTimes;

      for (const time of schedule) {
        const sessionKey = `${theatre.slug}::${time}`;

        if (existingSessionKeys.has(sessionKey)) {
          continue;
        }

        await ctx.db.insert("showSessions", {
          movieId: args.movieId,
          movieTitle: args.movieTitle,
          posterPath: args.posterPath,
          runtimeMinutes: args.runtimeMinutes,
          seatMapRows: cloneSeatMapRows(theatre.seatMapRows),
          seatCount: countSeatMapSeats(theatre.seatMapRows),
          theatreSlug: theatre.slug,
          theatreName: theatre.name,
          theatreLocationLabel: getTheatreLocationLabel(theatre.city, theatre.state),
          auditoriumName: theatre.auditoriumName,
          date: args.date,
          time,
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      }
    }

    return { created };
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
        const seatMapRows = session.seatMapRows?.length
          ? session.seatMapRows
          : getDefaultSeatMapRows(session.theatreSlug);
        const seatCount = typeof session.seatCount === "number"
          ? session.seatCount
          : countSeatMapSeats(seatMapRows);
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
          seatMapRows,
          seatCount,
          theatreSlug: session.theatreSlug ?? "quickshow-legacy",
          theatreName: session.theatreName ?? "QuickShow Cinema",
          theatreLocationLabel: session.theatreLocationLabel ?? "In-app location",
          auditoriumName: session.auditoriumName ?? "Main House",
          date: session.date,
          time: session.time,
          reservedSeats: activeReservations
            .map((reservation) => reservation.seatLabel)
            .sort((left, right) => left.localeCompare(right)),
          reservedCount: activeReservations.length,
          availableCount: Math.max(0, seatCount - activeReservations.length),
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

    return sessionsWithAvailability.sort((left, right) => {
      const theatreComparison = left.theatreName.localeCompare(right.theatreName);

      if (theatreComparison !== 0) {
        return theatreComparison;
      }

      return left.time.localeCompare(right.time);
    });
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
        theatreName: string;
        theatreLocationLabel: string;
        auditoriumName: string;
        ticketCode: string | null;
        ticketIssuedAt: number | null;
        ticketUsedAt: number | null;
        date: string;
        time: string;
        seats: string[];
        status: "held" | "confirmed" | "canceled";
        isPaid: boolean;
        seatPrice: number;
        totalPrice: number;
        holdExpiresAt: number | null;
        reservedAt: number;
        startsAt: number;
        endsAt: number;
        isPast: boolean;
        canceledAt: number | null;
        refundedAt: number | null;
        refundedAmount: number | null;
        refundStatus: "pending" | "succeeded" | null;
        refundId: string | null;
      }
    >();

    for (const reservation of activeReservations) {
      const session = await ctx.db.get(reservation.sessionId);

      if (!session) {
        continue;
      }

      const groupKey =
        reservation.status === "confirmed" && reservation.ticketCode
          ? reservation.ticketCode
          : session._id;
      const existingGroup = groupedReservations.get(groupKey);

      if (!existingGroup) {
        const seatPrice = getShowtimePrice(session.time);
        const startsAt = parseSessionDateTime(session.date, session.time);
        const runtimeMinutes =
          typeof session.runtimeMinutes === "number" && Number.isFinite(session.runtimeMinutes) && session.runtimeMinutes > 0
            ? session.runtimeMinutes
            : DEFAULT_SESSION_RUNTIME_MINUTES;
        groupedReservations.set(groupKey, {
          id: groupKey,
          movieId: session.movieId,
          movieTitle: session.movieTitle,
          posterPath: session.posterPath,
          theatreName: session.theatreName ?? "QuickShow Cinema",
          theatreLocationLabel: session.theatreLocationLabel ?? "In-app location",
          auditoriumName: session.auditoriumName ?? "Main House",
          ticketCode: reservation.ticketCode ?? null,
          ticketIssuedAt: reservation.ticketIssuedAt ?? null,
          ticketUsedAt: reservation.ticketUsedAt ?? null,
          date: session.date,
          time: session.time,
          seats: [reservation.seatLabel],
          status: reservation.status === "confirmed" ? "confirmed" : "held",
          isPaid: reservation.status === "confirmed",
          seatPrice,
          totalPrice: seatPrice,
          holdExpiresAt: reservation.holdExpiresAt ?? null,
          reservedAt: reservation.reservedAt,
          startsAt,
          endsAt: startsAt + runtimeMinutes * 60 * 1000,
          isPast: false,
          canceledAt: null,
          refundedAt: null,
          refundedAmount: null,
          refundStatus: null,
          refundId: null,
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
      existingGroup.ticketCode = existingGroup.ticketCode ?? reservation.ticketCode ?? null;
      existingGroup.ticketIssuedAt =
        existingGroup.ticketIssuedAt ?? reservation.ticketIssuedAt ?? null;
      existingGroup.ticketUsedAt =
        existingGroup.ticketUsedAt ?? reservation.ticketUsedAt ?? null;
      existingGroup.holdExpiresAt =
        existingGroup.status === "confirmed"
          ? null
          : Math.min(
              existingGroup.holdExpiresAt ?? reservation.holdExpiresAt ?? now,
              reservation.holdExpiresAt ?? existingGroup.holdExpiresAt ?? now
            );
      existingGroup.reservedAt = Math.min(existingGroup.reservedAt, reservation.reservedAt);
    }

    const checkouts = await ctx.db
      .query("paymentCheckouts")
      .withIndex("userId", (query) => query.eq("userId", currentUser._id))
      .collect();

    for (const checkout of checkouts) {
      for (const item of checkout.items) {
        if (!item.ticketCode || item.refundedAt === undefined) {
          continue;
        }

        if (groupedReservations.has(item.ticketCode)) {
          continue;
        }

        const startsAt = parseSessionDateTime(item.date, item.time);
        groupedReservations.set(item.ticketCode, {
          id: item.ticketCode,
          movieId: item.movieId,
          movieTitle: item.movieTitle,
          posterPath: item.posterPath,
          theatreName: item.theatreName ?? "QuickShow Cinema",
          theatreLocationLabel: item.theatreLocationLabel ?? "In-app location",
          auditoriumName: item.auditoriumName ?? "Main House",
          ticketCode: item.ticketCode,
          ticketIssuedAt: checkout.completedAt ?? checkout.createdAt,
          ticketUsedAt: null,
          date: item.date,
          time: item.time,
          seats: [...item.seatLabels].sort((left, right) => left.localeCompare(right)),
          status: "canceled",
          isPaid: true,
          seatPrice: item.seatPrice,
          totalPrice: item.totalPrice,
          holdExpiresAt: null,
          reservedAt: checkout.createdAt,
          startsAt,
          endsAt: startsAt,
          isPast: false,
          canceledAt: item.refundedAt,
          refundedAt: item.refundedAt,
          refundedAmount: item.refundedAmount ?? item.totalPrice,
          refundStatus: item.refundStatus ?? null,
          refundId: item.refundId ?? null,
        });
      }
    }

    return [...groupedReservations.values()]
      .map((booking) => ({
        ...booking,
        isPast:
          booking.status === "canceled"
            ? false
            : booking.endsAt > 0
              ? booking.endsAt < now
              : false,
        seats: booking.seats.sort((left, right) => left.localeCompare(right)),
        totalPrice: booking.seatPrice * booking.seats.length,
      }))
      .sort((left, right) => {
        if (left.status === "canceled" || right.status === "canceled") {
          if (left.status !== right.status) {
            return left.status === "canceled" ? 1 : -1;
          }

          return (right.refundedAt ?? right.canceledAt ?? 0) - (left.refundedAt ?? left.canceledAt ?? 0);
        }

        if (left.isPast !== right.isPast) {
          return left.isPast ? 1 : -1;
        }

        return left.isPast
          ? right.startsAt - left.startsAt
          : left.startsAt - right.startsAt;
      });
  },
});

export const getMyTicketByCode = query({
  args: {
    ticketCode: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);

    if (!currentUser) {
      return null;
    }

    const reservations = await ctx.db
      .query("seatReservations")
      .withIndex("ticketCode", (query) => query.eq("ticketCode", args.ticketCode))
      .collect();

    const myReservations = reservations.filter(
      (reservation) => reservation.reservedByUserId === currentUser._id
    );

    if (myReservations.length === 0) {
      return null;
    }

    const session = await ctx.db.get(myReservations[0].sessionId);

    if (!session) {
      return null;
    }

    const seatPrice = getShowtimePrice(session.time);
    const seats = myReservations
      .map((reservation) => reservation.seatLabel)
      .sort((left, right) => left.localeCompare(right));

    return {
      ticketCode: args.ticketCode,
      movieId: session.movieId,
      movieTitle: session.movieTitle,
      posterPath: session.posterPath,
      theatreName: session.theatreName ?? "QuickShow Cinema",
      theatreLocationLabel: session.theatreLocationLabel ?? "In-app location",
      auditoriumName: session.auditoriumName ?? "Main House",
      date: session.date,
      time: session.time,
      seats,
      totalPrice: seatPrice * seats.length,
      isUsed: myReservations.some((reservation) => reservation.ticketUsedAt !== undefined),
      usedAt:
        myReservations.find((reservation) => reservation.ticketUsedAt !== undefined)?.ticketUsedAt ??
        null,
      issuedAt:
        myReservations.find((reservation) => reservation.ticketIssuedAt !== undefined)?.ticketIssuedAt ??
        myReservations[0].reservedAt,
    };
  },
});

export const getTicketScanPreview = query({
  args: {
    ticketCode: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaffCapabilityOrThrow(ctx, "lookup");

    const reservations = await ctx.db
      .query("seatReservations")
      .withIndex("ticketCode", (query) => query.eq("ticketCode", args.ticketCode))
      .collect();

    if (reservations.length === 0) {
      return null;
    }

    const session = await ctx.db.get(reservations[0].sessionId);

    if (!session) {
      return null;
    }

    return buildStaffTicketRecord(session, reservations);
  },
});

export const searchStaffTickets = query({
  args: {
    searchTerm: v.string(),
    searchField: v.optional(
      v.union(
        v.literal("all"),
        v.literal("ticket"),
        v.literal("movie"),
        v.literal("customer"),
        v.literal("theatre"),
        v.literal("showtime")
      )
    ),
    status: v.optional(
      v.union(v.literal("all"), v.literal("valid"), v.literal("used"), v.literal("not_confirmed"))
    ),
    showDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffCapabilityOrThrow(ctx, "lookup");

    const normalizedTerm = args.searchTerm.trim().toLowerCase();
    const searchField = args.searchField ?? "all";
    const statusFilter = args.status ?? "all";
    const showDateFilter = args.showDate?.trim() || null;

    if (normalizedTerm.length < 2 && !showDateFilter && statusFilter === "all") {
      return [];
    }

    const reservations = await ctx.db.query("seatReservations").collect();
    const groupedReservations = new Map<string, typeof reservations>();

    for (const reservation of reservations) {
      if (!reservation.ticketCode) {
        continue;
      }

      const existingReservations = groupedReservations.get(reservation.ticketCode) ?? [];
      existingReservations.push(reservation);
      groupedReservations.set(reservation.ticketCode, existingReservations);
    }

    const matches = await Promise.all(
      Array.from(groupedReservations.values()).map(async (ticketReservations) => {
        const session = await ctx.db.get(ticketReservations[0].sessionId);

        if (!session) {
          return null;
        }

        const record = buildStaffTicketRecord(session, ticketReservations);
        const searchableValuesByField = {
          ticket: [record.ticketCode],
          movie: [record.movieTitle],
          customer: [record.customerEmail, record.customerName],
          theatre: [record.theatreName, record.theatreLocationLabel, record.auditoriumName],
          showtime: [record.date, record.time],
          all: [
            record.ticketCode,
            record.movieTitle,
            record.customerEmail,
            record.customerName,
            record.theatreName,
            record.theatreLocationLabel,
            record.auditoriumName,
            record.date,
            record.time,
          ],
        };

        const searchMatches =
          normalizedTerm.length < 2
            ? true
            : searchableValuesByField[searchField]
                .filter(Boolean)
                .some((value) => value!.toLowerCase().includes(normalizedTerm));

        if (!searchMatches) {
          return null;
        }

        if (statusFilter !== "all" && record.status !== statusFilter) {
          return null;
        }

        if (showDateFilter && record.date !== showDateFilter) {
          return null;
        }

        return record;
      })
    );

    return matches
      .filter((match): match is NonNullable<typeof match> => Boolean(match))
      .sort((left, right) => {
        const rightTimestamp = right.usedAt ?? right.issuedAt;
        const leftTimestamp = left.usedAt ?? left.issuedAt;

        return rightTimestamp - leftTimestamp;
      })
      .slice(0, 18);
  },
});

export const getAttendanceOverview = query({
  args: {
    date: v.optional(v.string()),
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffCapabilityOrThrow(ctx, "attendance");

    const dateFilter = args.date?.trim() || null;
    const searchTerm = args.searchTerm?.trim().toLowerCase() || "";
    const reservations = await ctx.db.query("seatReservations").collect();
    const groupedBySession = new Map<string, typeof reservations>();

    for (const reservation of reservations) {
      if (reservation.status !== "confirmed" || !reservation.ticketCode) {
        continue;
      }

      const sessionGroupKey = reservation.sessionId;
      const existingReservations = groupedBySession.get(sessionGroupKey) ?? [];
      existingReservations.push(reservation);
      groupedBySession.set(sessionGroupKey, existingReservations);
    }

    const overview = await Promise.all(
      Array.from(groupedBySession.entries()).map(async ([sessionId, sessionReservations]) => {
        const session = await ctx.db.get(sessionId as typeof sessionReservations[number]["sessionId"]);

        if (!session) {
          return null;
        }

        const ticketsByCode = new Map<string, typeof sessionReservations>();

        for (const reservation of sessionReservations) {
          const reservationsForTicket = ticketsByCode.get(reservation.ticketCode!) ?? [];
          reservationsForTicket.push(reservation);
          ticketsByCode.set(reservation.ticketCode!, reservationsForTicket);
        }

        const totalTickets = ticketsByCode.size;
        const checkedInTickets = Array.from(ticketsByCode.values()).filter((ticketReservations) =>
          ticketReservations.some((reservation) => reservation.ticketUsedAt !== undefined)
        );
        const checkedInCount = checkedInTickets.length;
        const latestCheckInAt = checkedInTickets.reduce((latestTimestamp, ticketReservations) => {
          const ticketUsedAt = ticketReservations.find((reservation) => reservation.ticketUsedAt !== undefined)?.ticketUsedAt ?? 0;
          return Math.max(latestTimestamp, ticketUsedAt);
        }, 0);

        const haystack = [session.movieTitle, session.date, session.time, session.theatreName, session.auditoriumName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (dateFilter && session.date !== dateFilter) {
          return null;
        }

        if (searchTerm && !haystack.includes(searchTerm)) {
          return null;
        }

        return {
          sessionId,
          movieTitle: session.movieTitle,
          theatreName: session.theatreName ?? "QuickShow Cinema",
          theatreLocationLabel: session.theatreLocationLabel ?? "In-app location",
          auditoriumName: session.auditoriumName ?? "Main House",
          date: session.date,
          time: session.time,
          totalTickets,
          checkedInCount,
          remainingCount: Math.max(totalTickets - checkedInCount, 0),
          latestCheckInAt: latestCheckInAt || null,
          attendancePercent: totalTickets > 0 ? Math.round((checkedInCount / totalTickets) * 100) : 0,
        };
      })
    );

    return overview
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .sort((left, right) => {
        const rightSort = right.latestCheckInAt ?? parseSessionDateTime(right.date, right.time);
        const leftSort = left.latestCheckInAt ?? parseSessionDateTime(left.date, left.time);
        return rightSort - leftSort;
      })
      .slice(0, 24);
  },
});

export const listManagedTheatres = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffCapabilityOrThrow(ctx, "manageTheatres");

    const theatres = await ctx.db.query("theatres").collect();
    const sessions = await ctx.db.query("showSessions").collect();
    const now = Date.now();

    return theatres
      .map((theatre) => {
        const theatreSessions = sessions
          .filter((session) => session.theatreSlug === theatre.slug)
          .filter((session) => parseSessionDateTime(session.date, session.time) >= now)
          .sort((left, right) => parseSessionDateTime(left.date, left.time) - parseSessionDateTime(right.date, right.time))
          .slice(0, 8)
          .map((session) => ({
            sessionId: session._id,
            movieId: session.movieId,
            movieTitle: session.movieTitle,
            date: session.date,
            time: session.time,
          }));

        return {
          _id: theatre._id,
          slug: theatre.slug,
          name: theatre.name,
          city: theatre.city,
          state: theatre.state,
          address: theatre.address,
          screens: theatre.screens,
          amenities: theatre.amenities,
          auditoriumName: theatre.auditoriumName ?? getBaseTheatreDefinition(theatre.slug).auditoriumName,
          defaultShowtimes:
            theatre.defaultShowtimes && theatre.defaultShowtimes.length > 0
              ? normalizeShowtimeList(theatre.defaultShowtimes)
              : [...getBaseTheatreDefinition(theatre.slug).schedule],
          upcomingSessions: theatreSessions,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const saveManagedTheatre = mutation({
  args: {
    theatreId: v.optional(v.id("theatres")),
    name: v.string(),
    city: v.string(),
    state: v.string(),
    address: v.string(),
    screens: v.number(),
    auditoriumName: v.string(),
    amenities: v.array(v.string()),
    defaultShowtimes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffCapabilityOrThrow(ctx, "manageTheatres");

    const now = Date.now();
    const normalizedAmenities = normalizeAmenityList(args.amenities);
    const normalizedShowtimes = normalizeShowtimeList(args.defaultShowtimes);
    const trimmedName = args.name.trim();
    const trimmedCity = args.city.trim();
    const trimmedState = args.state.trim().toUpperCase();
    const trimmedAddress = args.address.trim();
    const trimmedAuditoriumName = args.auditoriumName.trim();

    if (!trimmedName || !trimmedCity || !trimmedState || !trimmedAddress || !trimmedAuditoriumName) {
      throw new Error("Theatre name, city, state, address, and auditorium are required.");
    }

    if (args.screens < 1) {
      throw new Error("Screens must be at least 1.");
    }

    if (normalizedShowtimes.length === 0) {
      throw new Error("Add at least one default showtime.");
    }

    const existingTheatre = args.theatreId ? await ctx.db.get(args.theatreId) : null;
    const nextSlug = existingTheatre?.slug ?? slugifyTheatreName(trimmedName);
    const conflictingTheatre = await ctx.db
      .query("theatres")
      .withIndex("slug", (query) => query.eq("slug", nextSlug))
      .unique();

    if (conflictingTheatre && conflictingTheatre._id !== args.theatreId) {
      throw new Error("A theatre with that name already exists.");
    }

    const theatreId = existingTheatre
      ? existingTheatre._id
      : await ctx.db.insert("theatres", {
          slug: nextSlug,
          name: trimmedName,
          city: trimmedCity,
          state: trimmedState,
          address: trimmedAddress,
          screens: args.screens,
          amenities: normalizedAmenities,
          auditoriumName: trimmedAuditoriumName,
          defaultShowtimes: normalizedShowtimes,
          createdAt: now,
          updatedAt: now,
        });

    await ctx.db.patch(theatreId, {
      name: trimmedName,
      city: trimmedCity,
      state: trimmedState,
      address: trimmedAddress,
      screens: args.screens,
      amenities: normalizedAmenities,
      auditoriumName: trimmedAuditoriumName,
      defaultShowtimes: normalizedShowtimes,
      updatedAt: now,
    });

    const theatreConfig = buildManagedTheatreConfig({
      slug: nextSlug,
      name: trimmedName,
      city: trimmedCity,
      state: trimmedState,
      address: trimmedAddress,
      screens: args.screens,
      amenities: normalizedAmenities,
      auditoriumName: trimmedAuditoriumName,
      defaultShowtimes: normalizedShowtimes,
    });
    const futureSessions = await ctx.db.query("showSessions").collect();
    const matchingSessions = futureSessions.filter((session) => session.theatreSlug === nextSlug);
    const existingSessionKeys = new Set(matchingSessions.map((session) => `${session.movieId}::${session.date}::${session.time}`));

    for (const session of matchingSessions) {
      await ctx.db.patch(session._id, {
        theatreName: theatreConfig.name,
        theatreLocationLabel: getTheatreLocationLabel(theatreConfig.city, theatreConfig.state),
        auditoriumName: theatreConfig.auditoriumName,
        updatedAt: now,
      });
    }

    const groupedSessions = new Map<string, typeof matchingSessions>();

    for (const session of matchingSessions) {
      const groupKey = `${session.movieId}::${session.date}`;
      const sessionsForGroup = groupedSessions.get(groupKey) ?? [];
      sessionsForGroup.push(session);
      groupedSessions.set(groupKey, sessionsForGroup);
    }

    for (const sessionsForGroup of groupedSessions.values()) {
      const templateSession = sessionsForGroup[0];

      for (const time of theatreConfig.schedule) {
        const sessionKey = `${templateSession.movieId}::${templateSession.date}::${time}`;

        if (existingSessionKeys.has(sessionKey)) {
          continue;
        }

        await ctx.db.insert("showSessions", {
          movieId: templateSession.movieId,
          movieTitle: templateSession.movieTitle,
          posterPath: templateSession.posterPath,
          runtimeMinutes: templateSession.runtimeMinutes,
          seatMapRows: cloneSeatMapRows(theatreConfig.seatMapRows),
          seatCount: countSeatMapSeats(theatreConfig.seatMapRows),
          theatreSlug: theatreConfig.slug,
          theatreName: theatreConfig.name,
          theatreLocationLabel: getTheatreLocationLabel(theatreConfig.city, theatreConfig.state),
          auditoriumName: theatreConfig.auditoriumName,
          date: templateSession.date,
          time,
          createdAt: now,
          updatedAt: now,
        });
        existingSessionKeys.add(sessionKey);
      }
    }

    return { theatreId, slug: nextSlug };
  },
});

export const getRecentTicketCheckIns = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaffCapabilityOrThrow(ctx, "recentCheckIns");

    const reservations = await ctx.db.query("seatReservations").collect();
    const groupedReservations = new Map<string, typeof reservations>();

    for (const reservation of reservations) {
      if (!reservation.ticketCode || reservation.ticketUsedAt === undefined) {
        continue;
      }

      const existingReservations = groupedReservations.get(reservation.ticketCode) ?? [];
      existingReservations.push(reservation);
      groupedReservations.set(reservation.ticketCode, existingReservations);
    }

    const recentCheckIns = await Promise.all(
      Array.from(groupedReservations.values()).map(async (ticketReservations) => {
        const session = await ctx.db.get(ticketReservations[0].sessionId);

        if (!session) {
          return null;
        }

        return buildStaffTicketRecord(session, ticketReservations);
      })
    );

    return recentCheckIns
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .sort((left, right) => (right.usedAt ?? 0) - (left.usedAt ?? 0))
      .slice(0, Math.max(1, Math.min(args.limit ?? 8, 20)));
  },
});

export const markTicketUsed = mutation({
  args: {
    ticketCode: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireStaffCapabilityOrThrow(ctx, "scan");

    const reservations = await ctx.db
      .query("seatReservations")
      .withIndex("ticketCode", (query) => query.eq("ticketCode", args.ticketCode))
      .collect();

    if (reservations.length === 0) {
      throw new Error("Ticket not found.");
    }

    if (!reservations.every((reservation) => reservation.status === "confirmed")) {
      throw new Error("Ticket is not confirmed yet.");
    }

    const existingUsedAt = reservations.find(
      (reservation) => reservation.ticketUsedAt !== undefined
    )?.ticketUsedAt;

    if (existingUsedAt) {
      return {
        status: "used" as const,
        usedAt: existingUsedAt,
      };
    }

    const usedAt = Date.now();

    for (const reservation of reservations) {
      await ctx.db.patch(reservation._id, {
        ticketUsedAt: usedAt,
        ticketScannedByUserId: currentUser._id,
        ticketScannedByEmail: currentUser.email ?? undefined,
      });
    }

    return {
      status: "validated" as const,
      usedAt,
    };
  },
});

export const reserveSeats = mutation({
  args: {
    sessionId: v.id("showSessions"),
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

    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error("Show session not found.");
    }

    const sessionSeatMapRows = session.seatMapRows?.length
      ? session.seatMapRows
      : getDefaultSeatMapRows(session.theatreSlug);
    const validSeatLabels = new Set(getSeatLabelsFromMap(sessionSeatMapRows));

    for (const seatLabel of normalizedSeats) {
      if (!validSeatLabels.has(seatLabel)) {
        throw new Error(`${seatLabel} is not part of this theatre seat map.`);
      }
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