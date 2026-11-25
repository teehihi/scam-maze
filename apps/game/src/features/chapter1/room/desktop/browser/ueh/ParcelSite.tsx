// Mission 02's redelivery page, as the browser shows it.
//
// It is deliberately NOT the clearance site: that one is a stepper (notice -> login -> payment ->
// verify) because the story it belongs to is a fake student portal. This page is one form that asks
// a recipient for their student number and card, and then offers a fee. The order is the tell.
//
// Like every site in this browser, nothing is loaded from the Internet: it renders the story's own
// device item (`page.parcel`), and all it can do is press that item's actions.
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { DeviceActionView, DeviceItemView, DeviceView } from "../../../../../../game/narrative/device";
import { PARCEL_CONFIG } from "../../../../../../game/narrative/chapter1/parcel";
import { useGameLocale } from "../../../../../../i18n/useGameLocale";
import { formatAmount, type Tx } from "../../../../device/deviceFormat";
import { hostOf, isWebPageItem, linksOf } from "../../mailModel";
import { Notice } from "../BrowserPages";
import { canonicalPageUrl, urlOfPage } from "../sites";
import { canonicalAddress } from "../urls";
import { Card, SITE_FOCUS, siteButtonClass } from "./siteUi";
import { CLEARANCE_COLORS as C } from "./uehTheme";

export interface ParcelSiteProps {
  url: string;
  view: DeviceView;
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
}

export const ParcelSite: React.FC<ParcelSiteProps> = ({ url, view, onOpenItem, onUseItem }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();

  const host = hostOf(url);
  const item: DeviceItemView | null =
    view.apps.mail.find((entry) => isWebPageItem(entry) && (entry.detail ?? "").toLowerCase() === host) ?? null;

  // The mail that links here. Following its link is the story's "open the page" step and costs a
  // minute; nothing else happens, so the page does it once, by itself.
  const source = view.apps.mail.find(
    (entry) =>
      !isWebPageItem(entry) &&
      linksOf(entry.body).some((link) => canonicalPageUrl(canonicalAddress(link)) === urlOfPage("parcel")) &&
      entry.actions.some((action) => action.id === "open-link"),
  );
  const loadAction = source?.actions.find((action) => action.id === "open-link" && action.available) ?? null;
  const requested = useRef(false);
  const onUseRef = useRef(onUseItem);
  onUseRef.current = onUseItem;
  useEffect(() => {
    if (item === null && source !== undefined && loadAction !== null && !requested.current) {
      requested.current = true;
      onUseRef.current(source.id, loadAction.id);
    }
  }, [item, source, loadAction]);

  // Seeing the page marks it read, like any opened item.
  const itemId = item?.id ?? null;
  const itemRead = item?.read ?? true;
  const onOpenRef = useRef(onOpenItem);
  onOpenRef.current = onOpenItem;
  useEffect(() => {
    if (itemId !== null && !itemRead) onOpenRef.current(itemId);
  }, [itemId, itemRead]);

  if (item === null) {
    if (source !== undefined && loadAction !== null) {
      return <div className="min-h-full" style={{ background: C.page }} aria-busy="true" data-testid="parcel-opening" />;
    }
    return (
      <Notice
        testId="browser-unavailable"
        icon="alert"
        title={t("laptop.browser.unavailable.title")}
        body={t("laptop.browser.unavailable.body")}
      />
    );
  }

  const action = (id: string): DeviceActionView | null => item.actions.find((entry) => entry.id === id) ?? null;
  const enter = action("enter-details");
  const pay = action("pay-fee");
  const typed = enter === null || enter.blocked === "done";
  const paid = pay?.blocked === "done";
  const fee = formatAmount(locale, PARCEL_CONFIG.redeliveryFeeVnd);
  const blocked = (entry: DeviceActionView | null): string | null =>
    entry !== null && entry.blocked !== null && entry.blocked !== "done" ? t(`device.blocked.${entry.blocked}`) : null;
  const press = (entry: DeviceActionView | null): void => {
    if (entry !== null && entry.available) onUseItem(item.id, entry.id);
  };

  const button = (entry: DeviceActionView, testId: string): React.ReactNode => (
    <button
      type="button"
      data-testid={testId}
      className={`mt-3 w-full rounded-md px-4 py-2.5 text-sm font-semibold ${siteButtonClass("primary")} ${SITE_FOCUS}`}
      disabled={!entry.available}
      aria-disabled={!entry.available}
      onClick={() => press(entry)}
    >
      {entry.label}
    </button>
  );

  return (
    <div className="min-h-full" style={{ background: C.page, color: C.ink }}>
      <div className="mx-auto max-w-xl px-6 py-8" data-testid="browser-site-parcel">
        <p className="text-xs uppercase tracking-wide" style={{ color: C.muted }} data-testid="parcel-host">
          {host}
        </p>
        <h2 className="mt-1 break-words text-2xl font-bold" data-testid="parcel-heading">
          {t("ueh.parcel.heading")}
        </h2>
        <p className="mt-3 break-words text-sm leading-relaxed" data-testid="parcel-body">
          {t("ueh.parcel.body", { fee })}
        </p>

        <Card colors={C} title={t("ueh.parcel.recipient")} className="mt-5">
          {/* The details are asked for BEFORE the fee. The page never says why that is worth noticing. */}
          {enter !== null && !typed && button(enter, "parcel-enter")}
          {enter !== null && !typed && blocked(enter) !== null && (
            <p className="mt-2 text-xs" style={{ color: C.muted }} data-testid="parcel-enter-blocked">
              {blocked(enter)}
            </p>
          )}
          {typed && (
            <p className="mt-1 text-sm" data-testid="parcel-recipient-confirmed">
              {t("ueh.parcel.confirmed")}
            </p>
          )}
        </Card>

        <Card colors={C} title={t("ueh.parcel.feeLabel", { fee })} className="mt-4">
          {pay !== null && !paid && button(pay, "parcel-pay")}
          {pay !== null && blocked(pay) !== null && (
            <p className="mt-2 text-xs" style={{ color: C.muted }} data-testid="parcel-pay-blocked">
              {blocked(pay)}
            </p>
          )}
          {paid && (
            <p className="mt-1 text-sm" data-testid="parcel-paid">
              {t("ueh.parcel.paid")}
            </p>
          )}
        </Card>

        <p className="mt-6 text-xs leading-relaxed" style={{ color: C.muted }} data-testid="parcel-disclaimer">
          {t("ueh.parcel.disclaimer")}
        </p>
      </div>
    </div>
  );
};
