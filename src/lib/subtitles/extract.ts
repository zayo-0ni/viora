import { convertFileSrc } from "@tauri-apps/api/core";
import type { PlayerBridge } from "@/lib/player/bridge";
import { fetchAndParse, type SubCue } from "./parser";

export type CueSource = { cues: SubCue[]; format: "srt" | "vtt" };
export type AnySourceResult = { ok: true; source: CueSource } | { ok: false; reason: string };

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function resolveReadableUrl(url: string): Promise<string | null> {
  if (/^(https?|blob|data|tauri|asset):/i.test(url)) return url;
  if (isTauri()) {
    try {
      return convertFileSrc(url);
    } catch {
      return null;
    }
  }
  return null;
}

export function detectFormatFromUrl(url: string): "srt" | "vtt" {
  const ext = url.split(/[?#]/)[0].match(/\.([a-z]{2,4})$/i)?.[1]?.toLowerCase();
  return ext === "vtt" ? "vtt" : "srt";
}

export async function getCuesAnySource(bridge: PlayerBridge): Promise<AnySourceResult> {
  const loaded = bridge.getSelectedTrackCues();
  if (loaded && loaded.length > 0) return { ok: true, source: { cues: loaded, format: "srt" } };

  const rawUrl = bridge.getSelectedTrackUrl();
  if (rawUrl) {
    const readable = await resolveReadableUrl(rawUrl);
    if (readable) {
      try {
        const cues = await fetchAndParse(readable);
        if (cues.length > 0) return { ok: true, source: { cues, format: detectFormatFromUrl(rawUrl) } };
      } catch {
        /* fall through to embedded extraction */
      }
    }
  }

  // A subtitle muxed into the container used to be recovered here by handing
  // the stream to an ffmpeg sidecar. Android cannot spawn one, so an embedded
  // track that the engine does not surface on its own is out of reach.
  return { ok: false, reason: "no-cues" };
}
