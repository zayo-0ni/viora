import { useCallback, useEffect, useRef, type RefObject } from "react";
import { captureMpvFrame, saveSnapshot } from "@/lib/snapshots";
import { useSettings } from "@/lib/settings";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { PlayerEngine, PlayerStatus } from "@/lib/player/bridge";
import type { PlayerSrc } from "@/lib/view";
import { cloudWriteId } from "@/lib/stremio";

const CACHE_MS = 12000;
const WARM_MS = 4000;
const EXIT_GRAB_MS = 700;
const GRAB_FULL_MS = 3500;
const END_RATIO = 0.92;

type Cached = { img: string; id: string };

function snapshotId(src: PlayerSrc, resolved: string | null, verified: boolean): string | null {
  const id = src.meta.id ?? "";
  if (!id || id.startsWith("iptv:")) return null;
  return cloudWriteId(id, src.imdbId ?? resolved, verified) || id;
}

function persist(cached: Cached | null): void {
  if (!cached) return;
  saveSnapshot(cached.id, cached.img);
}

function nearEnd(cur: number, dur: number, ended: boolean): boolean {
  return ended || (dur > 0 && cur >= dur * END_RATIO);
}

export function useExitSnapshot(params: {
  src: PlayerSrc;
  engine: PlayerEngine;
  status: PlayerStatus;
  durationSec: number;
  videoMountRef: RefObject<HTMLDivElement | null>;
  resolvedImdbId: string | null;
  resolvedImdbVerified: boolean;
  seekPreviewEnabled: boolean;
}) {
  const { src, engine, status, durationSec, videoMountRef, resolvedImdbId, resolvedImdbVerified, seekPreviewEnabled } = params;
  const { settings } = useSettings();
  const fullQuality = settings.cwSnapshotFullQuality;
  const latest = useRef({ src, engine, durationSec, resolvedImdbId, resolvedImdbVerified, seekPreviewEnabled, fullQuality });
  latest.current = { src, engine, durationSec, resolvedImdbId, resolvedImdbVerified, seekPreviewEnabled, fullQuality };
  const lastGoodRef = useRef<Cached | null>(null);
  const capturedKeyRef = useRef<string | null>(null);

  const grabFrame = useCallback(
    async (): Promise<string | null> => {
      const { fullQuality: full } = latest.current;
      // The ffmpeg trickplay generator was the fallback when mpv had no frame
      // to hand over. It cannot run on Android, so mpv is the only source.
      return captureMpvFrame(full);
    },
    [videoMountRef],
  );

  const captureExitSnapshot = useCallback(async () => {
    const { src: s, durationSec: dur, resolvedImdbId: resolved, resolvedImdbVerified: verified } = latest.current;
    const id = snapshotId(s, resolved, verified);
    if (!id) {
      persist(lastGoodRef.current);
      return;
    }
    const cur = getPlaybackPosition();
    if (!Number.isFinite(cur) || cur <= 0) {
      persist(lastGoodRef.current);
      return;
    }
    const ep = s.episode ? `:${s.episode.season}:${s.episode.episode}` : "";
    const key = `${s.meta.id}${ep}|${cur.toFixed(0)}`;
    if (capturedKeyRef.current === key) return;
    capturedKeyRef.current = key;

    if (nearEnd(cur, dur, false)) {
      persist(lastGoodRef.current);
      return;
    }
    const budget = lastGoodRef.current ? EXIT_GRAB_MS : GRAB_FULL_MS;
    const fresh = await Promise.race([
      grabFrame(),
      new Promise<null>((r) => setTimeout(() => r(null), budget)),
    ]);
    if (fresh && latest.current.src.meta.id === s.meta.id) {
      lastGoodRef.current = { img: fresh, id };
    }
    persist(lastGoodRef.current);
  }, [grabFrame]);

  useEffect(() => {
    if (status !== "playing") return;
    const tick = async () => {
      const { src: s, durationSec: dur, resolvedImdbId: resolved, resolvedImdbVerified: verified } = latest.current;
      const id = snapshotId(s, resolved, verified);
      if (!id) return;
      const cur = getPlaybackPosition();
      if (!Number.isFinite(cur) || cur <= 0 || nearEnd(cur, dur, false)) return;
      const img = await grabFrame();
      if (!img) return;
      if (latest.current.src.meta.id !== s.meta.id) return;
      const cached = { img, id };
      lastGoodRef.current = cached;
      persist(cached);
    };
    void tick();
    const warm = window.setTimeout(() => void tick(), WARM_MS);
    const id = window.setInterval(() => void tick(), CACHE_MS);
    return () => {
      window.clearTimeout(warm);
      window.clearInterval(id);
    };
  }, [status, grabFrame]);

  useEffect(() => {
    const flush = () => persist(lastGoodRef.current);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  return { captureExitSnapshot };
}
