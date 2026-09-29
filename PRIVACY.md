<div align="right"><b>English</b> &nbsp;·&nbsp; <a href="PRIVACY_AR.md">العربية</a></div>

# Privacy

This statement describes the Viora Android app as currently released. It will be updated before any feature that changes it — such as accounts or sync — is released.

## In short

- There is **no Viora account**, and Viora runs no server that receives your data.
- Viora contains **no analytics, no advertising SDKs and no crash reporting**.
- Your library, watch progress, downloads and settings are **stored only on your device**.

## What stays on your device

| Data | Purpose |
| --- | --- |
| Library and watch progress | Continue Watching, Next Up, your saved titles |
| Downloads and their details | Offline viewing and offline title pages |
| Settings, provider switches, theme | Your choices |
| Provider list and Provider Health results | Choosing and checking sources |
| Image and metadata caches | Faster browsing |

Uninstalling Viora, or clearing its storage in Android settings, deletes all of it.

## What Viora sends over the network

Viora only makes the requests needed for what you do in the app:

- **Metadata** — browsing, searching and opening titles request information and artwork from TMDB, Cinemeta and an IMDb data service. Your search text is sent to these services.
- **Sources** — when you open the sources of a movie or episode, Viora sends that title's identifiers (for example its TMDB or IMDb id, season and episode) to the provider integrations you have enabled, and then loads the stream from the host they return.
- **Provider Health** — **Refresh Health** checks each server once with a test title (about 10–15 MB).
- **Provider list** — Viora downloads the signed provider list from this GitHub repository when it checks for updates.
- **Casting** — Viora looks for Chromecast and DLNA devices on your local network and, when needed, relays the stream from your phone to the TV over that network.

Like any website you visit, these services can see your IP address and the requests made to them. Their own privacy policies apply to what they do with that information.

## Optional services

Some integrations in Settings connect to a third-party service only after you sign in to it or enter your own key. Nothing is sent to such a service unless you set it up, and you can disconnect it at any time.

## Permissions

Viora asks only for what its features need: network access, Wi-Fi multicast to find cast devices, notifications, and background services that keep playback and downloads running. It does not ask for your contacts, location, camera, microphone or files. Android lists every permission in the app's settings.

## Questions

Open an issue on [GitHub](https://github.com/zayo-0ni/viora/issues). Please do not include personal information in it.
