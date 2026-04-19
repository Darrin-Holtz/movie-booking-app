"use client";

import { CalendarDaysIcon, Clock3Icon, MapPinIcon, TicketIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type TicketPassProps = {
  movieTitle: string;
  theatreName: string;
  theatreLocationLabel: string;
  auditoriumName: string;
  date: string;
  time: string;
  seats: string[];
  ticketCode: string;
  state?: "active" | "used";
};

const getTicketHref = (ticketCode: string) => {
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const origin = browserOrigin || configuredOrigin;

  return origin ? `${origin}/tickets/${ticketCode}` : ticketCode;
};

export default function TicketPass({
  movieTitle,
  theatreName,
  theatreLocationLabel,
  auditoriumName,
  date,
  time,
  seats,
  ticketCode,
  state = "active",
}: TicketPassProps) {
  const ticketHref = getTicketHref(ticketCode);

  return (
    <article className="overflow-hidden rounded-4xl border border-white/10 bg-[linear-gradient(135deg,rgba(127,29,29,0.95),rgba(17,17,17,0.96))] shadow-2xl shadow-black/40">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-100/75">Mobile Ticket</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{movieTitle}</h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
              <TicketIcon className="h-5 w-5" />
            </span>
            <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] ${
              state === "used"
                ? "border border-amber-300/30 bg-amber-300/15 text-amber-100"
                : "border border-emerald-300/25 bg-emerald-300/15 text-emerald-100"
            }`}>
              {state === "used" ? "Used" : "Active"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 md:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">{theatreName}</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/70">
              <MapPinIcon className="h-4 w-4 text-red-200" />
              {theatreLocationLabel} • {auditoriumName}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/50">Date</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-white">
                <CalendarDaysIcon className="h-4 w-4 text-red-200" />
                {date}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/50">Time</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-white">
                <Clock3Icon className="h-4 w-4 text-red-200" />
                {time}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/50">Seats</p>
            <p className="mt-2 text-lg font-semibold text-white">{seats.join(", ")}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white px-4 py-4 text-black shadow-xl shadow-black/20">
          <p className="text-center text-xs font-medium uppercase tracking-[0.28em] text-neutral-500">
            Ticket Code
          </p>
          <p className="mt-3 text-center text-xl font-semibold tracking-[0.18em] text-neutral-900">
            {ticketCode}
          </p>
          <div className="mt-4 flex justify-center rounded-2xl bg-neutral-100 px-3 py-4">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <QRCodeSVG
                value={ticketHref}
                size={168}
                bgColor="#ffffff"
                fgColor="#111111"
                includeMargin={false}
                level="M"
              />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-neutral-500">
            {state === "used"
              ? "This ticket has already been checked in."
              : "Scan the QR code or open the ticket link at the theatre."}
          </p>
        </div>
      </div>
    </article>
  );
}