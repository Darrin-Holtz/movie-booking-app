import { getPopularMovies } from "@/lib/tmdb"
import MovieCard from "../../../components/MovieCard"
import BlurCircle from "../../../components/BlurCircle";

export type TmdbMovie = {
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

const FEATURED_MOVIES_LIMIT = 10;

const Movies = async () => {
    const movies = await getPopularMovies()

    return movies.length > 0 ? (
        <div className="relative my-40 mb-60 px-6 md:px-16 lg:px-40 xl:px-44 overflow-hidden min-h-[80vh]">
            <BlurCircle top="150px" left="0px" />
            <BlurCircle bottom="50px" right="50px" />
            <h1 className="text-lg font-medium my-4">Now Showing</h1>
            <div className="flex flex-wrap max-sm:justify-center gap-8">
                {movies.slice(0, FEATURED_MOVIES_LIMIT).map((movie) => (
                    <MovieCard movie={movie} key={movie.id} />
                ))}
            </div>
        </div>
    ) : (
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-3xl font-bold text-center">
                No movies available right now. Please check back later.
            </h1>
        </div>
    )
}

export default Movies