/**
 * The app mark: the owner's own logo — a "V" drawn as a curl of film.
 *
 * Kept at this path under this export name so the ~40 call sites across the ten
 * chrome themes keep working untouched; only the artwork changed. It is a
 * raster rather than a path because the original is a rendered piece with
 * gradients and highlights that no hand-written SVG would reproduce honestly.
 *
 * The image carries its own colour, so the `currentColor` the old drawing used
 * no longer applies — which is right: this is a fixed piece of identity, not an
 * icon that takes the theme's accent.
 */
export function VioraMark({ className }: { className?: string }) {
  return (
    <img
      src="/viora-mark.png"
      alt=""
      aria-hidden
      draggable={false}
      className={`object-contain ${className ?? ""}`}
    />
  );
}
