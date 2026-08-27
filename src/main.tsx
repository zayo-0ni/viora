import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { TVFocusProvider } from "@/lib/tv-focus";
import { formFactor, platformOS, setNativePlatform, type PlatformOS } from "@/lib/platform";
import { FIRST_CONTENT_EVENT, FIRST_CONTENT_TIMEOUT_MS } from "@/lib/first-content";
import "@/index.css";

// One entry, one window.
//
// This file used to decide which of four applications to mount by reading the
// Tauri window label: the main app, a picture-in-picture window, a transparent
// modal overlay window and an HDR overlay window. All three extras were desktop
// windows the OS put on top of the main one, and Android has no such thing —
// there is exactly one WebView, so the question no longer exists.

async function boot() {
  // Ask the native side which host this is before anything renders. The answer
  // only distinguishes the Android app from the browser development rig now
  // that there is a single form factor, but it still has to arrive before the
  // first paint: `platformOS()` memoises, and a capability read against the
  // wrong host would stick for the life of the process.
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const info = await import("@tauri-apps/api/core").then(({ invoke }) =>
        invoke<{ os: string }>("platform_info"),
      );
      setNativePlatform(info.os as PlatformOS);
    } catch {
      // Bridge unreachable; platform.ts falls back to looking for it itself.
    }
  }

  const root = document.documentElement;
  root.dataset.os = platformOS();
  // Layout and hit-target sizing key off these. Both are constant — the app
  // targets one device — but the CSS reads them as hooks, so they are stamped
  // rather than assumed.
  root.dataset.formFactor = formFactor();
  root.dataset.input = "dpad";

  if (import.meta.env.DEV) {
    void import("./lib/streams/__fixtures__/verify").then((m) => m.logVerificationReport());
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <TVFocusProvider>
        <App />
      </TVFocusProvider>
    </StrictMode>,
  );

  revealWhenReady();
}

/**
 * Holds the boot screen until the first screen has something to show.
 *
 * It used to lift on the first animation frame after `render`, which is the
 * moment React has produced a tree — not the moment that tree has any content
 * in it. What the viewer saw was the mark, then an empty library, then rows
 * arriving one by one over several seconds.
 *
 * The wait is capped, and the cap is the important half. The home rows come
 * from whatever catalogues are installed, and one of those can be slow, rate
 * limited, or simply unreachable on a television that woke up before its
 * network did. A gate with no ceiling turns any of those into an app that never
 * opens, which is worse than the flicker it was meant to fix. So the signal
 * wins if it arrives, the clock wins if it does not, and the screen is never
 * held longer than it takes to decide the content is not coming.
 */
function revealWhenReady() {
  const bootEl = document.getElementById("viora-boot");
  if (!bootEl) return;

  let done = false;
  const reveal = () => {
    if (done) return;
    done = true;
    window.removeEventListener(FIRST_CONTENT_EVENT, onContent);
    window.clearTimeout(cap);
    window.clearInterval(poll);
    bootEl.classList.add("gone");
    setTimeout(() => bootEl.remove(), 260);
  };

  /**
   * Whether every card the viewer will actually see has its art.
   *
   * Rows arriving is not the same as rows being ready to look at: the first
   * version of this lifted on the first row and the owner still watched the
   * cards fill in behind it. What matters is the images inside the opening
   * screenful — anything below the fold can load while the app is being read.
   *
   * `complete` covers decoded and failed alike, which is deliberate. A poster
   * whose request has failed is never going to arrive, and waiting on it would
   * hold the screen for the full timeout every launch.
   */
  const visibleArtSettled = () => {
    const fold = window.innerHeight;
    let seen = 0;
    for (const img of document.images) {
      const box = img.getBoundingClientRect();
      if (box.bottom <= 0 || box.top >= fold || box.width === 0) continue;
      seen++;
      if (!img.complete) return false;
    }
    // No images in view yet means the rows have not rendered their cards, not
    // that there is nothing to wait for.
    return seen > 0;
  };

  let poll = 0;
  const onContent = () => {
    if (visibleArtSettled()) return reveal();
    poll = window.setInterval(() => {
      if (visibleArtSettled()) reveal();
    }, 120);
  };

  const cap = window.setTimeout(reveal, FIRST_CONTENT_TIMEOUT_MS);
  window.addEventListener(FIRST_CONTENT_EVENT, onContent, { once: true });
}

void boot();
