<div align="right"><b>English</b> &nbsp;·&nbsp; <a href="SOURCE_AR.md">العربية</a></div>

# Corresponding source code

Viora is licensed under the [GNU General Public License v3.0](../LICENSE). For every APK published here, the complete corresponding source code of that exact version is published next to it, in the same release:

```
Viora-<version>.apk
Viora-<version>-source.zip      ← the source code of this APK
Viora-<version>-sha256.txt      ← checksums of both
```

The archive is made from the exact commit the APK was built from. It contains everything needed to build the app: the application code, resources, the bundled provider list, the Gradle build scripts and wrapper, and the license and notice files.

## What is not in the archive

Only secrets are left out, never code:

- the Android release keystore and its passwords
- the private key that signs the provider list
- personal API keys and service credentials used by the official build

The build reads these from `local.properties` or environment variables. When a value is empty, the feature that needs it is hidden or disabled, so the source builds without any of them.

## Building a release APK from the archive

Requirements: JDK 17 and the Android SDK (Android Studio installs both).

1. Unpack `Viora-<version>-source.zip`.
2. Create `local.properties` in the project root:

   ```properties
   sdk.dir=/path/to/Android/Sdk

   # Optional: your own TMDB API key (https://www.themoviedb.org/settings/api)
   TMDB_API_KEY=

   # Optional: your own release signing key
   VIORA_RELEASE_STORE_FILE=/path/to/your-release.jks
   VIORA_RELEASE_STORE_PASSWORD=
   VIORA_RELEASE_KEY_ALIAS=
   VIORA_RELEASE_KEY_PASSWORD=
   ```

3. Build:

   ```bash
   ./gradlew :androidApp:assembleFullRelease
   ```

   The APKs appear in `androidApp/build/outputs/apk/full/release/`. Without the signing values the release APKs are unsigned, ready for you to sign. For a quick test build signed with the Android debug key, use `./gradlew :androidApp:assembleFullDebug`.

An APK you build yourself is signed with your own key. Android treats it as a different publisher, so it can replace the official app only after the official app is uninstalled.

## Earlier versions

Every release keeps its own source archive. Open the release on [Releases](https://github.com/zayo-0ni/viora/releases) to get the source code of that version.
