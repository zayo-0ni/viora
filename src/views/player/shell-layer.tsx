import type { RefObject } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayerEngine, PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { getPlayerShell, type PlayerShellProps } from "@/lib/player-shells/registry";
import { writePlayerPrefs } from "@/lib/player-prefs";
import { writePlayerVolume } from "@/lib/player-volume";
import type { useVideoDownload } from "./hooks/use-video-download";

export function ShellLayer({
  shellId,
  shellSnap,
  snapRef,
  bridgeRef,
  engine,
  visible,
  fullscreen,
  drawMode,
  hideOthersDrawings,
  pipMode,
  showDraw,
  metaId,
  onMenuOpenChange,
  onBack,
  onPlayPause,
  onSeek,
  onSeekStep,
  rememberSubChoice,
  onEnterSync,
  cropMode,
  onCropMode,
  onPiP,
  onFullscreen,
  openCastMenu,
  onToggleDraw,
  onToggleHideOthers,
  onClearDraw,
  onScreenshot,
  onPickAnother,
  canPickAnother,
  alternateEngine,
  onSwitchEngine,
  title,
  subtitle,
  resolution,
  quality,
  hoverTitle,
  hoverSub,
  hasPrevEp,
  hasNextEp,
  onPrevEp,
  onNextEp,
  metaImdbId,
  metaTitle,
  metaReleaseDate,
  meta,
  tmdbKey,
  season,
  episode,
  download,
  onOpenDvr,
  sleep,
  onVolumeFeedback,
}: {
  shellId: string;
  shellSnap: PlayerSnapshot;
  snapRef: RefObject<PlayerSnapshot>;
  bridgeRef: RefObject<PlayerBridge | null>;
  engine: PlayerEngine;
  visible: boolean;
  fullscreen: boolean;
  drawMode: boolean;
  hideOthersDrawings: boolean;
  pipMode: boolean;
  showDraw: boolean;
  metaId: string;
  onMenuOpenChange: (open: boolean) => void;
  onBack: () => void;
  onPlayPause: () => void;
  onSeek: (sec: number) => void;
  onSeekStep: (delta: number) => void;
  rememberSubChoice: (t: { lang?: string } | null | undefined) => void;
  onEnterSync?: () => void;
  cropMode?: string;
  onCropMode?: (id: string) => void;
  onPiP: () => void;
  onFullscreen: () => void;
  openCastMenu: (anchor: { right: number; bottom: number } | null) => void;
  onToggleDraw: () => void;
  onToggleHideOthers: () => void;
  onClearDraw: () => void;
  onScreenshot: () => void;
  onPickAnother: () => void;
  canPickAnother: boolean;
  alternateEngine: PlayerEngine | null;
  onSwitchEngine: () => void;
  title: string;
  subtitle?: string;
  resolution?: string | null;
  quality?: string | null;
  hoverTitle?: string;
  hoverSub?: string;
  hasPrevEp: boolean;
  hasNextEp: boolean;
  onPrevEp: () => void;
  onNextEp: () => void;
  metaImdbId: string | null;
  metaTitle: string | null;
  metaReleaseDate: string | null;
  meta: Meta;
  tmdbKey: string | null;
  season: number | null;
  episode: number | null;
  download?: ReturnType<typeof useVideoDownload>;
  onOpenDvr?: () => void;
  sleep: PlayerShellProps["sleep"];
  onVolumeFeedback?: (volume: number, muted: boolean) => void;
}) {
  const ActiveShell = getPlayerShell(shellId).Component;
  return (
    <ActiveShell
      snap={shellSnap}
      engine={engine}
      useOverlayPopups={false}
      onMenuOpenChange={onMenuOpenChange}
      capabilities={bridgeRef.current?.capabilities() ?? { engine: "exo", pictureInPicture: false, airplay: false, chromecast: false, hdrPassthrough: false, hardwareDecode: true }}
      visible={visible}
      fullscreen={fullscreen}
      drawMode={drawMode}
      hideOthersDrawings={hideOthersDrawings}
      pipMode={pipMode}
      showDraw={showDraw}
      onBack={onBack}
      onPlayPause={onPlayPause}
      onSeek={onSeek}
      onSeekStep={onSeekStep}
      onMute={() => {
        const next = !snapRef.current.muted;
        bridgeRef.current?.setMuted(next);
        writePlayerVolume({ muted: next });
        onVolumeFeedback?.(snapRef.current.volume, next);
      }}
      onVolume={(v) => {
        bridgeRef.current?.setVolume(v);
        bridgeRef.current?.setMuted(false);
        writePlayerVolume({ volume: v, muted: false });
        onVolumeFeedback?.(v, false);
      }}
      onAudio={(id) => {
        bridgeRef.current?.setAudioTrack(id);
        const t = snapRef.current.audioTracks.find((x) => x.id === id);
        if (t?.lang) writePlayerPrefs(metaId, { audioLang: t.lang });
      }}
      onSubtitle={(id) => {
        bridgeRef.current?.setSubtitleTrack(id);
        rememberSubChoice(snapRef.current.subtitleTracks.find((x) => x.id === id));
      }}
      onSubDelay={(s) => {
        bridgeRef.current?.setSubDelay(s);
        writePlayerPrefs(metaId, { subDelaySec: s });
      }}
      onEnterSync={onEnterSync}
      onAudioDelay={(s) => bridgeRef.current?.setAudioDelay(s)}
      onAddSubtitle={(url, lang, title2) => {
        const p = bridgeRef.current?.addSubtitle(url, lang, title2) ?? Promise.resolve(false);
        void p.then((ok) => {
          if (ok) rememberSubChoice({ lang });
        });
        return p;
      }}
      onRate={(r) => {
        bridgeRef.current?.setRate(r);
        writePlayerPrefs(metaId, { rate: r });
      }}
      cropMode={cropMode}
      onCropMode={onCropMode}
      onPiP={onPiP}
      onFullscreen={onFullscreen}
      onCast={() => {
        const btn = (document.querySelector(
          '[aria-label="Cast"]',
        ) as HTMLElement | null);
        if (btn) {
          const r = btn.getBoundingClientRect();
          openCastMenu({ right: r.right, bottom: r.top });
        } else {
          openCastMenu(null);
        }
      }}
      onToggleDraw={onToggleDraw}
      onToggleHideOthers={onToggleHideOthers}
      onClearDraw={onClearDraw}
      onScreenshot={onScreenshot}
      onPickAnother={onPickAnother}
      canPickAnother={canPickAnother}
      alternateEngine={alternateEngine}
      onSwitchEngine={onSwitchEngine}
      title={title}
      subtitle={subtitle}
      resolution={resolution}
      quality={quality}
      hoverTitle={hoverTitle}
      hoverSub={hoverSub}
      hasPrevEp={hasPrevEp}
      hasNextEp={hasNextEp}
      onPrevEp={onPrevEp}
      onNextEp={onNextEp}
      metaImdbId={metaImdbId}
      metaTitle={metaTitle}
      metaReleaseDate={metaReleaseDate}
      meta={meta}
      tmdbKey={tmdbKey}
      season={season}
      episode={episode}
      download={download?.status}
      onDownloadStart={download?.start}
      onDownloadCancel={download?.cancel}
      onDownloadReveal={download?.reveal}
      onDownloadReset={download?.reset}
      onOpenDvr={onOpenDvr}
      sleep={sleep}
    />
  );
}
