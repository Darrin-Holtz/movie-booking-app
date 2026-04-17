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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,recommendations`
  );
  const data = await res.json();

  if (Array.isArray(data.recommendations?.results)) {
    data.recommendations.results = data.recommendations.results.map(
      (movie: { genre_ids?: number[] }) => ({
        ...movie,
        genre_names: movie.genre_ids?.map((genreId) => genreLabels[genreId]).filter(Boolean) ?? [],
      })
    );
  }

  return Response.json(data);
}
