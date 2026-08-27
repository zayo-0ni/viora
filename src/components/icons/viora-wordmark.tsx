import { VioraMark } from "@/components/icons/viora-mark";
import { APP_AUTHOR, APP_NAME } from "@/lib/brand";

/**
 * Full lockup: the mark, the product name, and the author signature beneath it.
 *
 * The signature is drawn in the bundled script face rather than the CSS
 * `cursive` keyword — `cursive` resolves to Comic Sans on Windows and to a
 * plain sans on most Android builds, so it would not be cursive at all where it
 * matters. Shipping the font guarantees the same look on a phone, a TV box and
 * the desktop app.
 */
export function VioraWordmark({
  className,
  markClassName,
  showSignature = true,
}: {
  className?: string;
  markClassName?: string;
  showSignature?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <VioraMark className={markClassName ?? "h-9 w-9"} />
      <span className="flex flex-col leading-none">
        <span
          className="text-[26px] font-semibold tracking-tight text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {APP_NAME}
        </span>
        {showSignature && <VioraSignature />}
      </span>
    </span>
  );
}

/** The author byline on its own, for places that already show the name. */
export function VioraSignature({ className }: { className?: string }) {
  if (!APP_AUTHOR) return null;
  return (
    <span
      className={`select-none text-[13px] leading-none text-ink-subtle ${className ?? ""}`}
      style={{ fontFamily: "var(--font-signature)" }}
    >
      {APP_AUTHOR}
    </span>
  );
}
