import { useEffect, useRef, useState, type ReactNode } from "react";

export function LazyMount({
  children,
  fallback,
  rootMargin = "600px",
  minHeight = 240,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    // Worth knowing: this net fires whatever the observer says, so nothing here
    // is really deferred beyond eight hundred milliseconds — every catalog row
    // on the home, films and series screens mounts regardless of how far down
    // the page it sits. Making it conditional on position is a real saving, but
    // it changes what the remote can reach: a block that has not mounted holds
    // nothing focusable, so Down could find nothing where it used to find a
    // row. That belongs with the navigation rules, and wants measuring on the
    // device rather than a guess from here. The rows themselves now hold back
    // their cards, which is where the weight was.
    const safety = window.setTimeout(() => setShown(true), 800);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, [shown, rootMargin]);

  if (shown) return <>{children}</>;
  return (
    <div ref={ref} style={{ minHeight }} aria-hidden>
      {fallback}
    </div>
  );
}
