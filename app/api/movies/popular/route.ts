import { getPopularMovies } from "@/lib/tmdb";

export async function GET() {
  const movies = await getPopularMovies();

  return Response.json({ movies });
}