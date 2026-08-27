import { useEffect, useMemo, useRef, useState } from "react";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { computeTvgIdCounts } from "@/lib/iptv/epg-resolver";
import type { EpgIndex, IptvChannel } from "@/lib/iptv/types";
import { flagUrl } from "@/lib/iptv/country-detect";
import { isHydratableChannel } from "@/lib/iptv/channel-hydration";
import { useChannelHydration } from "./hooks/use-channel-hydration";
import { clearCountries, toggleCountry, useCountryPrefs } from "@/lib/iptv/country-prefs";
import { useFavorites } from "@/lib/iptv/favorites";
import { CountryBar } from "./live-home/country-bar";
import { GuideCard } from "./live-home/guide-card";
import { NowCard } from "./live-home/now-card";
import { buildNowItem, hydrationKey, useLiveHome, type ChannelRail } from "./live-home/use-live-home";

export function LiveHome({
  channels,
  epg,
  nowMs,
  sourceId,
  region,
  favorites,
  onPlay,
  onOpenCategory,
}: {
  channels: IptvChannel[];
  epg: EpgIndex | null;
  nowMs: number;
  sourceId: string;
  region: string;
  favorites: ReturnType<typeof useFavorites>;
  onPlay: (ch: IptvChannel) => void;
  onOpenCategory: (group: string) => void;
}) {
  const t = useT();
  const { guide, rails, categoryRails, countries } = useLiveHome({
    channels,
    epg,
    nowMs,
    sourceId,
    region,
    favorites,
  });
  const countryPrefs = useCountryPrefs(sourceId);
  const tvgCounts = useMemo(() => computeTvgIdCounts(channels), [channels]);
  const railProps = { sourceId, epg, nowMs, tvgCounts, onPlay, onOpenCategory };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {guide.length > 0 && (
        <Row title={t("On now")} shape="landscape" min={300} scrollKey={`live-home:${sourceId}:guide`}>
          {guide.map((it) => (
            <GuideCard key={it.channel.id} item={it} onPlay={onPlay} />
          ))}
        </Row>
      )}
      {rails.map((rail) => (
        <RailRow key={rail.key} rail={rail} {...railProps} />
      ))}
      <CountryBar
        countries={countries}
        selected={countryPrefs.selected}
        onToggle={(code) => toggleCountry(sourceId, code)}
        onClear={() => clearCountries(sourceId)}
      />
      {categoryRails.map((rail) => (
        <LazyRail key={rail.key}>
          <RailRow rail={rail} {...railProps} />
        </LazyRail>
      ))}
    </div>
  );
}

function LazyRail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting) setShow(true);
      },
      { rootMargin: "700px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show]);
  return (
    <div ref={ref} style={show ? undefined : { minHeight: 250 }}>
      {show ? children : null}
    </div>
  );
}

function RailRow({
  rail,
  sourceId,
  epg,
  nowMs,
  tvgCounts,
  onPlay,
}: {
  rail: ChannelRail;
  sourceId: string;
  epg: EpgIndex | null;
  nowMs: number;
  tvgCounts: Map<string, number>;
  onPlay: (ch: IptvChannel) => void;
}) {
  const items = useMemo(
    () => rail.channels.map((ch) => buildNowItem(ch, epg, tvgCounts, nowMs)),
    [rail.channels, epg, tvgCounts, nowMs],
  );
  const hydrations = useChannelHydration(
    useMemo(() => {
      const set = new Set<string>();
      for (const it of items.slice(0, 14)) if (isHydratableChannel(it.channel)) set.add(hydrationKey(it));
      return [...set];
    }, [items]),
  );
  /*
    A heading, not a stop.

    The category name opened its own screen, which made it a control the remote
    had to walk through on the way down the page — a title that took the
    highlight and drew a frame around itself between one row of channels and the
    next. The channels are what the viewer came for, and every one of them is
    still one press away.
  */
  const title = (
    <span className="inline-flex items-center gap-2 text-ink">
      {rail.flagCode && <RailFlag code={rail.flagCode} />}
      <span dir="auto">{rail.title}</span>
    </span>
  );
  return (
    <Row title={title} shape="landscape" min={300} scrollKey={`live-home:${sourceId}:${rail.key}`}>
      {items.map((it) => (
        <NowCard
          key={it.channel.id}
          item={it}
          hydrated={hydrations.get(hydrationKey(it)) ?? null}
          onPlay={onPlay}
        />
      ))}
    </Row>
  );
}

function RailFlag({ code }: { code: string }) {
  const [err, setErr] = useState(false);
  const url = flagUrl(code);
  if (!url || err) return null;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      onError={() => setErr(true)}
      className="h-4 w-[26px] rounded-[3px] object-cover ring-1 ring-black/25"
    />
  );
}
