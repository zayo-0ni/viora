import { useFocusableControl } from "@/lib/tv-focus";
import { useEffect, useRef, useState } from "react";
import { observe, usePageVisible } from "@/lib/visibility";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { Hero } from "./hero";
import type { Meta } from "@/lib/cinemeta";

export type Slide = { meta: Meta; rank: { label: string; position: number } };

const EASE_OUT = "cubic-bezier(0.32, 0.72, 0.24, 1)";
const DRAG_BUDGE = 6;
const SNAP_RATIO = 0.18;
const FLICK_VELOCITY = 0.45;
const SLIDE_GAP_PX = 22;

export function HeroCarousel({
  slides,
  full = false,
  fullQuality = false,
  zoneKey,
}: {
  slides: Slide[];
  full?: boolean;
  fullQuality?: boolean;
  /** Names the hero as a zone so a screen can point its entry point at it. */
  zoneKey?: string;
}) {
  const { openMeta } = useView();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const [inViewport, setInViewport] = useState(true);
  const pageVisible = usePageVisible();
  const t = useT();
  const rtl = isRtl(useUiLanguage());

  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    return observe(el, setInViewport);
  }, []);
  const startX = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const moved = useRef(false);
  const widthRef = useRef(0);

  useEffect(() => {
    if (paused || dragging || !inViewport || !pageVisible || slides.length < 2) return;
    const id = setInterval(() => setActive((a) => (a + 1) % slides.length), 13000);
    return () => clearInterval(id);
  }, [paused, dragging, inViewport, pageVisible, slides.length]);

  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [slides.length, active]);

  // The hero is one stop on the page, not one per slide.
  //
  // Left and right belong to the carousel while focus is here, so the viewer
  // browses the posters with the same two keys they use everywhere else. Up and
  // down are handed back to the engine, and so is left on the first slide —
  // without that last exception the hero would be a trap with no way back to the
  // navigation.
  //
  // Declared above the early return below: hooks must run on every render, and
  // putting this after it crashed the app.
  const heroFocus = useFocusableControl({
    focusKey: zoneKey,
    onSelect: () => {
      const m = slides[active]?.meta;
      if (m) openMeta(m);
    },
    onArrowPress: (direction) => {
      if (slides.length < 2) return true;
      if (direction === "right") {
        setActive((i) => Math.min(i + 1, slides.length - 1));
        return false;
      }
      if (direction === "left") {
        if (active === 0) return true;
        setActive((i) => Math.max(i - 1, 0));
        return false;
      }
      return true;
    },
  });

  if (slides.length === 0) {
    return (
      <div
        ref={(node) => {
          viewportRef.current = node;
          (heroFocus.ref as { current: HTMLElement | null }).current = node;
        }}
        tabIndex={-1}
        data-hero-stage=""
        {...heroFocus.focusProps}
        className={`animate-pulse border border-edge-soft bg-elevated/30 ${full ? "min-h-[clamp(420px,62vh,720px)] rounded-none" : "min-h-[420px] rounded-[28px]"}`}
      />
    );
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (slides.length < 2) return;
    widthRef.current = viewportRef.current?.clientWidth ?? 1000;
    setDragging(true);
    moved.current = false;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    velocity.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > DRAG_BUDGE) {
      if (!moved.current) {
        try {
          viewportRef.current?.setPointerCapture(e.pointerId);
        } catch {}
      }
      moved.current = true;
    }
    const now = performance.now();
    const dt = now - lastT.current;
    if (dt > 0) {
      const inst = (e.clientX - lastX.current) / dt;
      velocity.current = velocity.current * 0.6 + inst * 0.4;
    }
    lastX.current = e.clientX;
    lastT.current = now;

    const W = widthRef.current || 1000;
    let next = dx;
    if (active === 0 && dx > 0) next = rubberBand(dx, W);
    else if (active === slides.length - 1 && dx < 0) next = -rubberBand(-dx, W);
    setOffset(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    try {
      if (viewportRef.current?.hasPointerCapture?.(e.pointerId)) {
        viewportRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
    setDragging(false);
    const W = widthRef.current || 1000;
    const distance = offset;
    const threshold = W * SNAP_RATIO;
    const v = velocity.current;
    const wantNext = (distance < -threshold || v < -FLICK_VELOCITY) && active < slides.length - 1;
    const wantPrev = (distance > threshold || v > FLICK_VELOCITY) && active > 0;
    if (wantNext) setActive(active + 1);
    else if (wantPrev) setActive(active - 1);
    setOffset(0);
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (moved.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const trackTransform = `translate3d(calc(${-active * 100}% + ${offset - active * SLIDE_GAP_PX}px), 0, 0)`;

  return (
    // A plain element, and that is the whole point.
    //
    // A region rendered *here* does not become the parent of `heroFocus`: the
    // hook above runs in whatever context wraps this component, so the region and
    // the stage registered as siblings — two focusables over one rectangle, the
    // outer 30px taller. Pressing down off the hero found that twin as the
    // nearest thing below, moved to it, and since a region is not a leaf the
    // engine descended into its only stop, the hero. Focus never left, and Home
    // had no way down to the rows at all.
    //
    // Nothing inside a slide registers, so neither wrapper was buying anything to
    // begin with: the hero is one stop, as declared above.
    <div
      // Says that a press back through the slides belongs to the hero.
      //
      // `onArrowPress` above already decides this correctly — it consumes the
      // press while there is an earlier slide and lets it through from the
      // first — but that runs inside the focus engine, and the handler that
      // opens the navigation rail listens in the capture phase, before anything
      // else sees the key. So it took every press and the hero could never be
      // flipped backwards: reach the last slide, press back, and the rail
      // opened instead. Saying so in the markup is what lets that handler stand
      // aside without having to know what a carousel is.
      //
      // Only while there is somewhere to go back to. On the first slide the
      // attribute is absent and the press falls through to the rail, which is
      // exactly the behaviour the cards have.
      data-hero-can-step-back={active > 0 ? "" : undefined}
      className={full ? "relative" : "flex flex-col gap-5"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={(node) => {
          viewportRef.current = node;
          (heroFocus.ref as { current: HTMLElement | null }).current = node;
        }}
        tabIndex={-1}
        {...heroFocus.focusProps}
        // It behaves as one control — OK opens the title, left and right change
        // slides — so it should say so. Without this it is a bare div holding
        // focus, which reads to anything inspecting the page as focus lost.
        role="button"
        aria-label={slides[active]?.meta?.name ?? undefined}
        data-hero-stage=""
        dir="ltr"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className={`relative overflow-hidden ${full ? "rounded-none" : "rounded-[28px]"} ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        } select-none`}
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="flex"
          dir="ltr"
          style={{
            gap: `${SLIDE_GAP_PX}px`,
            transform: trackTransform,
            transition: dragging ? "none" : `transform 720ms ${EASE_OUT}`,
            willChange: "transform",
          }}
        >
          {slides.map((s, i) => {
            const isActive = i === active;
            const distance = Math.abs(i - active);
            const shouldMount = distance <= 1 || dragging;
            return (
              // Native `inert`, not a focus region.
              //
              // The slides sit side by side, so the ones that are not active are
              // off the edge of the screen — excluded from the mouse by
              // `pointer-events: none` and from screen readers by `aria-hidden`.
              // A region here was meant to hide them from the remote too, but a
              // slide holds no focusable of its own: it was registering one
              // container per slide to guard nothing, under a parent that broke
              // the way down. The attribute covers what is actually inside.
              <div
                key={`${s.meta.id}-${i}`}
                inert={!isActive}
                dir={rtl ? "rtl" : "ltr"}
                aria-hidden={!isActive}
                className="w-full shrink-0"
                style={{
                  opacity: dragging ? 1 : isActive ? 1 : 0.42,
                  transition: dragging ? "none" : `opacity 700ms ${EASE_OUT}`,
                  pointerEvents: isActive ? "auto" : "none",
                  zIndex: 10 - distance,
                }}
              >
                {shouldMount ? (
                  <Hero
                    meta={s.meta}
                    rank={s.rank}
                    active={isActive}
                    loadBackdrop={distance === 0}
                    full={full}
                    fullQuality={fullQuality}
                  />
                ) : (
                  <div className={`w-full bg-elevated/30 ${full ? "h-[clamp(420px,62vh,720px)] rounded-none" : "h-[420px] rounded-[28px]"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {slides.length > 1 && (
        <div
          className={`flex justify-center gap-2.5 ${
            full ? "absolute bottom-4 inset-x-0" : "pt-1"
          }`}
        >
          {slides.map((_, i) => (
            // Out of the focus tree with the hero's actions: the slide already
            // advances on its own, and a remote had to step through one stop per
            // slide to get past it.
            <button
              type="button"
              tabIndex={-1}
              key={i}
              onClick={() => setActive(i)}
              aria-label={t("Slide {n}", { n: i + 1 })}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-12 bg-accent" : "w-6 bg-ink-muted/70 hover:bg-ink-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function rubberBand(distance: number, dim: number, c = 0.55): number {
  return (1 - 1 / (distance / dim / c + 1)) * dim * c;
}
