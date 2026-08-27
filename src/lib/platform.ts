/**
 * Viora targets one device: an Android TV, driven by a D-pad.
 *
 * There used to be a detection layer here that sorted a host into desktop,
 * tablet, phone or TV and let the rest of the app branch on the answer. The
 * desktop and handheld builds are gone, so the answer is now a constant and the
 * detection is not worth the doubt it introduced: a cheap TV box that reported
 * a mouse and five touch points could talk itself out of being a television.
 *
 * The one distinction left is where the app is running, not what it is running
 * on: inside the Android WebView with a Tauri bridge behind it, or in a plain
 * browser. The browser case is the development rig — `pnpm dev` with arrow keys
 * standing in for the remote — and it has no bridge, so anything native has to
 * be gated on it.
 */

export type PlatformOS = "android" | "web";

/** Only one remains. Kept as a type so the CSS hook stays self-describing. */
export type FormFactor = "tv";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isWeb(): boolean {
  return !isTauri();
}

// Set by the Rust side at boot (see the platform_info command). Before it
// answers, the presence of the Tauri bridge is the only signal available.
let nativeOS: PlatformOS | null = null;

export function setNativePlatform(os: PlatformOS): void {
  nativeOS = os;
  cachedOS = null;
}

let cachedOS: PlatformOS | null = null;

export function platformOS(): PlatformOS {
  if (cachedOS) return cachedOS;
  cachedOS = nativeOS ?? (isTauri() ? "android" : "web");
  return cachedOS;
}

export function isAndroid(): boolean {
  return platformOS() === "android";
}

export function formFactor(): FormFactor {
  return "tv";
}

/**
 * The remote is the only input. Layout, hit-target sizing and every focus ring
 * in the app hang off this; it is a function rather than a literal so the 138
 * call sites that ask the question keep reading the way they always have.
 */
export function isDpadPrimary(): boolean {
  return true;
}
