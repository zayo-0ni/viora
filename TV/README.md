# TV

The television preview. This is the platform Viora targets.

## run-tv-emulator.bat

Double-click it. It starts the Android TV emulator, installs the newest APK
that matches the emulator's architecture, and opens the app.

**It does not build.** It shows you what is already built. When you want new
code in the preview, build first:

```
node scripts\build-apk.mjs --arch x86_64
```

The architecture matters. `pnpm run build:apk` with no flag builds **arm64**,
which is what a real television runs — an arm64 APK will not install on the
emulator, which is **x86_64**. The script checks the device and picks a
matching APK, and warns you when a newer APK exists for a different
architecture, because that is the state where you are looking at old code and
cannot tell.

To use the 720p emulator instead of the 1080p one, pass its name:

```
run-tv-emulator.bat Viora_TV720
```

## Driving it

Arrow keys and Enter, the same way the remote works. The focus engine is
`src/lib/tv-focus/**` and it is locked — read [CLAUDE.md](../CLAUDE.md) before
changing anything that moves the highlight.

## Where the project lives

At the repository root, one level up, not in this folder. This folder holds the
launcher only. Moving the project would break the next build: Cargo bakes
absolute paths into `src-tauri/target`, which [BUILDING.md](../BUILDING.md)
covers under "After moving the project directory".
