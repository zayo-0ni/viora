import { FocusButton } from "@/lib/tv-focus";
import { isDpadPrimary } from "@/lib/platform";
import { t as translate } from "@/lib/i18n";
import { Camera, ChevronLeft, Crop, Info, Maximize, Minimize, Pause, PauseCircle, PictureInPicture2, Play, PlayCircle, Replace, Tv } from "lucide-react";
import type { ReactNode } from "react";
import type { PlayerEngine, PlayerCapabilities, PlayerSnapshot } from "@/lib/player/bridge";
import type { Meta } from "@/lib/cinemeta";
import { getCustomIcon, type ControlVariant, type CustomIconMap, type PlayerControlId, type TimeFormat, type VolumeStyle } from "@/lib/player-chrome";
import type { DownloadStatus } from "@/views/player/hooks/use-video-download";
import { renderCustomIconControl } from "./custom-icon-renderer";
import { realQualityLabel } from "@/lib/player/resolution-label";
import { CROP_PRESETS } from "@/views/player/hooks/use-video-fill";
import { PLAY_PAUSE_FOCUS_KEY } from "./transport-utils";

function getControlState(id: PlayerControlId, ctx: ControlContext): string | undefined {
  const preview = ctx.previewStates?.[id];
  if (preview) return preview;
  switch (id) {
    case "play-pause":
      return ctx.playing ? "playing" : "paused";
    case "fullscreen":
      return ctx.fullscreen ? "fullscreen" : "windowed";
    case "draw-toggle":
      return ctx.drawMode ? "active" : "inactive";
    case "cast":
      return ctx.capabilities.chromecast ? "connected" : "idle";
    case "pip":
      return "inactive";
    case "download":
      return ctx.download?.kind ?? "idle";
  }
  return undefined;
}
import { SubtitleMenu } from "../subtitle-menu";
import { AudioMenu } from "../audio-menu";
import { DownloadButton } from "./download-button";
import { Tooltip } from "./tooltip";
import { BigButton } from "./big-button";
import { VolumeControl } from "./volume-control";
import { SpeedMenu } from "./speed-menu";
import { HdrToggleBigBtn } from "./hdr-toggle-btn";
import { DrawToggle } from "./draw-toggle";
import { CastButton } from "./cast-button";
import { SeekStepBtn } from "./seek-step-btn";
import { EpisodeNavBtn } from "./episode-nav-btn";
import { TimeStart, TimeEnd } from "./time-display";
import { IdentifySongButton } from "@/components/identify-song-button";

export type ControlContext = {
  t?: (key: string, vars?: Record<string, string | number>) => string;
  snap: PlayerSnapshot;
  capabilities: PlayerCapabilities;
  fullscreen: boolean;
  drawMode: boolean;
  hideOthersDrawings: boolean;
  showDraw: boolean;
  isWatchTogether?: boolean;
  playing: boolean;
  mid: boolean;
  compact: boolean;
  tight: boolean;
  active: boolean;
  isLiveChannel: boolean;
  showEpisodeNav: boolean;
  hasPrevEp: boolean;
  hasNextEp: boolean;
  canPickAnother: boolean;
  engine: PlayerEngine;
  useOverlayPopups?: boolean;
  editing?: boolean;
  customIcons?: CustomIconMap;
  previewStates?: Partial<Record<PlayerControlId, string>>;
  controlVariants?: Partial<Record<PlayerControlId, ControlVariant>>;
  timeFormat?: TimeFormat;
  onCycleTimeFormat?: () => void;
  volumeStyle?: VolumeStyle;
  seekBackStepSec: number;
  seekForwardStepSec: number;
  title?: string;
  subtitle?: string;
  titleClickable?: boolean;
  titleScale?: number;
  titleSeriesFirst?: boolean;
  onBack?: () => void;
  onTitleClick?: () => void;
  meta?: Meta;
  metaImdbId?: string | null;
  metaTitle?: string | null;
  metaReleaseDate?: string | null;
  season?: number | null;
  episode?: number | null;
  download?: DownloadStatus;
  sleep?: import("@/views/player/hooks/use-sleep-timer").SleepTimerState;
  onPlayPause: () => void;
  onSeekStep: (delta: number) => void;
  onMute: () => void;
  onVolume: (v: number) => void;
  onAudio: (id: string) => void;
  onSubtitle: (id: string | null) => void;
  onSubDelay: (sec: number) => void;
  onAudioDelay: (sec: number) => void;
  onEnterSync?: () => void;
  onAddSubtitle: (url: string, lang?: string, title?: string) => void;
  onRate: (r: number) => void;
  onPiP: () => void;
  onFullscreen: () => void;
  onCast: () => void;
  onToggleDraw: () => void;
  onToggleHideOthers: () => void;
  onClearDraw: () => void;
  onScreenshot: () => void;
  onPickAnother: () => void;
  alternateEngine?: PlayerEngine | null;
  onSwitchEngine: () => void;
  onPrevEp: () => void;
  onNextEp: () => void;
  onDownloadStart?: () => void;
  onDownloadCancel?: () => void;
  onDownloadReveal?: () => void;
  onDownloadReset?: () => void;
  setAudioMenuOpen: (v: boolean) => void;
  setSubtitleMenuOpen: (v: boolean) => void;
  setSpeedMenuOpen: (v: boolean) => void;
  setAspectMenuOpen: (v: boolean) => void;
  cropMode?: string;
  onCropMode?: (id: string) => void;
};

export function renderControl(id: PlayerControlId, ctx: ControlContext): ReactNode {
  const t = ctx.t ?? translate;
  const state = getControlState(id, ctx);
  const iconUrl = getCustomIcon(ctx.customIcons, id, state);
  if (iconUrl) {
    const custom = renderCustomIconControl(id, ctx, iconUrl);
    if (custom !== undefined) return custom;
  }
  switch (id) {
    case "back": {
      // Gone on a remote: the Back key does this, and an on-screen Back is one
      // more thing for the D-pad to land on — the one it used to land on by
      // default, so OK meant "leave the film".
      if (isDpadPrimary()) return null;
      if (!ctx.onBack) return null;
      return (
        <Tooltip label={t("Back")} side="bottom">
          <FocusButton
            onClick={ctx.onBack}
            aria-label={t("Back")}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/80"
          >
            <ChevronLeft size={26} strokeWidth={2.2} />
          </FocusButton>
        </Tooltip>
      );
    }
    case "title-info": {
      if (!ctx.title) return null;
      const scale = ctx.titleScale ?? 1;
      const swap = !!ctx.titleSeriesFirst && !!ctx.subtitle;
      const primary = swap ? ctx.subtitle : ctx.title;
      const secondary = swap ? ctx.title : ctx.subtitle;
      const qual = realQualityLabel(ctx.snap.videoWidth, ctx.snap.videoHeight);
      const lines = (
        <>
          <div className="flex items-center gap-2">
            <h1
              style={{ fontSize: `${Math.round(19 * scale)}px` }}
              className="font-semibold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            >
              {primary}
            </h1>
            {qual && (
              <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white/85">
                {qual}
              </span>
            )}
          </div>
          {secondary && (
            <p
              style={{ fontSize: `${Math.round(13 * scale)}px` }}
              className="text-white/70 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
            >
              {secondary}
            </p>
          )}
        </>
      );
      // Read-only on a remote. It is a caption, not a control, and being
      // focusable put a highlight on the film title on the way to everything
      // else.
      if (ctx.titleClickable && ctx.onTitleClick && !isDpadPrimary()) {
        return (
          <FocusButton
            type="button"
            onClick={ctx.onTitleClick}
            className="pointer-events-auto group inline-flex items-center gap-2 rounded-lg px-2 py-0.5 text-start transition-colors hover:bg-white/10"
            aria-label={t("Title info")}
          >
            <div className="flex flex-col items-start gap-0.5">{lines}</div>
            <Info
              size={14}
              strokeWidth={2.2}
              className="opacity-50 transition-opacity group-hover:opacity-95"
            />
          </FocusButton>
        );
      }
      return (
        <div className="pointer-events-none flex flex-col items-start gap-0.5 text-start">{lines}</div>
      );
    }
    case "time-start": {
      return (
        <TimeStart
          durationSec={ctx.snap.durationSec}
          isLiveChannel={ctx.isLiveChannel}
          tight={ctx.tight}
          active={ctx.active}
        />
      );
    }
    case "time-end": {
      return (
        <TimeEnd
          durationSec={ctx.snap.durationSec}
          timeFormat={ctx.timeFormat}
          isLiveChannel={ctx.isLiveChannel}
          tight={ctx.tight}
          active={ctx.active}
          onCycle={ctx.editing ? undefined : ctx.onCycleTimeFormat}
        />
      );
    }
    case "volume": {
      // The remote has its own volume keys.
      if (isDpadPrimary()) return null;
      if (ctx.tight) return null;
      return (
        <VolumeControl
          snap={ctx.snap}
          onMute={ctx.onMute}
          onVolume={ctx.onVolume}
          capabilities={ctx.capabilities}
          style={ctx.volumeStyle ?? "slider"}
        />
      );
    }
    case "download": {
      if (ctx.mid || ctx.isLiveChannel) return null;
      if (!ctx.download || !ctx.onDownloadStart || !ctx.onDownloadCancel || !ctx.onDownloadReveal || !ctx.onDownloadReset) {
        return null;
      }
      return (
        <DownloadButton
          status={ctx.download}
          onStart={ctx.onDownloadStart}
          onCancel={ctx.onDownloadCancel}
          onReveal={ctx.onDownloadReveal}
          onReset={ctx.onDownloadReset}
        />
      );
    }
    case "prev-episode": {
      if (ctx.tight || !ctx.showEpisodeNav) return null;
      const v = ctx.controlVariants?.["prev-episode"] ?? "auto";
      const iconOnly = v === "condensed" ? true : v === "full" ? false : ctx.mid;
      return (
        <EpisodeNavBtn
          direction="prev"
          label={t("Previous Episode")}
          onClick={ctx.onPrevEp}
          disabled={!ctx.hasPrevEp}
          iconOnly={iconOnly}
        />
      );
    }
    case "seek-back": {
      if (ctx.tight || ctx.isLiveChannel) return null;
      return <SeekStepBtn direction="back" seconds={10} onSeekStep={ctx.onSeekStep} />;
    }
    case "play-pause": {
      return (
        <Tooltip label={ctx.playing ? t("Pause") : t("Play")}>
          <FocusButton
            onClick={ctx.onPlayPause}
            focusKey={PLAY_PAUSE_FOCUS_KEY}
            className={`flex items-center justify-center rounded-full text-white transition-[background-color,transform] active:scale-95 ${
              // No disc behind it on a remote: the glyph alone is the control,
              // and a filled circle plus a ringed icon was two frames around
              // one triangle.
              isDpadPrimary() ? "" : "bg-white/12 backdrop-blur-md hover:bg-white/22"
            } ${ctx.tight ? "h-12 w-12" : ctx.compact ? "h-14 w-14" : "h-16 w-16"}`}
            aria-label={ctx.playing ? t("Pause") : t("Play")}
          >
            {isDpadPrimary() ? (
              ctx.playing ? (
                <Pause size={ctx.tight ? 28 : ctx.compact ? 32 : 36} strokeWidth={2} fill="currentColor" />
              ) : (
                <Play size={ctx.tight ? 28 : ctx.compact ? 32 : 36} strokeWidth={2} fill="currentColor" />
              )
            ) : ctx.playing ? (
              <PauseCircle size={ctx.tight ? 28 : ctx.compact ? 32 : 36} strokeWidth={1.5} />
            ) : (
              <PlayCircle size={ctx.tight ? 28 : ctx.compact ? 32 : 36} strokeWidth={1.5} />
            )}
          </FocusButton>
        </Tooltip>
      );
    }
    case "seek-forward": {
      if (ctx.tight || ctx.isLiveChannel) return null;
      return <SeekStepBtn direction="forward" seconds={10} onSeekStep={ctx.onSeekStep} />;
    }
    case "next-episode": {
      if (ctx.tight || !ctx.showEpisodeNav) return null;
      const v = ctx.controlVariants?.["next-episode"] ?? "auto";
      const iconOnly = v === "condensed" ? true : v === "full" ? false : ctx.mid;
      return (
        <EpisodeNavBtn
          direction="next"
          label={t("Next Episode")}
          onClick={ctx.onNextEp}
          disabled={!ctx.hasNextEp}
          iconOnly={iconOnly}
        />
      );
    }
    case "pick-another": {
      if (ctx.tight || !ctx.canPickAnother) return null;
      return (
        <BigButton
          onClick={ctx.onPickAnother}
          ariaLabel={ctx.isLiveChannel ? t("TV Guide") : t("Switch stream")}
          tooltip={ctx.isLiveChannel ? t("TV Guide") : t("Switch stream")}
        >
          {ctx.isLiveChannel ? (
            <Tv size={22} strokeWidth={1.9} />
          ) : (
            <Replace size={22} strokeWidth={1.9} />
          )}
        </BigButton>
      );
    }
    case "engine-switch": {
      // One button per engine, and the running one is green.
      //
      // This was a single button that swapped to whichever engine was not
      // playing. It worked, but it never said which one you were on — the icon
      // was the same either way — so pressing it was a guess and the only way
      // to know the answer was to watch what happened. Two buttons state the
      // choice and mark the answer: the engine playing is lit, the other is a
      // place to go.
      //
      // Both are still shown only when both exist; a device with one engine has
      // no choice to offer.
      if (ctx.tight || !ctx.alternateEngine) return null;
      const engines: Array<{ id: "mpv" | "exo"; name: string }> = [
        { id: "mpv", name: "mpv" },
        { id: "exo", name: translate("the native player") },
      ];
      return (
        <>
          {engines.map((e) => {
            const running = ctx.engine === e.id;
            const label = running
              ? translate("Playing on {engine}", { engine: e.name })
              : translate("Switch to {engine}", { engine: e.name });
            return (
              <BigButton
                key={e.id}
                onClick={running ? undefined : ctx.onSwitchEngine}
                ariaLabel={label}
                tooltip={label}
              >
                <span
                  className={`text-[12px] font-bold uppercase tracking-[0.06em] ${
                    running ? "text-emerald-400" : ""
                  }`}
                >
                  {e.id === "mpv" ? "MPV" : "TV"}
                </span>
              </BigButton>
            );
          })}
        </>
      );
    }
    case "audio-menu": {
      if (ctx.tight) return null;
      return (
        <AudioMenu
          tracks={ctx.snap.audioTracks}
          selectedId={ctx.snap.audioTracks.find((t) => t.selected)?.id ?? null}
          delaySec={ctx.snap.audioDelaySec}
          engine={ctx.engine}
          onSelect={ctx.onAudio}
          onDelay={ctx.onAudioDelay}
          onOpenChange={ctx.setAudioMenuOpen}
        />
      );
    }
    case "subtitle-menu": {
      if (ctx.isLiveChannel && ctx.snap.subtitleTracks.length === 0) return null;
      return (
        <SubtitleMenu
          tracks={ctx.snap.subtitleTracks}
          selectedId={ctx.snap.subtitleTracks.find((t) => t.selected)?.id ?? null}
          delaySec={ctx.snap.subDelaySec}
          onSelect={ctx.onSubtitle}
          onDelay={ctx.onSubDelay}
          onEnterSync={ctx.onEnterSync}
          onAddSubtitle={ctx.onAddSubtitle}
          metaImdbId={ctx.metaImdbId}
          metaTitle={ctx.metaTitle}
          metaReleaseDate={ctx.metaReleaseDate}
          season={ctx.season}
          episode={ctx.episode}
          onOpenChange={ctx.setSubtitleMenuOpen}
        />
      );
    }
    case "speed-menu": {
      if (ctx.compact || ctx.isLiveChannel) return null;
      return (
        <SpeedMenu
          rate={ctx.snap.rate}
          onRate={ctx.onRate}
          sleep={ctx.sleep}
          onOpenChange={ctx.setSpeedMenuOpen}
        />
      );
    }
    case "aspect-menu": {
      if (ctx.tight || !ctx.onCropMode) return null;
      // A press is the whole interaction: it steps to the next shape and the
      // player flashes its name. A popup for nine options was three presses to
      // change something a viewer wants to try and see.
      const modes = CROP_PRESETS;
      const at = Math.max(0, modes.findIndex((m) => m.id === (ctx.cropMode ?? "fit")));
      const next = modes[(at + 1) % modes.length];
      const current = modes[at];
      const onCrop = ctx.onCropMode;
      const label = t("Aspect ratio: {mode}", { mode: t(current?.label ?? "Fit") });
      return (
        <BigButton onClick={() => onCrop(next.id)} ariaLabel={label} tooltip={label}>
          <span className="flex items-center gap-1">
            <Crop size={21} strokeWidth={1.9} />
            {current && current.id !== "fit" && (
              <span className="text-[11px] font-bold tabular-nums tracking-wider">
                {current.label}
              </span>
            )}
          </span>
        </BigButton>
      );
    }
    case "hdr-toggle": {
      // Tone mapping is an mpv render option. The native engine hands HDR
      // straight to the panel and has nothing here to toggle.
      if (ctx.tight || ctx.engine !== "mpv") return null;
      return <HdrToggleBigBtn />;
    }
    case "draw-toggle": {
      if (ctx.compact || !ctx.showDraw) return null;
      return (
        <DrawToggle
          active={ctx.drawMode}
          hideOthers={ctx.hideOthersDrawings}
          onToggle={ctx.onToggleDraw}
          onToggleHideOthers={ctx.onToggleHideOthers}
          onClear={ctx.onClearDraw}
        />
      );
    }
    case "screenshot": {
      return (
        <BigButton onClick={ctx.onScreenshot} ariaLabel={t("Screenshot")} tooltip={t("Screenshot")}>
          <Camera size={24} strokeWidth={1.9} />
        </BigButton>
      );
    }
    case "song-id": {
      if (ctx.tight) return null;
      return <IdentifySongButton editing={ctx.editing} />;
    }
    case "pip": {
      if (!ctx.capabilities.pictureInPicture) return null;
      return (
        <BigButton onClick={ctx.onPiP} ariaLabel={t("Picture in Picture")} tooltip={t("Picture in Picture")}>
          <PictureInPicture2 size={22} strokeWidth={1.9} />
        </BigButton>
      );
    }
    case "cast": {
      if (isDpadPrimary()) return null;
      if (ctx.tight) return null;
      return <CastButton onClick={ctx.onCast} capabilities={ctx.capabilities} />;
    }
    case "fullscreen": {
      // Nothing to toggle: the player is the screen. Its place in the row is
      // taken by the aspect menu, which is the control a viewer actually wants
      // there — fit, fill, zoom, or a forced ratio for old 4:3 shows.
      if (isDpadPrimary()) return null;
      return (
        <BigButton
          onClick={ctx.onFullscreen}
          ariaLabel={t("Fullscreen")}
          tooltip={ctx.fullscreen ? t("Exit fullscreen") : t("Fullscreen")}
        >
          {ctx.fullscreen ? (
            <Minimize size={22} strokeWidth={1.9} />
          ) : (
            <Maximize size={22} strokeWidth={1.9} />
          )}
        </BigButton>
      );
    }
    case "window-controls":
      // A television has one window and it is the screen. These were minimise,
      // maximise and close for a desktop that no longer exists. The case stays
      // so a saved player layout naming this control still loads.
      return null;
  }
}
