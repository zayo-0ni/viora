import { get } from "@/lib/providers/tmdb/tmdb-client";
import { movieMeta, seriesMeta, type Page, type RawMovie, type RawSeries } from "@/lib/providers/tmdb/tmdb-meta-mappers";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import type { Meta } from "@/lib/cinemeta";
import type { AddonResultGroup } from "@/lib/search-addons";
import type { AddonHit } from "@/lib/search-addon-index";
import { getCachedPlaylist } from "@/lib/iptv/store";
import { arabicAwareMatch } from "@/lib/iptv/rtl";
import { rankMetas, titleRank } from "@/lib/search-rank";
import type { Settings } from "@/lib/settings";
import { safeFetch } from "@/lib/safe-fetch";

export type SearchPerson = {
  id: number;
  name: string;
  profile: string | null;
  knownFor: string;
  popularity: number;
};

type RawPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
  popularity?: number;
  known_for?: Array<RawMovie | RawSeries>;
  known_for_department?: string;
};

type MultiItem =
  | (RawMovie & { media_type: "movie"; popularity?: number })
  | (RawSeries & { media_type: "tv"; popularity?: number })
  | (RawPerson & { media_type: "person" });

export type LiveTvHit = {
  channelId: string;
  name: string;
  logo: string | null;
  url: string;
  group: string | null;
  playlistId: string;
  playlistName: string;
};


export type SearchResults = {
  query: string;
  topMatch: { kind: "movie" | "series"; meta: Meta; popularity: number; backdrop?: string; overview?: string; voteAverage?: number } | null;
  people: SearchPerson[];
  movies: Meta[];
  series: Meta[];
  liveTv: LiveTvHit[];
  addonGroups: AddonResultGroup[];
  addons: AddonHit[];
  intent: SearchIntent;
};

export type SearchIntent =
  | { kind: "year"; year: number; label: string }
  | { kind: "genre"; genre: string; mediaType: "movie" | "tv"; label: string }
  | null;

export function searchLiveTvChannels(
  query: string,
  iptvPlaylists: Settings["iptvPlaylists"],
  limit = 8,
): LiveTvHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: LiveTvHit[] = [];
  const seenUrl = new Set<string>();
  for (const pl of iptvPlaylists) {
    if ((pl.kind ?? "m3u") === "epg") continue;
    const cached = getCachedPlaylist(pl.id);
    if (!cached) continue;
    for (const ch of cached.channels) {
      if (seenUrl.has(ch.url)) continue;
      if (!arabicAwareMatch(`${ch.name ?? ""} ${ch.group ?? ""}`, q)) continue;
      seenUrl.add(ch.url);
      hits.push({
        channelId: ch.id,
        name: ch.name,
        logo: ch.logo ?? null,
        url: ch.url,
        group: ch.group ?? null,
        playlistId: pl.id,
        playlistName: pl.name,
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}



export async function searchCinemeta(query: string): Promise<{ movies: Meta[]; series: Meta[] }> {
  const q = query.trim();
  if (q.length < 2) return { movies: [], series: [] };
  const fetchKind = async (type: "movie" | "series"): Promise<Meta[]> => {
    const url = `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(q)}.json`;
    const res = await safeFetch(url, { headers: { Accept: "application/json" } }).catch(() => null);
    if (!res || !res.ok) return [];
    const data = (await res.json().catch(() => null)) as { metas?: Meta[] } | null;
    return (data?.metas ?? []).slice(0, 12);
  };
  const [movies, series] = await Promise.all([fetchKind("movie"), fetchKind("series")]);
  return { movies, series };
}

export async function searchAll(
  key: string,
  query: string,
  opts: { excludeGenres?: number[] } = {},
): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: "", topMatch: null, people: [], movies: [], series: [], liveTv: [], addonGroups: [], addons: [], intent: null };
  }
  if (!key) {
    return { query: trimmed, topMatch: null, people: [], movies: [], series: [], liveTv: [], addonGroups: [], addons: [], intent: detectIntent(trimmed) };
  }

  const data = await get<Page<MultiItem>>(key, "search/multi", {
    query: trimmed,
    include_adult: "false",
  });
  const exclude = new Set(opts.excludeGenres ?? []);
  const hasExcludedGenre = (gs?: number[]) => (gs ?? []).some((id) => exclude.has(id));
  const results = (data?.results ?? []).filter((r) => {
    if (r.media_type === "person") return true;
    if (!exclude.size) return true;
    return !hasExcludedGenre((r as { genre_ids?: number[] }).genre_ids);
  });

  const movies: Meta[] = [];
  const series: Meta[] = [];
  const people: SearchPerson[] = [];
  type Watchable =
    | (RawMovie & { media_type: "movie"; popularity?: number })
    | (RawSeries & { media_type: "tv"; popularity?: number });
  let topRaw: Watchable | null = null;
  // The headline result is the one that answers the query, not the one with the
  // largest audience. Popularity used to decide this alone, which is how three
  // letters of "Spider-Man" produced a blockbuster that merely happened to match
  // — so it now only breaks a tie between titles that match equally well.
  let topRank = Number.POSITIVE_INFINITY;
  let topPop = -1;

  for (const r of results) {
    if (r.media_type === "movie" && r.poster_path) {
      const meta = movieMeta(r);
      movies.push(meta);
      // Judged on the name the viewer will read, which is not always TMDB's
      // `title` — the mapper prefers the original title when translation is off.
      const rank = titleRank(meta.name, trimmed);
      const pop = r.popularity ?? 0;
      if (rank < topRank || (rank === topRank && pop > topPop)) {
        topRaw = r;
        topRank = rank;
        topPop = pop;
      }
    } else if (r.media_type === "tv" && r.poster_path) {
      const meta = seriesMeta(r);
      series.push(meta);
      const rank = titleRank(meta.name, trimmed);
      const pop = r.popularity ?? 0;
      if (rank < topRank || (rank === topRank && pop > topPop)) {
        topRaw = r;
        topRank = rank;
        topPop = pop;
      }
    } else if (r.media_type === "person") {
      const known = (r.known_for ?? [])
        .map((k) => (k as { title?: string; name?: string }).title ?? (k as { name?: string }).name ?? "")
        .filter(Boolean)
        .slice(0, 2)
        .join(", ");
      people.push({
        id: r.id,
        name: r.name,
        profile: r.profile_path ?? null,
        knownFor: known || (r.known_for_department ?? "Cast"),
        popularity: r.popularity ?? 0,
      });
    }
  }

  if (
    trimmed.split(/\s+/).length >= 2 &&
    (people.length >= 1 || (movies.length === 0 && series.length === 0))
  ) {
    await fuzzyPeopleFallback(key, trimmed, people);
  }

  people.sort((a, b) => b.popularity - a.popularity);

  let topMatch: SearchResults["topMatch"] = null;
  const winner: Watchable | null = topRaw;
  if (winner) {
    const isMovie = winner.media_type === "movie";
    topMatch = {
      kind: isMovie ? "movie" : "series",
      meta: isMovie ? movieMeta(winner as RawMovie) : seriesMeta(winner as RawSeries),
      popularity: winner.popularity ?? 0,
      backdrop: winner.backdrop_path ? `https://image.tmdb.org/t/p/w1280${winner.backdrop_path}` : undefined,
      overview: winner.overview,
      voteAverage: winner.vote_average,
    };
  }

  return {
    query: trimmed,
    topMatch,
    people: people.slice(0, 10),
    // Ranked before the cap, not after: TMDB returns its page in popularity
    // order, so cutting first can throw away the exact title the viewer typed
    // because thirteen better-known films matched it too.
    movies: rankMetas(movies, trimmed).slice(0, 12),
    series: rankMetas(series, trimmed).slice(0, 12),
    liveTv: [],
    addonGroups: [],
    addons: [],
    intent: detectIntent(trimmed),
  };
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function nameCloseTo(name: string, query: string): boolean {
  const n = name.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!n || !q) return false;
  if (n.includes(q) || q.includes(n)) return true;
  return levenshtein(n, q) <= Math.max(1, Math.round(q.length * 0.2));
}

async function fuzzyPeopleFallback(
  key: string,
  query: string,
  people: SearchPerson[],
): Promise<void> {
  const token = query
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .sort((a, b) => b.length - a.length)[0];
  if (!token) return;
  const extra = await get<Page<RawPerson>>(key, "search/person", {
    query: token,
    include_adult: "false",
    language: "en-US",
  }).catch(() => null);
  if (!extra?.results) return;
  const seen = new Set(people.map((p) => p.id));
  for (const r of extra.results) {
    if (seen.has(r.id) || !nameCloseTo(r.name, query)) continue;
    seen.add(r.id);
    const known = (r.known_for ?? [])
      .map((k) => (k as { title?: string; name?: string }).title ?? (k as { name?: string }).name ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");
    people.push({
      id: r.id,
      name: r.name,
      profile: r.profile_path ?? null,
      knownFor: known || (r.known_for_department ?? "Cast"),
      popularity: r.popularity ?? 0,
    });
  }
}

export function detectIntent(query: string): SearchIntent {
  const q = query.trim();

  const yearMatch = q.match(/^(19|20)\d{2}$/);
  if (yearMatch) {
    const year = parseInt(q, 10);
    return { kind: "year", year, label: `Movies from ${year}` };
  }

  const lower = q.toLowerCase();
  for (const [name] of Object.entries(MOVIE_GENRES)) {
    if (lower === name.toLowerCase() || lower === `${name.toLowerCase()} movies`) {
      return { kind: "genre", genre: name, mediaType: "movie", label: `${name} movies` };
    }
  }
  for (const [name] of Object.entries(TV_GENRES)) {
    if (lower === name.toLowerCase() || lower === `${name.toLowerCase()} shows`) {
      return { kind: "genre", genre: name, mediaType: "tv", label: `${name} shows` };
    }
  }

  return null;
}
