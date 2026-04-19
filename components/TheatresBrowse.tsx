"use client";

import { MapPin, SearchIcon, Ticket, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import BlurCircle from "@/components/BlurCircle";
import type { AmcTheatre } from "@/lib/amc";

type TheatreResults = {
  theatres: AmcTheatre[];
  totalCount: number;
  totalPages: number;
  filteredLocally: boolean;
};

type TheatresBrowseProps = {
  initialState: {
    query: string;
    state: string;
    city: string;
  };
  initialResults: TheatreResults;
  initialError: string | null;
};

const THEATRES_PAGE_SIZE = 24;

const quickSearches = [
  { label: "Buffalo Area", query: "buffalo" },
  { label: "New York", query: "new york" },
  { label: "St. Louis", query: "st louis" },
  { label: "Chicago", query: "chicago" },
];

const getLocationLabel = (theatre: AmcTheatre) => {
  const city = theatre.location?.city ?? theatre.city;
  const state = theatre.location?.stateName ?? theatre.location?.state ?? theatre.state;
  return [city, state].filter(Boolean).join(", ");
};

const getAddressLabel = (theatre: AmcTheatre) => {
  const address = theatre.location?.addressLine1 ?? theatre.address1;
  const address2 = theatre.location?.addressLine2 ?? theatre.address2;
  const postalCode = theatre.location?.postalCode ?? theatre.postalCode;
  return [address, address2, postalCode].filter(Boolean).join(" • ");
};

const getTopAttributes = (theatre: AmcTheatre) => {
  const attributes = Array.isArray(theatre.attributes) ? theatre.attributes : [];
  return attributes
    .filter(
      (attribute): attribute is { name: string } =>
        typeof attribute === "object" &&
        attribute !== null &&
        typeof (attribute as { name?: string }).name === "string"
    )
    .slice(0, 3)
    .map((attribute) => attribute.name);
};

const TheatresBrowse = ({ initialState, initialResults, initialError }: TheatresBrowseProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState(initialState.query);
  const [selectedState, setSelectedState] = useState(initialState.state);
  const [selectedCity, setSelectedCity] = useState(initialState.city);
  const [results, setResults] = useState(initialResults);
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const initialRequestKeyRef = useRef(
    JSON.stringify({
      query: initialState.query.trim(),
      state: initialState.state.trim(),
      city: initialState.city.trim(),
    })
  );

  useEffect(() => {
    const params = new URLSearchParams();
    const trimmedSearchTerm = searchTerm.trim();
    const trimmedState = selectedState.trim();
    const trimmedCity = selectedCity.trim();

    if (trimmedSearchTerm) {
      params.set("query", trimmedSearchTerm);
    }

    if (trimmedState) {
      params.set("state", trimmedState);
    }

    if (trimmedCity) {
      params.set("city", trimmedCity);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchTerm, selectedCity, selectedState]);

  useEffect(() => {
    const trimmedSearchTerm = deferredSearchTerm.trim();
    const trimmedState = selectedState.trim();
    const trimmedCity = selectedCity.trim();
    const requestKey = JSON.stringify({
      query: trimmedSearchTerm,
      state: trimmedState,
      city: trimmedCity,
    });

    if (requestKey === initialRequestKeyRef.current) {
      initialRequestKeyRef.current = "__used__";
      return;
    }

    const abortController = new AbortController();
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: "1",
      pageSize: String(THEATRES_PAGE_SIZE),
    });

    if (trimmedSearchTerm) {
      params.set("query", trimmedSearchTerm);
    }

    if (trimmedState) {
      params.set("state", trimmedState);
    }

    if (trimmedCity) {
      params.set("city", trimmedCity);
    }

    const loadTheatres = async () => {
      try {
        const response = await fetch(`/api/amc/theatres?${params.toString()}`, {
          signal: abortController.signal,
        });

        const data = (await response.json()) as {
          theatres?: AmcTheatre[];
          totalCount?: number;
          totalPages?: number;
          filteredLocally?: boolean;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load theatres.");
        }

        startTransition(() => {
          setResults({
            theatres: Array.isArray(data.theatres) ? data.theatres : [],
            totalCount:
              typeof data.totalCount === "number" && Number.isFinite(data.totalCount)
                ? data.totalCount
                : 0,
            totalPages:
              typeof data.totalPages === "number" && Number.isFinite(data.totalPages)
                ? data.totalPages
                : 1,
            filteredLocally: Boolean(data.filteredLocally),
          });
        });
      } catch (fetchError) {
        if (abortController.signal.aborted) {
          return;
        }

        setResults({
          theatres: [],
          totalCount: 0,
          totalPages: 1,
          filteredLocally: true,
        });
        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to load theatres."
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadTheatres();

    return () => {
      abortController.abort();
    };
  }, [deferredSearchTerm, selectedCity, selectedState]);

  const trimmedSearchTerm = searchTerm.trim();
  const activeFilterCount =
    (trimmedSearchTerm ? 1 : 0) +
    (selectedState.trim() ? 1 : 0) +
    (selectedCity.trim() ? 1 : 0);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedState("");
    setSelectedCity("");
  };

  return (
    <div className="relative my-40 mb-60 min-h-[80vh] overflow-hidden px-6 md:px-16 lg:px-40 xl:px-44">
      <BlurCircle top="140px" left="-40px" />
      <BlurCircle bottom="80px" right="20px" />

      <section className="relative overflow-hidden rounded-4xl border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-8">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-red-300/80">
              Browse Theatres
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
              Search AMC locations by area.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              Search for a market like Buffalo, narrow by state or city, and inspect the theatres we can pull from AMC right now.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:min-w-80">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-white/55">Theatres found</p>
              <p className="mt-2 text-2xl font-semibold text-white">{results.totalCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-white/55">Search mode</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-white">
                {results.filteredLocally ? "Local filter" : "AMC page"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 rounded-3xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto] lg:items-center">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/75">
            <SearchIcon className="h-4 w-4 text-red-300" />
            <input
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Try buffalo, buffalo area, amherst, or a ZIP code"
              value={searchTerm}
            />
          </label>

          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            onChange={(event) => setSelectedState(event.target.value)}
            placeholder="State, like new york"
            value={selectedState}
          />

          <input
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            onChange={(event) => setSelectedCity(event.target.value)}
            placeholder="City, like amherst"
            value={selectedCity}
          />

          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10 disabled:opacity-50"
            disabled={activeFilterCount === 0}
            onClick={clearFilters}
            type="button"
          >
            <XIcon className="h-4 w-4" />
            Clear
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {quickSearches.map((search) => (
            <button
              key={search.label}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-white/75 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-white"
              onClick={() => {
                setSearchTerm(search.query);
                setSelectedState("");
                setSelectedCity("");
              }}
              type="button"
            >
              {search.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-4 text-sm text-white/55">
          <p>
            {isLoading ? "Refreshing theatre list..." : `Showing ${results.theatres.length} theatres on this page.`}
          </p>
          <p>{results.totalPages > 1 ? `${results.totalPages} pages available` : "Single page result"}</p>
        </div>

        {results.theatres.length === 0 && !isLoading ? (
          <div className="mt-8 rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-16 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-white/45">No Matches</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Try a broader area search.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/60">
              Search by market, suburb, or ZIP code. Buffalo works because AMC exposes that market name even when the actual theatre city is Amherst.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 xl:grid-cols-2">
            {results.theatres.map((theatre) => {
              const topAttributes = getTopAttributes(theatre);

              return (
                <article
                  key={String(theatre.id ?? theatre.slug ?? theatre.name)}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-black/25 shadow-xl shadow-black/20"
                >
                  <div
                    className="h-36 w-full bg-cover bg-center"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.75)), url(${String(
                        theatre.media && typeof theatre.media === "object" && theatre.media !== null
                          ? (theatre.media as { heroDesktopDynamic?: string; theatreImageLarge?: string }).heroDesktopDynamic ??
                            (theatre.media as { theatreImageLarge?: string }).theatreImageLarge ??
                            ""
                          : ""
                      )})`,
                    }}
                  />

                  <div className="space-y-5 px-5 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-red-300/75">
                          {theatre.location?.marketName ?? "AMC Theatre"}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          {theatre.longName ?? theatre.name ?? "AMC Theatre"}
                        </h2>
                      </div>

                      {theatre.ticketable ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-white/70">
                          {String(theatre.ticketable)}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-2 text-sm text-white/70">
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-red-300" />
                        {getLocationLabel(theatre) || "Location unavailable"}
                      </p>
                      <p>{getAddressLabel(theatre) || "Address unavailable"}</p>
                      {typeof theatre.guestServicesPhoneNumber === "string" ? (
                        <p>Guest services: {theatre.guestServicesPhoneNumber}</p>
                      ) : null}
                    </div>

                    {topAttributes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {topAttributes.map((attribute) => (
                          <span
                            key={attribute}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75"
                          >
                            {attribute}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      {typeof theatre.websiteUrl === "string" ? (
                        <Link
                          className="inline-flex items-center gap-2 rounded-full bg-red-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                          href={theatre.websiteUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <Ticket className="h-4 w-4" />
                          View Theatre
                        </Link>
                      ) : null}

                      {typeof theatre.slug === "string" ? (
                        <Link
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/20 hover:text-white"
                          href={`/api/amc/theatres?query=${encodeURIComponent(theatre.slug)}`}
                          target="_blank"
                        >
                          Inspect API Match
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default TheatresBrowse;