import MoviesBrowse from "@/components/MoviesBrowse";
import { getPopularMovies } from "@/lib/tmdb";

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

type PageSearchParams = Promise<{
    [key: string]: string | string[] | undefined;
}>;

const getSearchParam = (
    value: string | string[] | undefined,
    fallback: string
) => {
    if (typeof value === "string") {
        return value;
    }

    if (Array.isArray(value) && value.length > 0) {
        return value[0] ?? fallback;
    }

    return fallback;
};

const Movies = async ({
    searchParams,
}: {
    searchParams: PageSearchParams;
}) => {
    const [movies, resolvedSearchParams] = await Promise.all([
        getPopularMovies(),
        searchParams,
    ]);
    const query = getSearchParam(resolvedSearchParams.q, "");
    const initialMode = getSearchParam(
        resolvedSearchParams.mode,
        query ? "search" : "popular"
    );

    return movies.length > 0 ? (
        <MoviesBrowse
            movies={movies}
            initialState={{
                mode: initialMode === "search" ? "search" : "popular",
                query,
                genre: getSearchParam(resolvedSearchParams.genre, "all"),
                year: getSearchParam(resolvedSearchParams.year, "all"),
                rating: getSearchParam(resolvedSearchParams.rating, "0"),
                sort: getSearchParam(resolvedSearchParams.sort, "popular"),
            }}
        />
    ) : (
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-3xl font-bold text-center">
                No movies available right now. Please check back later.
            </h1>
        </div>
    )
}

export default Movies