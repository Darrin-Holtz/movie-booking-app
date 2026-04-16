import { ArrowRight } from "lucide-react";
import Link from "next/link";
import BlurCircle from "./BlurCircle";
import MovieCard from "./MovieCard";

type TmdbMovie = {
  id: number;
  backdrop_path: string | null;
  title: string;
  release_date: string;
  genre_ids?: number[];
  vote_average: number;
};

type FeaturedMovie = {
  id: number;
  backdrop_path: string | null;
  title: string;
  release_date: string;
  genre_names?: string[];
  runtime?: number;
  vote_average: number;
};

const FEATURED_MOVIES_LIMIT = 10;

const genreLabels: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

const getFeaturedMovies = async (): Promise<FeaturedMovie[]> => {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();

  if (!Array.isArray(data.results)) {
    return [];
  }

  return Promise.all(
    data.results.slice(0, FEATURED_MOVIES_LIMIT).map(async (movie: TmdbMovie) => {
      const detailsRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${process.env.TMDB_API_KEY}`,
        { cache: "no-store" }
      );

      let runtime: number | undefined;

      if (detailsRes.ok) {
        const details = await detailsRes.json();
        runtime = typeof details.runtime === "number" ? details.runtime : undefined;
      }

      return {
        id: movie.id,
        backdrop_path: movie.backdrop_path
          ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`
          : null,
        title: movie.title,
        release_date: movie.release_date,
        genre_names: movie.genre_ids?.map((genreId) => genreLabels[genreId] ?? String(genreId)) ?? [],
        runtime,
        vote_average: movie.vote_average,
      };
    })
  );
};

const FeaturedSection = async () => {
  const featuredMovies = await getFeaturedMovies();

  return (
    <div className="overflow-hidden px-6 md:px-16 lg:px-24 xl:px-44">
      <div className="relative flex items-center justify-between pb-10 pt-20">
        <BlurCircle top="0" right="-80px" />
        <h2 className="text-lg font-medium text-gray-300">Now Showing</h2>
        <Link href="/movies" className="group flex items-center gap-2 text-sm text-white hover:text-red-500">
          See All
          <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {featuredMovies.length > 0 ? (
        <div className="flex flex-wrap max-sm:justify-center gap-8 mt-8">
          {featuredMovies.map((movie: FeaturedMovie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
          Featured movies are unavailable right now.
        </div>
      )}

      <div className="mt-20 flex justify-center">
        <Link href="/movies" className="rounded-md bg-red-800 px-10 py-3 text-sm font-medium transition hover:bg-red-500">
          Show More
        </Link>
      </div>
    </div>
  );
};

export default FeaturedSection;