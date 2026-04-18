import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

const getCurrentUserOrThrow = async (ctx: Parameters<typeof authComponent.safeGetAuthUser>[0]) => {
  const currentUser = await authComponent.safeGetAuthUser(ctx);

  if (!currentUser) {
    throw new Error("You must be signed in to update your profile.");
  }

  return currentUser;
};

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);

    if (!currentUser) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (query) => query.eq("userId", currentUser._id))
      .unique();

    return {
      avatarUrl: profile?.avatarUrl ?? null,
      hasStoredAvatar: Boolean(profile?.avatarStorageId),
    };
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getCurrentUserOrThrow(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const resolveAvatarUpload = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await getCurrentUserOrThrow(ctx);

    const avatarUrl = await ctx.storage.getUrl(args.storageId);

    if (!avatarUrl) {
      throw new Error("Uploaded avatar could not be resolved.");
    }

    return { avatarUrl };
  },
});

export const commitAvatarUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    avatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (query) => query.eq("userId", currentUser._id))
      .unique();
    const now = Date.now();

    if (
      existingProfile?.avatarStorageId &&
      existingProfile.avatarStorageId !== args.storageId
    ) {
      await ctx.storage.delete(existingProfile.avatarStorageId);
    }

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        avatarStorageId: args.storageId,
        avatarUrl: args.avatarUrl,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId: currentUser._id,
        avatarStorageId: args.storageId,
        avatarUrl: args.avatarUrl,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { avatarUrl: args.avatarUrl };
  },
});

export const discardAvatarUpload = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (query) => query.eq("userId", currentUser._id))
      .unique();

    if (existingProfile?.avatarStorageId === args.storageId) {
      return { discarded: false };
    }

    await ctx.storage.delete(args.storageId);
    return { discarded: true };
  },
});

export const clearStoredAvatar = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (query) => query.eq("userId", currentUser._id))
      .unique();

    if (!existingProfile) {
      return { cleared: false };
    }

    if (existingProfile.avatarStorageId) {
      await ctx.storage.delete(existingProfile.avatarStorageId);
    }

    await ctx.db.delete(existingProfile._id);

    return { cleared: true };
  },
});