import { FocusButton } from "@/lib/tv-focus";
import { VioraWordmark } from "@/components/icons/viora-wordmark";
import { WEBSITE_URL, REPO_URL, SUPPORT_EMAIL } from "@/lib/brand";
import { Check, Download, Github, Loader2, Lock, RotateCw, Wrench } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import cornerSvg from "@/assets/corner.svg";
import { useAuth } from "@/lib/auth";
import { useOnboarding } from "@/lib/onboarding";
import {
  resetOmdbBudget,
  subscribeOmdbBudget,
  type OmdbBudget,
  omdbBudget as readOmdbBudget,
} from "@/lib/providers/omdb";
import { useSettings } from "@/lib/settings";
import { repairStremioLibrary, type RepairProgress, type RepairResult } from "@/lib/stremio-library-repair";
import { openUrl } from "@/lib/window";
import { IS_BETA_BUILD } from "@/lib/build-info";
import { BackupRow } from "./backup-row";
import { SettingsRecoverRow } from "./settings-recover-row";
import { PrivacyRow } from "./privacy-row";
import { Section } from "./shared";
import { Signature } from "./signature";
import { CustomCodeCard, DownloadsSection } from "./player-panel";
import { DesktopOnlyBlock } from "./player-panel/internals";
import { useT } from "@/lib/i18n";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const DOWNLOAD_URL = WEBSITE_URL ? `${WEBSITE_URL}/download` : null;
const SOURCE_URL = REPO_URL;

export function AdvancedPanel() {
  const t = useT();
  return (
    <>
      {!isTauri && <WebBuildBanner />}

      <Section
        title={t("Backup & restore")}
        subtitle={t("Export your entire Viora setup to a single file, then restore it on a new computer or keep it as a backup. Everything is included except your Stremio sign-in.")}
      >
        <SettingsRecoverRow />
        <BackupRow />
      </Section>

      <Section
        title={t("Downloads")}
        subtitle={t("Where Viora saves videos when you hit Download in the player. Pick any folder, including one on a different drive.")}
      >
        <DownloadsSection />
      </Section>

      <Section
        title={t("Privacy")}
        subtitle={t("Viora sends no telemetry. This also drops outbound ad, analytics, and tracker requests that addons or metadata providers try to make, before they leave your machine.")}
      >
        <PrivacyRow />
      </Section>

      <Section
        title={t("API budget")}
        subtitle={t("Daily call counter for OMDb rating lookups. Reset if it stops returning fresh scores.")}
      >
        <OmdbBudgetRow />
      </Section>

      <Section
        title={t("Onboarding")}
        subtitle={t("Replay the walkthrough or unhide every dismissed tip in the app.")}
      >
        <OnboardingRow />
      </Section>

      <Section
        title={t("Stremio library repair")}
        subtitle={t("Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema. Safe to run anytime; only items that need fixing get touched.")}
      >
        <DesktopOnlyBlock>
          <LibraryRepairRow />
        </DesktopOnlyBlock>
      </Section>

      <CustomCodeCard />

      <Section
        title={t("About")}
        subtitle={t("Build identity. Useful when filing a bug report.")}
      >
        <AboutRow />
      </Section>

      <LegalDisclaimer />

      <Signature />
    </>
  );
}

function LegalDisclaimer() {
  return (
    <section className="rounded-2xl border border-edge-soft bg-canvas/30 p-5">
      <span className="block text-[10.5px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
        Legal
      </span>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
        Viora is an independent, open-source desktop and web client. It is{" "}
        <span className="font-semibold text-ink">not affiliated with, endorsed by, sponsored by, or in any way associated with Stremio Ltd.</span>,{" "}
        the maker of <span className="font-semibold text-ink">Stremio</span>, or with any company,
        addon author, or trademark holder referenced inside the app.
        &quot;Stremio&quot;, &quot;Cinemeta&quot;, &quot;OpenSubtitles&quot;, &quot;Real-Debrid&quot;,
        &quot;Premiumize&quot;, &quot;AllDebrid&quot;, &quot;TorBox&quot;, &quot;DebridLink&quot;,
        &quot;TMDB&quot;, &quot;Trakt&quot;, &quot;IMDb&quot;, &quot;Netflix&quot;, &quot;Disney+&quot;,
        and all other names, logos, and brand references are property of their respective owners
        and are used here only for compatibility and identification.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
        Viora itself does not host, distribute, or index any media. All streams come from
        third-party addons, debrid services, or your own Stremio account that you configure
        yourself. You are responsible for what you choose to play and for complying with the
        laws of your jurisdiction.
      </p>
    </section>
  );
}

function WebBuildBanner() {
  const t = useT();
  return (
    <section className="relative overflow-hidden rounded-2xl border border-edge bg-elevated/60 p-7">
      <div className="group absolute -end-6 bottom-0 aspect-square h-[82%] cursor-default">
        <img
          src={cornerSvg}
          alt=""
          aria-hidden
          draggable={false}
          className="h-full w-full select-none transition-[filter] duration-[280ms] ease-out will-change-[filter] group-hover:blur-[7px] group-hover:brightness-[0.55]"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 scale-90 items-center justify-center rounded-full border border-white/20 bg-canvas/40 text-ink opacity-0 backdrop-blur-md transition-[opacity,transform] duration-[280ms] ease-out group-hover:scale-100 group-hover:opacity-100">
            <Lock size={22} strokeWidth={2.1} />
          </span>
        </div>
      </div>
      <div className="relative z-10 flex max-w-[54%] flex-col gap-3">
        <span className="w-fit rounded-full border border-edge-soft bg-canvas/60 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {t("Web build")}
        </span>
        <h2 className="text-[19px] font-medium tracking-tight text-ink">
          {t("Where your data lives")}
        </h2>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t("Everything you save here stays in this browser. Your Stremio login, API keys, watch progress, picker cache, dismissed tips. Viora servers never see any of it. Clearing your browser data wipes it.")}
        </p>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t("The web build can't run mpv, the trickplay generator, the local bandwidth probe, or your own Cloudflare relay. If you want HDR passthrough, TrueHD or DTS-HD audio, and smoother seeking, grab the desktop app.")}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {DOWNLOAD_URL && <FocusButton
            type="button"
            onClick={() => openUrl(DOWNLOAD_URL)}
            className="flex h-10 w-fit items-center gap-2 rounded-xl bg-ink px-4 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            <Download size={14} strokeWidth={2.4} />
            {t("Get Viora for desktop")}
          </FocusButton>}
          {SOURCE_URL && <FocusButton
            type="button"
            onClick={() => openUrl(SOURCE_URL)}
            className="flex h-10 w-fit items-center gap-2 rounded-xl border border-edge bg-elevated/60 px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink hover:bg-elevated"
          >
            <Github size={14} strokeWidth={2.2} />
            {t("Source code")}
          </FocusButton>}
        </div>
      </div>
    </section>
  );
}

function OmdbBudgetRow() {
  const tr = useT();
  const { settings } = useSettings();
  const [budget, setBudget] = useState<OmdbBudget>(() => readOmdbBudget());
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => subscribeOmdbBudget(setBudget), []);
  useEffect(() => {
    if (!confirmed) return;
    const t = setTimeout(() => setConfirmed(false), 1400);
    return () => clearTimeout(t);
  }, [confirmed]);

  if (!settings.omdbKey) {
    return (
      <ActionRow
        label={tr("OMDB daily budget")}
        sub={tr("Save an OMDB key in Library & metadata to enable rating fetches.")}
        disabled
      />
    );
  }

  const sub = budget.keyInvalid
    ? tr("Key rejected. Check it on Library & metadata.")
    : tr("{used} / {limit} requests today.", { used: budget.used, limit: budget.limit }) +
      (budget.exhausted ? " " + tr("Budget exhausted, resets at midnight UTC.") : "");

  return (
    <ActionRow
      label={tr("OMDB daily budget")}
      sub={sub}
      cta={confirmed ? tr("Reset") : tr("Reset counter")}
      icon={confirmed ? <Check size={14} strokeWidth={2.6} /> : <RotateCw size={14} />}
      tone={confirmed ? "success" : "neutral"}
      onClick={() => {
        resetOmdbBudget();
        setConfirmed(true);
      }}
    />
  );
}

function OnboardingRow() {
  const tr = useT();
  const { resetOnboarding, resetNudges } = useOnboarding();
  const [phase, setPhase] = useState<"idle" | "walkthrough" | "hints">("idle");
  useEffect(() => {
    if (phase === "idle") return;
    const t = setTimeout(() => setPhase("idle"), 1400);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="flex flex-col gap-2.5">
      <ActionRow
        label={tr("Replay walkthrough")}
        sub={tr("Re-runs the welcome flow and clears every dismissed tip.")}
        cta={phase === "walkthrough" ? tr("Done") : tr("Replay")}
        icon={phase === "walkthrough" ? <Check size={14} strokeWidth={2.6} /> : <RotateCw size={14} />}
        tone={phase === "walkthrough" ? "success" : "neutral"}
        onClick={() => {
          resetOnboarding();
          setPhase("walkthrough");
        }}
      />
      <ActionRow
        label={tr("Restore dismissed hints")}
        sub={tr("Brings back the small in-app tips you've dismissed without redoing the welcome flow.")}
        cta={phase === "hints" ? tr("Restored") : tr("Restore")}
        icon={phase === "hints" ? <Check size={14} strokeWidth={2.6} /> : <RotateCw size={14} />}
        tone={phase === "hints" ? "success" : "neutral"}
        onClick={() => {
          resetNudges();
          setPhase("hints");
        }}
      />
    </div>
  );
}

function AboutRow() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5 text-[13px] text-ink-muted">
      <div className="mb-1.5 border-b border-edge-soft pb-3">
        <VioraWordmark markClassName="h-8 w-8" />
      </div>
      <InfoLine label={t("Version")} value={`${__APP_VERSION__}${IS_BETA_BUILD ? " (Beta)" : ""}`} />
      <InfoLine label={t("Build")} value={isTauri ? t("Desktop (Tauri 2 / WebView2)") : t("Web")} />
      {SUPPORT_EMAIL && <InfoLine label={t("Bug reports")} value={SUPPORT_EMAIL} />}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </span>
      <span className="text-[13.5px] tabular-nums text-ink">{value}</span>
    </div>
  );
}

function ActionRow({
  label,
  sub,
  cta,
  icon,
  tone = "neutral",
  onClick,
  disabled,
}: {
  label: string;
  sub: string;
  cta?: string;
  icon?: ReactNode;
  tone?: "neutral" | "success";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">{label}</span>
        <span className="text-[12.5px] text-ink-subtle">{sub}</span>
      </div>
      {cta && (
        <FocusButton
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold transition-all ${
            tone === "success"
              ? "bg-accent/15 text-accent"
              : "border border-edge bg-elevated text-ink hover:border-ink hover:scale-[1.02] active:scale-[0.97]"
          } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100`}
        >
          {icon}
          {cta}
        </FocusButton>
      )}
    </div>
  );
}

function LibraryRepairRow() {
  const t = useT();
  const { authKey } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<RepairProgress | null>(null);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!authKey || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ phase: "fetching" });
    try {
      const r = await repairStremioLibrary(authKey, (p) => setProgress(p));
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!authKey) {
    return (
      <ActionRow
        label={t("Repair library")}
        sub={t("Sign in to Stremio first. The repair scans only the active profile's library.")}
      />
    );
  }

  const statusLine = (() => {
    if (error) return t("Failed: {error}", { error });
    if (result) {
      if (result.total === 0) return t("Library is empty. Nothing to repair.");
      return (
        t("{repaired} fixed, {clean} already clean", { repaired: result.repaired, clean: result.alreadyClean }) +
        (result.unrepairable > 0 ? t(", {n} unrepairable", { n: result.unrepairable }) : "") +
        "."
      );
    }
    if (!progress) return t("Rewrites every library item to match Stremio's exact schema. Run once if your Stremio app started crashing after Viora synced playback.");
    if (progress.phase === "fetching") {
      return progress.total ? t("Fetching {n} items…", { n: progress.total }) : t("Fetching library index…");
    }
    if (progress.phase === "normalizing") {
      return progress.needsRepair != null
        ? t("{n} items need repair.", { n: progress.needsRepair })
        : t("Checking {n} items…", { n: progress.total ?? 0 });
    }
    if (progress.phase === "pushing") {
      return t("Pushing {pushed} of {total}…", { pushed: progress.pushed ?? 0, total: progress.needsRepair ?? 0 });
    }
    return t("Done.");
  })();

  return (
    <ActionRow
      label={t("Repair library")}
      sub={statusLine}
      cta={busy ? t("Working…") : result ? t("Run again") : t("Repair now")}
      icon={busy ? <Loader2 size={13} strokeWidth={2.4} className="animate-spin" /> : <Wrench size={13} strokeWidth={2.4} />}
      onClick={run}
      disabled={busy}
      tone={result && result.repaired > 0 && !error ? "success" : undefined}
    />
  );
}


