// Banking app of the laptop desktop: a light emerald-and-white fintech look. An overview with the
// balance and the finance summary, the transaction list with a detail view for each line, security
// settings, and the support steps for reporting to the bank.
//
// Every figure comes from the game: the balance and the ledger from the finance model, the blocked
// transfers from the scenario (shown only after the bank blocked them). Looking at a transaction
// changes nothing. Saving a record as evidence, calling the bank, reporting and changing passwords
// are the story's own device actions, each a separate button with its time cost shown, so no single
// button settles a case: the player finds the transaction, reads it, compares it with the messages,
// and then decides to contact the official line. The app never calls a transaction "fraud": it says
// what happened, when, how much and to whom.
import React, { useRef, useState } from "react";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Ban, Check, FileText, Landmark, LifeBuoy, ListChecks, Lock, PhoneCall, ShieldCheck, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BlockedTransfer } from "../../../../../game/narrative/blocked";
import type { DeviceActionView, DeviceItemView, DeviceView } from "../../../../../game/narrative/device";
import { useGameLocale } from "../../../../../i18n/useGameLocale";
import { actionLabel, formatAmount, formatWhen, type Tx } from "../../../device/deviceFormat";
import { useDesktopNav } from "../desktopNav";
import { themeFor } from "../desktopTheme";
import { useIsWide } from "../useContainerWidth";
import { buildTransactions, excerpt, filterTransactions, type BankTx, type TxStatus } from "./bankModel";

export interface BankFacts {
  /** The player reported to the bank and it blocked outgoing transfers. */
  bankReported: boolean;
  /** An account was taken over and not recovered yet. */
  accountCompromised: boolean;
}

export interface BankingAppProps {
  /** The laptop's view: the ledger, the finance summary, mail and files. */
  view: DeviceView;
  /** The phone's view: the bank's alerts and the saved contacts. */
  phoneView: DeviceView;
  blocked: readonly BlockedTransfer[];
  facts: BankFacts;
  onUseItem: (itemId: string, actionId: string) => void;
  /**
   * The phone's version: sections in a bar at the bottom, larger touch targets, and no call steps on
   * the support page. The calls are placed from the phone's Contacts (`onCallBank` opens the official
   * contact), so a call has one place in the game, not two. Everything else is the same app.
   */
  variant?: "desktop" | "mobile";
  onCallBank?: () => void;
}

const EM = "#0a7d5a";
const EM_DARK = "#075c43";
const EM_SOFT = "#e6f6ef";
const INK = "#0f2a22";
const MUTED = "#4f6a60";
const LINE = "#d4e6de";
const SURFACE = "#f5faf8";
const NOTICE = "#5b3fb0";
const NOTICE_SOFT = "#efeaff";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a7d5a]";
const BUTTON = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0a7d5a] px-4 py-2 text-sm font-semibold text-white motion-safe:transition-colors hover:bg-[#075c43] disabled:cursor-not-allowed disabled:bg-[#c3d9cf] disabled:text-[#5f7a6f] ${FOCUS}`;
const BUTTON_QUIET = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#bcd8cc] bg-white px-3 py-1.5 text-sm font-medium text-[#0f2a22] motion-safe:transition-colors hover:bg-[#eef7f3] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

type Section = "overview" | "transactions" | "security" | "support";
const SECTIONS: readonly { id: Section; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }> }[] = [
  { id: "overview", icon: Wallet },
  { id: "transactions", icon: ListChecks },
  { id: "security", icon: Lock },
  { id: "support", icon: LifeBuoy },
];

const FINANCE_KEYS = ["lockedFunds", "debt", "financialLoss", "displayedProfit"] as const;

const Card: React.FC<{ title?: string; icon?: React.ReactNode; testId?: string; tone?: "plain" | "soft"; className?: string; children: React.ReactNode }> = ({
  title,
  icon,
  testId,
  tone = "plain",
  className = "",
  children,
}) => (
  <section
    data-testid={testId}
    className={`rounded-xl border p-4 ${className}`}
    style={{ background: tone === "soft" ? EM_SOFT : "#ffffff", borderColor: LINE, boxShadow: "0 1px 2px rgba(15,42,34,0.05)" }}
  >
    {title && (
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: EM_DARK }}>
        {icon}
        {title}
      </h3>
    )}
    {children}
  </section>
);

export const BankingApp: React.FC<BankingAppProps> = ({ view, phoneView, blocked, facts, onUseItem, variant = "desktop", onCallBank }) => {
  const mobile = variant === "mobile";
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const nav = useDesktopNav();
  const theme = themeFor("device-bank");
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useIsWide(rootRef, 640);

  const [section, setSection] = useState<Section>("overview");
  const [filter, setFilter] = useState<"all" | TxStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);

  // The records the player may compare a transaction with, from both devices.
  const items = new Map<string, DeviceItemView>();
  for (const source of [view, phoneView]) for (const list of Object.values(source.apps)) for (const item of list) if (!items.has(item.id)) items.set(item.id, item);
  const statement = items.get("bank.statement") ?? null;

  const transactions = buildTransactions(view.bank.ledger, blocked);
  const shown = filterTransactions(transactions, filter);
  const selected = transactions.find((tx) => tx.id === selectedId) ?? null;
  const money = (amount: number) => t("device.amount", { amount: formatAmount(locale, Math.abs(amount)) });
  const signed = (tx: BankTx) => `${tx.amount < 0 ? "\u2212" : "+"}${money(tx.amount)}`;

  const bankLine = items.get("contact.bank") ?? null;
  const training = items.get("contact.training-office") ?? null;
  const alerts = phoneView.apps.messages.filter((message) => message.id.startsWith("msg.bank-alert"));
  const reportFile = items.get("file.bank-report") ?? null;

  const statusChip = (status: TxStatus) => (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={status === "completed" ? { background: EM_SOFT, color: EM_DARK } : { background: NOTICE_SOFT, color: NOTICE }}
      data-testid={`bank-status-${status}`}
    >
      {status === "completed" ? <Check className="h-3 w-3" aria-hidden="true" /> : <Ban className="h-3 w-3" aria-hidden="true" />}
      {t(`banking.status.${status}`)}
    </span>
  );

  const openTx = (id: string) => {
    setSection("transactions");
    setSelectedId(id);
  };

  // --- Overview ------------------------------------------------------------------------------
  const finance = view.bank.finance;
  const overview = (
    <div className="space-y-4" data-testid="bank-overview">
      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(120deg, ${EM_DARK}, ${EM})` }}>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{t("banking.available")}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums" data-testid="bank-balance">
          {money(view.bank.balance)}
        </p>
        <p className="mt-1 text-xs text-white/80">{t("banking.accountName")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FINANCE_KEYS.filter((key) => finance[key] > 0).map((key) => (
          <Card key={key} testId={`bank-finance-${key}`}>
            <p className="text-xs" style={{ color: MUTED }}>
              {t(`device.bank.finance.${key}`)}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: INK }}>
              {money(finance[key])}
            </p>
            {key === "displayedProfit" && (
              <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
                {t("banking.profitNote")}
              </p>
            )}
          </Card>
        ))}
        <Card title={t("banking.accountStatus")} icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} tone={facts.bankReported ? "soft" : "plain"} testId="bank-account-status">
          <p className="text-sm font-semibold" style={{ color: INK }} data-testid="bank-account-state">
            {facts.bankReported ? t("banking.stateBlocked") : t("banking.stateNormal")}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
            {facts.bankReported ? t("banking.stateBlockedBody") : t("banking.stateNormalBody")}
          </p>
        </Card>
      </div>
      <Card title={t("banking.recent")} icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}>
        {transactions.length === 0 ? (
          <p className="text-sm" style={{ color: MUTED }} data-testid="bank-recent-empty">
            {t("banking.noTransactions")}
          </p>
        ) : (
          <ul className="space-y-1">
            {transactions.slice(0, 3).map((tx) => (
              <li key={tx.id}>
                <button type="button" className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#eef7f3] ${FOCUS}`} onClick={() => openTx(tx.id)}>
                  <span className="min-w-0 truncate" style={{ color: INK }}>
                    {tx.label}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold" style={{ color: INK }}>
                    {signed(tx)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {alerts.length > 0 && (
        <Card title={t("banking.alerts")} icon={<Landmark className="h-4 w-4" aria-hidden="true" />} testId="bank-alerts">
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={alert.id} className="text-sm" style={{ color: INK }}>
                <span className="block text-xs" style={{ color: MUTED }}>
                  {formatWhen(t, alert.arrivedAtMinute)}
                </span>
                {excerpt(alert.body, 200)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );

  // --- Transactions ----------------------------------------------------------------------------
  const detail = selected !== null && (
    <article className="space-y-3" data-testid="bank-tx-detail" aria-label={t("banking.detail")}>
      {!wide && (
        <button type="button" className={BUTTON_QUIET} onClick={() => setSelectedId(null)} data-testid="bank-tx-back">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("banking.backToList")}
        </button>
      )}
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words text-base font-bold" style={{ color: INK }}>
            {selected.label}
          </h3>
          {statusChip(selected.status)}
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: INK }} data-testid="bank-tx-amount">
          {signed(selected)}
        </p>
      </header>
      <dl className="rounded-xl border px-3" style={{ borderColor: LINE }}>
        {(
          [
            ["time", formatWhen(t, selected.atMinute)],
            ["recipient", selected.counterparty ?? t("banking.notShown")],
            ["type", t(`banking.kind.${selected.kind}`)],
            ["reference", selected.reference],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b py-1.5 last:border-b-0" style={{ borderColor: LINE }}>
            <dt className="text-xs" style={{ color: MUTED }}>
              {t(`banking.field.${key}`)}
            </dt>
            <dd className="min-w-0 break-words text-sm font-medium" style={{ color: INK }} data-testid={`bank-tx-${key}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {selected.status === "blocked" && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: NOTICE_SOFT, color: NOTICE }} data-testid="bank-tx-blocked-note">
          {t("banking.blockedNote")}
        </p>
      )}
      {selected.category === "locked" && (
        <p className="text-xs" style={{ color: MUTED }}>
          {t("banking.lockedNote")}
        </p>
      )}
      {renderRelated(selected)}
      {renderSave(selected)}
      {selected.status === "completed" && selected.amount < 0 && (
        <div>
          {facts.bankReported && selected.transferIndex !== null ? (
            <p className="text-sm font-medium" style={{ color: EM_DARK }} data-testid="bank-tx-reported">
              {t("banking.alreadyReported")}
            </p>
          ) : (
            <button
              type="button"
              className={BUTTON}
              data-testid="bank-tx-report"
              onClick={() => {
                setReporting(selected.id);
                setSection("support");
              }}
            >
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              {t("banking.reportThis")}
            </button>
          )}
        </div>
      )}
    </article>
  );

  function renderRelated(tx: BankTx) {
    const all = items;
    const related = tx.relatedItemIds.map((id) => all.get(id)).filter((item): item is DeviceItemView => item !== undefined);
    const evidence = tx.relatedEvidenceIds.map((id) => all.get(id)).filter((item): item is DeviceItemView => item !== undefined);
    return (
      <>
        <Card title={t("banking.related")} icon={<FileText className="h-4 w-4" aria-hidden="true" />} testId="bank-related">
          {related.length === 0 ? (
            <p className="text-sm" style={{ color: MUTED }} data-testid="bank-related-empty">
              {t("banking.relatedNone")}
            </p>
          ) : (
            <ul className="space-y-3">
              {related.map((item) => (
                <li key={item.id} data-testid={`bank-related-${item.id}`}>
                  <p className="text-sm font-semibold" style={{ color: INK }}>
                    {item.title}
                  </p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    {[item.from, formatWhen(t, item.arrivedAtMinute)].filter(Boolean).join(" | ")}
                  </p>
                  <p className="mt-1 break-words text-sm" style={{ color: INK }}>
                    {excerpt(item.body)}
                  </p>
                  {item.app === "mail" && nav && (
                    <button type="button" className={`${BUTTON_QUIET} mt-2`} onClick={() => nav.openApp("device-mail")} data-testid={`bank-open-mail-${item.id}`}>
                      {t("banking.openMail")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t("banking.evidence")} icon={<Check className="h-4 w-4" aria-hidden="true" />} testId="bank-evidence">
          {evidence.length === 0 ? (
            <p className="text-sm" style={{ color: MUTED }} data-testid="bank-evidence-empty">
              {t("banking.evidenceNone")}
            </p>
          ) : (
            <ul className="space-y-1">
              {evidence.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm" style={{ color: INK }} data-testid={`bank-evidence-${item.id}`}>
                  <Check className="h-3.5 w-3.5 shrink-0" style={{ color: EM }} aria-hidden="true" />
                  <span className="min-w-0 break-words">{item.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  function renderSave(tx: BankTx) {
    const stmt = statement;
    if (tx.saveAction === null || stmt === null) return null;
    const action: DeviceActionView | undefined = stmt.actions.find((entry) => entry.id === tx.saveAction?.actionId);
    if (action === undefined || action.blocked === "done") return null;
    return (
      <div className="space-y-1">
        <button type="button" className={BUTTON_QUIET} disabled={!action.available} data-testid="bank-save-record" onClick={() => onUseItem(stmt.id, action.id)}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          {actionLabel(t, locale, action)}
        </button>
        {action.blocked !== null && (
          <p className="text-xs" style={{ color: MUTED }}>
            {t(`device.blocked.${action.blocked}`)}
          </p>
        )}
      </div>
    );
  }

  const list = (
    <section aria-label={t("banking.transactions")} data-testid="bank-tx-list" className={`min-w-0 space-y-3 ${wide ? "w-[20rem] shrink-0" : ""}`}>
      <div role="group" aria-label={t("banking.filter")} className="flex flex-wrap gap-1.5">
        {(["all", "completed", "blocked"] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            data-testid={`bank-filter-${id}`}
            onClick={() => setFilter(id)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-colors ${FOCUS} ${
              filter === id ? "border-[#0a7d5a] bg-[#0a7d5a] text-white" : "border-[#bcd8cc] bg-white text-[#0f2a22] hover:bg-[#eef7f3]"
            }`}
          >
            {t(`banking.filters.${id}`)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm" style={{ borderColor: LINE, color: MUTED }} data-testid="bank-tx-empty">
          {t("banking.noTransactions")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((tx) => {
            const out = tx.amount < 0;
            const Icon = out ? ArrowUpRight : ArrowDownLeft;
            return (
              <li key={tx.id}>
                <button
                  type="button"
                  data-testid={`bank-tx-${tx.id}`}
                  data-status={tx.status}
                  aria-current={selectedId === tx.id ? "true" : undefined}
                  onClick={() => setSelectedId(tx.id)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left motion-safe:transition-colors hover:bg-[#f0f8f4] ${FOCUS} ${selectedId === tx.id ? "bg-[#e6f6ef]" : "bg-white"}`}
                  style={{ borderColor: selectedId === tx.id ? EM : LINE }}
                >
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: out ? "#f1f3f2" : EM_SOFT, color: out ? INK : EM }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold" style={{ color: INK }}>
                      {tx.label}
                    </span>
                    <span className="block truncate text-xs" style={{ color: MUTED }}>
                      {formatWhen(t, tx.atMinute)}
                      {tx.counterparty ? ` | ${tx.counterparty}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-bold tabular-nums" style={{ color: tx.status === "blocked" ? MUTED : INK, textDecoration: tx.status === "blocked" ? "line-through" : undefined }}>
                      {signed(tx)}
                    </span>
                    {statusChip(tx.status)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const transactionsView = (
    <div className={wide ? "flex gap-4" : ""} data-testid="bank-transactions">
      {(wide || selected === null) && list}
      {(wide || selected !== null) && (
        <div className="min-w-0 flex-1">
          {detail || (
            <p className="rounded-xl border p-6 text-center text-sm" style={{ borderColor: LINE, color: MUTED }} data-testid="bank-tx-select">
              {t("banking.selectPrompt")}
            </p>
          )}
        </div>
      )}
    </div>
  );

  // --- Security --------------------------------------------------------------------------------
  const settings = items.get("settings.security") ?? null;
  const securityView = (
    <div className="space-y-4" data-testid="bank-security">
      <Card title={t("banking.securityLevel")} icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}>
        <p className="text-2xl font-bold tabular-nums" style={{ color: INK }} data-testid="bank-security-level">
          {view.bank.digitalSecurity}%
        </p>
        <div role="progressbar" aria-label={t("banking.securityLevel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.bank.digitalSecurity} className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: EM_SOFT }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, view.bank.digitalSecurity))}%`, background: EM }} />
        </div>
      </Card>
      <Card title={t("banking.settings")} icon={<Lock className="h-4 w-4" aria-hidden="true" />}>
        <p className="text-sm" style={{ color: MUTED }}>
          {t("banking.passwordsNote")}
        </p>
        {settings === null || settings.actions.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: MUTED }}>
            {t("banking.noSettings")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {settings.actions.map((action) => (
              <li key={action.id} className="space-y-1">
                {action.blocked === "done" ? (
                  <p className="flex items-center gap-2 text-sm font-medium" style={{ color: EM_DARK }} data-testid={`bank-setting-done-${action.id}`}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {action.label}
                  </p>
                ) : (
                  <>
                    <button type="button" className={BUTTON} disabled={!action.available} data-testid={`device-action-${settings.id}-${action.id}`} onClick={() => onUseItem(settings.id, action.id)}>
                      {actionLabel(t, locale, action)}
                    </button>
                    {action.blocked !== null && (
                      <p className="text-xs" style={{ color: MUTED }}>
                        {t(`device.blocked.${action.blocked}`)}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );

  // --- Support ---------------------------------------------------------------------------------
  const steps = (["call", "report-fraud", "ask-next"] as const).map((id) => ({ id, action: bankLine?.actions.find((entry) => entry.id === id) ?? null }));
  const reportingTx = reporting === null ? null : (transactions.find((tx) => tx.id === reporting) ?? null);
  const supportView = (
    <div className="space-y-4" data-testid="bank-support">
      {reportingTx && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: EM_SOFT, color: EM_DARK }} data-testid="bank-reporting-context">
          {t("banking.reportingContext", { label: reportingTx.label, amount: money(reportingTx.amount), time: formatWhen(t, reportingTx.atMinute) })}
        </p>
      )}
      <Card title={bankLine?.title ?? t("banking.officialLine")} icon={<PhoneCall className="h-4 w-4" aria-hidden="true" />} testId="bank-official-line">
        <p className="text-lg font-bold tabular-nums" style={{ color: INK }} data-testid="bank-official-number">
          {bankLine?.detail ?? ""}
        </p>
        <p className="text-xs" style={{ color: MUTED }}>
          {bankLine?.body ?? ""}
        </p>
        <p className="mt-2 text-xs" style={{ color: MUTED }}>
          {t("banking.callNote")}
        </p>
      </Card>
      <Card title={t("banking.stepsTitle")} icon={<ListChecks className="h-4 w-4" aria-hidden="true" />} testId="bank-steps">
        <ol className="space-y-3">
          {steps.map(({ id, action }, index) => (
            <li key={id} className="flex items-start gap-3" data-testid={`bank-step-${id}`} data-state={action === null ? "locked" : action.blocked === "done" ? "done" : "open"}>
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: action?.blocked === "done" ? EM : EM_SOFT, color: action?.blocked === "done" ? "#fff" : EM_DARK }}
              >
                {action?.blocked === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: INK }}>
                  {t(`banking.step.${id}`)}
                </p>
                {action === null ? (
                  <p className="text-xs" style={{ color: MUTED }}>
                    {t(id === "call" ? "banking.stepNothingToReport" : "banking.stepAfterPrevious")}
                  </p>
                ) : action.blocked === "done" ? (
                  <p className="text-xs" style={{ color: EM_DARK }}>
                    {t("banking.stepDone")}
                  </p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {mobile ? (
                      <p className="text-xs" style={{ color: MUTED }} data-testid={`bank-step-hint-${action.id}`}>
                        {t("phone.mobileBank.callHint")}
                      </p>
                    ) : (
                      <button type="button" className={BUTTON} disabled={!action.available} data-testid={`device-action-contact.bank-${action.id}`} onClick={() => bankLine && onUseItem(bankLine.id, action.id)}>
                        {actionLabel(t, locale, action)}
                      </button>
                    )}
                    {action.blocked !== null && (
                      <p className="text-xs" style={{ color: MUTED }}>
                        {t(`device.blocked.${action.blocked}`)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>
      {mobile && onCallBank !== undefined && (
        <button type="button" className={`${BUTTON} w-full`} data-testid="bank-call-official" onClick={onCallBank}>
          <PhoneCall className="h-4 w-4" aria-hidden="true" />
          {t("phone.mobileBank.callOfficial")}
        </button>
      )}
      {bankLine !== null && bankLine.conversation.length > 0 && (
        <Card title={t("banking.conversation")} testId="bank-conversation">
          <ul className="space-y-2">
            {bankLine.conversation.map((line) => (
              <li key={line.key} className={`flex ${line.speaker === "alex" ? "justify-end" : "justify-start"}`} data-speaker={line.speaker}>
                <p className="max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm" style={line.speaker === "alex" ? { background: EM, color: "#fff" } : { background: SURFACE, color: INK, border: `1px solid ${LINE}` }}>
                  {line.text}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {facts.bankReported && (
        <Card title={t("banking.resultTitle")} icon={<Check className="h-4 w-4" aria-hidden="true" />} tone="soft" testId="bank-result">
          <p className="text-sm" style={{ color: INK }}>
            {t("banking.resultBody")}
          </p>
          {reportFile !== null && (
            <p className="mt-2 text-xs font-medium" style={{ color: EM_DARK }} data-testid="bank-report-file">
              {reportFile.title}
            </p>
          )}
        </Card>
      )}
      <Card title={t("banking.trusted")} icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} testId="bank-trusted">
        <ul className="space-y-2">
          {[bankLine, training]
            .filter((contact): contact is DeviceItemView => contact !== null)
            .map((contact) => (
              <li key={contact.id}>
                <p className="text-sm font-semibold" style={{ color: INK }}>
                  {contact.title}
                </p>
                <p className="text-sm tabular-nums" style={{ color: INK }} data-testid={`bank-contact-${contact.id}`}>
                  {contact.detail}
                </p>
              </li>
            ))}
        </ul>
        <p className="mt-2 text-xs" style={{ color: MUTED }}>
          {t("banking.trustedNote")}
        </p>
      </Card>
    </div>
  );

  const tabBar = (
    <nav
      role="tablist"
      aria-label={t("banking.sections")}
      className={mobile ? "flex shrink-0 gap-1 border-t px-1 py-1" : "ml-auto flex flex-wrap gap-1"}
      style={mobile ? { borderColor: LINE, background: "#f2faf6" } : undefined}
    >
      {SECTIONS.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={section === id}
          data-testid={`bank-tab-${id}`}
          onClick={() => setSection(id)}
          className={`flex cursor-pointer motion-safe:transition-colors ${FOCUS} ${
            mobile ? "min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[12px] font-semibold leading-tight" : "items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
          } ${section === id ? "bg-[#0a7d5a] text-white" : "text-[#0f2a22] hover:bg-[#dcefe6]"}`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className={mobile ? "line-clamp-1 break-words" : ""}>{t(`banking.tabs.${id}`)}</span>
        </button>
      ))}
    </nav>
  );
  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col" data-testid="banking-app" data-touch={mobile ? "" : undefined} style={{ background: theme.bodyBg, color: INK }}>
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2" style={{ borderColor: LINE, background: "#f2faf6" }}>
        <span className="flex items-center gap-2 text-sm font-bold" style={{ color: EM_DARK }}>
          <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: EM }}>
            <Landmark className="h-4 w-4" />
          </span>
          {t("banking.brand")}
        </span>
        {!mobile && tabBar}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" role="tabpanel" data-testid="bank-panel" data-section={section} onWheel={(event) => event.stopPropagation()}>
        {section === "overview" && overview}
        {section === "transactions" && transactionsView}
        {section === "security" && securityView}
        {section === "support" && supportView}
      </div>
      {mobile && tabBar}
    </div>
  );
};
