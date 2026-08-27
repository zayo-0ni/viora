import { APP_NAME } from "@/lib/brand";
import { ChevronDown, Lock } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { VioraMark } from "@/components/icons/viora-mark";
import { ProfileChip } from "@/chrome/sidebar/profile-chip";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useParental, type LockableTab } from "@/lib/parental";
import { useActiveKid } from "@/lib/profiles";
import { useView, type View } from "@/lib/view";
import { KidsSidebarDoodles } from "./kids-sidebar-doodles";
import { CollapseToggle } from "@/chrome/sidebar/collapse-toggle";
import { NAV_ITEMS, applyNavCustomization, type NavItem, navFocusKey } from "@/chrome/nav-items";
import { Search as SearchIcon } from "lucide-react";
import { useSearch } from "@/lib/search-context";
import { isDpadPrimary } from "@/lib/platform";
import { FocusSection, focusKeys, useFocusableControl } from "@/lib/tv-focus";
import { focusInsideScope, focusWithin } from "@/lib/tv-focus/keys";

const PRIMARY_IDS = new Set(["home", "discover", "movies", "shows", "kids", "live", "vod"]);

export function Sidebar() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const kid = useActiveKid();
  const t = useT();
  const [pendingPinView, setPendingPinView] = useState<View | null>(null);

  const themePreset =
    settings.theme.preset !== "custom" ? getThemeById(settings.theme.preset) : null;
  const customMark = themePreset?.logo?.mark ?? null;
  const customWordmark = themePreset?.logo?.wordmark ?? null;
  const collapsed = settings.sidebarCollapsed;

  return (
    <>
      {/* The sidebar is one place to the D-pad: leaving it for the content and
          coming back returns to the item you left, not the top of the list. */}
      <FocusSection
        as="aside"
        focusKey={focusKeys.sidebar}
        // Declared here, on the region focus is actually sent to, and not only
        // on the scrolling list inside it.
        //
        // Every path that hands focus to the menu asks for SIDEBAR by name: the
        // first placement of a session, and the engine itself when a press walks
        // left out of the page and finds this region as the neighbour. Resolving
        // a region reads the entry it declares — and this one declared nothing,
        // so both paths fell through to "topmost, then leftmost" and landed on
        // Search. That is why the app opened on Search, and why leaving a row
        // for the menu put the highlight back at the top of the list instead of
        // on the screen the viewer is looking at.
        preferredChildFocusKey={navFocusKey(view)}
        // Hidden chrome is faded to zero opacity rather than unmounted, so
        // without this the remote can still walk into an invisible sidebar.
        inert={chromeHidden}
        aria-hidden={chromeHidden}
        data-viora-sidebar
        className={`relative z-[60] flex w-[72px] shrink-0 flex-col border-e border-edge-soft bg-canvas transition-[opacity,transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] ${
          collapsed ? "" : "lg:w-52"
        } ${
          chromeHidden
            ? "pointer-events-none -translate-x-2 rtl:translate-x-2 opacity-0"
            : "translate-x-0 opacity-100"
        }`}
      >
        {kid && <KidsSidebarDoodles />}
        <div
          data-tauri-drag-region
          className={`flex h-20 shrink-0 items-center justify-center gap-0.5 px-3 text-ink ${
            collapsed ? "" : "lg:justify-start lg:px-7"
          }`}
        >
          {customMark ? (
            <img
              src={customMark}
              alt=""
              draggable={false}
              className={`h-9 w-9 shrink-0 object-contain ${collapsed ? "" : "lg:h-10 lg:w-10"}`}
            />
          ) : (
            /* Collapsed only: expanded, the lockup beside this already has the
               mark in it, and two of them would be one too many. */
            <VioraMark className={`h-9 w-9 shrink-0 ${collapsed ? "" : "lg:hidden"}`} />
          )}
          {!collapsed &&
            (customWordmark ? (
              <img
                src={customWordmark}
                alt=""
                draggable={false}
                className="hidden h-8 w-auto object-contain lg:inline-block"
              />
            ) : kid ? (
              <span
                className="hidden whitespace-nowrap text-[42px] font-bold leading-none tracking-tight lg:inline-flex lg:items-center"
                style={{
                  fontFamily: '"Fredoka", "Baloo 2", system-ui, sans-serif',
                  transform: "translateY(1px)",
                }}
              >
                Vi
                <img
                  src="/kids/wheel.png"
                  alt="o"
                  draggable={false}
                  className="inline-block h-[0.92em] w-auto"
                  style={{ transform: "translateY(0.08em)", marginLeft: "-5px", marginRight: "-5px" }}
                />
                ra
              </span>
            ) : (
              /* The name and the signature as they were drawn, not retypeset.
                 This was the app name in Fraunces with a script signature under
                 it — the right words in the wrong hand. The letterforms, the
                 spacing and the dot inside the O all belong to the original
                 artwork, and none of them survive being set in an interface
                 font. The mark to the left is hidden here because this image
                 already carries it. */
              <img
                src="/viora-lockup.png"
                alt={APP_NAME}
                draggable={false}
                className="hidden h-[52px] w-auto object-contain lg:inline-block"
              />
            ))}
        </div>
        <ScrollableNav
          view={view}
          setView={setView}
          locked={locked}
          collapsed={collapsed}
          hiddenTabs={hiddenTabs}
          onPinNav={(v) => setPendingPinView(v)}
        />
        <div className={`relative p-2 ${collapsed ? "" : "lg:p-4"}`}>
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-edge-soft/55 to-transparent ${
              collapsed ? "" : "lg:inset-x-4"
            }`}
          />
          <div className={`flex pb-1 ${collapsed ? "justify-center" : ""}`}>
            <CollapseToggle collapsed={collapsed} />
          </div>
          {locked ? (
            <div
              className={`flex w-full items-center justify-center gap-3 rounded-xl py-2.5 ${
                collapsed ? "" : "lg:justify-start lg:px-3"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-edge-soft bg-elevated/50 text-ink-subtle">
                <Lock size={17} />
              </div>
              {!collapsed && (
                <div className="hidden min-w-0 flex-1 lg:block">
                  <div className="truncate text-[13.5px] font-medium text-ink-muted">{t("chrome.locked")}</div>
                  <div className="truncate text-[12px] text-ink-subtle">{t("chrome.parentalOn")}</div>
                </div>
              )}
            </div>
          ) : (
            <ProfileChip collapsed={collapsed} />
          )}
        </div>
      </FocusSection>
      {pendingPinView && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const v = pendingPinView;
              setPendingPinView(null);
              if (v) setView(v);
            },
            onCancel: () => setPendingPinView(null),
          }}
          verify={unlock}
        />
      )}
    </>
  );
}

function ScrollableNav({
  view,
  setView,
  locked,
  collapsed,
  hiddenTabs,
  onPinNav,
}: {
  view: View;
  setView: (v: View) => void;
  locked: boolean;
  collapsed: boolean;
  hiddenTabs: Record<LockableTab, boolean>;
  onPinNav: (v: View) => void;
}) {
  const { settings } = useSettings();
  const kid = useActiveKid();
  const t = useT();
  const search = useSearch();
  const dpad = isDpadPrimary();
  const items = applyNavCustomization(NAV_ITEMS, settings.navCustomization);
  const isItemVisible = (item: NavItem) => {
    if (kid) return item.view === "kids";
    if (item.view === "kids") return false;
    if (item.view === "vod" && !settings.showPlaylistsTab) return false;
    if (item.hideKey && settings.hideContent[item.hideKey]) return false;
    if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
    return true;
  };
  const visible = items.filter(isItemVisible);
  const primary = visible.filter((item) => PRIMARY_IDS.has(item.id));
  const collections = visible.filter((item) => !PRIMARY_IDS.has(item.id));
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<{ top: boolean; bottom: boolean }>({
    top: false,
    bottom: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop > 4;
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
      setOverflow((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollDown = () => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ top: 112, behavior: "smooth" });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* `scrolls` lets a focused item below the fold pull the column up on its
          own; the chevron below stays a mouse affordance and is never focused. */}
      <FocusSection
        scrolls
        ref={ref}
        preferredChildFocusKey={navFocusKey(view)}
        className="flex flex-1 flex-col overflow-y-auto px-4 pt-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex flex-col gap-1.5">
          {/* Search belongs with navigation, not floating in the topbar.
              As a topbar control it was a sibling of the screen layer inside the
              content region, and the layer's box encloses it — so no direction
              led from it back into the screen and focus could strand there.
              Here it is one more stop in a vertical list that already works. */}
          {dpad && (
            <NavItem
              render={(active) => (
                <SearchIcon size={20} strokeWidth={active ? 2.5 : 2} />
              )}
              label={t("Search")}
              collapsed={collapsed}
              big={!!kid}
              onClick={() => search.setOpen(true)}
            />
          )}
          {primary.map((item) => (
            <NavItem
              key={item.id}
              {...item}
              collapsed={collapsed}
              big={!!kid}
              active={view === item.view}
              onClick={() => setView(item.view)}
            />
          ))}
        </div>
        <div data-tauri-drag-region className="py-2.5">
          <div className="mx-3 h-px bg-gradient-to-r from-transparent via-edge-soft/55 to-transparent" />
        </div>
        <div className="flex flex-col gap-1.5">
          {collections.map((item) => {
            const gated = !!item.pinGated && locked;
            return (
              <NavItem
                key={item.id}
                {...item}
                gated={gated}
                collapsed={collapsed}
                active={view === item.view}
                onClick={() => (gated ? onPinNav(item.view) : setView(item.view))}
              />
            );
          })}
        </div>
        <div data-tauri-drag-region className="flex-1 min-h-2" />
      </FocusSection>
      {overflow.top && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-canvas to-transparent" />
      )}
      {overflow.bottom && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-canvas via-canvas/85 to-transparent" />
          <button
            type="button"
            onClick={scrollDown}
            aria-label={t("chrome.scrollForMore")}
            className="absolute bottom-1 left-1/2 flex h-4 w-7 -translate-x-1/2 items-center justify-center text-ink-subtle/55 transition-colors hover:text-ink-muted"
          >
            <ChevronDown size={11} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Puts focus back where the viewer left the page, or on its first control.
 *
 * Asking for the CONTENT region by name is the right question and it is asked
 * first: every region saves the child it last held, and resolving a region reads
 * that memory before anything else. So leaving a row four screens down for the
 * menu and pressing back into the page returns to that row — which is what every
 * television interface does, and what makes the menu feel like somewhere you
 * step aside to rather than somewhere that costs you your place.
 *
 * It has not always worked. Measured earlier, the same call resolved to nothing
 * usable and this function reached straight for the first control instead: every
 * card in a row was being judged "covered" because coverage was decided by a
 * single hit-test at the card's centre, which is where the play button sits. The
 * memory was intact all along; nothing it named could pass. With that test fixed
 * the region answers, and the walk below is the fallback it was meant to be —
 * for a screen focus has never visited.
 */
function enterContent(): boolean {
  if (tryEnterContent()) return true;

  // The screen is still loading, so hold the press rather than drop it.
  //
  // Opening a screen and pressing right immediately is the normal thing to do,
  // and screens that fetch before they can render anything — Shows waits on its
  // hero — have nothing focusable for a second or two. Neither answer available
  // in that instant is good: handing the press to the engine throws focus to the
  // first control in the app, and swallowing it means the viewer presses a
  // direction and the television does nothing at all.
  //
  // So the intent is remembered for a moment and carried out the instant the
  // screen can take it. It gives up on its own, and it gives up immediately if
  // the viewer has moved on — nothing is more startling than focus jumping into
  // a page a second after you decided to stay in the menu.
  cancelPendingEntry();
  let tries = 0;
  const stop = () => cancelPendingEntry();
  window.addEventListener("keydown", stop, { capture: true, once: true });
  pendingEntry = {
    timer: window.setInterval(() => {
      const stillInMenu = !!document.activeElement?.closest("aside");
      if (!stillInMenu || ++tries > 40 || tryEnterContent()) cancelPendingEntry();
    }, 120),
    stop,
  };
  return false;
}

let pendingEntry: { timer: number; stop: () => void } | null = null;

function cancelPendingEntry(): void {
  if (!pendingEntry) return;
  window.clearInterval(pendingEntry.timer);
  window.removeEventListener("keydown", pendingEntry.stop, { capture: true });
  pendingEntry = null;
}

function tryEnterContent(): boolean {
  if (focusWithin(focusKeys.content)) return true;
  const panes = [...document.querySelectorAll<HTMLElement>("main")].filter((m) => {
    const r = m.getBoundingClientRect();
    return r.width > window.innerWidth * 0.4 && r.height > 100;
  });
  const pane = panes[panes.length - 1];
  return !!pane && focusInsideScope(pane);
}

/**
 * Which way the page lies from the menu.
 *
 * Read from the layout rather than assumed, because the interface mirrors: in a
 * right-to-left language the column sits on the other side and the press that
 * enters the page is the opposite one.
 */
function towardContent(): "left" | "right" {
  const aside = document.querySelector("aside");
  if (!aside) return "right";
  const box = aside.getBoundingClientRect();
  return box.left + box.width / 2 < window.innerWidth / 2 ? "right" : "left";
}

function NavItem({
  render,
  label,
  active,
  onClick,
  gated,
  collapsed,
  big,
  view,
}: {
  render: (active: boolean) => ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  gated?: boolean;
  collapsed?: boolean;
  big?: boolean;
  view?: View;
}) {
  const t = useT();
  const text = t(label);
  const [hovered, setHovered] = useState(false);
  // Opting in here is what makes this reachable by the remote. The chevron and
  // the section divider above never call this, so they simply do not exist as
  // far as the D-pad is concerned.
  const { ref, focusProps } = useFocusableControl({
    onSelect: onClick,
    // Named after the screen it opens, so coming back from the content lands
    // on the entry the viewer is actually inside rather than the top of the
    // list. Entries with no view of their own keep a generated key.
    focusKey: view ? navFocusKey(view) : undefined,
    /*
      The sidebar hands focus to the page itself.

      A screen's box starts at the origin and encloses this column rather than
      sitting beside it, so the engine sees no facing edge to move to: from an
      entry here the page is not "that way", it is all around, and the press
      lands nowhere. That is why switching screens used to yank the highlight
      into the content — it was the only way in, and it cost the viewer their
      place in the menu on every trip.

      Saying it outright costs nothing and keeps both: the menu holds its
      position, and one press still walks into the page.
    */
    onArrowPress: (direction) => {
      if (direction !== towardContent()) return true;
      // Consumed whether or not the page took it.
      //
      // Handing a failed entry back to the engine looks generous and is not: the
      // engine finds the content region, cannot resolve anything inside a screen
      // that is still loading either, and settles on the topmost control in the
      // app — the search button at the top of this very menu. Measured on Shows,
      // which fetches its hero before it can render anything: every press right
      // threw the highlight from the entry the viewer had just chosen up to
      // Search.
      //
      // This press means "go into the page". If the page is not ready yet, the
      // honest answer is to stay put and let them press again.
      enterContent();
      return false;
    },
  });
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...focusProps}
      data-viora-nav={view}
      data-active={active ? "" : undefined}
      aria-label={gated ? t("chrome.lockedRequiresPin", { label: text }) : text}
      title={gated ? t("chrome.lockedShort", { label: text }) : text}
      className={`relative flex items-center justify-center gap-4 transition-colors duration-150 ${
        big ? "h-[68px] rounded-2xl text-[20px] font-bold" : "h-14 rounded-xl text-[16px]"
      } ${collapsed ? "" : big ? "lg:justify-start lg:px-5" : "lg:justify-start lg:px-4"} ${
        collapsed
          ? active
            ? "text-accent"
            : "text-ink-muted hover:text-ink"
          : active
            ? "bg-elevated text-ink"
            : "text-ink-muted hover:bg-elevated/50 hover:text-ink"
      }`}
    >
      <span className={`relative ${big ? "scale-110" : ""} ${gated ? "opacity-70" : ""}`}>
        {render(hovered)}
        {gated && (
          <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-ink-subtle ring-1 ring-edge">
            <Lock size={9} strokeWidth={2.4} />
          </span>
        )}
      </span>
      {!collapsed && <span className="hidden lg:inline">{text}</span>}
    </button>
  );
}

