import type { PlayerEngine } from "@/lib/player/bridge";
import { useEffect } from "react";
import { applyMotionInterp } from "@/lib/player/motion-interp";
import { applySubStyle } from "@/lib/player/sub-style";
import type { useSettings } from "@/lib/settings";

export function useSubStyleApply(params: {
  engine: PlayerEngine;
  settings: ReturnType<typeof useSettings>["settings"];
  assNativeActive: boolean;
  imageNativeActive: boolean;
  bridgeReady: boolean;
  mediaReady: boolean;
  bridgeKey: string | number;
}) {
  const { engine, settings, assNativeActive, imageNativeActive, bridgeReady, mediaReady, bridgeKey } =
    params;

  useEffect(() => {
    if (engine !== "mpv") return;
    if (!bridgeReady) return;
    if (!mediaReady) return;
    void applySubStyle(settings, { assNativeActive, imageNativeActive });
  }, [
    engine,
    bridgeReady,
    mediaReady,
    bridgeKey,
    assNativeActive,
    imageNativeActive,
    settings.subFontSize,
    settings.subFontColor,
    settings.subBorderColor,
    settings.subBorderSize,
    settings.subMarginY,
    settings.subAlignX,
    settings.subAssOverride,
    settings.subStyle,
    settings.subFontFamily,
    settings.subLineSpacing,
    settings.subOpacity,
    settings.subBoxOpacity,
    settings.subBoxColor,
    settings.subBold,
  ]);

  useEffect(() => {
    if (engine !== "mpv") return;
    if (!bridgeReady) return;
    const svpActive = settings.playerSvp && !!settings.svpVpyPath;
    void applyMotionInterp(settings.playerMotionInterp && !svpActive);
  }, [
    engine,
    bridgeReady,
    bridgeKey,
    settings.playerMpvEmbed,
    settings.playerMotionInterp,
    settings.playerSvp,
    settings.svpVpyPath,
  ]);
}
