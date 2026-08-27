import { useEffect, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { tmdbPerson, tmdbPersonCached, type PersonDetail } from "@/lib/providers/tmdb";
import { AwardDetailModal } from "@/components/award-detail-modal";
import { type AwardType, useAwards } from "@/lib/providers/wikidata";
import { mergeBundledPersonAwards } from "@/lib/awards-history";
import { useSettings } from "@/lib/settings";
import { useScrollMemory } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { FilmRow } from "./person/film-row";
import {
  dedupe,
  dedupeByMedia,
  DIRECTOR_JOBS,
  isCameoOrGuest,
  notableScore,
  PRODUCER_JOBS,
  WRITER_JOBS,
} from "./person/person-utils";

export function PersonView({ personId }: { personId: number }) {
  const t = useT();
  const { settings } = useSettings();
  const initialCached = tmdbPersonCached(personId);
  const [person, setPerson] = useState<PersonDetail | null>(initialCached ?? null);
  const [loading, setLoading] = useState(!initialCached);
  const scrollRef = useRef<HTMLElement>(null);
  const liveAwards = useAwards(person?.imdbId ?? undefined);
  const awardEntries = useMemo(
    () => mergeBundledPersonAwards(liveAwards, person?.name),
    [liveAwards, person?.name],
  );
  const [openAward, setOpenAward] = useState<{ type: AwardType; anchor: DOMRect } | null>(null);
  const openAwardEntries = useMemo(
    () => (openAward && awardEntries ? awardEntries.filter((e) => e.type === openAward.type) : []),
    [openAward, awardEntries],
  );
  useScrollMemory(`person:${personId}`, scrollRef);

  useEffect(() => {
    let cancelled = false;
    const cached = tmdbPersonCached(personId);
    if (cached) {
      setPerson(cached);
      setLoading(false);
      return;
    }
    setPerson(null);
    setLoading(true);
    tmdbPerson(settings.tmdbKey, personId).then((p) => {
      if (cancelled) return;
      setPerson(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [personId, settings.tmdbKey]);

  const sortedCast = useMemo(
    () => (person ? dedupe(person.cast).sort((a, b) => b.popularity - a.popularity) : []),
    [person],
  );
  const sortedCrew = useMemo(() => (person ? person.crew.slice().sort((a, b) => b.popularity - a.popularity) : []), [person]);

  const knownFor = useMemo(() => {
    if (!person) return [];
    const dept = person.knownForDepartment;
    const pool =
      dept === "Acting" || !dept
        ? sortedCast.filter((c) => !isCameoOrGuest(c))
        : dedupeByMedia(sortedCrew.filter((c) => c.department === dept));
    return pool
      .slice()
      .sort((a, b) => notableScore(b) - notableScore(a))
      .slice(0, 12);
  }, [sortedCast, sortedCrew, person]);
  const movies = sortedCast.filter((c) => c.mediaType === "movie");
  const shows = sortedCast.filter((c) => c.mediaType === "tv");
  const directing = dedupe(sortedCrew.filter((c) => DIRECTOR_JOBS.has(c.job ?? "")));
  const writing = dedupe(sortedCrew.filter((c) => WRITER_JOBS.has(c.job ?? "")));
  const producing = dedupe(sortedCrew.filter((c) => PRODUCER_JOBS.has(c.job ?? "")));
  const otherCrew = dedupe(
    sortedCrew.filter(
      (c) =>
        !DIRECTOR_JOBS.has(c.job ?? "") &&
        !WRITER_JOBS.has(c.job ?? "") &&
        !PRODUCER_JOBS.has(c.job ?? ""),
    ),
  );

  const backdrop = knownFor.find((c) => c.background)?.background;


  return (
    <main
      ref={scrollRef}
      className="absolute inset-0 z-40 overflow-y-auto bg-canvas"
    >

      <div className="relative isolate">
        {backdrop && (
          <div aria-hidden className="viora-bleed-stremio pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] overflow-hidden">
            <div
              className="absolute inset-0 scale-110"
              style={{
                backgroundImage: `url(${backdrop})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(80px) saturate(1.3)",
                opacity: 0.45,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-canvas/40 via-canvas/70 to-canvas" />
          </div>
        )}

        {/* The header is gone by the owner's instruction.
            A person's page is opened here for one reason — to see the rest of
            what they were in — so the portrait, the department, the Top-N badge,
            the name, the birth date and birthplace, the award laurels and the
            biography were all asked for at once and all removed. The page now
            opens straight on the filmography. */}
      </div>

      <div className="relative z-10 flex flex-col gap-14 px-12 pb-24 pt-6">
        {loading && (
          <div className="h-[260px] animate-pulse rounded-2xl border border-edge-soft bg-elevated/30" />
        )}

        {knownFor.length > 0 && (
          <FilmRow title={t("Known For")} credits={knownFor} showRole={false} />
        )}
        {movies.length > 0 && <FilmRow title={t("Movies · {n}", { n: movies.length })} credits={movies} showRole />}
        {shows.length > 0 && <FilmRow title={t("TV Shows · {n}", { n: shows.length })} credits={shows} showRole />}
        {directing.length > 0 && <FilmRow title={t("Directing")} credits={directing} showRole />}
        {writing.length > 0 && <FilmRow title={t("Writing")} credits={writing} showRole />}
        {producing.length > 0 && <FilmRow title={t("Producing")} credits={producing} showRole />}
        {otherCrew.length > 0 && otherCrew.length > 4 && (
          <FilmRow title={t("Other Work")} credits={otherCrew.slice(0, 24)} showRole />
        )}

        {!loading && person && sortedCast.length === 0 && sortedCrew.length === 0 && (
          <div className="rounded-2xl border border-dashed border-edge px-6 py-12 text-center text-[14px] text-ink-muted">
            {t("No filmography on record.")}
          </div>
        )}
      </div>
      <BackToTop scrollRef={scrollRef} />
      {openAward && (
        <AwardDetailModal
          type={openAward.type}
          entries={openAwardEntries}
          anchor={openAward.anchor}
          onClose={() => setOpenAward(null)}
        />
      )}
    </main>
  );
}
