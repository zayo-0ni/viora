<div align="right"><b>English</b> &nbsp;·&nbsp; <a href="PRIVACY_AR.md">العربية</a></div>

# Privacy

This statement describes the Viora Android app from version 1.1.2. It will be updated before any feature that changes it is released.

## In short

- A **Viora account is optional**. Without signing in, Viora sends nothing to a Viora server.
- If you sign in (with Google), your account keeps your **settings**, the **service keys and add-on configuration** you set up (stored **encrypted**), your **Movies watch history and playback progress**, and your **VIP Viora membership**.
- **Downloads**, your **Movies library**, **Viora Music's library and listening history**, your **YouTube Music sign-in**, caches and this device's own settings **stay only on your device**.
- Viora contains **no analytics, no advertising SDKs and no crash reporting**.

## What stays on your device

| Data | Purpose |
| --- | --- |
| Downloads and their details (Movies and Music) | Offline playback and offline title pages |
| Your Movies library (saved titles) | Your saved titles |
| Viora Music's library, listening history and Replay statistics, queue and recent searches | Playing and finding your music |
| Your YouTube Music sign-in | Viora Music's own account; see [YouTube Music](#youtube-music) |
| Sign-ins to Trakt, Simkl and Discord | Signed in again on each device |
| Search history (the searches themselves) | Recent searches; only the on/off switch syncs |
| Profile PINs | Protecting profiles |
| This device's own settings | Download location and speed, torrent engine, audio output and USB DAC, cache size, screen refresh rate, the section last open |
| Provider list and Provider Health results | Choosing and checking sources |
| Image, metadata and audio caches | Faster browsing and playback |

Everything Viora keeps, including what it syncs, is also kept on your device. Uninstalling Viora, or clearing its storage in Android settings, deletes all of it from the device; what your Viora account holds stays there until you delete the account.

## The optional Viora account

You can sign in from **Settings → Account** with your Google account. Viora uses Google's own sign-in on Android and asks Google only for your basic profile (`openid email profile`); it never sees your Google password and gets no access to other Google data.

The account is hosted by [Supabase](https://supabase.com) (data center in Seoul, South Korea). It holds:

| Data | Why |
| --- | --- |
| Your Google account id, email address, name and profile photo link | To identify your account and show who is signed in |
| Your settings | So they follow you between devices: interface language; theme, appearance and motion; catalog and metadata sources; Movies Home rows and collections; page and library layouts; player and subtitle preferences; source card badges; how Continue Watching is shown; episode alerts; whether search history is kept; TMDB, debrid, MDBList and Trakt preferences; your VIP Viora provider switches and provider-list updates; and Viora Music's preferences, including how its Home and Explore are arranged |
| Your encrypted settings | Service keys and add-on configuration: see [Encrypted settings](#encrypted-settings) |
| Your Movies watch history and progress | Titles and episodes marked watched or unwatched, completion, playback position and length, and when each last changed, so Continue Watching and Next Up follow you. Each record carries the title's name, artwork links, season and episode, and the name of the source you last used; the stream link itself never leaves your device |
| Your VIP Viora membership (status and dates) | To unlock VIP Viora; it is checked online each time it is needed and never stored on the device |

Most settings, and the watch history, are kept per Viora profile. The server accepts only the settings on a fixed list and refuses everything else.

### Encrypted settings

Some settings can contain a secret, so they never go with the other settings. Only these, when you have set them up, are synced through a separate encrypted channel:

- your personal TMDB API key
- debrid service API keys
- the MDBList API key
- IntroDB and AnimeSkip keys
- a custom poster URL pattern (it can contain a key)
- your add-ons: their addresses (which can contain tokens), order and on/off state
- plugin repositories, scrapers and their settings
- Viora Music's integrations: Last.fm (sign-in session and your own API key), the ListenBrainz token, the Spotify Canvas cookie, and Discord status options

They travel over an encrypted connection and are encrypted by the server before it stores them, apart from your other settings. The encryption key is held in the server's vault, not with the data. They belong to your account only: the database gives no direct access to them, only your own signed-in session can read them back, and no other account can read them. Viora never writes them to its logs. The server also refuses plain settings that look like a key or a token.

**Never uploaded:** downloads, your Movies library, ratings, the searches you make, Viora Music's library and listening history, your YouTube Music sign-in, sign-ins to Trakt, Simkl and Discord, profile PINs, the links of the streams you play, this device's own settings and caches.

### Signing out and deleting the account

The sign-in session is stored on your device encrypted with a key held by Android's Keystore. **Sign out** ends the session on the server and on the device and stops syncing; it deletes nothing on the device, and your account keeps what it holds for when you sign in again. **Delete account** (Settings → Account) permanently deletes your account and everything stored with it on the server: your settings, your encrypted settings, your Movies watch history and progress, and your VIP Viora membership. Your device keeps its own data, including its copy of what was synced.

## YouTube Music

Viora Music can sign in to YouTube Music. This is separate from the Viora account and optional: the YouTube Music session is stored only on your device, is never sent to a Viora server and is not part of sync. Viora Music uses it to load your own YouTube Music shelves, playlists and liked songs. YouTube's privacy policy applies to what YouTube Music does with it.

## What Viora sends over the network

Viora only makes the requests needed for what you do in the app:

- **Metadata** — browsing, searching and opening titles request information and artwork from TMDB, Cinemeta and an IMDb data service. Your search text is sent to these services.
- **Sources** — when you open the sources of a movie or episode, Viora sends that title's identifiers (for example its TMDB or IMDb id, season and episode) to the provider integrations you have enabled, and then loads the stream from the host they return.
- **Viora Music** — browsing, searching and playing request catalog data, artwork, lyrics and audio from YouTube Music, the catalog services you use (Apple Music, Deezer, ListenBrainz) and lyrics services. Your search text is sent to these services. Integrations you turn on (Last.fm, ListenBrainz, Discord, Spotify Canvas) receive what they need, such as the song that is playing.
- **Provider Health** — **Refresh Health** checks each server once with a test title (about 10–15 MB).
- **Provider list** — Viora downloads the signed provider list from this GitHub repository when it checks for updates.
- **Viora account** — only when you are signed in: your settings, your encrypted settings and your Movies watch history and progress are exchanged with your account, and VIP Viora asks the account whether your membership is active.
- **App updates** — at most once a day, and whenever you tap **Check for updates**, Viora reads `updates/latest.json` from this GitHub repository. It downloads a new APK from this repository's Releases only when you tap **Download update**.
- **Casting** — Viora looks for Chromecast and DLNA devices on your local network and, when needed, relays the stream from your phone to the TV over that network.

Like any website you visit, these services can see your IP address and the requests made to them. Their own privacy policies apply to what they do with that information.

## Optional services

Some integrations in Settings connect to a third-party service only after you sign in to it or enter your own key. Nothing is sent to such a service unless you set it up, and you can disconnect it at any time.

## Permissions

Viora asks only for what its features need: network access, Wi-Fi multicast to find cast devices, notifications, background services that keep playback and downloads running, access to the audio files on your phone (asked only when you open Viora Music's audio files on the device, and used only to list and play them), storage access on Android 9 and older (asked only when Viora Music saves downloads into a folder of your phone), and permission to install apps — used only to hand an update you chose to download, after it has been verified, to Android's installer, which asks you to confirm. It does not ask for your contacts, location, camera or microphone. Android lists every permission in the app's settings.

## Questions

Open an issue on [GitHub](https://github.com/zayo-0ni/viora/issues). Please do not include personal information in it.
