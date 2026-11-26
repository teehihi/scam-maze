// The Calls app: Recents (the calls you made and the call log), Contacts and a Keypad, and the call
// screen. Opening the app, switching tabs and looking at a contact change nothing in the game;
// the game state changes when a call connects and when Alex takes a turn in it.
// The tab and the open contact are held by the overlay, so leaving the app and coming back finds
// them as they were. A call in progress ends when the app is left.
import React, { useState } from "react";
import { ArrowLeft, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ClaimId, DeviceActionId } from "../../../../game/narrative/chapter1/ids";
import type { DeviceItemView, DeviceView } from "../../../../game/narrative/device";
import type { PhoneRecordsView } from "../../../../game/narrative/selectors";
import { formatWhen, type Tx } from "../../device/deviceFormat";
import { UI } from "../../theme";
import { CallHistoryApp } from "../CallHistoryApp";
import { ChatAvatar } from "../messages/ChatThread";
import { PHONE_COLORS, phoneThemeFor } from "../phoneTheme";
import { CallScreen } from "./CallScreen";
import { Dialer } from "./Dialer";
import { callsMade, contactsOf, findContactByNumber } from "./callModel";

export type CallsTab = "recents" | "contacts" | "keypad";

const TABS: readonly CallsTab[] = ["recents", "contacts", "keypad"];

export interface CallsAppProps {
  /** The shared device content; absent: only the call log. */
  view?: DeviceView;
  records: PhoneRecordsView;
  onDeviceAction: (id: DeviceActionId) => void;
  onCallSavedContact: (claimId: ClaimId) => void;
  onUseItem?: (itemId: string, actionId: string) => void;
  /** Leave the app (back to the home screen). */
  onBack: () => void;
  tab: CallsTab;
  onTab: (tab: CallsTab) => void;
  /** The contact whose card is open, or null. */
  contactId: string | null;
  onContact: (id: string | null) => void;
  /** Ringing time of a call, in milliseconds. */
  ringMs?: number;
  /**
   * A call the player just answered (an incoming call): its screen opens at once and connects without
   * ringing again. Read when the app opens.
   */
  answeredCallId?: string | null;
}

export const CallsApp: React.FC<CallsAppProps> = ({
  view,
  records,
  onDeviceAction,
  onCallSavedContact,
  onUseItem,
  onBack,
  tab,
  onTab,
  contactId,
  onContact,
  ringMs,
  answeredCallId = null,
}) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const theme = phoneThemeFor("calls");
  const [calling, setCalling] = useState<string | null>(answeredCallId);
  const [dialed, setDialed] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const contacts = view === undefined ? [] : contactsOf(view);
  const callee = calling === null ? null : (contacts.find((item) => item.id === calling) ?? null);

  if (callee !== null && onUseItem !== undefined) {
    const answered = callee.id === answeredCallId;
    return <CallScreen key={callee.id} contact={callee} onUseItem={onUseItem} onLeave={() => setCalling(null)} ringMs={answered ? 0 : ringMs} />;
  }

  const startCall = (item: DeviceItemView) => {
    setNotice(null);
    setCalling(item.id);
  };
  const dial = () => {
    const match = findContactByNumber(contacts, dialed);
    if (match === null) {
      setNotice(t("phone.dialer.notInService"));
      return;
    }
    setDialed("");
    startCall(match);
  };
  const open = contactId === null ? null : (contacts.find((item) => item.id === contactId) ?? null);
  const made = callsMade(contacts);

  if (tab === "contacts" && open !== null) {
    return (
      <article className="space-y-4" data-testid={`device-item-${open.id}`}>
        <button type="button" className={UI.buttonSecondary} onClick={() => onContact(null)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t("device.back")}</span>
        </button>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <ChatAvatar name={open.title} size={72} />
          <h3 className="break-words text-base font-bold leading-tight" style={{ color: PHONE_COLORS.text }}>
            {open.title}
          </h3>
          {/* Plain text only: the number is never a link. */}
          {open.detail !== null && (
            <p className="text-sm tabular-nums" style={{ color: PHONE_COLORS.textMuted }}>
              {open.detail}
            </p>
          )}
        </div>
        <p className="whitespace-pre-line break-words text-sm leading-relaxed" style={{ color: PHONE_COLORS.textMuted }}>
          {open.body}
        </p>
        {onUseItem !== undefined && (
          <button
            type="button"
            onClick={() => startCall(open)}
            data-testid={`contact-call-${open.id}`}
            aria-label={t("phone.dialer.callName", { name: open.title })}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#0f1b0b] motion-safe:transition-colors cursor-pointer hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]"
            style={{ background: theme.tileFrom }}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span aria-hidden="true">{t("phone.dialer.callButton")}</span>
          </button>
        )}
      </article>
    );
  }

  return (
    <div className="space-y-3" data-testid="calls-app">
      <button type="button" className={UI.buttonSecondary} onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("phone.calls.back")}
      </button>
      <div role="tablist" aria-label={t("phone.routes.calls")} className="grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: "rgba(0,0,0,0.3)" }}>
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`calls-tab-${name}`}
            aria-selected={tab === name}
            aria-controls="calls-panel"
            data-testid={`calls-tab-${name}`}
            onClick={() => {
              onTab(name);
              setNotice(null);
            }}
            className="rounded-lg px-1 py-1.5 text-[13px] font-semibold motion-safe:transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#8fe0e8]"
            style={tab === name ? { background: theme.tileTo, color: "#ffffff" } : { color: PHONE_COLORS.textMuted }}
          >
            {t(`phone.dialer.${name}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="calls-panel" aria-labelledby={`calls-tab-${tab}`} className="space-y-4">
        {tab === "recents" && (
          <>
            {made.length > 0 && (
              <section aria-label={t("phone.dialer.madeHeading")} className="space-y-1.5" data-testid="calls-made">
                <h3 className={UI.label}>{t("phone.dialer.madeHeading")}</h3>
                <ul className="space-y-1.5">
                  {made.map(({ item, atMinute }) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onContact(item.id);
                          onTab("contacts");
                        }}
                        data-testid={`call-made-${item.id}`}
                        className="flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left cursor-pointer hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]"
                        style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.12)", color: PHONE_COLORS.text }}
                      >
                        <ChatAvatar name={item.title} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 break-words text-sm font-semibold">{item.title}</span>
                          <span className="block text-[12px]" style={{ color: PHONE_COLORS.textMuted }}>
                            {t("phone.dialer.outgoing")} · {t("phone.dialer.answered")} · {formatWhen(t, atMinute)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {made.length === 0 && records.calls.length === 0 && (
              <p className="text-sm" style={{ color: PHONE_COLORS.textMuted }} data-testid="calls-empty">
                {t("phone.dialer.recentsEmpty")}
              </p>
            )}
            {records.calls.length > 0 || records.savedContact !== null ? (
              <CallHistoryApp
                calls={records.calls}
                deviceActions={records.deviceActions}
                savedContact={records.savedContact}
                onDeviceAction={onDeviceAction}
                onCallSavedContact={onCallSavedContact}
                onBack={onBack}
                showBack={false}
              />
            ) : null}
          </>
        )}
        {tab === "contacts" &&
          (contacts.length === 0 ? (
            <p className="text-sm" style={{ color: PHONE_COLORS.textMuted }}>
              {t("phone.dialer.contactsEmpty")}
            </p>
          ) : (
            <ul className="space-y-1.5" data-testid="device-app-contacts">
              {contacts.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-testid={`device-row-${item.id}`}
                    onClick={() => onContact(item.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left cursor-pointer hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]"
                    style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.12)", color: PHONE_COLORS.text }}
                  >
                    <ChatAvatar name={item.title} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-words text-sm font-semibold">{item.title}</span>
                      {item.detail !== null && (
                        <span className="block text-[12px] tabular-nums" style={{ color: PHONE_COLORS.textMuted }}>
                          {item.detail}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        {tab === "keypad" && (
          <Dialer
            value={dialed}
            onChange={(next) => {
              setDialed(next);
              setNotice(null);
            }}
            onCall={dial}
            notice={notice}
          />
        )}
      </div>
    </div>
  );
};
