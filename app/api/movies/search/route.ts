import { searchMoviesByPages } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const requestedPages = Number(searchParams.get("pages") ?? "1");
  const pageCount = Number.isFinite(requestedPages) ? requestedPages : 1;

  if (!query) {
    return Response.json({ movies: [] });
  }

  try {
    const movies = await searchMoviesByPages(query, pageCount);
    return Response.json({ movies });
  } catch {
    return Response.json(
      { error: "Failed to search movies." },
      { status: 500 }
    );
  }
}