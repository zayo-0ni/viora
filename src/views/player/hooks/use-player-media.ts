import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useAuth } from "@/lib/auth";
import { downloadText } from "@/lib/download-text";
import { getCuesAnySource } from "@/lib/subtitles/extract";
import { toSrt } from "@/lib/subtitles/serialize";
import { isAssTrack, isImageSubTrack } from "@/lib/player/sub-format";
import { clearImportedSubs } from "@/lib/player/imported-subs";
import { readPlayerVolume } from "@/lib/player-volume";
import { setPlayerActions } from "@/lib/player-actions";
import type { PlayerEngine, PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { useSettings } from "@/lib/settings";
import { isLocalEngineUrl } from "@/lib/stremio-server";
import { useSimklScrobble } from "@/lib/simkl/scrobble-hook";
import { useTraktScrobble } from "@/lib/trakt/scrobble-hook";
import { cancelTorrentRemoval, scheduleTorrentRemoval, torrentEngineRemove } from "@/lib/torrent/local-engine";
import type { PlayerSrc } from "@/lib/view";
import { useExitSnapshot } from "./use-exit-snapshot";
import { usePowerInhibit } from "./use-power-inhibit";
import { useResumeAutosave } from "./use-resume-autosave";
import { useStremioSync } from "./use-stremio-sync";
import { useSubDrop } from "./use-sub-drop";
import { useSubStyleApply } from "./use-sub-style-apply";
import { useTrackAutoload } from "./use-track-autoload";
import { useReferenceSync } from "./use-reference-sync";
import { useVideoDownload } from "./use-video-download";
import { useWebviewMemory } from "./use-webview-memory";

export function usePlayerMedia(params: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  engine: PlayerEngine;
  settings: ReturnType<typeof useSettings>["settings"];
  authKey: ReturnType<typeof useAuth>["authKey"];
  bridgeRef: RefObject<PlayerBridge | null>;
  bridgeReady: boolean;
  bridgeKey: string | number;
  videoMountRef: RefObject<HTMLDivElement | null>;
  toggleFullscreen: () => void;
  castActiveRef: RefObject<boolean>;
  season: number | undefined;
  episode: number | undefined;
}) {
  const {
    src,
    snap,
    engine,
    settings,
    authKey,
    bridgeRef,
    bridgeReady,
    bridgeKey,
    videoMountRef,
    toggleFullscreen,
    castActiveRef,
    season,
    episode,
  } = params;

  useWebviewMemory(engine === "mpv");
  const progressRef = useRef(0);
  useEffect(() => {
    progressRef.current = snap.durationSec > 0 ? snap.positionSec / snap.durationSec : 0;
  }, [snap.positionSec, snap.durationSec]);

  const prevEngineHashRef = useRef<string | null>(null);
  useEffect(() => {
    const hash = isLocalEngineUrl(src.url) ? src.streamRef?.infoHash ?? null : null;
    const prev = prevEngineHashRef.current;
    const purge = () =>
      settings.streamCacheRetentionHours === 0 ||
      (settings.deleteWatchedDownloads && progressRef.current >= 0.9);
    if (prev && prev !== hash) {
      cancelTorrentRemoval(prev);
      void torrentEngineRemove(prev, purge());
    }
    if (hash) cancelTorrentRemoval(hash);
    prevEngineHashRef.current = hash;
    return () => {
      if (hash) scheduleTorrentRemoval(hash, purge());
    };
  }, [src.url, src.streamRef?.infoHash]);

  const volumeRestoredRef = useRef(false);
  useEffect(() => {
    if (!bridgeReady) {
      volumeRestoredRef.current = false;
      return;
    }
    if (volumeRestoredRef.current) return;
    if (snap.status !== "playing" && snap.status !== "paused") return;
    const b = bridgeRef.current;
    if (!b) return;
    const saved = readPlayerVolume();
    b.setVolume(saved.volume);
    b.setMuted(saved.muted);
    volumeRestoredRef.current = true;
  }, [bridgeReady, bridgeKey, snap.status]);

  const { resolvedImdbId, resolvedImdbVerified, resolutionSettled } = useTrackAutoload({
    bridgeRef,
    src,
    snap,
    engine,
    settings,
    authKey,
  });

  // Sync against another subtitle rather than the audio. The two are
  // complementary: the audio path needs an ffmpeg binary and so never runs on
  // Android, and this one needs a second subtitle to compare against.
  useReferenceSync({ bridgeRef, src, snap });

  const subEmbed = engine === "mpv" && settings.playerMpvEmbed;
  // HDR passthrough was a Windows-only path: mpv handed the frames to a native
  // surface so the WebView compositor never touched the colours. Nothing on
  // this platform can do that, so the surface is never native here.
  const hdrNativeSurface = false;
  const selectedSubTrack = snap.subtitleTracks.find((t) => t.selected) ?? null;
  const subAssOverridden = settings.subAssOverride !== "no" && settings.subAssOverride !== "scale";
  const selectedAssSub = isAssTrack(selectedSubTrack);
  const selectedImageSub = isImageSubTrack(selectedSubTrack);
  const subAssNative =
    subEmbed && selectedAssSub && (!subAssOverridden || !selectedSubTrack?.external);
  const subNativeRender =
    hdrNativeSurface || subAssNative || (subEmbed && selectedImageSub);
  const assNativeActive = selectedAssSub && (subNativeRender || !subEmbed);
  const imageNativeActive = selectedImageSub && (subNativeRender || !subEmbed);
  const mpvMediaReadyForStyle =
    snap.status !== "idle" &&
    snap.status !== "loading" &&
    (snap.durationSec > 0 ||
      snap.videoWidth > 0 ||
      snap.audioTracks.length > 0 ||
      snap.subtitleTracks.length > 0);
  const suppressHtmlSubs = subAssNative || hdrNativeSurface;
  useSubStyleApply({
    engine,
    settings,
    assNativeActive,
    imageNativeActive,
    bridgeReady,
    mediaReady: mpvMediaReadyForStyle,
    bridgeKey,
  });
  useEffect(() => {
    if (!subEmbed && !hdrNativeSurface) return;
    if (!bridgeReady) return;
    bridgeRef.current?.setSubVisible(subNativeRender);
  }, [subEmbed, hdrNativeSurface, subNativeRender, selectedSubTrack?.id, bridgeReady, bridgeKey]);
  useEffect(() => {
    clearImportedSubs();
  }, [src.meta.id]);

  const { captureExitSnapshot } = useExitSnapshot({
    src,
    engine,
    status: snap.status,
    durationSec: snap.durationSec,
    videoMountRef,
    resolvedImdbId,
    resolvedImdbVerified,
    seekPreviewEnabled: settings.seekPreviewEnabled,
  });

  useTraktScrobble({ src, snap });
  useSimklScrobble({ src, snap });
  const download = useVideoDownload({ url: src.url, meta: src.meta, episode: src.episode });

  const doDownloadSubtitle = useCallback(async () => {
    const b = bridgeRef.current;
    if (!b) return;
    const base = src.episode
      ? `${src.meta.name ?? "Subtitle"} S${src.episode.season}E${src.episode.episode}`
      : src.meta.name ?? "Subtitle";
    const fileName = `${base.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Subtitle"}.srt`;
    const res = await getCuesAnySource(b);
    if (res.ok && res.source.cues.length > 0) {
      await downloadText(fileName, toSrt(res.source.cues), ["srt"], "Subtitle");
    }
  }, [bridgeRef, src.meta.name, src.episode, src.url, src.headers]);
  const canDownloadSub = snap.subtitleTracks.some((trk) => trk.selected);

  useEffect(() => {
    setPlayerActions({
      download: download.start,
      toggleFullscreen,
      canDownload: !!src.url,
      downloadSubtitle: doDownloadSubtitle,
      canDownloadSubtitle: canDownloadSub,
    });
    return () => setPlayerActions(null);
  }, [download.start, toggleFullscreen, src.url, doDownloadSubtitle, canDownloadSub]);

  useResumeAutosave({ src, snap, season, episode });
  useStremioSync({ src, snap, authKey, resolvedImdbId, resolvedImdbVerified, resolutionSettled, castActiveRef });
  usePowerInhibit(snap);
  const subDropToast = useSubDrop(bridgeRef, src.meta.id);

  useEffect(() => {
    const name = src.meta.name ?? "";
    const mediaTitle = src.episode
      ? `${name} · S${src.episode.imdbSeason ?? src.episode.season}E${src.episode.imdbEpisode ?? src.episode.episode}${src.episode.name ? ` · ${src.episode.name}` : ""}`
      : name;
    if (!mediaTitle) return;
    bridgeRef.current?.setMediaInfo?.({
      title: mediaTitle,
      artwork: src.meta.poster ?? undefined,
    });
  }, [engine, src.url, src.meta.name, src.meta.poster, src.episode, snap.durationSec]);

  return { resolvedImdbId, subAssNative: suppressHtmlSubs, captureExitSnapshot, download, subDropToast };
}
