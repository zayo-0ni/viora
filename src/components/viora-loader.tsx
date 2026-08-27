import lottie, { type AnimationItem } from "lottie-web";
import { useCallback, useEffect, useRef, useState } from "react";
import whiteBoat from "@/assets/lottie/addons-boat-white.json";
import darkBoat from "@/assets/lottie/addons-boat-dark.json";
import harborBoat from "@/assets/lottie/viora-loader.json";
import { prefetchTopAddonLogos, prefetchedTopAddonLogos } from "@/lib/providers/addon-logo-prefetch";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-20 w-20",
  md: "h-32 w-32",
  lg: "h-44 w-44",
  xl: "h-60 w-60",
};

const XLINK = "http://www.w3.org/1999/xlink";

function darkBackground(): boolean {
  if (typeof document === "undefined") return true;
  const probe = document.createElement("div");
  probe.style.cssText = "background-color:var(--color-canvas);position:absolute;opacity:0;pointer-events:none";
  document.body.appendChild(probe);
  const m = getComputedStyle(probe).backgroundColor.match(/[\d.]+/g);
  probe.remove();
  if (!m || m.length < 3) return true;
  const [r, g, b] = m.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

function useTopAddonLogos(enabled: boolean): string[] {
  const [logos, setLogos] = useState<string[]>(() => (enabled ? prefetchedTopAddonLogos() : []));
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    prefetchTopAddonLogos().then((urls) => {
      if (!cancelled) setLogos(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return logos;
}

export function VioraLoader({
  size = "md",
  caption,
  className = "",
  keyed = false,
  logos,
}: {
  size?: Size;
  caption?: string;
  className?: string;
  keyed?: boolean;
  logos?: string[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cargo = keyed || logos !== undefined;
  const fetched = useTopAddonLogos(keyed && logos === undefined);
  const effective = logos ?? fetched;
  const logosRef = useRef<string[]>([]);
  logosRef.current = effective;
  const cycleRef = useRef(0);
  const [dark] = useState(darkBackground);

  const paint = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const imgs = root.querySelectorAll<SVGImageElement>("image");
    const list = logosRef.current;
    const count = imgs.length;
    imgs.forEach((img, k) => {
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");
      img.setAttribute("referrerpolicy", "no-referrer");
      const flyPos = count - 1 - k;
      const url = flyPos < list.length ? list[(cycleRef.current + flyPos) % list.length] : "";
      if (url) {
        img.setAttributeNS(XLINK, "href", url);
        img.setAttribute("href", url);
        img.style.opacity = "1";
      } else {
        img.style.opacity = "0";
      }
    });
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const anim: AnimationItem = lottie.loadAnimation({
      container: ref.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: cargo ? (dark ? whiteBoat : darkBoat) : harborBoat,
    });
    const onLoaded = () => {
      cycleRef.current = 0;
      paint();
    };
    const onLoop = () => {
      cycleRef.current += 3;
      paint();
    };
    anim.addEventListener("DOMLoaded", onLoaded);
    anim.addEventListener("loopComplete", onLoop);
    return () => {
      anim.removeEventListener("DOMLoaded", onLoaded);
      anim.removeEventListener("loopComplete", onLoop);
      anim.destroy();
    };
  }, [dark, paint, cargo]);

  useEffect(() => {
    paint();
  }, [effective, paint]);

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      {/* The owner's mark, beating.
          What stood here was a sailboat: this fork began as a project called
          Harbor, and the boat was that project's logo. It was still sailing on the connecting screen
          and over the add-on catalogue, which is the last place another
          product's identity should be. The Lottie machinery above still runs
          for the add-on logo variant; this is the plain case, and it is now the
          same mark and the same pulse as the boot screen, so the app looks like
          one thing from the first frame to the last. */}
      <div ref={ref} className="hidden" aria-hidden />
      <img
        src="/viora-mark.png"
        alt=""
        aria-hidden
        draggable={false}
        className={`${SIZE_CLASS[size]} viora-beat object-contain`}
      />
      {caption && (
        <p className="mt-1 text-[12.5px] font-medium uppercase tracking-[0.18em] text-white/70">
          {caption}
        </p>
      )}
    </div>
  );
}
