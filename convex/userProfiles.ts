import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import {
  STAFF_ROLES,
  buildStaffAccessSummary,
  getEffectiveStaffRole,
  normalizeStaffEmail,
} from "./staffAccess";

const getTicketScannerStaffRecord = async (
  ctx: QueryCtx | MutationCtx,
  email: string
) => {
  return await ctx.db
    .query("ticketScannerStaff")
    .withIndex("email", (query) => query.eq("email", normalizeStaffEmail(email)))
    .unique();
};

const getTicketScannerAccessSummary = async (
  ctx: QueryCtx | MutationCtx,
  currentUser: Awaited<ReturnType<typeof authComponent.safeGetAuthUser>>
) => {
  const staffMembers = await ctx.db.query("ticketScannerStaff").collect();

  return buildStaffAccessSummary(currentUser ?? null, staffMembers);
};

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

export const getTicketScannerAccess = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await authComponent.safeGetAuthUser(ctx);

    return await getTicketScannerAccessSummary(ctx, currentUser);
  },
});

export const listTicketScannerStaff = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const access = await getTicketScannerAccessSummary(ctx, currentUser);

    if (!access.isStaff && !access.canBootstrap) {
      throw new Error("You do not have permission to manage ticket staff.");
    }

    const staffMembers = await ctx.db.query("ticketScannerStaff").collect();

    return staffMembers
      .map((member) => ({
        email: member.email,
        role: getEffectiveStaffRole(member),
        grantedByUserId: member.grantedByUserId,
        createdAt: member.createdAt,
      }))
      .sort((left, right) => left.email.localeCompare(right.email));
  },
});

export const claimInitialTicketScannerAccess = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const access = await getTicketScannerAccessSummary(ctx, currentUser);

    if (!currentUser.email) {
      throw new Error("Your account must have an email before it can manage ticket staff.");
    }

    if (!access.canBootstrap) {
      throw new Error("Ticket staff has already been configured.");
    }

    const now = Date.now();

    await ctx.db.insert("ticketScannerStaff", {
      email: normalizeStaffEmail(currentUser.email),
      role: "admin",
      grantedByUserId: currentUser._id,
      createdAt: now,
      updatedAt: now,
    });

    return {
      email: normalizeStaffEmail(currentUser.email),
      isStaff: true,
      role: "admin",
    };
  },
});

export const setTicketScannerStaffAccess = mutation({
  args: {
    email: v.string(),
    isStaff: v.boolean(),
    role: v.optional(v.union(...STAFF_ROLES.map((role) => v.literal(role)))),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserOrThrow(ctx);
    const access = await getTicketScannerAccessSummary(ctx, currentUser);

    if (!access.canManageStaff) {
      throw new Error("You do not have permission to manage ticket staff.");
    }

    const normalizedEmail = normalizeStaffEmail(args.email);

    if (!normalizedEmail) {
      throw new Error("Enter a valid email address.");
    }

    const nextRole = args.role ?? "ticket_staff";

    if (nextRole === "admin" && !access.canAssignAdmin) {
      throw new Error("Only admins can assign admin access.");
    }

    if (nextRole === "manager" && !access.canAssignManager) {
      throw new Error("Only admins can assign manager access.");
    }

    const existingStaffMember = await getTicketScannerStaffRecord(ctx, normalizedEmail);
    const allStaffMembers = await ctx.db.query("ticketScannerStaff").collect();
    const now = Date.now();

    if (
      existingStaffMember &&
      getEffectiveStaffRole(existingStaffMember) !== "ticket_staff" &&
      !access.canAssignManager
    ) {
      throw new Error("Only admins can change manager or admin accounts.");
    }

    if (args.isStaff) {
      if (
        existingStaffMember &&
        getEffectiveStaffRole(existingStaffMember) === "admin" &&
        nextRole !== "admin" &&
        allStaffMembers.filter((member) => getEffectiveStaffRole(member) === "admin").length <= 1
      ) {
        throw new Error("At least one admin must remain on the staff team.");
      }

      if (existingStaffMember) {
        await ctx.db.patch(existingStaffMember._id, {
          role: nextRole,
          updatedAt: now,
          grantedByUserId: currentUser._id,
        });
      } else {
        await ctx.db.insert("ticketScannerStaff", {
          email: normalizedEmail,
          role: nextRole,
          grantedByUserId: currentUser._id,
          createdAt: now,
          updatedAt: now,
        });
      }

      return {
        email: normalizedEmail,
        isStaff: true,
        role: nextRole,
      };
    }

    if (existingStaffMember) {
      if (
        getEffectiveStaffRole(existingStaffMember) === "admin" &&
        allStaffMembers.filter((member) => getEffectiveStaffRole(member) === "admin").length <= 1
      ) {
        throw new Error("At least one admin must remain on the staff team.");
      }

      if (getEffectiveStaffRole(existingStaffMember) !== "ticket_staff" && !access.canAssignManager) {
        throw new Error("Only admins can remove manager or admin accounts.");
      }

      await ctx.db.delete(existingStaffMember._id);
    }

    return {
      email: normalizedEmail,
      isStaff: false,
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