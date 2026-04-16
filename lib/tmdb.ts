const TMDB_BASE_URL = "https://api.themoviedb.org/3";

type TmdbMovie = {
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

const getYoutubeTrailer = (videos: TmdbVideo[]): TmdbVideo | undefined => {
  return (
    videos.find((video) => video.site === "YouTube" && video.type === "Trailer" && video.official) ??
    videos.find((video) => video.site === "YouTube" && video.type === "Trailer") ??
    videos.find((video) => video.site === "YouTube" && video.type === "Teaser")
  );
};

export async function getHeroMovie() {
  const res = await fetch(
    `${TMDB_BASE_URL}/movie/popular?api_key=${process.env.TMDB_API_KEY}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return null;
  }

  const data = await res.json();

  if (!Array.isArray(data.results) || data.results.length === 0) {
    return null;
  }

  const heroMovie = data.results[0] as TmdbMovie;
  const detailsRes = await fetch(
    `${TMDB_BASE_URL}/movie/${heroMovie.id}?api_key=${process.env.TMDB_API_KEY}`,
    { cache: "no-store" }
  );

  if (!detailsRes.ok) {
    return heroMovie;
  }

  const details = await detailsRes.json();

  return {
    ...heroMovie,
    runtime: details.runtime,
  };
}

async function getGenreMap(): Promise<Record<number, string>> {
  const res = await fetch(
    `${TMDB_BASE_URL}/genre/movie/list?api_key=${process.env.TMDB_API_KEY}`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return {};
  const data = await res.json();
  return Object.fromEntries(
    (data.genres as { id: number; name: string }[]).map((g) => [g.id, g.name])
  );
}

export async function getPopularMovies(): Promise<TmdbMovie[]> {
  const [moviesRes, genreMap] = await Promise.all([
    fetch(
      `${TMDB_BASE_URL}/movie/popular?api_key=${process.env.TMDB_API_KEY}`,
      { cache: "no-store" }
    ),
    getGenreMap(),
  ]);

  if (!moviesRes.ok) return [];

  const data = await moviesRes.json();
  if (!Array.isArray(data.results)) return [];

  return (data.results as TmdbMovie[]).map((movie) => ({
    ...movie,
    genre_names: (movie.genre_ids ?? []).map((id) => genreMap[id]).filter(Boolean),
  }));
}

export async function getPopularTrailers(limit = 4): Promise<TrailerItem[]> {
  const res = await fetch(
    `${TMDB_BASE_URL}/movie/popular?api_key=${process.env.TMDB_API_KEY}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();

  if (!Array.isArray(data.results)) {
    return [];
  }

  const trailers = await Promise.all(
    (data.results as TmdbMovie[]).slice(0, 12).map(async (movie) => {
      const videosRes = await fetch(
        `${TMDB_BASE_URL}/movie/${movie.id}/videos?api_key=${process.env.TMDB_API_KEY}`,
        { cache: "no-store" }
      );

      if (!videosRes.ok) {
        return null;
      }

      const videosData = await videosRes.json();
      const trailer = getYoutubeTrailer(Array.isArray(videosData.results) ? videosData.results : []);

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