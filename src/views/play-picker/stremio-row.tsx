import { FocusButton } from "@/lib/tv-focus";
import { ArrowDownToLine, Play } from "lucide-react";
import { AddonLogo } from "@/components/addon-logo";
import { FormatBadge, streamBadges } from "@/components/format-badge";
import { HostMatchChip } from "@/components/host-match-chip";
import { useSettings } from "@/lib/settings";
import type { ScoredStream } from "@/lib/streams/types";
import { EditionChip } from "./edition-chip";

export function StremioRow({
  stream,
  failed,
  addonLogo,
  match = null,
  onPlay,
  download = false,
}: {
  stream: ScoredStream;
  failed: boolean;
  addonLogo: string | null;
  match?: "same" | "close" | null;
  onPlay: () => void;
  download?: boolean;
}) {
  const { settings } = useSettings();
  const full = settings.fullStreamDescription;
  const addonName = stream.addonName ?? "Source";
  const headline = stream.name?.trim() || addonName;
  const rawDescription = stream.title?.trim() || stream.description?.trim() || "";
  const description = full ? rawDescription : condenseDescription(rawDescription);
  const badges = settings.showQualityBadge ? streamBadges(stream) : [];
  return (
    // The row is the target, so the frame goes round all of it.
    //
    // It was a plain div holding two focusable buttons — a 36px copy button and
    // then the play circle at the far edge — so the highlight only ever sat on
    // a small control in the corner and the card itself never showed a frame.
    // The owner drew a box round a whole row to say where it belongs.
    //
    // One stop now, and pressing it plays. The copy button goes with it: on a
    // remote it was a stop on the way to play and nothing else.
    <FocusButton
      onClick={onPlay}
      aria-label={download ? `Download ${headline}` : `Play ${headline}`}
      className={`flex w-full items-stretch gap-5 rounded-2xl bg-elevated/40 p-5 text-start ring-1 transition-colors ${
        failed ? "ring-danger/40 bg-danger/5" : "ring-edge-soft/50"
      }`}
    >
      <div className="flex w-[68px] shrink-0 flex-col items-center justify-center">
        <AddonLogo
          addonId={stream.addonId}
          addonName={addonName}
          manifestLogo={addonLogo}
          size="tile"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <p className="whitespace-pre-line text-[16px] font-semibold leading-snug text-ink">
          {headline}
        </p>
        {description && (
          <p className={`whitespace-pre-line text-[14.5px] leading-snug text-ink-muted${full ? "" : " line-clamp-3"}`}>
            {description}
          </p>
        )}
        {(badges.length > 0 || match || stream.edition) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <HostMatchChip match={match} />
            {badges.map((k) => (
              <FormatBadge key={k} kind={k} size="sm" />
            ))}
            <EditionChip stream={stream} />
          </div>
        )}
        {failed && (
          <p className="text-[13px] font-medium text-danger">Unavailable, try another.</p>
        )}
      </div>
      <div className="flex shrink-0 items-center self-center">
        {/* A mark now, not a control — the card around it is what gets pressed,
            so this only says which way the row acts. */}
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-canvas"
        >
          {download ? (
            <ArrowDownToLine size={25} strokeWidth={2.4} />
          ) : (
            <Play size={26} fill="currentColor" className="ml-0.5" />
          )}
        </span>
      </div>
    </FocusButton>
  );
}

function condenseDescription(text: string): string {
  if (!text) return "";
  const [first, ...rest] = text.split("\n");
  const head = first.length > 90 ? first.slice(0, 90).trimEnd() + "…" : first;
  return [head, ...rest].join("\n");
}
