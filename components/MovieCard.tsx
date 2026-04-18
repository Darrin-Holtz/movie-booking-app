"use client";

import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { HeartIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import timeFormat from "@/lib/timeFormat";

interface Movie {
  id: number;
  backdrop_path: string | null;
  poster_path?: string | null;
  title: string;
  release_date: string;
  genre_ids?: number[];
  genre_names?: string[];
  runtime?: number;
  vote_average: number;
}

interface MovieCardProps {
  movie: Movie;
}

const MovieCard = ({ movie }: MovieCardProps) => {
  const router = useRouter();
  const { data: session, isPending: isAuthPending } = authClient.useSession();
  const addFavorite = useMutation(api.favorites.addFavorite);
  const removeFavorite = useMutation(api.favorites.removeFavorite);
  const favoriteState = useQuery(
    api.favorites.isFavorite,
    session?.session ? { movieId: String(movie.id) } : "skip"
  ) as { isFavorite: boolean } | undefined;
  const [isFavoriteSubmitting, setIsFavoriteSubmitting] = useState(false);
  const formattedRuntime = timeFormat(movie.runtime);
  const isFavorite = favoriteState?.isFavorite ?? false;

  const handleFavoriteToggle = async () => {
    if (!session?.session) {
      toast.error("Sign in to save favorites.");
      router.push("/sign-in");
      return;
    }

    setIsFavoriteSubmitting(true);

    try {
      if (isFavorite) {
        await removeFavorite({ movieId: String(movie.id) });
        toast.success("Removed from favorites");
      } else {
        await addFavorite({
          movieId: String(movie.id),
          movieTitle: movie.title,
          posterPath: movie.poster_path ?? undefined,
          backdropPath: movie.backdrop_path ?? undefined,
          releaseDate: movie.release_date || undefined,
          voteAverage: movie.vote_average,
        });
        toast.success("Added to favorites");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update favorites.");
    } finally {
      setIsFavoriteSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col justify-between p-3 bg-gray-800 rounded-2xl hover:-translate-y-1 transition duration-300 w-66">
      <div className="relative">
      <Link href={`/movies/${movie.id}`}>
        <Image
          src={movie.backdrop_path
            ? movie.backdrop_path.startsWith("http")
              ? movie.backdrop_path
              : `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`
            : "/fallback-movie.jpg"}
          alt={movie.title}
          width={320}
          height={180}
          className="cursor-pointer rounded-lg object-cover object-bottom-right"
        />
      </Link>
      <button
        type="button"
        onClick={handleFavoriteToggle}
        disabled={isFavoriteSubmitting || isAuthPending}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 backdrop-blur-md transition disabled:cursor-not-allowed disabled:opacity-60 ${
          isFavorite ? "bg-red-800/95 text-white" : "bg-black/45 text-white hover:bg-black/65"
        }`}
      >
        <HeartIcon className={`h-4.5 w-4.5 ${isFavorite ? "fill-white text-white" : "text-white"}`} />
      </button>
      </div>
      <p className="mt-2 truncate font-semibold">{movie.title}</p>
      <p className="mt-2 text-sm text-gray-400">
        {new Date(movie.release_date).getFullYear()}{movie.genre_names && movie.genre_names.length > 0 ? ` • ${movie.genre_names.slice(0, 2).join(" | ")}` : ""}
        {formattedRuntime ? ` • ${formattedRuntime}` : ""}
      </p>
      <div className="flex items-center justify-between mt-4 pb-3">
        <Link
          href={`/movies/${movie.id}`}
          className="mt-4 rounded-full bg-red-800 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-500 cursor-pointer"
        >
          Buy Tickets
        </Link>
        <p className="mt-1 flex items-center gap-1 text-sm text-gray-400 pr-1">
            <StarIcon className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            {movie.vote_average.toFixed(1)}
        </p>
      </div>
    </div>
  );
};

export default MovieCard;