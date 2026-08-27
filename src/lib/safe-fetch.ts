import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetchImpl } from "@tauri-apps/plugin-http";
import { TrackerBlockedError, isBlockedUrl, noteBlocked } from "./privacy/blocklist";
import { handleLocalAddonRequest, isLocalAddonUrl } from "@/lib/addons/local";
import { isCacheable, isFresh, readCached, writeCached } from "./net-cache";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Torrentio + TorBox sit behind Cloudflare that blocks datacenter IPs, so on web they
// MUST be fetched directly from the browser's residential IP (they set CORS, so it
// works) — proxying them through the VPS gets 403'd. EVERYTHING ELSE routes through the
// VPS /api-proxy: it's required for addons that send no CORS header at all (OpenSubtitles)
// and for the CORS-less debrid REST APIs, and it's fine for the rest (Cinemeta, Comet).
const DIRECT_HOSTS = new Set([
  "torrentio.strem.fun",
  "stremio.torbox.app",
]);

const PROXY_HOSTS = new Set([
  "cinema.albox.co",
  "v3-cinemeta.strem.io",
  "opensubtitles-v3.strem.io",
  "opensubtitles.strem.io",
  "opensubtitles.stremio.homes",
  "api.torbox.app",
  "api.real-debrid.com",
  "api.alldebrid.com",
  "debrid-link.com",
  "www.premiumize.me",
]);

const PROXY_SUFFIXES = [
  ".elfhosted.com",
  ".strem.fun",
  ".strem.io",
  ".stremio.homes",
  ".baby-beamup.club",
  ".workers.dev",
  ".debridio.com",
  ".code.run",
  ".fly.dev",
  ".onrender.com",
  ".vercel.app",
  ".netlify.app",
  ".railway.app",
  ".deno.dev",
];

function rewriteForWeb(url: string, init?: RequestInit): { url: string; init?: RequestInit } {
  if (isTauri) return { url, init };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, init };
  }
  if (DIRECT_HOSTS.has(parsed.hostname)) return { url, init };
  const proxiable =
    PROXY_HOSTS.has(parsed.hostname) || PROXY_SUFFIXES.some((s) => parsed.hostname.endsWith(s));
  if (!proxiable) return { url, init };

  const proxied = `/api-proxy/${parsed.hostname}${parsed.pathname}${parsed.search}`;
  if (!init?.headers) return { url: proxied, init };
  const out = new Headers(init.headers as HeadersInit);
  const auth = out.get("authorization");
  if (auth) {
    out.delete("authorization");
    out.set("x-viora-auth", auth);
  }
  return { url: proxied, init: { ...init, headers: out } };
}

type VioraFetchResponse = {
  status: number;
  ok: boolean;
  body: string;
  contentType: string | null;
};

async function tauriVioraFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {};
  if (init?.headers) {
    const h = new Headers(init.headers as HeadersInit);
    h.forEach((v, k) => {
      headers[k] = v;
    });
  }
  const body =
    typeof init?.body === "string"
      ? init.body
      : init?.body instanceof URLSearchParams
        ? init.body.toString()
        : init?.body
          ? JSON.stringify(init.body)
          : undefined;
  const resp = await invoke<VioraFetchResponse>("harbor_fetch", {
    args: {
      url: input,
      method: init?.method ?? "GET",
      headers,
      body,
      timeoutMs: 30000,
    },
  });
  return new Response(resp.body, {
    status: resp.status,
    headers: resp.contentType ? { "content-type": resp.contentType } : {},
  });
}

/**
 * Which transport a host is served by, once we have found out.
 *
 * Every request used to leave through the native client, and on Android that is
 * the slow way round: `harbor_fetch` hands the whole body back across the IPC
 * bridge as a JSON string, so a 130KB catalogue is serialised, escaped, copied
 * and parsed again. Measured on the device against the same URLs the Movies
 * screen asks for — 130KB each — the page's own fetch took 204-326ms serially
 * and 853ms for three at once, while the bridge took eleven to thirteen
 * seconds. That is the whole of "sections open slowly", and it is why the same
 * build served from a dev server in a browser feels instant: a browser has no
 * bridge to cross.
 *
 * The bridge is still needed. It exists to reach hosts that send no CORS
 * headers, which a page cannot read no matter how fast it is. So the page is
 * tried first for ordinary GETs and the answer is remembered per host: a host
 * that refuses once goes over the bridge from then on, and pays the discovery
 * cost a single time per session.
 */
const transportByHost = new Map<string, "web" | "native">();

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function preferWebTransport(url: string | null): boolean {
  if (!url || !/^https?:/i.test(url)) return false;
  const host = hostOf(url);
  return !!host && transportByHost.get(host) !== "native";
}

function rememberTransport(url: string | null, how: "web" | "native"): void {
  const host = hostOf(url);
  if (host) transportByHost.set(host, how);
}

function isIdempotent(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

export const safeFetch: typeof fetch = (input, init) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : null;
  // Temporary: a window onto what a screen actually asks the network for. The
  // browser's own tools cannot see these — they leave through the native HTTP
  // plugin, not the WebView — so the only place to count them is here.
  if (typeof window !== "undefined") {
    const w = window as unknown as { __FETCHLOG?: Array<Record<string, unknown>> };
    if (w.__FETCHLOG) {
      const t0 = performance.now();
      const entry: Record<string, unknown> = { url: String(target ?? input).slice(0, 70), start: Math.round(t0), ms: -1 };
      w.__FETCHLOG.push(entry);
      return safeFetchInner(input, init).then(
        (r) => { entry.ms = Math.round(performance.now() - t0); entry.status = r.status; return r; },
        (e) => { entry.ms = Math.round(performance.now() - t0); entry.status = "ERR"; throw e; },
      );
    }
  }
  return safeFetchCached(input, init);
};

/**
 * Answers the app already has, before the network is troubled at all.
 *
 * A catalogue that was fetched a couple of hours ago is served from disk and no
 * request is made — which is the point, and the difference from an ordinary
 * cache that revalidates. Opening the app twice in an evening should not cost
 * twice the data or twice the wait. Once a stored answer is older than a few
 * hours it is ignored and the network answers as usual, so the viewer is never
 * more than that behind.
 *
 * Only catalogue and metadata addresses take part; anything carrying a token or
 * a viewer's own list goes straight through.
 */
const safeFetchCached: typeof fetch = async (input, init) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : null;
  const method = (init?.method ?? "GET").toUpperCase();
  if (!target || method !== "GET" || !isCacheable(target)) return safeFetchInner(input, init);

  try {
    const entry = await readCached(target);
    if (entry) {
      // Anything stored is served, however old. Nothing is ever thrown away for
      // age — the whole library measured 4.8 MB against a 10 GB allowance — so
      // the app opens on what it already knows, every time, without waiting.
      //
      // If that copy is a few hours old the network is asked as well, quietly,
      // and what comes back replaces it. New titles appear, ones that have gone
      // stop being asked for, and the viewer waited for none of it.
      if (!isFresh(entry)) {
        safeFetchInner(input, init)
          .then((r) => {
            if (!r.ok) return;
            return r
              .clone()
              .text()
              .then((body) =>
                writeCached(target, body, r.headers.get("content-type") ?? "application/json"),
              );
          })
          .catch(() => {});
      }
      return new Response(entry.body, {
        status: 200,
        headers: { "content-type": entry.contentType || "application/json" },
      });
    }
  } catch {
    // Nothing stored, or the store would not open. Ask the network.
  }

  const res = await safeFetchInner(input, init);
  if (res.ok) {
    // Read from a copy: the caller still gets an untouched, unread body.
    res
      .clone()
      .text()
      .then((body) => writeCached(target, body, res.headers.get("content-type") ?? "application/json"))
      .catch(() => {});
  }
  return res;
};

const safeFetchInner: typeof fetch = (input, init) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : null;
  // Built-in addons are served in-process. Routing them here means the rest of
  // the app addresses them with an ordinary transport URL and never has to know
  // the difference.
  if (target && isLocalAddonUrl(target)) {
    return handleLocalAddonRequest(target, init?.signal ?? undefined);
  }
  if (target && isBlockedUrl(target)) {
    noteBlocked();
    let host = target;
    try {
      host = new URL(target).hostname;
    } catch {}
    return Promise.reject(new TrackerBlockedError(host));
  }
  if (isTauri) {
    if (typeof input === "string") {
      if (isIdempotent(init?.method)) {
        if (preferWebTransport(target)) {
          return fetch(input, init)
            .then((r) => {
              rememberTransport(target, "web");
              return r;
            })
            .catch(() => {
              // Blocked or unreachable from the page: this host needs the native
              // client, and now we know for the rest of the session.
              rememberTransport(target, "native");
              return tauriVioraFetch(input, init).catch(
                () => tauriFetchImpl(input as string, init as RequestInit) as Promise<Response>,
              );
            });
        }
        return tauriVioraFetch(input, init).catch(
          () => tauriFetchImpl(input as string, init as RequestInit) as Promise<Response>,
        );
      }
      return tauriVioraFetch(input, init);
    }
    return tauriFetchImpl(input as unknown as string, init as RequestInit) as Promise<Response>;
  }
  if (typeof input === "string") {
    const r = rewriteForWeb(input, init);
    return fetch(r.url, r.init);
  }
  return fetch(input, init);
};
