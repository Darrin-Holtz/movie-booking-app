"use client";

import { useQuery } from "convex/react";
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
import Loading from "@/components/Loading";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

type Booking = {
  id: string;
  movieId: string;
  movieTitle: string;
  posterPath?: string;
  date: string;
  time: string;
  seats: string[];
  status: "held" | "confirmed";
  isPaid: boolean;
  seatPrice: number;
  totalPrice: number;
  holdExpiresAt: number | null;
  reservedAt: number;
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

export default function MyBookingsPage() {
  const { data: session, isPending } = authClient.useSession();
  const bookings = useQuery(
    api.showSessions.getMyBookings,
    session?.session ? {} : "skip"
  ) as Booking[] | undefined;
  const [now, setNow] = useState(Date.now());

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
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed");

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
                <p className="mt-2 text-2xl font-semibold text-white">{confirmedBookings.length}</p>
              </div>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-white/65">
            Active holds stay reserved for five minutes. Confirmed tickets remain here until their showtime passes.
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
          <section className="grid gap-5">
            {bookings.map((booking) => {
              const holdTimeRemaining = booking.holdExpiresAt
                ? Math.max(0, booking.holdExpiresAt - now)
                : 0;

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
                          {booking.status === "confirmed" ? "Confirmed" : "On Hold"}
                        </span>
                        <Link
                          href={booking.isPaid ? `/movies/${booking.movieId}/${booking.date}` : `/checkout?bookingId=${booking.id}`}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            booking.isPaid
                              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                              : "border-amber-400/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
                          }`}
                        >
                          {booking.isPaid ? "Paid" : "Not paid"}
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
                            <CalendarDaysIcon className="h-4 w-4 text-red-300" />
                            {formatDisplayDate(booking.date)}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                            <Clock3Icon className="h-4 w-4 text-red-300" />
                            {booking.time}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                            <TicketPlus className="h-4 w-4 text-red-300" />
                            Seats {booking.seats.join(", ")}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                            <CreditCardIcon className="h-4 w-4 text-red-300" />
                            {formatPrice(booking.totalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:items-end">
                      <p className="text-sm text-white/55">
                        {booking.seats.length} seat{booking.seats.length > 1 ? "s" : ""}
                      </p>
                      <Link
                        href={booking.isPaid ? `/movies/${booking.movieId}/${booking.date}` : `/checkout?bookingId=${booking.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-red-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
                      >
                        {booking.isPaid ? "View ticket" : "Go to checkout"}
                        <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
