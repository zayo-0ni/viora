package app.viora

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.text.CueGroup
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import org.json.JSONArray
import org.json.JSONObject

/**
 * The Android-native half of the player.
 *
 * The page draws the whole interface — the transport, the menus, the subtitle
 * styling — and this draws the picture underneath it. A WebView will not decode
 * what a television's own silicon can: HEVC, 10-bit, 4K, most of what a debrid
 * link actually serves. ExoPlayer will, so the video goes into a SurfaceView
 * placed *behind* the WebView, and the WebView is made transparent for as long
 * as playback lasts.
 *
 * Two rules shape everything below.
 *
 * First, `@JavascriptInterface` methods arrive on a binder thread, and ExoPlayer
 * may only be touched from the thread that built it. So every verb posts to the
 * main looper, and `state()` — which has to answer immediately — returns a
 * string that the main thread prepared in advance. Nothing here reads a player
 * field off the calling thread.
 *
 * Second, the page asks for everything at once rather than being told about
 * changes one at a time. A bridge made of many small callbacks is a bridge whose
 * two halves drift apart; this one only ever answers "here is the whole state,
 * as of now".
 */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class VioraPlayer(
  private val activity: Activity,
  private val stage: VideoStage,
) {
  private val main = Handler(Looper.getMainLooper())

  /**
   * Runs a verb on the player's thread without letting it take the app down.
   *
   * Every method below arrives from JavaScript on a binder thread and hands its
   * work to the main looper, because ExoPlayer may only be touched from the
   * thread that built it. That hop is also where an exception becomes fatal:
   * nothing above a posted Runnable catches anything, so a single bad track
   * index or a call against a player that has just been torn down does not fail
   * the verb — it ends the process, and the viewer sees the app disappear.
   *
   * Caught here, the same fault becomes an error the page can read and act on:
   * the engine reports failure, and the fallback to mpv already wired into
   * use-player-bridge.ts takes over.
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
          // The snapshot could not even be rebuilt; there is nothing further to
          // report, and throwing from a catch would defeat the whole point.
        }
      }
    }
  }

  private var player: ExoPlayer? = null

  private var lastError: String? = null
  private var lastErrorKind: String? = null

  private var subDelaySec = 0.0

  /**
   * Recent cue groups, newest last.
   *
   * ExoPlayer hands over a cue at the moment it should appear, which is exactly
   * right until the viewer asks for a subtitle delay. Holding the last few
   * seconds lets a positive delay — subtitles behind the audio — be served from
   * what has already gone by. A negative delay would need cues that have not
   * been decoded yet, so it cannot be honoured here and the current cue stands.
   */
  private val cueLog = ArrayDeque<Pair<Long, String>>()

  private val httpFactory = DefaultHttpDataSource.Factory()
    .setAllowCrossProtocolRedirects(true)
    .setConnectTimeoutMs(20_000)
    .setReadTimeoutMs(20_000)
    .setUserAgent("Viora/1.0 (Android TV)")

  /** Prepared on the main thread, read from the binder thread by `state()`. */
  @Volatile
  private var snapshot: String = "{\"status\":\"idle\"}"

  private var ticking = false

  private val tick = object : Runnable {
    override fun run() {
      // Five times a second for the whole length of a film, reading tracks and
      // timings off a player that may be mid-teardown. Unguarded, one bad read
      // anywhere in that loop ends the process — and it would do it in the
      // middle of playback, which is exactly when it is least explicable.
      try {
        refresh()
      } catch (t: Throwable) {
        lastError = "state: ${t.javaClass.simpleName}: ${t.message ?: ""}"
      }
      if (ticking) main.postDelayed(this, 200)
    }
  }

  // ---------------------------------------------------------------- lifecycle

  private fun ensurePlayer(): ExoPlayer {
    player?.let { return it }
    stage.ensure()
    // Decoder fallback is the difference between a television and an emulator.
    //
    // An emulator has no hardware decoder to fail, so playback there proves
    // nothing about a real set. On a television MediaCodec hands back the
    // vendor's own decoder, and when that one refuses a stream — an unusual
    // HEVC profile, a resolution above what it admits to, a second instance
    // while another app still holds the first — ExoPlayer's default is to stop
    // at the first refusal and call the playback failed. Some vendor decoders
    // do not even refuse cleanly; they fault, and the process goes with them.
    //
    // With fallback enabled the renderer moves down the codec list instead:
    // hardware first, then whatever else claims the format, ending at the
    // software decoder that is always present. Slower on a heavy file, and the
    // only reason it is not the default is that Google would rather report the
    // failure than hide a performance cliff. Here the file plays.
    val renderers = DefaultRenderersFactory(activity)
      .setEnableDecoderFallback(true)
    val built = ExoPlayer.Builder(activity, renderers)
      .setMediaSourceFactory(DefaultMediaSourceFactory(httpFactory))
      .build()
    built.setVideoSurfaceView(stage.surface)
    // Give up the sound when something else on the television asks for it, and
    // duck rather than talk over a notification.
    built.setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(C.USAGE_MEDIA)
        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
        .build(),
      true,
    )
    // Nothing native draws subtitles — the page does, in the viewer's chosen
    // font and size — so cues are forwarded rather than rendered.
    built.trackSelectionParameters = built.trackSelectionParameters.buildUpon()
      .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
      .build()
    built.addListener(object : Player.Listener {
      override fun onPlayerError(error: PlaybackException) {
        lastError = "${error.errorCodeName}: ${error.message ?: ""}"
        lastErrorKind = when (error.errorCode) {
          PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
          PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
          PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS,
          PlaybackException.ERROR_CODE_IO_INVALID_HTTP_CONTENT_TYPE -> "network"
          PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
          PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED,
          PlaybackException.ERROR_CODE_DECODING_FAILED -> "decode"
          PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
          PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES -> "codec"
          PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND,
          PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
          PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED -> "source"
          else -> "unknown"
        }
        refresh()
      }

      override fun onPlaybackStateChanged(state: Int) = refresh()
      override fun onIsPlayingChanged(isPlaying: Boolean) = refresh()
      override fun onTracksChanged(tracks: Tracks) = refresh()

      override fun onVideoSizeChanged(videoSize: VideoSize) {
        stage.setVideoAspect(aspectOf(videoSize))
        refresh()
      }

      override fun onCues(cueGroup: CueGroup) {
        val text = cueGroup.cues.joinToString("\n") { it.text?.toString() ?: "" }.trim()
        cueLog.addLast(cueGroup.presentationTimeUs to text)
        while (cueLog.size > 120) cueLog.removeFirst()
        refresh()
      }
    })
    player = built
    return built
  }

  /** Called when the activity stops, so audio does not follow the viewer out. */
  fun onActivityStopped() {
    post { player?.pause() }
  }

  fun destroy() {
    post { teardown() }
  }

  private fun teardown() {
    ticking = false
    main.removeCallbacks(tick)
    player?.release()
    player = null
    cueLog.clear()
    lastError = null
    lastErrorKind = null
    stage.hide()
    snapshot = "{\"status\":\"idle\"}"
  }

  /** Display aspect, including a non-square pixel ratio if the file has one. */
  private fun aspectOf(size: VideoSize): Double {
    if (size.width <= 0 || size.height <= 0) return 0.0
    val par = if (size.pixelWidthHeightRatio > 0f) size.pixelWidthHeightRatio.toDouble() else 1.0
    return size.width.toDouble() / size.height.toDouble() * par
  }

  // ----------------------------------------------------------------- snapshot

  private fun refresh() {
    val exo = player
    if (exo == null) {
      snapshot = "{\"status\":\"idle\"}"
      return
    }
    val json = JSONObject()
    val status = when {
      lastError != null -> "error"
      exo.playbackState == Player.STATE_IDLE -> "idle"
      exo.playbackState == Player.STATE_BUFFERING -> "loading"
      exo.playbackState == Player.STATE_ENDED -> "ended"
      exo.isPlaying -> "playing"
      exo.playbackState == Player.STATE_READY -> "paused"
      else -> "loading"
    }
    val positionMs = exo.currentPosition
    json.put("status", status)
    json.put("positionSec", positionMs / 1000.0)
    json.put("durationSec", if (exo.duration == C.TIME_UNSET) 0.0 else exo.duration / 1000.0)
    json.put("bufferedSec", (exo.bufferedPosition - positionMs).coerceAtLeast(0L) / 1000.0)
    json.put("buffering", exo.playbackState == Player.STATE_BUFFERING)
    json.put("volume", exo.volume.toDouble())
    json.put("muted", exo.volume == 0f)
    json.put("rate", exo.playbackParameters.speed.toDouble())
    json.put("videoWidth", exo.videoSize.width)
    json.put("videoHeight", exo.videoSize.height)
    json.put("subDelaySec", subDelaySec)
    val cue = pickCue(positionMs)
    json.put("subText", cue.second)
    json.put("subStartSec", cue.first / 1_000_000.0)
    if (lastError != null) json.put("errorMessage", lastError)
    if (lastErrorKind != null) json.put("errorCode", lastErrorKind)
    json.put("audioTracks", tracksOf(exo.currentTracks, C.TRACK_TYPE_AUDIO))
    json.put("subtitleTracks", tracksOf(exo.currentTracks, C.TRACK_TYPE_TEXT))
    snapshot = json.toString()
  }

  private fun pickCue(positionMs: Long): Pair<Long, String> {
    if (cueLog.isEmpty()) return 0L to ""
    if (subDelaySec <= 0.0) return cueLog.last()
    val wantUs = positionMs * 1000L - (subDelaySec * 1_000_000.0).toLong()
    var chosen: Pair<Long, String>? = null
    for (entry in cueLog) {
      if (entry.first <= wantUs) chosen = entry else break
    }
    return chosen ?: (0L to "")
  }

  /**
   * Track ids are positions, not names.
   *
   * A `Format` need not carry an id, and two audio streams in one file often
   * carry the same one, so the page is given the coordinates it can hand back:
   * where the track sits in this media item's track list. They are re-issued on
   * every load, which is exactly when the page re-reads them.
   */
  private fun tracksOf(tracks: Tracks, type: Int): JSONArray {
    val out = JSONArray()
    val prefix = if (type == C.TRACK_TYPE_AUDIO) "a" else "s"
    val groups = tracks.groups
    for (g in groups.indices) {
      val group = groups[g]
      if (group.type != type) continue
      for (i in 0 until group.length) {
        val f = group.getTrackFormat(i)
        out.put(
          JSONObject().apply {
            put("id", "$prefix:$g:$i")
            put("lang", f.language ?: "")
            put("label", f.label ?: "")
            put("codec", f.codecs ?: "")
            put("channelCount", if (f.channelCount == Format.NO_VALUE) 0 else f.channelCount)
            put("selected", group.isTrackSelected(i))
            put("supported", group.isTrackSupported(i))
            put("forced", f.selectionFlags and C.SELECTION_FLAG_FORCED != 0)
            put("default", f.selectionFlags and C.SELECTION_FLAG_DEFAULT != 0)
          },
        )
      }
    }
    return out
  }

  private fun applyTrack(id: String) {
    val exo = player ?: return
    val parts = id.split(":")
    if (parts.size != 3) return
    val g = parts[1].toIntOrNull() ?: return
    val i = parts[2].toIntOrNull() ?: return
    val groups = exo.currentTracks.groups
    if (g < 0 || g >= groups.size) return
    val group = groups[g]
    if (i < 0 || i >= group.length) return
    exo.trackSelectionParameters = exo.trackSelectionParameters.buildUpon()
      .setTrackTypeDisabled(group.type, false)
      .setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, i))
      .build()
  }

  // ------------------------------------------------------------------ the API

  @JavascriptInterface
  fun available(): Boolean = true

  /**
   * `spec` carries the url, any request headers the add-on needs, and where to
   * start. Subtitles are not in it: the page fetches and times those itself, so
   * that a delay adjustment lands on something it owns.
   */
  @JavascriptInterface
  fun load(spec: String): Boolean {
    val json = try {
      JSONObject(spec)
    } catch (e: Throwable) {
      return false
    }
    val url = json.optString("url")
    if (url.isEmpty()) return false
    val startMs = (json.optDouble("startAtSec", 0.0) * 1000).toLong()
    val headers = HashMap<String, String>()
    json.optJSONObject("headers")?.let { h ->
      val it = h.keys()
      while (it.hasNext()) {
        val k = it.next()
        headers[k] = h.optString(k)
      }
    }
    post {
      lastError = null
      lastErrorKind = null
      cueLog.clear()
      // Set even when empty: otherwise one add-on's authorisation header would
      // ride along into the next stream that does not want it.
      httpFactory.setDefaultRequestProperties(headers)
      val exo = ensurePlayer()
      exo.setMediaItem(MediaItem.fromUri(url), if (startMs > 0) startMs else C.TIME_UNSET)
      exo.prepare()
      // Buffer, but do not start. The page decides when playback begins — it may
      // still have to ask whether to resume or start over, and a second of audio
      // under that question is a second too many.
      exo.playWhenReady = false
      stage.show()
      if (!ticking) {
        ticking = true
        main.post(tick)
      }
      refresh()
    }
    return true
  }

  @JavascriptInterface
  fun play() {
    post { player?.play() }
  }

  @JavascriptInterface
  fun pause() {
    post {
      player?.pause()
      refresh()
    }
  }

  @JavascriptInterface
  fun seek(sec: Double) {
    post {
      player?.seekTo((sec * 1000).toLong().coerceAtLeast(0L))
      refresh()
    }
  }

  @JavascriptInterface
  fun setVolume(v: Double) {
    post {
      player?.volume = v.coerceIn(0.0, 1.0).toFloat()
      refresh()
    }
  }

  @JavascriptInterface
  fun setMuted(m: Boolean) {
    post {
      player?.volume = if (m) 0f else 1f
      refresh()
    }
  }

  @JavascriptInterface
  fun setRate(r: Double) {
    post {
      player?.setPlaybackSpeed(r.coerceIn(0.25, 4.0).toFloat())
      refresh()
    }
  }

  @JavascriptInterface
  fun setAudioTrack(id: String) {
    post {
      applyTrack(id)
      refresh()
    }
  }

  /** The empty string means off; a binder call cannot carry null. */
  @JavascriptInterface
  fun setSubtitleTrack(id: String) {
    post {
      val exo = player ?: return@post
      cueLog.clear()
      if (id.isEmpty()) {
        exo.trackSelectionParameters = exo.trackSelectionParameters.buildUpon()
          .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
          .build()
      } else {
        applyTrack(id)
      }
      refresh()
    }
  }

  /**
   * Asks the engine to stop drawing subtitles itself. Nothing to do here.
   *
   * No subtitle view is attached to this player: the text renderer exists only
   * to produce cues, which are handed to the page. Disabling it on this call
   * would silence subtitles altogether, which is not what the caller means —
   * the player sends `false` for every track it intends to draw itself.
   */
  @JavascriptInterface
  fun setSubVisible(on: Boolean) {
  }

  @JavascriptInterface
  fun setSubDelay(sec: Double) {
    subDelaySec = sec
    post { refresh() }
  }

  /** `mode` is fit, fill or stretch; `aspect` is -1 unless the page forces one. */
  @JavascriptInterface
  fun setGeometry(mode: String, aspect: Double, zoom: Double) {
    post { stage.setGeometry(mode, aspect, zoom) }
  }

  /** ExoPlayer has no way to shift the audio clock against the video. */
  @JavascriptInterface
  fun setAudioDelay(sec: Double) {
    // Deliberately nothing: the menu that offers this is disabled on this
    // engine, and silently accepting the number would be worse than refusing it.
  }

  @JavascriptInterface
  fun state(): String = snapshot

  @JavascriptInterface
  fun release() {
    post { teardown() }
  }
}
