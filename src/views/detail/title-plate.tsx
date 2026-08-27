import { useEffect, useRef, useState } from "react";

function LogoLayer({
  url,
  title,
  onReady,
  onFailed,
}: {
  url: string;
  title: string;
  onReady: () => void;
  onFailed: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const done = () => {
    setLoaded(true);
    onReady();
  };
  return (
    <img
      src={url}
      alt={title}
      decoding="async"
      ref={(el) => {
        if (el?.complete && el.naturalWidth > 0) done();
      }}
      onLoad={done}
      onError={onFailed}
      className={`absolute bottom-0 start-0 max-h-[124px] w-auto max-w-[440px] object-contain object-left rtl:object-right drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  );
}

export function TitlePlate({ title, logo, loading }: { title: string; logo?: string; loading: boolean }) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const active = logo && !failed.has(logo) ? logo : undefined;
  const [layers, setLayers] = useState<{ id: number; url: string }[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (!active) {
      setLayers((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setLayers((prev) =>
      prev[prev.length - 1]?.url === active ? prev : [...prev, { id: nextId.current++, url: active }],
    );
  }, [active]);

  const settle = (id: number) =>
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      return idx > 0 ? prev.slice(idx) : prev;
    });

  const hasLogo = layers.length > 0;

  // The name is known the moment the page opens — it came with the card the
  // viewer pressed — so there is no reason to hold an empty box while the rest
  // of the details are fetched. Measured on the television, some of those
  // requests take close to three seconds, and for all of it the artwork was up
  // and the space where the title belongs was blank.
  //
  // Only a page that genuinely has no name yet waits. Everything else prints
  // the name immediately, and the crossfade below already handles the moment
  // the logo arrives and takes its place.
  if (loading && !hasLogo && !title) return <div className="min-h-[120px]" />;

  return (
    <div className="relative flex min-h-[120px] flex-col justify-end">
      <h1
        className={`font-display text-[80px] font-medium leading-[0.95] tracking-tight text-ink transition-opacity duration-500 ${hasLogo ? "opacity-0" : "opacity-100"}`}
      >
        {title}
      </h1>
      {layers.map((l) => (
        <LogoLayer
          key={l.id}
          url={l.url}
          title={title}
          onReady={() => settle(l.id)}
          onFailed={() => {
            setFailed((s) => new Set(s).add(l.url));
            setLayers((prev) => prev.filter((x) => x.id !== l.id));
          }}
        />
      ))}
    </div>
  );
}
