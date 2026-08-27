import {
  emptySnapshot,
  type PlayerBridge,
  type PlayerCapabilities,
  type PlayerEngine,
  type PlayerSnapshot,
  type PlayerSource,
  type TrackInfo,
} from "./bridge";
import { fetchAndParse, findActiveCue, type SubCue } from "@/lib/subtitles/parser";

/**
 * The page half of both native engines.
 *
 * ExoPlayer and mpv decode onto a surface behind this page, and the page never
 * sees a `<video>` element at all. What it does instead is ask, a few times a
 * second, for the whole of the native player's state and turn that into the same
 * `PlayerSnapshot` the HTML5 bridge produces — so every control, menu and
 * overlay above this file works without knowing which engine answered.
 *
 * One file serves both because the two Android engines were deliberately given
 * the same verbs. Where they genuinely differ — mpv can shift the audio clock
 * and amplify past 100%, ExoPlayer can do neither — the difference is a field in
 * the config below or a method the native side simply does not expose, rather
 * than a second copy of four hundred lines.
 *
 * Subtitles are split on purpose. Tracks muxed into the file come back from the
 * native side as cue text, because only the decoder can see them. Tracks the app
 * fetched — OpenSubtitles and the rest — are parsed and timed here, because that
 * is the case where the viewer reaches for the delay control, and a delay is
 * only honest when the side applying it holds every cue.
 */

type NativeEngine = {
  available(): boolean;
  load(spec: string): boolean;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  setRate(r: number): void;
  setAudioTrack(id: string): void;
  setSubtitleTrack(id: string): void;
  setSubVisible(on: boolean): void;
  setSubDelay(sec: number): void;
  setGeometry(mode: string, aspect: number, zoom: number): void;
  state(): string;
  release(): void;
  /** mpv only; ExoPlayer takes the call and does nothing with it. */
  setAudioDelay?(sec: number): void;
  /** mpv only: the libplacebo shader chain. */
  setShaders?(paths: string): void;
  /** mpv only: a loudness filter in the audio graph. */
  setAudioNormalize?(on: boolean): void;
};

export type NativeEngineConfig = {
  /** The name the Android side registered this bridge under. */
  globalName: string;
  engine: PlayerEngine;
  /** mpv amplifies past unity; ExoPlayer's gain is a plain multiplier. */
  maxVolume: number;
};

type NativeTrack = {
  id: string;
  lang: string;
  label: string;
  codec: string;
  channelCount: number;
  selected: boolean;
  supported: boolean;
  forced: boolean;
  default: boolean;
};

type NativeState = {
  status?: PlayerSnapshot["status"];
  positionSec?: number;
  durationSec?: number;
  bufferedSec?: number;
  buffering?: boolean;
  volume?: number;
  muted?: boolean;
  rate?: number;
  videoWidth?: number;
  videoHeight?: number;
  subText?: string;
  subStartSec?: number;
  subDelaySec?: number;
  audioDelaySec?: number;
  hdrGamma?: string;
  errorMessage?: string;
  errorCode?: PlayerSnapshot["errorCode"];
  audioTracks?: NativeTrack[];
  subtitleTracks?: NativeTrack[];
};

type ExternalTrack = {
  id: string;
  url: string;
  lang?: string;
  title?: string;
  cues: SubCue[] | null;
  loading: boolean;
  /**
   * The same cues, re-timed by auto-sync. The parsed originals are kept beside
   * them so the correction can be dropped, or recomputed, without fetching the
   * file again.
   */
  syncedCues?: SubCue[] | null;
};

const POLL_MS = 180;
const EXTERNAL_PREFIX = "ext-";

function nativeAt(globalName: string): NativeEngine | null {
  const bridge = (window as unknown as Record<string, NativeEngine | undefined>)[globalName];
  if (!bridge || typeof bridge.state !== "function") return null;
  return bridge;
}

/**
 * Whether this build carries the named engine and can run it here.
 *
 * The Android side answers for itself — mpv's answer depends on whether the
 * shared library for this device's architecture actually shipped — so a missing
 * engine is reported rather than discovered halfway through a film.
 */
export function isNativeEngineAvailable(globalName: string): boolean {
  const bridge = nativeAt(globalName);
  if (!bridge) return false;
  try {
    return bridge.available() === true;
  } catch {
    return false;
  }
}

/** "16:9" and friends; "-1" is the file's own ratio. */
function parseAspect(ratio: string): number {
  if (!ratio || ratio === "-1") return -1;
  const parts = ratio.split(":");
  if (parts.length === 2) {
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (Number.isFinite(w) && Number.isFinite(h) && h > 0) return w / h;
  }
  const flat = Number(ratio);
  return Number.isFinite(flat) && flat > 0 ? flat : -1;
}

export function createNativeBridge(config: NativeEngineConfig): PlayerBridge {
  const native = () => nativeAt(config.globalName);
  let host: HTMLElement | null = null;
  let snap: PlayerSnapshot = { ...emptySnapshot };
  const listeners = new Set<(s: PlayerSnapshot) => void>();

  const externals: ExternalTrack[] = [];
  let activeSubId: string | null = null;
  let subDelaySec = 0;
  let lastCueId = "";

  let nativeSubs: NativeTrack[] = [];
  let nativeAudio: NativeTrack[] = [];

  let panscan = 0;
  let stretch = false;
  let aspect = "-1";
  let zoom = 0;

  let abLoopA: number | null = null;
  let abLoopB: number | null = null;

  let raf: number | null = null;
  let lastPollAt = 0;
  let pollPosition = 0;
  let pollAt = 0;
  let lastEmitAt = 0;

  const emit = () => {
    const next: PlayerSnapshot = { ...snap };
    listeners.forEach((l) => l(next));
  };

  /**
   * Whether this app owns the timing of a track, rather than the decoder.
   *
   * Asked of the list, not of the name. Tracks added from the subtitle menu are
   * named `ext-…` here, but the ones that arrive with the stream keep the id the
   * addon gave them — `cnm-ara`, for instance. Testing the prefix filed those
   * under embedded, so selecting one asked the engine for a track it had never
   * heard of while the cue loop skipped the file the app had just parsed:
   * measured on Silo S1E3, both Cinemana subtitles downloaded and parsed, and
   * neither ever reached the screen.
   */
  const isExternal = (id: string | null): boolean => !!id && externals.some((t) => t.id === id);

  const mapTracks = (list: NativeTrack[], kind: "audio" | "subtitle"): TrackInfo[] =>
    list.map((t, i) => ({
      id: t.id,
      label: t.label || (t.lang ? t.lang.toUpperCase() : `${kind === "audio" ? "Audio" : "Subtitle"} ${i + 1}`),
      lang: t.lang || undefined,
      title: t.label || undefined,
      kind,
      selected: kind === "subtitle" ? t.id === activeSubId : t.selected,
      codec: t.codec || undefined,
      channelCount: t.channelCount || undefined,
      forced: t.forced,
      default: t.default,
    }));

  const subtitleTracks = (): TrackInfo[] => [
    ...mapTracks(nativeSubs, "subtitle"),
    ...externals.map((t) => ({
      id: t.id,
      label: t.title || (t.lang ? t.lang.toUpperCase() : "Subtitle"),
      lang: t.lang,
      title: t.title,
      kind: "subtitle" as const,
      selected: t.id === activeSubId,
      external: true,
      url: t.url,
    })),
  ];

  const ensureLoaded = async (track: ExternalTrack) => {
    if (track.cues || track.loading) return;
    track.loading = true;
    try {
      track.cues = await fetchAndParse(track.url);
    } catch (e) {
      console.warn(`[exo] failed to load ${track.url}`, e);
      track.cues = [];
    } finally {
      track.loading = false;
      snap.subtitleTracks = subtitleTracks();
      emit();
    }
  };

  /**
   * Position between polls.
   *
   * The native side is asked five times a second, which is plenty for buffering
   * and track changes but makes a seek bar step rather than move, and puts a
   * subtitle up to a fifth of a second late. Advancing the last reading by the
   * wall clock costs nothing and hides both.
   */
  const estimatedPosition = (): number => {
    if (snap.status !== "playing") return pollPosition;
    const elapsed = (performance.now() - pollAt) / 1000;
    return pollPosition + elapsed * (snap.rate || 1);
  };

  const tickExternalCue = () => {
    if (!isExternal(activeSubId)) return;
    const track = externals.find((t) => t.id === activeSubId);
    const at = estimatedPosition() - subDelaySec;
    const timed = track?.syncedCues ?? track?.cues;
    const cue = timed ? findActiveCue(timed, at) : null;
    const text = cue?.text ?? "";
    const cueId = `${cue?.start ?? 0}|${text}`;
    if (cueId === lastCueId) return;
    lastCueId = cueId;
    snap.subText = text;
    snap.subStartSec = cue?.start ?? 0;
    emit();
  };

  const poll = () => {
    const bridge = native();
    if (!bridge) return;
    let state: NativeState;
    try {
      state = JSON.parse(bridge.state()) as NativeState;
    } catch {
      return;
    }
    const before = snap.status;
    snap.status = state.status ?? "idle";
    snap.durationSec = state.durationSec ?? 0;
    snap.bufferedSec = state.bufferedSec ?? 0;
    snap.buffering = state.buffering ?? false;
    snap.volume = state.volume ?? 1;
    snap.muted = state.muted ?? false;
    snap.rate = state.rate ?? 1;
    snap.videoWidth = state.videoWidth ?? 0;
    snap.videoHeight = state.videoHeight ?? 0;
    snap.errorMessage = state.errorMessage ?? null;
    snap.errorCode = state.errorCode ?? null;
    snap.subDelaySec = subDelaySec;
    snap.audioDelaySec = state.audioDelaySec ?? 0;
    snap.hdrGamma = state.hdrGamma ?? "";

    pollPosition = state.positionSec ?? 0;
    pollAt = performance.now();
    snap.positionSec = pollPosition;

    const audio = state.audioTracks ?? [];
    const subs = state.subtitleTracks ?? [];
    const audioChanged =
      audio.length !== nativeAudio.length ||
      audio.some((t, i) => t.id !== nativeAudio[i]?.id || t.selected !== nativeAudio[i]?.selected);
    const subsChanged = subs.length !== nativeSubs.length || subs.some((t, i) => t.id !== nativeSubs[i]?.id);
    nativeAudio = audio;
    nativeSubs = subs;
    if (audioChanged) snap.audioTracks = mapTracks(nativeAudio, "audio");
    if (subsChanged || audioChanged) snap.subtitleTracks = subtitleTracks();

    // Only the embedded tracks are timed natively; an external one is this
    // file's business and would be overwritten by the empty string here.
    if (!isExternal(activeSubId)) {
      snap.subText = state.subText ?? "";
      snap.subStartSec = state.subStartSec ?? 0;
    }

    if (
      snap.status === "playing" &&
      snap.positionSec > 3 &&
      nativeAudio.length === 0 &&
      !snap.noAudio
    ) {
      snap.noAudio = true;
    }
    if (before !== snap.status) emit();
  };

  const applyAbLoop = () => {
    if (abLoopA == null || abLoopB == null) return;
    if (estimatedPosition() >= abLoopB) {
      native()?.seek(abLoopA);
      pollPosition = abLoopA;
      pollAt = performance.now();
    }
  };

  const frame = () => {
    raf = window.requestAnimationFrame(frame);
    const now = performance.now();
    if (now - lastPollAt >= POLL_MS) {
      lastPollAt = now;
      poll();
    }
    applyAbLoop();
    tickExternalCue();
    // The seek bar reads the clock rather than the snapshot, so this is the
    // only thing that has to run often; ten times a second is smooth on a
    // television and leaves the rest of the frame alone.
    if (now - lastEmitAt >= 100) {
      lastEmitAt = now;
      snap.positionSec = estimatedPosition();
      emit();
    }
  };

  const startLoop = () => {
    if (raf != null) return;
    lastPollAt = 0;
    raf = window.requestAnimationFrame(frame);
  };

  const stopLoop = () => {
    if (raf == null) return;
    window.cancelAnimationFrame(raf);
    raf = null;
  };

  const pushGeometry = () => {
    const mode = stretch ? "stretch" : panscan > 0 ? "fill" : "fit";
    native()?.setGeometry(mode, parseAspect(aspect), zoom);
  };

  return {
    attach(h) {
      host = h;
      // Nothing is drawn here — the picture is behind the page — so the mount
      // must stay clear of it.
      host.style.background = "transparent";
    },
    detach() {
      host = null;
    },
    async load(src: PlayerSource) {
      externals.length = 0;
      activeSubId = null;
      subDelaySec = 0;
      lastCueId = "";
      nativeSubs = [];
      nativeAudio = [];
      snap = { ...emptySnapshot, status: "loading" };
      if (src.subtitles?.length) {
        src.subtitles.forEach((s, i) => {
          externals.push({
            id: s.id ?? `${EXTERNAL_PREFIX}seed-${i}`,
            url: s.url,
            lang: s.lang,
            title: undefined,
            cues: null,
            loading: false,
          });
        });
      }
      snap.subtitleTracks = subtitleTracks();
      emit();
      const bridge = native();
      if (!bridge) {
        snap.status = "error";
        snap.errorCode = "unknown";
        snap.errorMessage = "The native player is not available in this build.";
        emit();
        return;
      }
      bridge.load(
        JSON.stringify({
          url: src.url,
          startAtSec: src.startAtSec ?? 0,
          headers: src.headers ?? {},
        }),
      );
      pollPosition = src.startAtSec ?? 0;
      pollAt = performance.now();
      pushGeometry();
      startLoop();
    },
    async play() {
      native()?.play();
    },
    pause() {
      native()?.pause();
    },
    frameStep(dir) {
      const bridge = native();
      if (!bridge) return;
      bridge.pause();
      bridge.seek(Math.max(0, estimatedPosition() + dir * (1 / 24)));
    },
    seek(sec) {
      const bridge = native();
      if (!bridge) return;
      const max = snap.durationSec > 0 ? snap.durationSec - 0.25 : sec;
      const target = Math.max(0, Math.min(sec, max));
      bridge.seek(target);
      pollPosition = target;
      pollAt = performance.now();
      snap.positionSec = target;
      lastCueId = "";
      emit();
    },
    setVolume(v) {
      const clamped = Math.max(0, Math.min(config.maxVolume, v));
      native()?.setVolume(clamped);
      snap.volume = clamped;
      emit();
    },
    setMuted(m) {
      native()?.setMuted(m);
      snap.muted = m;
      emit();
    },
    setRate(r) {
      native()?.setRate(r);
      snap.rate = r;
      emit();
    },
    setAudioTrack(id) {
      native()?.setAudioTrack(id);
    },
    setSubtitleTrack(id) {
      activeSubId = id;
      lastCueId = "";
      if (id == null) {
        native()?.setSubtitleTrack("");
        snap.subText = "";
        snap.subStartSec = 0;
      } else if (isExternal(id)) {
        // The decoder stops producing cues; this file starts.
        native()?.setSubtitleTrack("");
        snap.subText = "";
        const track = externals.find((t) => t.id === id);
        if (track) void ensureLoaded(track);
      } else {
        native()?.setSubtitleTrack(id);
      }
      snap.subtitleTracks = subtitleTracks();
      emit();
    },
    setSubVisible() {
      // Deliberately nothing, exactly as the HTML5 bridge does.
      //
      // This asks the *engine* to stop drawing subtitles itself, which desktop
      // mpv does when it renders into its own window. Neither Android engine
      // ever draws them — both hand the text up for the page to render in the
      // viewer's chosen font — so there is nothing here to switch off. Treating
      // it as "stop showing subtitles" instead is what made the mpv engine play
      // with the text permanently blank: the player calls this with `false` for
      // every non-ASS track, meaning "you draw them, not me".
      //
      // Turning subtitles off is a different call: `setSubtitleTrack(null)`.
    },
    setSubDelay(sec) {
      subDelaySec = sec;
      lastCueId = "";
      snap.subDelaySec = sec;
      native()?.setSubDelay(sec);
      emit();
    },
    setAudioDelay(sec) {
      // Present on mpv, absent on ExoPlayer; the menu offering it is disabled
      // there, so an engine without the method simply ignores the request.
      native()?.setAudioDelay?.(sec);
    },
    setPanscan(value) {
      panscan = value;
      pushGeometry();
    },
    setVideoZoom(log2) {
      zoom = log2;
      pushGeometry();
    },
    setAspectOverride(ratio) {
      aspect = ratio;
      pushGeometry();
    },
    setStretch(on) {
      stretch = on;
      pushGeometry();
    },
    setVideoEq() {},
    async addSubtitle(url, lang, title, select): Promise<boolean> {
      const id = `${EXTERNAL_PREFIX}${externals.length}-${Date.now()}`;
      const track: ExternalTrack = { id, url, lang, title, cues: null, loading: false };
      externals.push(track);
      if (select === true) {
        activeSubId = id;
        lastCueId = "";
        native()?.setSubtitleTrack("");
        await ensureLoaded(track);
      }
      snap.subtitleTracks = subtitleTracks();
      emit();
      return true;
    },
    getSelectedTrackCues() {
      return externals.find((t) => t.id === activeSubId)?.cues ?? null;
    },
    getTrackCues(trackId) {
      return externals.find((t) => t.id === trackId)?.cues ?? null;
    },
    async loadTrackCues(trackId) {
      const track = externals.find((t) => t.id === trackId);
      if (!track) return null;
      // The same fetch the viewer's own choice goes through, so a reference
      // costs one small download and nothing on screen moves.
      await ensureLoaded(track);
      return track.cues;
    },
    applySubtitleSync(trackId, shift) {
      const track = externals.find((t) => t.id === trackId);
      if (!track?.cues) return false;
      // A derived list, not an edit: `cues` still holds what the file said.
      track.syncedCues = track.cues.map((c) => ({
        start: Math.max(0, c.start + shift(c.start)),
        end: Math.max(0, c.end + shift(c.end)),
        text: c.text,
      }));
      lastCueId = "";
      tickExternalCue();
      return true;
    },
    clearSubtitleSync(trackId) {
      const track = externals.find((t) => t.id === trackId);
      if (!track) return;
      track.syncedCues = null;
      lastCueId = "";
      tickExternalCue();
    },
    getSelectedTrackUrl() {
      return externals.find((t) => t.id === activeSubId)?.url ?? null;
    },
    setAudioNormalize(on) {
      native()?.setAudioNormalize?.(on);
    },
    async screenshot() {
      return { ok: false, error: "The native engine does not capture frames." };
    },
    setAbLoop(a, b) {
      abLoopA = a;
      abLoopB = b;
    },
    async requestPiP() {},
    async exitPiP() {},
    async requestFullscreen() {},
    async exitFullscreen() {},
    capabilities(): PlayerCapabilities {
      return {
        engine: config.engine,
        pictureInPicture: false,
        airplay: false,
        chromecast: false,
        // Both engines hand HDR straight to the display; nothing in this path
        // tone-maps it down the way a WebView <video> would.
        hdrPassthrough: true,
        // mpv falls back to its own decoders when the device has none, which is
        // the point of it, but the common path is still MediaCodec.
        hardwareDecode: true,
      };
    },
    subscribe(l) {
      listeners.add(l);
      l(snap);
      return () => {
        listeners.delete(l);
      };
    },
    destroy() {
      stopLoop();
      native()?.release();
      externals.length = 0;
      activeSubId = null;
      nativeSubs = [];
      nativeAudio = [];
      host = null;
      listeners.clear();
    },
  };
}
