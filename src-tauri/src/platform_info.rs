use serde::Serialize;

#[derive(Serialize)]
pub struct PlatformInfo {
    pub os: &'static str,
}

/// Reports which host the frontend is running against.
///
/// This used to carry a second field, `tv`, decided by asking Android's
/// UiModeManager for UI_MODE_TYPE_TELEVISION and the PackageManager for the
/// leanback feature — because the web-side signals all lied on cheap TV boxes,
/// which report a pointer, five touch points and a plain mobile user agent.
///
/// The question is gone: the app targets a television and nothing else, so the
/// frontend no longer asks what kind of device this is. What is left is the one
/// distinction that still exists — the Android WebView, which reaches this
/// command, versus the browser development rig, which cannot.
#[tauri::command]
pub fn platform_info() -> PlatformInfo {
    PlatformInfo { os: "android" }
}
