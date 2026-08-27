import { FocusButton } from "@/lib/tv-focus";
import { can } from "@/lib/capabilities";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ToggleRow } from "../shared";
import { BandwidthInput } from "./bandwidth-section";
import { DesktopOnlyBlock } from "./internals";

type Choice = {
  id: "auto" | "mpv" | "exo";
  label: string;
  sub: string;
  recommended?: boolean;
};

function EngineChoices({
  choices,
  isSelected,
}: {
  choices: Choice[];
  isSelected: (id: Choice["id"]) => boolean;
}) {
  const { update } = useSettings();
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5">
      {choices.map((c) => {
        const selected = isSelected(c.id);
        return (
          <FocusButton
            key={c.id}
            type="button"
            onClick={() => update({ playerEngine: c.id })}
            className={`flex items-start gap-3.5 rounded-2xl border px-5 py-4 text-start transition-colors ${
              selected
                ? "border-ink bg-elevated"
                : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-canvas/60"
            }`}
          >
            <span
              className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selected ? "border-ink" : "border-edge"
              }`}
            >
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{c.label}</span>
                {c.recommended && (
                  <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-accent">
                    {t("Recommended")}
                  </span>
                )}
              </div>
              <span className="text-[12.5px] leading-snug text-ink-muted">{c.sub}</span>
            </div>
          </FocusButton>
        );
      })}
    </div>
  );
}

export function PlayerEnginePanel() {
  const { settings, update } = useSettings();
  const t = useT();

  // Two engines, and the choice is real on this device: both are compiled into
  // the app rather than looked for on the machine.
  if (can("exoEngine")) {
    const choices: Choice[] = [
      {
        id: "exo",
        label: t("Native player"),
        sub: t(
          "Decodes with the television's own hardware: HEVC, 10-bit and 4K at no cost in heat or battery. The right choice for almost everything.",
        ),
        recommended: true,
      },
      {
        id: "mpv",
        label: "mpv",
        sub: t(
          "Brings its own decoders instead of asking the television, so it plays what the hardware turns down — DTS and TrueHD audio, unusual containers — and scales the picture with libplacebo. Heavier on the processor.",
        ),
      },
    ];
    // Auto means ExoPlayer here, so a fresh install shows the radio where
    // playback will actually happen rather than on nothing at all.
    const isSelected = (id: Choice["id"]) =>
      id === "exo" ? settings.playerEngine !== "mpv" : settings.playerEngine === id;
    return (
      <div className="flex flex-col gap-4">
        <EngineChoices choices={choices} isSelected={isSelected} />
      </div>
    );
  }

  const choices: Choice[] = [
    {
      id: "auto",
      label: t("Auto"),
      sub: t("The right engine without thinking about it."),
      recommended: true,
    },
    {
      id: "mpv",
      label: "mpv",
      sub: t("Bundled with Viora. Plays anything you throw at it."),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DesktopOnlyBlock>
        <EngineChoices choices={choices} isSelected={(id) => settings.playerEngine === id} />
      </DesktopOnlyBlock>

      <DesktopOnlyBlock>
        <div className="flex flex-col gap-2">
          <ToggleRow
            label={t("Embed mpv inside Viora window")}
            sub={t("Renders mpv inline so playback lives in Viora itself. Disable to open it in a separate window instead.")}
            value={settings.playerMpvEmbed}
            onChange={(v) => update({ playerMpvEmbed: v })}
          />
          <ToggleRow
            label={t("HDR-to-SDR tonemapping")}
            sub={t("Maps HDR sources to SDR using bt.2446a. Recommended on SDR displays.")}
            value={settings.playerHdrToSdr}
            onChange={(v) => update({ playerHdrToSdr: v })}
          />
        </div>
      </DesktopOnlyBlock>

      <DesktopOnlyBlock>
        <BandwidthInput />
      </DesktopOnlyBlock>
    </div>
  );
}
