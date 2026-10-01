<div align="right"><b>English</b> &nbsp;·&nbsp; <a href="UPDATES_AR.md">العربية</a></div>

# How Viora updates

Viora has two independent update channels. Provider fixes do not wait for an app release, and an app release never depends on a provider update.

| Channel | What it contains | How it reaches you |
| --- | --- | --- |
| **Provider list** | Which provider integrations exist, their addresses, defaults and language information | Downloaded and verified by the app, no reinstall |
| **App releases** | The Viora APK itself | Published on [Releases](https://github.com/zayo-0ni/viora/releases) with checksums and its source code; the app finds, downloads and verifies them itself (**Settings → App updates**) |

## Provider list

**Published at**

```
https://raw.githubusercontent.com/zayo-0ni/viora/main/registry/providers-viora.json
```

| File | Purpose |
| --- | --- |
| `registry/providers-viora.json` | The signed provider list the app downloads |
| `registry/providers-viora.sig` | The same Ed25519 signature on its own (base64), for independent checking |
| `registry/registry-info.json` | Version, generation time and SHA-256 of the published list |

**What the app does**

1. Every copy of Viora ships with a signed provider list, so it works before any download.
2. With **Update providers automatically** on (the default), it checks for a newer list at start and every 12 hours. **Settings → VIP Viora → Update Providers** checks at once.
3. A downloaded list is accepted only if its Ed25519 signature matches the public key built into the app and its contents pass validation. It must also be *newer* than the active list, so an old list cannot be replayed.
4. A valid list replaces the active one in a single step. The previous valid list is kept, and if the saved list is ever found damaged, Viora falls back to it or to the built-in one.
5. A network error, an invalid signature or a damaged file changes nothing: the current list stays active, and the reason is shown.

A newly published list can take up to about five minutes to reach every device, because GitHub caches the file for that long.

The provider list contains data only — addresses, defaults and descriptions. It cannot add program code to the app: logic that a provider needs but the installed app does not have is reported as **Needs an app update** and stays off until a new release brings it.

**File format**

```json
{
  "format": "viora-signed-registry-v1",
  "keyId": "viora-vip-2026-09",
  "payload": "<base64 of the provider list JSON>",
  "signature": "<base64 Ed25519 signature over the decoded payload bytes>"
}
```

**Public key** (`viora-vip-2026-09`, raw Ed25519, base64)

```
9jRWi8mOiMbubjiZ2Cv1uR/JsfOrY41xDjTJ1eW3EoI=
```

<details>
<summary><b>Verify a provider list yourself</b></summary>
<br>

```python
# pip install cryptography
import base64, json
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

key = Ed25519PublicKey.from_public_bytes(base64.b64decode("9jRWi8mOiMbubjiZ2Cv1uR/JsfOrY41xDjTJ1eW3EoI="))
envelope = json.load(open("providers-viora.json", encoding="utf-8"))
payload = base64.b64decode(envelope["payload"])
key.verify(base64.b64decode(envelope["signature"]), payload)  # raises InvalidSignature if tampered
print("valid, version", json.loads(payload)["version"])
```

</details>

## App releases

Each release on [Releases](https://github.com/zayo-0ni/viora/releases) carries:

| Asset | Purpose |
| --- | --- |
| `Viora-<version>.apk` | The app, for every supported device |
| `Viora-<version>-arm64-v8a.apk`, `Viora-<version>-armeabi-v7a.apk` | Smaller downloads for one processor type |
| `Viora-<version>-sha256.txt` | SHA-256 checksums of every release file |
| `Viora-<version>-source.zip` | The complete corresponding source code of that APK ([details](SOURCE.md)) |

The newest release is also described in `updates/latest.json`, which the in-app updater reads:

```json
{
  "schema": 1,
  "versionName": "1.0.0",
  "versionCode": 135,
  "releaseDate": "2026-10-01",
  "minAndroid": "7.0",
  "minSdk": 24,
  "apk": {
    "name": "Viora-1.0.0.apk",
    "url": "https://github.com/zayo-0ni/viora/releases/download/v1.0.0/Viora-1.0.0.apk",
    "size": 0,
    "sha256": "<64 hex characters>"
  },
  "abiApks": [
    { "abi": "arm64-v8a", "name": "Viora-1.0.0-arm64-v8a.apk", "url": "…", "size": 0, "sha256": "<64 hex characters>" }
  ],
  "source": {
    "name": "Viora-1.0.0-source.zip",
    "url": "https://github.com/zayo-0ni/viora/releases/download/v1.0.0/Viora-1.0.0-source.zip",
    "sha256": "<64 hex characters>"
  },
  "releaseNotes": "https://github.com/zayo-0ni/viora/releases/tag/v1.0.0",
  "changes": { "en": ["…"], "ar": ["…"] }
}
```

<sub>The values above only show the shape of the file. The real file is written by the release process, after the release files are uploaded and verified.</sub>

**In-app updates** (Settings → App updates)

1. Viora reads `updates/latest.json` at most once a day at start, and whenever you tap **Check for updates**. It only tells you; it never downloads on its own.
2. A release is offered only when it is newer than the installed app by both version and build number.
3. **Download update** fetches the APK for your device's processor (or the universal one) — only from this repository's Releases, over HTTPS.
4. Before anything is installed, the file must have exactly the size and SHA-256 published in `latest.json`, and be a Viora APK (`app.viora`) with the announced, higher build number, signed with the same certificate as the Viora you have installed. A file that fails any check is deleted and never installed.
5. Viora then hands the file to Android's installer, which asks you to confirm. The first time, Android asks you to allow Viora to install apps. The update installs over the existing app, so your library, downloads, account and settings stay.

Downloads can be cancelled and retried; a broken or partial download is discarded.

**Verify a download**

```bash
sha256sum Viora-1.0.0.apk
```

On Windows: `certutil -hashfile Viora-1.0.0.apk SHA256`. The result must match the line for that file in `Viora-<version>-sha256.txt`.

Every official APK is signed with the same Viora release key, so a newer APK installs over an older one and keeps your data. Android refuses to install an APK signed with a different key over Viora — if that happens, the file did not come from here.

The release certificate's SHA-256, for checking an APK with `apksigner verify --print-certs`:

```
58:D8:75:30:A2:B0:FE:BA:8F:05:D7:28:7D:D4:2C:9C:5B:3F:FE:8A:0E:C8:C2:9C:D6:89:54:30:B7:F8:08:B1
```
