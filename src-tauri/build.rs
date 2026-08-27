use std::path::PathBuf;

fn main() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    // Three branches used to live here, one per desktop target, each teaching
    // the linker where that platform keeps libmpv: a bundled DLL on Windows, a
    // Homebrew prefix on macOS, pkg-config on Linux. Android links no libmpv —
    // the engine that plays here is compiled into the app — so there is nothing
    // left to find.

    // Tell Cargo that the web bundle is an input to this crate.
    //
    // `generate_context!` embeds `dist/` into the library, but nothing declares
    // that dependency, so Cargo sees an unchanged `src/` and reuses the previous
    // `.so` — with the previous JavaScript still inside it. The build reports
    // success, the APK installs cleanly, and the device runs code from an
    // earlier build. It has cost two full rounds of on-device measurement here:
    // once against a fix that was never installed, and once against a screen
    // whose entry point had not shipped.
    //
    // `index.html` is listed as well as the directory because it carries the
    // hashed bundle name, so it changes on every real frontend build — which is
    // exactly the signal that must invalidate this crate.
    let dist = manifest.parent().unwrap_or(&manifest).join("dist");
    println!("cargo:rerun-if-changed={}", dist.display());
    println!("cargo:rerun-if-changed={}", dist.join("index.html").display());

    tauri_build::build()
}
