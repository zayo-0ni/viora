<div align="right"><b>English</b> &nbsp;·&nbsp; <a href="PRIVACY_AR.md">العربية</a></div>

# Privacy

This statement describes the Viora Android app from version 1.0.0. It will be updated before any feature that changes it is released.

## In short

- A **Viora account is optional**. Without signing in, Viora sends nothing to a Viora server.
- If you sign in (with Google), your account keeps your **settings** and your **VIP Viora membership**. Your library, watch history, progress and downloads still **stay only on your device**.
- Viora contains **no analytics, no advertising SDKs and no crash reporting**.

## What stays on your device

| Data | Purpose |
| --- | --- |
| Library and watch progress | Continue Watching, Next Up, your saved titles |
| Downloads and their details | Offline viewing and offline title pages |
| Settings, provider switches, theme | Your choices (a copy of some settings goes to your account if you sign in — see below) |
| Personal keys and sign-ins to other services | TMDB, MDBList, Trakt, Simkl, debrid and similar integrations you set up |
| Provider list and Provider Health results | Choosing and checking sources |
| Image and metadata caches | Faster browsing |

Uninstalling Viora, or clearing its storage in Android settings, deletes all of it.

## The optional Viora account

You can sign in from **Settings → Account** with your Google account. Viora uses Google's own sign-in on Android and asks Google only for your basic profile (`openid email profile`); it never sees your Google password and gets no access to other Google data.

The account is hosted by [Supabase](https://supabase.com) (data center in Seoul, South Korea). It holds:

| Data | Why |
| --- | --- |
| Your Google account id, email address, name and profile photo link | To identify your account and show who is signed in |
| Your synced settings | So they follow you between devices: interface language, theme and appearance, catalog sources, player and subtitle preferences, source card badges, page layouts, episode alert switches, and your VIP Viora provider switches |
| Your VIP Viora membership (status and dates) | To unlock VIP Viora; it is checked online each time it is needed and never stored on the device |

**Never uploaded:** your library, watch history, Continue Watching, progress, downloads, ratings, search history, personal API keys, sign-ins to other services (Trakt, Simkl, debrid), add-on addresses and profile PINs.

The sign-in session is stored on your device encrypted with a key held by Android's Keystore. **Sign out** ends the session on the server and on the device; it deletes nothing on the device. **Delete account** (Settings → Account) permanently deletes your account and everything stored with it on the server; your device keeps its own data.

## What Viora sends over the network

Viora only makes the requests needed for what you do in the app:

- **Metadata** — browsing, searching and opening titles request information and artwork from TMDB, Cinemeta and an IMDb data service. Your search text is sent to these services.
- **Sources** — when you open the sources of a movie or episode, Viora sends that title's identifiers (for example its TMDB or IMDb id, season and episode) to the provider integrations you have enabled, and then loads the stream from the host they return.
- **Provider Health** — **Refresh Health** checks each server once with a test title (about 10–15 MB).
- **Provider list** — Viora downloads the signed provider list from this GitHub repository when it checks for updates.
- **Viora account** — only when you are signed in: your synced settings are exchanged with your account, and VIP Viora asks the account whether your membership is active.
- **App updates** — at most once a day, and whenever you tap **Check for updates**, Viora reads `updates/latest.json` from this GitHub repository. It downloads a new APK from this repository's Releases only when you tap **Download update**.
- **Casting** — Viora looks for Chromecast and DLNA devices on your local network and, when needed, relays the stream from your phone to the TV over that network.

Like any website you visit, these services can see your IP address and the requests made to them. Their own privacy policies apply to what they do with that information.

## Optional services

Some integrations in Settings connect to a third-party service only after you sign in to it or enter your own key. Nothing is sent to such a service unless you set it up, and you can disconnect it at any time.

## Permissions

Viora asks only for what its features need: network access, Wi-Fi multicast to find cast devices, notifications, background services that keep playback and downloads running, and permission to install apps — used only to hand an update you chose to download, after it has been verified, to Android's installer, which asks you to confirm. It does not ask for your contacts, location, camera, microphone or files. Android lists every permission in the app's settings.

## Questions

Open an issue on [GitHub](https://github.com/zayo-0ni/viora/issues). Please do not include personal information in it.
