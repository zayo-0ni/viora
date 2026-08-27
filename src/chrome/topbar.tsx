import { FocusButton } from "@/lib/tv-focus";
import { ArrowLeft, Search, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BackChrome } from "@/chrome/back-chrome";
import { isDpadPrimary } from "@/lib/platform";
import { VioraMark } from "@/components/icons/viora-mark";
import { TogetherPopover } from "@/components/together-modal";
import { DownloadsButton } from "@/components/downloads-popover";
import {
  effectiveBinding,
  eventToBinding,
  formatBindingForDisplay,
  isTypingTarget,
} from "@/lib/hotkeys";
import { useT } from "@/lib/i18n";
import { useActiveKid } from "@/lib/profiles";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useTogether } from "@/lib/together/provider";
import { useSelfIdentity } from "@/lib/together/use-self-identity";
import { useView } from "@/lib/view";


export function Topbar({ connecting = false }: { connecting?: boolean } = {}) {
  const { chromeHidden, canGoBack, view, setView, topKind } = useView();
  const { settings } = useSettings();
  const kid = useActiveKid();
  const t = useT();
  const [closeConfirm, setCloseConfirm] = useState(false);
  if (chromeHidden && !connecting) return null;
  const onLiveRoot = topKind === "live";
  const sidebarHidden = connecting || view === "settings" || onLiveRoot || topKind === "picker";
  const hideSearch = view === "addons" || connecting || topKind === "picker";
  const sidebarOffset = settings.sidebarCollapsed
    ? "ps-[84px]"
    : "ps-[84px] lg:ps-[260px]";
  const searchWidth = canGoBack
    ? "w-[14rem] sm:w-[18rem] lg:w-[22rem] xl:w-[24rem]"
    : "w-[14rem] sm:w-[20rem] lg:w-[24rem] xl:w-[28rem] hover:w-[18rem] sm:hover:w-[24rem] lg:hover:w-[28rem] xl:hover:w-[34rem] focus-within:w-[18rem] sm:focus-within:w-[24rem] lg:focus-within:w-[28rem] xl:focus-within:w-[34rem]";
  return (
    <header className={`fixed inset-x-0 top-0 ${topKind === "picker" || connecting ? "z-[130]" : "z-[55]"} h-20`}>
      <div
        className="relative z-10 grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8"
      >
        <div
          className={
            sidebarHidden
              ? "flex h-full min-w-0 items-center justify-start gap-3"
              : `flex h-full min-w-0 items-center justify-start ${sidebarOffset}`
          }
        >
          {onLiveRoot && !isDpadPrimary() && (
            <FocusButton
              onClick={() => setView("home")}
              aria-label={t("common.back")}
              className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-edge-soft/60 bg-canvas/85 ps-3 pe-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <ArrowLeft size={15} strokeWidth={2.2} className="dir-icon" />
              {t("common.back")}
            </FocusButton>
          )}
          {onLiveRoot && (
            <div className="flex items-center gap-1.5 text-ink">
              <VioraMark className="h-7 w-7" />
              <span className="font-display text-[18px] font-semibold leading-none tracking-tight">
                {t("Live")}
              </span>
            </div>
          )}
          {!onLiveRoot && !connecting && <BackChrome />}
        </div>
        <div
          className={`min-w-0 max-w-full transition-[width] duration-200 ease-out ${searchWidth}`}
        >
          {/* On a remote the search entry lives in the sidebar. */}
          {!hideSearch && !kid && !isDpadPrimary() && <SearchPill />}
        </div>
        <div
          className="flex h-full min-w-0 items-center justify-end gap-2"
        >
          <DownloadsButton />
          {!onLiveRoot && !kid && <TogetherButton />}
        </div>
      </div>
      {closeConfirm && (
        <CloseConfirmKids onConfirm={close} onCancel={() => setCloseConfirm(false)} />
      )}
    </header>
  );
}

function CloseConfirmKids({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const t = useT();
  return createPortal(
    <div
      className="fixed inset-0 z-[290] flex items-center justify-center bg-black/60 px-8 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-gradient-to-b from-[#3aa6c4] via-[#1c789f] to-[#0c4a6e] p-8 text-center text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
        <img
          src="/kids/doodles/lilbluewhale.png"
          alt=""
          draggable={false}
          className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-auto opacity-85"
          style={{ transform: "scaleX(-1)" }}
        />
        <h2 className="relative font-display text-[32px] font-bold">{t("Close Viora?")}</h2>
        <p className="relative mt-2 text-[16px] font-medium text-white/85">
          {t("Ask a grown-up before you close.")}
        </p>
        <div className="relative mt-7 flex gap-4">
          <FocusButton
            onClick={onCancel}
            autoFocus
            className="h-16 flex-1 rounded-full bg-white text-[20px] font-extrabold text-[#0c4a6e] transition-transform hover:scale-105 active:scale-95"
          >
            {t("Stay")}
          </FocusButton>
          <FocusButton
            onClick={onConfirm}
            className="h-16 flex-1 rounded-full bg-[#e5484d] text-[20px] font-extrabold text-white transition-transform hover:scale-105 active:scale-95"
          >
            {t("Close")}
          </FocusButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const TOPBAR_MAX_AVATARS = 3;

type TogetherButtonProps = {
  variant?: "chip" | "ghost";
  popoverPlacement?: "below-right" | "above-left";
  connectStyle?: "tab" | "popover";
};

/**
 * Withdrawn from the TV chrome.
 *
 * Retired at the component rather than at its six mount sites: those live in six
 * different chrome layouts, deleting each would leave dangling imports behind,
 * and a seventh layout added later would quietly bring it back. Gating here
 * covers every surface at once and keeps the feature's code intact for whenever
 * it is wanted again. A wrapper is used because the implementation calls hooks —
 * returning early from inside it would make those calls conditional.
 */
export function TogetherButton(props: TogetherButtonProps = {}) {
  if (isDpadPrimary()) return null;
  return <TogetherButtonImpl {...props} />;
}

function TogetherButtonImpl({
  variant = "chip",
  popoverPlacement = "below-right",
  connectStyle = "popover",
}: TogetherButtonProps = {}) {
  const { snapshot, modalOpen, openModal, closeModal, clientId } = useTogether();
  const { avatar: selfAvatar, color: selfColor } = useSelfIdentity();
  const t = useT();
  const live = snapshot.state === "joined";
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modalOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closeModal();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [modalOpen, closeModal]);

  const visible = snapshot.participants.slice(0, TOPBAR_MAX_AVATARS);
  const overflow = Math.max(0, snapshot.participants.length - TOPBAR_MAX_AVATARS);

  const above = popoverPlacement === "above-left";
  const idleSize = live
    ? variant === "ghost"
      ? "h-9 gap-2 ps-3 pe-2"
      : "h-11 gap-2.5 ps-3 pe-2"
    : variant === "ghost"
      ? "h-9 w-9 justify-center"
      : "h-11 w-11 justify-center";
  const sizing =
    modalOpen && !above ? (live ? "h-14 gap-2 px-3" : "h-14 w-11 justify-center") : idleSize;
  const idleChrome = `border border-transparent ${variant === "ghost" ? "rounded-full" : "rounded-xl"} ${
    live
      ? variant === "ghost"
        ? "text-ink hover:bg-white/12"
        : "bg-elevated/70 text-ink hover:bg-elevated"
      : variant === "ghost"
        ? "text-ink-muted hover:bg-white/12 hover:text-ink"
        : "bg-elevated/70 text-ink-muted hover:bg-elevated hover:text-ink"
  }`;
  const chrome = modalOpen
    ? `z-[51] viora-together-surface border border-edge text-ink ${
        above ? "rounded-t-none rounded-b-lg border-t-0" : "rounded-b-none rounded-t-lg border-b-0"
      }`
    : idleChrome;

  return (
    <div ref={wrapRef} className={`relative ${modalOpen && !above ? "viora-wt-wrap flex flex-col self-stretch justify-end" : ""}`}>
      <FocusButton
        aria-label={t("chrome.watchTogether")}
        onClick={() => (modalOpen ? closeModal() : openModal())}
        className={`viora-together-btn relative flex items-center transition-colors duration-150 ${modalOpen && !above ? "viora-wt-tab" : ""} ${sizing} ${chrome}`}
      >
        {live ? (
          <>
            <span className="font-mono text-[11.5px] tracking-[0.22em] text-ink">
              {snapshot.room}
            </span>
            <div className="flex -space-x-1.5">
              {visible.map((p) => {
                const self = p.id === clientId;
                const fallbackColor = `oklch(0.78 0.13 ${nameHue(p.name)})`;
                const avatarSrc = self ? selfAvatar : p.avatar ?? null;
                const color = self ? selfColor ?? fallbackColor : p.color ?? fallbackColor;
                if (avatarSrc) {
                  return (
                    <span
                      key={p.id}
                      title={p.name}
                      className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full ring-2 ring-elevated"
                      style={{ boxShadow: `inset 0 0 0 1.5px ${color}` }}
                    >
                      <img
                        src={avatarSrc}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    </span>
                  );
                }
                return (
                  <span
                    key={p.id}
                    title={p.name}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-canvas ring-2 ring-elevated"
                    style={{ backgroundColor: color }}
                  >
                    {(p.name.trim()[0] || "?").toUpperCase()}
                  </span>
                );
              })}
              {overflow > 0 && (
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-canvas px-1 text-[10px] font-semibold text-ink-muted ring-2 ring-elevated">
                  +{overflow}
                </span>
              )}
            </div>
          </>
        ) : (
          <Users size={17} strokeWidth={1.9} />
        )}
      </FocusButton>
      {modalOpen && (
        <div
          className={`viora-wt-modal absolute z-50 ${
            above ? "bottom-[calc(100%-1px)] start-0" : "end-0 top-[calc(100%-1px)]"
          }`}
        >
          <TogetherPopover placement={popoverPlacement} connectStyle={connectStyle} />
        </div>
      )}
    </div>
  );
}

function nameHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function SearchPill() {
  const { setOpen } = useSearch();
  const { settings } = useSettings();
  const t = useT();
  const binding = effectiveBinding("globalSearchFocus", settings.hotkeys ?? {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (eventToBinding(e) !== binding) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [binding, setOpen]);

  return (
    <FocusButton
      type="button"
      data-tauri-drag-region="false"
      onClick={() => setOpen(true)}
      className="viora-search-pill flex h-11 w-full items-center gap-3 rounded-full border border-edge-soft/60 bg-elevated/80 px-5 text-start opacity-80 transition-[opacity,background-color] duration-200 hover:bg-elevated hover:opacity-100"
    >
      <Search size={16} strokeWidth={1.75} className="text-ink-subtle" />
      <span className="flex-1 truncate text-[14px] text-ink-subtle">{t("search.placeholder")}</span>
      <kbd className="hidden shrink-0 rounded-md border border-edge-soft bg-canvas/50 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-ink-subtle sm:inline">
        {formatBindingForDisplay(binding)}
      </kbd>
    </FocusButton>
  );
}
