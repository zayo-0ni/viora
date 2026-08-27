import { FocusButton } from "@/lib/tv-focus";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Check, Play, X } from "lucide-react";
import simklLogo from "@/assets/simkl.png";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { tmdbLiteMeta } from "@/lib/providers/tmdb/tmdb-lite";
import { useContextMenu } from "@/lib/context-menu";
import { useT } from "@/lib/i18n";
import { isDpadPrimary } from "@/lib/platform";
import { readSnapshot, useSnapshotVersion } from "@/lib/snapshots";
import { episodeFromVideoId, libraryMetaType, type LibraryItem } from "@/lib/stremio";
import { useHasNewEpisode } from "@/lib/new-episodes";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { Tooltip } from "@/views/detail/tooltip";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useView, type PlayEpisode } from "@/lib/view";
import { getWatchedBy } from "@/lib/watched-by";
import { playLocalAware } from "@/lib/local-library/playback";
import { readPlayback } from "@/lib/playback-history";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { fetchSeasonEpisodes } from "@/lib/series-episodes";

type Props = {
  item: LibraryItem;
  watched?: boolean;
  onDismiss?: (item: LibraryItem) => void;
};

export const ContinueCard = memo(function ContinueCard({ item, watched = false, onDismiss }: Props) {
  const { openMeta, openPicker, openPlayer } = useView();
  const t = useT();
  const { settings, update } = useSettings();
  const { profiles, activeProfile } = useProfiles();
  const watcherId = getWatchedBy(item._id);
  const watcher = watcherId ? profiles.find((p) => p.id === watcherId) : null;
  const showWatcher = !!watcher && watcher.id !== activeProfile?.id;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const { open: openContextMenu } = useContextMenu();
  useSnapshotVersion();
  const newEpisode = useHasNewEpisode(item);
  const snapshot = readSnapshot(item._id);
  const isExternal = item.external === "simkl";
  const dur = item.state?.duration ?? 0;
  const off = item.state?.timeOffset ?? 0;
  const progress = dur > 0 ? Math.min(1, off / dur) : 0;
  const remaining = dur > 0 && !isExternal ? formatRemaining(t, dur - off) : "";
  const upNext = item.upNext === true;
  const ep =
    item.state?.season && item.state?.episode
      ? { season: item.state.season, episode: item.state.episode }
      : episodeFromVideoId(item.state?.video_id);
  const sub = ep ? `S${ep.season}E${ep.episode}` : "";
  const [logo, setLogo] = useState<string | undefined>();
  const [metaBg, setMetaBg] = useState<string | undefined>();
  const [hydratedMeta, setHydratedMeta] = useState<Meta | null>(null);
  const [epTitle, setEpTitle] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const cardRef = useRef<HTMLButtonElement>(null);

  const candidates = useMemo(() => {
    const thumb = upNext ? undefined : snapshot;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of [thumb, metaBg, item.background, item.poster]) {
      if (!u) continue;
      const d = downscaleTmdb(u)!;
      if (seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
    return out;
  }, [snapshot, metaBg, item.background, item.poster, upNext]);

  const src = candidates[imgIdx];

  useEffect(() => {
    setLogo(undefined);
    setMetaBg(undefined);
    setHydratedMeta(null);
    setImgIdx(0);
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      if (item._id.startsWith("tmdb:")) {
        tmdbLiteMeta(settingsRef.current.tmdbKey, item._id)
          .then((m) => {
            if (cancelled || !m) return;
            setHydratedMeta({
              id: item._id,
              type: libraryMetaType(item.type),
              name: m.name?.trim() ? m.name : item.name,
              poster: m.poster ?? item.poster,
              background: m.background ?? item.background,
            });
            const bg = m.background || (item.background ? undefined : m.poster);
            if (bg) setMetaBg(bg);
          })
          .catch(() => {});
        return;
      }
      const looksEpisodic = item.type === "movie" && episodeFromVideoId(item.state?.video_id);
      fetchMeta(looksEpisodic ? "series" : narrowMediaType(item.type), item._id)
        .then((full) => {
          if (cancelled || !full) return;
          setHydratedMeta(full);
          // Cinemeta's logo is English-only; resolveLogo honours the artwork
          // language preference and falls back to it when nothing else exists.
          const key = settingsRef.current.tmdbKey;
          const cachedLogo = peekCachedLogo(key, full);
          if (cachedLogo) setLogo(downscaleTmdb(cachedLogo));
          else
            void resolveLogo(key, full)
              .then((l) => {
                if (!cancelled && l) setLogo(downscaleTmdb(l));
              })
              .catch(() => {});
          const bg = full.background || (item.background ? undefined : full.poster);
          if (bg) setMetaBg(bg);
        })
        .catch(() => {});
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          start();
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [item._id, item.type, item.state?.video_id]);

  useEffect(() => {
    setEpTitle(null);
    if (!ep) return;
    let cancelled = false;
    const epMeta: Meta = { id: item._id, type: "series", name: item.name };
    fetchSeasonEpisodes(epMeta, ep.season, { tmdbKey: settingsRef.current.tmdbKey })
      .then((eps) => {
        if (cancelled) return;
        const found = eps.find((e) => e.episode === ep.episode);
        if (found?.name) setEpTitle(found.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item._id, ep?.season, ep?.episode]);

  const episodeTitle = epTitle;

  const meta: Meta = hydratedMeta
    ? { ...hydratedMeta, id: item._id, type: libraryMetaType(item.type) }
    : {
        id: item._id,
        type: libraryMetaType(item.type),
        name: item.name,
        poster: item.poster,
        background: item.background,
      };

  /** The title page, which is where a different source is chosen. */
  const openTitle = () => {
    openMeta(meta, ep ? { episodeHint: ep } : undefined);
  };

  /*
    Pressing the card resumes it.

    A row called Continue Watching is a row of one intention, and pressing it
    used to open the title page instead — a page the viewer had already read,
    standing between them and the thing they were half way through. The picker
    already knows how to resume: given `resume`, it replays the stream this
    title last used rather than asking again. Choosing a different source is
    still there, one long press away, along with taking the card out.
  */
  const play = () => {
    let episode: PlayEpisode | undefined = item.type === "series" && ep ? ep : undefined;
    playLocalAware({
      meta,
      episode: episode ?? null,
      mode: settings.localPlaybackMode,
      source: "manual",
      resumeId: meta.id,
      playStream: () => {
        /*
          Straight back into the film, not into a list of ways to watch it.

          Asking the picker to resume still meant fetching every stream from
          every addon first, because it recognised the remembered one by
          finding it in that list — measured on the emulator, pressing a card
          showed "Searching streams" and then "336 found across 3 sources"
          before anything played. But the history entry already holds the link
          that played last, so when it is a direct one there is nothing to
          search for: the player can open on it.

          A saved link can go stale, and this cannot know that until the player
          tries. That is what the long press is for — the title page, and a
          different source.
        */
        const last = settings.rememberLastStream
          ? readPlayback(meta.id, episode?.season, episode?.episode)
          : null;
        if (last?.url) {
          openPlayer({
            meta,
            episode,
            url: last.url,
            title: episode ? episode.name || `Episode ${episode.episode}` : meta.name,
            subtitle: episode
              ? `${meta.name} · S${episode.imdbSeason ?? episode.season} · E${episode.imdbEpisode ?? episode.episode}`
              : meta.releaseInfo,
            resume: true,
            streamRef: {
              infoHash: last.infoHash ?? null,
              fileIdx: last.fileIdx ?? null,
              addonId: last.addonId ?? null,
              title: last.title ?? null,
              parsedTitle: last.parsedTitle ?? null,
              resolution: last.resolution ?? null,
              releaseGroup: last.releaseGroup ?? null,
              source: last.source ?? null,
              bingeGroup: last.bingeGroup ?? null,
              size: last.size ?? null,
            },
          });
          return;
        }
        /*
          Nothing remembered, or a torrent that still has to be resolved — and
          it still plays rather than asking.

          A press here means "carry on watching this", and the only titles with
          nothing remembered are the ones this app has not played before: the
          row is built from the Stremio library, so most of what is in it was
          watched somewhere else. Showing a list of sources on those was the
          same press meaning two different things depending on history the
          viewer cannot see. `instantPlay` stays the viewer's setting for
          everywhere else; from this row the press always plays.
        */
        openPicker(meta, episode, { autoPlay: true, resume: true });
      },
      playLocal: (entry, o) => {
        const s = localPlayerSrc(entry);
        openPlayer({
          ...s,
          meta: {
            ...s.meta,
            id: meta.id,
            poster: meta.poster ?? s.meta.poster,
            background: meta.background,
          },
          startFromZero: o?.fromStart,
        });
      },
      setMode: (m) => update({ localPlaybackMode: m }),
    });
  };

  /*
    A hold is not also a press.

    The engine knows to skip its own select once a long press has fired, but the
    browser does not: releasing Enter on a focused <button> delivers a real
    click of its own, and nothing was swallowing it. So holding OK opened the
    menu and started the film underneath it at the same time — which is what the
    owner saw, a menu sitting over a page he had not asked for.
  */
  const heldRef = useRef(false);
  const onClick = () => {
    if (heldRef.current) {
      heldRef.current = false;
      return;
    }
    play();
  };

  const onPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    play();
  };

  return (
    <div className="group relative w-full min-w-0">
      <FocusButton
        ref={cardRef}
        onClick={onClick}
        // Hold OK to take it out of the row.
        //
        // `onContextMenu` is a right-click or a finger held on glass; a remote
        // has neither, and the ✕ in the corner only exists under a pointer — so
        // there was no way at all to remove something from Continue Watching
        // from the sofa. The menu is opened over the card itself.
        onLongPress={() => {
          heldRef.current = true;
          const box = cardRef.current?.getBoundingClientRect();
          openContextMenu(
            new MouseEvent("contextmenu", {
              clientX: box ? box.left + box.width / 2 : 0,
              clientY: box ? box.top + box.height / 2 : 0,
            }),
            {
              kind: "continue",
              label: meta.name,
              remove: onDismiss ? () => onDismiss(item) : undefined,
              openTitle,
            },
          );
        }}
        onContextMenu={(e) =>
          openContextMenu(
            e,
            onDismiss
              ? { kind: "continue", label: meta.name, remove: () => onDismiss(item), openTitle }
              : { kind: "continue", label: meta.name, openTitle },
          )
        }
        className="flex w-full min-w-0 flex-col gap-2.5 text-start"
      >
      <div data-preview-anchor className="viora-poster relative aspect-[16/9] overflow-hidden rounded-xl bg-elevated shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] will-change-transform [transform:translate3d(0,0,0)] transition-transform duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.02]">
        <div className="absolute inset-0 bg-gradient-to-br from-raised via-elevated to-surface" />
        {src && (
          <img
            key={src}
            src={src}
            alt=""
            decoding="sync"
            onError={() => setImgIdx((i) => i + 1)}
            className="absolute inset-0 h-full w-full object-cover brightness-95"
          />
        )}
        <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.45)]" />
        {watched && (
          <span
            className="absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/22 text-emerald-200 ring-1 ring-emerald-400/40"
            title={t("Watched on Trakt")}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        {newEpisode > 0 && (
          <span className={`absolute top-2 ${watched ? "start-10" : "start-2"}`}>
            <Tooltip
              label={
                newEpisode === 1
                  ? t("1 new episode since you last watched")
                  : t("{n} new episodes since you last watched", { n: newEpisode })
              }
              side="bottom"
            >
              <span className="flex h-6 items-center rounded-full bg-accent/90 px-2 text-[10px] font-bold tracking-[0.1em] text-canvas">
                +{newEpisode}
              </span>
            </Tooltip>
          </span>
        )}
        {logo && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
            <img
              src={logo}
              alt=""
              loading="lazy"
              decoding="async"
              className="max-h-[55%] w-auto max-w-[78%] object-contain opacity-80 transition-opacity duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:opacity-25"
            />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-canvas/80 to-transparent" />
        {(sub || remaining || isExternal || upNext || episodeTitle) && (
          <div className="absolute bottom-2 start-2 flex max-w-[calc(100%-16px)] items-center gap-1.5 rounded-md bg-canvas/95 px-2 py-1 text-[11px]">
            {isExternal ? (
              <img src={simklLogo} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" title={t("Paused on Simkl")} />
            ) : (
              <Play size={11} fill="currentColor" className="shrink-0 text-ink" />
            )}
            {sub && <span className="shrink-0 font-medium text-ink">{sub}</span>}
            {upNext ? (
              <>
                {sub && <span className="shrink-0 text-ink-subtle">·</span>}
                <span className="shrink-0 font-medium text-accent">{t("Up Next")}</span>
              </>
            ) : episodeTitle ? (
              <>
                {sub && <span className="shrink-0 text-ink-subtle">·</span>}
                <span className="min-w-0 truncate text-ink-muted">{episodeTitle}</span>
              </>
            ) : (
              remaining && (
                <>
                  {sub && <span className="shrink-0 text-ink-subtle">·</span>}
                  <span className="shrink-0 text-ink-muted">{remaining}</span>
                </>
              )
            )}
          </div>
        )}
        {showWatcher && watcher && (
          <div
            className="absolute bottom-2.5 end-2 z-[1]"
            title={t("Watched by {name}", { name: watcher.name })}
          >
            <span
              className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-elevated text-[11px] font-bold text-white"
              style={{ boxShadow: `0 0 0 2px ${watcher.color}, 0 2px 8px rgba(0,0,0,0.5)` }}
            >
              {watcher.avatar ? (
                <img src={watcher.avatar} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                (watcher.name.trim()[0]?.toUpperCase() ?? "?")
              )}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-canvas/40">
          <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <p className="truncate text-[13px] font-medium text-ink">
        {hydratedMeta?.name?.trim() || item.name}
      </p>
      </FocusButton>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex aspect-[16/9] items-center justify-center opacity-0 transition-opacity duration-[220ms] group-hover:opacity-100 group-focus-within:opacity-100">
        <FocusButton
          type="button"
          onClick={onPlay}
          aria-label={t("Play")}
          title={t("Play")}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-canvas ring-1 ring-white/15 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.6)] transition-transform duration-150 hover:scale-[1.06]"
        >
          <Play size={22} fill="currentColor" className="ml-0.5 text-ink" />
        </FocusButton>
      </div>
      {onDismiss && !isDpadPrimary() && (
        <FocusButton
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(item);
          }}
          aria-label={t("Remove from Continue Watching")}
          className="group/x absolute end-0.5 top-0.5 z-10 flex h-11 w-11 items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas/85 text-ink-muted ring-1 ring-white/12 transition-colors group-hover/x:bg-canvas group-hover/x:text-ink">
            <X size={20} strokeWidth={2.4} />
          </span>
        </FocusButton>
      )}
    </div>
  );
});

function downscaleTmdb(url?: string): string | undefined {
  if (!url) return url;
  // This card does not go through `Poster`, so the sizing rule that lives there
  // has to be repeated. It knew about TMDB and not about Metahub, which is
  // where a continue card's artwork usually comes from: measured on the device,
  // six of them were decoding 1920x1080 backgrounds for a 645x363 tile.
  return url
    .replace(/\/t\/p\/(original|w1280|w780|w500)\//, "/t/p/w300/")
    .replace("/background/medium/", "/background/small/")
    .replace("/logo/medium/", "/logo/small/")
    .replace("/poster/medium/", "/poster/small/");
}

function formatRemaining(t: (key: string, vars?: Record<string, string | number>) => string, ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return t("{m}m left", { m: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? t("{h}h left", { h }) : t("{h}h {m}m left", { h, m });
}
