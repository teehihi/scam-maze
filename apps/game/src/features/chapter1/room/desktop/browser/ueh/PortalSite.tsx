// The simulated UEH Student Portal: the valid site of the story, in the in-game browser. A
// dashboard, thesis management, student services and account and security, with a header, a sidebar,
// breadcrumbs and cards. It is a game simulation and says so; it is not a copy of the school's real
// system. The facts it shows (thesis progress, time left, access) are read from the game; the one
// thing the player can DO here, checking the account, is the story's own saved-portal action, which
// costs time and saves evidence in Files. Reading the portal changes nothing.
import React, { useRef } from "react";
import { BookOpenCheck, CalendarClock, GraduationCap, LayoutDashboard, LifeBuoy, ShieldCheck, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceItemView, DeviceView } from "../../../../../../game/narrative/device";
import { useGameLocale } from "../../../../../../i18n/useGameLocale";
import { actionLabel, formatSpan, type Tx } from "../../../../device/deviceFormat";
import { useIsWide } from "../../useContainerWidth";
import type { PortalSection } from "../sites";
import { urlOfPage } from "../sites";
import { Breadcrumbs, Card, Progress, SITE_FOCUS, siteButtonClass } from "./siteUi";
import { GAME_PROFILE, PORTAL_COLORS as C } from "./uehTheme";
import { UehMark } from "./UehMark";

export interface PortalFacts {
  /** The submission account is locked (an account was compromised and not recovered). */
  accountLocked: boolean;
  /** The thesis draft is finished. */
  draftFinished: boolean;
  /** Ids of the thesis tasks done (`draft.final`: the two typed sentences). */
  tasksDone: readonly string[];
  accessVerified?: boolean;
  submissionDeadlineMissed?: boolean;
}

export interface PortalSiteProps {
  section: PortalSection;
  view: DeviceView;
  facts: PortalFacts;
  /** Goes to another page of the game in this tab. */
  go: (url: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
}

const SECTION_PAGE: Record<PortalSection, string> = {
  dashboard: "portal",
  thesis: "portal-thesis",
  services: "portal-services",
  account: "portal-account",
};

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  thesis: GraduationCap,
  services: LifeBuoy,
  account: ShieldCheck,
} as const;

const SECTIONS: readonly PortalSection[] = ["dashboard", "thesis", "services", "account"];
const TASKS = [{ id: "draft.final", key: "final" }] as const;


const Row: React.FC<{ label: string; value: React.ReactNode; testId?: string }> = ({ label, value, testId }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b py-1.5 last:border-b-0" style={{ borderColor: C.line }}>
    <dt className="text-xs" style={{ color: C.muted }}>
      {label}
    </dt>
    <dd className="min-w-0 break-words text-sm font-medium" style={{ color: C.ink }} data-testid={testId}>
      {value}
    </dd>
  </div>
);

export const PortalSite: React.FC<PortalSiteProps> = ({ section, view, facts, go, onUseItem }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useIsWide(rootRef, 640);

  const savedPortal: DeviceItemView | null = view.apps.files.find((item) => item.id === "portal.saved") ?? null;
  const checkAction = savedPortal?.actions.find((action) => action.id === "check-account") ?? null;
  const submitAction = savedPortal?.actions.find((action) => action.id === "submit-thesis") ?? null;
  const checked = checkAction?.blocked === "done";
  const submitted = view.calendar.submission === "submitted";
  const timeLeft = formatSpan(t, view.calendar.minutesLeft);
  const accessText = facts.accountLocked
    ? t("ueh.portal.accessLocked")
    : facts.accessVerified
      ? t("ueh.portal.accessActive")
      : t("ueh.portal.accessNotChecked");

  const navItems = SECTIONS.map((id) => {
    const Icon = NAV_ICONS[id];
    const selected = id === section;
    return (
      <li key={id} className={wide ? "" : "shrink-0"}>
        <button
          type="button"
          data-testid={`portal-nav-${id}`}
          aria-current={selected ? "page" : undefined}
          onClick={() => go(urlOfPage(SECTION_PAGE[id]))}
          className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium motion-safe:transition-colors ${SITE_FOCUS} ${
            selected ? "bg-white shadow-sm" : "hover:bg-white/60"
          }`}
          style={{ color: selected ? C.tealDark : C.ink, boxShadow: selected ? `inset 3px 0 0 ${C.orange}` : undefined }}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{t(`ueh.portal.nav.${id}`)}</span>
        </button>
      </li>
    );
  });

  const home = { label: t("ueh.portal.home"), onClick: section === "dashboard" ? undefined : () => go(urlOfPage("portal")) };

  const dashboard = (
    <div className="space-y-4">
      <Breadcrumbs colors={C} items={[home]} />
      <h2 className="text-xl font-bold" style={{ color: C.tealDark }}>
        {t("ueh.portal.dashboard.heading", { name: GAME_PROFILE.name })}
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card colors={C} title={t("ueh.portal.dashboard.studyStatus")} icon={<BookOpenCheck className="h-4 w-4" aria-hidden="true" />}>
          <p className="text-sm font-semibold" style={{ color: C.ink }}>
            {t("ueh.portal.dashboard.studyValue")}
          </p>
        </Card>
        <Card colors={C} title={t("ueh.portal.dashboard.graduationStatus")} icon={<GraduationCap className="h-4 w-4" aria-hidden="true" />}>
          <p className="text-sm font-semibold" style={{ color: C.ink }}>
            {facts.draftFinished ? t("ueh.portal.dashboard.graduationDraft") : t("ueh.portal.dashboard.graduationValue")}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: C.muted }}>
            {t("ueh.portal.thesis.progressValue", { value: Math.round(view.calendar.thesisProgress) })}
          </p>
        </Card>
        <Card colors={C} title={t("ueh.portal.dashboard.accountStatus")} icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} accent={facts.accountLocked}>
          <p className="text-sm font-semibold" style={{ color: C.ink }} data-testid="portal-access-dashboard">
            {accessText}
          </p>
        </Card>
      </div>
      <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
        <Card colors={C} title={t("ueh.portal.dashboard.student")} icon={<UserRound className="h-4 w-4" aria-hidden="true" />}>
          <dl>
            <Row label={t("ueh.portal.dashboard.fullName")} value={GAME_PROFILE.name} />
            <Row label={t("ueh.portal.dashboard.studentId")} value={GAME_PROFILE.studentId} />
            <Row label={t("ueh.portal.dashboard.level")} value={t("ueh.portal.dashboard.levelValue")} />
            <Row label={t("ueh.portal.dashboard.programme")} value={t("ueh.portal.dashboard.programmeValue")} />
          </dl>
        </Card>
        <Card colors={C} title={t("ueh.portal.dashboard.dates")} icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}>
          <dl>
            <Row label={t("ueh.portal.dashboard.date1")} value={t("ueh.portal.dashboard.date1When")} />
            <Row label={t("ueh.portal.dashboard.date2")} value={t("ueh.portal.dashboard.date2When")} />
            <Row label={t("ueh.portal.thesis.timeLeftLabel")} value={timeLeft} testId="portal-time-left" />
          </dl>
        </Card>
      </div>
      <Card colors={C} title={t("ueh.portal.dashboard.notices")}>
        <ul className="space-y-3">
          {(["notice1", "notice2", "notice3"] as const).map((key) => (
            <li key={key}>
              <p className="text-sm font-semibold" style={{ color: C.ink }}>
                {t(`ueh.portal.dashboard.${key}Title`)}
              </p>
              <p className="text-xs" style={{ color: C.muted }}>
                {t(`ueh.portal.dashboard.${key}Body`)}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );

  const thesis = (
    <div className="space-y-4">
      <Breadcrumbs colors={C} items={[home, { label: t("ueh.portal.nav.thesis") }]} />
      <h2 className="text-xl font-bold" style={{ color: C.tealDark }}>
        {t("ueh.portal.thesis.heading")}
      </h2>
      <Card colors={C} title={t("ueh.portal.thesis.progress")}>
        <p className="mb-2 text-2xl font-bold tabular-nums" style={{ color: C.ink }} data-testid="portal-thesis-progress">
          {t("ueh.portal.thesis.progressValue", { value: Math.round(view.calendar.thesisProgress) })}
        </p>
        <Progress colors={C} percent={view.calendar.thesisProgress} label={t("ueh.portal.thesis.progress")} />
        <dl className="mt-3">
          <Row label={t("ueh.portal.thesis.draft")} value={facts.draftFinished ? t("ueh.portal.thesis.draftFinished") : t("ueh.portal.thesis.draftInProgress")} testId="portal-draft-status" />
          <Row label={t("ueh.portal.thesis.supervisor")} value={facts.draftFinished ? t("ueh.portal.thesis.supervisorReady") : t("ueh.portal.thesis.supervisorWaiting")} />
        </dl>
      </Card>
      <Card colors={C} title={t("ueh.portal.thesis.remaining")}>
        <ul className="space-y-1.5">
          {TASKS.map((task) => {
            const isDone = facts.tasksDone.includes(task.id);
            return (
              <li key={task.id} className="flex items-center justify-between gap-3 text-sm" data-testid={`portal-task-${task.key}`} data-done={isDone ? "true" : "false"}>
                <span style={{ color: C.ink }}>{t(`ueh.portal.thesis.task.${task.key}`)}</span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ background: isDone ? C.tealSoft : C.orangeSoft, color: isDone ? C.tealDark : "#8a4b00" }}
                >
                  {isDone ? t("ueh.portal.thesis.taskDone") : t("ueh.portal.thesis.taskTodo")}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card colors={C} title={t("ueh.portal.thesis.submission")} icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}>
        <dl>
          <Row label={t("ueh.portal.thesis.deadlineLabel")} value={t("ueh.portal.thesis.deadlineValue")} />
          <Row label={t("ueh.portal.thesis.timeLeftLabel")} value={timeLeft} />
          <Row label={t("ueh.portal.thesis.access")} value={accessText} testId="portal-access-thesis" />
          <Row label={t("ueh.portal.thesis.submission")} value={submitted ? t("device.calendar.status.submitted") : t("device.calendar.status.not-submitted")} testId="portal-submission-status" />
        </dl>
        {submitted ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" role="status" data-testid="portal-submission-receipt">
            {t("ueh.portal.thesis.submittedReceipt")}
          </p>
        ) : submitAction ? (
          <div className="mt-3">
            <button
              type="button"
              data-testid="portal-submit-thesis"
              disabled={!submitAction.available}
              onClick={() => onUseItem("portal.saved", "submit-thesis")}
              className={`w-full ${siteButtonClass("primary")} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {t("ueh.portal.thesis.submitButton")}
              {submitAction.available ? ` · ${formatSpan(t, submitAction.timeCostMinutes)}` : ""}
            </button>
            {!submitAction.available && <p className="mt-2 text-xs" style={{ color: C.muted }} data-testid="portal-submit-blocked-hint">{facts.submissionDeadlineMissed ? t("ueh.portal.thesis.deadlineMissed") : t("ueh.portal.thesis.blockedHint")}</p>}
          </div>
        ) : null}
      </Card>
    </div>
  );

  const services = (
    <div className="space-y-4">
      <Breadcrumbs colors={C} items={[home, { label: t("ueh.portal.nav.services") }]} />
      <h2 className="text-xl font-bold" style={{ color: C.tealDark }}>
        {t("ueh.portal.services.heading")}
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Card colors={C} title={t("ueh.portal.services.training")} testId="portal-training-office">
          <p className="text-xs" style={{ color: C.muted }}>
            {t("ueh.portal.services.trainingBody")}
          </p>
          <dl className="mt-2">
            <Row label={t("ueh.portal.services.phone")} value={t("ueh.portal.services.trainingPhone")} testId="portal-training-phone" />
            <Row label={t("ueh.portal.services.email")} value={t("ueh.portal.services.trainingEmail")} testId="portal-training-email" />
            <Row label={t("ueh.portal.services.hours")} value={t("ueh.portal.services.trainingHours")} />
          </dl>
          <p className="mt-2 text-xs" style={{ color: C.muted }}>
            {t("ueh.portal.services.callNote")}
          </p>
        </Card>
        <Card colors={C} title={t("ueh.portal.services.international")}>
          <p className="text-xs" style={{ color: C.muted }}>
            {t("ueh.portal.services.internationalBody")}
          </p>
          <dl className="mt-2">
            <Row label={t("ueh.portal.services.email")} value={t("ueh.portal.services.internationalEmail")} />
            <Row label={t("ueh.portal.services.hours")} value={t("ueh.portal.services.internationalHours")} />
          </dl>
        </Card>
      </div>
      <Card colors={C} title={t("ueh.portal.services.fees")} testId="portal-fees">
        <p className="text-xs" style={{ color: C.muted }}>
          {t("ueh.portal.services.feesIntro")}
        </p>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: C.muted }}>
              <th scope="col" className="py-1 font-semibold">
                {t("ueh.portal.services.feeName")}
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                {t("ueh.portal.services.feeAmount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {(["transcript", "card", "thesis"] as const).map((key) => (
              <tr key={key} className="border-t" style={{ borderColor: C.line }} data-testid={`portal-fee-${key}`}>
                <td className="py-1.5" style={{ color: C.ink }}>
                  {t(`ueh.portal.services.fee.${key}`)}
                </td>
                <td className="py-1.5 text-right tabular-nums" style={{ color: C.ink }}>
                  {t(`ueh.portal.services.fee.${key}Amount`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs" style={{ color: C.muted }}>
          {t("ueh.portal.services.feesNote")}
        </p>
        <dl className="mt-2 border-t pt-2" style={{ borderColor: C.line }} data-testid="portal-payment-route">
          <Row
            label={t("ueh.portal.services.paymentPortalLabel")}
            value={<span data-testid="portal-payment-domain">{t("ueh.portal.services.paymentPortalDomain")}</span>}
          />
        </dl>
      </Card>
    </div>
  );

  const account = (
    <div className="space-y-4">
      <Breadcrumbs colors={C} items={[home, { label: t("ueh.portal.nav.account") }]} />
      <h2 className="text-xl font-bold" style={{ color: C.tealDark }}>
        {t("ueh.portal.account.heading")}
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Card colors={C} title={t("ueh.portal.account.details")} icon={<UserRound className="h-4 w-4" aria-hidden="true" />}>
          <dl>
            <Row label={t("ueh.portal.account.login")} value={GAME_PROFILE.studentId} />
            <Row label={t("ueh.portal.account.email")} value={GAME_PROFILE.email} />
            <Row label={t("ueh.portal.thesis.access")} value={accessText} testId="portal-access-account" />
          </dl>
        </Card>
        <Card colors={C} title={t("ueh.portal.account.check")} icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} testId="portal-check">
          <p className="text-xs" style={{ color: C.muted }}>
            {t("ueh.portal.account.checkBody")}
          </p>
          {checked ? (
            <div className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: C.teal, background: C.tealSoft, color: C.ink }} data-testid="portal-check-result" role="status">
              <p className="font-semibold">{t("ueh.portal.account.resultTitle")}</p>
              <p className="mt-1 text-xs">{t("ueh.portal.account.resultBody")}</p>
            </div>
          ) : checkAction !== null && savedPortal !== null ? (
            <div className="mt-3 space-y-1">
              <button
                type="button"
                className={siteButtonClass("primary")}
                disabled={!checkAction.available}
                data-testid="portal-check-account"
                onClick={() => onUseItem(savedPortal.id, checkAction.id)}
              >
                {actionLabel(t, locale, { ...checkAction, label: t("ueh.portal.account.checkButton") })}
              </button>
              {checkAction.blocked !== null && (
                <p className="text-xs" style={{ color: C.muted }}>
                  {t(`device.blocked.${checkAction.blocked}`)}
                </p>
              )}
            </div>
          ) : null}
        </Card>
      </div>
      <Card colors={C} title={t("ueh.portal.account.recovery")} icon={<LifeBuoy className="h-4 w-4" aria-hidden="true" />}>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm" style={{ color: C.ink }}>
          {(["step1", "step2", "step3"] as const).map((key) => (
            <li key={key}>{t(`ueh.portal.account.${key}`)}</li>
          ))}
        </ol>
      </Card>
    </div>
  );

  return (
    <div ref={rootRef} className="flex min-h-full flex-col" data-testid="portal-site" data-section={section} style={{ background: C.page, color: C.ink }}>
      <header
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5"
        style={{ background: `linear-gradient(100deg, ${C.tealDark}, ${C.teal})`, borderBottom: `3px solid ${C.orange}` }}
      >
        <UehMark colors={C} onDark />
        <div className="flex items-center gap-3 text-white">
          <span className="text-sm font-semibold">{t("ueh.portal.title")}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            {GAME_PROFILE.name}
          </span>
        </div>
      </header>
      <div className={`flex min-h-0 flex-1 ${wide ? "flex-row" : "flex-col"}`}>
        <nav
          aria-label={t("ueh.portal.navLabel")}
          className={wide ? "w-48 shrink-0 border-r p-3" : "border-b p-2"}
          style={{ background: C.tealSoft, borderColor: C.line }}
        >
          <ul className={wide ? "space-y-1" : "flex gap-1 overflow-x-auto"}>{navItems}</ul>
        </nav>
        <main className="min-w-0 flex-1 p-4">
          {section === "dashboard" && dashboard}
          {section === "thesis" && thesis}
          {section === "services" && services}
          {section === "account" && account}
        </main>
      </div>
      <footer className="shrink-0 border-t px-4 py-2 text-xs" style={{ borderColor: C.line, color: C.muted, background: C.white }}>
        {t("ueh.brand.simNote")}
      </footer>
    </div>
  );
};
