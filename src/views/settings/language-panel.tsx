import { TvField } from "@/components/tv-controls";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import { SubtitleStylePanel } from "./player-panel";
import { LanguagesPicker } from "./streaming-panel";
import { DisplayLanguageSection } from "./language-panel/display-language-section";



export function LanguagePanel() {
  const { settings, update } = useSettings();
  const t = useT();
  const [blockDraft, setBlockDraft] = useState(settings.trackBlockWords.join(", "));
  return (
    <>
    <DisplayLanguageSection />

    {/* The second of the two, and the last language question in the app.
        Subtitles, audio, artwork, metadata, how add-on sources are ranked and
        which rows Home keeps were seven separate settings that disagreed with
        one another. They are one answer now, and an empty one is honest: no
        preference, so every subtitle is offered and nothing is demoted. */}
    <Section
      title={t("Content language")}
      subtitle={t("Titles, artwork, subtitles, audio, and which sources come first — all of it follows this. Main language at the top. Leave it empty and nothing is preferred: every subtitle is offered and you choose.")}
    >
      <LanguagesPicker
        value={settings.contentLanguages}
        onChange={(langs) => update({ contentLanguages: langs })}
      />
    </Section>
    <Section
      title={t("Subtitles")}
      subtitle={t("How subtitles behave during playback. Which language they are in is the content language above.")}
    >
      <ToggleRow
        label={t("Start with subtitles off")}
        sub={t("Viora still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.")}
        value={settings.subtitlesOffByDefault}
        onChange={(v) => update({ subtitlesOffByDefault: v })}
      />
      <ToggleRow
        label={t("Prefer embedded subtitles")}
        sub={t("When the file ships its own subtitle track, keep it selected instead of switching to a downloaded one. Embedded tracks are usually the best synced.")}
        value={settings.preferEmbeddedSubs}
        onChange={(v) => update({ preferEmbeddedSubs: v })}
      />
      <ToggleRow
        label={t("Forced subs with native audio")}
        sub={t("When the audio already matches your subtitle language, pick a forced track (foreign dialogue and signs only) instead of full subtitles. If the file has no forced track, subtitles stay off.")}
        value={settings.forcedSubsWhenNativeAudio}
        onChange={(v) => update({ forcedSubsWhenNativeAudio: v })}
      />
      <ToggleRow
        label={t("Upgrade subtitles when better ones load")}
        sub={t("Downloaded subtitles can arrive a moment after playback starts. Leave this off to keep whatever subtitle is already showing; turn it on to switch to the best language match as soon as it loads.")}
        value={settings.subtitleAutoUpgrade}
        onChange={(v) => update({ subtitleAutoUpgrade: v })}
      />
      <ToggleRow
        label={t("Choose subtitles before playback")}
        sub={t("After you pick a source, show a subtitle picker so you can set the exact track and language before the video starts. Off by default, Viora keeps picking one for you automatically.")}
        value={settings.subtitlePreselect}
        onChange={(v) => update({ subtitlePreselect: v })}
      />
      <div className="flex flex-col gap-1.5 pt-1">
        <p className="text-[13.5px] font-medium text-ink">{t("Never auto-select tracks containing")}</p>
        <p className="text-[12px] leading-relaxed text-ink-subtle">
          {t("Comma-separated words. Audio or subtitle tracks whose name matches any of these are skipped during automatic selection. You can still pick them by hand in the player.")}
        </p>
        <TvField
          value={blockDraft}
          onCommit={(v) => {
            setBlockDraft(v);
            update({
              trackBlockWords: v.split(",").map((w) => w.trim()).filter(Boolean),
            });
          }}
          title={t("Skip tracks whose name matches")}
          placeholder={t("commentary, descriptive")}
          className="max-w-[340px]"
        >
          <input
            type="text"
            value={blockDraft}
            onChange={(e) => {
              setBlockDraft(e.target.value);
              update({
                trackBlockWords: e.target.value
                  .split(",")
                  .map((w) => w.trim())
                  .filter(Boolean),
              });
            }}
            placeholder={t("commentary, descriptive")}
            className="h-11 w-full max-w-[340px] rounded-xl border border-edge-soft bg-canvas/40 px-3.5 text-[13.5px] text-ink outline-none transition-colors focus:border-edge"
          />
        </TvField>
      </div>
    </Section>

    <Section
      title={t("Subtitle style")}
      subtitle={t("How subtitles look during playback. Live preview below.")}
    >
      <SubtitleStylePanel />
    </Section>





    </>
  );
}
