export async function GET() {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}`
  );

  const data = await res.json();
  console.log(data);
  return Response.json(data);
}