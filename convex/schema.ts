import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  paymentCheckouts: defineTable({
    userId: v.string(),
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
    expiresAt: v.number(),
    completedAt: v.optional(v.number()),
    items: v.array(
      v.object({
        sessionId: v.id("showSessions"),
        movieId: v.string(),
        movieTitle: v.string(),
        posterPath: v.optional(v.string()),
        date: v.string(),
        time: v.string(),
        seatLabels: v.array(v.string()),
        seatPrice: v.number(),
        totalPrice: v.number(),
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
    avatarStorageId: v.optional(v.id("_storage")),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("userId", ["userId"]),

  showSessions: defineTable({
    movieId: v.string(),
    movieTitle: v.string(),
    posterPath: v.optional(v.string()),
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
    status: v.optional(v.union(v.literal("held"), v.literal("confirmed"))),
  })
    .index("sessionId", ["sessionId"])
    .index("sessionId_seatLabel", ["sessionId", "seatLabel"])
    .index("reservedByUserId", ["reservedByUserId"]),
});