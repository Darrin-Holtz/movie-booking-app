"use client";

import { useQuery } from "convex/react";
import { ArrowLeftIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthSession } from "@/components/AuthSessionProvider";
import Loading from "@/components/Loading";
import TicketPass from "@/components/TicketPass";
import { api } from "@/convex/_generated/api";

export default function TicketPage() {
  const params = useParams<{ ticketCode: string }>();
  const ticketCode = params?.ticketCode ?? "";
  const { data: session, isPending } = useAuthSession();
  const ticket = useQuery(
    api.showSessions.getMyTicketByCode,
    session?.session && ticketCode ? { ticketCode } : "skip"
  );

  if (isPending || (session?.session && ticketCode && ticket === undefined)) {
    return <Loading />;
  }

  if (!session?.session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <h1 className="text-3xl font-semibold text-white">Sign in to view your ticket.</h1>
          <Link href="/sign-in" className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-6 pb-12 pt-32 text-white md:px-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <h1 className="text-3xl font-semibold text-white">That ticket was not found.</h1>
          <p className="mt-4 text-white/65">Open it from your bookings page or your ticket confirmation page.</p>
          <Link href="/my-bookings" className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700">
            Back to bookings
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.2),transparent_38%),linear-gradient(180deg,#120909_0%,#050505_100%)] px-4 pb-12 pt-28 text-white md:px-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
          <Link href="/my-bookings" className="inline-flex items-center gap-2 text-sm font-medium text-white/80 transition hover:text-white">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to bookings
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/65">
            <SmartphoneIcon className="h-3.5 w-3.5" />
            Phone Ticket
          </div>
        </div>

        <TicketPass
          movieTitle={ticket.movieTitle}
          theatreName={ticket.theatreName}
          theatreLocationLabel={ticket.theatreLocationLabel}
          auditoriumName={ticket.auditoriumName}
          date={ticket.date}
          time={ticket.time}
          seats={ticket.seats}
          ticketCode={ticket.ticketCode}
          state={ticket.isUsed ? "used" : "active"}
        />
      </div>
    </main>
  );
}