import { useEffect, useState } from "react";

/**
 * False while a screen is still arriving, true once the browser has a moment.
 *
 * A title page fires 33 requests the instant it opens, measured on the device,
 * and most of them are not for the page you are looking at: ratings for the
 * twelve cards in "More Like This", two SPARQL queries to Wikidata for award
 * laurels, intro markers for a playback that has not started. On a fast link
 * they are invisible. On the owner's hotspot they queue in front of the
 * artwork, and the page waits behind its own enrichments.
 *
 * Nothing is cancelled — everything still loads, a moment later, once the work
 * of showing the screen is done. `requestIdleCallback` decides when that is,
 * with a timeout so a busy main thread cannot hold the extras forever.
 */
export function useAfterIdle(timeoutMs = 1200): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) setReady(true);
    };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    }).requestIdleCallback;
    if (typeof ric === "function") {
      const handle = ric(done, { timeout: timeoutMs });
      return () => {
        cancelled = true;
        (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
      };
    }
    const t = window.setTimeout(done, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [timeoutMs]);
  return ready;
}
