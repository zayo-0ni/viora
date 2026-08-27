package app.viora

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import `is`.xyz.mpv.MPV
import org.json.JSONArray
import org.json.JSONObject

/**
 * The second engine: libmpv, with ffmpeg, libass and libplacebo inside it.
 *
 * ExoPlayer asks the television what it can decode and plays that. mpv brings
 * its own decoders, so it plays the files the television refuses — DTS and
 * TrueHD on a box whose firmware never licensed them, containers nothing else
 * will open. It costs about forty megabytes and more power, which is exactly
 * why it is a choice rather than the default.
 *
 * The verbs below are deliberately the same as {@link VioraPlayer}'s, down to
 * the JSON the page receives, so one bridge in the web layer drives either
 * engine without knowing which one answered.
 *
 * State is polled on the main thread rather than assembled from mpv's event
 * callbacks: property reads are cheap and safe from any thread, and `state()`
 * has to answer a binder call immediately, so it returns a string the main
 * thread prepared in advance. mpv itself is only ever touched from the main
 * thread.
 */
class VioraMpv(
  private val activity: Activity,
  private val stage: VideoStage,
) {
  private val main = Handler(Looper.getMainLooper())

  /**
   * Runs a verb on the main thread without letting it take the app down.
   *
   * See the twin of this in VioraPlayer.kt. It matters more here: libmpv is
   * driven by string properties, so a call that would be a type error in a
   * typed API is a runtime throw in this one — and an uncaught throw on a
   * posted Runnable ends the process rather than the verb.
   */
  private fun post(body: () -> Unit) {
    main.post {
      try {
        body()
      } catch (t: Throwable) {
        lastError = "bridge: ${t.javaClass.simpleName}: ${t.message ?: ""}"
        lastErrorKind = "unknown"
        try {
          refresh()
        } catch (ignored: Throwable) {
          // Nothing further can be reported; throwing here defeats the point.
        }
      }
    }
  }

  private companion object {
    /** How long mpv gets to open a stream before an idle engine reads as failure. */
    const val OPEN_GRACE_MS = 4_000L
  }

  private val view: VioraMpvView?
    get() = stage.surface as? VioraMpvView

  private val mpv: MPV?
    get() = view?.takeIf { it.isStarted }?.mpv

  private var lastError: String? = null
  private var lastErrorKind: String? = null

  /** When mpv was handed a file; 0 means the page has not asked for one. */
  private var loadedAt = 0L

  private var trackCount = -1
  private var audioTracks = JSONArray()
  private var subtitleTracks = JSONArray()

  /** Answered once: whether libmpv shipped for this device. See `available`. */
  @Volatile
  private var installed: Boolean? = null

  @Volatile
  private var snapshot: String = "{\"status\":\"idle\"}"

  private var ticking = false

  private val tick = object : Runnable {
    override fun run() {
      // Five times a second, reading properties off an engine that may be
      // mid-teardown. One bad read here would end the process mid-film.
      try {
        refresh()
      } catch (t: Throwable) {
        lastError = "state: ${t.javaClass.simpleName}: ${t.message ?: ""}"
      }
      if (ticking) main.postDelayed(this, 200)
    }
  }

  // ---------------------------------------------------------------- lifecycle

  private fun ensureStarted(): VioraMpvView {
    stage.ensure()
    val v = view ?: throw IllegalStateException("mpv view was not created")
    if (!v.isStarted) {
      v.start()
      // Kept as evidence, never as a verdict. mpv logs at error level for
      // things it then recovers from, so whether playback failed is decided in
      // `refresh` from mpv's own state; this only supplies the wording.
      v.mpv.addLogObserver(object : MPV.LogObserver {
        override fun logMessage(prefix: String, level: Int, text: String) {
          if (level > 2) return // fatal and error only
          lastError = "$prefix: ${text.trim()}"
          lastErrorKind = when {
            text.contains("Failed to open") || text.contains("Failed to recognize") -> "source"
            text.contains("HTTP") || text.contains("Connection") || text.contains("network") -> "network"
            text.contains("codec") || text.contains("decoder") -> "codec"
            prefix == "vo" || prefix == "gpu" -> "decode"
            else -> "unknown"
          }
        }
      })
      v.mpv.setOptionString("msg-level", "all=error")
    }
    return v
  }

  fun onActivityStopped() {
    post { mpv?.setPropertyBoolean("pause", true) }
  }

  fun destroy() {
    post { teardown() }
  }

  private fun teardown() {
    ticking = false
    main.removeCallbacks(tick)
    runCatching { view?.stop() }
    loadedAt = 0L
    trackCount = -1
    audioTracks = JSONArray()
    subtitleTracks = JSONArray()
    lastError = null
    lastErrorKind = null
    stage.hide()
    snapshot = "{\"status\":\"idle\"}"
  }

  // ----------------------------------------------------------------- snapshot

  private fun str(name: String): String =
    runCatching { mpv?.getPropertyString(name) ?: "" }.getOrDefault("")

  private fun num(name: String): Double =
    runCatching { mpv?.getPropertyDouble(name) ?: 0.0 }.getOrDefault(0.0)

  private fun flag(name: String): Boolean =
    runCatching { mpv?.getPropertyBoolean(name) ?: false }.getOrDefault(false)

  private fun int(name: String): Int =
    runCatching { mpv?.getPropertyInt(name) ?: 0 }.getOrDefault(0)

  /**
   * Rebuilds the track lists, but only when the count moves.
   *
   * mpv exposes a track list as one property per field, so a full read is a few
   * hundred calls across the bridge. At five times a second that would cost more
   * than the decoding does; the count changing is what a new file looks like.
   */
  private fun readTracks() {
    val count = int("track-list/count")
    if (count == trackCount) return
    trackCount = count
    val audio = JSONArray()
    val subs = JSONArray()
    for (i in 0 until count) {
      val type = str("track-list/$i/type")
      if (type != "audio" && type != "sub") continue
      val entry = JSONObject().apply {
        put("id", str("track-list/$i/id"))
        put("lang", str("track-list/$i/lang"))
        put("label", str("track-list/$i/title"))
        put("codec", str("track-list/$i/codec"))
        put("channelCount", int("track-list/$i/demux-channel-count"))
        put("selected", flag("track-list/$i/selected"))
        put("supported", true)
        put("forced", flag("track-list/$i/forced"))
        put("default", flag("track-list/$i/default"))
      }
      if (type == "audio") audio.put(entry) else subs.put(entry)
    }
    audioTracks = audio
    subtitleTracks = subs
  }

  private fun refresh() {
    if (mpv == null) {
      snapshot = "{\"status\":\"idle\"}"
      return
    }
    readTracks()
    val idle = flag("idle-active")
    val eof = flag("eof-reached")
    val paused = flag("pause")
    val buffering = flag("paused-for-cache")
    val duration = num("duration")
    val position = num("time-pos")

    // What "failed" means here: mpv was handed a file, had time to open it, and
    // is sitting with nothing loaded. That is the only state a viewer should be
    // shown an error for. The grace period matters -- `idle-active` is still
    // true for a moment after `loadfile`, and reporting on that would fail
    // every stream in the instant before it started.
    val settled = android.os.SystemClock.uptimeMillis() - loadedAt > OPEN_GRACE_MS
    val failed = loadedAt > 0L && idle && settled

    val status = when {
      loadedAt == 0L -> "idle"
      failed -> "error"
      eof -> "ended"
      buffering -> "loading"
      duration <= 0.0 -> "loading"
      paused -> "paused"
      else -> "playing"
    }

    val json = JSONObject()
    json.put("status", status)
    json.put("positionSec", position)
    json.put("durationSec", duration)
    json.put("bufferedSec", num("demuxer-cache-duration"))
    json.put("buffering", buffering)
    // mpv's volume is a percentage and can exceed 100; the page works in 0..1.
    json.put("volume", num("volume") / 100.0)
    json.put("muted", flag("mute"))
    json.put("rate", num("speed"))
    json.put("videoWidth", int("dwidth"))
    json.put("videoHeight", int("dheight"))
    json.put("subDelaySec", num("sub-delay"))
    json.put("audioDelaySec", num("audio-delay"))
    json.put("subText", str("sub-text"))
    json.put("subStartSec", num("sub-start"))
    json.put("hdrGamma", str("video-params/gamma"))
    if (failed) {
      json.put("errorMessage", lastError ?: "mpv could not open this stream.")
      json.put("errorCode", lastErrorKind ?: "source")
    }
    json.put("audioTracks", audioTracks)
    json.put("subtitleTracks", subtitleTracks)
    snapshot = json.toString()
  }

  // ------------------------------------------------------------------ the API

  /**
   * Whether this build carries libmpv for this device's architecture.
   *
   * Checked by looking for the file rather than loading it: the page asks this
   * every time the player mounts, and answering by mapping forty megabytes of
   * shared library would be a real cost paid by viewers on the other engine.
   */
  @JavascriptInterface
  fun available(): Boolean {
    installed?.let { return it }
    val abi = android.os.Build.SUPPORTED_ABIS.firstOrNull() ?: ""
    val answer = runCatching {
      // Two places, because it depends on how the APK was packaged: older
      // builds unpack native libraries to disk, current ones map them straight
      // out of the APK and leave that directory empty.
      java.io.File(activity.applicationInfo.nativeLibraryDir, "libmpv.so").exists() ||
        java.util.zip.ZipFile(activity.applicationInfo.sourceDir).use {
          it.getEntry("lib/$abi/libmpv.so") != null
        }
    }.getOrDefault(false)
    installed = answer
    return answer
  }

  /**
   * `spec` carries the url, any request headers the add-on needs, and where to
   * start. Subtitles are not in it: the page fetches and times those itself, so
   * that a delay adjustment lands on something it owns.
   */
  @JavascriptInterface
  fun load(spec: String): Boolean {
    val json = runCatching { JSONObject(spec) }.getOrNull() ?: return false
    val url = json.optString("url")
    if (url.isEmpty()) return false
    val startSec = json.optDouble("startAtSec", 0.0)
    val headers = HashMap<String, String>()
    json.optJSONObject("headers")?.let { h ->
      val keys = h.keys()
      while (keys.hasNext()) {
        val k = keys.next()
        headers[k] = h.optString(k)
      }
    }
    post {
      lastError = null
      lastErrorKind = null
      trackCount = -1
      // Before the engine, so the surface is already on its way while mpv
      // starts up rather than being asked for afterwards.
      stage.show()
      val v = try {
        ensureStarted()
      } catch (e: Throwable) {
        lastError = "mpv failed to start: ${e.message ?: e.javaClass.simpleName}"
        lastErrorKind = "unknown"
        loadedAt = android.os.SystemClock.uptimeMillis() - OPEN_GRACE_MS
        refresh()
        return@post
      }
      // Sticky, so always written: an empty value clears what the previous
      // stream needed rather than leaking one add-on's authorisation onward.
      v.mpv.setPropertyString("http-header-fields", encodeHeaders(headers))
      // Paused until the page says otherwise: it may still have to ask whether
      // to resume or start over, and a second of audio under that question is a
      // second too many.
      v.mpv.setPropertyBoolean("pause", true)

      loadedAt = android.os.SystemClock.uptimeMillis()
      v.load(url, startSec)
      if (!ticking) {
        ticking = true
        main.post(tick)
      }
      refresh()
    }
    return true
  }

  /**
   * mpv takes headers as one comma-separated string, so a value containing a
   * comma -- which a User-Agent very often does -- would otherwise be read as
   * the start of another header.
   */
  private fun encodeHeaders(headers: Map<String, String>): String =
    headers.entries
      .filter { it.key.isNotBlank() && it.value.isNotBlank() }
      .joinToString(",") { (k, v) ->
        "$k: $v".replace("\\", "\\\\").replace(",", "\\,")
      }

  @JavascriptInterface
  fun play() {
    post {
      mpv?.setPropertyBoolean("pause", false)
      refresh()
    }
  }

  @JavascriptInterface
  fun pause() {
    post {
      mpv?.setPropertyBoolean("pause", true)
      refresh()
    }
  }

  @JavascriptInterface
  fun seek(sec: Double) {
    post {
      mpv?.setPropertyDouble("time-pos", sec.coerceAtLeast(0.0))
      refresh()
    }
  }

  @JavascriptInterface
  fun setVolume(v: Double) {
    post {
      mpv?.setPropertyDouble("volume", (v * 100.0).coerceIn(0.0, 600.0))
      refresh()
    }
  }

  @JavascriptInterface
  fun setMuted(m: Boolean) {
    post {
      mpv?.setPropertyBoolean("mute", m)
      refresh()
    }
  }

  @JavascriptInterface
  fun setRate(r: Double) {
    post {
      mpv?.setPropertyDouble("speed", r.coerceIn(0.01, 100.0))
      refresh()
    }
  }

  @JavascriptInterface
  fun setAudioTrack(id: String) {
    post {
      mpv?.setPropertyString("aid", if (id.isEmpty()) "no" else id)
      trackCount = -1
      refresh()
    }
  }

  /** The empty string means off; a binder call cannot carry null. */
  @JavascriptInterface
  fun setSubtitleTrack(id: String) {
    post {
      mpv?.setPropertyString("sid", if (id.isEmpty()) "no" else id)
      trackCount = -1
      refresh()
    }
  }

  /**
   * Asks the engine to stop drawing subtitles itself. It never starts.
   *
   * `sub-visibility` is off from the moment mpv is created, because the page
   * renders subtitles in the viewer's own font and size. The call is re-asserted
   * rather than obeyed: its argument means "you draw them", and honouring that
   * would put mpv's text on screen alongside the page's.
   */
  @JavascriptInterface
  fun setSubVisible(on: Boolean) {
    post { mpv?.setPropertyBoolean("sub-visibility", false) }
  }

  @JavascriptInterface
  fun setSubDelay(sec: Double) {
    post {
      mpv?.setPropertyDouble("sub-delay", sec)
      refresh()
    }
  }

  /** Unlike ExoPlayer, mpv can shift the audio clock in either direction. */
  @JavascriptInterface
  fun setAudioDelay(sec: Double) {
    post {
      mpv?.setPropertyDouble("audio-delay", sec)
      refresh()
    }
  }

  /**
   * Geometry is mpv's own business here.
   *
   * The surface stays the size of the screen and mpv scales into it, which is
   * the opposite of the ExoPlayer side -- there the surface rectangle *is* the
   * aspect ratio. Same three arguments from the page either way.
   */
  @JavascriptInterface
  fun setGeometry(mode: String, aspect: Double, zoom: Double) {
    post {
      val m = mpv ?: return@post
      m.setPropertyBoolean("keepaspect", mode != "stretch")
      m.setPropertyDouble("panscan", if (mode == "fill") 1.0 else 0.0)
      m.setPropertyDouble("video-zoom", zoom)
      m.setPropertyString("video-aspect-override", if (aspect > 0) aspect.toString() else "-1")
    }
  }

  /** libplacebo shader chain, for Anime4K and anything like it. */
  @JavascriptInterface
  fun setShaders(paths: String) {
    post { mpv?.setPropertyString("glsl-shaders", paths) }
  }

  @JavascriptInterface
  fun setAudioNormalize(on: Boolean) {
    post {
      mpv?.command(
        *(if (on) arrayOf("af", "set", "dynaudnorm=g=5:f=250:r=0.9:p=0.5")
        else arrayOf("af", "set", "")),
      )
    }
  }

  @JavascriptInterface
  fun state(): String = snapshot

  @JavascriptInterface
  fun release() {
    post { teardown() }
  }
}
