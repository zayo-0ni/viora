import { createExoBridge } from "@/lib/player/exo";
import { createMpvAndroidBridge, isMpvAndroidAvailable } from "@/lib/player/mpv-android";
import type { PlayerEngine, PlayerBridge } from "@/lib/player/bridge";

export const SYNC_DRIFT_TOLERANCE_S = 0.6;
export const SYNC_SUPPRESS_MS = 1400;
export const SYNC_PLAY_LOOKAHEAD_S = 0.4;
export const SYNC_MAX_AGE_S = 30;
export const SYNC_SEEK_JUMP_S = 10;
export const HOST_HEARTBEAT_MS = 1000;
export const GUEST_ESCAPE_MS = 45_000;
export const READY_STALE_MS = 20_000;
export const SEEK_APPLY_DEBOUNCE_MS = 120;
export const DURATION_MISMATCH_S = 4;
export const ROOM_STALL_MS = 9000;
export const SLOW_LOAD_MS = 50_000;
export const STUCK_AUTORETRY_MS = 18_000;
export const BLACK_SCREEN_GRACE_MS = 6_000;
export const MAX_AUTORETRY_ATTEMPTS = 5;
export const CHROME_HIDE_MS_PLAYING = 1800;
export const CHROME_HIDE_MS_PAUSED = 4500;
export const CHROME_HIDE_MS_RESUME = 1000;

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function embedFlags(engine: PlayerEngine): { stageBg: string } {
  // Both Android engines draw on a surface *behind* the page. A black stage
  // would be a black screen with working controls on top of it, so the stage
  // keeps no background of its own and the picture comes through from
  // underneath.
  //
  // The desktop mpv embed had three more arrangements here — a Windows child
  // window, and the mac and Linux frames — which went with the desktop build.
  const nativeSurface = engine === "exo" || (engine === "mpv" && isMpvAndroidAvailable());
  return { stageBg: nativeSurface ? "" : "bg-black" };
}

export function formatNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export async function pickBridge(
  want: "auto" | PlayerEngine,
): Promise<{ bridge: PlayerBridge; engine: PlayerEngine }> {
  // Two engines, both compiled into the app. `auto` means ExoPlayer: on a
  // television that is not a preference but the point — it is the hardware's
  // own decoder, and mpv's advantage only shows on what that hardware refuses.
  if (want === "mpv" && isMpvAndroidAvailable()) {
    return { bridge: createMpvAndroidBridge(), engine: "mpv" };
  }
  if (want === "mpv") {
    console.warn("[viora] mpv requested but libmpv is missing for this ABI; using ExoPlayer");
  }
  return { bridge: createExoBridge(), engine: "exo" };
}
