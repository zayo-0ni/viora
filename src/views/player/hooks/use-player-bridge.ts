import { useEffect, useRef, useState, type RefObject } from "react";
import { type PlayerEngine, emptySnapshot, type PlayerBridge, type PlayerSnapshot } from "@/lib/player/bridge";
import { probeMpv } from "@/lib/player/mpv";
import { isMpvAndroidAvailable } from "@/lib/player/mpv-android";
import { isExoAvailable } from "@/lib/player/exo";
import type { PlayerSrc } from "@/lib/view";
import type { Settings } from "@/lib/settings";
import { getPlaybackPosition, setPlaybackClock } from "@/lib/player/playback-clock";
import { svpEnsureRunning } from "@/lib/svp";
import { pickBridge } from "../player-utils";

function snapChangedIgnoringClock(a: PlayerSnapshot, b: PlayerSnapshot): boolean {
  return (
    a.status !== b.status ||
    a.durationSec !== b.durationSec ||
    a.volume !== b.volume ||
    a.muted !== b.muted ||
    a.rate !== b.rate ||
    a.audioTracks !== b.audioTracks ||
    a.subtitleTracks !== b.subtitleTracks ||
    a.chapters !== b.chapters ||
    a.subDelaySec !== b.subDelaySec ||
    a.audioDelaySec !== b.audioDelaySec ||
    a.subText !== b.subText ||
    a.subStartSec !== b.subStartSec ||
    a.audioNormalize !== b.audioNormalize ||
    a.videoWidth !== b.videoWidth ||
    a.videoHeight !== b.videoHeight ||
    a.hdrGamma !== b.hdrGamma ||
    a.errorMessage !== b.errorMessage ||
    a.errorCode !== b.errorCode
  );
}

export function usePlayerBridge(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  videoMountRef: RefObject<HTMLDivElement | null>;
  src: PlayerSrc;
  settings: Settings;
  /** Where the next load should start, when a switch has to keep the place. */
  resumeOverrideRef: RefObject<number | null>;
}) {
  const { bridgeRef, videoMountRef, src, settings, resumeOverrideRef } = params;

  const [snap, setSnap] = useState<PlayerSnapshot>(emptySnapshot);
  const prevSnapRef = useRef<PlayerSnapshot>(emptySnapshot);
  const [engine, setEngine] = useState<PlayerEngine>("exo");
  const [autoFallbackTried, setAutoFallbackTried] = useState(false);
  // Chosen from inside the player, for this stream only. The setting in
  // Settings is what the next film starts on; this is the viewer saying "not
  // this one, try the other engine" without leaving what they are watching.
  const [engineOverride, setEngineOverride] = useState<PlayerEngine | null>(null);
  useEffect(() => {
    setEngineOverride(null);
  }, [src.url]);

  // The opaque HDR window was a Windows arrangement: a second, always-on-top
  // window carrying the video so the compositor left the colours alone. There
  // is one WebView here and no window to open.
  const embedActive = settings.playerMpvEmbed;
  const svpOn = settings.playerSvp && !!settings.svpVpyPath;
  useEffect(() => {
    if (svpOn) void svpEnsureRunning().catch(() => {});
  }, [svpOn]);
  // Where to escalate when the chosen engine cannot decode what it was handed:
  // whichever engine on this device plays the most, which is mpv where mpv is
  // compiled into the app. ExoPlayer is the answer only where there is no mpv.
  const fallbackEngine: PlayerEngine = isMpvAndroidAvailable() ? "mpv" : "exo";
  // Live channels used to be forced onto the web layer, decoding HLS in
  // JavaScript. Both native engines demux HLS and MPEG-TS themselves, with the
  // television's own decoders, so a channel is now just another stream.
  const chosenEngine = engineOverride
    ? engineOverride
    : autoFallbackTried
      ? fallbackEngine
      : settings.playerEngine;
  const bridgeKey = `${chosenEngine}|${settings.playerHdrToSdr}|${embedActive}|${svpOn}|${svpOn ? settings.svpVpyPath : ""}`;
  const [bridgeReady, setBridgeReady] = useState(false);
  useEffect(() => {
    const host = videoMountRef.current;
    if (!host) return;
    let cancelled = false;
    let off: (() => void) | null = null;
    let bridge: PlayerBridge | null = null;
    setBridgeReady(false);
    (async () => {
      const { bridge: choose, engine: chosen } = await pickBridge(chosenEngine);
      if (cancelled) return;
      bridge = choose;
      bridge.attach(host);
      bridgeRef.current = bridge;
      setEngine(chosen);
      off = bridge.subscribe((s) => {
        setPlaybackClock(s.positionSec, s.bufferedSec);
        if (snapChangedIgnoringClock(prevSnapRef.current, s)) {
          prevSnapRef.current = s;
          setSnap(s);
        }
      });
      setBridgeReady(true);
    })();
    return () => {
      cancelled = true;
      setBridgeReady(false);
      off?.();
      bridge?.destroy();
      bridgeRef.current = null;
      setPlaybackClock(0, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeKey]);

  useEffect(() => {
    if (autoFallbackTried) return;
    // Already on the most capable engine this device has: there is nowhere
    // left to escalate to, and retrying would only loop.
    if (engine === fallbackEngine) return;
    // A hand-picked engine used to be exempt from this, on the reasoning that
    // swapping it out is what the viewer was overriding. That holds while the
    // engine plays. It stops holding the moment it reports that it cannot decode
    // the file: honouring the choice then means honouring a black screen, and
    // "try the other engine" is what pressing that button meant in the first
    // place. Escalating once is the answer to the request, not a betrayal of it.
    //
    // Reproduced on the emulator, switching to ExoPlayer mid-film:
    //   Decoder init failed: [-49999], Format(2, null, video/x-matroska, audio/ac3)
    // Plain AC-3 — no decoder on that device, nothing for MediaCodec's own
    // fallback to reach, and mpv playing the same file a second earlier.
    //
    // Only one escalation happens: autoFallbackTried above closes the door, and
    // being already on the fallback engine returns before this.
    //
    // The Settings choice used to gate this too — only "auto" was rescued. That
    // was right on the desktop, where "auto" was an option you could pick. The
    // Android panel offers exactly two engines, ExoPlayer and mpv, so the moment
    // anyone touched the recommended one the setting became "exo" and the rescue
    // below was switched off for good. What that looks like on a television is a
    // black screen on any file the hardware cannot decode — a TrueHD track is
    // enough — with a working engine sitting unused behind a menu.
    //
    // The setting says what the next film starts on. It does not say to sit on a
    // dead picture when the other engine would play it.
    if (snap.errorCode !== "decode" && snap.errorCode !== "codec" && !snap.noAudio) return;
    // Both flags, and the order matters. `chosenEngine` reads `engineOverride`
    // first, so raising `autoFallbackTried` on its own left the hand-picked
    // engine still selected and the escalation changed nothing — measured on
    // the emulator, where ExoPlayer reported the decode failure and then sat on
    // it. Clearing the override is what lets `fallbackEngine` through.
    const escalate = () => {
      // Logged because this is invisible from the outside: the picture simply
      // reappears, and when it does not, the only way to tell a rescue that
      // never fired from one that fired and failed is a line in logcat.
      console.warn(`[viora] engine "${engine}" reported ${snap.errorCode ?? "no audio"} — escalating to ${fallbackEngine}`);
      setEngineOverride(null);
      setAutoFallbackTried(true);
    };
    if (isMpvAndroidAvailable()) {
      // Nothing to probe: the engine is compiled into the app.
      escalate();
      return;
    }
    (async () => {
      const probe = await probeMpv();
      if (probe.available) escalate();
    })();
  }, [engine, fallbackEngine, autoFallbackTried, snap.errorCode, snap.noAudio]);

  /**
   * The other engine this device has, or null when there is no choice to offer.
   *
   * Live channels are excluded: they run on the web layer, and moving one of
   * those to a native engine mid-stream is a different piece of work.
   */
  const alternateEngine: PlayerEngine | null =
    isExoAvailable() && isMpvAndroidAvailable()
      ? engine === "mpv"
        ? "exo"
        : "mpv"
      : null;

  /**
   * Swaps the engine under the same stream, keeping the viewer's place.
   *
   * The position is handed to the next bridge rather than left to the resume
   * store: that store is also what the "resume or start over" question reads,
   * and being asked that after pressing a button in the player would be absurd.
   */
  const switchEngine = () => {
    if (!alternateEngine) return;
    // From the clock, not the snapshot: `snapChangedIgnoringClock` deliberately
    // withholds position-only updates from React, so `snap.positionSec` here is
    // whatever it was when some *other* field last changed. Reading it sent the
    // viewer back to the start of the film.
    resumeOverrideRef.current = Math.max(0, getPlaybackPosition() - 1);
    setEngineOverride(alternateEngine);
  };

  return { snap, engine, bridgeReady, bridgeKey, embedActive, alternateEngine, switchEngine };
}
