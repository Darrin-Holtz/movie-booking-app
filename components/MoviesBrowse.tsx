"use client";

import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import BlurCircle from "@/components/BlurCircle";
import MovieCard from "@/components/MovieCard";

export type BrowseMovie = {
  id: number;
  title: string;
  backdrop_path: string | null;
  poster_path?: string | null;
  release_date: string;
  vote_average: number;
  overview?: string;
  genre_ids?: number[];
  genre_names?: string[];
  runtime?: number;
};

type MoviesBrowseProps = {
  movies: BrowseMovie[];
  initialState: {
    mode: BrowseMode;
    query: string;
    genre: string;
    year: string;
    rating: string;
    sort: string;
  };
};

type BrowseMode = "popular" | "search";
type SortOption = "popular" | "rating" | "title" | "newest" | "oldest";

const SEARCH_RESULT_PAGE_COUNT = 3;
const SEARCH_RESULT_DISPLAY_LIMIT = 5;

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "popular", label: "Popular" },
  { value: "rating", label: "Top Rated" },
  { value: "title", label: "Title A-Z" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

const isSortOption = (value: string): value is SortOption => {
  return sortOptions.some((option) => option.value === value);
};

const getReleaseYear = (releaseDate: string) => {
  const date = new Date(releaseDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getFullYear();
};

const compareMovies = (left: BrowseMovie, right: BrowseMovie, sortBy: SortOption) => {
  if (sortBy === "rating") {
    return right.vote_average - left.vote_average;
  }

  if (sortBy === "title") {
    return left.title.localeCompare(right.title);
  }

  const leftTime = new Date(left.release_date).getTime();
  const rightTime = new Date(right.release_date).getTime();

  if (sortBy === "newest") {
    return rightTime - leftTime;
  }

  if (sortBy === "oldest") {
    return leftTime - rightTime;
  }

  return 0;
};

const MoviesBrowse = ({ movies, initialState }: MoviesBrowseProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [browseMode, setBrowseMode] = useState<BrowseMode>(initialState.mode);
  const [searchTerm, setSearchTerm] = useState(initialState.query);
  const [selectedGenre, setSelectedGenre] = useState(initialState.genre);
  const [selectedYear, setSelectedYear] = useState(initialState.year);
  const [minimumRating, setMinimumRating] = useState(initialState.rating);
  const [sortBy, setSortBy] = useState<SortOption>(
    isSortOption(initialState.sort) ? initialState.sort : "popular"
  );
  const [searchedMovies, setSearchedMovies] = useState<BrowseMovie[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const trimmedSearchTerm = deferredSearchTerm.trim();
  const normalizedSearchTerm = trimmedSearchTerm.toLowerCase();

  useEffect(() => {
    const params = new URLSearchParams();
    const trimmedSearchTerm = searchTerm.trim();

    if (browseMode !== "popular") {
      params.set("mode", browseMode);
    }

    if (trimmedSearchTerm) {
      params.set("q", trimmedSearchTerm);
    }

    if (selectedGenre !== "all") {
      params.set("genre", selectedGenre);
    }

    if (selectedYear !== "all") {
      params.set("year", selectedYear);
    }

    if (minimumRating !== "0") {
      params.set("rating", minimumRating);
    }

    if (sortBy !== "popular") {
      params.set("sort", sortBy);
    }

    const queryString = params.toString();

    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [browseMode, minimumRating, pathname, router, searchTerm, selectedGenre, selectedYear, sortBy]);

  useEffect(() => {
    if (browseMode !== "search") {
      setSearchedMovies(null);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    if (!trimmedSearchTerm) {
      setSearchedMovies([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const abortController = new AbortController();

    setIsSearching(true);
    setSearchError(null);

    const loadSearchResults = async () => {
      try {
        const response = await fetch(
          `/api/movies/search?q=${encodeURIComponent(trimmedSearchTerm)}&pages=${SEARCH_RESULT_PAGE_COUNT}`,
          { signal: abortController.signal }
        );

        const data = (await response.json()) as {
          movies?: BrowseMovie[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to search movies.");
        }

        startTransition(() => {
          setSearchedMovies(Array.isArray(data.movies) ? data.movies : []);
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setSearchError(
          error instanceof Error ? error.message : "Failed to search movies."
        );
        setSearchedMovies([]);
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    void loadSearchResults();

    return () => {
      abortController.abort();
    };
  }, [browseMode, trimmedSearchTerm]);

  const browseMovies =
    browseMode === "search"
      ? normalizedSearchTerm
        ? searchedMovies ?? []
        : []
      : movies;

  const genreOptions = Array.from(
    new Set([
      ...browseMovies.flatMap((movie) => movie.genre_names ?? []).filter(Boolean),
      ...(selectedGenre !== "all" ? [selectedGenre] : []),
    ])
  ).sort((left, right) => left.localeCompare(right));

  const yearOptions = Array.from(
    new Set(
      [
        ...browseMovies
        .map((movie) => getReleaseYear(movie.release_date))
        .filter((year): year is number => year !== null),
        ...(selectedYear !== "all" ? [Number(selectedYear)] : []),
      ]
    )
  ).sort((left, right) => right - left);

  const filteredMovies = browseMovies
    .filter((movie) => {
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        movie.title.toLowerCase().includes(normalizedSearchTerm) ||
        movie.overview?.toLowerCase().includes(normalizedSearchTerm) ||
        movie.genre_names?.some((genre) =>
          genre.toLowerCase().includes(normalizedSearchTerm)
        );

      if (!matchesSearch) {
        return false;
      }

      if (
        selectedGenre !== "all" &&
        !(movie.genre_names ?? []).includes(selectedGenre)
      ) {
        return false;
      }

      if (selectedYear !== "all") {
        const releaseYear = getReleaseYear(movie.release_date);

        if (String(releaseYear) !== selectedYear) {
          return false;
        }
      }

      if (movie.vote_average < Number(minimumRating)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => compareMovies(left, right, sortBy));
  const isSearchMode = browseMode === "search";
  const visibleMovies =
    isSearchMode && normalizedSearchTerm
      ? filteredMovies.slice(0, SEARCH_RESULT_DISPLAY_LIMIT)
      : filteredMovies;

  const activeFilterCount =
    (normalizedSearchTerm ? 1 : 0) +
    (selectedGenre !== "all" ? 1 : 0) +
    (selectedYear !== "all" ? 1 : 0) +
    (minimumRating !== "0" ? 1 : 0) +
    (sortBy !== "popular" ? 1 : 0);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedGenre("all");
    setSelectedYear("all");
    setMinimumRating("0");
    setSortBy("popular");
  };

  const isSearchIdle = isSearchMode && normalizedSearchTerm.length === 0;
  const emptyStateTitle = isSearchIdle
    ? "Search the full TMDB catalog."
    : "No movies match those filters.";
  const emptyStateDescription = isSearchIdle
    ? `Use Search All TMDB to look beyond the current popular list. Up to ${SEARCH_RESULT_PAGE_COUNT * 20} search results load automatically.`
    : "Try a broader title search, remove a genre or year filter, or drop the minimum rating.";

  return (
    <div className="relative my-40 mb-60 min-h-[80vh] overflow-hidden px-6 md:px-16 lg:px-40 xl:px-44">
      <BlurCircle top="150px" left="0px" />
      <BlurCircle bottom="50px" right="50px" />

      <section className="relative overflow-hidden rounded-4xl border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-8">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-red-300/80">
              Browse Movies
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
              Find a movie faster.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
              Switch between the popular feed and full-catalog TMDB title search,
              then narrow the results by genre, year, rating, or sort order.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:min-w-80">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-white/55">
                {isSearchMode ? "TMDB matches loaded" : "Movies loaded"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {browseMovies.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-white/55">Visible now</p>
              <p className="mt-2 text-2xl font-semibold text-white">{visibleMovies.length}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => setBrowseMode("popular")}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
              browseMode === "popular"
                ? "bg-red-800 text-white"
                : "border border-white/15 bg-white/5 text-white/75 hover:border-white/30"
            }`}
          >
            Popular Now
          </button>
          <button
            type="button"
            onClick={() => setBrowseMode("search")}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
              browseMode === "search"
                ? "bg-red-800 text-white"
                : "border border-white/15 bg-white/5 text-white/75 hover:border-white/30"
            }`}
          >
            Search All TMDB
          </button>
          <p className="self-center text-sm text-white/50">
            {isSearchMode
              ? `Title search loads up to ${SEARCH_RESULT_PAGE_COUNT} TMDB result pages automatically.`
              : "Popular Now filters the current TMDB popular feed locally."}
          </p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))]">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-white/55">
              <SearchIcon className="h-3.5 w-3.5" />
              Search
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white">
              <SearchIcon className="h-4 w-4 text-white/45" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={
                  isSearchMode
                    ? "Search the TMDB catalog by title"
                    : "Filter the current popular list"
                }
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-white/55">
              <SlidersHorizontalIcon className="h-3.5 w-3.5" />
              Genre
            </span>
            <select
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={selectedGenre}
              onChange={(event) => setSelectedGenre(event.target.value)}
            >
              <option value="all">All genres</option>
              {genreOptions.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-white/55">
              Year
            </span>
            <select
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            >
              <option value="all">All years</option>
              {yearOptions.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-white/55">
              Min Rating
            </span>
            <select
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={minimumRating}
              onChange={(event) => setMinimumRating(event.target.value)}
            >
              <option value="0">Any rating</option>
              <option value="6">6.0+</option>
              <option value="7">7.0+</option>
              <option value="8">8.0+</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-white/55">
              Sort By
            </span>
            <select
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-red-200">
              {visibleMovies.length} results
            </span>
            {isSearchMode && normalizedSearchTerm && filteredMovies.length > SEARCH_RESULT_DISPLAY_LIMIT ? (
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-white/65">
                Showing top {SEARCH_RESULT_DISPLAY_LIMIT} of {filteredMovies.length}
              </span>
            ) : null}
            {isSearching ? (
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-200">
                Searching TMDB...
              </span>
            ) : null}
            {activeFilterCount > 0 ? (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">
                {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilterCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <XIcon className="h-4 w-4" />
            Clear filters
          </button>
        </div>

        {normalizedSearchTerm ? (
          <p className="mt-4 text-sm text-white/55">
            {isSearchMode
              ? `Search All TMDB is active, so results come from TMDB search before local filters are applied. The list shows the top ${SEARCH_RESULT_DISPLAY_LIMIT} matches.`
              : "Popular Now is active, so the search box is filtering only the currently loaded popular titles."}
          </p>
        ) : null}

        {searchError ? (
          <p className="mt-3 text-sm text-amber-300">{searchError}</p>
        ) : null}
      </section>

      {visibleMovies.length > 0 ? (
        <section className="mt-10 flex flex-wrap gap-8 max-sm:justify-center">
          {visibleMovies.map((movie) => (
            <MovieCard movie={movie} key={movie.id} />
          ))}
        </section>
      ) : (
        <section className="mt-10 rounded-3xl border border-dashed border-white/10 bg-white/4 p-10 text-center shadow-xl shadow-black/20">
          <h2 className="text-2xl font-semibold text-white">{emptyStateTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/60">
            {emptyStateDescription}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-8 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Reset browse controls
          </button>
        </section>
      )}
    </div>
  );
};

export default MoviesBrowse;