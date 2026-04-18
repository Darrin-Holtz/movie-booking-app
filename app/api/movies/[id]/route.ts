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

const toVoteAverage = (value: unknown) => {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const normalizeRecommendedMovie = (movie: Record<string, unknown>) => ({
  ...movie,
  vote_average: toVoteAverage(movie.vote_average),
  genre_names: Array.isArray(movie.genre_ids)
    ? movie.genre_ids
        .map((genreId) => (typeof genreId === "number" ? genreLabels[genreId] : undefined))
        .filter(Boolean)
    : [],
});

const getYoutubeTrailer = (videos: Record<string, unknown>[]) => {
  return (
    videos.find(
      (video) =>
        video.site === "YouTube" && video.type === "Trailer" && video.official === true
    ) ??
    videos.find((video) => video.site === "YouTube" && video.type === "Trailer") ??
    videos.find((video) => video.site === "YouTube" && video.type === "Teaser")
  );
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,recommendations,videos`
  );
  const data = await res.json();

  if (!res.ok) {
    return Response.json(
      { error: data.status_message ?? "Failed to fetch movie details." },
      { status: res.status }
    );
  }

  if (Array.isArray(data.recommendations?.results)) {
    data.recommendations.results = data.recommendations.results.map(
      (movie: Record<string, unknown>) => normalizeRecommendedMovie(movie)
    );
  }

  data.vote_average = toVoteAverage(data.vote_average);
  data.genres = Array.isArray(data.genres) ? data.genres : [];
  data.release_date = typeof data.release_date === "string" ? data.release_date : "";
  data.overview = typeof data.overview === "string" ? data.overview : "";
  data.runtime = typeof data.runtime === "number" && Number.isFinite(data.runtime) ? data.runtime : null;
  data.credits = {
    ...data.credits,
    cast: Array.isArray(data.credits?.cast) ? data.credits.cast : [],
  };

  const trailer = Array.isArray(data.videos?.results)
    ? getYoutubeTrailer(data.videos.results)
    : null;

  data.trailerUrl =
    typeof trailer?.key === "string"
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null;

  delete data.videos;

  return Response.json(data);
}
