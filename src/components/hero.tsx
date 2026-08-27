import { memo, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { RtBadge } from "@/components/rt-badge";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { omdbPrefetch, useOmdbScores } from "@/lib/providers/omdb";
import { useImdbRating } from "@/lib/imdb-rating";
import { tmdbImdbId, tmdbLogo, tmdbMovieImages, useTmdbImdbId } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useLocalizedOverview } from "@/lib/use-localized-overview";
import { useView } from "@/lib/view";

export const Hero = memo(function Hero({
  meta,
  rank,
  active = true,
  loadBackdrop = true,
  full = false,
  fullQuality = false,
}: {
  meta: Meta;
  rank?: { label: string; position: number };
  active?: boolean;
  loadBackdrop?: boolean;
  full?: boolean;
  fullQuality?: boolean;
}) {
  const { settings } = useSettings();
  const { openMeta } = useView();
  const t = useT();
  const description = useLocalizedOverview(meta);
  const resolvedImdb = useTmdbImdbId(meta.id);
  const [bgUrl, setBgUrl] = useState<string | undefined>(meta.background);
  const [bgResolved, setBgResolved] = useState<boolean>(!!meta.background);
  const bg = bgUrl ? upsizeTmdb(bgUrl, fullQuality) : bgResolved ? meta.poster : undefined;
  const [logo, setLogo] = useState<string | undefined>(meta.logo);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoResolved, setLogoResolved] = useState<boolean>(!!meta.logo);
  const omdb = useOmdbScores(resolvedImdb ?? undefined);
  const imdbRating = useImdbRating(meta, resolvedImdb);


  useEffect(() => {
    setLogo(meta.logo);
    setLogoLoaded(false);
    setLogoResolved(!!meta.logo);
    setBgUrl(meta.background);
    setBgResolved(!!meta.background);
  }, [meta.id, meta.logo, meta.background]);

  useEffect(() => {
    if (logoResolved && bgResolved) return;
    let cancelled = false;
    const isTmdb = meta.id.startsWith("tmdb:");
    const resolve: Promise<{ logo?: string; background?: string }> = isTmdb
      ? Promise.all([
          tmdbLogo(settings.tmdbKey, meta.id, meta.originalLanguage),
          tmdbMovieImages(settings.tmdbKey, meta.id).then((urls) => urls[0]),
        ]).then(([logo, background]) => ({ logo, background }))
      : fetchMeta(narrowMediaType(meta.type), meta.id).then((full) => ({
          logo: full?.logo,
          background: full?.background,
        }));
    resolve
      .then(({ logo: l, background: b }) => {
        if (cancelled) return;
        if (!logoResolved) {
          setLogo(l);
          setLogoResolved(true);
        }
        if (!bgResolved) {
          if (b) setBgUrl(b);
          setBgResolved(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLogoResolved(true);
        setBgResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [logoResolved, bgResolved, meta.id, meta.type, settings.tmdbKey]);

  useEffect(() => {
    if (!active || !settings.omdbKey) return;
    let cancelled = false;
    tmdbImdbId(settings.tmdbKey, meta.id).then((id) => {
      if (cancelled || !id) return;
      omdbPrefetch(settings.omdbKey, id);
    });
    return () => {
      cancelled = true;
    };
  }, [active, meta.id, settings.tmdbKey, settings.omdbKey]);




  return (
    <section
      onClick={() => openMeta({ ...meta, logo: logo ?? meta.logo })}
      className={`group relative cursor-pointer overflow-hidden bg-canvas ${full ? "h-[clamp(420px,62vh,720px)] rounded-none" : "h-[420px] rounded-[28px]"}`}
      style={{ isolation: "isolate" }}
    >
      {bg && loadBackdrop && (
        <img
          src={bg}
          alt=""
          decoding="async"
          fetchPriority={active ? "high" : "low"}
          className={`absolute object-cover transition-opacity duration-500 ${full ? "inset-0 h-full w-full rounded-none" : "inset-[2px] h-[calc(100%-4px)] w-[calc(100%-4px)] rounded-[26px]"}`}
          style={{ opacity: 0.9 }}
        />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/85 via-50% to-transparent rtl:bg-gradient-to-l"
        style={{ opacity: settings.heroShadow / 100 }}
      />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-canvas via-canvas/70 via-50% to-transparent" />

      <div className={`relative flex h-full flex-col justify-center p-14 ${full ? "pt-28 lg:pt-32" : ""}`}>
        <div className="max-w-2xl">
          {rank && (
            <div className="mb-5 inline-flex items-center gap-1.5 self-start rounded-md bg-canvas/85 px-2.5 py-1 text-[12px] font-semibold text-ink">
              <TrendingUp size={12} className="text-accent" />
              <span>
                {t("#{position} in {label} Today", { position: rank.position, label: t(rank.label) })}
              </span>
            </div>
          )}
          <HeroTitlePlate name={meta.name} logo={logo} loaded={logoLoaded} resolved={logoResolved} onLoad={() => setLogoLoaded(true)} onError={() => { setLogo(undefined); setLogoResolved(true); }} />
          {description && (
            <p className="mt-6 line-clamp-3 max-w-xl text-[16px] leading-relaxed text-ink-muted">
              {description}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-[14px]">
            {meta.releaseInfo && <Stat label={t("Year")} value={meta.releaseInfo} />}
            {settings.showImdbBadge && imdbRating && (
              <span className="flex items-center gap-2">
                <ImdbIcon className="h-[18px] w-auto rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />
                <span className="font-semibold text-ink">{imdbRating}</span>
              </span>
            )}
            {settings.showRtBadge && omdb?.rtCritics != null && (
              <span className="flex items-center gap-2">
                <RtBadge score={omdb.rtCritics} className="h-[18px] w-auto" />
                <span className="font-semibold text-ink">{omdb.rtCritics}%</span>
              </span>
            )}
            {meta.runtime && <Stat label={t("Runtime")} value={meta.runtime} />}
          </div>
        </div>
      </div>
    </section>
  );
});

function HeroTitlePlate({
  name,
  logo,
  loaded,
  resolved,
  onLoad,
  onError,
}: {
  name: string;
  logo?: string;
  loaded: boolean;
  resolved: boolean;
  onLoad: () => void;
  onError: () => void;
}) {
  return (
    <div className="relative flex min-h-[112px] items-end">
      {logo ? (
        <img
          src={logo}
          alt={name}
          decoding="async"
          onLoad={onLoad}
          onError={onError}
          className="max-h-[120px] w-auto max-w-[460px] object-contain object-left rtl:object-right drop-shadow-[0_6px_22px_rgba(0,0,0,0.45)]"
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 360ms cubic-bezier(0.32, 0.72, 0.24, 1)",
          }}
        />
      ) : resolved ? (
        <h2
          className="font-display text-[68px] font-medium leading-[0.98] tracking-tight text-ink"
          style={{ animation: "viora-fade-in 420ms cubic-bezier(0.32, 0.72, 0.24, 1) both" }}
        >
          {name}
        </h2>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-ink-subtle">{label}: </span>
      <span className="text-ink">{value}</span>
    </span>
  );
}

function upsizeTmdb(url?: string, full = false): string | undefined {
  if (!url) return url;
  // Never `original`: that is up to 3840px, and four of them were measured on
  // one screen at 2880 wide to be drawn at 320. A hero that fills the screen
  // gets w1280, which is already close to the 1920 the set actually renders;
  // anything smaller than full bleed gets w780.
  const size = full ? "w1280" : "w780";
  return url.replace("/t/p/w780/", `/t/p/${size}/`);
}
