# Rebranding and self-hosting checklist

This fork no longer talks to the upstream project's servers. Everything that
used to is routed through `src/lib/brand.ts`, and each such feature is off until
you point it somewhere you control.

## 1. Name the app

`src/lib/brand.ts`:

```ts
export const APP_NAME = "Harbor";
export const APP_IDENTIFIER = "app.harbor";
export const APP_SCHEME = "harbor";
```

Then mirror those three in the places the build system reads directly — they
cannot import TypeScript:

| File | Field |
| --- | --- |
| `package.json` | `name` |
| `src-tauri/Cargo.toml` | `[package] name`, `[lib] name` |
| `src-tauri/tauri.conf.json` | `productName`, `identifier`, window `title` |
| `src-tauri/tauri.conf.json` | `plugins.deep-link.desktop.schemes` |
| `src-tauri/gen/android/.../AndroidManifest.xml` | `<data android:scheme="…">` |
| `index.html` | `<title>` |

Changing `identifier` changes the Android package name, so regenerate the
Android project afterwards:

```bash
pnpm exec tauri android init --skip-targets-install
```

## 2. Replace the artwork

- `src-tauri/icons/` — every size, plus `icon.ico` and `icon.icns`
- `src-tauri/gen/android/app/src/main/res/mipmap-*/` — launcher icons
- The TV launcher banner (320×180) referenced by `android:banner`
- `src/components/icons/harbor-mark.tsx` — the in-app logo component

## 3. Generate your own updater keys

The upstream signing key was removed; you cannot sign releases with it because
the private half was never public. Generate a pair:

```bash
pnpm exec tauri signer generate -w ~/.tauri/myapp.key
```

Put the public half in `tauri.conf.json` under `plugins.updater.pubkey`, keep
the private half secret, and set `FEATURES.autoUpdate = true` once you are
serving `/updates/latest.json`. Leave it false for Android — distribution goes
through the store or a sideloaded APK.

## 4. Register your own third-party apps

Each of these validates the redirect URI against the account that owns the
client ID, so the upstream IDs cannot work for you:

| Service | Register at | Needs |
| --- | --- | --- |
| Trakt | trakt.tv/oauth/applications | client ID + a server-side token exchange |
| AniList | anilist.co/settings/developer | client ID + a server-side token exchange |
| MyAnimeList | myanimelist.net/apiconfig | client ID + redirect URI on your domain |

The token exchange must live on a server because it carries a client secret,
which cannot ship inside a client app.

## 5. Optional backend

Set `BACKEND_BASE` in `src/lib/brand.ts` and flip the matching `FEATURES` flag
once each route is live. Until then the feature makes no network call at all.

| Feature flag | Route | Notes |
| --- | --- | --- |
| `bugReports` | `POST /v1/feedback` | |
| `adReports` | `POST /v1/adreport` | |
| `adCorpus` | `GET /updates/ad-segments.json` | Ed25519-signed; set `CORPUS_PUBKEY` too |
| `imdbProxy` | `GET /api/imdb/…` | IMDb has no public ratings API |
| `tvdbProxy` | `GET /api/tvdb/images` | TVDB key must stay server-side |
| `themeStore` | `GET /themes/api` | |
| `publicRelay` | a WebSocket relay | self-hosted and LAN relays work regardless |

## 6. What must stay

`LICENSE` — the MIT notice. MIT grants the right to fork, modify, rename,
rebrand, sell and redistribute this code; its single condition is that the
notice travels with copies. Keeping that one file is what makes this fork
legitimately yours to ship.

Third-party components carry their own terms, separate from the app's licence:

- `src-tauri/fonts/LICENSE-OFL-NotoSansJP.txt` — SIL Open Font Licence
- `src-tauri/vendor/rust_cast/` — MIT, retains its own notice

libmpv, ffmpeg and yt-dlp used to be listed here. They belonged to the desktop
build and went with it; nothing bundles them now.
