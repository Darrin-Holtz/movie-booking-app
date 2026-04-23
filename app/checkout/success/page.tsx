"use client";

import { useQuery } from "convex/react";
import { CheckCircle2Icon, Clock3Icon, TicketPlusIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { useAuthSession } from "@/components/AuthSessionProvider";
import Loading from "@/components/Loading";
import TicketPass from "@/components/TicketPass";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/analytics";

const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;

const copyRefundId = async (refundId: string) => {
  try {
    await navigator.clipboard.writeText(refundId);
    toast.success("Refund ID copied.");
  } catch {
    toast.error("Unable to copy refund ID.");
  }
};

export default function CheckoutSuccessPage() {
  const { data: session, isPending } = useAuthSession();
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
  const refundedItems = checkout.items.filter((item) => item.refundStatus);

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
          {isCompleted && checkout.sendReceiptEmail !== false && checkout.customerEmail ? (
            <p className="mt-4 max-w-2xl text-sm text-emerald-200/85">
              A receipt email was sent to {checkout.customerEmail}.
            </p>
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
                      {item.theatreName ?? "QuickShow Cinema"} • {item.theatreLocationLabel ?? "In-app location"}
                    </p>
                    <p className="mt-1 text-sm text-white/65">
                      {item.date} at {item.time}
                    </p>
                    <p className="mt-1 text-sm text-white/65">Seats {item.seatLabels.join(", ")}</p>
                    {item.ticketCode ? <p className="mt-2 text-sm font-medium text-red-200">Ticket code {item.ticketCode}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/55">Line total</p>
                    <p className="mt-1 text-xl font-semibold text-white">{formatPrice(item.totalPrice)}</p>
                  </div>
                </div>
                {item.refundStatus ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    <p className="font-medium">
                      {item.refundStatus === "succeeded" ? "Refund sent" : "Refund pending"}
                    </p>
                    <p className="mt-2 text-amber-100/80">
                      Amount {formatPrice(item.refundedAmount ?? item.totalPrice)}
                      {item.refundedAt
                        ? ` • Updated ${new Date(item.refundedAt).toLocaleDateString("en-US")}`
                        : ""}
                    </p>
                    {item.refundId ? (
                      <button
                        type="button"
                        onClick={() => void copyRefundId(item.refundId!)}
                        className="mt-3 inline-flex items-center rounded-full border border-amber-200/20 bg-black/15 px-3 py-1 text-xs font-medium text-amber-100 transition hover:border-amber-100/40"
                      >
                        Refund ID {item.refundId}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          {checkout.addOns?.length ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-red-300/80">Food & drink</p>
              <div className="mt-4 grid gap-3">
                {checkout.addOns.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs text-white/55">{item.quantity} × {formatPrice(item.unitPrice)}</p>
                    </div>
                    <p className="text-sm font-semibold text-white">{formatPrice(item.totalPrice)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {refundedItems.length > 0 ? (
            <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-amber-100/80">Refund update</p>
              <p className="mt-3 text-sm text-amber-100/85">
                {refundedItems.length === 1
                  ? "One ticket from this checkout has a refund update."
                  : `${refundedItems.length} tickets from this checkout have refund updates.`}
              </p>
            </div>
          ) : null}

          {isCompleted ? (
            <div className="mt-6 grid gap-5">
              {checkout.items
                .filter((item) => typeof item.ticketCode === "string")
                .map((item) => (
                  <div key={`${item.sessionId}-ticket`} className="space-y-3">
                    <TicketPass
                      movieTitle={item.movieTitle}
                      theatreName={item.theatreName ?? "QuickShow Cinema"}
                      theatreLocationLabel={item.theatreLocationLabel ?? "In-app location"}
                      auditoriumName="Main House"
                      date={item.date}
                      time={item.time}
                      seats={item.seatLabels}
                      ticketCode={item.ticketCode!}
                      addOns={checkout.addOns ?? []}
                    />
                    <Link href={`/tickets/${item.ticketCode}`} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/30">
                      Open mobile ticket
                    </Link>
                  </div>
                ))}
            </div>
          ) : null}

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