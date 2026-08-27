import { FocusSection, focusKeys, setFocusSafely } from "@/lib/tv-focus";
import { isDpadPrimary } from "@/lib/platform";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveChromeTheme } from "@/lib/theme";
import { useActiveKid } from "@/lib/profiles";
import { type PlayerBridge } from "@/lib/player/bridge";
import { useDebridClients } from "@/lib/debrid/registry";
import { useSettings } from "@/lib/settings";
import { writePlayerVolume } from "@/lib/player-volume";
import { nameColor } from "@/lib/together/colors";
import { useTogether } from "@/lib/together/provider";
import { buildPlayInvite } from "@/lib/together/build-invite";
import { useView, type PlayerSrc, type PlayEpisode } from "@/lib/view";
import { useQueue, useSleepAtEnd } from "@/lib/queue";
import { useSkipSegments, useAdSegments } from "@/lib/skip-intro";
import { withinAdWindow } from "@/lib/ad-report/window";
import { isLocalUrl } from "@/lib/player/local-url";
import { useAuth } from "@/lib/auth";
import { embedFlags } from "./player/player-utils";
import { useSvpGuard } from "./player/hooks/use-svp-guard";
import { usePlayerCast } from "./player/hooks/use-player-cast";
import { useCastReturnPublish } from "./player/hooks/use-cast-return-publish";
import { useChromeConfig } from "./player/hooks/use-chrome-config";
import { useEverPlayed } from "./player/hooks/use-ever-played";
import { useDrawMode } from "./player/hooks/use-draw-mode";
import { useChromeVisibility } from "./player/hooks/use-chrome-visibility";
import { useAutoRetry } from "./player/hooks/use-auto-retry";
import { useWakeReconnect } from "./player/hooks/use-wake-reconnect";
import { useEngineStats } from "./player/hooks/use-engine-stats";
import { useContentAdvisory } from "./player/hooks/use-content-advisory";
import { setPlaybackDownloaded } from "@/lib/player/playback-clock";
import { isBundledEngineUrl, isLocalEngineUrl } from "@/lib/stremio-server";
import { usePauseOnInactive } from "./player/hooks/use-pause-on-inactive";
import { spoilerMaskFor } from "@/lib/spoilers";
import { usePlayerWatched } from "./player/hooks/use-player-watched";
import { useRoomSync } from "./player/hooks/use-room-sync";
import { useHostSource } from "./player/hooks/use-host-source";
import { useLobbyGate } from "./player/hooks/use-lobby-gate";
import { hostSourceMatchesMedia } from "@/lib/together/room-derive";
import { useLiveChannelOverlay } from "./player/hooks/use-live-channel-overlay";
import { useStreamSwitcher } from "./player/hooks/use-stream-switcher";
import { usePlayerBridge } from "./player/hooks/use-player-bridge";
import { useTvPlayerKeys } from "./player/hooks/use-tv-player-keys";
import { useTextSync } from "./player/hooks/use-text-sync";
import { useEpisodeNavigation } from "./player/hooks/use-episode-navigation";
import { useAbLoop } from "./player/hooks/use-ab-loop";
import { useAutoNextEpisode } from "./player/hooks/use-auto-next-episode";
import { useStartedNearEnd } from "./player/hooks/use-started-near-end";
import { useFrameGrab } from "./player/hooks/use-frame-grab";
import { useClipRecorder } from "./player/hooks/use-clip-recorder";
import { useGifRecorder } from "./player/hooks/use-gif-recorder";
import { useSleepTimer } from "./player/hooks/use-sleep-timer";
import { useAutoEndExit } from "./player/hooks/use-auto-end-exit";
import { useQueueAdvance } from "./player/hooks/use-queue-advance";
import { usePlaybackControls } from "./player/hooks/use-playback-controls";
import { usePlayerExit } from "./player/hooks/use-player-exit";
import { usePendingSeekApply } from "./player/hooks/use-pending-seek-apply";
import { usePlayerHotkeys } from "./player/hooks/use-player-hotkeys";
import { usePlayerMedia } from "./player/hooks/use-player-media";
import { useStubDetection } from "./player/hooks/use-stub-detection";
import { useBridgeLoad } from "./player/hooks/use-bridge-load";
import { useVideoFill } from "./player/hooks/use-video-fill";
import { useLivePictureEq } from "./player/hooks/use-live-picture-eq";
import { useSdrBoostGate } from "./player/hooks/use-sdr-boost-gate";
import { PlayerOverlayLayers, type PlayerOverlayLayersProps } from "./player/player-overlay-layers";
import { LeaveConfirmModal } from "@/components/player/leave-confirm-modal";
import { PlaybackFailedPanel } from "./player/playback-failed-panel";
import { setSkipSegmentsView } from "@/lib/skip-intro/segment-store";
import { markStreamDead, STUB_TTL_MS } from "@/lib/dead-streams";
import type { VolumeIndicatorState } from "@/components/player/volume-indicator";

export function PlayerView({ src }: { src: PlayerSrc }) {
  const { setChromeHidden, topPath, openPicker, exitPlayback, replacePlayerSrc, exitPlayer } = useView();
  const { settings } = useSettings();
  const isKid = useActiveKid() != null;
  const chromeTheme = resolveChromeTheme(settings.theme, settings.playerChromeTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (!settings.playerMenuBlack) {
      delete root.dataset.playerBlack;
      return;
    }
    root.dataset.playerBlack = "on";
    return () => {
      delete root.dataset.playerBlack;
    };
  }, [settings.playerMenuBlack]);
  const {
    avatarsCorner,
    chatCorner,
    episodesCorner,
    avatarsHidden,
    chatHidden,
    episodesHidden,
  } = useChromeConfig(chromeTheme);
  const { authKey } = useAuth();
  const debrids = useDebridClients();
  const {
    snapshot: roomSnapshot,
    publishState,
    sendCommand,
    onIncomingCommand,
    suppressOutgoingFor,
    onIncomingState,
    clientId,
    markReady,
    notifyHostLeaving,
    clearInvite,
    sendInvite,
    claimHost,
    chat,
    sendChat,
    sendDraw,
    onIncomingDraw,
    presenceMap,
    participantLocations,
    startRoom,
    hostSource,
  } = useTogether();
  const stageRef = useRef<HTMLDivElement>(null);
  const videoMountRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<PlayerBridge | null>(null);
  const selfFrameReadyRef = useRef(false);
  // Always: there is one window and it is the screen.
  const fullscreen = true;
  const toggleFullscreen = () => {};
  // Carries a position across a reload the player asked for itself, so swapping
  // engines resumes where the viewer was instead of starting over.
  const resumeOverrideRef = useRef<number | null>(null);
  const { snap, engine, bridgeReady, bridgeKey, alternateEngine, switchEngine } =
    usePlayerBridge({
      bridgeRef,
      videoMountRef,
      src,
      settings,
      resumeOverrideRef,
    });
  const isP2pEngine =
    (isBundledEngineUrl(src.url) || isLocalEngineUrl(src.url)) &&
    !src.url.includes("/hlsv2/") &&
    !!src.streamRef?.infoHash;
  const { stats: engineStats, genuineFailure } = useEngineStats({
    url: src.url,
    infoHash: src.streamRef?.infoHash ?? null,
    fileIdx: src.streamRef?.fileIdx ?? null,
    active: snap.status !== "ended" && (snap.videoWidth <= 0 || isP2pEngine),
  });
  useEffect(() => {
    const isLive = src.isLive || !!src.meta.id?.startsWith("iptv:");
    const isHls = src.url.includes("/hlsv2/");
    if (isP2pEngine) {
      const len = engineStats?.streamLen ?? 0;
      const prog = engineStats?.streamProgress ?? 0;
      setPlaybackDownloaded(len > 0 ? prog / len : 0);
    } else if (!isLive && !isHls) {
      setPlaybackDownloaded(1);
    } else {
      setPlaybackDownloaded(0);
    }
  }, [engineStats?.streamProgress, engineStats?.streamLen, src.url, isP2pEngine, src.isLive, src.meta.id]);
  const shellSnapRef = useRef(snap);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const [foreignNotice, setForeignNotice] = useState<{ title: string | null; from: string } | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const cast = usePlayerCast({ src, debrids, snapRef, bridgeRef, settings });
  const [now, setNow] = useState(() => Date.now());
  // Picture-in-picture was a second OS window; Android has no counterpart.
  const pipMode = false;
  const togglePipMode = () => {};
  const exitPip = async () => {};
  const { transcodedUrl, failureReason, surrender, retry } = useAutoRetry({
    bridgeRef,
    src,
    snap,
    stremioServerTranscode: settings.stremioServerTranscode,
    inRoom: roomSnapshot.state === "joined",
    debrids,
    selfFrameReadyRef,
    engineFailure: genuineFailure,
    isP2pEngine,
    engineStats,
  });

  useWakeReconnect({ bridgeRef, src, snap });

  useEffect(() => {
    if (roomSnapshot.state !== "joined") return;
    const id = window.setInterval(() => setNow(Date.now()), 6000);
    return () => window.clearInterval(id);
  }, [roomSnapshot.state]);

  const season = src.episode?.season;
  const episode = src.episode?.episode;
  const inRoom = roomSnapshot.state === "joined" && roomSnapshot.participants.length >= 2;
  const isHost = inRoom && roomSnapshot.hostClientId === clientId;
  const canControl = !inRoom || hasStarted;
  const guestPickRef = useRef(settings.togetherGuestsPick);
  guestPickRef.current = settings.togetherGuestsPick;

  usePauseOnInactive({ bridgeRef, snapRef });

  const showWaiting = inRoom && !hasStarted;
  const selfName = useMemo(
    () => roomSnapshot.participants.find((p) => p.id === clientId)?.name ?? "You",
    [roomSnapshot.participants, clientId],
  );
  const selfColor = settings.harborColor || nameColor(selfName);
  const playing = snap.status === "playing";

  const {
    drawMode,
    setDrawMode,
    hideOthersDrawings,
    setHideOthersDrawings,
    strokes,
    onDrawStart,
    onDrawPoint,
    onDrawEnd,
    clearStrokes,
  } = useDrawMode({
    inRoom,
    participantCount: roomSnapshot.participants.length,
    clientId,
    topPath,
    onIncomingDraw,
    sendDraw,
  });

  const { chromeVisible, wakeChrome, hideChrome, hideForResume, anyMenuOpen, setAnyMenuOpen, cursorStyle } = useChromeVisibility({
    playing,
    drawMode,
    pipMode,
    setChromeHidden,
    keyboardPauseShowsControls: settings.keyboardPauseShowsControls,
  });

  // The player covers everything, so focus has to come with it. Waking the
  // chrome first means there are transport buttons to land on — a remote handed
  // an empty stage has nowhere to go and no way to bring the controls back.
  useEffect(() => {
    if (!isDpadPrimary()) return;
    wakeChrome();
    const t = window.setTimeout(() => setFocusSafely(focusKeys.player), 120);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The remote's own rules inside the player: down brings the controls up
  // without pausing, OK pauses and brings them up, and nothing holds focus on a
  // bar nobody can see.
  useTvPlayerKeys({
    chromeVisible,
    playing: snap.status === "playing",
    anyMenuOpen,
    hasOverlay: failureReason != null,
    wakeChrome,
    hideChrome,
    pause: () => bridgeRef.current?.pause(),
  });

  const { adjacent, swappingEp, goToEpisode } = useEpisodeNavigation({
    src,
    settings,
    debrids,
    authKey,
    inRoom,
    isHost,
    sendInvite,
    claimHost,
    replacePlayerSrc,
    openPicker,
  });

  const canChangeEpisode = src.meta.type === "series" && (!inRoom || isHost);
  const roomGuest = inRoom && !isHost;
  const broadcastEpisode = useCallback(
    (ep: PlayEpisode) => {
      if (!inRoom || !isHost) return;
      claimHost(true);
      sendInvite(buildPlayInvite(src.meta, ep));
    },
    [inRoom, isHost, claimHost, sendInvite, src.meta],
  );

  const [autoNextCancelled, setAutoNextCancelled] = useState(false);
  useEffect(() => {
    setAutoNextCancelled(false);
  }, [src.url]);

  const startedNearEndRef = useStartedNearEnd(src.url, snap.status, snap.durationSec);

  const queue = useQueue();
  const sleepAtEndArmed = useSleepAtEnd();
  const queueOrSleepArmed = queue.length > 0 || sleepAtEndArmed;

  useAutoNextEpisode({
    src,
    snap,
    nextEp: settings.autoPlayNextEpisode && !queueOrSleepArmed ? adjacent.next : null,
    canChangeEpisode,
    cancelled: autoNextCancelled,
    startedNearEndRef,
    goToEpisode,
  });

  const quickToolsEnabled = !inRoom || isHost;
  const ab = useAbLoop({
    bridgeRef,
    durationSec: snap.durationSec,
    enabled: quickToolsEnabled,
    resetKey: src.url,
  });
  const sleep = useSleepTimer({
    bridgeRef,
    status: snap.status,
    durationSec: snap.durationSec,
    srcUrl: src.url,
  });
  const frameGrab = useFrameGrab({
    bridgeRef,
    src,
  });
  const gif = useGifRecorder({ src });
  const clip = useClipRecorder({ src });
  const svpToast = useSvpGuard(settings.playerSvp && !!settings.svpVpyPath);

  const { resolvedImdbId, subAssNative, captureExitSnapshot, download, subDropToast } = usePlayerMedia({
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
    castActiveRef: cast.castActiveRef,
    season,
    episode,
  });

  const contentAdvisory = useContentAdvisory(
    settings.contentAdvisoryToast,
    resolvedImdbId,
    src.url,
    playing,
  );

  const {
    setStreamCheckOpen,
    switcherOpen,
    setSwitcherOpen,
    swapResolvingKey,
    liveUrl,
    liveStreamRef,
    pickAnother,
    onSwitchStream,
  } = useStreamSwitcher({
    bridgeRef,
    src,
    snap,
    debrids,
  });
  const { hostSourceRef } = useHostSource({
    inRoom,
    isHost,
    hasStarted,
    src,
    liveUrl,
    liveStreamRef,
    snap,
    guestPickRef,
    publishState,
  });
  const guestHostSource =
    inRoom && !isHost && hostSourceMatchesMedia(hostSource, src.meta.id, src.episode ?? null)
      ? hostSource!.descriptor
      : null;
  const liveOverlay = useLiveChannelOverlay({
    src,
    replacePlayerSrc,
  });

  useCastReturnPublish({
    casting: !!cast.castDevice,
    inRoom,
    isHost,
    src,
    snapRef,
    hostSourceRef,
    guestPickRef,
    publishState,
  });

  const { closePlayer } = usePlayerExit({
    src,
    season,
    episode,
    liveUrl,
    liveStreamRef,
    inRoom,
    isHost,
    captureExitSnapshot,
    exitPip,
    castActiveRef: cast.castActiveRef,
    stopCast: cast.stopCast,
    publishState,
    notifyHostLeaving,
    clearInvite,
    exitPlayback,
  });
  useEffect(() => {
    const onLocalBack = (e: Event) => {
      e.preventDefault();
      void closePlayer();
    };
    window.addEventListener("harbor:local-back", onLocalBack);
    return () => window.removeEventListener("harbor:local-back", onLocalBack);
  }, [closePlayer]);

  const autoAdvancedRef = useRef(false);
  useEffect(() => {
    autoAdvancedRef.current = false;
  }, [src.url]);
  useEffect(() => {
    if (snap.status !== "error" || autoAdvancedRef.current) return;
    if (!src.autoFired || hasStarted || src.isLive || inRoom) return;
    autoAdvancedRef.current = true;
    if (src.streamRef) markStreamDead(src.streamRef, "load-failed", STUB_TTL_MS);
    exitPlayback();
    openPicker(src.meta, src.episode, {
      autoPlay: true,
      attempt: (src.attempt ?? 0) + 1,
      resume: src.resume,
    });
  }, [snap.status, src, hasStarted, inRoom, exitPlayback, openPicker]);

  const pickAnotherOrGuide = useCallback(() => {
    if (liveOverlay.isLive) {
      liveOverlay.setOpen(true);
    } else {
      pickAnother();
    }
  }, [liveOverlay, pickAnother]);

  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const { watchedFor } = usePlayerWatched({
    meta: src.meta,
    authKey,
    imdbId: resolvedImdbId,
    enabled: !!src.episode && (episodePanelOpen || !!adjacent.next),
  });
  const nextEpMask = spoilerMaskFor(settings, {
    watched: adjacent.next ? watchedFor(adjacent.next) : true,
    isNextUp: true,
  });
  const isSeriesPlayback = !!src.episode && src.meta.type === "series";

  const { inRoomRef, isHostRef, initialSyncDoneRef } = useRoomSync({
    inRoom,
    isHost,
    hasStarted,
    setHasStarted,
    selfFrameReadyRef,
    roomSnapshot,
    clientId,
    src,
    snap,
    bridgeRef,
    hostSourceRef,
    guestPickRef,
    publishState,
    onIncomingState,
    onIncomingCommand,
    markReady,
    suppressOutgoingFor,
    setForeignNotice,
    cast: cast.sync,
  });

  const lobby = useLobbyGate({
    inRoom,
    isHost,
    hasStarted,
    setHasStarted,
    roomSnapshot,
    startRoom,
    suppressOutgoingFor,
    bridgeRef,
    initialSyncDoneRef,
    mediaKey: `${src.meta.id}|${src.episode?.season ?? ""}|${src.episode?.episode ?? ""}`,
  });

  const { rememberSubChoice, cycleSubtitles, playPauseToggle, seekStep, seekTo } = usePlaybackControls({
    bridgeRef,
    snapRef,
    metaId: src.meta.id,
    inRoom,
    isHost,
    hasStarted,
    canControl,
    castDevice: cast.castDevice,
    startHost: lobby.startHost,
    togglePlayCast: cast.togglePlayCast,
    seekCast: cast.seekCast,
    sendCommand,
  });

  const textSync = useTextSync(bridgeRef.current, src.meta.id);
  const handleEnterSync = useCallback(() => {
    void textSync.enter();
  }, [textSync.enter, src.url, src.headers]);

  const volumeIndicatorTimerRef = useRef<number | null>(null);
  const [volumeIndicator, setVolumeIndicator] = useState<VolumeIndicatorState>({
    visible: false,
    volume: snap.volume,
    muted: snap.muted,
  });
  const volumeHudEnabled = settings.playerVolumeHud;
  const showVolumeFeedback = useCallback(
    (volume: number, muted: boolean) => {
      if (!volumeHudEnabled) return;
      if (volumeIndicatorTimerRef.current != null) {
        window.clearTimeout(volumeIndicatorTimerRef.current);
      }
      setVolumeIndicator({ visible: true, volume, muted });
      volumeIndicatorTimerRef.current = window.setTimeout(() => {
        setVolumeIndicator((current) => ({ ...current, visible: false }));
        volumeIndicatorTimerRef.current = null;
      }, 1200);
    },
    [volumeHudEnabled],
  );
  useEffect(() => {
    return () => {
      if (volumeIndicatorTimerRef.current != null) {
        window.clearTimeout(volumeIndicatorTimerRef.current);
      }
    };
  }, []);

  const videoFill = useVideoFill(bridgeRef, src.url, playing);
  useLivePictureEq(bridgeRef, src.url);
  const { holdSpeedActive, showStats } = usePlayerHotkeys({
    bridgeRef,
    snap,
    metaId: src.meta.id,
    drawMode,
    setDrawMode,
    closePlayer,
    playPauseToggle,
    seekStep,
    seekTo,
    toggleFullscreen,
    togglePip: togglePipMode,
    fullscreen,
    cycleSubtitles,
    canChangeEpisode,
    adjacent,
    goToEpisode,
    toggleSwitcher: () => setSwitcherOpen((v) => !v),
    toggleEpisodePanel: () => setEpisodePanelOpen((v) => !v),
    liveOverlay,
    sleep,
    quickToolsEnabled,
    frameGrab,
    gif,
    clip,
    videoFill,
    onVolumeFeedback: showVolumeFeedback,
  });

  const { pendingResumeSec, acknowledgeResume, pendingSeekSec, clearPendingSeek } = useBridgeLoad({
    bridgeRef,
    inRoomRef,
    isHostRef,
    bridgeReady,
    bridgeKey,
    src,
    transcodedUrl,
    season,
    episode,
    authKey,
    resumeOverrideRef,
  });

  usePendingSeekApply({
    pendingSeekSec,
    clearPendingSeek,
    durationSec: snap.durationSec,
    bridgeRef,
    inRoomRef,
  });

  // A dead link is a failure like any other now: it says so and waits, rather
  // than reopening the source list or closing the player from under the viewer.
  useStubDetection({
    src,
    snap,
    onStub: () => surrender("the source is no longer there"),
    instantPlay: settings.instantPlay,
  });

  const isLiveLike =
    liveOverlay.isLive ||
    !!src.meta.id?.startsWith("iptv:") ||
    (!!src.meta.type && !["movie", "series", "anime"].includes(String(src.meta.type).toLowerCase()));
  const reloadLive = useCallback(() => {
    bridgeRef.current?.load({
      url: src.url,
      subtitles: src.subtitles,
      notWebReady: src.notWebReady,
      isLive: true,
      headers: src.headers,
    });
  }, [src.url, src.subtitles, src.notWebReady, src.headers]);

  useAutoEndExit({
    src,
    snap,
    nextEp: adjacent.next,
    canChangeEpisode,
    roomGuest,
    isLive: isLiveLike,
    suspend: queueOrSleepArmed && !isLiveLike,
    startedNearEndRef,
    reloadLive,
    closePlayer,
  });

  useQueueAdvance({
    src,
    snap,
    queue,
    isLive: isLiveLike,
    startedNearEndRef,
    openPicker,
    exitPlayer,
  });

  const isLocalSrc = isLocalUrl(src.url);
  const playStreamRef = liveStreamRef ?? src.streamRef;
  const playUrl = liveUrl ?? src.url;
  const adSegments = useAdSegments(
    src.meta.id,
    src.imdbId ?? null,
    playStreamRef,
    playUrl,
    withinAdWindow(src.meta) || settings.adSkipEnabled,
  );
  const skipSegments = useSkipSegments(
    src.meta,
    src.episode,
    snap.chapters,
    snap.durationSec,
    adSegments,
  );
  useEffect(() => {
    setSkipSegmentsView(skipSegments);
    return () => setSkipSegmentsView([]);
  }, [skipSegments]);
  const hasNextEpisodeNow = canChangeEpisode && !!adjacent.next;

  useSdrBoostGate({
    engine,
    hdrGamma: snap.hdrGamma,
    enabled: settings.mpvTweaks?.["inverse-tone-mapping"] === "yes",
  });

  // The HDR stage was a dedicated always-on-top window that rendered the video
  // while the page kept only the controls. There is no second window here.
  const hdrStageActive = false;

  const { stageBg } = embedFlags(engine);
  const { loaderActive: everPlayedLoader } = useEverPlayed({
    url: src.url,
    status: snap.status,
    durationSec: snap.durationSec,
    swappingEp,
    swapResolvingKey,
  });
  // Once the failure panel is up, "connecting" is no longer true and the loader
  // would sit over it — leaving a spinner and a Cancel button as the only thing
  // on screen, which is the very symptom the panel exists to replace.
  const loaderActive = everPlayedLoader && !failureReason;
  const [loaderShowing, setLoaderShowing] = useState(false);
  const showChrome = !loaderActive && !loaderShowing && (chromeVisible || drawMode);
  const liveShellSnap = cast.castDevice
    ? { ...snap, status: (cast.castPlaying ? "playing" : "paused") as typeof snap.status }
    : snap;
  if (showChrome) shellSnapRef.current = liveShellSnap;
  const shellSnap = showChrome ? liveShellSnap : shellSnapRef.current;
  const volumeRef = useRef(snap.volume);
  useEffect(() => {
    volumeRef.current = snap.volume;
  }, [snap.volume]);
  const onVolumeWheel = useCallback((deltaY: number) => {
    const dir = deltaY < 0 ? 1 : -1;
    const boost = !isKid && bridgeRef.current?.capabilities().engine === "mpv";
    const max = boost ? 6 : 1;
    const next = Math.min(max, Math.max(0, volumeRef.current + dir * 0.05));
    volumeRef.current = next;
    bridgeRef.current?.setVolume(next);
    bridgeRef.current?.setMuted(false);
    writePlayerVolume({ volume: next, muted: false });
    showVolumeFeedback(next, false);
  }, [showVolumeFeedback, isKid]);

  const overlayProps: PlayerOverlayLayersProps = {
    snap,
    engine,
    src,
    adStreamRef: playStreamRef,
    adUrl: playUrl,
    subShowInPip: settings.subShowInPip,
    subAssNative,
    showStats,
    holdSpeedActive,
    volumeIndicator,
    volumeHudPosition: settings.playerVolumeHudPosition,
    videoFillPill: videoFill.pill,
    cropMode: videoFill.mode,
    onCropMode: videoFill.setMode,
    subDropToast: svpToast ?? subDropToast,
    pipMode,
    drawMode,
    cast,
    pickAnother,
    pickAnotherOrGuide,
    playPauseToggle,
    toggleFullscreen,
    onVolumeWheel,
    onVolumeFeedback: showVolumeFeedback,
    isLocalSrc,
    swappingEp,
    swapResolvingKey,
    closePlayer,
    cancelToPicker: () => {
      if (isLocalSrc || src.meta.id?.startsWith("iptv:")) {
        void closePlayer();
        return;
      }
      openPicker(src.meta, src.episode, { autoPlay: false });
    },
    engineStats,
    isP2pEngine,
    setLoaderShowing,
    onLoaderRetry: () => {
      const b = bridgeRef.current;
      if (b) {
        void b.load({ url: src.url, subtitles: src.subtitles, notWebReady: src.notWebReady, isLive: src.meta.id?.startsWith("iptv:"), headers: src.headers });
      }
    },
    bridgeRef,
    strokes,
    hideOthersDrawings,
    clientId,
    selfName,
    selfColor,
    onDrawStart,
    onDrawPoint,
    onDrawEnd,
    clearStrokes,
    showWaiting,
    pendingResumeSec,
    pendingSeekSec,
    skipSegments,
    hasNextEpisode: hasNextEpisodeNow,
    hasNextEpDisplay: canChangeEpisode && !autoNextCancelled && !!adjacent.next,
    nextEp: canChangeEpisode && !autoNextCancelled ? adjacent.next : null,
    nextEpMask,
    pillsVisible: hasStarted || !inRoom,
    allowAutoSkip: !roomGuest,
    seekTo,
    goToEpisode,
    setAutoNextCancelled,
    showChrome,
    ab,
    frameGrabToast: frameGrab.toast,
    onScreenshot: () => frameGrab.trigger(),
    gif,
    clip,
    loaderActive,
    playbackFailed: failureReason != null,
    playerShellId: settings.playerShellId,
    shellSnap,
    snapRef,
    fullscreen,
    showDraw: inRoom && roomSnapshot.participants.length > 1 && !cast.castDevice,
    metaId: src.meta.id,
    setAnyMenuOpen,
    onSeekStep: seekStep,
    rememberSubChoice,
    togglePipMode,
    setDrawMode,
    wakeChrome,
    setHideOthersDrawings,
    canPickAnother: !liveOverlay.isLive || !inRoom || isHost,
    alternateEngine,
    onSwitchEngine: switchEngine,
    resolvedImdbId,
    contentAdvisory,
    tmdbKey: settings.tmdbKey ?? null,
    download: isLocalSrc ? undefined : download,
    liveOverlay,
    sleep,
    adjacentPrev: adjacent.prev,
    adjacentNext: adjacent.next,
    canChangeEpisode,
    inRoom,
    participants: roomSnapshot.participants,
    hostClientId: roomSnapshot.hostClientId,
    syncState: roomSnapshot.syncState,
    avatarsVisible: chromeVisible || !playing,
    presenceMap,
    participantLocations,
    now,
    avatarsCorner,
    avatarsHidden,
    chat,
    sendChat,
    chromeVisible,
    chatCorner,
    chatHidden,
    isHost,
    staleIds: lobby.staleIds,
    guestEscapeReady: lobby.guestEscapeReady,
    onStart: lobby.startHost,
    onPlayWithoutSync: lobby.playWithoutSync,
    guestHostSource,
    liveUrl,
    currentInfoHash: playStreamRef?.infoHash ?? null,
    currentFileIdx: playStreamRef?.fileIdx ?? null,
    currentRef: playStreamRef ?? null,
    switcherOpen,
    foreignNotice,
    onDismissForeign: () => setForeignNotice(null),
    setStreamCheckOpen,
    setSwitcherOpen,
    onSwitchStream,
    debridSlugs: debrids.map((d) => d.slug),
    isSeriesPlayback,
    episodePanelOpen,
    setEpisodePanelOpen,
    upNextButtonVisible:
      isSeriesPlayback && chromeVisible && !episodePanelOpen && !switcherOpen && !pipMode && !drawMode && !episodesHidden && !roomGuest,
    episodesCorner,
    episodesHidden,
    roomGuest,
    onHostAdvance: broadcastEpisode,
    watchedFor,
    acknowledgeResume,
    // Text-sync props (preserved from fork)
    onEnterSync: handleEnterSync,
    syncMode: textSync.syncMode,
    syncApi: textSync,
    onSyncPlayPause: playPauseToggle,
  };
  return (
    // A boundary, because nothing behind a playing video should be reachable:
    // pressing left past the first transport button must not land the user on
    // the sidebar of the page underneath.
    <FocusSection
      as="main"
      isFocusBoundary
      focusKey={focusKeys.player}
      ref={stageRef}
      data-viora-player
      dir="ltr"
      className={`fixed inset-0 z-[100] overflow-hidden ${stageBg}`}
      style={cursorStyle}
      onMouseMove={isDpadPrimary() ? undefined : wakeChrome}
      onMouseEnter={isDpadPrimary() ? undefined : wakeChrome}
    >
      <div
        ref={videoMountRef}
        className="absolute inset-0"
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          if (drawMode || pipMode) return;
          const resuming = snap.status !== "playing";
          playPauseToggle();
          if (resuming) hideForResume();
        }}
      />
      {!hdrStageActive && <PlayerOverlayLayers {...overlayProps} />}
      {failureReason && (
        <PlaybackFailedPanel
          errorCode={snap.errorCode}
          reason={snap.errorMessage ?? failureReason}
          alternateEngine={alternateEngine}
          onRetry={retry}
          onSwitchEngine={switchEngine}
          onPickAnother={pickAnotherOrGuide}
          onLeave={() => void closePlayer()}
        />
      )}
      <LeaveConfirmModal />
    </FocusSection>
  );
}
