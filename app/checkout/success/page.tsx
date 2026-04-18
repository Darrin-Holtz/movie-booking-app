"use client";

import { useQuery } from "convex/react";
import { CheckCircle2Icon, Clock3Icon, TicketPlusIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Loading from "@/components/Loading";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { trackEvent } from "@/lib/analytics";

const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;

export default function CheckoutSuccessPage() {
  const { data: session, isPending } = authClient.useSession();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";
  const recoveryAttemptedForSession = useRef<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const checkout = useQuery(
    api.payments.getMyCheckoutByStripeSessionId,
    session?.session && sessionId ? { stripeCheckoutSessionId: sessionId } : "skip"
  );

  useEffect(() => {
    if (!session?.session || !sessionId || !checkout || checkout.status !== "pending") {
      return;
    }

    if (recoveryAttemptedForSession.current === sessionId) {
      return;
    }

    recoveryAttemptedForSession.current = sessionId;

    void fetch("/api/payments/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (response) => {
        if (response.ok) {
          setRecoveryError(null);
          return;
        }

        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        setRecoveryError(data?.error ?? "Unable to confirm payment status.");
      })
      .catch(() => {
        setRecoveryError("Unable to confirm payment status.");
      });
  }, [checkout, session?.session, sessionId]);

  useEffect(() => {
    if (checkout?.status === "completed") {
      trackEvent("checkout_completed", {
        checkout_session_id: sessionId,
        total_due: Number(checkout.totalPrice.toFixed(2)),
        seat_count: checkout.seatCount,
      });
    }
  }, [checkout, sessionId]);

  if (isPending || (session?.session && sessionId && checkout === undefined)) {
    return <Loading />;
  }

  if (!session?.session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <h1 className="text-3xl font-semibold text-white">Sign in to view your ticket confirmation.</h1>
          <Link href="/sign-in" className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (!sessionId || !checkout) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <h1 className="text-3xl font-semibold text-white">We could not find that checkout confirmation.</h1>
          <p className="mt-4 text-white/65">Try opening the confirmation link again from Stripe or check your bookings.</p>
          <Link href="/my-bookings" className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700">
            View bookings
          </Link>
        </div>
      </main>
    );
  }

  const isCompleted = checkout.status === "completed";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700/30 text-emerald-200">
              {isCompleted ? <CheckCircle2Icon className="h-7 w-7" /> : <Clock3Icon className="h-7 w-7" />}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-300/80">Confirmation</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">
                {isCompleted ? "Your seats are confirmed." : "Payment is still being confirmed."}
              </h1>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-white/65">
            {isCompleted
              ? "Stripe reported a successful payment and your held seats have been converted into confirmed tickets."
              : "Stripe redirected back successfully, but the booking confirmation webhook is still processing. This page will update once Convex receives it."}
          </p>
          {!isCompleted && recoveryError ? (
            <p className="mt-4 max-w-2xl text-sm text-amber-200/85">{recoveryError}</p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/25 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="text-sm text-white/55">Checkout session</p>
              <p className="mt-1 text-sm font-medium text-white">{sessionId}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/55">Total paid</p>
              <p className="mt-1 text-3xl font-semibold text-white">{formatPrice(checkout.totalPrice)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {checkout.items.map((item) => (
              <article key={`${item.sessionId}-${item.time}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{item.movieTitle}</h2>
                    <p className="mt-2 text-sm text-white/65">
                      {item.date} at {item.time}
                    </p>
                    <p className="mt-1 text-sm text-white/65">Seats {item.seatLabels.join(", ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/55">Line total</p>
                    <p className="mt-1 text-xl font-semibold text-white">{formatPrice(item.totalPrice)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/my-bookings" className="inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700">
              <TicketPlusIcon className="h-4 w-4" />
              View my bookings
            </Link>
            <Link href="/movies" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-white/30">
              Browse more movies
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}