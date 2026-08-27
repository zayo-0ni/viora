import { isWeb } from "@/lib/platform";

/**
 * Every host-dependent feature the app gates on.
 *
 * This table used to carry a column per platform. With desktop and handheld
 * gone, most of the rows had the same answer on every remaining host and were
 * deleted along with the code that asked about them — a capability that is
 * always false is a branch nobody takes, not a switch worth keeping. What is
 * left is the set that still genuinely differs, and the only thing it differs
 * on is whether the Tauri bridge is there.
 *
 * Removed with the desktop build: the mpv engine and everything it drove (HDR
 * passthrough, shader upscaling, motion interpolation, the equaliser), the
 * ffmpeg and yt-dlp sidecars (transcoding, thumbnail scrubbing, trailer and
 * subtitle extraction, DVR, clip and screenshot capture), every windowing
 * feature (multi-window, multiview, PiP, the custom titlebar, the tray, window
 * state), Discord presence, the updater and AirPlay.
 */
export type Capability =
  // playback
  | "exoEngine"
  // system integration
  | "deepLinks"
  | "powerInhibit"
  | "localFolderScan"
  | "fileAssociations"
  // network
  | "torrentEngine"
  | "castChromecast"
  | "castDlna"
  | "castRoku"
  | "localWebServer";

type Table = Record<Capability, boolean>;

/**
 * Android TV. ExoPlayer drives the device's hardware decoders, which is the
 * whole reason a television plays HEVC and 4K that a WebView `<video>` turns
 * down. Deep-link schemes are declared in AndroidManifest.xml at build time, so
 * there is no runtime registration call to expose.
 */
const NATIVE: Table = {
  exoEngine: true,

  deepLinks: true,
  powerInhibit: true,
  // Android reads shared storage through SAF.
  localFolderScan: true,
  fileAssociations: true,

  torrentEngine: true,
  castChromecast: true,
  castDlna: true,
  castRoku: true,
  localWebServer: true,
};

/**
 * The browser development rig. No bridge, so nothing native is reachable —
 * but the catalogs, the layout and the whole D-pad surface still are, which is
 * what makes `pnpm dev` a usable way to work on this.
 */
const WEB: Table = {
  exoEngine: false,

  deepLinks: false,
  powerInhibit: true,
  localFolderScan: false,
  fileAssociations: false,

  torrentEngine: false,
  castChromecast: false,
  castDlna: false,
  castRoku: false,
  localWebServer: false,
};

let cached: Table | null = null;

export function capabilities(): Table {
  if (cached) return cached;
  cached = isWeb() ? WEB : NATIVE;
  return cached;
}

export function can(capability: Capability): boolean {
  return capabilities()[capability];
}

/** Invalidate after a platform override arrives from the Rust side. */
export function resetCapabilities(): void {
  cached = null;
}
