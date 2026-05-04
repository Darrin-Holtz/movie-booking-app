import { getHeroMovie } from "@/lib/tmdb";
import { ArrowRight, CalendarIcon, Clock3Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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

const formatRuntime = (runtime?: number) => {
  if (!runtime || runtime <= 0) {
    return null;
  }

  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
};

export const HeroSection = async () => {
  const movie = await getHeroMovie();

  if (!movie) {
    return (
      <section className="flex min-h-screen flex-col items-start justify-center gap-4 bg-black px-6 text-white md:px-16 lg:px-30">
        <h1 className="text-5xl font-semibold md:text-[70px] md:leading-18">
          Movies are loading
        </h1>
        <p className="max-w-md text-gray-300">
          The featured movie is unavailable right now. Check your TMDB API key and try again.
        </p>
      </section>
    );
  }

  const imageUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : null;
  const genres = movie.genre_ids
    ?.map((genreId: number) => genreLabels[genreId] ?? String(genreId))
    .join(" | ");
  const runtime = formatRuntime(movie.runtime);

  return (
    <section className="relative flex h-screen flex-col items-start justify-center overflow-hidden">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-black/50 via-black/25 to-black/5 opacity-10" />
      <div className="relative z-10 flex flex-col items-start gap-4 px-6 md:px-16 lg:px-30">
        <h1 className="text-5xl md:text-[70px] md:leading-18 font-semibold max-w-110">
          {movie.title}
        </h1>

        <div className="flex items-center gap-4 text-gray-300">
          <span>{genres}</span>

          <div className="flex items-center gap-1">
            <CalendarIcon className="w-4.5 h-4.5" />
            {new Date(movie.release_date).getFullYear()}
          </div>

          {runtime ? (
            <div className="flex items-center gap-1">
              <Clock3Icon className="w-4.5 h-4.5" />
              {runtime}
            </div>
          ) : null}
        </div>

        <p className="max-w-md text-gray-300">{movie.overview}</p>

        <Link
          href="/movies"
          className="flex items-center gap-1 rounded-full bg-red-800 px-6 py-3 text-sm font-medium text-white transition hover:bg-red-500"
        >
          Explore Movies
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </section>
  );
};