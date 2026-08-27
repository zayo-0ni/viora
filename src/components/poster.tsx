import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CellArtNearContext, CellIsUpFrontContext } from "@/components/row";
import { needsImdbForPoster, needsTmdbForPoster, rpdbPoster } from "@/lib/providers/rpdb";
import {
  tmdbIdFromImdb,
  tmdbImdbId,
  useTmdbIdFromImdb,
  useTmdbImdbId,
} from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { useSettings } from "@/lib/settings";
import { tmdbLocalizedPoster } from "@/lib/providers/tmdb/tmdb-images";
import { shouldLocalizePosters } from "@/lib/providers/tmdb/tmdb-image-lang";

type Ratio = "portrait" | "landscape" | "wide";

export function useLocalizedPoster(metaId: string): string | undefined {
  const { settings } = useSettings();
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUrl(undefined);
    if (!settings.tmdbKey || !metaId.startsWith("tmdb:") || !shouldLocalizePosters()) return;
    let alive = true;
    void tmdbLocalizedPoster(settings.tmdbKey, metaId).then((u) => {
      if (alive && u) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [metaId, settings.tmdbKey]);
  return url;
}

export function useRpdbAltId(
  rpdbKey: string,
  metaId: string,
  type?: "movie" | "series",
): { altId: string | undefined; pending: boolean } {
  const { settings } = useSettings();
  const wantImdb = needsImdbForPoster(rpdbKey, metaId);
  const wantTmdb = needsTmdbForPoster(rpdbKey, metaId);
  const imdb = useTmdbImdbId(wantImdb ? metaId : undefined);
  const tmdb = useTmdbIdFromImdb(wantTmdb ? metaId : undefined);
  useEffect(() => {
    if (wantImdb && settings.tmdbKey) void tmdbImdbId(settings.tmdbKey, metaId);
    if (wantTmdb && settings.tmdbKey) void tmdbIdFromImdb(settings.tmdbKey, metaId, type);
  }, [wantImdb, wantTmdb, settings.tmdbKey, metaId, type]);
  const pending =
    !!settings.tmdbKey && ((wantImdb && imdb === undefined) || (wantTmdb && tmdb === undefined));
  let altId: string | undefined;
  if (wantImdb && typeof imdb === "string" && imdb.startsWith("tt")) altId = imdb;
  else if (wantTmdb && typeof tmdb === "string") altId = tmdb;
  return { altId, pending };
}


export function usePosterChain(
  rpdbKey: string,
  metaId: string,
  metaPoster?: string,
  type?: "movie" | "series",
) {
  const { altId, pending } = useRpdbAltId(rpdbKey, metaId, type);
  const localized = useLocalizedPoster(metaId);
  const candidates = useMemo(() => {
    if (pending) return [];
    const base = localized ?? metaPoster;
    const out: string[] = [];
    const seen = new Set<string>();
    for (const u of [
      rpdbPoster(rpdbKey, metaId, base, altId),
      localized,
      metaPoster,
    ]) {
      if (u && !seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
    return out;
  }, [rpdbKey, metaId, altId, metaPoster, localized, pending]);
  const sig = candidates.join("|");
  const failedRef = useRef<Set<string>>(new Set());
  const sigRef = useRef(sig);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  if (sigRef.current !== sig) {
    sigRef.current = sig;
    failedRef.current = new Set();
  }
  const src = candidates.find((u) => !failedRef.current.has(u));
  return {
    src,
    onError: () => {
      if (src && !failedRef.current.has(src)) {
        failedRef.current.add(src);
        bump();
      }
    },
  };
}

// Height is reserved with an in-flow padding spacer (see render below) instead of
// relying solely on CSS `aspect-ratio`. Older WebView2/Chromium engines (≲124, e.g.
// the 123.x runtime shipped on debloated Windows builds) fail to size `aspect-ratio`
// grid items, collapsing every poster card to 0px height so artwork never shows.
// The padding-top hack works identically on every engine.
// Upstream issue 403: poster aspect-ratio fallback.
// Ask each service for a picture the size of a card, not the size it happens to
// offer.
//
// Measured on the television, on one details screen: 94 images arriving 780
// pixels wide to be drawn at 110, and four arriving at 2880 to be drawn at 320.
// Nothing is gained by any of it — the panel renders at 1080p and a card is a
// couple of hundred device pixels across — but every one of those pixels is
// downloaded over the viewer's connection and decoded on a four-core box before
// the card can appear.
//
// This is safe to do here because nothing large is built from this component:
// the heroes, the backdrop and the gallery all render their own images and pick
// their own sizes, and each of them upgrades deliberately. A card asking for a
// card-sized picture cannot make any of those softer.
//
// The numbers: a portrait card is drawn about 132 CSS pixels wide, so 264 real
// ones, and w342 covers that with room to spare. A landscape card is drawn
// about 110, so 220, and w300 covers it. Both are a step or two below what was
// being asked for and still above what is actually painted.
function cardSized(url: string, ratio: Ratio): string {
  const wanted = ratio === "portrait" ? "w342" : "w300";
  let out = url.replace(/\/t\/p\/(original|w1280|w780|w500)\//, `/t/p/${wanted}/`);
  // Metahub publishes the same artwork at two sizes and the smaller one is
  // already the right size for a card.
  out = out.replace("/poster/medium/", "/poster/small/");
  // Backgrounds and logos were never named here, and they are the expensive
  // ones. Measured on the device: a Continue Watching card drew a Metahub
  // background at 645x363 device pixels while decoding it at 1920x1080 — nine
  // times the pixels it shows — and its logo at 800x310 for a strip a third
  // that size. A card is never a hero, so the hero's own ratio is left out of
  // this: only a poster or a 16:9 tile gets the smaller artwork.
  if (ratio !== "wide") {
    out = out.replace("/background/medium/", "/background/small/");
    out = out.replace("/logo/medium/", "/logo/small/");
  }
  return out;
}

const ASPECT_PAD: Record<Ratio, string> = {
  portrait: "150%", // 3 / 2
  landscape: "56.25%", // 9 / 16
  wide: "43.75%", // 7 / 16
};

export function Poster({
  src,
  seed,
  ratio = "portrait",
  className = "",
  children,
  onError,
  // Left off, and it has to stay off until someone works out why.
  //
  // Turning it on looked like the obvious win — fifty-five places build a
  // Poster and none of them asked for it, so every poster in the application is
  // fetched the moment it enters the page. But the engine's own lazy loading
  // does not fire for images inside the row track. Measured in the preview at
  // 1280x720: seven posters sitting plainly on screen, `loading="lazy"`,
  // `complete` still false sixteen seconds later. The same element with the
  // same URL switched to `eager` decoded at once, so it is neither the network
  // nor the host. Something about the track — a nested scroller carrying
  // `contain: layout style` — keeps those images out of whatever the engine
  // uses to decide.
  //
  // What works in this layout is the observer the rows already run themselves,
  // which is where the gating belongs.
  lazy = false,
  fallbacks,
}: {
  src?: string;
  seed: string;
  lowResImdb?: string;
  ratio?: Ratio;
  className?: string;
  children?: React.ReactNode;
  onError?: () => void;
  lazy?: boolean;
  fallbacks?: Array<string | null | undefined>;
}) {
  const { settings } = useSettings();
  const upFront = useContext(CellIsUpFrontContext);
  // Far from the viewport, the card keeps everything except its picture. The
  // plate underneath is what it already shows before the artwork arrives, so
  // there is nothing new to look at — and nothing decoded for a card that is
  // one and a half screens away.
  const artNear = useContext(CellArtNearContext);
  const effect = settings.posterEffect;
  const candidates = [src, ...(fallbacks ?? [])]
    .filter((u): u is string => !!u)
    .map((u) => cardSized(u, ratio));
  const sig = candidates.join("|");
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [displayed, setDisplayed] = useState<string | undefined>(undefined);
  const [retry, setRetry] = useState(0);
  const failedRef = useRef<Set<string>>(new Set());
  const firedRef = useRef(false);
  const failBurstRef = useRef<{ t: number; n: number }>({ t: 0, n: 0 });
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    setIdx(0);
    setLoaded(false);
    setRetry(0);
    failedRef.current = new Set();
    firedRef.current = false;
  }, [sig]);

  let cursor = idx;
  while (cursor < candidates.length && failedRef.current.has(candidates[cursor])) cursor++;
  const current: string | undefined = candidates[cursor];
  const exhausted = candidates.length > 0 && cursor >= candidates.length;

  useEffect(() => {
    if (exhausted && !firedRef.current) {
      firedRef.current = true;
      onErrorRef.current?.();
    }
  }, [exhausted]);

  useEffect(() => {
    if (!exhausted) return;
    const retryNow = () => {
      failedRef.current = new Set();
      firedRef.current = false;
      setIdx(0);
      setRetry((r) => r + 1);
    };
    window.addEventListener("online", retryNow);
    const timer = retry < 4 ? window.setTimeout(retryNow, 1200 * 2 ** retry) : undefined;
    return () => {
      window.removeEventListener("online", retryNow);
      if (timer) window.clearTimeout(timer);
    };
  }, [exhausted, retry]);

  const fail = useCallback((url: string) => {
    const now = Date.now();
    const b = failBurstRef.current;
    if (now - b.t > 1000) {
      b.t = now;
      b.n = 0;
    }
    if (++b.n > 24) return;
    if (failedRef.current.has(url)) return;
    failedRef.current.add(url);
    setLoaded(false);
    setIdx((i) => i + 1);
  }, []);
  const currentRef = useRef(current);
  currentRef.current = current;
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const handleImgRef = useCallback(
    (el: HTMLImageElement | null) => {
      imgElRef.current = el;
      if (!el || !el.complete) return;
      if (el.naturalWidth > 0) {
        setLoaded(true);
        setDisplayed(currentRef.current);
      } else if (currentRef.current) fail(currentRef.current);
    },
    [fail],
  );
  useEffect(() => {
    if (loaded || !current) return;
    const el = imgElRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
      setDisplayed(current);
    }
  }, [loaded, current, sig]);
  // The plate also stands in while the picture is released, so a card that has
  // scrolled far away shows the same coloured ground it shows before its
  // artwork has arrived — never an empty hole.
  const showPlate = !artNear || (!displayed && (!current || !loaded));
  const hue = hash(seed) % 360;

  return (
    <div
      /* Every card's frame, decided once.

         This block is the artwork — the picture and its badges, with the title
         a sibling below. Marking it here is what lets the ring belong to the
         poster rather than to the padded cell around it, and here rather than in
         each card because the cards that were missed are exactly the ones that
         went wrong: counted across the app, four card types said where their
         artwork was and thirty-three did not. A card that wraps this in a block
         of its own still wins — the outermost mark is the one that rings. */
      data-preview-anchor
      className={`viora-poster your-card relative w-full overflow-hidden rounded-[var(--poster-radius,12px)] ${className}`}
      style={showPlate ? { background: gradient(hue) } : undefined}
    >
      <div aria-hidden style={{ paddingTop: ASPECT_PAD[ratio] }} />
      {artNear && displayed && displayed !== current && (
        <img
          src={displayed}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {artNear && current && (
        <img
          key={current}
          ref={handleImgRef}
          src={current}
          alt=""
          decoding="async"
          // Raise what the viewer is looking at; never lower anything else.
          //
          // "low" was a mistake and the owner caught it: the engine does not
          // treat it as a mild preference but holds those requests back hard
          // while the connection is busy, so cards past the first few in a row
          // sat empty until the highlight reached them — at which point the row
          // became the front one, the hint flipped, and the artwork appeared at
          // once. That is a card with no picture until you look at it, which is
          // worse than no hint at all.
          //
          // "auto" leaves the engine's own judgement in place, and it already
          // knows what is off screen. Only the row being looked at overrides it.
          fetchPriority={upFront ? "high" : "auto"}
          loading={lazy ? "lazy" : undefined}
          onLoad={() => {
            setLoaded(true);
            setDisplayed(current);
          }}
          onError={() => fail(current)}
          className="absolute inset-0 h-full w-full object-cover"
          style={
            effect === "off"
              ? { opacity: 1 }
              : { opacity: loaded ? 1 : 0, transition: "opacity 300ms ease-out" }
          }
        />
      )}
      {children}
    </div>
  );
}

export function posterPlate(seed: string): string {
  return gradient(hash(seed) % 360);
}

function gradient(hue: number) {
  const a = hue;
  const b = (hue + 140) % 360;
  const c = (hue + 60) % 360;
  return `
    radial-gradient(ellipse at 25% 30%, oklch(0.45 0.14 ${a}) 0%, transparent 55%),
    radial-gradient(ellipse at 75% 75%, oklch(0.32 0.10 ${b}) 0%, transparent 55%),
    linear-gradient(135deg, oklch(0.20 0.05 ${c}), oklch(0.10 0.02 ${b}))
  `;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}
