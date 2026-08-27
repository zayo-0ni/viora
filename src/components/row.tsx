import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FocusContext } from "@noriginmedia/norigin-spatial-navigation";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { isDpadPrimary } from "@/lib/platform";
import { ChevronRight } from "lucide-react";
import { FocusButton, FocusCell, ScrollProvider, revealWithin, useFocusRow } from "@/lib/tv-focus";

const GAP = 20;

// A card that has not mounted cannot be focused, so on a D-pad the render
// window has to stay ahead of the remote: pressing right must always find
// something already there. A mouse can afford a tighter window because it
// scrolls continuously and the observer keeps up; a keypress jumps a whole
// card at a time and would outrun it.
const EAGER_COUNT = isDpadPrimary() ? 14 : 6;
const NEAR_MARGIN = isDpadPrimary() ? "1600px" : "300px";

export type RowShape = "portrait" | "landscape" | "service" | "rank" | "tile";

const RowTrackContext = createContext<HTMLDivElement | null>(null);
export const ScrollRootContext = createContext<HTMLElement | null>(null);

// Whether the row this cell belongs to is close enough to the viewport to be
// worth building.
//
// Cells watch for their own arrival against the row's horizontal track, which
// tells them nothing about where the row itself is. A row twenty screens down
// the page still has a track, its first cells still sit inside it, and so every
// row on the screen built its opening cards immediately — measured on the
// television, from the top of the home page: six images on screen holding 11 MB
// of decoded pixels, and 713 images off it holding 708 MB. That is the whole of
// the slowness, and very likely the memory the video decoder could not find.
//
// A row is asked to hold off until it is near. Nothing already built is torn
// down, so a card the remote can reach is always still there.
const RowNearContext = createContext(true);

// Whether this cell is one of the few the viewer is actually looking at.
//
// A near row builds fourteen cards but a 1280-wide screen shows about six of
// them, and the rest queue for the same connection as the ones on screen. On
// the television that connection is the slow part: a first-time poster from
// MyAnimeList takes about 600 ms, and there are dozens of them. Saying which
// ones matter lets the engine fetch those first instead of treating all
// eighty-odd as equals.
/**
 * Whether a built card is close enough to be worth holding a picture for.
 *
 * Separate from the build gate above, and unlike it this one goes both ways.
 * Measured on the television after an ordinary session: 1,200 images in the
 * document, 405 megapixels of them decoded, and **twenty** of those images on
 * screen. 875 belonged to cards scrolled out of view in the screen being
 * looked at, 305 to screens behind it. The build gate is deliberately one-way —
 * a card the remote can reach is never taken away — so the artwork piled up
 * with every row the viewer passed.
 *
 * The card is not touched. It keeps its place, its focus, its title and its
 * size; only the picture inside it is released, and comes back when the card
 * comes near. That is what keeps this away from the navigation rules: nothing
 * about where focus can go changes.
 *
 * One observer for the whole application rather than one per card. A card
 * scrolled far along its row is outside the viewport just as surely as a row
 * scrolled off the bottom, and an observer rooted at the viewport already
 * accounts for the clipping its scrollers do — so both axes come free.
 */
export const CellArtNearContext = createContext(true);

// Released only when the screen it belongs to is not the one being looked at.
//
// This began as a distance — release a card once it is far enough away — and the
// owner rejected that, rightly. Measured on his television: the file is never
// re-downloaded, 126 of 129 responses came from the device's own disk cache and
// 1.4 KB in total touched the network, but decoding it again costs about 9ms a
// poster and a whole row returning at once is visible.
//
// So distance no longer decides anything. A card in the screen you are on keeps
// its picture however far along the row it has scrolled. What is released is
// every card in the screens stacked behind it — which is where the artwork was
// piling up anyway: of 405 megapixels held on the television, the screens the
// viewer could not see were carrying a large part, and they are not going to be
// looked at until they come back to the top.
//
// A hidden screen carries `display: none`, and an element inside one has no
// boxes at all — that is the test, and it cannot be confused with a card that is
// merely scrolled away, which keeps its box. The observer is only a trigger: it
// fires when a screen appears or disappears, and every watched card is then
// asked about its own geometry.
const artWatchers = new Map<Element, (near: boolean) => void>();
let artObserver: IntersectionObserver | null = null;
let artSweepTimer = 0;

const hasBox = (el: Element): boolean => (el as HTMLElement).getClientRects().length > 0;

function sweepArt(): void {
  for (const [el, onChange] of artWatchers) onChange(hasBox(el));
}

function watchArt(el: Element, onChange: (near: boolean) => void): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  if (!artObserver) {
    artObserver = new IntersectionObserver((entries) => {
      let maybeScreenSwitch = false;
      for (const e of entries) {
        const box = hasBox(e.target);
        artWatchers.get(e.target)?.(box);
        // A card losing its box means its screen went away, and the rest of that
        // screen went with it — including cards that were already off screen and
        // so will not report anything of their own.
        if (!box) maybeScreenSwitch = true;
      }
      if (maybeScreenSwitch) {
        window.clearTimeout(artSweepTimer);
        artSweepTimer = window.setTimeout(sweepArt, 120);
      }
    });
  }
  artWatchers.set(el, onChange);
  artObserver.observe(el);
  return () => {
    artWatchers.delete(el);
    artObserver?.unobserve(el);
  };
}

export const CellIsUpFrontContext = createContext(false);
const UP_FRONT_COUNT = 6;

// Which row the viewer is standing on, so its artwork is fetched ahead of
// everyone else's.
//
// Priority given to the opening cards of every near row is priority given to
// nothing: six rows each claiming to matter most is the same as none of them
// claiming it. What actually matters is the row the highlight is in — that is
// the artwork being looked at, and the rest of the page can wait its turn.
//
// Kept outside React because it changes on every press of Up or Down and only a
// couple of rows care. A row subscribes, compares, and re-renders only when it
// gains or loses the highlight.
let focusedRowToken: object | null = null;
const focusedRowSubs = new Set<() => void>();
// Insertion-ordered, so the first entry is the row nearest the top of whatever
// screen is showing. Rows remove themselves when they go.
const liveRows = new Set<object>();

function announceRows() {
  for (const fn of focusedRowSubs) fn();
}

function claimFocusedRow(token: object) {
  if (focusedRowToken === token) return;
  focusedRowToken = token;
  announceRows();
}

// Which row counts as the one being looked at.
//
// Normally the one holding the highlight. But at two moments nothing holds it:
// before the viewer has pressed anything, and just after a new screen opens
// while the old screen's row is still the last one remembered. In both, the top
// row of what is on screen is the honest answer — so a remembered row that is
// no longer mounted is treated as no answer at all.
function isPrimaryRow(token: object) {
  if (focusedRowToken !== null && liveRows.has(focusedRowToken)) {
    return focusedRowToken === token;
  }
  return liveRows.values().next().value === token;
}

// Roughly two screens of warning. A press of Down moves the highlight by about
// half a row, so a row is built long before the remote could arrive at it.
const ROW_NEAR_MARGIN = "1500px";

// The other half of this — handing a far away row's cards back, which is what
// the native app gets for free from recycling lists and an image cache with a
// ceiling — is deliberately not done here. A cell takes its focus identity from
// the library, which generates one on registration, so a card that is torn down
// and rebuilt comes back as a different thing and the row forgets which card
// the viewer was standing on. That is the navigation system's third rule, and
// it is not something to trade for memory without being asked.

// Cells double check their own position shortly after mounting, because the
// observer can miss one that was laid out late. Each used to arm a timer of its
// own, and a screen carries hundreds of cells — so a few hundred timers expired
// together, a moment after the screen opened, each measuring itself and the
// track separately. That is a stall placed exactly where the viewer is waiting
// for the screen to settle.
//
// One timer now walks all of them. The outcome is the same cells becoming
// visible; the difference is that the measurements happen back to back against
// a layout the engine computes once, and the state updates land in a single
// render instead of scattered across hundreds of tasks.
const RECHECK_DELAY_MS = 400;
const pendingRechecks = new Set<() => void>();
let recheckTimer: number | null = null;

function scheduleRecheck(run: () => void): () => void {
  pendingRechecks.add(run);
  if (recheckTimer == null) {
    recheckTimer = window.setTimeout(() => {
      recheckTimer = null;
      const due = [...pendingRechecks];
      pendingRechecks.clear();
      for (const fn of due) fn();
    }, RECHECK_DELAY_MS);
  }
  return () => {
    pendingRechecks.delete(run);
  };
}

function LazyChild({
  children,
  eager,
  shape,
  span,
}: {
  children: ReactNode;
  eager: boolean;
  shape: RowShape;
  span?: string;
}) {
  const root = useContext(RowTrackContext);
  const rowNear = useContext(RowNearContext);
  const [visible, setVisible] = useState(eager && rowNear);
  const [artNear, setArtNear] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  // Only built cells are watched: a skeleton has no picture to release.
  useEffect(() => {
    if (!visible) return;
    const el = ref.current;
    if (!el) return;
    return watchArt(el, setArtNear);
  }, [visible]);

  // The opening cards of a row are built as soon as the row itself is worth
  // building, not before. Nothing already built is taken back down.
  //
  // Before paint, not after: the row decides it is near during layout, and if
  // the promotion waited for an effect the viewer would catch a single frame of
  // skeletons on a row that was on screen the whole time.
  useLayoutEffect(() => {
    if (eager && rowNear && !visible) setVisible(true);
  }, [eager, rowNear, visible]);

  useEffect(() => {
    if (visible) return;
    if (!rowNear) return;
    if (!root) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible(true);
      },
      { root, rootMargin: NEAR_MARGIN },
    );
    io.observe(el);
    const cancelRecheck = scheduleRecheck(() => {
      const rect = el.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      const near = 300;
      const within =
        rect.right > rr.left - near &&
        rect.left < rr.right + near &&
        rect.bottom > rr.top - near &&
        rect.top < rr.bottom + near;
      if (within) setVisible(true);
    });
    return () => {
      io.disconnect();
      cancelRecheck();
    };
  }, [root, visible, rowNear]);

  const style = {
    ...(span ? { gridColumn: span } : undefined),
    contentVisibility: visible ? ("visible" as const) : ("auto" as const),
    containIntrinsicSize: visible ? undefined : "auto 200px",
  };

  // A skeleton is not a destination: registering one would let the remote stop
  // on a grey box, and worse, on a box whose card has not decided its size yet.
  // Cells appear in the tree only once their card is real.
  if (isDpadPrimary() && visible) {
    return (
      <FocusCell ref={ref} style={style}>
        <CellArtNearContext.Provider value={artNear}>{children}</CellArtNearContext.Provider>
      </FocusCell>
    );
  }

  return (
    <div ref={ref} style={style}>
      {visible ? (
        <CellArtNearContext.Provider value={artNear}>{children}</CellArtNearContext.Provider>
      ) : (
        <Skeleton shape={shape} />
      )}
    </div>
  );
}

function Skeleton({ shape }: { shape: RowShape }) {
  const { settings } = useSettings();
  if (shape === "service") {
    return <div className="h-20 w-full rounded-xl bg-elevated/40" />;
  }
  if (shape === "rank") {
    return <div className="aspect-[228/268] w-full rounded-xl bg-elevated/30" />;
  }
  if (shape === "tile") {
    return <div className="aspect-[5/4] w-full rounded-2xl bg-elevated/30" />;
  }
  const aspect = shape === "landscape" ? "aspect-[16/9]" : "aspect-[2/3]";
  const hideText = shape === "portrait" && settings.hidePosterTitles;
  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      <div className={`${aspect} rounded-xl bg-elevated/40`} />
      {!hideText && (
        <div className={`flex flex-col gap-1.5 ${shape === "landscape" ? "" : "h-9"}`}>
          <div className="h-3 w-3/5 rounded bg-elevated/35" />
          <div className="h-3 w-2/5 rounded bg-elevated/25" />
        </div>
      )}
    </div>
  );
}

export function Row({
  title,
  titleExtra,
  className = "",
  min = 144,
  shape = "portrait",
  scrollKey,
  children,
  onEndReached,
  onViewAll,
  viewAllLabel = "View all",
  headerRight,
  titleClassName = "text-ink",
  titleScale = 1,
}: {
  title?: React.ReactNode;
  titleExtra?: React.ReactNode;
  className?: string;
  min?: number;
  shape?: RowShape;
  alwaysActive?: boolean;
  scrollKey?: string;
  children: React.ReactNode;
  onEndReached?: () => void;
  onViewAll?: () => void;
  viewAllLabel?: string;
  headerRight?: React.ReactNode;
  titleClassName?: string;
  titleScale?: number;
}) {
  const { settings } = useSettings();
  const t = useT();
  const effMin = Math.max(72, Math.round(min * settings.posterScale));
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const trackCb = useCallback((el: HTMLDivElement | null) => {
    trackRef.current = el;
    setTrackEl(el);
  }, []);
  const [cellWidth, setCellWidth] = useState<number | null>(null);
  const onEndRef = useRef(onEndReached);
  useEffect(() => {
    onEndRef.current = onEndReached;
  });

  const measure = () => {
    const container = containerRef.current;
    if (!container) return;
    const available = container.clientWidth;
    if (available <= 0) return;
    const fits = Math.max(1, Math.floor((available + GAP) / (effMin + GAP)));
    setCellWidth((available - (fits - 1) * GAP) / fits);
  };

  // getComputedStyle forces the engine to resolve style before it can answer,
  // and this sits on the scrolling path: every frame of a row moving sideways
  // asked again for something that only changes when the interface language
  // does. Held per row, and dropped whenever the row is laid out afresh.
  const rtlRef = useRef<boolean | null>(null);
  const isRtlTrack = (el: HTMLDivElement) => {
    if (rtlRef.current == null) rtlRef.current = getComputedStyle(el).direction === "rtl";
    return rtlRef.current;
  };
  // Where this row was last seen standing, kept alongside the real thing.
  //
  // Reading scrollLeft makes the engine finish laying the page out before it
  // can answer, and the commit path below asks once per row on every render of
  // the screen. Measured on the television after the rest of this was fixed, it
  // was the largest single cost the row still had. A scroll cannot happen
  // without the handler seeing it, so the remembered value is enough to decide
  // whether there is anything to reset — and the engine is only asked when the
  // answer might actually be non-zero.
  const posRef = useRef(0);
  const readPos = (el: HTMLDivElement) => {
    const pos = isRtlTrack(el) ? -el.scrollLeft : el.scrollLeft;
    posRef.current = pos;
    return pos;
  };
  const writePos = (el: HTMLDivElement, pos: number) => {
    el.scrollLeft = isRtlTrack(el) ? -pos : pos;
    posRef.current = pos;
  };

  const measureScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const pos = readPos(el);
    const remaining = el.scrollWidth - el.clientWidth - pos;
    if (el.clientWidth > 0 && remaining < 800) onEndRef.current?.();
  };

  // The row joins the focus tree as a container, which is what gives it a
  // memory: come back to it later and focus lands on the card you left, not the
  // first one. `scrollKey` doubles as the focus key so that memory survives the
  // same navigations the scroll position already survives.
  const {
    ref: rowFocusRef,
    focusKey: rowFocusKey,
    scroll: revealCard,
  } = useFocusRow({ trackRef, focusKey: scrollKey ? `row:${scrollKey}` : undefined });

  // Landing on a card is two movements: the row slides sideways, and the page
  // comes down to the row. Every scrolling view already publishes its scroll
  // element here, so the vertical half costs nothing to reuse.
  const scrollRoot = useContext(ScrollRootContext);
  const revealCardOnScreen = useCallback(
    (node: HTMLElement) => {
      revealCard(node);
      if (scrollRoot) revealWithin(scrollRoot, node, "vertical");
    },
    [revealCard, scrollRoot],
  );

  const attachContainer = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      (rowFocusRef as { current: HTMLElement | null }).current = el;
    },
    [rowFocusRef],
  );

  // Is this row close enough to the viewport that its cards should exist?
  //
  // Measured before paint on mount, so a row already on screen never shows a
  // skeleton it did not need to, and then watched so that scrolling towards a
  // row builds it well ahead of arrival. Once near, it stays near: tearing a
  // built row back down could take the highlight with it.
  const [rowNear, setRowNear] = useState(false);
  const scrollRootEl = useContext(ScrollRootContext);

  // This row's claim on the highlight. Identity only — never read for anything
  // but comparison — so it survives every re-render.
  const rowToken = useRef({}).current;
  const [isPrimary, setIsPrimary] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    liveRows.add(rowToken);
    const sync = () => setIsPrimary(isPrimaryRow(rowToken));
    focusedRowSubs.add(sync);
    // A row arriving or leaving can change which row is the top one, so every
    // row is asked to look again.
    announceRows();
    // focusin bubbles, so one listener on the row covers every card in it, and
    // it fires on the press that moves the highlight rather than on a timer.
    const onFocusIn = () => claimFocusedRow(rowToken);
    el.addEventListener("focusin", onFocusIn);
    return () => {
      liveRows.delete(rowToken);
      focusedRowSubs.delete(sync);
      el.removeEventListener("focusin", onFocusIn);
      announceRows();
      // Nothing calls sync for this row again, so it is dropped from the set
      // before the others are told.
    };
  }, [rowToken]);
  useLayoutEffect(() => {
    if (rowNear) return;
    const el = containerRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const limit = (scrollRootEl ?? document.documentElement).clientHeight + 1500;
    if (box.top < limit && box.bottom > -1500) setRowNear(true);
  }, [rowNear, scrollRootEl]);

  useEffect(() => {
    if (rowNear) return;
    const el = containerRef.current;
    if (!el) return;
    const arriving = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setRowNear(true);
      },
      { root: scrollRootEl ?? null, rootMargin: ROW_NEAR_MARGIN },
    );
    arriving.observe(el);
    return () => arriving.disconnect();
  }, [rowNear, scrollRootEl]);

  const childCount = Children.count(children);
  const restoredRef = useRef(false);
  const userInteractedRef = useRef(false);
  const { rememberRowScroll, recallRowScroll } = useView();
  // The cell width follows the container's width and the poster scale. It does
  // not follow the contents, so re-deriving it whenever the row's children
  // change was work for an answer that could not have moved. Width changes
  // arrive through the ResizeObserver below; this covers the first measurement
  // and a change of scale.
  useLayoutEffect(() => {
    measure();
  }, [effMin]);

  // A row that mounts inside a subtree the engine has skipped measures zero and
  // declines to settle on a width. The observer catches it when it is finally
  // laid out, but a retry while the answer is still missing costs nothing and
  // avoids depending on that.
  useLayoutEffect(() => {
    if (cellWidth == null) measure();
  }, [childCount, cellWidth]);

  useLayoutEffect(() => {
    // Reading scroll extents here would force layout in the middle of the
    // commit, once per row, on every render of the screen. A frame later the
    // engine has laid out anyway and the same reads are free; arrows appearing
    // one frame after the cards is not something anyone can see.
    const raf = requestAnimationFrame(measureScroll);
    // Where the row is left standing is restored in the same breath as the
    // commit, deliberately: a frame's delay here would be a visible jump, and
    // returning to the place the viewer left is the whole point of it.
    restorePosition();
    return () => cancelAnimationFrame(raf);
  }, [children, childCount, cellWidth, trackEl, scrollKey, recallRowScroll, effMin]);

  function restorePosition() {
    if (!trackEl || cellWidth == null) return;
    if (scrollKey && !restoredRef.current && childCount > 0) {
      const n = recallRowScroll(scrollKey);
      const max = trackEl.scrollWidth - trackEl.clientWidth;
      const target = n != null && n > 0 && max > 0 ? Math.min(n, max) : 0;
      if (readPos(trackEl) !== target) writePos(trackEl, target);
      restoredRef.current = true;
      return;
    }
    // The remembered position first: if the row has never moved there is
    // nothing to put back, and the engine is spared a layout it would have been
    // asked for once per row, every render.
    if (!userInteractedRef.current && posRef.current !== 0 && readPos(trackEl) !== 0) {
      writePos(trackEl, 0);
    }
  }

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    let roRaf: number | null = null;
    const ro = new ResizeObserver(() => {
      if (roRaf != null) return;
      roRaf = requestAnimationFrame(() => {
        roRaf = null;
        // A row is re-laid-out when the interface direction flips, so this is
        // the moment the cached direction stops being trustworthy.
        rtlRef.current = null;
        measure();
        measureScroll();
      });
    });
    ro.observe(container);
    ro.observe(track);
    let saveTimer: number | null = null;
    let scrollRaf: number | null = null;
    const onScroll = () => {
      if (scrollRaf == null) {
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = null;
          measureScroll();
        });
      }
      if (!scrollKey) return;
      if (saveTimer != null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveTimer = null;
        rememberRowScroll(scrollKey, readPos(track));
      }, 200);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    const markInteracted = () => {
      userInteractedRef.current = true;
    };
    let wheelSettle: number | null = null;
    const onWheel = (e: WheelEvent) => {
      userInteractedRef.current = true;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (rafId.current != null && Math.abs(e.deltaX) < 4) return;
      cancelGlide();
      track.style.scrollSnapType = "none";
      track.style.scrollBehavior = "auto";
      if (wheelSettle != null) window.clearTimeout(wheelSettle);
      wheelSettle = window.setTimeout(() => {
        wheelSettle = null;
        const stride = strideRef.current;
        const max = track.scrollWidth - track.clientWidth;
        if (max <= 0 || stride <= 0) {
          track.style.scrollSnapType = "";
          track.style.scrollBehavior = "";
          return;
        }
        const pos = readPos(track);
        const aligned = Math.max(0, Math.min(Math.round(pos / stride) * stride, max));
        const target = max - pos < stride * 0.5 ? max : aligned;
        glideTo(track, target, true);
      }, 200);
    };
    track.addEventListener("wheel", onWheel, { passive: true });
    track.addEventListener("pointerdown", markInteracted);
    track.addEventListener("keydown", markInteracted);
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<{ prefix?: string }>).detail;
      if (!scrollKey) return;
      if (!detail?.prefix || !scrollKey.startsWith(detail.prefix)) return;
      if (saveTimer != null) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }
      writePos(track, 0);
      rememberRowScroll(scrollKey, 0);
      userInteractedRef.current = false;
      measureScroll();
    };
    window.addEventListener("harbor:reset-row-scrolls", onReset);
    return () => {
      ro.disconnect();
      if (roRaf != null) cancelAnimationFrame(roRaf);
      if (scrollRaf != null) cancelAnimationFrame(scrollRaf);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("wheel", onWheel);
      track.removeEventListener("pointerdown", markInteracted);
      track.removeEventListener("keydown", markInteracted);
      window.removeEventListener("harbor:reset-row-scrolls", onReset);
      if (saveTimer != null) window.clearTimeout(saveTimer);
      if (wheelSettle != null) window.clearTimeout(wheelSettle);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      if (scrollKey && readPos(track) > 0) {
        rememberRowScroll(scrollKey, readPos(track));
      }
    };
  }, [scrollKey, rememberRowScroll]);


  const drag = useRef({
    active: false,
    moved: false,
    startX: 0,
    startScroll: 0,
    pointerId: -1,
    lastX: 0,
    lastT: 0,
    vel: 0,
  });
  const rafId = useRef<number | null>(null);
  const strideRef = useRef(effMin + GAP);
  strideRef.current = (cellWidth ?? effMin) + GAP;

  const cancelGlide = () => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };

  const glideTo = (el: HTMLDivElement, target: number, snappy = false) => {
    const rtl = isRtlTrack(el);
    const start = rtl ? -el.scrollLeft : el.scrollLeft;
    const distance = target - start;
    if (Math.abs(distance) < 2) {
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
      return;
    }
    const startTime = performance.now();
    const duration = snappy
      ? Math.max(140, Math.min(300, Math.abs(distance) * 0.9))
      : Math.max(280, Math.min(620, 260 + Math.abs(distance) * 0.45));
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + distance * eased;
      el.scrollLeft = rtl ? -next : next;
      if (t < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        rafId.current = null;
        el.style.scrollSnapType = "";
        el.style.scrollBehavior = "";
      }
    };
    rafId.current = requestAnimationFrame(tick);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    if (!(e.target as Element).closest("button")) return;
    const el = trackRef.current;
    if (!el) return;
    cancelGlide();
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastT: performance.now(),
      vel: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      try {
        el.setPointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) {
      const instant = (e.clientX - d.lastX) / dt;
      d.vel = d.vel * 0.55 + instant * 0.45;
    }
    d.lastX = e.clientX;
    d.lastT = now;
    el.scrollLeft = d.startScroll - dx;
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    d.active = false;
    if (!d.moved || !el) {
      setTimeout(() => {
        drag.current.moved = false;
      }, 0);
      return;
    }
    try {
      if (e) el.releasePointerCapture(d.pointerId);
    } catch {
      /* ignore */
    }

    const friction = 0.004;
    const v = d.vel;
    const projection = -((v * Math.abs(v)) / (2 * friction));
    const projectedRaw = el.scrollLeft + projection;
    const projected = isRtlTrack(el) ? -projectedRaw : projectedRaw;
    const stride = (cellWidth ?? effMin) + GAP;
    const max = el.scrollWidth - el.clientWidth;
    const targetIdx = Math.round(projected / stride);
    const target = Math.max(0, Math.min(targetIdx * stride, max));
    glideTo(el, target);

    setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
   <FocusContext.Provider value={rowFocusKey}>
    <ScrollProvider scroll={revealCardOnScreen}>
    <div className={`flex min-w-0 flex-col gap-5 ps-[9px] ${className}`}>
      {(title || onViewAll || headerRight) && (
        <div className="flex items-baseline justify-between gap-4 pe-1">
          {title && (
            <div className="flex min-w-0 items-center gap-2">
              <h3
                className={`truncate font-medium tracking-tight ${titleClassName}`}
                style={{ fontSize: `${Math.round(17 * settings.rowTitleScale * titleScale)}px` }}
              >
                {title}
              </h3>
              {titleExtra}
            </div>
          )}
          {(onViewAll || headerRight) && (
            <div className="flex shrink-0 items-center gap-3">
              {headerRight}
              {onViewAll && !isDpadPrimary() && (
                // "View all" is a destination, unlike the edge chevrons below
                // it, which only do what a direction key already does.
                <FocusButton
                  type="button"
                  onClick={onViewAll}
                  className="group/va inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
                >
                  {t(viewAllLabel)}
                  <ChevronRight
                    size={14}
                    strokeWidth={2.2}
                    className="dir-icon transition-transform duration-200 group-hover/va:translate-x-0.5"
                  />
                </FocusButton>
              )}
            </div>
          )}
        </div>
      )}
      <div ref={attachContainer} className="group/row relative min-w-0">
        <RowNearContext.Provider value={rowNear}>
        <RowTrackContext.Provider value={trackEl}>
          <div
            ref={trackCb}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={onClickCapture}
            onDragStart={(e) => e.preventDefault()}
            className="viora-row-track grid grid-flow-col items-start gap-5 overflow-x-auto p-5 -m-5 scroll-ps-5 scroll-pe-5 [scroll-snap-type:x_mandatory] [&>*]:[scroll-snap-align:start] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [overflow-anchor:none] [overscroll-behavior-x:contain] [&_img]:select-none [&_img]:[-webkit-user-drag:none]"
            style={{
              gridAutoColumns: cellWidth != null ? `${cellWidth}px` : `${effMin}px`,
              willChange: "transform",
              transform: "translateZ(0)",
              contain: "layout style",
            }}
          >
            {Children.map(children, (child, i) => {
              const span = isValidElement(child)
                ? (child.props as { style?: { gridColumn?: string } }).style?.gridColumn
                : undefined;
              return (
                <CellIsUpFrontContext.Provider value={isPrimary && i < UP_FRONT_COUNT}>
                  <LazyChild eager={i < EAGER_COUNT} shape={shape} span={span}>
                    {child}
                  </LazyChild>
                </CellIsUpFrontContext.Provider>
              );
            })}
            {onViewAll && isDpadPrimary() && <ViewAllCard shape={shape} label={t(viewAllLabel)} onClick={onViewAll} />}
          </div>
        </RowTrackContext.Provider>
        </RowNearContext.Provider>
      </div>
    </div>
    </ScrollProvider>
   </FocusContext.Provider>
  );
}


/**
 * The way to the rest of a row, on a television.
 *
 * The same destination exists for a mouse as a small link beside the heading,
 * which a remote has no cheap way to reach — it sits above the row, off the path
 * the D-pad takes through the cards. As the last card it is exactly where the
 * viewer already is when they run out of them, and it costs one press.
 */
function ViewAllCard({
  shape,
  label,
  onClick,
}: {
  shape: RowShape;
  label: string;
  onClick: () => void;
}) {
  // Matching the row's own cards, so it reads as one more of them rather than as
  // a panel that wandered in.
  const aspect =
    shape === "landscape"
      ? "aspect-[16/9]"
      : shape === "tile"
        ? "aspect-[5/4]"
        : shape === "rank"
          ? "aspect-[228/268]"
          : "aspect-[2/3]";
  return (
    <FocusCell>
      <FocusButton
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex w-full flex-col gap-2 text-start"
      >
        <span
          className={`${aspect} flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-edge-soft bg-elevated/40 text-ink-muted transition-colors`}
        >
          <ChevronRight size={30} strokeWidth={2} className="dir-icon" />
          <span className="px-3 text-center text-[13px] font-semibold leading-snug">{label}</span>
        </span>
      </FocusButton>
    </FocusCell>
  );
}
