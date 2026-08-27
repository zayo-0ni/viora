import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Meta } from "@/lib/cinemeta";

export type ViewSummonable = "home" | "discover" | "queue" | "addons";

export type ContextMenuTarget =
  | { kind: "meta"; meta: Meta }
  | { kind: "view"; view: ViewSummonable; label: string }
  | { kind: "addon"; addonId: string; label: string }
  | { kind: "edit"; element: HTMLElement | null; selection: string }
  | { kind: "backdrop"; metaId: string; url: string }
  | { kind: "subtitle"; label: string; download?: () => void | Promise<unknown> }
  /**
   * A card in Continue Watching. Pressing it now resumes on the source it last
   * played from, so the menu carries what pressing it used to do: opening the
   * title, which is where another source is chosen.
   */
  | { kind: "continue"; label: string; remove?: () => void; openTitle?: () => void };

type Pos = { x: number; y: number };

type CtxValue = {
  state: { target: ContextMenuTarget; pos: Pos } | null;
  open: (e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => void;
  close: () => void;
};

const Ctx = createContext<CtxValue | null>(null);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ target: ContextMenuTarget; pos: Pos } | null>(null);

  const open = useCallback((e: React.MouseEvent | MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault();
    setState({ target, pos: { x: e.clientX, y: e.clientY } });
  }, []);

  const close = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!state) return;
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-viora-player]")) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [state, close]);

  return <Ctx.Provider value={{ state, open, close }}>{children}</Ctx.Provider>;
}

export function useContextMenu(): CtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useContextMenu outside ContextMenuProvider");
  return v;
}
