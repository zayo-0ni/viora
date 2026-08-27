import { getUiLanguage } from "@/lib/i18n/store";
import * as api from "./cinemana-api";
import type { CinemanaItem } from "./cinemana-api";
import { resolveToCinemanaId } from "./cinemana-resolve";
import type { LocalAddon } from "./types";

/**
 * Cinemana (Shabakaty) as a first-party Stremio addon.
 *
 * It speaks the ordinary addon protocol, so catalogs, meta, streams, subtitles,
 * scoring and the player all treat it exactly like an installed remote addon —
 * nothing downstream knows it runs in-process.
 *
 * Ids are namespaced `cnm:<nb>` so they cannot collide with `tt…` ids from
 * Cinemeta. Where Cinemana knows the IMDb id it is surfaced too, which lets the
 * rest of the app cross-reference the title with its other metadata providers.
 */

const ID_PREFIX = "cnm:";

function toStremioId(nb: string): string {
  return `${ID_PREFIX}${nb}`;
}

function fromStremioId(id: string): string | null {
  if (id.startsWith(ID_PREFIX)) return id.slice(ID_PREFIX.length);
  return null;
}

function arabicUi(): boolean {
  return getUiLanguage() === "ar";
}

function toMeta(item: CinemanaItem, arabic: boolean) {
  const imdb = api.imdbIdFrom(item);
  const series = api.isSeries(item);
  return {
    id: toStremioId(item.nb),
    type: series ? "series" : "movie",
    name: api.titleOf(item, arabic),
    poster: api.posterOf(item),
    background: api.backdropOf(item),
    posterShape: "poster",
    description: api.descriptionOf(item, arabic),
    releaseInfo: item.year || undefined,
    imdbRating: api.ratingOf(item),
    runtime: api.runtimeOf(item),
    imdb_id: imdb ?? undefined,
    genres: (item.categories ?? [])
      .map((c) => (typeof c === "string" ? c : arabic ? c.ar_title || c.en_title : c.en_title))
      .filter((g): g is string => !!g),
    trailers: item.trailer ? [{ source: item.trailer, type: "Trailer" }] : undefined,
  };
}

/**
 * A release-style filename, because the pipeline reads one.
 *
 * Cinemana names its files after the CDN object — `9C7F3304-…_video.mp4` — and
 * the stream parser is built for torrent releases, so it read that as the title
 * of the film. Every rendition then failed the check that a stream's title
 * matches the title being opened, and six perfectly good files were discarded as
 * belonging to some other film. Measured against the shipped pipeline: with the
 * GUID, 0 of 6 survive with `title-mismatch`; with this name, all of them do.
 *
 * Which language the name is built in is decided by who is asking. A `cnm:` id
 * is checked against Cinemana's own meta, which follows the interface language;
 * a `tt` id is checked against Cinemeta's, which is English. Writing the wrong
 * one is the same defect again in the other direction.
 */
function releaseFilename(item: CinemanaItem, file: api.CinemanaFile, arabic: boolean): string {
  const title = api
    .titleOf(item, arabic)
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const container = (file.container || "mp4").toLowerCase();
  const resolution = file.resolution ? ` ${file.resolution}` : "";
  if (api.isSeries(item)) {
    const season = Number(item.season) || 1;
    const episode = Number(item.episodeNummer);
    const tag =
      Number.isFinite(episode) && episode > 0
        ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
        : "";
    return `${title}${tag}${resolution}.${container}`;
  }
  const year = item.year ? ` (${item.year})` : "";
  return `${title}${year}${resolution}.${container}`;
}

/** Best-resolution-first, so the player's default pick is the good one. */
function resolutionRank(file: api.CinemanaFile): number {
  const n = parseInt(String(file.resolution ?? file.name ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

const SUBTITLE_LANGS: Record<string, string> = { ar: "ara", en: "eng", sp: "spa" };

/**
 * Subtitles, read from the dedicated endpoint rather than off the video record.
 *
 * The record carries only two paths and, when a language is missing, sets it to
 * `defaultImages/loading.gif` instead of leaving it blank. Trusting that put an
 * "English" track on films that have none, pointing at an image. The endpoint
 * returns a real list, so absence is expressed by absence.
 *
 * Each track is published as both .srt and .vtt; VTT is preferred because the
 * HTML5 engine — the one that plays these streams on Android — renders it
 * natively without a conversion step.
 */
async function subtitlesFor(nb: string, arabic: boolean, signal?: AbortSignal) {
  const data = await api.translationFiles(nb, signal).catch(() => null);
  if (!data) return [];

  const best = new Map<string, { url: string; vtt: boolean }>();
  for (const entry of data.translations ?? []) {
    const lang = SUBTITLE_LANGS[String(entry.type ?? "").toLowerCase()];
    if (!lang || !api.isRealSubtitleUrl(entry.file)) continue;
    const vtt = String(entry.extention ?? "").toLowerCase() === "vtt";
    const current = best.get(lang);
    if (!current || (vtt && !current.vtt)) best.set(lang, { url: entry.file as string, vtt });
  }

  // Older records answer with the two flat paths and no list at all.
  if (best.size === 0) {
    for (const [lang, url] of [
      ["ara", data.arTranslationFilePath],
      ["eng", data.enTranslationFilePath],
      ["spa", data.spTranslationFilePath],
    ] as const) {
      if (api.isRealSubtitleUrl(url)) best.set(lang, { url: url as string, vtt: false });
    }
  }

  const subs = [...best].map(([lang, v]) => ({ id: `cnm-${lang}`, url: v.url, lang }));
  // The viewer's language first, so the player's auto-select lands on it.
  subs.sort((a, b) => {
    const preferred = arabic ? "ara" : "eng";
    return (a.lang === preferred ? -1 : 0) - (b.lang === preferred ? -1 : 0);
  });
  return subs;
}

export const cinemanaAddon: LocalAddon = {
  name: "cinemana",

  manifest: {
    id: "community.cinemana",
    name: "Cinemana",
    version: "1.0.0",
    description:
      "Movies and series from Cinemana (Shabakaty), with Arabic and English subtitles. Streams play directly over HTTP — no torrent or debrid account needed.",
    logo: "https://cinemana.shabakaty.com/favicon.ico",
    types: ["movie", "series"],
    idPrefixes: [ID_PREFIX],
    resources: [
      { name: "catalog", types: ["movie", "series"] },
      { name: "meta", types: ["movie", "series"], idPrefixes: [ID_PREFIX] },
      // `tt` alongside its own prefix is what makes Cinemana a source for the
      // whole library rather than only for its own catalogue rows. The stream
      // pipeline reads these per-resource prefixes to decide who to ask, so
      // without `tt` here it was never queried for a title opened from Cinemeta.
      //
      // Meta stays `cnm:` only on purpose: Cinemana should supply streams for
      // another provider's title, not claim to describe it.
      { name: "stream", types: ["movie", "series"], idPrefixes: [ID_PREFIX, "tt"] },
      { name: "subtitles", types: ["movie", "series"], idPrefixes: [ID_PREFIX, "tt"] },
    ],
    catalogs: [
      {
        id: "cinemana-movies",
        type: "movie",
        name: "Cinemana Movies",
        extra: [{ name: "skip" }, { name: "search" }],
      },
      {
        id: "cinemana-series",
        type: "series",
        name: "Cinemana Series",
        extra: [{ name: "skip" }, { name: "search" }],
      },
    ],
    behaviorHints: { adult: false, p2p: false, configurable: false },
  },

  async catalog({ type, extra, signal }) {
    const arabic = arabicUi();
    const query = extra?.search?.trim();
    const kind = type === "series" ? api.KIND_SERIES : api.KIND_MOVIE;

    if (query) {
      const wantSeries = type === "series";
      const results = await api.search(
        query,
        { type: wantSeries ? "series" : "movie" },
        signal,
      );
      return {
        metas: results
          .filter((it) => api.isSeries(it) === wantSeries)
          .map((it) => toMeta(it, arabic)),
      };
    }

    // `skip` counts items; Cinemana pages by number and is 1-based.
    const perPage = 30;
    const skip = Number(extra?.skip ?? 0);
    const page = Math.floor((Number.isFinite(skip) ? skip : 0) / perPage) + 1;
    const items = await api.browse({ kind, page, perPage }, signal);
    return { metas: items.map((it) => toMeta(it, arabic)) };
  },

  async meta({ id, signal }) {
    const nb = fromStremioId(id);
    if (!nb) return { meta: null };
    const arabic = arabicUi();
    const item = await api.videoInfo(nb, signal);
    const meta = toMeta(item, arabic) as ReturnType<typeof toMeta> & {
      videos?: Array<Record<string, unknown>>;
    };

    if (api.isSeries(item)) {
      const episodes = await api.seasonEpisodes(api.rootIdOf(item), signal).catch(() => []);
      const seriesTitle = api.titleOf(item, arabic);
      meta.videos = episodes.map((ep) => {
        const season = Number(ep.season) || 1;
        const number = Number(ep.episodeNummer) || 0;
        // Cinemana repeats the series title on every episode, which would give
        // an episode list where each row reads the same. Fall back to the
        // number whenever the title carries no episode-specific information.
        const raw = api.titleOf(ep, arabic);
        const label = raw && raw !== seriesTitle ? raw : `Episode ${number}`;
        return {
          id: toStremioId(ep.nb),
          season,
          episode: number,
          number,
          title: label,
          name: label,
          released: ep.publishDate || undefined,
          thumbnail: api.posterOf(ep) ?? api.posterOf(item),
          overview: api.descriptionOf(ep, arabic),
        };
      });
    }
    return { meta };
  },

  async stream({ id, signal }) {
    const nb = await resolveToCinemanaId(id, signal);
    if (!nb) return { streams: [] };
    const arabic = arabicUi();
    // The record is fetched for its title: the files carry only CDN object
    // names, and a stream that cannot say which film it belongs to is thrown
    // away downstream. Not caught, for the same reason nothing else here is —
    // a failed lookup must not be dressed up as an answer.
    const [files, subtitles, item] = await Promise.all([
      api.transcodedFiles(nb, signal),
      subtitlesFor(nb, arabic, signal),
      api.videoInfo(nb, signal),
    ]);
    const nameArabic = id.startsWith(ID_PREFIX) ? arabic : false;

    const streams = files
      .filter((f) => !!f.videoUrl)
      .sort((a, b) => resolutionRank(b) - resolutionRank(a))
      .map((f) => {
        const label = f.resolution || f.name || "auto";
        return {
          name: "Cinemana",
          title: `${label}${f.container ? ` · ${f.container.toUpperCase()}` : ""}`,
          url: f.videoUrl,
          subtitles: subtitles.length ? subtitles : undefined,
          behaviorHints: {
            // Pre-transcoded MP4 over HTTP: the HTML5 engine plays it directly,
            // which is what makes this source work on Android where mpv is absent.
            notWebReady: false,
            bingeGroup: `cinemana-${label}`,
            filename: releaseFilename(item, f, nameArabic),
          },
        };
      });
    return { streams };
  },

  async subtitles({ id, signal }) {
    const nb = await resolveToCinemanaId(id, signal);
    if (!nb) return { subtitles: [] };
    return { subtitles: await subtitlesFor(nb, arabicUi(), signal) };
  },
};
