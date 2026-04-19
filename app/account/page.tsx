"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  HeartIcon,
  ImageIcon,
  LoaderCircleIcon,
  MailIcon,
  PencilLineIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketPlus,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuthSession } from "@/components/AuthSessionProvider";
import Loading from "@/components/Loading";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

type FavoriteMovie = {
  _id: string;
  movieId: string;
  movieTitle: string;
  releaseDate?: string;
  updatedAt: number;
};

type Booking = {
  id: string;
  movieId: string;
  movieTitle: string;
  date: string;
  time: string;
  seats: string[];
  status: "held" | "confirmed";
  isPaid: boolean;
};

type ProfileRecord = {
  avatarUrl: string | null;
  hasStoredAvatar: boolean;
};

type StorageUploadResponse = {
  storageId?: Id<"_storage">;
};

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;

const formatDisplayDate = (dateParam: string) => {
  const [month, day, year] = dateParam.split("-").map(Number);

  if (!month || !day || !year) {
    return dateParam;
  }

  const parsedDate = new Date(year, month - 1, day);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateParam;
  }

  return parsedDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function AccountPage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [localAvatarPreviewUrl, setLocalAvatarPreviewUrl] = useState("");
  const [isAvatarMarkedForRemoval, setIsAvatarMarkedForRemoval] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { data: session, isPending } = useAuthSession();
  const favorites = useQuery(
    api.favorites.getMyFavorites,
    session?.session ? {} : "skip"
  ) as FavoriteMovie[] | undefined;
  const profile = useQuery(
    api.userProfiles.getMyProfile,
    session?.session ? {} : "skip"
  ) as ProfileRecord | null | undefined;
  const bookings = useQuery(
    api.showSessions.getMyBookings,
    session?.session ? {} : "skip"
  ) as Booking[] | undefined;
  const generateAvatarUploadUrl = useMutation(api.userProfiles.generateAvatarUploadUrl);
  const resolveAvatarUpload = useMutation(api.userProfiles.resolveAvatarUpload);
  const commitAvatarUpload = useMutation(api.userProfiles.commitAvatarUpload);
  const discardAvatarUpload = useMutation(api.userProfiles.discardAvatarUpload);
  const clearStoredAvatar = useMutation(api.userProfiles.clearStoredAvatar);

  useEffect(() => {
    if (!session?.session) {
      return;
    }

    setDisplayName(session.user.name ?? "");
    setSelectedAvatarFile(null);
    setLocalAvatarPreviewUrl("");
    setIsAvatarMarkedForRemoval(false);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }, [session?.session, session?.user.image, session?.user.name]);

  useEffect(() => {
    if (!selectedAvatarFile) {
      setLocalAvatarPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedAvatarFile);
    setLocalAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedAvatarFile]);

  if (isPending) {
    return <Loading />;
  }

  if (!session?.session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.22),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/70">
              <UserRoundIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Account</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Sign in to view your profile hub.</h1>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-white/65">
            Your account page pulls together your saved favorites, booking activity, and profile details in one place.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Sign in
              <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30"
            >
              Create account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!favorites || !bookings || profile === undefined) {
    return <Loading />;
  }

  const trimmedDisplayName = displayName.trim();
  const currentAvatarUrl = profile?.avatarUrl ?? session.user.image ?? "";
  const avatarPreviewUrl = localAvatarPreviewUrl || (isAvatarMarkedForRemoval ? "" : currentAvatarUrl);
  const nameChanged = trimmedDisplayName !== (session.user.name ?? "").trim();
  const avatarChanged = Boolean(selectedAvatarFile) || (isAvatarMarkedForRemoval && Boolean(currentAvatarUrl));

  const hasProfileChanges = nameChanged || avatarChanged;

  const avatarLabel =
    (trimmedDisplayName || session.user.name)
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || session.user.email?.slice(0, 2).toUpperCase() || "QS";

  const activeHolds = bookings.filter((booking) => booking.status === "held");
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed");
  const latestFavorite = favorites[0];
  const nextBooking = bookings[0];

  const selectedAvatarLabel = selectedAvatarFile
    ? `${selectedAvatarFile.name} • ${(selectedAvatarFile.size / (1024 * 1024)).toFixed(1)} MB`
    : null;

  const resetAvatarSelection = () => {
    setSelectedAvatarFile(null);
    setIsAvatarMarkedForRemoval(false);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const handleAvatarSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];

    if (!nextFile) {
      return;
    }

    if (!nextFile.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (nextFile.size > MAX_AVATAR_FILE_SIZE) {
      toast.error("Avatar files must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setSelectedAvatarFile(nextFile);
    setIsAvatarMarkedForRemoval(false);
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedDisplayName) {
      toast.error("Display name is required.");
      return;
    }

    if (!hasProfileChanges) {
      toast("No profile changes to save.", {
        icon: "i",
      });
      return;
    }

    setIsSavingProfile(true);

    let uploadedStorageId: Id<"_storage"> | null = null;
    let uploadedAvatarUrl: string | null = null;
    let authProfileUpdated = false;

    try {
      if (selectedAvatarFile) {
        const uploadUrl = await generateAvatarUploadUrl({});
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": selectedAvatarFile.type || "application/octet-stream",
          },
          body: selectedAvatarFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Avatar upload failed.");
        }

        const { storageId } = (await uploadResponse.json()) as StorageUploadResponse;

        if (!storageId) {
          throw new Error("Avatar upload did not return a storage id.");
        }

        uploadedStorageId = storageId;
        const resolvedAvatar = await resolveAvatarUpload({ storageId });
        uploadedAvatarUrl = resolvedAvatar.avatarUrl;
      }

      const payload: {
        name?: string;
        image?: string | null;
      } = {};

      if (nameChanged) {
        payload.name = trimmedDisplayName;
      }

      if (uploadedAvatarUrl) {
        payload.image = uploadedAvatarUrl;
      } else if (isAvatarMarkedForRemoval) {
        payload.image = null;
      }

      const result = await authClient.updateUser(payload);

      if (result.error) {
        if (uploadedStorageId) {
          await discardAvatarUpload({ storageId: uploadedStorageId });
        }

        toast.error(result.error.message || "Unable to update profile.");
        return;
      }

      authProfileUpdated = true;

      if (uploadedStorageId && uploadedAvatarUrl) {
        await commitAvatarUpload({
          storageId: uploadedStorageId,
          avatarUrl: uploadedAvatarUrl,
        });
      }

      if (isAvatarMarkedForRemoval && profile?.hasStoredAvatar) {
        await clearStoredAvatar({});
      }

      resetAvatarSelection();
      router.refresh();

      toast.success("Profile updated");
    } catch (error) {
      if (uploadedStorageId && !authProfileUpdated) {
        await discardAvatarUpload({ storageId: uploadedStorageId });
      }

      toast.error(
        authProfileUpdated
          ? "Profile updated, but avatar storage could not finish syncing."
          : error instanceof Error
            ? error.message
            : "Unable to update profile."
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarClear = () => {
    setSelectedAvatarFile(null);
    setIsAvatarMarkedForRemoval(true);

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const handlePasswordSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Enter your current password and confirm the new password.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password confirmation does not match.");
      return;
    }

    if (newPassword === currentPassword) {
      toast.error("Choose a different password from your current one.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });

      if (result.error) {
        toast.error(result.error.message || "Unable to change password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.24),transparent_36%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-4xl border border-white/10 bg-[linear-gradient(135deg,rgba(127,29,29,0.22),rgba(255,255,255,0.03)_45%,rgba(0,0,0,0.18))] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-4xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.35),rgba(127,29,29,0.95))] text-3xl font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-red-950/30">
                {avatarPreviewUrl || session.user.image ? (
                  <span
                    aria-label={session.user.name || "User avatar"}
                    className="h-full w-full bg-cover bg-center"
                    role="img"
                    style={{ backgroundImage: `url(${avatarPreviewUrl || session.user.image})` }}
                  />
                ) : (
                  avatarLabel
                )}
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Account</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">{session.user.name || "Your profile"}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/65">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <MailIcon className="h-4 w-4 text-red-300" />
                    {session.user.email}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
                    Email account active
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <SparklesIcon className="h-4 w-4 text-amber-300" />
                    {avatarPreviewUrl || session.user.image ? "Avatar connected" : "Using initials avatar"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-104">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Favorites</p>
                <p className="mt-2 text-2xl font-semibold text-white">{favorites.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Active holds</p>
                <p className="mt-2 text-2xl font-semibold text-white">{activeHolds.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Confirmed</p>
                <p className="mt-2 text-2xl font-semibold text-white">{confirmedBookings.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Status</p>
                <p className="mt-2 text-lg font-semibold text-white">Member</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/my-bookings"
              className="inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700"
            >
              View bookings
              <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
            </Link>
            <Link
              href="/favorite"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30"
            >
              Open favorites
            </Link>
            <Link
              href="/movies"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30"
            >
              Browse movies
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <PencilLineIcon className="h-5 w-5 text-red-300" />
                <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Profile Settings</p>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleProfileSave}>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.25em] text-white/45">Display name</span>
                  <input
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                    maxLength={60}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name"
                    type="text"
                    value={displayName}
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.25em] text-white/45">Email</span>
                  <input
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white/70 outline-none"
                    readOnly
                    type="email"
                    value={session.user.email}
                  />
                </label>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/45">Avatar upload</p>
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        Upload a local image and it will be stored in Convex, then synced back into your auth profile.
                      </p>
                    </div>
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.35),rgba(127,29,29,0.95))] text-lg font-semibold uppercase tracking-[0.18em] text-white">
                      {avatarPreviewUrl ? (
                        <span
                          aria-label="Avatar preview"
                          className="h-full w-full bg-cover bg-center"
                          role="img"
                          style={{ backgroundImage: `url(${avatarPreviewUrl})` }}
                        />
                      ) : (
                        avatarLabel
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-4">
                    <input
                      accept="image/*"
                      className="block w-full text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-red-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-red-700"
                      onChange={handleAvatarSelection}
                      ref={avatarInputRef}
                      type="file"
                    />
                    <p className="mt-3 text-sm text-white/50">
                      PNG, JPG, GIF, or WebP up to 5 MB. Leave it alone to keep your current avatar.
                    </p>
                    {selectedAvatarLabel ? <p className="mt-2 text-sm text-white/70">{selectedAvatarLabel}</p> : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!currentAvatarUrl && !selectedAvatarFile}
                      onClick={handleAvatarClear}
                      type="button"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Remove avatar
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!selectedAvatarFile && !isAvatarMarkedForRemoval}
                      onClick={resetAvatarSelection}
                      type="button"
                    >
                      Reset upload
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start gap-3 text-sm text-white/60">
                    <CheckCircle2Icon className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <p>
                      Avatar replacements are stored in Convex and the previous stored file is cleaned up after the auth profile finishes updating.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingProfile || !hasProfileChanges}
                    type="submit"
                  >
                    {isSavingProfile ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : null}
                    {isSavingProfile ? "Saving profile..." : "Save changes"}
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSavingProfile || !hasProfileChanges}
                    onClick={() => {
                      setDisplayName(session.user.name ?? "");
                      resetAvatarSelection();
                    }}
                    type="button"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <ShieldCheckIcon className="h-5 w-5 text-red-300" />
                <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Security</p>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handlePasswordSave}>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.25em] text-white/45">Current password</span>
                  <input
                    autoComplete="current-password"
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    type="password"
                    value={currentPassword}
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.25em] text-white/45">New password</span>
                  <input
                    autoComplete="new-password"
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                    onChange={(event) => setNewPassword(event.target.value)}
                    type="password"
                    value={newPassword}
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.25em] text-white/45">Confirm new password</span>
                  <input
                    autoComplete="new-password"
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    value={confirmPassword}
                  />
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
                  <input
                    checked={revokeOtherSessions}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-black/20 text-red-600"
                    onChange={(event) => setRevokeOtherSessions(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Sign out your other sessions after the password change completes.</span>
                </label>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start gap-3 text-sm text-white/60">
                    <CheckCircle2Icon className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <p>
                      This uses Better Auth&apos;s password-change route directly, so the update stays inside the existing auth system instead of a parallel custom flow.
                    </p>
                  </div>
                </div>

                <button
                  className="inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isChangingPassword}
                  type="submit"
                >
                  {isChangingPassword ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : null}
                  {isChangingPassword ? "Updating password..." : "Change password"}
                </button>
              </form>
            </article>
          </div>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Activity</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3 text-sm text-white/55">
                  <TicketPlus className="h-4 w-4 text-red-300" />
                  Next booking
                </div>
                {nextBooking ? (
                  <>
                    <p className="mt-3 text-lg font-semibold text-white">{nextBooking.movieTitle}</p>
                    <p className="mt-2 text-sm text-white/60">
                      {formatDisplayDate(nextBooking.date)} at {nextBooking.time} • Seats {nextBooking.seats.join(", ")}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    No active holds or confirmed tickets yet. Once you pick seats, they will show up here.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3 text-sm text-white/55">
                  <HeartIcon className="h-4 w-4 text-red-300" />
                  Latest favorite
                </div>
                {latestFavorite ? (
                  <>
                    <p className="mt-3 text-lg font-semibold text-white">{latestFavorite.movieTitle}</p>
                    <p className="mt-2 text-sm text-white/60">
                      Saved to your account{latestFavorite.releaseDate ? ` • Released ${latestFavorite.releaseDate}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    You have not saved any favorites yet. Use the heart icon on movie pages to start building your shortlist.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3 text-sm text-white/55">
                  <CalendarDaysIcon className="h-4 w-4 text-red-300" />
                  Account note
                </div>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  Profile edits now cover stored avatar uploads and password changes. The remaining obvious extensions here are notification preferences and connected auth providers.
                </p>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}