import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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