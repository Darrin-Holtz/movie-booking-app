"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowRightIcon, CalendarDaysIcon, Clock3Icon, StarIcon } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import BlurCircle from "@/components/BlurCircle";
import { useAuthSession } from "@/components/AuthSessionProvider";
import Loading from "@/components/Loading";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/analytics";
import { getShowtimePrice } from "@/lib/showtimePricing";
import timeFormat from "@/lib/timeFormat";
import Link from "next/link";

type SeatLayoutParams = {
  id: string;
  date: string;
};

type MovieGenre = {
  id: number;
  name: string;
};

type MovieDetailsResponse = {
  id?: number;
  title: string;
  poster_path?: string | null;
  vote_average: number;
  overview: string;
  runtime?: number | null;
  genres: MovieGenre[];
  release_date: string;
};

type ShowState = {
  movie: MovieDetailsResponse;
  date: string;
  times: string[];
};

type SessionAvailability = {
  id: string;
  movieId: string;
  movieTitle: string;
  date: string;
  time: string;
  reservedSeats: string[];
  reservedCount: number;
  availableCount: number;
  currentUserHeldSeats: string[];
  currentUserHoldExpiresAt: number | null;
};

const DEFAULT_SHOWTIMES = ["12:00 PM", "3:30 PM", "6:45 PM", "9:15 PM"];
const SEAT_ROWS = ["A", "B", "C", "D", "E", "F"];
const SEATS_PER_ROW = 8;
const TOTAL_SEATS = SEAT_ROWS.length * SEATS_PER_ROW;
const ALL_SEATS = SEAT_ROWS.flatMap((row) =>
  Array.from({ length: SEATS_PER_ROW }, (_, index) => `${row}${index + 1}`)
);

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
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

const formatHoldTimeRemaining = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function SeatLayoutPage() {
  const params = useParams<SeatLayoutParams>();
  const movieId = params?.id ?? "";
  const date = params?.date ?? "";
  const router = useRouter();

  const { data: authSession } = useAuthSession();
  const ensureSessions = useMutation(api.showSessions.ensureSessions);
  const syncSeatHold = useMutation(api.showSessions.reserveSeats);
  const sessionAvailability = useQuery(
    api.showSessions.getSessionsByDate,
    movieId && date ? { movieId, date } : "skip"
  ) as SessionAvailability[] | undefined;

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [show, setShow] = useState<ShowState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSyncingHold, setIsSyncingHold] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!movieId || !date) {
      setErrorMessage("Missing movie id or date.");
      return;
    }

    const fetchShow = async () => {
      try {
        const res = await fetch(`/api/movies/${movieId}`);

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.error ?? "Failed to load movie.");
        }

        const movie = await res.json();

        setShow({
          movie,
          date,
          times: DEFAULT_SHOWTIMES,
        });
        trackEvent("view_seat_selection", {
          movie_id: movieId,
          movie_title: movie.title,
          show_date: date,
        });
        setSelectedTime(DEFAULT_SHOWTIMES[0]);
        setErrorMessage(null);
      } catch (error) {
        setShow(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load movie."
        );
      }
    };

    void fetchShow();
  }, [movieId, date]);

  useEffect(() => {
    if (!show) {
      return;
    }

    const syncSessions = async () => {
      try {
        await ensureSessions({
          movieId,
          movieTitle: show.movie.title,
          posterPath: show.movie.poster_path ?? undefined,
          date,
          times: show.times,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load seat availability."
        );
      }
    };

    void syncSessions();
  }, [date, ensureSessions, movieId, show]);

  useEffect(() => {
    if (!sessionAvailability?.length) {
      return;
    }

    if (
      !selectedTime ||
      !sessionAvailability.some((session) => session.time === selectedTime)
    ) {
      setSelectedTime(sessionAvailability[0].time);
    }
  }, [selectedTime, sessionAvailability]);

  const selectedSession = sessionAvailability?.find(
    (session) => session.time === selectedTime
  );
  const currentUserHeldSeatLabels = useMemo(
    () => selectedSession?.currentUserHeldSeats ?? [],
    [selectedSession]
  );
  const currentUserHoldExpiresAt =
    selectedSession?.currentUserHoldExpiresAt ?? null;

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    const localSelection = [...selectedSeats].sort().join(",");
    const heldSelection = [...currentUserHeldSeatLabels].sort().join(",");

    if (localSelection !== heldSelection) {
      setSelectedSeats(currentUserHeldSeatLabels);
    }
  }, [currentUserHeldSeatLabels, selectedSeats, selectedSession]);

  useEffect(() => {
    if (!currentUserHoldExpiresAt) {
      return;
    }

    setNow(Date.now());

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUserHoldExpiresAt]);

  if (errorMessage) {
    return <div>{errorMessage}</div>;
  }

  if (!show) {
    return <Loading />;
  }

  const formattedRuntime = timeFormat(show.movie.runtime);
  const formattedDate = formatDisplayDate(show.date);
  const renderedTimes = sessionAvailability?.length
    ? sessionAvailability.map((session) => session.time)
    : show.times;
  const reservedSeats = new Set(selectedSession?.reservedSeats ?? []);
  const currentUserHeldSeats = new Set(currentUserHeldSeatLabels);
  const unavailableSeats = new Set(
    [...reservedSeats].filter((seatLabel) => !currentUserHeldSeats.has(seatLabel))
  );
  const reservedSeatCount = selectedSession?.reservedCount ?? reservedSeats.size;
  const availableSeatCount = selectedSession?.availableCount ?? TOTAL_SEATS;
  const addedSeatCount = selectedSeats.filter(
    (seatLabel) => !currentUserHeldSeats.has(seatLabel)
  ).length;
  const releasedSeatCount = currentUserHeldSeatLabels.filter(
    (seatLabel) => !selectedSeats.includes(seatLabel)
  ).length;
  const liveAvailableSeatCount = Math.max(
    0,
    availableSeatCount - addedSeatCount + releasedSeatCount
  );
  const holdTimeRemaining = currentUserHoldExpiresAt
    ? Math.max(0, currentUserHoldExpiresAt - now)
    : 0;

  const toggleSeatSelection = async (seatLabel: string) => {
    if (unavailableSeats.has(seatLabel)) {
      return;
    }

    if (!authSession?.session) {
      trackEvent("seat_hold_auth_gate", {
        movie_id: movieId,
        show_date: date,
      });
      toast.error("Sign in to place a 5-minute seat hold.");
      router.push("/sign-in");
      return;
    }

    if (!selectedTime) {
      toast.error("Select a showtime first.");
      return;
    }

    const nextSelectedSeats = selectedSeats.includes(seatLabel)
      ? selectedSeats.filter((seat) => seat !== seatLabel)
      : [...selectedSeats, seatLabel].sort((left, right) =>
          left.localeCompare(right)
        );
    const previousSelectedSeats = selectedSeats;

    setSelectedSeats(nextSelectedSeats);
    setIsSyncingHold(true);

    try {
      await syncSeatHold({
        movieId,
        date,
        time: selectedTime,
        seats: nextSelectedSeats,
      });
      trackEvent("seat_hold_updated", {
        movie_id: movieId,
        show_date: date,
        show_time: selectedTime,
        seats_selected: nextSelectedSeats.length,
      });
    } catch (error) {
      setSelectedSeats(previousSelectedSeats);
      toast.error(
        error instanceof Error ? error.message : "Unable to update seat hold."
      );
    } finally {
      setIsSyncingHold(false);
    }
  };

  const handleSignInToHold = () => {
    trackEvent("seat_hold_sign_in_click", {
      movie_id: movieId,
      show_date: date,
    });
    router.push("/sign-in");
  };

  return (
    <div className="px-6 py-30 md:px-16 md:pt-50 lg:px-40">
      <div className="flex flex-col gap-10 md:flex-row">
        <aside className="relative isolate w-full overflow-hidden rounded-[28px] border border-white/10 bg-neutral-950/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur md:sticky md:top-30 md:w-88 xl:max-w-sm">
        <BlurCircle top="-60px" right="-30px" />
        <BlurCircle bottom="20px" left="-50px" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-start gap-4">
            <Image
              src={
                show.movie.poster_path
                  ? `https://image.tmdb.org/t/p/w342${show.movie.poster_path}`
                  : "/fallback-movie.jpg"
              }
              alt={show.movie.title}
              width={96}
              height={144}
              className="h-32 w-22 rounded-2xl object-cover shadow-lg"
            />

            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-red-500/30 bg-red-500/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-red-200">
                Available Time
              </span>

              <div>
                <h1 className="text-xl font-semibold leading-tight text-white">
                  {show.movie.title}
                </h1>
                <p className="mt-2 flex items-center gap-2 text-sm text-gray-300">
                  <CalendarDaysIcon className="h-4 w-4 text-red-300" />
                  {formattedDate}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-gray-200">
                {formattedRuntime && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                    <Clock3Icon className="h-3.5 w-3.5 text-red-300" />
                    {formattedRuntime}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  <StarIcon className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {show.movie.vote_average.toFixed(1)} rating
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Choose a session</p>
                <p className="mt-1 text-sm text-gray-400">
                  Select an available start time to continue.
                </p>
              </div>
              <div className="flex items-center justify-center whitespace-nowrap rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-center text-xs font-medium text-red-200">
                {renderedTimes.length} slots
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {renderedTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => {
                    setSelectedTime(time);
                    trackEvent("select_showtime", {
                      movie_id: movieId,
                      show_date: date,
                      show_time: time,
                    });
                  }}
                  aria-pressed={selectedTime === time}
                  className={`cursor-pointer rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
                    selectedTime === time
                      ? "border-red-500 bg-red-600 text-white shadow-[0_12px_30px_rgba(185,28,28,0.35)]"
                      : "border-white/10 bg-white/5 text-gray-200 hover:border-red-400/60 hover:bg-red-500/10"
                  }`}
                >
                  <span
                    className={`block text-[11px] uppercase tracking-[0.24em] ${
                      selectedTime === time ? "text-red-100/80" : "text-gray-400"
                    }`}
                  >
                    Showtime
                  </span>
                  <span className="mt-1 block text-base">{time}</span>
                  <span className={`mt-1 block text-xs ${
                    selectedTime === time ? "text-red-100/85" : "text-gray-400"
                  }`}>
                    ${getShowtimePrice(time).toFixed(2)} per ticket
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-center text-sm text-gray-300">
              <span className="text-gray-400">Selected time</span>
              <p className="mt-1 text-base font-semibold text-white">
                {selectedTime ?? "Choose a time"}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {selectedSession
                  ? `${liveAvailableSeatCount} of ${TOTAL_SEATS} seats available`
                  : "Loading live seat availability"}
              </p>
              {currentUserHoldExpiresAt && selectedSeats.length > 0 && (
                <p className="mt-1 text-xs text-amber-300">
                  Your hold expires in {formatHoldTimeRemaining(holdTimeRemaining)}
                </p>
              )}
            </div>
          </div>
        </div>
        </aside>

        <section className="flex-1 rounded-[28px] border border-white/10 bg-white/3 p-8 text-gray-400 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-red-300">
              Seat Layout
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Pick seats for {selectedTime}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-400">
              Each seat pick creates a server-side 5-minute hold for the signed-in
              user. If payment never happens, the hold expires and the seats return
              to availability automatically.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-300">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <span className="h-3 w-3 rounded-full bg-white/80" />
              Available
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/12 px-3 py-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Your hold
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <span className="h-3 w-3 rounded-full bg-gray-600" />
              Unavailable
            </span>
          </div>
        </div>

        {!selectedSession && sessionAvailability === undefined ? (
          <div className="py-16">
            <Loading />
          </div>
        ) : (
          <>
            <div className="mx-auto mt-8 max-w-3xl">
              <div className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-center text-sm tracking-[0.35em] text-white/70">
                SCREEN THIS WAY
              </div>

              <div className="mt-8 space-y-3">
                {SEAT_ROWS.map((row) => (
                  <div
                    key={row}
                    className="grid grid-cols-[auto_1fr] items-center gap-4"
                  >
                    <span className="text-sm font-medium text-white/60">
                      {row}
                    </span>
                    <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                      {ALL_SEATS.filter((seatLabel) =>
                        seatLabel.startsWith(row)
                      ).map((seatLabel) => {
                        const isUnavailable = unavailableSeats.has(seatLabel);
                        const isSelected = selectedSeats.includes(seatLabel);

                        return (
                          <button
                            key={seatLabel}
                            type="button"
                            onClick={() => toggleSeatSelection(seatLabel)}
                            disabled={isUnavailable || isSyncingHold}
                            className={`h-12 rounded-2xl border text-sm font-semibold transition ${
                              isUnavailable
                                ? "cursor-not-allowed border-white/10 bg-gray-700/70 text-gray-400"
                                : isSelected
                                  ? "border-red-500 bg-red-600 text-white shadow-[0_12px_30px_rgba(185,28,28,0.35)]"
                                  : "cursor-pointer border-white/10 bg-white/5 text-white hover:border-red-400/60 hover:bg-red-500/10"
                            }`}
                          >
                            {seatLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-black/20 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-medium text-white">Hold summary</p>
                <p className="mt-1 text-sm text-gray-400">
                  {selectedSeats.length > 0
                    ? `${selectedSeats.length} seat${selectedSeats.length > 1 ? "s" : ""} held: ${selectedSeats.join(", ")}`
                    : "Choose seats to place on hold for this session."}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.28em] text-red-300/80">
                  {liveAvailableSeatCount} seats open now
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {reservedSeatCount} unavailable, {selectedSeats.length} in your hold
                </p>
                {!authSession?.session && (
                  <p className="mt-2 text-xs text-amber-300">
                    Sign in is required before a seat hold can be created.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSignInToHold}
                disabled={!!authSession?.session || !selectedSession || isSyncingHold}
                className="rounded-full bg-red-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {authSession?.session
                  ? isSyncingHold
                    ? "Updating hold..."
                    : selectedSeats.length > 0
                      ? "Hold active"
                      : "Select seats to hold"
                  : "Sign in to hold seats"}
              </button>
            </div>
          </>
        )}        
        </section>
      </div>

      <div className="flex justify-center">
        <Link
          href="/checkout"
          onClick={() => trackEvent("begin_checkout", {
            movie_id: movieId,
            show_date: date,
            show_time: selectedTime,
            seats_selected: selectedSeats.length,
          })}
          className="flex items-center gap-1 mt-20 px-10 py-3 text-sm bg-red-700 hover:bg-red-500 transition rounded-full font-medium cursor-pointer active:scale-95"
        >
          Proceed to Checkout
          <ArrowRightIcon strokeWidth={3} className="w-4 h-4" />
        </Link>
      </div>
    </div>    
  );
  
}
