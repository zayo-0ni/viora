import { FocusButton, FocusSection } from "@/lib/tv-focus";
import { Check, ChevronRight, Library, Link as LinkIcon, Sparkles, Star, TrendingUp } from "lucide-react";
import { isDpadPrimary } from "@/lib/platform";
import { TvAddAddon } from "./addons/tv-add-addon";
import { useEffect, useMemo, useRef, useState } from "react";
import { AgeGateModal } from "@/components/age-gate-modal";
import { VioraLoader } from "@/components/viora-loader";
import { useScrollMemory, useView } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useAddonsCatalog, type ResolvedAddon } from "@/lib/addons-store/store";
import { useCategories } from "@/lib/providers/stremio-addons";
import { prefetchTopAddonLogos } from "@/lib/providers/addon-logo-prefetch";
import { relatedAddons, recommendedAddons } from "@/lib/addons-store/recommend";
import { loadDisplayOrder } from "@/lib/addons-store/reorder";
import { fetchManifestAt, installAddon, installFromUrl, loadInstalled, uninstallAddon } from "@/lib/addon-store";
import { APP_NAME } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import streamsIcon from "@/assets/category/streams.svg";
import catalogsIcon from "@/assets/category/catalogs.svg";
import subtitlesIcon from "@/assets/category/subtitles.svg";
import sportsIcon from "@/assets/category/sports.svg";
import livetvIcon from "@/assets/category/livetv.svg";
import toolsIcon from "@/assets/category/tools.svg";
import adultIcon from "@/assets/category/adult.svg";
import { AddByUrlBar } from "./addons/add-by-url-bar";
import { AddonDetail } from "./addons/addon-detail";
import { AddonInstallModal } from "./addons/install-modal";
import { OrganizeAddonsPage } from "./addons/organize/page";
import { consumeAddonsTab, type Tab, type ToastInfo } from "./addons/addons-types";
import { InstalledPane } from "./addons/installed-pane";
import { SearchBar } from "./addons/search-bar";
import { Toaster } from "./addons/toaster";

export { requestAddonsTab } from "./addons/addons-types";

/**
 * Where the remote lands when this screen opens.
 *
 * Measured without it: arriving on Addons left the highlight in the sidebar, on
 * the Search item the viewer had walked past — the screen was on display and
 * nothing on it was selected. A screen with no declared entry point is entered
 * by whatever recovery finds first, which is an accident of mount order rather
 * than a decision.
 */
export const ADDONS_ADD = "ADDONS_ADD";

void streamsIcon;
void catalogsIcon;
void subtitlesIcon;
void sportsIcon;
void livetvIcon;
void toolsIcon;
void adultIcon;

type BrowseModeId = "top" | "new" | "rising";

const BROWSE_MODES: Array<{
  id: BrowseModeId;
  label: string;
  sub: string;
  Icon: typeof Star;
}> = [
  { id: "top", label: "Top rated", sub: "By community stars", Icon: Star },
  { id: "rising", label: "Top rising", sub: "Most starred in 24 hours", Icon: TrendingUp },
  { id: "new", label: "Just added", sub: "Freshest on stremio-addons.net", Icon: Sparkles },
];

void Library;

export function AddonsView() {
  const t = useT();
  const { settings, update } = useSettings();
  const { authKey } = useAuth();
  const { byId, installedIds, loading, refetch } = useAddonsCatalog(settings.showAdultAddons);
  const { addonDetailId, openAddonDetail, goBack } = useView();
  /*
    Discover does not exist on a TV.

    It is a browsing surface built for a pointer: a hero, a decorative mosaic
    behind the whole page, hover tooltips, and a community rail carrying every
    card in one flat run — measured at 247 stops under a single parent, which is
    where this screen's 448ms-per-press came from. Its one piece of real value,
    the curated picks, is what Browse already sorts by rating.
    Dropping it here removes the rail, the backdrop that was painting over two
    sidebar entries, and the tooltip nobody with a remote can see.
  */
  const TABS: Tab[] = isDpadPrimary() ? ["installed"] : ["discover", "browse", "installed"];
  const [tab, setTab] = useState<Tab>(() => {
    const requested = consumeAddonsTab();
    if (requested && TABS.includes(requested)) return requested;
    // What a viewer opens this screen for on a TV is what they already have.
    return isDpadPrimary() ? "installed" : "discover";
  });

  useEffect(() => {
    const requested = consumeAddonsTab();
    // Another screen can ask for a tab that this device does not have.
    if (requested && TABS.includes(requested)) setTab(requested);
    void prefetchTopAddonLogos();
    void import("@/lib/providers/stremio-addons-index").then((m) =>
      m.ensureCommunityIndex().catch(() => undefined),
    );
  }, []);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [browseMode, setBrowseMode] = useState<BrowseModeId>("top");
  const saCategories = useCategories();
  const [filtersOpen, setFiltersOpen] = useState(true);
  /** The TV's whole "get an addon" flow: account pairing, or a pasted link. */
  const [addOpen, setAddOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMemory("addons", scrollRef);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [tab, categoryFilter]);
  useEffect(() => {
    if (!settings.showAdultAddons && categoryFilter === "nsfw") setCategoryFilter(null);
  }, [settings.showAdultAddons, categoryFilter]);
  const [query, setQuery] = useState("");
  const [ageGateOpen, setAgeGateOpen] = useState(false);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [installModal, setInstallModal] = useState<
    | { kind: "install"; url: string }
    | { kind: "manage"; existing: { id: string; name: string; logo?: string | null; transportUrl: string } }
    | null
  >(null);
  const [reorderOpen, setReorderOpen] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void import("@/lib/deep-link").then(({ onDeepLinkInstall, consumePendingDeepLink, clearPendingDeepLink }) => {
      const pending = consumePendingDeepLink();
      if (pending && !window.__harborInstallerOpen) {
        setInstallModal({ kind: "install", url: pending });
      }
      unlisten = onDeepLinkInstall((rawUrl) => {
        if (window.__harborInstallerOpen) return;
        clearPendingDeepLink();
        setInstallModal({ kind: "install", url: rawUrl });
      });
    });
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const onChange = () => refetch();
    window.addEventListener("harbor:addons-changed", onChange);
    return () => window.removeEventListener("harbor:addons-changed", onChange);
  }, [refetch]);

  const showToast = (
    kind: "ok" | "error",
    text: string,
    addon?: { id: string; name: string; logo?: string | null },
  ) => {
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    setToast({ kind, text, addon });
    toastTimerRef.current = window.setTimeout(() => setToast(null), kind === "error" ? 5000 : 3000);
  };
  useEffect(() => () => {
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
  }, []);


  const allAddons = useMemo(() => [...byId.values()], [byId]);

  const installed = useMemo(() => {
    const seq = [...loadDisplayOrder(), ...loadInstalled().map((e) => e.transportUrl)];
    const rank = new Map<string, number>();
    seq.forEach((url, i) => {
      if (!rank.has(url)) rank.set(url, i);
    });
    return allAddons
      .filter((r) => r.installed)
      .sort(
        (a, b) =>
          (rank.get(a.transportUrl) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.transportUrl) ?? Number.MAX_SAFE_INTEGER),
      );
  }, [allAddons]);
  const trimmedQuery = query.trim();
  useEffect(() => {
    if (trimmedQuery.length > 0 && tab !== "installed") setTab("browse");
  }, [trimmedQuery, tab]);

  const onInstall = async (r: ResolvedAddon) => {
    try {
      let manifest = r.manifest ?? null;
      if (!manifest?.behaviorHints) {
        manifest = await fetchManifestAt(r.transportUrl).catch(() => manifest);
      }
      const hints = manifest?.behaviorHints;
      if (hints?.configurable === true || hints?.configurationRequired === true) {
        openAddonDetail(manifest?.id ?? r.manifest?.id ?? r.curated?.id ?? r.transportUrl);
        return;
      }
      const addon = await installAddon(manifest?.id ?? r.manifest?.id ?? r.curated?.id ?? "", r.transportUrl);
      window.dispatchEvent(
        new CustomEvent("harbor:addons-changed", {
          detail: { id: addon.manifest.id, installed: true },
        }),
      );
      refetch();
      showToast("ok", t("Installed"), {
        id: addon.manifest.id,
        name: addon.manifest.name,
        logo: addon.manifest.logo ?? r.manifest?.logo ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("Install failed.");
      console.warn("[addons] install failed", e);
      showToast("error", msg);
    }
  };
  const onInstallUrl = async (rawUrl: string): Promise<string | null> => {
    try {
      const result = await installFromUrl(rawUrl);
      window.dispatchEvent(
        new CustomEvent("harbor:addons-changed", {
          detail: { id: result.addon.manifest.id, installed: true },
        }),
      );
      refetch();
      showToast(
        "ok",
        result.replaced
          ? t("Updated")
          : result.syncedToStremio
            ? t("Installed")
            : t("Installed locally"),
        {
          id: result.addon.manifest.id,
          name: result.addon.manifest.name,
          logo: result.addon.manifest.logo ?? null,
        },
      );
      return result.addon.manifest.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("Install failed.");
      console.warn("[addons] installFromUrl failed", e);
      showToast("error", msg);
      return null;
    }
  };
  const onUninstall = async (r: ResolvedAddon) => {
    const id = r.manifest?.id ?? r.curated?.id;
    if (!id) return;
    try {
      // A built-in refuses removal. Announcing "Removed" and firing the change
      // event regardless would show it as gone until the next refresh put it
      // back, which reads as the app losing track of itself.
      if (!(await uninstallAddon(id, r.transportUrl))) {
        showToast("error", t("Built into {app} — turn it off instead", { app: APP_NAME }));
        return;
      }
      window.dispatchEvent(
        new CustomEvent("harbor:addons-changed", {
          detail: { id, installed: false },
        }),
      );
      refetch();
      showToast("ok", t("Removed"), {
        id,
        name: r.manifest?.name ?? id,
        logo: r.manifest?.logo ?? null,
      });
    } catch (e) {
      console.warn("[addons] uninstall failed", e);
      showToast("error", t("Couldn't remove. Try again."));
    }
  };

  if (addonDetailId) {
    const local = byId.get(addonDetailId);
    return (
      <RemoteOrLocalDetail
        addonDetailId={addonDetailId}
        local={local}
        installedIds={installedIds}
        allAddons={allAddons}
        onOpen={openAddonDetail}
        onInstall={onInstall}
        onUninstall={onUninstall}
        onInstallUrl={onInstallUrl}
        showToast={showToast}
        onCancel={goBack}
        toast={toast}
      />
    );
  }

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <AgeGateModal
        open={ageGateOpen}
        onClose={() => setAgeGateOpen(false)}
        onPass={() => update({ showAdultAddons: true })}
      />
      <header className="shrink-0 px-12 pt-20 pb-3">
        {isDpadPrimary() ? (
          /*
            The whole screen, on a television: what you have, and one way to get
            more. The catalogue, its search field, the category chips and the
            adult toggle are all pointer furniture — a thousand community addons
            is a list nobody walks with a D-pad — so none of them are built here.
          */
          <div className="flex items-center gap-4">
            <h1 className="font-display text-[30px] font-medium tracking-tight text-ink">
              {t("Addons")}
            </h1>
            <span className="rounded-full bg-edge px-2.5 py-1 text-[12.5px] font-bold tabular-nums text-ink-muted">
              {installedIds.size}
            </span>
            <FocusButton
              onClick={() => setAddOpen(true)}
              focusKey={ADDONS_ADD}
              data-focus-primary
              className="ms-auto flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <LinkIcon size={15} strokeWidth={2.4} />
              {t("Add addon")}
            </FocusButton>
          </div>
        ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* The tab row is its own place: three stops, not three of 252. */}
          <FocusSection as="nav" className="flex flex-wrap items-center gap-1">
            {TABS.map((tabId) => {
              const active = tab === tabId;
              if (tabId === "installed") {
                return (
                  <FocusButton
                    key={tabId}
                    onClick={() => setTab(tabId)}
                    className={`flex h-12 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors ${
                      active
                        ? "bg-ink text-canvas"
                        : "text-ink-muted hover:bg-elevated hover:text-ink"
                    }`}
                  >
                    <Check size={15} strokeWidth={2.6} className={active ? "" : "text-accent"} />
                    <span>{t("Installed")}</span>
                    <span
                      className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-[11.5px] font-bold tabular-nums ${
                        active ? "bg-canvas/15 text-canvas" : "bg-edge text-ink-muted"
                      }`}
                    >
                      {installedIds.size}
                    </span>
                  </FocusButton>
                );
              }
              const btn = (
                <FocusButton
                  onClick={() => {
                    setTab(tabId);
                    if (tabId === "browse") setCategoryFilter(null);
                  }}
                  className={`flex h-12 items-center rounded-full px-5 text-[14px] font-semibold transition-colors ${
                    active
                      ? "bg-ink text-canvas"
                      : "text-ink-muted hover:bg-elevated hover:text-ink"
                  }`}
                >
                  {tabId === "discover" ? t("Discover") : t("Browse")}
                </FocusButton>
              );
              if (tabId === "discover") {
                // The explanation is a hover tooltip, and a remote never hovers,
                // so on a TV it is dead markup in the focus path's way. Dropped
                // there rather than shown in a form nobody can reach.
                if (isDpadPrimary()) return <span key={tabId}>{btn}</span>;
                return (
                  <div key={tabId} className="group relative">
                    {btn}
                    <div className="pointer-events-none invisible absolute start-0 top-full z-50 mt-2 w-80 rounded-xl border border-edge-soft bg-elevated/95 px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted opacity-0 shadow-xl backdrop-blur-md transition duration-150 group-hover:visible group-hover:opacity-100">
                      {t("Curated for popularity and reliability. No paid placements. Install anything else by URL on the Browse tab.")}
                    </div>
                  </div>
                );
              }
              return <span key={tabId}>{btn}</span>;
            })}
          </FocusSection>
          {/* The tools beside the tabs: search, add-by-URL, and the toggles. */}
          <FocusSection className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 max-w-72 flex-1">
              <SearchBar value={query} onChange={setQuery} />
            </div>
            <div className="min-w-0 flex-[1.4]">
              <AddByUrlBar onSubmit={async (raw) => { setInstallModal({ kind: "install", url: raw }); }} compact />
            </div>
            <FocusButton
              onClick={() => {
                if (settings.showAdultAddons) {
                  update({ showAdultAddons: false });
                } else {
                  setAgeGateOpen(true);
                }
              }}
              title={settings.showAdultAddons ? t("Hide adult addons") : t("Show adult addons")}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                settings.showAdultAddons
                  ? "border-ink bg-ink/10 text-ink"
                  : "border-edge-soft text-ink-subtle hover:border-edge hover:text-ink-muted"
              }`}
            >
              <span
                className={`flex h-3 w-3 items-center justify-center rounded-sm border ${
                  settings.showAdultAddons ? "border-ink bg-ink" : "border-edge"
                }`}
              >
                {settings.showAdultAddons && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" className="text-canvas">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span>{t("Adult")}</span>
            </FocusButton>
            {tab === "browse" && (
              <FocusButton
                onClick={() => setFiltersOpen((v) => !v)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle transition-colors hover:border-edge hover:text-ink-muted"
              >
                <ChevronRight
                  size={13}
                  strokeWidth={2.4}
                  className={`transition-transform duration-300 ${filtersOpen ? "rotate-90" : "-rotate-90"}`}
                />
                {filtersOpen ? t("Hide") : t("Filters")}
              </FocusButton>
            )}
          </FocusSection>
        </div>
        )}
        {tab === "browse" && (
          <div
            className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${
              filtersOpen ? "mt-4 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              {/* Category and mode chips — one zone, and only while open: the
                  collapsed state gives them zero height, which already keeps
                  them out of the search. */}
              <FocusSection className="flex flex-wrap items-center gap-2 pb-1">
                <FocusButton
                  onClick={() => setCategoryFilter(null)}
                  className={`flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${
                    categoryFilter == null
                      ? "bg-ink text-canvas"
                      : "bg-elevated/40 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated/70 hover:text-ink"
                  }`}
                >
                  {t("All")}
                </FocusButton>
                {saCategories.filter((c) => settings.showAdultAddons || c.slug !== "nsfw").map((c) => {
                  const active = categoryFilter === c.slug;
                  return (
                    <FocusButton
                      key={c.slug}
                      onClick={() => setCategoryFilter(c.slug)}
                      className={`flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${
                        active
                          ? "bg-ink text-canvas"
                          : "bg-elevated/40 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated/70 hover:text-ink"
                      }`}
                    >
                      <span>{c.name}</span>
                    </FocusButton>
                  );
                })}
                <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-edge-soft" />
                {BROWSE_MODES.map((m) => {
                  const active = browseMode === m.id;
                  return (
                    <FocusButton
                      key={m.id}
                      type="button"
                      onClick={() => setBrowseMode(m.id)}
                      title={t(m.sub)}
                      className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                        active
                          ? "bg-ink text-canvas"
                          : "bg-elevated/40 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated/70 hover:text-ink"
                      }`}
                    >
                      <m.Icon size={13} strokeWidth={2.4} className={active ? "" : "text-accent"} />
                      {t(m.label)}
                    </FocusButton>
                  );
                })}
              </FocusSection>
            </div>
          </div>
        )}
      </header>

      {/*
        The page body is a region, and it says so.

        Declaring it does two things the plain div could not: it becomes the
        scroll container the focus engine reveals into, and it separates the
        content from the header — which is what gives `down` from a tab somewhere
        to go. Before this, the tabs and every card were siblings, so pressing
        down from a tab was a geometric guess among 252 candidates and usually
        moved nothing at all.
      */}
      <FocusSection
        scrolls
        ref={scrollRef as React.Ref<HTMLElement>}
        className="flex-1 overflow-y-auto px-12 pb-20 pt-6"
      >
        {loading && allAddons.length === 0 ? (
          <div className="flex h-full items-center justify-center py-24">
            <VioraLoader size="lg" caption={t("Loading the catalog")} keyed />
          </div>
        ) : (
          <InstalledPane
            installed={installed}
            search={trimmedQuery || null}
            onOpen={openAddonDetail}
            onUninstall={onUninstall}
            onManage={(r) => {
              const id = r.manifest?.id ?? r.curated?.id;
              if (!id) return;
              setInstallModal({
                kind: "manage",
                existing: {
                  id,
                  name: r.manifest?.name ?? id,
                  logo: r.manifest?.logo ?? null,
                  transportUrl: r.transportUrl,
                },
              });
            }}
          />
        )}
      </FocusSection>
      <Toaster toast={toast} />
      {addOpen && (
        <TvAddAddon
          onUrl={(url) => {
            setAddOpen(false);
            setInstallModal({ kind: "install", url });
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {installModal && (
        <AddonInstallModal
          mode={installModal}
          onClose={() => setInstallModal(null)}
          onInstall={async (rawUrl, opts) => {
            try {
              const result = await installFromUrl(rawUrl, opts);
              refetch();
              showToast(
                "ok",
                result.replaced ? t("Updated") : result.syncedToStremio ? t("Installed") : t("Installed locally"),
                {
                  id: result.addon.manifest.id,
                  name: result.addon.manifest.name,
                  logo: result.addon.manifest.logo ?? null,
                },
              );
              return { replaced: result.replaced, addon: result.addon };
            } catch (e) {
              const msg = e instanceof Error ? e.message : t("Install failed.");
              showToast("error", msg);
              return null;
            }
          }}
        />
      )}
      {reorderOpen && (
        <OrganizeAddonsPage
          authKey={authKey}
          onClose={() => setReorderOpen(false)}
          onSaved={(scope) => {
            setReorderOpen(false);
            window.dispatchEvent(
              new CustomEvent("harbor:addons-changed", { detail: { reordered: true } }),
            );
            showToast(
              "ok",
              scope === "cloud"
                ? t("Addon order synced to your Stremio account")
                : t("Addon order saved on this device"),
            );
          }}
        />
      )}
    </main>
  );
}

function RemoteOrLocalDetail({
  addonDetailId,
  local,
  installedIds,
  allAddons,
  onOpen,
  onInstall,
  onUninstall,
  onInstallUrl,
  showToast,
  onCancel,
  toast,
}: {
  addonDetailId: string;
  local: ResolvedAddon | undefined;
  installedIds: Set<string>;
  allAddons: ResolvedAddon[];
  onOpen: (id: string) => void;
  onInstall: (r: ResolvedAddon) => Promise<void>;
  onUninstall: (r: ResolvedAddon) => Promise<void>;
  onInstallUrl: (rawUrl: string) => Promise<string | null>;
  showToast: (kind: "ok" | "error", text: string) => void;
  onCancel: () => void;
  toast: ToastInfo | null;
}) {
  const [remote, setRemote] = useState<ResolvedAddon | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (local) return;
    let cancelled = false;
    setRemote(null);
    setFailed(false);
    (async () => {
      const { communityFor, ensureCommunityIndex } = await import(
        "@/lib/providers/stremio-addons-index"
      );
      await ensureCommunityIndex().catch(() => undefined);
      const community = communityFor(addonDetailId);
      if (!community) {
        if (!cancelled) setFailed(true);
        return;
      }
      const { getAddon } = await import("@/lib/providers/stremio-addons");
      try {
        const d = await getAddon(community.slug);
        if (cancelled) return;
        const synthetic: ResolvedAddon = {
          manifest: d.manifest as ResolvedAddon["manifest"],
          transportUrl: d.manifestUrl,
          source: "community",
          installed: installedIds.has(addonDetailId),
        };
        setRemote(synthetic);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addonDetailId, local, installedIds]);

  useEffect(() => {
    if (!local && failed) onCancel();
  }, [local, failed, onCancel]);

  const resolved = local ?? remote;
  const recs = useMemo(() => {
    if (!resolved) return { related: [] as ResolvedAddon[], recommended: [] as ResolvedAddon[] };
    const related = relatedAddons(resolved, allAddons, 8);
    const exclude = new Set(
      related.map((r) => r.manifest?.id ?? r.curated?.id ?? r.transportUrl),
    );
    exclude.add(addonDetailId);
    const recommended = recommendedAddons(resolved, allAddons, installedIds, exclude, 8);
    return { related, recommended };
  }, [resolved, allAddons, installedIds, addonDetailId]);
  if (!resolved) {
    return (
      <main className="flex h-full items-center justify-center bg-canvas">
        <VioraLoader />
      </main>
    );
  }
  return (
    <>
      <AddonDetail
        resolved={resolved}
        related={recs.related}
        recommended={recs.recommended}
        installedIds={installedIds}
        onOpen={onOpen}
        onInstall={() => onInstall(resolved)}
        onInstallAddon={onInstall}
        onUninstall={() => onUninstall(resolved)}
        onInstallUrl={onInstallUrl}
        showToast={showToast}
      />
      <Toaster toast={toast} />
    </>
  );
}
