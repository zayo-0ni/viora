<div align="center">

# Viora

**A Stremio client for Android TV.**

<sub>by zayo0ni</sub>

[![Version](https://img.shields.io/badge/version-1.0.2-orange)](https://github.com/zainzainalaa-commits/viora/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Android](https://github.com/zainzainalaa-commits/viora/actions/workflows/android.yml/badge.svg)](https://github.com/zainzainalaa-commits/viora/actions/workflows/android.yml)

</div>

---

## Install

Open the **Downloader** app and enter this address. It always resolves to the
newest build, so it only has to be typed once:

```
github.com/zainzainalaa-commits/viora/releases/latest/download/Viora-android.apk
```

Allow installation from unknown sources when prompted.

Requires Android 7.0 (API 24) or newer.

---

## What it does

A client for the Stremio protocol: it browses catalogs, resolves streams
through add-ons, and plays them. It hosts no content of its own.

| | |
| --- | --- |
| **Catalogs** | Home, Discover, Movies, Shows, Anime, Live TV, Calendar, Library |
| **Add-ons** | Any Stremio add-on, plus **Cinemana** built in as a first-party source |
| **Playback** | ExoPlayer by default; mpv is compiled in for what the hardware turns down |
| **Sources** | Torrents via librqbit, direct HTTP, M3U/Xtream playlists with an EPG |
| **Casting** | Chromecast, DLNA/UPnP, Roku |
| **Sync** | Stremio account, Trakt, AniList, MyAnimeList |

Every screen is driven by the remote. `src/lib/tv-focus/**` is the focus engine
that makes that work, and it is locked — see [CLAUDE.md](CLAUDE.md) before
touching anything that moves the highlight around.

---

## One target

Viora used to build for Windows, macOS, Linux and Android phones as well. It
does not any more: it targets an Android television and nothing else, and the
code for the others has been removed rather than gated, because a branch nothing
compiles is a branch nobody maintains.

What went with them, and why it could not have come along:

- **libmpv on the desktop, and everything it drove** — HDR passthrough, shader
  upscaling, motion interpolation, the equaliser. The mpv that ships here is
  compiled into the APK and is still a selectable engine; the desktop one linked
  against a system library that Android has no equivalent for.
- **The ffmpeg and yt-dlp sidecars** — transcoding, thumbnail scrubbing on the
  seek bar, trailer extraction, embedded subtitle extraction, DVR recording,
  clip and screenshot capture, and subtitle sync against the audio track.
  Android has blocked executing bundled binaries from the app data directory
  since API 29, so none of these could run.
- **Everything about windows** — multiview, picture-in-picture, the custom
  titlebar, the tray, saved window geometry. There is one WebView and it is the
  screen.
- **The phone layout** — a bottom tab bar, touch targets and gesture handling.

`src/lib/capabilities.ts` is the one table that still varies, and the only thing
it varies on is whether the Tauri bridge is there: the Android app, or `pnpm dev`
in a browser.

---

## Configuration

Integrations that need a server-side secret ship disabled, because a client app
cannot hold one. `src/lib/brand.ts` is where you point them at infrastructure
you control; [REBRANDING.md](REBRANDING.md) walks through it.

Off until configured: Trakt, AniList and MyAnimeList sign-in, IMDb ratings,
TVDB artwork, the public watch-party relay, the theme gallery, bug reports.
Everything else works out of the box.

---

## Building

```bash
pnpm install
pnpm run build:apk
```

See [BUILDING.md](BUILDING.md) for the flags and the signing step.

---

## Licence

MIT — see [LICENSE](LICENSE).

Viora is a fork of [Harbor](https://github.com/harborstremio/harbor), whose
copyright notice the licence requires be kept and which is preserved in
`LICENSE`. It is an independent project, not affiliated with or endorsed by
Harbor, Stremio ltd, or Cinemana.

Third-party components carry their own terms: the bundled Noto font under the
SIL Open Font Licence, and `rust_cast` under MIT.
