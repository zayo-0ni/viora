import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Release signing, if a keystore has been supplied. CI writes this file from
// repository secrets; it is gitignored, so a clone never carries the key.
val keystoreProperties = Properties().apply {
    val propFile = rootProject.file("keystore.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 36
    namespace = "app.viora"

    signingConfigs {
        if (keystoreProperties.containsKey("storeFile")) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "app.viora"
        minSdk = 24
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            // An unsigned release APK cannot be installed at all — Android
            // rejects it with a bare "App not installed". Fall back to the debug
            // key when no keystore is configured so a local release build stays
            // testable rather than silently producing something uninstallable.
            signingConfig = signingConfigs.findByName("release")
                ?: signingConfigs.getByName("debug")
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")

    // The Android-native playback path. Media3 is ExoPlayer: it decodes with the
    // device's own hardware decoders, which is what makes 4K and HEVC work on a
    // television that would refuse the same file through a WebView <video>.
    // HLS and DASH are separate artifacts because the core does not carry them.
    //
    // media3-ui is deliberately absent. The interface is the web page — the
    // transport, the menus, the subtitles are all drawn there — and the only
    // native view involved is a bare SurfaceView, so PlayerView and its
    // dependencies would be weight with nothing on the screen to show for it.
    implementation("androidx.media3:media3-exoplayer:1.8.0")
    implementation("androidx.media3:media3-exoplayer-hls:1.8.0")
    implementation("androidx.media3:media3-exoplayer-dash:1.8.0")

    // The second engine: libmpv, with ffmpeg, libass and libplacebo inside it.
    //
    // This particular build (the one NuvioTV ships) carries two things the app
    // cannot supply for itself: a BaseMPVView that owns the drawing surface's
    // lifecycle, and a CA bundle in its assets. Without the first, mpv gets
    // handed a dead surface and fails after decoding the first frame; without
    // the second, every HTTPS stream fails to open, because Android has no
    // PEM bundle at any path ffmpeg can read.
    implementation("io.github.abdallahmehiz:mpv-android-lib:0.1.12")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")