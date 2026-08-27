import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { tmdbDetails, type TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import { imdbapiDetails } from "@/lib/providers/imdbapi/imdbapi-details";


export function useTitleDetail(meta: Meta, tmdbKey: string | null, active: boolean) {
  const { settings } = useSettings();
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const usedImdbFallback =
    !tmdbKey && settings.imdbApiFallback && meta.id.startsWith("tt");
  const canFetch = !!tmdbKey || usedImdbFallback;

  useEffect(() => {
    if (!active) return;
    if (!canFetch) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    const req: Promise<TmdbDetail | null> = tmdbKey
      ? tmdbDetails(tmdbKey, meta)
      : imdbapiDetails(meta.id);
    req
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, meta, tmdbKey, settings, canFetch]);

  return { detail, loading, canFetch, needsKey: !canFetch };
}
