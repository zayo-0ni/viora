import { lruSet } from "@/lib/cache";
import { safeFetch as fetch } from "@/lib/safe-fetch";
import type { Meta } from "./cinemeta";
import type { PlayEpisode } from "./view";
import { tmdbDetails, tmdbSeasonEpisodes } from "./providers/tmdb";
import { resolveMeta } from "./meta-resource";





async function getNonStandardEpisodes(meta: Meta): Promise<PlayEpisode[] | null> {
  return getAddonEpisodes(meta.id);
}

type Adjacent = { prev: PlayEpisode | null; next: PlayEpisode | null };

const TT_CACHE_MAX = 800;
const SEASON_CACHE_MAX = 400;
const ttCache = new Map<string, Adjacent>();
const tmdbSeasonCache = new Map<string, PlayEpisode[]>();
const addonEpsCache = new Map<string, PlayEpisode[]>();
const cinemetaListCache = new Map<string, PlayEpisode[]>();


function readAuthKey(): string | null {
  try {
    const raw = localStorage.getItem("harbor.auth");
    return raw ? ((JSON.parse(raw) as { authKey?: string }).authKey ?? null) : null;
  } catch {
    return null;
  }
}

async function getAddonEpisodes(id: string): Promise<PlayEpisode[] | null> {
  if (addonEpsCache.has(id)) return addonEpsCache.get(id)!;
  const m = await resolveMeta(readAuthKey(), "series", id).catch(() => null);
  const raw = m?.videos ?? [];
  const eps: PlayEpisode[] = [];
  for (const v of raw) {
    const season = typeof v.season === "number" ? v.season : null;
    const episode =
      typeof v.episode === "number" ? v.episode : typeof v.number === "number" ? v.number : null;
    if (season == null || episode == null || season < 1) continue;
    const ep: PlayEpisode = { season, episode, name: v.title || v.name || undefined, still: v.thumbnail };
    const vid = (v as { id?: string }).id;
    if (vid && (vid.startsWith("kitsu:") || vid.startsWith("mal:"))) ep.kitsuStreamId = vid;
    else if (vid) ep.videoId = vid;
    eps.push(ep);
  }
  if (eps.length === 0) return null;
  eps.sort((a, b) => a.season - b.season || a.episode - b.episode);
  lruSet(addonEpsCache, id, eps, SEASON_CACHE_MAX);
  return eps;
}

export async function fetchAdjacentEpisodes(
  meta: Meta,
  current: { season: number; episode: number },
  opts: { tmdbKey: string; kitsuStreamId?: string },
): Promise<Adjacent> {
  if (meta.type !== "series") return { prev: null, next: null };

  if (meta.id.startsWith("tt")) {
    const key = `${meta.id}:${current.season}:${current.episode}`;
    if (ttCache.has(key)) return ttCache.get(key)!;
    const eps = await loadCinemetaEpisodes(meta.id);
    if (!eps) return { prev: null, next: null };
    const result = computeAdjacent(eps, current);
    lruSet(ttCache, key, result, TT_CACHE_MAX);
    return result;
  }

  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const tvId = parseInt(meta.id.split(":")[2] ?? "", 10);
    if (!Number.isFinite(tvId)) return { prev: null, next: null };
    return tmdbAdjacent(opts.tmdbKey, tvId, current);
  }

  const eps = await getNonStandardEpisodes(meta);
  if (!eps) return { prev: null, next: null };
  return computeAdjacent(eps, current);
}

export async function fetchUpcomingEpisodes(
  meta: Meta,
  current: { season: number; episode: number },
  count: number,
  opts: { tmdbKey: string },
): Promise<PlayEpisode[]> {
  if ((meta.type !== "series") || count <= 0) return [];
  if (meta.id.startsWith("tt")) {
    const eps = await loadCinemetaEpisodes(meta.id);
    if (!eps) return [];
    const idx = eps.findIndex((v) => v.season === current.season && v.episode === current.episode);
    if (idx === -1) return eps.slice(0, count);
    return eps.slice(idx + 1, idx + 1 + count);
  }
  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const tvId = parseInt(meta.id.split(":")[2] ?? "", 10);
    if (!Number.isFinite(tvId)) return [];
    const out: PlayEpisode[] = [];
    let season = current.season;
    let cursor = current.episode;
    while (out.length < count && season <= current.season + 3) {
      const eps = await tmdbSeason(opts.tmdbKey, tvId, season);
      const start = season === current.season
        ? eps.findIndex((e) => e.episode === cursor) + 1
        : 0;
      if (start < 0) break;
      for (let i = start; i < eps.length && out.length < count; i++) out.push(eps[i]);
      season += 1;
      cursor = 0;
    }
    return out;
  }
  const eps = await getNonStandardEpisodes(meta);
  if (!eps) return [];
  const idx = eps.findIndex((v) => v.season === current.season && v.episode === current.episode);
  if (idx === -1) return eps.slice(0, count);
  return eps.slice(idx + 1, idx + 1 + count);
}

async function loadCinemetaEpisodes(id: string): Promise<PlayEpisode[] | null> {
  if (cinemetaListCache.has(id)) return cinemetaListCache.get(id)!;
  const res = await fetch(`https://v3-cinemeta.strem.io/meta/series/${id}.json`);
  if (!res.ok) return null;
  const json = await res.json();
  const raw = (json?.meta?.videos ?? []) as Array<{
    season?: number;
    episode?: number;
    number?: number;
    title?: string;
    name?: string;
    thumbnail?: string;
    overview?: string;
    description?: string;
    released?: string;
    firstAired?: string;
  }>;
  const eps: PlayEpisode[] = [];
  for (const v of raw) {
    const season = typeof v.season === "number" ? v.season : null;
    const episode =
      typeof v.episode === "number"
        ? v.episode
        : typeof v.number === "number"
          ? v.number
          : null;
    if (season == null || episode == null) continue;
    if (season < 1) continue;
    eps.push({
      season,
      episode,
      name: v.title || v.name || undefined,
      still: v.thumbnail,
      overview: v.overview || v.description,
      airDate: v.released || v.firstAired,
    });
  }
  eps.sort((a, b) => a.season - b.season || a.episode - b.episode);
  lruSet(cinemetaListCache, id, eps, SEASON_CACHE_MAX);
  return eps;
}

function uniqueSeasons(eps: PlayEpisode[] | null): number[] {
  if (!eps) return [];
  const set = new Set<number>();
  for (const e of eps) if (e.season >= 1) set.add(e.season);
  return [...set].sort((a, b) => a - b);
}

function animeSeasonKey(e: PlayEpisode): number {
  return e.imdbSeason != null && e.imdbSeason >= 1 ? e.imdbSeason : e.season;
}

function uniqueAnimeSeasons(eps: PlayEpisode[] | null): number[] {
  if (!eps) return [];
  const set = new Set<number>();
  for (const e of eps) {
    const s = animeSeasonKey(e);
    if (s >= 1) set.add(s);
  }
  return [...set].sort((a, b) => a - b);
}

export async function fetchSeasonList(meta: Meta, opts: { tmdbKey: string }): Promise<number[]> {
  if (meta.type !== "series") return [];
  if (meta.id.startsWith("tt")) {
    return uniqueSeasons(await loadCinemetaEpisodes(meta.id));
  }
  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const detail = await tmdbDetails(opts.tmdbKey, meta).catch(() => null);
    const nums = (detail?.seasons ?? []).map((s) => s.seasonNumber).filter((n) => n >= 1);
    return [...new Set(nums)].sort((a, b) => a - b);
  }
  return uniqueAnimeSeasons(await getNonStandardEpisodes(meta));
}

export async function fetchSeasonEpisodes(
  meta: Meta,
  season: number,
  opts: { tmdbKey: string },
): Promise<PlayEpisode[]> {
  if ((meta.type !== "series") || season < 1) return [];
  if (meta.id.startsWith("tt")) {
    const eps = await loadCinemetaEpisodes(meta.id);
    return (eps ?? []).filter((e) => e.season === season);
  }
  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const tvId = parseInt(meta.id.split(":")[2] ?? "", 10);
    if (!Number.isFinite(tvId)) return [];
    return tmdbSeason(opts.tmdbKey, tvId, season);
  }
  const eps = await getNonStandardEpisodes(meta);
  return (eps ?? []).filter((e) => animeSeasonKey(e) === season);
}

export async function fetchEpisodeList(meta: Meta, opts: { tmdbKey: string }): Promise<PlayEpisode[]> {
  if (meta.type !== "series") return [];
  if (meta.id.startsWith("tt")) return (await loadCinemetaEpisodes(meta.id)) ?? [];
  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const seasons = await fetchSeasonList(meta, opts);
    const all: PlayEpisode[] = [];
    for (const s of seasons) all.push(...(await fetchSeasonEpisodes(meta, s, opts)));
    return all;
  }
  return (await getNonStandardEpisodes(meta)) ?? [];
}

export function nextUnwatchedAfter(
  eps: PlayEpisode[],
  from: { season: number; episode: number },
  isWatched: (season: number, episode: number) => boolean,
): PlayEpisode | null {
  const sorted = eps
    .filter((e) => e.season >= 1)
    .slice()
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
  let idx = sorted.findIndex((e) => e.season === from.season && e.episode === from.episode);
  if (idx < 0) idx = 0;
  for (let i = idx; i < sorted.length; i++) {
    if (!isWatched(sorted[i].season, sorted[i].episode)) return sorted[i];
  }
  return null;
}

function computeAdjacent(eps: PlayEpisode[], current: { season: number; episode: number }): Adjacent {
  const idx = eps.findIndex((v) => v.season === current.season && v.episode === current.episode);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? eps[idx - 1] : null,
    next: idx < eps.length - 1 ? eps[idx + 1] : null,
  };
}

async function tmdbSeason(key: string, tvId: number, season: number): Promise<PlayEpisode[]> {
  const cacheKey = `${key}:${tvId}:${season}`;
  if (tmdbSeasonCache.has(cacheKey)) return tmdbSeasonCache.get(cacheKey)!;
  if (season < 1) return [];
  const raw = await tmdbSeasonEpisodes(key, tvId, season);
  const eps: PlayEpisode[] = raw
    .map((e) => ({
      season: e.seasonNumber,
      episode: e.episodeNumber,
      name: e.name || undefined,
      still: e.stillPath ? `https://image.tmdb.org/t/p/w300${e.stillPath}` : undefined,
      overview: e.overview || undefined,
      rating: e.voteAverage && e.voteAverage > 0 ? e.voteAverage : undefined,
      airDate: e.airDate || undefined,
      runtime: e.runtime && e.runtime > 0 ? e.runtime : undefined,
    }))
    .sort((a, b) => a.episode - b.episode);
  lruSet(tmdbSeasonCache, cacheKey, eps, SEASON_CACHE_MAX);
  return eps;
}

async function tmdbAdjacent(
  key: string,
  tvId: number,
  current: { season: number; episode: number },
): Promise<Adjacent> {
  const cur = await tmdbSeason(key, tvId, current.season);
  const idx = cur.findIndex((e) => e.episode === current.episode);
  let prev: PlayEpisode | null = null;
  let next: PlayEpisode | null = null;
  if (idx > 0) prev = cur[idx - 1];
  if (idx >= 0 && idx < cur.length - 1) next = cur[idx + 1];
  if (!prev && current.season > 1) {
    const before = await tmdbSeason(key, tvId, current.season - 1);
    if (before.length > 0) prev = before[before.length - 1];
  }
  if (!next) {
    const after = await tmdbSeason(key, tvId, current.season + 1);
    if (after.length > 0) next = after[0];
  }
  return { prev, next };
}
