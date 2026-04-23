import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const seatMapCellValidator = v.object({
  kind: v.union(
    v.literal("standard"),
    v.literal("premium"),
    v.literal("accessible"),
    v.literal("companion"),
    v.literal("gap")
  ),
  label: v.optional(v.string()),
});

const seatMapRowValidator = v.object({
  rowLabel: v.string(),
  seats: v.array(seatMapCellValidator),
});

export default defineSchema({
  paymentCheckouts: defineTable({
    userId: v.string(),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
    sendReceiptEmail: v.optional(v.boolean()),
    stripeCheckoutSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("expired"),
      v.literal("failed")
    ),
    currency: v.string(),
    seatCount: v.number(),
    totalPrice: v.number(),
    addOnsTotal: v.optional(v.number()),
    addOns: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          description: v.string(),
          quantity: v.number(),
          unitPrice: v.number(),
          totalPrice: v.number(),
        })
      )
    ),
    expiresAt: v.number(),
    completedAt: v.optional(v.number()),
    items: v.array(
      v.object({
        sessionId: v.id("showSessions"),
        movieId: v.string(),
        movieTitle: v.string(),
        posterPath: v.optional(v.string()),
        theatreName: v.optional(v.string()),
        theatreLocationLabel: v.optional(v.string()),
        auditoriumName: v.optional(v.string()),
        ticketCode: v.optional(v.string()),
        date: v.string(),
        time: v.string(),
        seatLabels: v.array(v.string()),
        seatPrice: v.number(),
        totalPrice: v.number(),
        refundedAt: v.optional(v.number()),
        refundedAmount: v.optional(v.number()),
        refundId: v.optional(v.string()),
        refundStatus: v.optional(v.union(v.literal("pending"), v.literal("succeeded"))),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("stripeCheckoutSessionId", ["stripeCheckoutSessionId"]),

  favorites: defineTable({
    userId: v.string(),
    movieId: v.string(),
    movieTitle: v.string(),
    posterPath: v.optional(v.string()),
    backdropPath: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    voteAverage: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("userId_movieId", ["userId", "movieId"]),

  userProfiles: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    avatarUrl: v.optional(v.string()),
    marketingEmails: v.optional(v.boolean()),
    receiptEmails: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("userId", ["userId"]),

  ticketScannerStaff: defineTable({
    email: v.string(),
    role: v.optional(v.union(v.literal("ticket_staff"), v.literal("manager"), v.literal("admin"))),
    grantedByUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("email", ["email"]),

  theatres: defineTable({
    slug: v.string(),
    name: v.string(),
    city: v.string(),
    state: v.string(),
    address: v.string(),
    amenities: v.array(v.string()),
    screens: v.number(),
    auditoriumName: v.optional(v.string()),
    defaultShowtimes: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("slug", ["slug"]),

  showSessions: defineTable({
    movieId: v.string(),
    movieTitle: v.string(),
    posterPath: v.optional(v.string()),
    runtimeMinutes: v.optional(v.number()),
    seatMapRows: v.optional(v.array(seatMapRowValidator)),
    seatCount: v.optional(v.number()),
    theatreSlug: v.optional(v.string()),
    theatreName: v.optional(v.string()),
    theatreLocationLabel: v.optional(v.string()),
    auditoriumName: v.optional(v.string()),
    date: v.string(),
    time: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("movieId_date", ["movieId", "date"])
    .index("movieId_date_time", ["movieId", "date", "time"]),

  seatReservations: defineTable({
    sessionId: v.id("showSessions"),
    seatLabel: v.string(),
    reservedAt: v.number(),
    reservedByName: v.optional(v.string()),
    reservedByEmail: v.optional(v.string()),
    reservedByUserId: v.optional(v.string()),
    holdExpiresAt: v.optional(v.number()),
    ticketCode: v.optional(v.string()),
    ticketIssuedAt: v.optional(v.number()),
    ticketUsedAt: v.optional(v.number()),
    ticketScannedByUserId: v.optional(v.string()),
    ticketScannedByEmail: v.optional(v.string()),
    canceledAt: v.optional(v.number()),
    canceledByUserId: v.optional(v.string()),
    refundId: v.optional(v.string()),
    refundedAmount: v.optional(v.number()),
    status: v.optional(v.union(v.literal("held"), v.literal("confirmed"))),
  })
    .index("sessionId", ["sessionId"])
    .index("sessionId_seatLabel", ["sessionId", "seatLabel"])
    .index("reservedByUserId", ["reservedByUserId"])
    .index("ticketCode", ["ticketCode"]),
});