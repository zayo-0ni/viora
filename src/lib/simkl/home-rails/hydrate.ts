import { hydrateTraktItems } from "@/lib/trakt/hydrate";
import type { TraktItem } from "@/lib/trakt/types";
import type { Meta } from "@/lib/cinemeta";
import type { SimklItem } from "../types";

function toHydratable(items: SimklItem[]): TraktItem[] {
  return items.map((it) => ({
    type: it.type,
    title: it.title,
    year: it.year,
    ids: {
      imdb: it.ids.imdb,
      tmdb: typeof it.ids.tmdb === "number" ? it.ids.tmdb : undefined,
    },
  }));
}



export async function hydrateSimklItems(items: SimklItem[], tmdbKey: string): Promise<Meta[]> {
  const metas = await Promise.all(
    items.map((it) =>
      hydrateTraktItems(toHydratable([it]), tmdbKey)
        .then((r) => r[0] ?? null)
        .catch(() => null),
    ),
  );
  return metas.filter((m): m is Meta => !!m && !!m.poster);
}

