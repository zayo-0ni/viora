// Android only.
//
// This used to be a desktop application that also built for Android, and the
// difference was expressed with `#[cfg(desktop)]` on sixteen modules and a
// second command surface. The desktop target is gone: the windows, the tray,
// libmpv, the updater, the installers and everything that bound them have been
// removed rather than gated, because a branch nothing ever compiles is a branch
// nobody maintains, and it was still being read, moved and reasoned about on
// every change to this file.
//
// Modules that shell out to ffmpeg/yt-dlp stay — the spawn only fails at
// runtime, and the frontend gates them through its capability table.
mod cast;
mod cast_hls;
mod cast_server;
mod cast_subs;
mod cf_relay;
mod dlna;
mod download;
mod fonts;
mod http_fetch;
mod local_lib;
mod roku;
mod power;
mod platform_info;
mod airplay;
mod settings_store;
mod song_id;
mod stream_proxy;
mod streams;
mod stremio_auth;
mod subsync;
mod torrent_engine;
mod transcode;
mod web_server;

pub(crate) fn shutdown_services(app: &tauri::AppHandle) {
    cast_server::stop();
    torrent_engine::stop();
    let _ = app;
}

// Kept because the frontend calls it while closing, not because anything here
// waits for the answer: Android tears the activity down on its own, so there is
// no close to hold open until the flush lands.
#[tauri::command]
fn harbor_flush_done() {}

#[tauri::command]
async fn save_text_file(path: String, contents: String) -> Result<(), String> {
    let target = std::path::PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| format!("create folder: {}", e))?;
        }
    }
    std::fs::write(&target, contents.as_bytes()).map_err(|e| format!("write file: {}", e))
}

// Four commands the frontend calls to throttle the webview when the app goes to
// the background. They drove WebView2 interfaces that exist only on Windows, so
// on Android they have always been no-ops; they stay registered so the calls
// still resolve rather than rejecting.
#[tauri::command]
fn harbor_set_webview_memory_low(app: tauri::AppHandle, low: bool) {
    let _ = (&app, low);
}

#[tauri::command]
fn harbor_set_webview_visible(app: tauri::AppHandle, visible: bool) {
    let _ = (&app, visible);
}

#[tauri::command]
fn harbor_try_suspend_webview(app: tauri::AppHandle) {
    let _ = &app;
}

#[tauri::command]
fn harbor_resume_webview(app: tauri::AppHandle) {
    let _ = &app;
}

const MEDIA_EXTS: &[&str] = &[
    "mkv", "mp4", "avi", "mov", "webm", "m4v", "ts", "m2ts", "mpg", "mpeg", "wmv", "flv", "ogv", "3gp",
];

fn media_file_from_args(args: &[String]) -> Option<String> {
    for a in args {
        let lower = a.to_lowercase();
        if MEDIA_EXTS.iter().any(|e| lower.ends_with(&format!(".{e}")))
            && std::path::Path::new(a).is_file()
        {
            return Some(a.clone());
        }
    }
    None
}

static PENDING_OPEN_FILE: std::sync::OnceLock<std::sync::Mutex<Option<String>>> =
    std::sync::OnceLock::new();

fn pending_open_file() -> &'static std::sync::Mutex<Option<String>> {
    PENDING_OPEN_FILE.get_or_init(|| std::sync::Mutex::new(None))
}

#[tauri::command]
fn harbor_take_pending_file() -> Option<String> {
    pending_open_file().lock().ok().and_then(|mut g| g.take())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    {
        let args: Vec<String> = std::env::args().skip(1).collect();
        if let Some(p) = media_file_from_args(&args) {
            if let Ok(mut g) = pending_open_file().lock() {
                *g = Some(p);
            }
        }
    }
    let _ = rustls::crypto::ring::default_provider().install_default();
    let proxy_state = tauri::async_runtime::block_on(stream_proxy::ProxyState::start())
        .unwrap_or_else(|e| {
            eprintln!("[stream-proxy] failed to start: {}", e);
            stream_proxy::ProxyState::placeholder()
        });

    // Single-instance, the updater and window-state were the desktop half of
    // this list: Android runs one process per task, ships updates through the
    // store, and has no window geometry worth persisting.
    let app_builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .manage(proxy_state)
        .manage(download::DownloadState::new());

    app_builder
        .setup(move |app| {
            // Android declares its intent filters in the manifest, so the deep
            // link plugin needs no runtime registration here.
            cast_server::ensure_started_on_setup(&app.handle());
            torrent_engine::ensure_started_on_setup(&app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            use tauri::Manager;
            match event {
                // No CloseRequested arm: Android tears the activity down
                // itself, and holding the close open to flush had no
                // counterpart here even when the desktop build existed.
                tauri::WindowEvent::Focused(focused) => {
                    use tauri::Emitter;
                    let minimized = if *focused {
                        false
                    } else {
                        window.is_minimized().unwrap_or(false)
                            || !window.is_visible().unwrap_or(true)
                    };
                    let _ = window.emit(
                        "harbor://window-activity",
                        serde_json::json!({ "focused": *focused, "minimized": minimized }),
                    );
                }
                tauri::WindowEvent::Destroyed => {
                    shutdown_services(window.app_handle());
                }
                _ => {}
            }
        })
        .invoke_handler(invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// One command surface now. It used to be two, because `generate_handler!`
// takes a flat list and cannot carry `#[cfg]` on its entries, so the desktop
// build registered mpv, the tray, PiP, multiview and the rest alongside these.
fn invoke_handler() -> impl Fn(tauri::ipc::Invoke) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        harbor_flush_done,
        platform_info::platform_info,
        power::power_inhibit,
        harbor_set_webview_memory_low,
        harbor_set_webview_visible,
        harbor_try_suspend_webview,
        harbor_resume_webview,
        save_text_file,
        subsync::moviehash::compute_moviehash,
        cast_server::stop_stremio_sidecar,
        cast_server::cast_server_stop,
        web_server::web_serve_start,
        web_server::web_serve_stop,
        web_server::web_serve_status,
        settings_store::settings_read,
        settings_store::settings_write,
        download::download_start,
        download::download_cancel,
        stream_proxy::proxy_register,
        stream_proxy::proxy_unregister,
        stream_proxy::proxy_gc_idle,
        cf_relay::cf_list_accounts,
        cf_relay::cf_deploy_relay,
        cf_relay::cf_delete_relay,
        cf_relay::cf_relay_status,
        http_fetch::harbor_fetch,
        cast::cast_discover,
        dlna::lan_ip,
        cast::cast_load,
        cast::cast_play,
        cast::cast_pause,
        cast::cast_seek,
        cast::cast_stop,
        cast::cast_status,
        cast_server::cast_server_status,
        cast_server::cast_server_restart,
        torrent_engine::torrent_engine_status,
        torrent_engine::torrent_engine_add,
        torrent_engine::torrent_engine_select,
        torrent_engine::torrent_engine_stats,
        torrent_engine::torrent_engine_remove,
        torrent_engine::torrent_engine_selftest,
        torrent_engine::torrent_engine_restart,
        torrent_engine::torrent_engine_hard_reset,
        torrent_engine::torrent_engine_set_options,
        transcode::cast_ffmpeg_present,
        streams::streams_run_pipeline,
        streams::streams_parse,
        streams::streams_core_version,
        local_lib::harbor_scan_folder,
        stremio_auth::stremio_auth_start,
        song_id::recognize_now_playing,
        harbor_take_pending_file,
    ]
}
