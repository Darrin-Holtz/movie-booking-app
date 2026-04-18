import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

export const getMyFavorites = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);

    if (!currentUser) {
      return [];
    }

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("userId", (query) => query.eq("userId", currentUser._id))
      .collect();

    return favorites.sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const isFavorite = query({
  args: {
    movieId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);

    if (!currentUser) {
      return { isFavorite: false };
    }

    const favorite = await ctx.db
      .query("favorites")
      .withIndex("userId_movieId", (query) =>
        query.eq("userId", currentUser._id).eq("movieId", args.movieId)
      )
      .unique();

    return {
      isFavorite: Boolean(favorite),
    };
  },
});

export const addFavorite = mutation({
  args: {
    movieId: v.string(),
    movieTitle: v.string(),
    posterPath: v.optional(v.string()),
    backdropPath: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    voteAverage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);

    if (!currentUser) {
      throw new Error("You must be signed in to save favorites.");
    }

    const existingFavorite = await ctx.db
      .query("favorites")
      .withIndex("userId_movieId", (query) =>
        query.eq("userId", currentUser._id).eq("movieId", args.movieId)
      )
      .unique();

    const now = Date.now();

    if (existingFavorite) {
      await ctx.db.patch(existingFavorite._id, {
        movieTitle: args.movieTitle,
        posterPath: args.posterPath,
        backdropPath: args.backdropPath,
        releaseDate: args.releaseDate,
        voteAverage: args.voteAverage,
        updatedAt: now,
      });

      return {
        isFavorite: true,
      };
    }

    await ctx.db.insert("favorites", {
      userId: currentUser._id,
      movieId: args.movieId,
      movieTitle: args.movieTitle,
      posterPath: args.posterPath,
      backdropPath: args.backdropPath,
      releaseDate: args.releaseDate,
      voteAverage: args.voteAverage,
      createdAt: now,
      updatedAt: now,
    });

    return {
      isFavorite: true,
    };
  },
});

export const removeFavorite = mutation({
  args: {
    movieId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);

    if (!currentUser) {
      throw new Error("You must be signed in to update favorites.");
    }

    const favorite = await ctx.db
      .query("favorites")
      .withIndex("userId_movieId", (query) =>
        query.eq("userId", currentUser._id).eq("movieId", args.movieId)
      )
      .unique();

    if (favorite) {
      await ctx.db.delete(favorite._id);
    }

    return {
      isFavorite: false,
    };
  },
});