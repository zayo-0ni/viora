/**
 * Thin client over the Cinemana (Shabakaty) Android API.
 *
 * Endpoint shapes were confirmed against the live service; the browse endpoint
 * intermittently answers 500 with an HTML maintenance page, so every response
 * is content-sniffed before parsing rather than trusted to be JSON.
 */

const BASE = "https://cinemana.shabakaty.com/api/android";

/** Cinemana's own `kind` discriminator. */
export const KIND_MOVIE = "1";
export const KIND_SERIES = "2";

export type CinemanaItem = {
  nb: string;
  en_title?: string;
  ar_title?: string;
  en_content?: string;
  ar_content?: string;
  year?: string;
  /** Seconds, as a stringified float. */
  duration?: string;
  /** IMDb-style score out of 10, as a string. */
  stars?: string;
  kind?: string;
  season?: string;
  episodeNummer?: string;
  /** "0" on a standalone item; otherwise the parent series id. */
  rootSeries?: string;
  imgObjUrl?: string;
  imgMediumThumbObjUrl?: string;
  imgThumbObjUrl?: string;
  /** e.g. https://www.imdb.com/title/tt5775220/ */
  imdbUrlRef?: string;
  trailer?: string;
  publishDate?: string;
  arTranslationFilePath?: string;
  enTranslationFilePath?: string;
  categories?: Array<{ en_title?: string; ar_title?: string } | string>;
};

export type CinemanaFile = {
  name?: string;
  resolution?: string;
  container?: string;
  videoUrl?: string;
  transcoddedFileName?: string;
};

export type CinemanaTranslation = {
  id?: number;
  /** "arabic", "english", … */
  name?: string;
  /** "ar", "en", "sp" */
  type?: string;
  /** "srt" or "vtt" — the same track is published in both. */
  extention?: string;
  file?: string;
};

export type CinemanaTranslationFiles = {
  arTranslationFilePath?: string;
  enTranslationFilePath?: string;
  spTranslationFilePath?: string;
  translations?: CinemanaTranslation[];
};

export class CinemanaUnavailableError extends Error {
  constructor(status: number) {
    super(`Cinemana returned ${status}`);
    this.name = "CinemanaUnavailableError";
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    },
  });
  const text = await res.text();
  const head = text.trimStart()[0];
  // The maintenance page is served with a 500 and an HTML body; JSON.parse on
  // that throws a syntax error that says nothing useful.
  if (head !== "[" && head !== "{") throw new CinemanaUnavailableError(res.status);
  return JSON.parse(text) as T;
}

export function browse(
  opts: { kind: string; page?: number; perPage?: number; sort?: string; level?: number },
  signal?: AbortSignal,
): Promise<CinemanaItem[]> {
  const perPage = opts.perPage ?? 30;
  const level = opts.level ?? 0;
  const sort = opts.sort ?? "desc";
  const page = opts.page ?? 1;
  return getJson<CinemanaItem[]>(
    `${BASE}/video/V/2/itemsPerPage/${perPage}/level/${level}/videoKind/${opts.kind}/sortParam/${sort}/pageNumber/${page}`,
    signal,
  );
}

/**
 * Title search, scoped to films or to series.
 *
 * `type` is a word, not the numeric `videoKind` the rest of the API uses —
 * "series" works, 2 silently returns films. That one mismatch is why the search
 * looked film-only for a long time: every numeric value is accepted and
 * ignored, so a wrong guess is indistinguishable from an unsupported feature.
 * Omitting it also yields films, so it is always sent explicitly.
 */
export function search(
  query: string,
  opts: { type: "movie" | "series"; page?: number; level?: number } = { type: "movie" },
  signal?: AbortSignal,
): Promise<CinemanaItem[]> {
  const params = new URLSearchParams({
    level: String(opts.level ?? 0),
    videoTitle: query,
    type: opts.type,
    page: String(opts.page ?? 0),
  });
  return getJson<CinemanaItem[]>(`${BASE}/AdvancedSearch?${params}`, signal);
}

export function videoInfo(id: string, signal?: AbortSignal): Promise<CinemanaItem> {
  return getJson<CinemanaItem>(`${BASE}/allVideoInfo/id/${id}`, signal);
}

/** Episodes of a series. Answers `[]` when given a standalone movie id. */
export function seasonEpisodes(rootId: string, signal?: AbortSignal): Promise<CinemanaItem[]> {
  return getJson<CinemanaItem[]>(`${BASE}/videoSeason/id/${rootId}`, signal);
}

/** Pre-transcoded renditions. URLs are signed and expire, so never cache them. */
export function transcodedFiles(id: string, signal?: AbortSignal): Promise<CinemanaFile[]> {
  return getJson<CinemanaFile[]>(`${BASE}/transcoddedFiles/id/${id}`, signal);
}

/**
 * The full subtitle list, which the video record does not carry.
 *
 * `allVideoInfo` exposes only `arTranslationFilePath` / `enTranslationFilePath`,
 * and fills the missing ones with the string `defaultImages/loading.gif` rather
 * than leaving them empty — a truthy value that reads as a real subtitle and
 * offers the viewer a track that resolves to an image. This endpoint returns a
 * proper list instead, with a language and a format per entry.
 */
export function translationFiles(
  id: string,
  signal?: AbortSignal,
): Promise<CinemanaTranslationFiles> {
  return getJson<CinemanaTranslationFiles>(`${BASE}/translationFiles/id/${id}`, signal);
}

export type CinemanaSkipRanges = { start?: string[]; end?: string[] };

/**
 * Time ranges Cinemana marks for skipping, as parallel start/end arrays.
 *
 * They are unlabelled, and the service's own website never calls this endpoint —
 * it belongs to their mobile app. What the shape of the data says: the ranges
 * sit in the middle of the runtime, never at the head or tail, run from one
 * second to a couple of minutes, and are numerous on an adult thriller and
 * nearly absent on a PG film. That is censorship marking, not chapters.
 */
export function skippingDurations(
  id: string,
  signal?: AbortSignal,
): Promise<CinemanaSkipRanges> {
  return getJson<CinemanaSkipRanges>(`${BASE}/skippingDurations/id/${id}`, signal);
}

/** Runtime in seconds, or null when the record does not carry one. */
export function durationSecondsOf(item: CinemanaItem): number | null {
  const secs = Number(item.duration);
  return Number.isFinite(secs) && secs > 0 ? secs : null;
}

/** True for the placeholder Cinemana substitutes when a track is absent. */
export function isRealSubtitleUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  return !/defaultImages\//i.test(url);
}

/** `https://www.imdb.com/title/tt123/` -> `tt123`. */
export function imdbIdFrom(item: CinemanaItem): string | null {
  const m = /\/title\/(tt\d+)/.exec(item.imdbUrlRef ?? "");
  return m ? m[1] : null;
}

export function isSeries(item: CinemanaItem): boolean {
  return String(item.kind) === KIND_SERIES;
}

/** The id that owns the episode list: the parent for episodes, self otherwise. */
export function rootIdOf(item: CinemanaItem): string {
  const root = item.rootSeries;
  return root && root !== "0" ? root : item.nb;
}

export function titleOf(item: CinemanaItem, arabic: boolean): string {
  const en = item.en_title?.trim();
  const ar = item.ar_title?.trim();
  return (arabic ? ar || en : en || ar) ?? "";
}

export function descriptionOf(item: CinemanaItem, arabic: boolean): string {
  const en = item.en_content?.trim();
  const ar = item.ar_content?.trim();
  return (arabic ? ar || en : en || ar) ?? "";
}

/**
 * The poster for a card in a row or a grid.
 *
 * The medium thumbnail first, not the full image. Measured on a 1080p
 * television: a poster occupies 151 CSS px, which at that panel's 2x density is
 * 302 device pixels, and Cinemana's `imgObjUrl` is 2000px wide — around forty
 * times the pixels the slot can show. Ninety-six such images were live on the
 * home screen at once, 75 megapixels of decoding for a screen that holds two,
 * and it landed in raster rather than script: style, layout and JavaScript
 * together came to 3.5% of the frame budget while the main thread was busy 20%.
 *
 * `imgObjUrl` stays as the last resort, because an item without a thumbnail
 * should still show something.
 */
export function posterOf(item: CinemanaItem): string | undefined {
  return item.imgMediumThumbObjUrl || item.imgThumbObjUrl || item.imgObjUrl || undefined;
}

/**
 * The full-width art behind a hero or a detail page, where the same file is the
 * right size rather than forty times it.
 */
export function backdropOf(item: CinemanaItem): string | undefined {
  return item.imgObjUrl || item.imgMediumThumbObjUrl || item.imgThumbObjUrl || undefined;
}

/**
 * `stars` is already an IMDb-style score out of 10 despite the field name —
 * Inception comes back as 8.8, not 4.4. Values above 10 are clamped rather than
 * trusted, since a bad record would otherwise render as a nonsense rating.
 */
export function ratingOf(item: CinemanaItem): string | undefined {
  const raw = Number(item.stars);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.min(raw, 10).toFixed(1);
}

export function runtimeOf(item: CinemanaItem): string | undefined {
  const secs = Number(item.duration);
  if (!Number.isFinite(secs) || secs <= 0) return undefined;
  return `${Math.round(secs / 60)} min`;
}
