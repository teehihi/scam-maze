// One generic app for the phone and the laptop. Every app (mail, chats, contacts, bank, map,
// calendar, housing, jobs, files) is a list of items from the shared device state, a detail view
// with its actions, and a small header with the facts that app owns. Opening an item and using an
// action are core actions, so they cost time and cash and can change events, missions and
// persistent state. The views state facts and costs only: no item or action is marked as safe,
// unsafe, good or bad, and addresses are plain text, never links.
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceAppId } from "../../../game/narrative/types";
import type { DeviceItemView, DeviceView } from "../../../game/narrative/device";
import { useGameLocale } from "../../../i18n/useGameLocale";
import { UI } from "../theme";
import { actionLabel, formatAmount, formatSpan, formatWhen, type Tx } from "./deviceFormat";
import { ConversationHistory } from "./ConversationHistory";
import { PlatformFigures } from "./PlatformFigures";

export interface DeviceAppProps {
  app: DeviceAppId;
  view: DeviceView;
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
  /**
   * Tells which list is on screen (the app and the ids of its items), and null when the list is
   * closed (an item is open or the app is left). The voice of Alex reacts to what the player sees.
   */
  onView?: (view: { app: DeviceAppId; itemIds: readonly string[] } | null) => void;
  /** Shows the app without its header (the contacts section of the calls app). */
  embedded?: boolean;
  /** Adds a Back button to the list that leaves the app (the phone returns to its home screen). */
  onExit?: () => void;
  /**
   * The open item and the mail folder, held by the parent so they survive leaving the app. With
   * `onSelect` set the open item is controlled; with `onFolder` set the folder is controlled.
   */
  selectedId?: string | null;
  onSelect?: (itemId: string | null) => void;
  folderId?: string;
  onFolder?: (folder: string) => void;
}

const ROW =
  "flex w-full items-start gap-3 rounded-xl border border-[#38344f] bg-[#171521] px-3 py-2.5 text-left text-sm text-[#f7f5ff] motion-safe:transition-colors hover:border-[#7654d6] hover:bg-[#26233a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] cursor-pointer";
const KNOWN_FOLDERS = ["university", "recruitment", "other"] as const;

function folderLabel(t: Tx, folder: string): string {
  return (KNOWN_FOLDERS as readonly string[]).includes(folder) ? t(`device.folders.${folder}`) : folder;
}

const Header: React.FC<{ app: DeviceAppId; view: DeviceView; t: Tx; locale: string }> = ({ app, view, t, locale }) => {
  if (app === "bank") {
    return (
      <section className={UI.card} data-testid="bank-header" aria-label={t("device.apps.bank")}>
        <p className={UI.label}>{t("device.bank.balance")}</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-[#f7f5ff]" data-testid="bank-balance">
          {t("device.bank.balanceValue", { amount: formatAmount(locale, view.bank.balance) })}
        </p>
        <p className={`${UI.body} mt-1`}>{t("device.bank.security", { value: view.bank.digitalSecurity })}</p>
        {(view.bank.finance.debt > 0 || view.bank.finance.lockedFunds > 0 || view.bank.finance.financialLoss > 0 || view.bank.finance.displayedProfit > 0) && (
          <dl className="mt-3 space-y-1" data-testid="bank-finance">
            {(
              [
                ["debt", view.bank.finance.debt],
                ["lockedFunds", view.bank.finance.lockedFunds],
                ["financialLoss", view.bank.finance.financialLoss],
                ["displayedProfit", view.bank.finance.displayedProfit],
              ] as const
            )
              .filter(([, amount]) => amount > 0)
              .map(([key, amount]) => (
                <div key={key} className="flex items-start justify-between gap-3" data-testid={`bank-finance-${key}`}>
                  <dt className="text-xs text-[#a9a4c4]">{t(`device.bank.finance.${key}`)}</dt>
                  <dd className="shrink-0 text-sm font-semibold tabular-nums text-[#f7f5ff]">{t("device.amount", { amount: formatAmount(locale, amount) })}</dd>
                </div>
              ))}
          </dl>
        )}
      </section>
    );
  }
  if (app === "calendar") {
    return (
      <section className={UI.card} data-testid="calendar-header" aria-label={t("device.apps.calendar")}>
        <p className="text-sm font-semibold text-[#f7f5ff]">{t("device.calendar.deadline")}</p>
        <p className={`${UI.body} mt-1`} data-testid="calendar-time-left">
          {t("device.calendar.timeLeft", { time: formatSpan(t, view.calendar.minutesLeft) })}
        </p>
        <p className={UI.body}>{t("device.calendar.thesis", { value: view.calendar.thesisProgress })}</p>
        <p className={UI.body} data-testid="calendar-submission">
          {t("device.calendar.submission", { status: t(`device.calendar.status.${view.calendar.submission}`) })}
        </p>
      </section>
    );
  }
  if (app === "map") {
    const place = view.apps.map.find((item) => item.id === view.map.location);
    return (
      <section className={UI.card} data-testid="map-header" aria-label={t("device.apps.map")}>
        <p className="text-sm text-[#f7f5ff]" data-testid="map-location">
          {view.map.location === null ? t("device.map.nowhere") : t("device.map.here", { place: place?.title ?? view.map.location })}
        </p>
      </section>
    );
  }
  if (app === "files") {
    return (
      <section className={UI.card} data-testid="files-header" aria-label={t("device.apps.files")}>
        <p className={UI.label}>{t("device.files.backup")}</p>
        <p className={`${UI.body} mt-1`} data-testid="files-backup">
          {view.files.backupSecured ? t("device.files.backupYes") : t("device.files.backupNo")}
        </p>
        <p className={`${UI.label} mt-3`}>{t("device.files.evidence")}</p>
        <p className={`${UI.body} mt-1`}>{t("device.files.evidenceValue", { value: view.files.evidenceCount })}</p>
        {view.files.evidenceTitles.length === 0 ? (
          <p className={UI.body}>{t("device.files.noEvidence")}</p>
        ) : (
          <ul className="mt-1 list-disc pl-5 text-sm text-[#f7f5ff]" data-testid="files-evidence">
            {view.files.evidenceTitles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  return null;
};

const Ledger: React.FC<{ view: DeviceView; t: Tx; locale: string }> = ({ view, t, locale }) => (
  <section aria-labelledby="ledger-heading" data-testid="bank-ledger">
    <h3 id="ledger-heading" className={UI.label}>
      {t("device.bank.ledger")}
    </h3>
    {view.bank.ledger.length === 0 ? (
      <p className={`${UI.body} mt-2`}>{t("device.bank.noTransactions")}</p>
    ) : (
      <ul className="mt-2 space-y-2">
        {view.bank.ledger.map((entry) => (
          <li key={entry.seq} className={`${UI.card} flex items-start justify-between gap-3`} data-testid="ledger-entry">
            <span className="min-w-0">
              <span className="block text-sm text-[#f7f5ff]">{entry.label}</span>
              <span className="block text-xs text-[#a9a4c4]">
                {entry.counterparty === null ? formatWhen(t, entry.atMinute) : `${entry.counterparty} · ${formatWhen(t, entry.atMinute)}`}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-[#f7f5ff]">
              {entry.amount < 0 ? "-" : "+"}
              {t("device.amount", { amount: formatAmount(locale, Math.abs(entry.amount)) })}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const DeviceApp: React.FC<DeviceAppProps> = ({
  app,
  view,
  onOpenItem,
  onUseItem,
  onView,
  embedded = false,
  onExit,
  selectedId,
  onSelect,
  folderId,
  onFolder,
}) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const items = view.apps[app];
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [localFolder, setLocalFolder] = useState<string>("all");
  const selected = onSelect ? (selectedId ?? null) : localSelected;
  const setSelected = onSelect ?? setLocalSelected;
  const folder = onFolder ? (folderId ?? "all") : localFolder;
  const setFolder = onFolder ?? setLocalFolder;
  const folders = app === "mail" ? Array.from(new Set(items.flatMap((item) => (item.folder === null ? [] : [item.folder])))) : [];
  const shown = folder === "all" ? items : items.filter((item) => item.folder === folder);
  const current = selected === null ? null : (items.find((item) => item.id === selected) ?? null);
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  const listIds = current === null ? shown.map((item) => item.id).join("|") : null;
  useEffect(() => {
    if (listIds === null) return undefined;
    onViewRef.current?.({ app, itemIds: listIds === "" ? [] : listIds.split("|") });
    return () => onViewRef.current?.(null);
  }, [app, listIds]);

  const open = (item: DeviceItemView) => {
    setSelected(item.id);
    if (!item.read) onOpenItem(item.id);
  };

  const meta = (item: DeviceItemView): string | null => {
    if (item.startsAtMinute !== null) {
      const start = formatWhen(t, item.startsAtMinute);
      const status =
        view.calendar.now < item.startsAtMinute
          ? t("device.calendar.upcoming")
          : item.endsAtMinute !== null && view.calendar.now >= item.endsAtMinute
            ? t("device.calendar.past")
            : t("device.calendar.happeningNow");
      return item.endsAtMinute === null ? `${status} · ${start}` : `${status} · ${t("device.range", { start, end: formatWhen(t, item.endsAtMinute) })}`;
    }
    if (item.amount !== null) return t("device.amount", { amount: formatAmount(locale, item.amount) });
    if (item.from !== null) return t("device.from", { name: item.from });
    return null;
  };

  if (current !== null) {
    return (
      <article className="space-y-3" data-testid={`device-item-${current.id}`}>
        <button type="button" className={UI.buttonSecondary} onClick={() => setSelected(null)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t("device.back")}</span>
        </button>
        <header>
          <h3 className={UI.heading}>{current.title}</h3>
          {meta(current) && <p className="mt-1 text-xs text-[#a9a4c4]">{meta(current)}</p>}
          {current.detail && <p className="mt-1 text-xs text-[#a9a4c4]">{current.detail}</p>}
        </header>
        <p className={`${UI.body} whitespace-pre-line text-[#f7f5ff]`}>{current.body}</p>
        {current.figures !== null && <PlatformFigures figures={current.figures} />}
        {current.conversation.length > 0 && <ConversationHistory lines={current.conversation} otherName={current.title} />}
        {current.actions.length > 0 && (
          <ul className="space-y-2">
            {current.actions.map((action) => (
              <li key={action.id} className="space-y-1">
                <button
                  type="button"
                  className={UI.buttonPrimary}
                  disabled={!action.available}
                  aria-describedby={action.blocked === null ? undefined : `blocked-${current.id}-${action.id}`}
                  data-testid={`device-action-${current.id}-${action.id}`}
                  onClick={() => onUseItem(current.id, action.id)}
                >
                  {actionLabel(t, locale, action)}
                </button>
                {action.blocked !== null && (
                  <p id={`blocked-${current.id}-${action.id}`} className="text-xs text-[#a9a4c4]">
                    {t(`device.blocked.${action.blocked}`)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>
    );
  }

  return (
    <div className="space-y-4" data-testid={`device-app-${app}`}>
      {onExit && (
        <button type="button" className={UI.buttonSecondary} onClick={onExit}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t("device.back")}</span>
        </button>
      )}
      {!embedded && <Header app={app} view={view} t={t} locale={locale} />}
      {folders.length > 0 && (
        <div role="group" aria-label={t("device.apps.mail")} className="flex flex-wrap gap-2">
          {["all", ...folders].map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={folder === name}
              className={UI.buttonSecondary}
              onClick={() => setFolder(name)}
            >
              {name === "all" ? t("device.folders.all") : folderLabel(t, name)}
            </button>
          ))}
        </div>
      )}
      {app === "bank" && items.length > 0 && <h3 className={UI.label}>{t("device.bank.payees")}</h3>}
      {app === "map" && items.length > 0 && <h3 className={UI.label}>{t("device.map.places")}</h3>}
      {shown.length === 0 && app !== "bank" ? (
        <p className={UI.body}>{t("device.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((item) => (
            <li key={item.id}>
              <button type="button" className={ROW} onClick={() => open(item)} data-testid={`device-row-${item.id}`}>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${item.read || !item.tracksUnread ? "font-medium" : "font-bold"}`}>{item.title}</span>
                  {meta(item) && <span className="block text-xs text-[#a9a4c4]">{meta(item)}</span>}
                </span>
                {!item.read && item.tracksUnread && (
                  <>
                    <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#b9a5f5]" />
                    <span className="sr-only">{t("device.unreadMark")}</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {app === "bank" && !embedded && <Ledger view={view} t={t} locale={locale} />}
    </div>
  );
};
