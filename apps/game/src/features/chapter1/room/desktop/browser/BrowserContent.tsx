// The parts of the in-game browser that do not depend on the device: how a page loads and which page
// an address shows. The laptop browser and the phone browser both use them, so there is one set of
// virtual websites, one router and one loading behavior (`sites.ts`, `browserState.ts`); only the
// window around the page differs (tabs and toolbar on the laptop, an address bar and a bottom bar
// on the phone). Nothing here fetches an address or contacts a real site.
import React, { useEffect } from "react";
import type { DeviceActionView, DeviceItemView, DeviceView } from "../../../../../game/narrative/device";
import { hostOf, isWebPageItem } from "../mailModel";
import { currentUrl, type BrowserAction, type BrowserState, type BrowserTab } from "./browserState";
import { ErrorPage, HistoryPage, NewTabPage, StaticSitePage } from "./BrowserPages";
import { resolveRoute } from "./sites";
import { canonicalPageUrl } from "./sites";
import { canonicalAddress } from "./urls";
import { ClearanceSite } from "./ueh/ClearanceSite";
import { PortalSite, type PortalFacts } from "./ueh/PortalSite";
import { ParcelSite } from "./ueh/ParcelSite";

/** How long a page takes to load, in milliseconds. 0 shows the page at once. */
export const DEFAULT_LOAD_MS = 420;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Loading: a short progress bar, then the page. The timers belong to one navigation (`loadKey`), so a
 * page that was left behind never finishes loading by mistake.
 */
export function useBrowserLoading(state: BrowserState, dispatch: (action: BrowserAction) => void, loadMs: number): void {
  const loadingKey = state.tabs
    .filter((entry) => entry.status === "loading")
    .map((entry) => `${entry.id}:${entry.loadKey}`)
    .join("|");
  useEffect(() => {
    if (loadingKey === "") return undefined;
    const timers: number[] = [];
    const wait = prefersReducedMotion() ? 0 : loadMs;
    for (const key of loadingKey.split("|")) {
      const tabId = key.slice(0, key.lastIndexOf(":"));
      if (wait <= 0) {
        timers.push(window.setTimeout(() => dispatch({ type: "loaded", tabId }), 0));
      } else {
        timers.push(window.setTimeout(() => dispatch({ type: "progress", tabId, value: 0.35 }), 0));
        timers.push(window.setTimeout(() => dispatch({ type: "progress", tabId, value: 0.75 }), wait * 0.55));
        timers.push(window.setTimeout(() => dispatch({ type: "loaded", tabId }), wait));
      }
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [loadingKey, loadMs, dispatch]);
}

/**
 * The page of the story's payment link offers to save its address as evidence: by choice, never by
 * looking. This finds the game's page item for the address on screen and its `save-address` action.
 */
export function addressSaveAction(view: DeviceView, url: string): { addressItem: DeviceItemView; saveAddress: DeviceActionView } | null {
  const route = resolveRoute(canonicalPageUrl(canonicalAddress(url)));
  const host = route.type === "page" && route.page.kind === "clearance" ? hostOf(route.page.url) : null;
  if (host === null) return null;
  const addressItem = view.apps.mail.find((entry) => isWebPageItem(entry) && (entry.detail ?? "").toLowerCase() === host) ?? null;
  const saveAddress = addressItem?.actions.find((entry) => entry.id === "save-address") ?? null;
  return addressItem !== null && saveAddress !== null ? { addressItem, saveAddress } : null;
}

export interface BrowserPageProps {
  state: BrowserState;
  tab: BrowserTab;
  dispatch: (action: BrowserAction) => void;
  view: DeviceView;
  /** What the portal shows about the story. Read from the game, never written. */
  facts: PortalFacts;
  navigate: (address: string) => void;
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
}

/** The page of the active tab: the page of the story, a plain page, New Tab, History or an error. */
export const BrowserPage: React.FC<BrowserPageProps> = ({ state, tab, dispatch, view, facts, navigate, onOpenItem, onUseItem }) => {
  const route = resolveRoute(currentUrl(tab));
  if (tab.status === "loading") return <div className="min-h-full" data-testid="browser-loading" aria-busy="true" />;
  if (route.type === "internal") {
    return route.id === "newtab" ? (
      <NewTabPage bookmarks={state.bookmarks} history={state.history} onOpen={navigate} />
    ) : (
      <HistoryPage history={state.history} onOpen={navigate} onClear={() => dispatch({ type: "clearHistory" })} />
    );
  }
  if (route.type === "page") {
    const { page } = route;
    if (page.kind === "portal" && page.section) {
      return <PortalSite section={page.section} view={view} facts={facts} go={navigate} onUseItem={onUseItem} />;
    }
    if (page.kind === "clearance" && page.step) {
      return (
        <ClearanceSite
          page={page}
          step={page.step}
          view={view}
          fields={tab.fields}
          setFields={(fields) => dispatch({ type: "setFields", tabId: tab.id, fields })}
          go={navigate}
          onOpenItem={onOpenItem}
          onUseItem={onUseItem}
        />
      );
    }
    if (page.kind === "parcel") {
      return <ParcelSite url={page.url} view={view} onOpenItem={onOpenItem} onUseItem={onUseItem} />;
    }
    return <StaticSitePage page={page} />;
  }
  return <ErrorPage route={route} onRetry={() => dispatch({ type: "reload" })} onHome={() => dispatch({ type: "home" })} />;
};
