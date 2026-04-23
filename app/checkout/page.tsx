"use client";

import { useQuery } from "convex/react";
import { ArrowRightIcon, CreditCardIcon, MinusIcon, PlusIcon, TicketPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuthSession } from "@/components/AuthSessionProvider";
import Loading from "@/components/Loading";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/analytics";
import {
  FOOD_ADD_ONS,
  type FoodAddOnId,
  getFoodAddOnsTotal,
  normalizeFoodAddOnSelections,
} from "@/lib/foodAddOns";

type Booking = {
  id: string;
  movieId: string;
  movieTitle: string;
  theatreName: string;
  theatreLocationLabel: string;
  date: string;
  time: string;
  seats: string[];
  status: "held" | "confirmed" | "canceled";
  isPaid: boolean;
  seatPrice: number;
  totalPrice: number;
  holdExpiresAt: number | null;
  reservedAt: number;
};

const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;

export default function CheckoutPage() {
  const { data: session, isPending } = useAuthSession();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const isCanceled = searchParams.get("canceled") === "1";
  const bookings = useQuery(
    api.showSessions.getMyBookings,
    session?.session ? {} : "skip"
  ) as Booking[] | undefined;
  const [isRedirectingToPayment, setIsRedirectingToPayment] = useState(false);
  const [addOnQuantities, setAddOnQuantities] = useState<Record<FoodAddOnId, number>>({
    popcorn: 0,
    soda: 0,
    combo: 0,
  });
  const unpaidBookings = bookings?.filter((booking) => !booking.isPaid) ?? [];
  const focusedBooking = bookingId
    ? unpaidBookings.find((booking) => booking.id === bookingId) ?? null
    : null;
  const checkoutItems = focusedBooking ? [focusedBooking] : unpaidBookings;
  const ticketSubtotal = checkoutItems.reduce((sum, booking) => sum + booking.totalPrice, 0);
  const selectedAddOns = normalizeFoodAddOnSelections(
    FOOD_ADD_ONS.map((item) => ({
      id: item.id,
      quantity: addOnQuantities[item.id] ?? 0,
    }))
  );
  const addOnsTotal = getFoodAddOnsTotal(selectedAddOns);
  const totalDue = ticketSubtotal + addOnsTotal;

  useEffect(() => {
    if (!session?.session || !bookings) {
      return;
    }

    trackEvent("view_checkout", {
      booking_count: checkoutItems.length,
      total_due: Number(totalDue.toFixed(2)),
    });
  }, [bookings, checkoutItems.length, session?.session, totalDue]);

  const updateAddOnQuantity = (id: FoodAddOnId, delta: number) => {
    setAddOnQuantities((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(10, (current[id] ?? 0) + delta)),
    }));
  };

  const handlePayNow = async () => {
    if (checkoutItems.length === 0) {
      return;
    }

    setIsRedirectingToPayment(true);
    trackEvent("checkout_payment_cta", {
      booking_count: checkoutItems.length,
      total_due: Number(totalDue.toFixed(2)),
      add_on_count: selectedAddOns.reduce((sum, item) => sum + item.quantity, 0),
      add_on_total: Number(addOnsTotal.toFixed(2)),
    });

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingIds: checkoutItems.map((booking) => booking.id),
          addOns: selectedAddOns.map((item) => ({
            id: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Unable to start Stripe checkout.");
      }

      window.location.assign(data.url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to start Stripe checkout."
      );
      setIsRedirectingToPayment(false);
    }
  };

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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
      <div className="mx-auto max-w-5xl space-y-8">
        {isCanceled ? (
          <section className="rounded-3xl border border-amber-400/15 bg-amber-400/10 p-5 text-sm text-amber-100 shadow-xl shadow-black/20">
            Stripe checkout was canceled. Your seats remain on hold until the payment window expires.
          </section>
        ) : null}

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
            Review your held seats, add a snack or drink, and then head to Stripe to finish payment.
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
                      {booking.theatreName} • {booking.theatreLocationLabel}
                    </p>
                    <p className="mt-1 text-sm text-white/65">
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

            <article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Food & drink add-ons</p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                    Add popcorn, soda, or a combo now and pick it up at the theatre.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                  <p className="text-sm text-white/55">Snack total</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{formatPrice(addOnsTotal)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {FOOD_ADD_ONS.map((item) => {
                  const quantity = addOnQuantities[item.id] ?? 0;

                  return (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-lg font-semibold text-white">{item.name}</p>
                      <p className="mt-2 text-sm text-white/60">{item.description}</p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-red-200">{formatPrice(item.price)}</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateAddOnQuantity(item.id, -1)}
                            aria-label={`Remove ${item.name}`}
                            className="rounded-full border border-white/15 p-2 text-white transition hover:border-white/30"
                          >
                            <MinusIcon className="h-4 w-4" />
                          </button>
                          <span className="min-w-8 text-center text-sm font-semibold text-white">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateAddOnQuantity(item.id, 1)}
                            aria-label={`Add ${item.name}`}
                            className="rounded-full border border-white/15 p-2 text-white transition hover:border-white/30"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-white/60">
                {selectedAddOns.length > 0
                  ? `Added ${selectedAddOns.map((item) => `${item.quantity}× ${item.name}`).join(" • ")}`
                  : "No snacks selected yet. Add popcorn, soda, or a combo anytime before payment."}
              </div>
            </article>

            <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-5">
              <div className="space-y-3 border-b border-white/10 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-white/55">Tickets subtotal</p>
                  <p className="text-base font-semibold text-white">{formatPrice(ticketSubtotal)}</p>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-white/55">Food & drink</p>
                  <p className="text-base font-semibold text-white">{formatPrice(addOnsTotal)}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-white/55">Grand total</p>
                  <p className="mt-1 text-3xl font-semibold text-white">{formatPrice(totalDue)}</p>
                </div>
                <button type="button" onClick={handlePayNow} disabled={isRedirectingToPayment} className="rounded-full bg-red-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {isRedirectingToPayment ? "Redirecting to Stripe..." : "Pay with Stripe"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}