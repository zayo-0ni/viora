package app.viora

import android.app.Activity
import android.graphics.Color
import android.view.Gravity
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebView
import android.widget.FrameLayout

/**
 * The rectangle the video is drawn on, and everything that has to be true for
 * the page to be seen on top of it.
 *
 * Both native engines want the same thing: a surface *behind* the WebView, a
 * WebView that stops painting its own background while playback lasts, and a
 * screen that does not go to sleep. Only the geometry differs — ExoPlayer
 * stretches its frame to whatever rectangle the surface occupies, so the
 * rectangle is the control; mpv scales internally and wants the whole screen.
 * That is the one flag this class takes.
 */
class VideoStage(
  private val activity: Activity,
  private val webView: () -> WebView?,
  /** True for ExoPlayer: aspect ratio is expressed by sizing the surface. */
  private val sizesSurface: Boolean,
  /**
   * What to draw on. ExoPlayer is happy with a bare SurfaceView; mpv needs the
   * library's own subclass, which owns the surface's lifecycle and is the whole
   * reason playback survives being stopped and started again.
   */
  private val createView: (Activity) -> SurfaceView = { SurfaceView(it) },
) {
  private companion object {
    /**
     * Which stage currently owns the transparent WebView, if any.
     *
     * There are two stages — one per engine — and neither knows the other
     * exists. Both reach for the same two pieces of global state: the WebView's
     * background, which has to be transparent for a surface underneath to be
     * seen at all, and the keep-awake flag.
     *
     * Switching engines tears the old one down *after* the new one is showing,
     * because the page asks for the new picture before it lets go of the old
     * engine. Without this, the teardown's `hide()` painted the WebView black
     * again — over a surface that was by then drawing the film. The controls
     * still worked, the audio still played, and the screen was black, which is
     * exactly the shape of the bug that looks like a broken second player.
     *
     * Ownership is claimed on show and released on hide only by the claimant,
     * so a late teardown can no longer undo a live stage.
     */
    @Volatile
    var chromeOwner: VideoStage? = null
  }

  private var container: FrameLayout? = null
  private var surfaceView: SurfaceView? = null

  private var fillMode = "fit"
  private var aspectOverride = -1.0
  private var zoomLog2 = 0.0
  private var videoAspect = 0.0

  val surface: SurfaceView?
    get() = surfaceView

  /**
   * Builds the views once, underneath everything else.
   *
   * `addView(frame, 0)` is what puts the video under the WebView rather than
   * over it — a surface on top of the interface is a black rectangle where the
   * controls should be, which is the usual way this goes wrong.
   */
  fun ensure() {
    if (surfaceView != null) return
    val root = activity.findViewById<ViewGroup>(android.R.id.content) ?: return
    val frame = FrameLayout(activity)
    frame.setBackgroundColor(Color.BLACK)
    val view = createView(activity)
    frame.addView(
      view,
      FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
        Gravity.CENTER,
      ),
    )
    frame.visibility = View.GONE
    root.addView(
      frame,
      0,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      ),
    )
    container = frame
    surfaceView = view
  }

  fun show() {
    ensure()
    container?.visibility = View.VISIBLE
    applyLayout()
    // The page is drawn on top of the video from here on, so it must stop
    // painting its own background over it. Taking ownership here is what stops
    // the other engine's teardown from painting it back.
    chromeOwner = this
    webView()?.setBackgroundColor(Color.TRANSPARENT)
    activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  fun hide() {
    container?.visibility = View.GONE
    // Only the stage that made the page transparent may make it opaque again.
    // On an engine switch the other stage is already showing by the time this
    // runs, and restoring the background here would black out its picture.
    if (chromeOwner !== this) return
    chromeOwner = null
    webView()?.setBackgroundColor(Color.BLACK)
    activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  fun setVideoAspect(aspect: Double) {
    if (aspect == videoAspect) return
    videoAspect = aspect
    applyLayout()
  }

  /** `mode` is fit, fill or stretch; `aspect` is -1 unless the page forces one. */
  fun setGeometry(mode: String, aspect: Double, zoom: Double) {
    fillMode = mode
    aspectOverride = aspect
    zoomLog2 = zoom
    applyLayout()
  }

  /**
   * Sizes the surface instead of scaling the picture inside it.
   *
   * ExoPlayer's default scaling mode stretches the decoded frame to whatever
   * rectangle the surface occupies — aspect ratio is the *view's* job, not the
   * decoder's. So fit, fill, stretch, zoom and a forced ratio are all one
   * calculation: work out the rectangle, hand it to the layout, and let the
   * frame follow. The parent clips whatever hangs over the edges.
   */
  fun applyLayout() {
    val frame = container ?: return
    val view = surfaceView ?: return
    if (!sizesSurface) return
    val boxW = frame.width
    val boxH = frame.height
    if (boxW <= 0 || boxH <= 0) {
      frame.post { applyLayout() }
      return
    }
    val target = if (aspectOverride > 0) aspectOverride else videoAspect
    val boxAspect = boxW.toDouble() / boxH.toDouble()

    var w = boxW.toDouble()
    var h = boxH.toDouble()
    if (target > 0 && fillMode != "stretch") {
      val cover = fillMode == "fill"
      val wider = boxAspect > target
      if (wider == cover) {
        w = boxW.toDouble()
        h = w / target
      } else {
        h = boxH.toDouble()
        w = h * target
      }
    }
    if (zoomLog2 != 0.0) {
      val factor = Math.pow(2.0, zoomLog2)
      w *= factor
      h *= factor
    }

    val params = view.layoutParams as FrameLayout.LayoutParams
    val nw = Math.max(1, Math.round(w).toInt())
    val nh = Math.max(1, Math.round(h).toInt())
    if (params.width == nw && params.height == nh) return
    params.width = nw
    params.height = nh
    params.gravity = Gravity.CENTER
    view.layoutParams = params
  }
}
