"use client";

import { useAction, useQuery } from "convex/react";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  Clock3Icon,
  FilmIcon,
  TicketPlus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuthSession } from "@/components/AuthSessionProvider";
import Loading from "@/components/Loading";
import TicketPass from "@/components/TicketPass";
import { api } from "@/convex/_generated/api";

type Booking = {
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
  isPast: boolean;
  canceledAt: number | null;
  refundedAt: number | null;
  refundedAmount: number | null;
  refundStatus: "pending" | "succeeded" | null;
  refundId: string | null;
};

const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;

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

const formatHoldTimeRemaining = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getPosterUrl = (posterPath?: string) => {
  if (!posterPath) {
    return "/fallback-movie.jpg";
  }

  return `https://image.tmdb.org/t/p/w342${posterPath}`;
};

const copyRefundId = async (refundId: string) => {
  try {
    await navigator.clipboard.writeText(refundId);
    toast.success("Refund ID copied.");
  } catch {
    toast.error("Unable to copy refund ID.");
  }
};

export default function MyBookingsPage() {
  const { data: session, isPending } = useAuthSession();
  const bookings = useQuery(
    api.showSessions.getMyBookings,
    session?.session ? {} : "skip"
  ) as Booking[] | undefined;
  const [now, setNow] = useState(() => Date.now());
  const [cancelingTicketCode, setCancelingTicketCode] = useState<string | null>(null);
  const cancelTicketBooking = useAction(api.payments.cancelTicketBooking);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  if (isPending) {
    return <Loading />;
  }

  if (!session?.session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/70">
              <TicketPlus className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Bookings</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Sign in to view your holds.</h1>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-white/65">
            Your bookings page only loads the active holds and confirmed tickets attached to your account.
          </p>

          <Link
            href="/sign-in"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Sign in
            <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
          </Link>
        </div>
      </main>
    );
  }

  if (!bookings) {
    return <Loading />;
  }

  const activeHolds = bookings.filter((booking) => booking.status === "held");
  const canceledBookings = bookings.filter((booking) => booking.status === "canceled");
  const upcomingBookings = bookings.filter((booking) => booking.status !== "canceled" && !booking.isPast);
  const pastBookings = bookings.filter((booking) => booking.status !== "canceled" && booking.isPast);
  const upcomingConfirmedBookings = upcomingBookings.filter((booking) => booking.status === "confirmed");

  const renderBookingCard = (booking: Booking) => {
    const holdTimeRemaining = booking.holdExpiresAt
      ? Math.max(0, booking.holdExpiresAt - now)
      : 0;

    const canCancelTicket =
      booking.isPaid &&
      booking.status !== "canceled" &&
      !booking.isPast &&
      !booking.ticketUsedAt &&
      typeof booking.ticketCode === "string";

    const handleCancelTicket = async () => {
      if (!booking.ticketCode || cancelingTicketCode) {
        return;
      }

      const confirmed = window.confirm(
        `Cancel ticket ${booking.ticketCode} and request a refund for ${formatPrice(booking.totalPrice)}?`
      );

      if (!confirmed) {
        return;
      }

      setCancelingTicketCode(booking.ticketCode);

      try {
        const result = await cancelTicketBooking({ ticketCode: booking.ticketCode });
        toast.success(
          result.refundStatus === "succeeded"
            ? `Ticket canceled. Refund of ${formatPrice(result.refundedAmount)} started.`
            : `Ticket canceled. Refund of ${formatPrice(result.refundedAmount)} is pending.`
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to cancel ticket.");
      } finally {
        setCancelingTicketCode(null);
      }
    };

    return (
      <article
        key={booking.id}
        className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/25 backdrop-blur-xl sm:p-6"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative h-45 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30 sm:h-42 sm:w-28 sm:flex-none">
              <Image
                src={getPosterUrl(booking.posterPath)}
                alt={booking.movieTitle}
                fill
                sizes="(max-width: 640px) 100vw, 112px"
                className="object-cover"
              />
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-red-200">
                  {booking.status === "confirmed"
                    ? "Confirmed"
                    : booking.status === "canceled"
                      ? "Canceled"
                      : "On Hold"}
                </span>
                {booking.isPast ? (
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-white/70">
                    Past show
                  </span>
                ) : null}
                {booking.status === "canceled" ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                    Refund {booking.refundStatus === "succeeded" ? "sent" : "pending"}
                  </span>
                ) : null}
                <Link
                  href={booking.status === "canceled" ? `/movies/${booking.movieId}` : booking.isPaid ? `/movies/${booking.movieId}/${booking.date}` : `/checkout?bookingId=${booking.id}`}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    booking.status === "canceled"
                      ? "border-white/15 bg-white/5 text-white/75 hover:border-white/30"
                      : booking.isPaid
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-400/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
                  }`}
                >
                  {booking.status === "canceled" ? "Canceled" : booking.isPaid ? "Paid" : "Not paid"}
                </Link>
                {booking.status === "held" && booking.holdExpiresAt && (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                    Expires in {formatHoldTimeRemaining(holdTimeRemaining)}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-semibold text-white">{booking.movieTitle}</h2>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/65">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <FilmIcon className="h-4 w-4 text-red-300" />
                    {booking.theatreName}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <CalendarDaysIcon className="h-4 w-4 text-red-300" />
                    {formatDisplayDate(booking.date)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <Clock3Icon className="h-4 w-4 text-red-300" />
                    {booking.time}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <FilmIcon className="h-4 w-4 text-red-300" />
                    {booking.theatreLocationLabel} • {booking.auditoriumName}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <TicketPlus className="h-4 w-4 text-red-300" />
                    Seats {booking.seats.join(", ")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                    <CreditCardIcon className="h-4 w-4 text-red-300" />
                    {formatPrice(booking.totalPrice)}
                  </span>
                  {booking.status === "canceled" && booking.refundedAt ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                      <CreditCardIcon className="h-4 w-4 text-red-300" />
                      Refunded {formatPrice(booking.refundedAmount ?? booking.totalPrice)} on {new Date(booking.refundedAt).toLocaleDateString("en-US")}
                    </span>
                  ) : null}
                  {booking.status === "canceled" && booking.refundId ? (
                    <button
                      type="button"
                      onClick={() => void copyRefundId(booking.refundId!)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-left transition hover:border-white/25"
                    >
                      <CreditCardIcon className="h-4 w-4 text-red-300" />
                      Refund ID {booking.refundId}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <p className="text-sm text-white/55">
              {booking.seats.length} seat{booking.seats.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link
                href={booking.status === "canceled" ? `/movies/${booking.movieId}` : booking.isPaid && booking.ticketCode ? `/tickets/${booking.ticketCode}` : booking.isPaid ? `/movies/${booking.movieId}/${booking.date}` : `/checkout?bookingId=${booking.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-red-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
              >
                {booking.status === "canceled" ? "Browse movie" : booking.isPaid ? "View ticket" : "Go to checkout"}
                <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
              </Link>
              {canCancelTicket ? (
                <button
                  type="button"
                  onClick={handleCancelTicket}
                  disabled={cancelingTicketCode === booking.ticketCode}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelingTicketCode === booking.ticketCode ? "Canceling..." : "Cancel ticket"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {booking.status !== "canceled" && booking.isPaid && booking.ticketCode ? (
          <div className="mt-6">
            <TicketPass
              movieTitle={booking.movieTitle}
              theatreName={booking.theatreName}
              theatreLocationLabel={booking.theatreLocationLabel}
              auditoriumName={booking.auditoriumName}
              date={booking.date}
              time={booking.time}
              seats={booking.seats}
              ticketCode={booking.ticketCode}
              state={booking.ticketUsedAt ? "used" : "active"}
            />
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/70">
                <TicketPlus className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Bookings</p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight">Your upcoming tickets.</h1>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm md:min-w-72">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Active holds</p>
                <p className="mt-2 text-2xl font-semibold text-white">{activeHolds.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-white/55">Confirmed</p>
                <p className="mt-2 text-2xl font-semibold text-white">{upcomingConfirmedBookings.length}</p>
              </div>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-white/65">
            Active holds stay reserved for five minutes. Upcoming tickets stay at the top, and older tickets move into Past Bookings after showtime.
          </p>
        </section>

        {bookings.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-white/10 bg-white/3 p-10 text-center shadow-xl shadow-black/20">
            <FilmIcon className="mx-auto h-10 w-10 text-red-300/80" />
            <h2 className="mt-5 text-2xl font-semibold text-white">No bookings yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/60">
              Choose a movie, lock seats for a session, and your upcoming holds will appear here.
            </p>
            <Link
              href="/movies"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Browse movies
              <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
            </Link>
          </section>
        ) : (
          <div className="space-y-8">
            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold text-white">Upcoming</h2>
                <p className="mt-2 text-sm text-white/60">
                  Holds and confirmed tickets that have not reached showtime yet.
                </p>
              </div>

              {upcomingBookings.length > 0 ? (
                <div className="grid gap-5">
                  {upcomingBookings.map(renderBookingCard)}
                </div>
              ) : (
                <section className="rounded-3xl border border-dashed border-white/10 bg-white/3 p-8 text-center shadow-xl shadow-black/20">
                  <p className="text-sm text-white/60">No upcoming bookings right now.</p>
                </section>
              )}
            </section>

            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold text-white">Canceled</h2>
                <p className="mt-2 text-sm text-white/60">
                  Refunded tickets stay here with their refund status.
                </p>
              </div>

              {canceledBookings.length > 0 ? (
                <div className="grid gap-5">
                  {canceledBookings.map(renderBookingCard)}
                </div>
              ) : (
                <section className="rounded-3xl border border-dashed border-white/10 bg-white/3 p-8 text-center shadow-xl shadow-black/20">
                  <p className="text-sm text-white/60">No canceled bookings yet.</p>
                </section>
              )}
            </section>

            <section className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold text-white">Past Bookings</h2>
                <p className="mt-2 text-sm text-white/60">
                  Older confirmed tickets stay here for your history.
                </p>
              </div>

              {pastBookings.length > 0 ? (
                <div className="grid gap-5">
                  {pastBookings.map(renderBookingCard)}
                </div>
              ) : (
                <section className="rounded-3xl border border-dashed border-white/10 bg-white/3 p-8 text-center shadow-xl shadow-black/20">
                  <p className="text-sm text-white/60">No past bookings yet.</p>
                </section>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
