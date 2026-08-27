import { useState, type InputHTMLAttributes } from "react";
import { FocusButton } from "@/lib/tv-focus";
import { TvTextEntry } from "@/components/tv-text-entry";
import { isDpadPrimary } from "@/lib/platform";

/**
 * A text field that can actually be filled from a sofa.
 *
 * A D-pad produces directions; a text field expects characters. So on a
 * television an `<input>` is reachable and useless — the highlight lands on it,
 * the viewer presses Enter, and nothing happens. That is what made the Live TV
 * provider form impossible to complete: the playlist URL, the server address,
 * the username and the password could all be focused and none could be typed.
 *
 * The settings screen already solved this for API keys, and this is the same
 * answer packaged so the two live forms can use it without repeating the
 * branch: on a remote the control becomes a button that opens the app's own
 * on-screen keyboard, where the realistic route for a long URL is the keyboard's
 * Paste button rather than spelling it out a letter at a time.
 *
 * Everywhere else it stays an ordinary input, so nothing about the desktop or
 * the dev preview changes.
 */
export function TvFieldInput({
  label,
  value,
  onChange,
  onSubmit,
  placeholder,
  password = false,
  className = "",
  ...rest
}: {
  /** Shown as the on-screen keyboard's title, so it says what is being typed. */
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  password?: boolean;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [entryOpen, setEntryOpen] = useState(false);

  if (!isDpadPrimary()) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) onSubmit();
        }}
        placeholder={placeholder}
        type={password ? "password" : "text"}
        spellCheck={false}
        autoComplete="off"
        className={className}
        {...rest}
      />
    );
  }

  const shown = password && value ? "•".repeat(Math.min(value.length, 28)) : value;
  return (
    <>
      <FocusButton
        type="button"
        onClick={() => setEntryOpen(true)}
        // Truncated rather than wrapped: a playlist URL carries a whole query
        // string, and letting it wrap would push the rest of the form down the
        // page every time one was entered.
        className={`${className} flex items-center truncate text-start`}
      >
        {shown || <span className="text-ink-subtle/60">{placeholder}</span>}
      </FocusButton>
      {entryOpen && (
        <TvTextEntry
          title={label}
          initial={value}
          placeholder={placeholder}
          onCommit={(v) => {
            // The value travels with the call rather than being read back from
            // state afterwards — `onChange` only schedules the update, so a
            // caller that saved straight after would store the previous value.
            onChange(v);
            setEntryOpen(false);
          }}
          onClose={() => setEntryOpen(false)}
        />
      )}
    </>
  );
}
