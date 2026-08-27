import { useMemo } from "react";
import { FocusButton, FocusSection } from "@/lib/tv-focus";
import type { Meta } from "@/lib/cinemeta";
import { type SearchResults } from "@/lib/search";
import { dedupeByTitle, rankMetas } from "@/lib/search-rank";
import { useView } from "@/lib/view";
import { ResultPoster } from "./result-poster";

/**
 * Search results as a wall of posters.
 *
 * The desktop overlay lists results: a row per title, poster thumbnail on the
 * left, description alongside. That reads well under a pointer and badly from
 * three metres away, where the description is unreadable anyway and the eye is
 * looking for artwork it recognises. Every TV app answers a search with a grid
 * for that reason, and this is the same grid the rest of the app already uses
 * for a catalogue.
 *
 * It also fixes the focus ring by construction. The row was as wide as the
 * column, so the 4px outline drawn around it ran off both sides of the screen
 * and read as two orange lines floating between results rather than as a frame
 * around the thing that has focus. A poster is a box the ring can fit around.
 *
 * Films, series and anime share one grid rather than three, because the ranking
 * is what the viewer is reading — typing `spi` should put Spider-Man first
 * whatever kind of thing it turns out to be.
 */
export function ResultGrid({
  results,
  query,
  onClose,
  excludeId,
}: {
  results: SearchResults;
  query: string;
  onClose: () => void;
  /** The title already shown as the top match, so it is not offered twice. */
  excludeId?: string;
}) {
  const { openMeta } = useView();

  const items = useMemo(() => {
    const all: Meta[] = [...results.movies, ...results.series];
    const seen = new Set<string>(excludeId ? [excludeId] : []);
    const unique = all.filter((m) => {
      if (!m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    // By title as well as by id: the films and the series arrive as separate
    // lists from separate sources, so the same title can reach the grid under
    // two different identifiers.
    return dedupeByTitle(rankMetas(unique, query));
  }, [results.movies, results.series, query, excludeId]);

  if (items.length === 0) return null;

  return (
    /* The results are one region, so a press inside them resolves among them.

       Measured on the emulator: pressing right on the first card jumped up to
       the Top match panel instead of moving to the second card. The panel is
       866px wide and 326 tall, and while the column scrolls it shares vertical
       ground with the row beneath it — so to an engine comparing boxes it was a
       neighbour to the right of a 161px card. Naming the grid keeps the
       comparison between cards. */
    <FocusSection className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-6 px-3 pt-5 pb-12">
      {items.map((meta) => (
        <FocusButton
          key={meta.id}
          /* Bring the card fully inside before the ring is drawn on it.

             The last row settled 20px below the bottom of the scrolling column,
             so the frame around it was cut in half — and pressing down did not
             move, because there was nowhere further to go. Measured on the
             emulator: the column sat at 130 of a possible 182, and asking for
             the nearest reveal took it to 182 and left 32px of clearance. So
             the scroller was willing; it was simply never asked. */
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: "nearest" })}
          onClick={() => {
            // Closing first: opening the title behind an overlay that is still
            // up leaves the viewer looking at the search screen with no way to
            // tell anything happened.
            onClose();
            openMeta(meta);
          }}
          className="flex w-full min-w-0 flex-col gap-2 text-start"
        >
          <ResultPoster id={meta.id} poster={meta.poster} className="w-full" />
          <span className="line-clamp-2 min-h-9 text-[13px] font-medium leading-snug text-ink" dir="auto">
            {meta.name}
          </span>
        </FocusButton>
      ))}
    </FocusSection>
  );
}
