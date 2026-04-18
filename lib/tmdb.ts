import { cache } from "react";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_REQUEST_TIMEOUT_MS = 8000;
const POPULAR_MOVIES_REVALIDATE_SECONDS = 300;
const MOVIE_DETAILS_REVALIDATE_SECONDS = 300;
const TRAILER_VIDEOS_REVALIDATE_SECONDS = 300;
const TRAILER_CANDIDATE_MULTIPLIER = 2;

type TmdbPagedResponse<T> = {
  results?: T[];
  total_pages?: number;
};

export type TmdbMovieGenre = {
  id: number;
  name: string;
};

export type TmdbMovieCastMember = {
  id: number;
  name: string;
  profile_path?: string | null;
};

export type TmdbMovie = {
  id: number;
  title: string;
  backdrop_path: string | null;
  poster_path?: string | null;
  release_date: string;
  genre_ids?: number[];
  genre_names?: string[];
  vote_average: number;
  overview?: string;
  runtime?: number;
};

export type TmdbMovieDetails = {
  title: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average: number;
  overview: string;
  runtime?: number | null;
  genres: TmdbMovieGenre[];
  release_date: string;
  trailerUrl?: string | null;
  credits?: {
    cast?: TmdbMovieCastMember[];
  };
  recommendations?: {
    results?: TmdbMovie[];
  };
};

type TmdbVideo = {
  key: string;
  site: string;
  type: string;
  official?: boolean;
};

export type TrailerItem = {
  id: string;
  title: string;
  videoUrl: string;
  image: string;
};

const getApiKey = () => process.env.TMDB_API_KEY?.trim() ?? "";

const buildTmdbUrl = (
  path: string,
  searchParams: Record<string, string> = {}
) => {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  const apiKey = getApiKey();

  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
};

const fetchTmdbJson = async <T>(
  path: string,
  options: {
    searchParams?: Record<string, string>;
    revalidate?: number;
  } = {}
) => {
  if (!getApiKey()) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TMDB_REQUEST_TIMEOUT_MS);

  try {
    const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
      signal: controller.signal,
    };

    if (options.revalidate) {
      fetchOptions.next = { revalidate: options.revalidate };
    } else {
      fetchOptions.cache = "no-store";
    }

    const response = await fetch(
      buildTmdbUrl(path, options.searchParams),
      fetchOptions
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getYoutubeTrailer = (videos: TmdbVideo[]): TmdbVideo | undefined => {
  return (
    videos.find((video) => video.site === "YouTube" && video.type === "Trailer" && video.official) ??
    videos.find((video) => video.site === "YouTube" && video.type === "Trailer") ??
    videos.find((video) => video.site === "YouTube" && video.type === "Teaser")
  );
};

const toVoteAverage = (value: unknown) => {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const isNonEmptyString = (value: string | undefined): value is string => {
  return typeof value === "string" && value.length > 0;
};

const normalizeMovie = (
  movie: Record<string, unknown>,
  genreMap: Record<number, string>
): TmdbMovie => ({
  id: typeof movie.id === "number" ? movie.id : 0,
  title: typeof movie.title === "string" ? movie.title : "Untitled Movie",
  backdrop_path:
    typeof movie.backdrop_path === "string" || movie.backdrop_path === null
      ? movie.backdrop_path
      : null,
  poster_path:
    typeof movie.poster_path === "string" || movie.poster_path === null
      ? movie.poster_path
      : undefined,
  release_date: typeof movie.release_date === "string" ? movie.release_date : "",
  vote_average: toVoteAverage(movie.vote_average),
  overview: typeof movie.overview === "string" ? movie.overview : undefined,
  runtime:
    typeof movie.runtime === "number" && Number.isFinite(movie.runtime)
      ? movie.runtime
      : undefined,
  genre_ids: Array.isArray(movie.genre_ids)
    ? movie.genre_ids.filter((genreId): genreId is number => typeof genreId === "number")
    : undefined,
  genre_names: Array.isArray(movie.genre_ids)
    ? movie.genre_ids
        .map((genreId) => (typeof genreId === "number" ? genreMap[genreId] : undefined))
      .filter(isNonEmptyString)
    : [],
});

const attachGenreNames = (
  movies: TmdbMovie[],
  genreMap: Record<number, string>
) => {
  return movies.map((movie) => ({
    ...movie,
    genre_names: (movie.genre_ids ?? [])
      .map((id) => genreMap[id])
      .filter(isNonEmptyString),
  }));
};

const getPopularMoviePage = cache(async () => {
  const data = await fetchTmdbJson<TmdbPagedResponse<TmdbMovie>>("/movie/popular", {
    revalidate: POPULAR_MOVIES_REVALIDATE_SECONDS,
  });
  return Array.isArray(data?.results) ? data.results : [];
});

const getGenreMap = cache(async (): Promise<Record<number, string>> => {
  const data = await fetchTmdbJson<{ genres?: TmdbMovieGenre[] }>(
    "/genre/movie/list",
    { revalidate: 86400 }
  );

  if (!Array.isArray(data?.genres)) {
    return {};
  }

  return Object.fromEntries(data.genres.map((genre) => [genre.id, genre.name]));
});

export async function getHeroMovie() {
  const popularMovies = await getPopularMoviePage();

  if (popularMovies.length === 0) {
    return null;
  }

  const heroMovie = popularMovies[0] as TmdbMovie;
  const details = await fetchTmdbJson<{ runtime?: number | null }>(
    `/movie/${heroMovie.id}`,
    { revalidate: MOVIE_DETAILS_REVALIDATE_SECONDS }
  );

  if (!details) {
    return heroMovie;
  }

  return {
    ...heroMovie,
    runtime: details.runtime ?? undefined,
  };
}

export async function getPopularMovies(): Promise<TmdbMovie[]> {
  const [movies, genreMap] = await Promise.all([getPopularMoviePage(), getGenreMap()]);

  return attachGenreNames(movies, genreMap);
}

export async function searchMovies(query: string): Promise<TmdbMovie[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  return searchMoviesByPages(trimmedQuery, 1);
}

export async function searchMoviesByPages(
  query: string,
  pageCount: number
): Promise<TmdbMovie[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const sanitizedPageCount = Math.min(Math.max(Math.floor(pageCount), 1), 5);
  const [firstPageData, genreMap] = await Promise.all([
    fetchTmdbJson<TmdbPagedResponse<TmdbMovie>>("/search/movie", {
      searchParams: {
        query: trimmedQuery,
        include_adult: "false",
        language: "en-US",
        page: "1",
      },
    }),
    getGenreMap(),
  ]);

  if (!firstPageData || !Array.isArray(firstPageData.results)) {
    return [];
  }

  const totalPages =
    typeof firstPageData.total_pages === "number" && Number.isFinite(firstPageData.total_pages)
      ? firstPageData.total_pages
      : 1;
  const pagesToFetch = Math.min(totalPages, sanitizedPageCount);

  const additionalPageResponses = await Promise.all(
    Array.from({ length: Math.max(0, pagesToFetch - 1) }, (_, index) =>
      fetchTmdbJson<TmdbPagedResponse<TmdbMovie>>("/search/movie", {
        searchParams: {
          query: trimmedQuery,
          include_adult: "false",
          language: "en-US",
          page: String(index + 2),
        },
      })
    )
  );

  const additionalPageResults = additionalPageResponses.map((response) =>
    Array.isArray(response?.results) ? (response.results as TmdbMovie[]) : []
  );

  const dedupedMovies = Array.from(
    new Map(
      [firstPageData.results as TmdbMovie[], ...additionalPageResults]
        .flat()
        .map((movie) => [movie.id, movie])
    ).values()
  );

  return attachGenreNames(dedupedMovies, genreMap);
}

export async function getMovieDetails(id: string): Promise<TmdbMovieDetails | null> {
  const [data, genreMap] = await Promise.all([
    fetchTmdbJson<Record<string, unknown>>(`/movie/${id}`, {
      searchParams: {
        append_to_response: "credits,recommendations,videos",
      },
    }),
    getGenreMap(),
  ]);

  if (!data) {
    return null;
  }

  const rawVideos = (data.videos as { results?: TmdbVideo[] } | undefined)?.results;
  const trailer = Array.isArray(rawVideos) ? getYoutubeTrailer(rawVideos) : null;
  const rawRecommendations = (data.recommendations as { results?: Record<string, unknown>[] } | undefined)?.results;
  const rawCast = (data.credits as { cast?: unknown[] } | undefined)?.cast;

  return {
    title: typeof data.title === "string" ? data.title : "Untitled Movie",
    backdrop_path:
      typeof data.backdrop_path === "string" || data.backdrop_path === null
        ? data.backdrop_path
        : null,
    poster_path:
      typeof data.poster_path === "string" || data.poster_path === null
        ? data.poster_path
        : null,
    vote_average: toVoteAverage(data.vote_average),
    overview: typeof data.overview === "string" ? data.overview : "",
    runtime:
      typeof data.runtime === "number" && Number.isFinite(data.runtime)
        ? data.runtime
        : null,
    genres: Array.isArray(data.genres)
      ? data.genres.filter(
          (genre): genre is TmdbMovieGenre =>
            typeof genre === "object" &&
            genre !== null &&
            typeof (genre as TmdbMovieGenre).id === "number" &&
            typeof (genre as TmdbMovieGenre).name === "string"
        )
      : [],
    release_date: typeof data.release_date === "string" ? data.release_date : "",
    credits: {
      cast: Array.isArray(rawCast)
        ? rawCast.filter(
            (member): member is TmdbMovieCastMember =>
              typeof member === "object" &&
              member !== null &&
              typeof (member as TmdbMovieCastMember).id === "number" &&
              typeof (member as TmdbMovieCastMember).name === "string"
          )
        : [],
    },
    recommendations: {
      results: Array.isArray(rawRecommendations)
        ? rawRecommendations.map((movie) => normalizeMovie(movie, genreMap))
        : [],
    },
    trailerUrl:
      typeof trailer?.key === "string"
        ? `https://www.youtube.com/watch?v=${trailer.key}`
        : null,
  };
}

export async function getPopularTrailers(limit = 4): Promise<TrailerItem[]> {
  const movies = await getPopularMoviePage();

  if (movies.length === 0) {
    return [];
  }

  const trailers = await Promise.all(
    movies
      .slice(0, Math.max(limit * TRAILER_CANDIDATE_MULTIPLIER, limit))
      .map(async (movie) => {
      const videosData = await fetchTmdbJson<{ results?: TmdbVideo[] }>(
        `/movie/${movie.id}/videos`,
        { revalidate: TRAILER_VIDEOS_REVALIDATE_SECONDS }
      );

      if (!videosData) {
        return null;
      }

      const trailer = getYoutubeTrailer(
        Array.isArray(videosData.results) ? videosData.results : []
      );

      if (!trailer?.key) {
        return null;
      }

      return {
        id: String(movie.id),
        title: movie.title,
        videoUrl: `https://www.youtube.com/watch?v=${trailer.key}`,
        image: movie.backdrop_path
          ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`
          : movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : "/next.svg",
      } satisfies TrailerItem;
    })
  );

  return trailers.filter((trailer): trailer is TrailerItem => trailer !== null).slice(0, limit);
}