# Building Viora

## Android

```bash
pnpm install
pnpm run build:apk
```

The APK lands in `src-tauri/gen/android/app/build/outputs/apk/<arch>/<profile>/`.

| Command | Output |
| --- | --- |
| `pnpm run build:apk` | debug APK, arm64 — installable immediately |
| `pnpm run build:apk:release` | release APK, **unsigned** |
| `node scripts/build-apk.mjs --arch x86_64` | for the emulator |
| `node scripts/build-apk.mjs --skip-web` | reuse the existing `dist/`, Rust only |

Architectures: `arm64` (default, every modern phone and TV box), `arm`,
`x86`, `x86_64`.

### Why not `tauri android build`

It symlinks the compiled `.so` into `jniLibs`, and Windows refuses symlink
creation to unprivileged users unless Developer Mode is on. `build-apk.mjs`
runs the same three stages and copies the file instead, so no elevation is
needed. It also excludes Gradle's `rustBuild*` task, which would otherwise
shell back out to the Tauri CLI and hit the same wall.

### Requirements

- Node 20+ and pnpm
- Rust with the Android targets:
  `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
- Android SDK with an NDK, plus JDK 17

The script finds the SDK, NDK and JDK on its own — it checks `ANDROID_HOME`,
`NDK_HOME` and `JAVA_HOME` first, then the usual install locations, and picks
the newest NDK it finds. Set those variables only if detection fails.

On Windows the Rust host toolchain needs a linker. If you installed the
`x86_64-pc-windows-gnu` toolchain, MinGW-w64 must be on `PATH` — the `dlltool`
bundled with rustup is incomplete and fails to build import libraries.

### Signing a release

Release APKs come out unsigned:

```bash
keytool -genkey -v -keystore viora.jks -keyalg RSA -keysize 2048 -validity 10000 -alias viora
apksigner sign --ks viora.jks --out viora-signed.apk app-arm64-release-unsigned.apk
```

Keep the keystore safe and backed up. Android identifies an app by its
signature, so losing it means you can never ship an update to anyone who
installed the old build — they would have to uninstall first.

## There is no desktop build

Android is the only target. `cargo check` against the host will fail on the
desktop bundle metadata — that is expected, not a broken tree. Build the APK to
check the Rust side.

To work on the frontend without a device, `pnpm dev` serves it in a browser and
the arrow keys stand in for the D-pad. The Tauri bridge is absent there, so
anything native is off; `src/lib/capabilities.ts` is the table that decides.

## Version

Set in three places that have to agree:

- `package.json` → `version`
- `src-tauri/Cargo.toml` → `[package] version`
- `src-tauri/tauri.conf.json` → `version`

`build-apk.mjs` writes `gen/android/app/tauri.properties` from `package.json`
on every build, and `app/build.gradle.kts` reads the APK's `versionName` and
`versionCode` from there. Do not edit that file by hand — it is overwritten.

`versionCode` is derived as `major*1000000 + minor*1000 + patch`, so 1.0.2
becomes 1000002. It has to increase between releases: Android refuses an update
whose code is not greater than the installed one, and the viewer would have to
uninstall — losing their library — before they could move forward.

This used to be a trap. `tauri android build` regenerates that file, but this
script deliberately does not call it (see above), so nothing kept it in step and
every APK shipped 1.0.0 / 1000000 no matter what the three files above said.

## After moving the project directory

Cargo bakes absolute paths into `src-tauri/target`, so a move breaks the next
build with `failed to read plugin permissions: ... \old\path\...`. Clear the
build-script output and fingerprints — the compiled crates themselves survive:

```bash
rm -rf src-tauri/target/*/debug/build src-tauri/target/debug/build
find src-tauri/target -name .fingerprint -type d -exec rm -rf {} +
```

pnpm records paths too and refuses to purge `node_modules` without a prompt.
`build-apk.mjs` sets `CI=true` so it answers itself, but a bare `pnpm install`
after a move needs `CI=true pnpm install` or a manual `rm -rf node_modules`.
