import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getPopularMovies } from "@/lib/tmdb";
import BlurCircle from "./BlurCircle";
import MovieCard from "./MovieCard";

const FEATURED_MOVIES_LIMIT = 10;

const FeaturedSection = async () => {
  const featuredMovies = (await getPopularMovies()).slice(0, FEATURED_MOVIES_LIMIT);

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
          {featuredMovies.map((movie) => (
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