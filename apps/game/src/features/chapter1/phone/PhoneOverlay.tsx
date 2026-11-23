// Phone overlay: the responsive phone frame, the lock screen, the home screen and the app router
// (Requirements 5.5, 13.6). Below 640 CSS pixels the frame fills the viewport width; at 640 px and
// wider it is a phone frame at most 380 px wide (Tailwind `sm` breakpoint = 640 px). On the 3D phone
// the same content is projected onto the model's screen.
// The overlay holds no game state: it renders selector views and reports intent through callbacks.
// What it does keep is where the player is in the UI: locked or not, the open app, and the open
// item of each app, so leaving an app and coming back finds it as it was. Opening an app or
// pressing Home never dispatches a game action; only opening an item does, as before.
// Escape is handled by the page through the overlay stack. Calls are shown on the 3D phone in
// the world, not in this overlay.
import React, { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ClaimId, DeviceActionId, EvidenceId } from "../../../game/narrative/chapter1/ids";
import { clockAtMinute, type DeviceView } from "../../../game/narrative/device";
import type { PhoneMessageView, PhoneRecordsView } from "../../../game/narrative/selectors";
import type { BlockedTransfer } from "../../../game/narrative/blocked";
import { ScreenSurface } from "../room/ScreenSurface";
import { PhoneScreenHost } from "../call/PhoneScreenHost";
import { heldPhoneLayout } from "../call/callLayout";
import type { PhoneScreenSink } from "../call/phoneScreenSink";
import { useViewport } from "../call/useViewport";
import { MailClient } from "../room/desktop/apps/MailClient";
import { BankingApp, type BankFacts } from "../room/desktop/banking/BankingApp";
import { browserReducer, INITIAL_BROWSER_STATE, type BrowserState } from "../room/desktop/browser/browserState";
import type { PortalFacts } from "../room/desktop/browser/ueh/PortalSite";
import { DesktopNavProvider, type DesktopNav } from "../room/desktop/desktopNav";
import { isWebPageItem } from "../room/desktop/mailModel";
import { FilesApp } from "../room/desktop/files/FilesApp";
import { MobileBrowser } from "./browser/MobileBrowser";
import { useScreenQuad } from "../room/useScreenQuad";
import { DeviceApp, type DeviceAppProps } from "../device/DeviceApp";
import { deviceAppEntries } from "../device/deviceApps";
import type { Tx } from "../device/deviceFormat";
import { CallsApp, type CallsTab } from "./calls/CallsApp";
import { MessagesHub } from "./messages/MessagesHub";
import { PhoneAppTile } from "./PhoneAppIcon";
import { PhoneCloseButton, PhoneCloseHiddenContext, PhoneHomeIndicator } from "./PhoneChrome";
import { PhoneHome } from "./PhoneHome";
import { PhoneLockScreen } from "./PhoneLockScreen";
import { PhoneTopBar } from "./PhoneTopBar";
import { VoicemailApp } from "./VoicemailApp";
import { buildNotifications, type PhoneNotification } from "./phoneNotifications";
import { routeApp, type PhoneRoute } from "./phoneRoutes";
import { PHONE_COLORS, phoneThemeFor } from "./phoneTheme";
import { usePhoneClock } from "./usePhoneClock";
import { stopLineVoice } from "../device/lineVoice";

export type { PhoneRoute } from "./phoneRoutes";

/** The shared device content on the phone, and what the player does with it. */
export interface PhoneDeviceProps {
  view: DeviceView;
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
  /** Which list is on screen (see `DeviceApp`). */
  onView?: DeviceAppProps["onView"];
}

/**
 * What the phone's own copies of Mail, Bank, Files and the Browser need beyond the device view: the
 * same facts the laptop apps read. They are read from the game; the phone never writes them.
 */
export interface PhoneMobileFacts {
  blocked: readonly BlockedTransfer[];
  bank: BankFacts;
  portal: PortalFacts;
}

export interface PhoneOverlayProps {
  /** From `selectPhoneRecords(state, scenario)`. */
  records: PhoneRecordsView;
  /** From `selectPhoneMessages(state, scenario)`. The voicemail and call summary show in Voicemail. */
  messages: readonly PhoneMessageView[];
  /** Dispatch INSPECT_EVIDENCE for this evidence item. */
  onInspectEvidence: (evidenceId: EvidenceId) => void;
  /** Dispatch DEVICE_ACTION for this phone action. */
  onDeviceAction: (id: DeviceActionId) => void;
  /** Dispatch VERIFY_CLAIM with method `saved-official-contact` for this claim. */
  onCallSavedContact: (claimId: ClaimId) => void;
  /** Dispatch CLOSE_PHONE (and pop the overlay). */
  onClose: () => void;
  /** Mail, bank, map, calendar, housing, jobs, files, chats and contacts. Absent: only the three original apps. */
  device?: PhoneDeviceProps;
  /** App shown when the phone opens. Defaults to the home screen. */
  initialRoute?: PhoneRoute;
  /** The phone opens on the lock screen. A phone opened on a given `initialRoute` starts unlocked. */
  startLocked?: boolean;
  /** How long a call to a contact rings, in milliseconds. Tests use a short time. */
  callRingMs?: number;
  /** Turns on the phone's Mail, Bank, Files and Browser (they share the laptop's apps and the game state). */
  mobile?: PhoneMobileFacts;
  /** The browser's tabs, bookmarks and history, kept by the layer while the phone is put down. */
  browserState?: BrowserState;
  onBrowserState?: (state: BrowserState) => void;
  /**
   * Opens the decision panel. Pass it only while `selectDecisionPanel(state).offered` is true;
   * the home screen then shows a "Decide" button.
   */
  onDecide?: () => void;
  /**
   * The phone brought up with P (like in GTA): low on the right of the screen, on the 3D phone model
   * when it is there (`model`), else on a flat frame in the same place (`fallback`). No backdrop:
   * the room stays visible around it.
   */
  held?: { screenSink: PhoneScreenSink; mode: "model" | "fallback" };
}

const WEEKDAY_KEYS = [
  "hud.status.weekday.1",
  "hud.status.weekday.2",
  "hud.status.weekday.3",
  "hud.status.weekday.4",
  "hud.status.weekday.5",
  "hud.status.weekday.6",
  "hud.status.weekday.7",
] as const;

/** Keys of the per-app memory: the open message of Messages and the open item of each device app. */
const MESSAGE_KEY = "phone:messages";
const CALLS_TAB_KEY = "phone:calls-tab";
const CALLS_CONTACT_KEY = "phone:calls-contact";
const deviceKey = (app: string) => `device:${app}`;

export const PhoneOverlay: React.FC<PhoneOverlayProps> = ({
  records,
  messages,
  onInspectEvidence,
  onDeviceAction,
  onCallSavedContact,
  onClose,
  device,
  initialRoute = "home",
  startLocked,
  callRingMs,
  mobile,
  browserState,
  onBrowserState,
  onDecide,
  held,
}) => {
  const { t } = useTranslation("chapter1");
  const viewport = useViewport();
  const heldLayout = useMemo(() => heldPhoneLayout(viewport), [viewport]);
  const [route, setRoute] = useState<PhoneRoute>(initialRoute);
  const [locked, setLocked] = useState<boolean>(startLocked ?? initialRoute === "home");
  const [openItems, setOpenItems] = useState<Readonly<Record<string, string | null>>>({});
  const [folders, setFolders] = useState<Readonly<Record<string, string>>>({});
  const [browser, dispatchBrowser] = useReducer(browserReducer, browserState ?? INITIAL_BROWSER_STATE);
  const onBrowserStateRef = useRef(onBrowserState);
  onBrowserStateRef.current = onBrowserState;
  useEffect(() => {
    onBrowserStateRef.current?.(browser);
  }, [browser]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const time = usePhoneClock();
  // Putting the phone down ends any line that is being read or played.
  useEffect(() => () => stopLineVoice(), []);
  // On the projected phone display when the 3D screen is visible; otherwise the flat phone frame.
  const layout = useScreenQuad("phone");
  const onScreen = layout.mode === "surface";
  // Move focus into the phone when it opens and when the screen changes, for keyboard users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [route, locked]);

  const otherMessages = useMemo(() => {
    const recordIds = new Set<string>(
      [records.voicemail, ...records.summaries].flatMap((message) => (message === null ? [] : [message.id])),
    );
    return messages.filter((message) => !recordIds.has(message.id));
  }, [records.voicemail, records.summaries, messages]);
  const unreadCount = otherMessages.filter((message) => message.unread).length + (device?.view.unread.messages ?? 0);
  const goHome = () => setRoute("home");
  /** Links and "open in" buttons of the phone's apps. UI navigation only: nothing here reaches the game. */
  const phoneNav: DesktopNav = {
    openBrowser: ({ url }) => {
      dispatchBrowser({ type: "openLink", url });
      setRoute("browser");
    },
    openApp: (id) => {
      const target: Record<string, PhoneRoute> = { "device-mail": "device:mail", "device-bank": "device:bank", "device-files": "device:files", browser: "browser" };
      if (Object.hasOwn(target, id)) setRoute(target[id]);
    },
    setEscapeHandler: () => undefined,
  };
  const callBank = () => {
    remember(CALLS_TAB_KEY, "contacts");
    remember(CALLS_CONTACT_KEY, "contact.bank");
    setRoute("calls");
  };
  const tx = t as unknown as Tx;
  const deviceApp = route.startsWith("device:") ? route.slice("device:".length) : null;
  const appKey = routeApp(route);
  const title: string =
    deviceApp !== null
      ? tx(`device.apps.${deviceApp}`)
      : route === "browser"
        ? tx("phone.routes.browser")
        : route === "voicemail"
        ? tx("room.records.tabs.voicemail")
        : tx(`phone.routes.${route}`);

  const notifications = useMemo(
    () => buildNotifications({ records, messages: otherMessages, device: device?.view }),
    [records, otherMessages, device?.view],
  );
  const weekday = device ? tx(WEEKDAY_KEYS[clockAtMinute(device.view.calendar.now).isoWeekday - 1]) : null;

  const remember = (key: string, id: string | null) => setOpenItems((current) => ({ ...current, [key]: id }));

  /** Tapping a notification opens its app on the item it is about, as tapping the row would. */
  const openNotification = (notification: PhoneNotification) => {
    setLocked(false);
    setRoute(notification.route);
    if (notification.kind === "device") {
      remember(deviceKey(notification.app), notification.itemId);
      device?.onOpenItem(notification.itemId);
    } else if (notification.kind === "message") {
      remember(MESSAGE_KEY, notification.messageId);
      if (!notification.evidenceRecorded) onInspectEvidence(notification.evidenceId);
    }
  };

  const deviceProps = (app: string) =>
    device
      ? {
          view: device.view,
          onOpenItem: device.onOpenItem,
          onUseItem: device.onUseItem,
          selectedId: openItems[deviceKey(app)] ?? null,
          onSelect: (id: string | null) => remember(deviceKey(app), id),
          folderId: folders[app] ?? "all",
          onFolder: (folder: string) => setFolders((current) => ({ ...current, [app]: folder })),
        }
      : null;

  let content: ReactNode;
  if (route === "messages") {
    content = (
      <MessagesHub
        storyMessages={otherMessages}
        onInspectEvidence={onInspectEvidence}
        onBack={goHome}
        storyOpenId={openItems[MESSAGE_KEY] ?? null}
        onStoryOpen={(id) => remember(MESSAGE_KEY, id)}
        chats={device?.view.apps.messages ?? []}
        openChatId={openItems[deviceKey("messages")] ?? null}
        onOpenChat={(id) => remember(deviceKey("messages"), id)}
        onOpenItem={(itemId) => device?.onOpenItem(itemId)}
        onUseItem={(itemId, actionId) => device?.onUseItem(itemId, actionId)}
        onView={device?.onView}
      />
    );
  } else if (route === "browser" && device && mobile) {
    content = (
      <MobileBrowser state={browser} dispatch={dispatchBrowser} view={device.view} facts={mobile.portal} onOpenItem={device.onOpenItem} onUseItem={device.onUseItem} />
    );
  } else if (deviceApp === "mail" && device && mobile) {
    content = <MailClient view={device.view} onOpenItem={device.onOpenItem} onUseItem={device.onUseItem} onView={device.onView} />;
  } else if (deviceApp === "bank" && device && mobile) {
    content = (
      <BankingApp view={device.view} phoneView={device.view} blocked={mobile.blocked} facts={mobile.bank} onUseItem={device.onUseItem} variant="mobile" onCallBank={callBank} />
    );
  } else if (deviceApp === "files" && device && mobile) {
    content = <FilesApp view={device.view} onOpenItem={device.onOpenItem} onUseItem={device.onUseItem} />;
  } else if (deviceApp !== null && device) {
    const props = deviceProps(deviceApp);
    content = props && <DeviceApp app={deviceApp as never} {...props} onView={device.onView} onExit={goHome} />;
  } else if (route === "calls") {
    content = (
      <CallsApp
        view={device?.view}
        records={records}
        onDeviceAction={onDeviceAction}
        onCallSavedContact={onCallSavedContact}
        onUseItem={device?.onUseItem}
        onBack={goHome}
        tab={(openItems[CALLS_TAB_KEY] as CallsTab | null | undefined) ?? "recents"}
        onTab={(next) => remember(CALLS_TAB_KEY, next)}
        contactId={openItems[CALLS_CONTACT_KEY] ?? null}
        onContact={(id) => remember(CALLS_CONTACT_KEY, id)}
        ringMs={callRingMs}
      />
    );
  } else if (route === "voicemail") {
    content = (
      <VoicemailApp
        voicemail={records.voicemail}
        summaries={records.summaries}
        deviceActions={records.deviceActions}
        onDeviceAction={onDeviceAction}
        onBack={goHome}
      />
    );
  }

  const theme = phoneThemeFor(appKey ?? "");
  // The phone's Mail, Bank, Files and Browser draw their own surface edge to edge and scroll inside.
  const fullBleed = device !== undefined && mobile !== undefined && (route === "browser" || deviceApp === "mail" || deviceApp === "bank" || deviceApp === "files");
  let screen: ReactNode;
  if (locked) {
    screen = (
      <PhoneLockScreen
        time={time}
        weekday={weekday}
        notifications={notifications}
        onOpenNotification={openNotification}
        onUnlock={() => setLocked(false)}
        onClose={onClose}
        headingRef={headingRef}
      />
    );
  } else if (route === "home") {
    screen = (
      <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-[phoneHomeIn_220ms_ease-out_both]">
        <PhoneHome
          unreadCount={unreadCount}
          onOpenApp={setRoute}
          showVoicemail={!device || records.voicemail !== null || records.summaries.length > 0}
          showBrowser={device !== undefined && mobile !== undefined}
          extraApps={
            device
              ? deviceAppEntries(device.view, "phone", tx).map((entry) => ({
                  id: entry.app,
                  label: entry.label,
                  // The pages of the web live in the mail data but are not messages.
                  badge: entry.app === "mail" ? device.view.apps.mail.filter((item) => item.tracksUnread && !item.read && !isWebPageItem(item)).length : entry.badge,
                }))
              : []
          }
          onOpenExtra={(id) => setRoute(`device:${id}`)}
          time={time}
          weekday={weekday}
          onClose={onClose}
          onDecide={onDecide}
          headingRef={headingRef}
        />
      </div>
    );
  } else {
    screen = (
      <div
        className="flex min-h-0 flex-1 flex-col motion-safe:animate-[phoneAppIn_180ms_ease-out_both]"
        data-testid={`phone-screen-${appKey}`}
        style={{ background: theme.bodyBg }}
      >
        <div className="flex shrink-0 items-center gap-2.5 px-3 py-2" style={{ background: theme.headerBg }}>
          <PhoneAppTile app={appKey ?? ""} size={30} />
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 flex-1 line-clamp-2 break-words text-base font-bold leading-tight outline-none"
            style={{ color: PHONE_COLORS.text }}
          >
            {title}
          </h2>
          <PhoneCloseButton onClose={onClose} />
        </div>
        <div
          className={fullBleed ? "relative flex min-h-0 flex-1 flex-col overflow-hidden text-[#f7f5ff]" : "flex min-h-0 flex-1 flex-col overflow-y-auto p-3 text-[#f7f5ff]"}
          data-testid="phone-app-body"
          data-touch
        >
          <DesktopNavProvider value={phoneNav}>{content}</DesktopNavProvider>
        </div>
        <PhoneHomeIndicator onHome={goHome} />
      </div>
    );
  }

  if (held) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[43]" data-testid="held-phone" data-screen-mode="held" data-held-mode={held.mode}>
        <PhoneScreenHost mode={held.mode} layout={heldLayout} screenSink={held.screenSink}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("phone.overlay.name")}
            className="pointer-events-auto flex h-full w-full flex-col overflow-hidden text-[#f2f7fb]"
            style={{ background: PHONE_COLORS.wallpaper, borderRadius: "inherit" }}
            data-phone-frame
            data-phone-locked={locked ? "true" : "false"}
          >
            <PhoneTopBar time={time} island />
            <PhoneCloseHiddenContext.Provider value={true}>{screen}</PhoneCloseHiddenContext.Provider>
          </div>
        </PhoneScreenHost>
      </div>
    );
  }
  return (
    <ScreenSurface layout={layout} device="phone" panelWrapperClassName="fixed inset-0 z-40 flex items-center justify-center bg-[#0a1220]/70 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("phone.overlay.name")}
        className={
          onScreen
            ? "flex h-full w-full flex-col overflow-hidden text-[#f2f7fb]"
            : "flex h-full max-h-full w-full flex-col overflow-hidden text-[#f2f7fb] shadow-xl sm:h-[min(720px,100%)] sm:max-w-[380px] sm:rounded-[2rem] sm:border-4 sm:border-[#0b1624]"
        }
        style={{ background: PHONE_COLORS.wallpaper }}
        data-phone-frame
        data-phone-locked={locked ? "true" : "false"}
      >
        <PhoneTopBar time={time} island={!onScreen} />
        {screen}
      </div>
    </ScreenSurface>
  );
};
