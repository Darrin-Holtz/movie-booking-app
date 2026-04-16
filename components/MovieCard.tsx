import Link from "next/link";
import Image from "next/image";
import { StarIcon } from "lucide-react";

interface Movie {
  _id: string;
  backdrop_path: string;
  title: string;
  release_date: string;
  genres: string[];
  runtime?: number;
  vote_average: number;
}

interface MovieCardProps {
  movie: Movie;
}

const MovieCard = ({ movie }: MovieCardProps) => {
  return (
    <div className="flex flex-col justify-between p-3 bg-gray-800 rounded-2xl hover:-translate-y-1 transition duration-300 w-66">
      <Link href={`/movies/${movie._id}`}>
        <Image
          src={movie.backdrop_path}
          alt={movie.title}
          width={320}
          height={180}
          className="cursor-pointer rounded-lg object-cover object-bottom-right"
        />
      </Link>
      <p className="mt-2 truncate font-semibold">{movie.title}</p>
      <p className="mt-2 text-sm text-gray-400">
        {new Date(movie.release_date).getFullYear()} • {movie.genres.slice(0, 2).join(" | ")}
        {movie.runtime ? ` • ${movie.runtime} mins` : ""}
      </p>
      <div className="flex items-center justify-between mt-4 pb-3">
        <Link
          href={`/movies/${movie._id}`}
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