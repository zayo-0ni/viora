import { useMemo } from "react";
import { Clock, Search as SearchIcon } from "lucide-react";
import { FocusButton, FocusSection } from "@/lib/tv-focus";
import { useT } from "@/lib/i18n";
import { useSearch } from "@/lib/search-context";

/**
 * The column of guesses under the keyboard.
 *
 * Typing a title one letter at a time with a D-pad is slow enough that the point
 * is to stop early: three letters and the thing you wanted is already in the
 * list, one press away. So the list carries the viewer's own past searches while
 * the box is empty, and titles matching what they have typed once it is not —
 * the two things most likely to end the typing.
 *
 * The past searches come from the search context, which is the store the app
 * already writes to when a query is actually used. This file used to keep a
 * second one of its own, and the result was the predictable one: the list read
 * the store nothing wrote to, so "recent" was permanently empty while the real
 * history filled up next to it.
 */

type ResultsShape = {
  movies?: { name?: string }[];
  series?: { name?: string }[];
  anime?: { name?: string }[];
  people?: { name?: string }[];
} | null;

export function SearchSuggestions({
  query,
  results,
  onPick,
  focusKey,
}: {
  query: string;
  results: ResultsShape;
  onPick: (value: string) => void;
  focusKey?: string;
}) {
  const t = useT();
  const { recent } = useSearch();

  const titles = useMemo(() => {
    if (!query || !results) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const group of [results.movies, results.series, results.anime, results.people]) {
      for (const item of group ?? []) {
        const name = item?.name?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(name);
        if (out.length >= 8) return out;
      }
    }
    return out;
  }, [query, results]);

  const items = query ? titles : recent;
  if (items.length === 0) return null;

  return (
    <FocusSection
      focusKey={focusKey}
      rememberChild={false}
      /* Room for the ring inside the scroller.
         The rows sat flush against the edges of an `overflow-y-auto` column, so
         the focus outline on the first and last of them was cut off by the
         clip — the highlight appeared as three sides of a rectangle. The
         padding is the width of the ring, and the scroll margin keeps the row
         from being scrolled to an edge that would clip it again. */
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-2 pb-8 scroll-py-8 [scrollbar-width:none] [&>*]:scroll-my-4 [&::-webkit-scrollbar]:hidden"
      aria-label={query ? t("Suggestions") : t("Recent searches")}
    >
      {items.map((item) => (
        <FocusButton
          key={item}
          /* The row brings itself inside before it is ringed.
             The last suggestion settled 20px below the bottom of its own column,
             so its frame was cut in half. Padding could not reach it: the
             column was sitting at 130 of a possible 182 and was simply never
             asked to scroll. */
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: "nearest" })}
          onClick={() => onPick(item)}
          className="flex items-center gap-2.5 rounded-md px-2 py-2 text-start text-[14px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          {query ? (
            <SearchIcon size={13} strokeWidth={2} className="shrink-0 text-ink-subtle" />
          ) : (
            <Clock size={13} strokeWidth={2} className="shrink-0 text-ink-subtle" />
          )}
          <span dir="auto" className="truncate">{item}</span>
        </FocusButton>
      ))}
    </FocusSection>
  );
}
