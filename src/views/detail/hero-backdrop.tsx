import { useEffect, useRef, useState } from "react";

/**
 * The widest TMDB backdrop worth asking a television for.
 *
 * `original` is up to 3840px. Measured on a 1080p set: this layer occupies
 * 1012 CSS px, which is 2024 device pixels at 2x — so the file carried nearly
 * four times the pixels the panel could show, 8.3 megapixels decoded to display
 * 2. Backdrops are the single most expensive thing on the screen because there
 * is one behind everything, and the profile during navigation put 41.7% of the
 * main thread in raster.
 *
 * w1280 was the first step down from that, and it is still nearly the panel's
 * own width — sharper than anything behind a scrim needs to be. w780 is another
 * two and a half times cheaper again, and this layer is never looked at
 * directly: a gradient covers most of it, the logo and the buttons sit on top,
 * and the set renders at 1080p whatever the panel is. Detail spent here is
 * detail nobody sees, paid for in download time on the viewer's connection and
 * decode time on a four-core box.
 */
const BACKDROP_SIZE = "w780";

function Layer({ url, first, onReady }: { url: string; first: boolean; onReady: () => void }) {
  const lowUrl = url.replace(/\/t\/p\/(w\d+|original)\//, "/t/p/w300/");
  const highUrl = url.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${BACKDROP_SIZE}/`);
  const canBlurUp = first && lowUrl !== highUrl;
  const [ready, setReady] = useState(false);
  const done = () => {
    setReady(true);
    onReady();
  };
  return (
    <>
      {canBlurUp && (
        <img
          src={lowUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          // Blurred small, then scaled up.
          //
          // A 40px blur across the whole stage is 1066x672 pixels of gaussian
          // work every time anything above it repaints, and this television has
          // a Mali-G52. The result is unrecognisable by design, so it does not
          // need to be computed at full size: a quarter-scale layer with a
          // quarter of the radius looks the same once it is scaled back up, and
          // the blur then runs over a sixteenth of the pixels.
          style={{
            width: "25%",
            height: "25%",
            transformOrigin: "top left",
            transform: "scale(4.2)",
            filter: "blur(10px)",
          }}
          className="absolute inset-0 object-cover"
        />
      )}
      <img
        src={highUrl}
        alt=""
        decoding="async"
        fetchPriority="high"
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) done();
        }}
        onLoad={done}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}

export function HeroBackdrop({ url }: { url: string }) {
  const [layers, setLayers] = useState<{ id: number; url: string }[]>([{ id: 0, url }]);
  const nextId = useRef(1);
  useEffect(() => {
    setLayers((prev) => {
      if (prev[prev.length - 1]?.url === url) return prev;
      // A backdrop that has been shown before keeps its layer.
      //
      // Every change used to append a layer under a fresh id, and a fresh id is
      // a fresh element: it starts transparent and fades in over seven hundred
      // milliseconds. So moving to another title and coming back replayed the
      // whole arrival for a picture the engine already had in hand — the owner
      // reported it as the image loading again, and he was watching an
      // animation, not a download.
      //
      // Reusing the id keeps the same element. React moves it rather than
      // rebuilding it, the picture is simply already there, and nothing fades.
      const seen = prev.findIndex((l) => l.url === url);
      if (seen !== -1) {
        const kept = prev[seen];
        return [...prev.slice(0, seen), ...prev.slice(seen + 1), kept];
      }
      return [...prev, { id: nextId.current++, url }];
    });
  }, [url]);
  const settle = (id: number) =>
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      return idx > 0 ? prev.slice(idx) : prev;
    });
  return (
    <>
      {layers.map((l) => (
        <Layer key={l.id} url={l.url} first={l.id === 0} onReady={() => settle(l.id)} />
      ))}
    </>
  );
}
