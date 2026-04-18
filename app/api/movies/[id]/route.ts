import { getMovieDetails } from "@/lib/tmdb";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const movie = await getMovieDetails(id);

  if (!movie) {
    return Response.json(
      { error: "Failed to fetch movie details." },
      { status: 503 }
    );
  }

  return Response.json(movie);
}
