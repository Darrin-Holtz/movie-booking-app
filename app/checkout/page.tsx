"use client";

import { useQuery } from "convex/react";
import { ArrowRightIcon, CreditCardIcon, TicketPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Loading from "@/components/Loading";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

type Booking = {
  id: string;
  movieId: string;
  movieTitle: string;
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

export default function CheckoutPage() {
  const { data: session, isPending } = authClient.useSession();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const bookings = useQuery(
    api.showSessions.getMyBookings,
    session?.session ? {} : "skip"
  ) as Booking[] | undefined;

  if (isPending) {
    return <Loading />;
  }

  if (!session?.session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <h1 className="text-3xl font-semibold text-white">Sign in to continue to checkout.</h1>
          <Link href="/sign-in" className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700">
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

  const unpaidBookings = bookings.filter((booking) => !booking.isPaid);
  const focusedBooking = bookingId
    ? unpaidBookings.find((booking) => booking.id === bookingId)
    : null;
  const checkoutItems = focusedBooking ? [focusedBooking] : unpaidBookings;
  const totalDue = checkoutItems.reduce((sum, booking) => sum + booking.totalPrice, 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/70">
              <CreditCardIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Checkout</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Complete payment for your held seats.</h1>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-white/65">
            This page summarizes the seats currently on hold for your account. Payment wiring can attach here next.
          </p>
        </section>

        {checkoutItems.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-white/10 bg-white/3 p-10 text-center shadow-xl shadow-black/20">
            <TicketPlus className="mx-auto h-10 w-10 text-red-300/80" />
            <h2 className="mt-5 text-2xl font-semibold text-white">Nothing to pay right now</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/60">
              You do not have any unpaid holds at the moment.
            </p>
            <Link href="/my-bookings" className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700">
              Back to bookings
              <ArrowRightIcon className="h-4 w-4" strokeWidth={3} />
            </Link>
          </section>
        ) : (
          <section className="grid gap-5">
            {checkoutItems.map((booking) => (
              <article key={booking.id} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">{booking.movieTitle}</h2>
                    <p className="mt-2 text-sm text-white/65">
                      {booking.date} at {booking.time} • Seats {booking.seats.join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/55">Total due</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{formatPrice(booking.totalPrice)}</p>
                  </div>
                </div>
              </article>
            ))}

            <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/20 px-6 py-5">
              <div>
                <p className="text-sm text-white/55">Grand total</p>
                <p className="mt-1 text-3xl font-semibold text-white">{formatPrice(totalDue)}</p>
              </div>
              <button type="button" className="rounded-full bg-red-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-600">
                Pay now soon
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}