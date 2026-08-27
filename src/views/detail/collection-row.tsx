import { useEffect, useState } from "react";
import { PickCard } from "@/components/pick-card";
import { Row } from "@/components/row";
import type { Meta } from "@/lib/cinemeta";
import { tmdbCollection } from "@/lib/providers/tmdb";
import { useActiveKid } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { dropUnreleased } from "@/views/kids/kids-filter";

export function CollectionRow({
  collection,
  currentTmdbId,
}: {
  collection: { id: number; name: string };
  /** TMDB's own id for the title being looked at, which is what the parts carry. */
  currentTmdbId: number | string | undefined;
}) {
  const { settings } = useSettings();
  const kid = useActiveKid();
  const [parts, setParts] = useState<Meta[]>([]);

  useEffect(() => {
    if (!settings.tmdbKey) return;
    let cancelled = false;
    setParts([]);
    tmdbCollection(settings.tmdbKey, collection.id)
      .then((c) => {
        if (cancelled || !c) return;
        // The rest of the collection — never the title being looked at.
        //
        // This compared `p.id` with `meta.id`, and a collection's parts are
        // `tmdb:movie:<n>` while a title opened from Cinemeta is `tt…`. The two
        // can never be equal, so the filter did nothing and the film you were
        // watching sat inside its own collection row. TMDB's own id for the
        // title is what the parts are keyed by, so that is what to compare.
        const self = currentTmdbId != null ? `tmdb:movie:${currentTmdbId}` : null;
        const rest = self ? c.parts.filter((p) => p.id !== self) : c.parts;
        setParts(kid ? dropUnreleased(rest) : rest);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey, collection.id, currentTmdbId, kid]);

  if (parts.length === 0) return null;

  return (
    <Row
      scrollKey={`collection-${collection.id}`}
      // A name, not a door. The row beneath it already holds every film in the
      // collection, so the separate screen it used to open had nothing more to
      // show — and it cost a stop on the remote's path to reach it.
      title={collection.name}
    >
      {parts.map((m) => (
        <PickCard key={m.id} meta={m} kids={!!kid} />
      ))}
    </Row>
  );
}
