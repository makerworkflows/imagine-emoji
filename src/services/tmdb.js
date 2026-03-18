/**
 * TMDB API Service
 * Uses Read Access Token (Bearer) for all requests.
 * PERSONAL key -- swap for commercial before App Store submission.
 */

const BASE = "https://api.themoviedb.org/3";
const TOKEN = import.meta.env.VITE_TMDB_TOKEN || "";

export function isTmdbAvailable() {
  return TOKEN.length > 0;
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function tmdbFetch(path, params = {}) {
  if (!isTmdbAvailable()) throw new Error("No TMDB token configured");
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json();
}

/** Get the master genre list (cached on first call) */
let genreCache = null;
export async function getGenres() {
  if (genreCache) return genreCache;
  const data = await tmdbFetch("/genre/movie/list", { language: "en-US" });
  genreCache = data.genres; // [{id, name}]
  return genreCache;
}

/** Popular movies (page 1-5) */
export async function getPopularMovies(page = 1) {
  const data = await tmdbFetch("/movie/popular", { language: "en-US", page });
  return data.results;
}

/** Now playing in theaters */
export async function getNowPlaying(page = 1) {
  const data = await tmdbFetch("/movie/now_playing", { language: "en-US", page });
  return data.results;
}

/** Trending this week */
export async function getTrending() {
  const data = await tmdbFetch("/trending/movie/week", { language: "en-US" });
  return data.results;
}

/** Get keywords for a specific movie */
export async function getMovieKeywords(movieId) {
  const data = await tmdbFetch(`/movie/${movieId}/keywords`);
  return data.keywords || []; // [{id, name}]
}

/** Get full movie details (runtime, tagline, etc.) */
export async function getMovieDetails(movieId) {
  return tmdbFetch(`/movie/${movieId}`, { language: "en-US" });
}

/**
 * Fetch a batch of movies with their keywords.
 * Returns enriched movie objects ready for Reel generation.
 */
export async function fetchMovieBatch(source = "popular", page = 1) {
  let movies;
  switch (source) {
    case "now_playing":
      movies = await getNowPlaying(page);
      break;
    case "trending":
      movies = await getTrending();
      break;
    default:
      movies = await getPopularMovies(page);
  }

  const genres = await getGenres();
  const genreMap = Object.fromEntries(genres.map((g) => [g.id, g.name]));

  // Enrich each movie with keyword names and genre names
  const enriched = await Promise.all(
    movies.slice(0, 10).map(async (movie) => {
      const keywords = await getMovieKeywords(movie.id);
      return {
        id: movie.id,
        title: movie.title,
        overview: movie.overview || "",
        genres: (movie.genre_ids || []).map((id) => genreMap[id]).filter(Boolean),
        keywords: keywords.map((k) => k.name),
        releaseDate: movie.release_date,
        popularity: movie.popularity,
      };
    })
  );

  return enriched;
}
