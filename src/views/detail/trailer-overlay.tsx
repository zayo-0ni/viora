import { FocusButton } from "@/lib/tv-focus";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openUrl } from "@/lib/window";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { Tooltip } from "./tooltip";

export function TrailerOverlay({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) {
  const t = useT();
  const { setChromeHidden } = useView();
  const [open, setOpen] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    setChromeHidden(true);
    return () => setChromeHidden(false);
  }, [setChromeHidden]);


  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss]);

  return createPortal(
    <div
      onClick={dismiss}
      className="fixed inset-0 z-[120] flex cursor-zoom-out items-center justify-center"
      style={{
        backgroundColor: open ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0)",
        backdropFilter: open ? "blur(32px) saturate(1.2)" : "blur(0px)",
        WebkitBackdropFilter: open ? "blur(32px) saturate(1.2)" : "blur(0px)",
        transition:
          "background-color 360ms cubic-bezier(0.32,0.72,0.24,1), backdrop-filter 360ms cubic-bezier(0.32,0.72,0.24,1)",
      }}
    >
      <div
        className="absolute end-7 top-16 z-10 flex items-center gap-2.5"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.85)",
          transition:
            "opacity 320ms ease 60ms, transform 360ms cubic-bezier(0.32,0.72,0.24,1) 60ms",
        }}
      >
        <Tooltip label={t("Close · Esc")}>
          <FocusButton
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            aria-label={t("Close trailer")}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-canvas/90 text-ink shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-colors duration-200 before:absolute before:-inset-3 before:content-[''] hover:bg-canvas active:scale-[0.94]"
          >
            <X size={18} strokeWidth={2.4} />
          </FocusButton>
        </Tooltip>
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative aspect-video w-[min(1280px,86vw)] cursor-default overflow-hidden rounded-[22px] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.93)",
          transition:
            "opacity 320ms ease, transform 420ms cubic-bezier(0.32,0.72,0.24,1)",
        }}
      >
        {/* A direct video file used to play here, extracted by yt-dlp, with the
            embed as the fallback when extraction failed. Android cannot spawn
            the sidecar, so the embed is the only path. */}
        <YouTubeEmbed id={id} title={title} />
      </div>
      <span
        className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 select-none text-[11px] font-medium uppercase tracking-[0.18em] text-ink/45"
        style={{
          opacity: open ? 1 : 0,
          transition: "opacity 320ms ease 220ms",
        }}
      >
        {t("Esc or click outside to close")}
      </span>
    </div>,
    document.body,
  );
}

function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  const t = useT();
  const params = new URLSearchParams({
    autoplay: "1",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    playsinline: "1",
    fs: "1",
  });
  const proto = typeof window !== "undefined" ? (window.location?.protocol ?? "") : "";
  if (/^https?:$/.test(proto) && window.location?.origin) {
    params.set("origin", window.location.origin);
  }
  return (
    <>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`}
        title={`${title} trailer`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
      <FocusButton
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openUrl(`https://www.youtube.com/watch?v=${id}`);
        }}
        className="absolute bottom-4 end-4 z-10 flex items-center gap-1.5 rounded-full bg-canvas/90 px-3.5 py-2 text-[12.5px] font-semibold text-ink shadow-[0_8px_22px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-colors hover:bg-canvas"
      >
        {t("Watch on YouTube")}
      </FocusButton>
    </>
  );
}




