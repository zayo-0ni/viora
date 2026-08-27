import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";

// The window controls that used to live here — minimize, maximize, close, edge
// resizing and the useMaximized hook — went with the desktop build. Android has
// exactly one WebView and no window to manage; Tauri's window commands reject
// there with "Window API not available on mobile".

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function openUrl(url: string) {
  if (!url) return;
  if (isTauri()) {
    tauriOpenUrl(url).catch(() => {
      invoke("browser_open", { url }).catch(() => {
        try {
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          /* swallow */
        }
      });
    });
    return;
  }
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    /* swallow */
  }
}

// Hosts that aggressively block iframe embedding (X-Frame-Options DENY,
// bot/captcha challenges, etc.). For these, skip the viewport — open
// in the user's real browser instead, like a normal link.
const IFRAME_HOSTILE_HOSTS = [
  "imdb.com",
  "www.imdb.com",
  "m.imdb.com",
  "youtube.com",
  "www.youtube.com",
  "accounts.google.com",
  "github.com",
  "x.com",
  "twitter.com",
];

function isIframeHostile(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return IFRAME_HOSTILE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function openInAppBrowser(url: string, title?: string) {
  if (!url) return;
  if (isIframeHostile(url)) {
    openUrl(url);
    return;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("harbor:open-embed-viewport", { detail: { url, title } }),
    );
  }
}
