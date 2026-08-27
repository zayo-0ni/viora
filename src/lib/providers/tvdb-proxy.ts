import { safeFetch } from "@/lib/safe-fetch";
import { FEATURES, backendUrl } from "@/lib/brand";

// TVDB requires a paid API key that has to stay server-side.
const PROXY = FEATURES.tvdbProxy ? backendUrl("/api/tvdb/images") : null;

export type TvdbImageMap = Record<string, string>;

export async function fetchTvdbProxyImages(opts: {
  imdb?: string | null;
  kitsuId?: number | null;
  type?: string;
}): Promise<TvdbImageMap> {
  // Same trap as viora-imdb: without this the null base becomes a relative URL
  // the app's own server answers, and the call costs a round trip to learn
  // nothing.
  if (!PROXY) return {};
  const series: number | null = null;
  const q = new URLSearchParams();
  if (series) q.set("series", String(series));
  else if (opts.imdb && opts.imdb.startsWith("tt")) q.set("imdb", opts.imdb);
  else return {};
  q.set("type", opts.type && opts.type !== "aired" ? opts.type : "default");
  try {
    const res = await safeFetch(`${PROXY}?${q.toString()}`);
    if (!res.ok) return {};
    const j = (await res.json()) as { images?: TvdbImageMap };
    return j?.images ?? {};
  } catch {
    return {};
  }
}

export function pickTvdbImage(
  map: TvdbImageMap,
  ep: {
    seasonNumber?: number;
    number: number;
    absoluteNumber?: number;
    imdbSeason?: number;
    imdbEpisode?: number;
  },
): string | null {
  const abs = ep.absoluteNumber ?? ep.number;
  return (
    map[`abs${abs}`] ??
    (ep.imdbSeason != null && ep.imdbEpisode != null
      ? map[`s${ep.imdbSeason}e${ep.imdbEpisode}`]
      : undefined) ??
    (ep.seasonNumber != null ? map[`s${ep.seasonNumber}e${ep.number}`] : undefined) ??
    null
  );
}
