export async function getHeroMovie() {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}`,
    { cache: "no-store" } // optional for fresh data
  );

  if (!res.ok) {
    return null;
  }

  const data = await res.json();

  if (!Array.isArray(data.results) || data.results.length === 0) {
    return null;
  }

  const heroMovie = data.results[0];
  const detailsRes = await fetch(
    `https://api.themoviedb.org/3/movie/${heroMovie.id}?api_key=${process.env.TMDB_API_KEY}`,
    { cache: "no-store" }
  );

  if (!detailsRes.ok) {
    return heroMovie;
  }

  const details = await detailsRes.json();

  return {
    ...heroMovie,
    runtime: details.runtime,
  };
}