import type { HomeRow } from "@/views/home/home-types";
import type { Settings } from "@/lib/settings";
import { fetchWatchingItems, fetchWatchlist } from "./watchlist";
import type { SimklItem } from "./types";
import { getLocalCache } from "./activities";
import { clearCdnCache, fetchSimklTrending } from "./home-rails/cdn";
import {
  hydrateSimklItems,
} from "./home-rails/hydrate";
import { computeUpNextShows } from "./home-rails/up-next";

export { hydrateSimklItems };

const PER_RAIL = 24;

export async function buildSimklHomeRows(settings: Settings): Promise<HomeRow[]> {
  if (!settings.simklHomeRailsEnabled) {
    void fetchWatchlist().catch(() => []);
    void fetchWatchingItems().catch(() => []);
    return [];
  }

  const tmdbKey = settings.tmdbKey;
  const cache = getLocalCache();
  const upcomingShows = cache ? await computeUpNextShows(cache) : [];

  const [plan, watching, trendingItems] = await Promise.all([
    fetchWatchlist().catch(() => []),
    fetchWatchingItems().catch(() => []),
    fetchSimklTrending().catch(() => []),
  ]);

  const isAnimeType = (it: SimklItem) =>
    it.ids.mal != null || it.ids.anidb != null || it.ids.kitsu != null;
  const watchingShows = watching.filter((it) => it.type === "show" && !isAnimeType(it));
  const planMovies = plan.filter((it) => it.type === "movie" && !isAnimeType(it));
  const planShows = plan.filter((it) => it.type === "show" && !isAnimeType(it));

  const [
    watchingShowsMetas,
    planMoviesMetas,
    planShowsMetas,
    upcomingMetas,
    trendingMetas,
  ] = await Promise.all([
    hydrateSimklItems(watchingShows.slice(0, PER_RAIL), tmdbKey),
    hydrateSimklItems(planMovies.slice(0, PER_RAIL), tmdbKey),
    hydrateSimklItems(planShows.slice(0, PER_RAIL), tmdbKey),
    hydrateSimklItems(upcomingShows.slice(0, PER_RAIL), tmdbKey),
    hydrateSimklItems(trendingItems.slice(0, PER_RAIL), tmdbKey),
  ]);

  const rows: HomeRow[] = [];

  const pager = (items: SimklItem[]) => async (page: number) => {
    const slice = items.slice((page - 1) * PER_RAIL, page * PER_RAIL);
    if (slice.length === 0) return [];
    return hydrateSimklItems(slice, tmdbKey);
  };


  if (watchingShowsMetas.length >= 1 && settings.simklGranularFilters.shows.watching) {
    rows.push({
      key: "simkl-watching-shows",
      type: "series",
      name: "Watching TV Shows on Simkl",
      metas: watchingShowsMetas,
      page: 1,
      hasMore: watchingShows.length > PER_RAIL,
      noDedup: true,
      fetcher: pager(watchingShows),
    });
  }


  if (planMoviesMetas.length >= 4 && settings.simklGranularFilters.movies.plantowatch) {
    rows.push({
      key: "simkl-plantowatch-movies",
      type: "movie",
      name: "Plan to Watch Movies on Simkl",
      metas: planMoviesMetas,
      page: 1,
      hasMore: planMovies.length > PER_RAIL,
      noDedup: true,
      fetcher: pager(planMovies),
    });
  }

  if (planShowsMetas.length >= 4 && settings.simklGranularFilters.shows.plantowatch) {
    rows.push({
      key: "simkl-plantowatch-shows",
      type: "series",
      name: "Plan to Watch TV Shows on Simkl",
      metas: planShowsMetas,
      page: 1,
      hasMore: planShows.length > PER_RAIL,
      noDedup: true,
      fetcher: pager(planShows),
    });
  }


  if (upcomingMetas.length >= 1 && settings.simklUpNextRailEnabled) {
    rows.push({
      key: "simkl-upcoming",
      type: "series",
      name: "Up Next on Simkl",
      metas: upcomingMetas,
      page: 1,
      hasMore: upcomingShows.length > PER_RAIL,
      noDedup: true,
      fetcher: pager(upcomingShows),
    });
  }

  if (trendingMetas.length >= 4 && settings.simklTrendingRailEnabled) {
    rows.push({
      key: "simkl-trending",
      type: trendingItems[0]?.type === "show" ? "series" : "movie",
      name: "Simkl Trending Today",
      metas: trendingMetas,
      page: 1,
      hasMore: trendingItems.length > PER_RAIL,
      noDedup: true,
      fetcher: pager(trendingItems),
    });
  }

  return rows;
}

export function clearHomeRailsCache() {
  clearCdnCache();
}
