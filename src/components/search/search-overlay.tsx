import { FocusButton, FocusModal, FocusSection } from "@/lib/tv-focus";
import { isDpadPrimary } from "@/lib/platform";
import { TvKeyboard } from "./tv-keyboard";
import { SearchSuggestions } from "./search-suggestions";
import { ResultGrid } from "./result-grid";
import { Search, X, Loader2, CornerDownLeft, CalendarRange, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { useSearch } from "@/lib/search-context";
import { useView } from "@/lib/view";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { EmptyState } from "./empty-state";
import { GuideModal } from "./guide-modal";
import { LiveTvRow } from "./live-tv-row";
import { PeopleRow } from "./people-row";
import { MetaList } from "./meta-list";
import { AddonHits } from "./addon-hits";
import { AddonResults } from "./addon-results";
import { MagnetCard } from "./magnet-card";
import { UrlCard } from "./url-card";
import { WebSearchButton } from "./web-search-button";
import { isMagnetInput, isDirectVideoUrl } from "@/lib/torrent/magnet";

export function SearchOverlay() {
  const { open, setOpen, query, setQuery, results, status, clear, recordRecent } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const { openFilter, openMeta } = useView();
  const t = useT();
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const close = () => {
    if (query.trim() && results) recordRecent(query);
    setOpen(false);
  };

  const onIntent = () => {
    const intent = results?.intent;
    if (!intent) return;
    if (intent.kind === "genre") {
      const id = (intent.mediaType === "movie" ? MOVIE_GENRES : TV_GENRES)[intent.genre];
      if (typeof id === "number") {
        recordRecent(query);
        openFilter({ kind: "genre", mediaType: intent.mediaType, name: intent.genre, id });
        setOpen(false);
      }
      return;
    }
    if (intent.kind === "year") {
      recordRecent(query);
      openFilter({ kind: "year", mediaType: "movie", value: intent.year });
      setOpen(false);
    }
  };

  const trimmed = query.trim();
  const magnetInput = !!trimmed && isMagnetInput(trimmed);
  const urlInput = !!trimmed && !magnetInput && isDirectVideoUrl(trimmed);
  const directInput = magnetInput || urlInput;
  const hasResults = !!(
    results &&
    trimmed &&
    (results.topMatch ||
      results.people.length ||
      results.movies.length ||
      results.series.length ||
      results.liveTv.length ||
      results.addons.length ||
      results.addonGroups.length)
  );
  const noResults = !!(
    results &&
    trimmed &&
    status === "done" &&
    !results.topMatch &&
    results.people.length === 0 &&
    results.movies.length === 0 &&
    results.series.length === 0 &&
    results.liveTv.length === 0 &&
    results.addons.length === 0 &&
    results.addonGroups.length === 0
  );

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col" role="dialog" aria-modal="true" aria-label={t("Search")}>
      <FocusButton
        aria-label={t("Close search")}
        onClick={close}
        data-tauri-drag-region
        className="viora-search-backdrop absolute inset-0 cursor-default"
      />

      {isDpadPrimary() ? (
        /*
          A different screen, not the desktop one with a keyboard bolted on.

          The desktop overlay is built around a text field, with shortcut and
          genre chips filling the space while it is empty. All of that is useful
          with a pointer and noise with a remote, where the same space has to
          carry the only way to type. So the TV gets the layout every TV app
          converged on: typing on the left, what you typed and what it found on
          the right.

          It is also a dialog, declared rather than merely looking like one: the
          remote must not walk out of it onto the page behind, Back must close it
          before the screen underneath reads Back as "go back a view", and
          something inside it has to take focus — the overlay covers the screen,
          so whatever still holds focus underneath is a control the viewer cannot
          see.
        */
        <FocusModal onClose={close} className="relative flex h-full w-full gap-8 px-10 py-8">
          <div className="flex w-[300px] shrink-0 flex-col gap-4">
            <TvKeyboard
              focusKey="SEARCH_KEYBOARD"
              primary
              onKey={(ch) => setQuery(query + ch)}
              onSpace={() => setQuery(query + " ")}
              onBackspace={() => setQuery(query.slice(0, -1))}
            />
            <SearchSuggestions query={trimmed} results={results} onPick={(s) => setQuery(s)} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="mb-4 shrink-0 text-[26px] font-semibold tracking-tight text-ink" dir="auto">
              {trimmed || t("Search")}
            </h2>
            {trimmed && !directInput && hasResults && results ? (
              // Declared as the scrolling container rather than left as a plain
              // div: the reveal that walks up the DOM only runs once a control
              // is already off screen, which is too late for a grid whose next
              // row is clipped by this column while still inside the window.
              <FocusSection
                scrolls
                className="min-h-0 flex-1 overflow-y-auto scroll-pt-3 scroll-pb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <div className="flex flex-col gap-8">
                  <LiveTvRow items={results.liveTv} onClose={close} />
                  <PeopleRow people={results.people} onClose={close} />
                  <ResultGrid
                    results={results}
                    query={trimmed}
                    onClose={close}
                  />
                  <AddonResults groups={results.addonGroups} onClose={close} />
                </div>
              </FocusSection>
            ) : (
              <p className="flex-1 pt-10 text-[15px] text-ink-subtle">
                {trimmed ? t("Looking…") : t("Start typing to search.")}
              </p>
            )}
          </div>
        </FocusModal>
      ) : (
      <div
        data-tauri-drag-region
        className="relative mx-auto flex h-full w-full max-w-[1080px] flex-col px-6 py-6 sm:px-10 sm:py-10"
      >
        <div
          className="modal-panel relative flex shrink-0 items-center gap-3 rounded-2xl border border-edge-soft/80 bg-elevated/70 px-5 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.7)] transition-colors"
        >
          <Search
            size={22}
            className="shrink-0 text-ink-muted transition-colors"
            strokeWidth={1.9}
          />
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const first = results?.movies[0] ?? results?.series[0] ?? null;
                if (first) {
                  e.preventDefault();
                  recordRecent(query);
                  setOpen(false);
                  openMeta(first);
                }
              }}
              placeholder={t("Search movies, shows, people, genres, years...")}
              className="h-16 w-full bg-transparent text-[20px] text-ink placeholder:text-ink-subtle focus:outline-none sm:text-[22px]"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          {status === "loading" && <Loader2 size={18} className="shrink-0 animate-spin text-ink-subtle" />}
          <Hint />
          <WebSearchButton />
          {query && (
            <FocusButton
              type="button"
              aria-label={t("Clear")}
              onClick={clear}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            >
              <X size={18} strokeWidth={2.2} />
            </FocusButton>
          )}
        </div>

        <div className="relative mt-6 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!trimmed && <EmptyState onClose={close} onOpenGuide={() => setGuideOpen(true)} />}

          {magnetInput && (
            <div className="mb-5">
              <MagnetCard raw={trimmed} onClose={close} />
            </div>
          )}

          {urlInput && (
            <div className="mb-5">
              <UrlCard raw={trimmed} onClose={close} />
            </div>
          )}

          {trimmed && !directInput && results?.intent && (
            <FocusButton
              onClick={onIntent}
              className="mb-5 flex h-14 w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-5 text-start transition-colors hover:bg-accent/15"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-accent">
                {results.intent.kind === "year" ? (
                  <CalendarRange size={16} strokeWidth={2.1} />
                ) : (
                  <Tag size={16} strokeWidth={2.1} />
                )}
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                  {t("Browse")}
                </span>
                <span className="text-[15px] font-semibold text-ink">{results.intent.label}</span>
              </span>
              <CornerDownLeft size={15} className="ms-auto text-ink-subtle" />
            </FocusButton>
          )}

          {trimmed && !directInput && hasResults && results && (
            <div className="flex flex-col gap-8 pb-12">
              <LiveTvRow items={results.liveTv} onClose={close} />
              <AddonHits hits={results.addons} onClose={close} />
              <PeopleRow people={results.people} onClose={close} />
              <div className="grid gap-8 lg:grid-cols-2">
                <MetaList title={t("Movies")} items={results.movies} onClose={close} />
                <MetaList title={t("Series")} items={results.series} onClose={close} />
              </div>
              <AddonResults groups={results.addonGroups} onClose={close} />
            </div>
          )}

          {noResults && !directInput && (
            <div className="flex flex-col items-center gap-3 pt-16 text-center">
              <span className="text-[17px] font-semibold text-ink">{t("No matches for \"{query}\"", { query: trimmed })}</span>
              <span className="max-w-[44ch] text-[14px] text-ink-muted">
                {t("Try a different spelling, a person's name, a year like \"1972\", or a genre like \"Horror\".")}
              </span>
            </div>
          )}

          {trimmed && !directInput && !results && status !== "done" && (
            <div className="flex flex-col items-center gap-3 pt-16 text-ink-muted">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-[13.5px]">{t("Looking…")}</span>
            </div>
          )}
        </div>
      </div>
      )}
      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    </div>,
    document.body,
  );
}

function Hint() {
  return (
    <span className="hidden shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-subtle sm:flex">
      <kbd className="rounded-md border border-edge-soft bg-canvas/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
        Esc
      </kbd>
    </span>
  );
}
