import { useEffect, useState } from "react";
import { narrowMediaType, isAddonNativeMeta, type Meta } from "@/lib/cinemeta";
import { tmdbImdbId } from "@/lib/providers/tmdb";
import { cinemetaImdbFallback } from "./picker-utils";

export type ResolvedImdb = { id: string | null; verified: boolean };

const UNRESOLVED: ResolvedImdb = { id: null, verified: false };

export function useImdbId(meta: Meta, tmdbKey: string | undefined): ResolvedImdb {
  const [resolved, setResolved] = useState<ResolvedImdb>(UNRESOLVED);
  useEffect(() => {
    let cancelled = false;
    const set = (r: ResolvedImdb) => {
      if (!cancelled) setResolved(r);
    };
    if (meta.id.startsWith("tt")) {
      set({ id: meta.id, verified: true });
      return;
    }
    if (isAddonNativeMeta(meta)) {
      set(UNRESOLVED);
      return;
    }
    (async () => {
      if (tmdbKey) {
        const id = await tmdbImdbId(tmdbKey, meta.id).catch(() => null);
        if (id) {
          set({ id, verified: true });
          return;
        }
      }
      const fallback = await cinemetaImdbFallback(
        meta.name,
        narrowMediaType(meta.type),
        meta.releaseInfo,
      ).catch(() => null);
      set(fallback ? { id: fallback, verified: false } : UNRESOLVED);
    })();
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, meta.addonOrigin?.id, tmdbKey]);
  return resolved;
}
