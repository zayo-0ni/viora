import { LiveChannelOverlay } from "@/components/player/live-channel-overlay/overlay";
import type { useLiveChannelOverlay } from "./hooks/use-live-channel-overlay";

// The DVR recorder used to sit alongside the channel overlay here. It captured
// the stream with an ffmpeg sidecar, which Android cannot spawn.

export function LiveLayer({
  liveOverlay,
}: {
  liveOverlay: ReturnType<typeof useLiveChannelOverlay>;
}) {
  return (
    <>
      {liveOverlay.open && liveOverlay.activeSource && (
        <LiveChannelOverlay
          source={liveOverlay.activeSource}
          sources={liveOverlay.availableSources}
          onSelectSource={liveOverlay.selectSource}
          currentChannelId={liveOverlay.currentChannelId}
          onSwitch={liveOverlay.switchChannel}
          onClose={() => liveOverlay.setOpen(false)}
          group={liveOverlay.group}
          setGroup={liveOverlay.setGroup}
          query={liveOverlay.query}
          setQuery={liveOverlay.setQuery}
        />
      )}
    </>
  );
}
