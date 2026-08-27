import { FocusButton } from "@/lib/tv-focus";
import { Check } from "lucide-react";
import type { ThemeLayout } from "@/lib/theme";

/*
  What used to be a list of layouts.

  Every alternative chrome shipped its own navigation and none of them
  implemented the focus rules the app was rebuilt against, so pressing towards
  the menu did nothing and the viewer was shut inside the content with no way
  back to Settings. They are gone. What is left is the navigation itself, or a
  chrome the viewer writes from scratch and is responsible for.
*/
const CHOICES: { id: ThemeLayout; name: string; blurb: string }[] = [
  { id: "sidebar", name: "Viora navigation", blurb: "The built-in sidebar. Works with the remote." },
  { id: "custom", name: "Custom chrome", blurb: "Your own HTML. You wire up its navigation." },
];

export function ChromeChoice({
  value,
  onChange,
}: {
  value: ThemeLayout;
  onChange: (layout: ThemeLayout) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CHOICES.map((c) => {
        const active = value === c.id;
        return (
          <FocusButton
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`relative flex flex-col items-start gap-1 rounded-xl border p-4 text-start transition-colors ${
              active
                ? "border-accent bg-accent-soft text-ink"
                : "border-edge-soft bg-elevated/40 text-ink-muted hover:text-ink"
            }`}
          >
            {active && (
              <span className="absolute end-3 top-3 text-accent">
                <Check size={16} strokeWidth={2.5} />
              </span>
            )}
            <span className="text-[15px] font-semibold leading-none">{c.name}</span>
            <span className="text-[12.5px] leading-snug text-ink-subtle">{c.blurb}</span>
          </FocusButton>
        );
      })}
    </div>
  );
}
