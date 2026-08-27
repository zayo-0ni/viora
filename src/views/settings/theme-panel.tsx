import { useSettings } from "@/lib/settings";
import { type ThemeSettings } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { Section } from "./shared";
import { SeekBarPanel } from "./player-panel";
import { BackgroundPicker } from "./theme-panel/background-picker";
import { ColorThemeBody } from "./theme-panel/color-theme-body";
import { CustomThemesSection } from "./theme-panel/custom-themes-section";
import { DisplaySection } from "./theme-panel/display-section";
import { FontGrid } from "./theme-panel/font-grid";


export function ThemePanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const theme = settings.theme;

  const setTheme = (patch: Partial<ThemeSettings>) => {
    update({ theme: { ...theme, ...patch } });
  };

  return (
    <>
      <Section
        title={t("Theme")}
        subtitle={t("Pick a look. Every color and surface updates instantly.")}
      >
        <ColorThemeBody
          activePreset={theme.preset}
          fontPair={theme.fontPair}
          customColors={theme.customColors}
          onSelect={(id) => setTheme({ preset: id })}
          onSaveCustom={(c) => setTheme({ preset: "custom", customColors: c })}
          onClearCustom={() =>
            setTheme({
              customColors: null,
              preset: theme.preset === "custom" ? "cool-grey" : theme.preset,
            })
          }
        />
      </Section>

      <Section
        title={t("Background image")}
        subtitle={t("Drop a wallpaper behind the app. The dim slider keeps text readable.")}
      >
        <BackgroundPicker
          imageData={theme.backgroundImage}
          dim={theme.backgroundDim}
          onImageChange={(d) => setTheme({ backgroundImage: d })}
          onDimChange={(d) => setTheme({ backgroundDim: d })}
        />
      </Section>

      <Section
        title={t("Typography")}
        subtitle={t("Pick a display and body pairing, or upload your own font to use across Viora.")}
      >
        <FontGrid
          pairValue={theme.fontPair}
          customValue={theme.customFontId ?? null}
          onPickPair={(f) => setTheme({ fontPair: f, customFontId: null })}
          onPickCustom={(id) => setTheme({ customFontId: id })}
        />
      </Section>

      <Section
        title={t("Your themes")}
        subtitle={t("Make your own in the Theme Studio, or import one a friend shared.")}
      >
        <CustomThemesSection />
      </Section>

      <DisplaySection />

      <Section
        title={t("Seek bar")}
        subtitle={t("Style the timeline at the bottom of the player. Swap the dot for a sticker, change the bar height, recolor it. Settings live-preview right here.")}
      >
        <SeekBarPanel />
      </Section>

    </>
  );
}

