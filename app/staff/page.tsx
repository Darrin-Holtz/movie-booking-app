"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useDeferredValue, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRightIcon,
  BarChart3Icon,
  Building2Icon,
  CameraIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  MailIcon,
  PlusIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TicketPlus,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuthSession } from "@/components/AuthSessionProvider";
import Loading from "@/components/Loading";
import { api } from "@/convex/_generated/api";

type StaffRole = "ticket_staff" | "manager" | "admin";
type SearchField = "all" | "ticket" | "movie" | "customer" | "theatre" | "showtime";
type TicketStatusFilter = "all" | "valid" | "used" | "not_confirmed";

type TicketScannerAccess = {
  email: string | null;
  role: StaffRole | null;
  roleLabel: string | null;
  isStaff: boolean;
  isConfigured: boolean;
  canBootstrap: boolean;
  canScanTickets: boolean;
  canLookupTickets: boolean;
  canViewRecentCheckIns: boolean;
  canViewAttendance: boolean;
  canManageStaff: boolean;
  canManageTheatres: boolean;
  canAssignManager: boolean;
  canAssignAdmin: boolean;
  totalStaffMembers: number;
};

type TicketScannerStaffMember = {
  email: string;
  role: StaffRole;
  grantedByUserId: string;
  createdAt: number;
};

type StaffTicketRecord = {
  ticketCode: string;
  movieTitle: string;
  theatreName: string;
  theatreLocationLabel: string;
  auditoriumName: string;
  date: string;
  time: string;
  seats: string[];
  customerEmail: string | null;
  customerName: string | null;
  status: "valid" | "used" | "not_confirmed";
  usedAt: number | null;
  issuedAt: number;
  scannedByEmail: string | null;
};

type AttendanceRecord = {
  sessionId: string;
  movieTitle: string;
  theatreName: string;
  theatreLocationLabel: string;
  auditoriumName: string;
  date: string;
  time: string;
  totalTickets: number;
  checkedInCount: number;
  remainingCount: number;
  latestCheckInAt: number | null;
  attendancePercent: number;
};

type ManagedTheatre = {
  _id: Id<"theatres">;
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
  screens: number;
  amenities: string[];
  auditoriumName: string;
  defaultShowtimes: string[];
  upcomingSessions: Array<{
    sessionId: string;
    movieId: string;
    movieTitle: string;
    date: string;
    time: string;
  }>;
};

type TheatreDraft = {
  name: string;
  city: string;
  state: string;
  address: string;
  screens: string;
  auditoriumName: string;
  amenitiesText: string;
  defaultShowtimesText: string;
};

const roleLabels: Record<StaffRole, string> = {
  ticket_staff: "Ticket Staff",
  manager: "Manager",
  admin: "Admin",
};

const searchFieldLabels: Record<SearchField, string> = {
  all: "Everything",
  ticket: "Ticket code",
  movie: "Movie",
  customer: "Customer",
  theatre: "Theatre",
  showtime: "Showtime",
};

const statusLabels: Record<TicketStatusFilter, string> = {
  all: "All statuses",
  valid: "Valid only",
  used: "Used only",
  not_confirmed: "Not confirmed",
};

const normalizeTicketLookupValue = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    const pathMatch = parsedUrl.pathname.match(/\/tickets\/([^/?#]+)/i);

    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]).toUpperCase();
    }
  } catch {
    const pathMatch = trimmedValue.match(/\/tickets\/([^/?#]+)/i);

    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]).toUpperCase();
    }
  }

  return trimmedValue.toUpperCase();
};

const looksLikeTicketCode = (value: string) => {
  const normalizedValue = normalizeTicketLookupValue(value);
  return normalizedValue.startsWith("QS-") || normalizedValue.includes("/TICKETS/");
};

const formatRoleLabel = (role: StaffRole) => roleLabels[role];

const formatCheckInTime = (timestamp: number | null) => {
  if (!timestamp) {
    return "Not checked in";
  }

  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const buildTheatreDraft = (theatre: ManagedTheatre): TheatreDraft => ({
  name: theatre.name,
  city: theatre.city,
  state: theatre.state,
  address: theatre.address,
  screens: String(theatre.screens),
  auditoriumName: theatre.auditoriumName,
  amenitiesText: theatre.amenities.join(", "),
  defaultShowtimesText: theatre.defaultShowtimes.join(", "),
});

const emptyTheatreDraft = (): TheatreDraft => ({
  name: "",
  city: "",
  state: "NY",
  address: "",
  screens: "6",
  auditoriumName: "Main House",
  amenitiesText: "Reserved Seating, Recliners",
  defaultShowtimesText: "12:00 PM, 3:30 PM, 6:45 PM, 9:15 PM",
});

const splitCommaValues = (value: string) =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

export default function StaffDashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useAuthSession();
  const [staffEmailInput, setStaffEmailInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<StaffRole>("ticket_staff");
  const [lookupValue, setLookupValue] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [searchStatus, setSearchStatus] = useState<TicketStatusFilter>("all");
  const [searchDate, setSearchDate] = useState("");
  const [attendanceDate, setAttendanceDate] = useState("");
  const [attendanceSearchInput, setAttendanceSearchInput] = useState("");
  const [promoSubjectInput, setPromoSubjectInput] = useState("This week at QuickShow");
  const [promoMessageInput, setPromoMessageInput] = useState("Thanks for being a QuickShow member. Check the latest movies and special offers this week.");
  const [isUpdatingTicketStaff, setIsUpdatingTicketStaff] = useState(false);
  const [isSavingTheatre, setIsSavingTheatre] = useState(false);
  const [isSendingPromoEmail, setIsSendingPromoEmail] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, StaffRole>>({});
  const [theatreDrafts, setTheatreDrafts] = useState<Record<string, TheatreDraft>>({});
  const [newTheatreDraft, setNewTheatreDraft] = useState<TheatreDraft>(emptyTheatreDraft);
  const deferredLookupValue = useDeferredValue(lookupValue.trim());
  const deferredAttendanceSearch = useDeferredValue(attendanceSearchInput.trim());

  const ticketScannerAccess = useQuery(
    api.userProfiles.getTicketScannerAccess,
    session?.session ? {} : "skip"
  ) as TicketScannerAccess | undefined;
  const ticketScannerStaff = useQuery(
    api.userProfiles.listTicketScannerStaff,
    session?.session && (ticketScannerAccess?.canManageStaff || ticketScannerAccess?.canBootstrap)
      ? {}
      : "skip"
  ) as TicketScannerStaffMember[] | undefined;
  const searchResults = useQuery(
    api.showSessions.searchStaffTickets,
    session?.session && ticketScannerAccess?.canLookupTickets && (deferredLookupValue.length >= 2 || searchStatus !== "all" || Boolean(searchDate))
      ? {
          searchTerm: deferredLookupValue,
          searchField,
          status: searchStatus,
          showDate: searchDate || undefined,
        }
      : "skip"
  ) as StaffTicketRecord[] | undefined;
  const recentCheckIns = useQuery(
    api.showSessions.getRecentTicketCheckIns,
    session?.session && ticketScannerAccess?.canViewRecentCheckIns ? { limit: 8 } : "skip"
  ) as StaffTicketRecord[] | undefined;
  const attendanceOverview = useQuery(
    api.showSessions.getAttendanceOverview,
    session?.session && ticketScannerAccess?.canViewAttendance
      ? {
          date: attendanceDate || undefined,
          searchTerm: deferredAttendanceSearch || undefined,
        }
      : "skip"
  ) as AttendanceRecord[] | undefined;
  const managedTheatres = useQuery(
    api.showSessions.listManagedTheatres,
    session?.session && ticketScannerAccess?.canManageTheatres ? {} : "skip"
  ) as ManagedTheatre[] | undefined;
  const claimInitialTicketScannerAccess = useMutation(api.userProfiles.claimInitialTicketScannerAccess);
  const setTicketScannerStaffAccess = useMutation(api.userProfiles.setTicketScannerStaffAccess);
  const sendPromotionalEmailCampaign = useMutation(api.userProfiles.sendPromotionalEmailCampaign);
  const saveManagedTheatre = useMutation(api.showSessions.saveManagedTheatre);

  useEffect(() => {
    if (!managedTheatres) {
      return;
    }

    setTheatreDrafts((current) => {
      const nextDrafts = { ...current };

      for (const theatre of managedTheatres) {
        nextDrafts[theatre._id] = buildTheatreDraft(theatre);
      }

      return nextDrafts;
    });
  }, [managedTheatres]);

  const handleClaimTicketScannerAccess = async () => {
    setIsUpdatingTicketStaff(true);

    try {
      await claimInitialTicketScannerAccess({});
      toast.success("Staff access is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to set up staff access.");
    } finally {
      setIsUpdatingTicketStaff(false);
    }
  };

  const handleGrantTicketScannerAccess = async () => {
    const normalizedEmail = staffEmailInput.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Enter a staff email.");
      return;
    }

    setIsUpdatingTicketStaff(true);

    try {
      await setTicketScannerStaffAccess({
        email: normalizedEmail,
        isStaff: true,
        role: selectedRole,
      });
      setStaffEmailInput("");
      setSelectedRole("ticket_staff");
      toast.success("Staff access updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update staff access.");
    } finally {
      setIsUpdatingTicketStaff(false);
    }
  };

  const handleUpdateTicketScannerRole = async (email: string, role: StaffRole) => {
    setIsUpdatingTicketStaff(true);

    try {
      await setTicketScannerStaffAccess({
        email,
        isStaff: true,
        role,
      });
      setRoleDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[email];
        return nextDrafts;
      });
      toast.success("Staff role updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update staff role.");
    } finally {
      setIsUpdatingTicketStaff(false);
    }
  };

  const handleRemoveTicketScannerAccess = async (email: string) => {
    setIsUpdatingTicketStaff(true);

    try {
      await setTicketScannerStaffAccess({
        email,
        isStaff: false,
      });
      toast.success("Staff access removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove staff access.");
    } finally {
      setIsUpdatingTicketStaff(false);
    }
  };

  const handleSendPromotionalEmail = async () => {
    const subject = promoSubjectInput.trim();
    const message = promoMessageInput.trim();

    if (!subject || !message) {
      toast.error("Enter both a promo subject and message.");
      return;
    }

    setIsSendingPromoEmail(true);

    try {
      const result = await sendPromotionalEmailCampaign({ subject, message });
      toast.success(`Promotion queued for ${result.queuedCount} member${result.queuedCount === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send the promotional email.");
    } finally {
      setIsSendingPromoEmail(false);
    }
  };

  const handleLookupSubmit = () => {
    const normalizedValue = normalizeTicketLookupValue(lookupValue);

    if (!normalizedValue) {
      toast.error("Enter a ticket code, movie, showtime, or customer email.");
      return;
    }

    if (looksLikeTicketCode(lookupValue)) {
      router.push(`/tickets/scan?ticket=${encodeURIComponent(normalizedValue)}`);
      return;
    }

    toast("Use the results list below for filtered searches.", {
      icon: "i",
    });
  };

  const handleTheatreDraftChange = (
    theatreId: string,
    field: keyof TheatreDraft,
    value: string
  ) => {
    setTheatreDrafts((current) => ({
      ...current,
      [theatreId]: {
        ...current[theatreId],
        [field]: value,
      },
    }));
  };

  const handleNewTheatreDraftChange = (field: keyof TheatreDraft, value: string) => {
    setNewTheatreDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveTheatreDraft = async (theatreId?: Id<"theatres">, draft?: TheatreDraft) => {
    const targetDraft = draft ?? (theatreId ? theatreDrafts[theatreId] : null);

    if (!targetDraft) {
      return;
    }

    setIsSavingTheatre(true);

    try {
      await saveManagedTheatre({
        ...(theatreId ? { theatreId } : {}),
        name: targetDraft.name,
        city: targetDraft.city,
        state: targetDraft.state,
        address: targetDraft.address,
        screens: Number(targetDraft.screens),
        auditoriumName: targetDraft.auditoriumName,
        amenities: splitCommaValues(targetDraft.amenitiesText),
        defaultShowtimes: splitCommaValues(targetDraft.defaultShowtimesText),
      });

      if (!theatreId) {
        setNewTheatreDraft(emptyTheatreDraft());
      }

      toast.success(theatreId ? "Theatre updated." : "Theatre created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save theatre.");
    } finally {
      setIsSavingTheatre(false);
    }
  };

  if (isPending) {
    return <Loading />;
  }

  if (!session?.session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.24),transparent_36%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-5xl rounded-4xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/70">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Staff</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Sign in to open the staff dashboard.</h1>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-white/65">
            The staff area groups scanning, check-in, ticket lookup, attendance, and theatre management into one place.
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
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30"
            >
              Back home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isLookupActive = deferredLookupValue.length >= 2 || searchStatus !== "all" || Boolean(searchDate);
  const isSearchLoading = Boolean(ticketScannerAccess?.canLookupTickets && isLookupActive && searchResults === undefined);
  const isAttendanceLoading = Boolean(ticketScannerAccess?.canViewAttendance && attendanceOverview === undefined);

  if (
    ticketScannerAccess === undefined ||
    ((ticketScannerAccess.canManageStaff || ticketScannerAccess.canBootstrap) && ticketScannerStaff === undefined) ||
    (ticketScannerAccess.canViewRecentCheckIns && recentCheckIns === undefined) ||
    (ticketScannerAccess.canManageTheatres && managedTheatres === undefined)
  ) {
    return <Loading />;
  }

  const assignableRoles: StaffRole[] = ticketScannerAccess.canAssignAdmin
    ? ["ticket_staff", "manager", "admin"]
    : ticketScannerAccess.canAssignManager
      ? ["ticket_staff", "manager"]
      : ["ticket_staff"];
  const visibleSearchResults = searchResults ?? [];
  const visibleRecentCheckIns = recentCheckIns ?? [];
  const visibleAttendance = attendanceOverview ?? [];
  const visibleManagedTheatres = managedTheatres ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.24),transparent_36%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-4xl border border-white/10 bg-[linear-gradient(135deg,rgba(127,29,29,0.22),rgba(255,255,255,0.03)_45%,rgba(0,0,0,0.18))] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Staff</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">Ticket operations dashboard.</h1>
              <p className="mt-4 max-w-2xl text-white/65">
                Search guests faster, watch attendance by showtime, and let admins control theatre defaults without leaving the staff area.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm md:min-w-104">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Your role</p>
                <p className="mt-2 text-lg font-semibold text-white">{ticketScannerAccess.roleLabel ?? "Not staff"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Staff list</p>
                <p className="mt-2 text-lg font-semibold text-white">{ticketScannerAccess.totalStaffMembers}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Attendance view</p>
                <p className="mt-2 text-lg font-semibold text-white">{ticketScannerAccess.canViewAttendance ? "Enabled" : "Manager+ only"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Theatre controls</p>
                <p className="mt-2 text-lg font-semibold text-white">{ticketScannerAccess.canManageTheatres ? "Admin" : "Admin only"}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/tickets/scan?camera=1"
              className="inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700"
            >
              <CameraIcon className="h-4 w-4" />
              Open live scanner
            </Link>
            <Link
              href="/tickets/scan"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30"
            >
              <TicketPlus className="h-4 w-4" />
              Open check-in desk
            </Link>
            <Link
              href="/account"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30"
            >
              Back to account
            </Link>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <SearchIcon className="h-5 w-5 text-red-300" />
              <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Customer Lookup</p>
            </div>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/60">
              Search by customer name, partial email, movie, theatre, showtime, or ticket code. Filters help staff narrow down used, valid, and not-confirmed tickets.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/75">
                <SearchIcon className="h-4 w-4 text-red-300" />
                <input
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                  onChange={(event) => setLookupValue(event.target.value)}
                  placeholder="Search by customer, movie, showtime, theatre, or ticket"
                  type="text"
                  value={lookupValue}
                />
              </label>
              <button
                type="button"
                onClick={handleLookupSubmit}
                className="rounded-2xl bg-red-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Open exact ticket
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                value={searchField}
                onChange={(event) => setSearchField(event.target.value as SearchField)}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              >
                {Object.entries(searchFieldLabels).map(([value, label]) => (
                  <option key={value} value={value} className="bg-black text-white">
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={searchStatus}
                onChange={(event) => setSearchStatus(event.target.value as TicketStatusFilter)}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value} className="bg-black text-white">
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={searchDate}
                onChange={(event) => setSearchDate(event.target.value)}
                placeholder="MM-DD-YYYY"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500 placeholder:text-white/35"
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Link
                href="/tickets/scan?camera=1"
                className="rounded-3xl border border-white/10 bg-black/20 p-5 transition hover:border-white/20"
              >
                <CameraIcon className="h-5 w-5 text-emerald-200" />
                <p className="mt-4 text-lg font-semibold text-white">Live scan</p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Start the rear camera right away for fast door check-in.
                </p>
              </Link>
              <Link
                href="/tickets/scan"
                className="rounded-3xl border border-white/10 bg-black/20 p-5 transition hover:border-white/20"
              >
                <ShieldCheckIcon className="h-5 w-5 text-emerald-200" />
                <p className="mt-4 text-lg font-semibold text-white">Manual check-in</p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Use code entry, QR photo upload, and mark-used controls from the same screen.
                </p>
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.25em] text-white/45">Search results</p>
                <p className="text-xs text-white/45">
                  {isLookupActive
                    ? `${visibleSearchResults.length} match${visibleSearchResults.length === 1 ? "" : "es"}`
                    : "Add a search or filter to begin"}
                </p>
              </div>

              {isLookupActive ? (
                isSearchLoading ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-white/55">
                    Searching tickets…
                  </div>
                ) : visibleSearchResults.length > 0 ? (
                  <div className="grid gap-4">
                    {visibleSearchResults.map((record) => (
                      <article
                        key={record.ticketCode}
                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-semibold text-white">{record.movieTitle}</h2>
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                                record.status === "used"
                                  ? "border border-amber-400/20 bg-amber-400/10 text-amber-200"
                                  : record.status === "valid"
                                    ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                    : "border border-red-400/20 bg-red-400/10 text-red-200"
                              }`}>
                                {record.status === "used"
                                  ? "Used"
                                  : record.status === "valid"
                                    ? "Valid"
                                    : "Not confirmed"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-white/60">
                              {record.theatreName} • {record.theatreLocationLabel} • {record.auditoriumName}
                            </p>
                            <p className="mt-1 text-sm text-white/60">
                              {record.date} at {record.time} • Seats {record.seats.join(", ")}
                            </p>
                            <p className="mt-1 text-sm text-white/50">
                              {record.customerName ?? "Guest"}
                              {record.customerEmail ? ` • ${record.customerEmail}` : ""}
                            </p>
                            <p className="mt-2 text-xs text-white/45">
                              Ticket {record.ticketCode}
                              {record.usedAt ? ` • Checked in ${formatCheckInTime(record.usedAt)}` : ""}
                              {record.scannedByEmail ? ` • Scanned by ${record.scannedByEmail}` : ""}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-3 lg:justify-end">
                            <Link
                              href={`/tickets/scan?ticket=${encodeURIComponent(record.ticketCode)}`}
                              className="inline-flex items-center gap-2 rounded-full bg-red-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                            >
                              Open scan view
                            </Link>
                            <Link
                              href={`/tickets/${record.ticketCode}`}
                              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30"
                            >
                              Open ticket
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-white/55">
                    No tickets matched those filters.
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-white/55">
                  Search is live once you type 2 or more characters, or use the status and date filters.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <CheckCircle2Icon className="h-5 w-5 text-red-300" />
              <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Recent Check-Ins</p>
            </div>

            <div className="mt-5 space-y-4">
              {visibleRecentCheckIns.length > 0 ? (
                visibleRecentCheckIns.map((record) => (
                  <article key={`${record.ticketCode}-${record.usedAt ?? 0}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-white">{record.movieTitle}</p>
                        <p className="mt-2 text-sm text-white/60">
                          {record.date} at {record.time} • Seats {record.seats.join(", ")}
                        </p>
                        <p className="mt-1 text-sm text-white/50">
                          {record.customerEmail ?? record.customerName ?? "Guest"}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                        Used
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-white/45">
                      {formatCheckInTime(record.usedAt)}
                      {record.scannedByEmail ? ` • Scanned by ${record.scannedByEmail}` : ""}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-white/55">
                  No ticket check-ins yet.
                </div>
              )}
            </div>
          </article>
        </section>

        {ticketScannerAccess.canViewAttendance ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <BarChart3Icon className="h-5 w-5 text-red-300" />
              <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Attendance Overview</p>
            </div>

            <p className="mt-5 max-w-3xl text-sm leading-6 text-white/60">
              This view is for managers and admins. It groups check-ins by movie and showtime so staff can see which sessions are filling up and how many guests are still waiting.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-[200px_1fr]">
              <input
                type="text"
                value={attendanceDate}
                onChange={(event) => setAttendanceDate(event.target.value)}
                placeholder="MM-DD-YYYY"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500 placeholder:text-white/35"
              />
              <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white/75">
                <SearchIcon className="h-4 w-4 text-red-300" />
                <input
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                  onChange={(event) => setAttendanceSearchInput(event.target.value)}
                  placeholder="Filter by movie, theatre, or showtime"
                  type="text"
                  value={attendanceSearchInput}
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {isAttendanceLoading ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-white/55">
                  Updating attendance…
                </div>
              ) : visibleAttendance.length > 0 ? (
                visibleAttendance.map((record) => (
                  <article key={record.sessionId} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-white">{record.movieTitle}</p>
                        <p className="mt-2 text-sm text-white/60">
                          {record.theatreName} • {record.theatreLocationLabel} • {record.auditoriumName}
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          {record.date} at {record.time}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
                        {record.attendancePercent}% in
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-white/50">Checked in</p>
                        <p className="mt-2 text-lg font-semibold text-white">{record.checkedInCount}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-white/50">Remaining</p>
                        <p className="mt-2 text-lg font-semibold text-white">{record.remainingCount}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-white/50">Tickets</p>
                        <p className="mt-2 text-lg font-semibold text-white">{record.totalTickets}</p>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-red-700"
                        style={{ width: `${Math.min(record.attendancePercent, 100)}%` }}
                      />
                    </div>

                    <p className="mt-3 text-xs text-white/45">
                      Latest check-in {formatCheckInTime(record.latestCheckInAt)}
                    </p>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-white/55">
                  No attendance records match those filters yet.
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Role Guide</p>
            <div className="mt-5 space-y-4 text-sm leading-6 text-white/60">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="font-medium text-white">Ticket Staff</p>
                <p className="mt-2">Can scan tickets, look up guests, and view recent check-ins.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="font-medium text-white">Manager</p>
                <p className="mt-2">Gets ticket-staff tools plus the grouped attendance view and staff roster management.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="font-medium text-white">Admin</p>
                <p className="mt-2">Controls the full team and can edit theatre details plus default showtimes for future sessions.</p>
              </div>
            </div>

            {ticketScannerAccess.canManageStaff ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <MailIcon className="h-4 w-4 text-red-300" />
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Member promotions</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  Send a promo email to members who opted in from their account page. Receipt emails are sent automatically after paid checkout.
                </p>
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={promoSubjectInput}
                    onChange={(event) => setPromoSubjectInput(event.target.value)}
                    placeholder="Promo subject"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
                  />
                  <textarea
                    value={promoMessageInput}
                    onChange={(event) => setPromoMessageInput(event.target.value)}
                    rows={5}
                    placeholder="Write your member promotion"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendPromotionalEmail}
                    disabled={isSendingPromoEmail}
                    className="inline-flex items-center gap-2 rounded-full bg-red-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSendingPromoEmail ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <MailIcon className="h-4 w-4" />}
                    {isSendingPromoEmail ? "Sending..." : "Send promo email"}
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <UserRoundIcon className="h-5 w-5 text-red-300" />
              <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Staff Access</p>
            </div>

            {ticketScannerAccess.canBootstrap ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                <div className="flex items-start gap-3 text-sm text-amber-100">
                  <ShieldAlertIcon className="mt-0.5 h-4 w-4" />
                  <p>
                    No staff has been set up yet. The first signed-in user becomes admin and can start assigning the rest of the team.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClaimTicketScannerAccess}
                  disabled={isUpdatingTicketStaff}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdatingTicketStaff ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : null}
                  Claim admin access
                </button>
              </div>
            ) : ticketScannerAccess.canManageStaff ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Add staff member</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
                    <input
                      type="email"
                      value={staffEmailInput}
                      onChange={(event) => setStaffEmailInput(event.target.value)}
                      placeholder="staff@example.com"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                    />
                    <select
                      value={selectedRole}
                      onChange={(event) => setSelectedRole(event.target.value as StaffRole)}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                    >
                      {assignableRoles.map((role) => (
                        <option key={role} value={role} className="bg-black text-white">
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleGrantTicketScannerAccess}
                      disabled={isUpdatingTicketStaff}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdatingTicketStaff ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
                      Add
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/45">Current staff</p>
                    <p className="text-sm text-white/55">{ticketScannerAccess.totalStaffMembers} total</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {ticketScannerStaff?.length ? (
                      ticketScannerStaff.map((member) => {
                        const canManageMember = ticketScannerAccess.canAssignManager || member.role === "ticket_staff";
                        const draftRole = roleDrafts[member.email] ?? member.role;

                        return (
                          <div key={member.email} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-white">{member.email}</p>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                                    {formatRoleLabel(member.role)}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs text-white/45">
                                  Added {new Date(member.createdAt).toLocaleDateString("en-US")}
                                </p>
                              </div>

                              {canManageMember ? (
                                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                                  {ticketScannerAccess.canAssignManager ? (
                                    <select
                                      value={draftRole}
                                      onChange={(event) =>
                                        setRoleDrafts((current) => ({
                                          ...current,
                                          [member.email]: event.target.value as StaffRole,
                                        }))
                                      }
                                      className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none transition focus:border-red-500"
                                    >
                                      {assignableRoles.map((role) => (
                                        <option key={`${member.email}-${role}`} value={role} className="bg-black text-white">
                                          {formatRoleLabel(role)}
                                        </option>
                                      ))}
                                    </select>
                                  ) : null}
                                  {ticketScannerAccess.canAssignManager && draftRole !== member.role ? (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTicketScannerRole(member.email, draftRole)}
                                      disabled={isUpdatingTicketStaff}
                                      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Save role
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTicketScannerAccess(member.email)}
                                    disabled={isUpdatingTicketStaff}
                                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <XIcon className="h-4 w-4" />
                                    Remove
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs text-white/45">Only admins can change this role.</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-white/55">No staff emails have been added yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm leading-6 text-white/60">
                  Your role is {ticketScannerAccess.roleLabel ?? "not staff"}. Managers or admins control staff roles and access from this section.
                </p>
              </div>
            )}
          </article>
        </section>

        {ticketScannerAccess.canManageTheatres ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Building2Icon className="h-5 w-5 text-red-300" />
              <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Theatre And Showtime Management</p>
            </div>

            <p className="mt-5 max-w-3xl text-sm leading-6 text-white/60">
              Admins can edit theatre details and default showtimes here. Saving a theatre updates its future session labels and adds any missing default showtimes for sessions that already exist. Existing extra sessions are not deleted.
            </p>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Add theatre</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={newTheatreDraft.name}
                  onChange={(event) => handleNewTheatreDraftChange("name", event.target.value)}
                  placeholder="Theatre name"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                />
                <input
                  type="text"
                  value={newTheatreDraft.address}
                  onChange={(event) => handleNewTheatreDraftChange("address", event.target.value)}
                  placeholder="Street address"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                />
                <input
                  type="text"
                  value={newTheatreDraft.city}
                  onChange={(event) => handleNewTheatreDraftChange("city", event.target.value)}
                  placeholder="City"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                />
                <input
                  type="text"
                  value={newTheatreDraft.state}
                  onChange={(event) => handleNewTheatreDraftChange("state", event.target.value.toUpperCase())}
                  placeholder="State"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                />
                <input
                  type="text"
                  value={newTheatreDraft.screens}
                  onChange={(event) => handleNewTheatreDraftChange("screens", event.target.value)}
                  placeholder="Screens"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                />
                <input
                  type="text"
                  value={newTheatreDraft.auditoriumName}
                  onChange={(event) => handleNewTheatreDraftChange("auditoriumName", event.target.value)}
                  placeholder="Default auditorium"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                />
                <input
                  type="text"
                  value={newTheatreDraft.amenitiesText}
                  onChange={(event) => handleNewTheatreDraftChange("amenitiesText", event.target.value)}
                  placeholder="Amenities separated by commas"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500 md:col-span-2"
                />
                <input
                  type="text"
                  value={newTheatreDraft.defaultShowtimesText}
                  onChange={(event) => handleNewTheatreDraftChange("defaultShowtimesText", event.target.value)}
                  placeholder="Showtimes like 12:00 PM, 3:30 PM, 6:45 PM"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500 md:col-span-2"
                />
              </div>

              <button
                type="button"
                onClick={() => void saveTheatreDraft(undefined, newTheatreDraft)}
                disabled={isSavingTheatre}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingTheatre ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
                Create theatre
              </button>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              {visibleManagedTheatres.map((theatre) => {
                const draft = theatreDrafts[theatre._id] ?? buildTheatreDraft(theatre);

                return (
                  <article key={theatre._id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-white">{theatre.name}</p>
                        <p className="mt-2 text-sm text-white/50">Slug {theatre.slug}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                        {theatre.upcomingSessions.length} upcoming sessions
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(event) => handleTheatreDraftChange(theatre._id, "name", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                      />
                      <input
                        type="text"
                        value={draft.address}
                        onChange={(event) => handleTheatreDraftChange(theatre._id, "address", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                      />
                      <input
                        type="text"
                        value={draft.city}
                        onChange={(event) => handleTheatreDraftChange(theatre._id, "city", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                      />
                      <input
                        type="text"
                        value={draft.state}
                        onChange={(event) => handleTheatreDraftChange(theatre._id, "state", event.target.value.toUpperCase())}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                      />
                      <input
                        type="text"
                        value={draft.screens}
                        onChange={(event) => handleTheatreDraftChange(theatre._id, "screens", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                      />
                      <input
                        type="text"
                        value={draft.auditoriumName}
                        onChange={(event) => handleTheatreDraftChange(theatre._id, "auditoriumName", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500"
                      />
                      <input
                        type="text"
                        value={draft.amenitiesText}
                        onChange={(event) => handleTheatreDraftChange(theatre._id, "amenitiesText", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500 md:col-span-2"
                      />
                      <input
                        type="text"
                        value={draft.defaultShowtimesText}
                        onChange={(event) => handleTheatreDraftChange(theatre._id, "defaultShowtimesText", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-red-500 md:col-span-2"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveTheatreDraft(theatre._id)}
                      disabled={isSavingTheatre}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-800 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingTheatre ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : null}
                      Save theatre
                    </button>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-white/45">Upcoming sessions</p>
                      <div className="mt-3 space-y-2 text-sm text-white/60">
                        {theatre.upcomingSessions.length > 0 ? (
                          theatre.upcomingSessions.map((sessionItem) => (
                            <p key={sessionItem.sessionId}>
                              {sessionItem.movieTitle} • {sessionItem.date} at {sessionItem.time}
                            </p>
                          ))
                        ) : (
                          <p>No future sessions yet. New movies will pick up these defaults when sessions are created.</p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
          <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Desk Notes</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3 text-sm leading-6 text-white/60">
            <p>Customer lookup now supports partial email and name matching, plus status and date filters, so staff can recover a booking even when the QR is not ready.</p>
            <p>Attendance is grouped by movie and showtime for managers and admins, which makes it much easier to watch real door progress during busy blocks.</p>
            <p>Admin theatre settings control the saved default showtimes for future sessions. Saving adds missing default times to current future session groups, but it does not delete special extra shows.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
