// Messages app: a message list and a message detail view (Requirements 7.2, 7.3, 7.4).
// Message bodies contain a look-alike domain; it is rendered as plain text, never as a link.

import React, { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import type { EvidenceId, MessageId } from "../../../game/narrative/chapter1/ids";
import type { PhoneMessageView } from "../../../game/narrative/selectors";
import { UI } from "../theme";

export interface MessagesAppProps {
  messages: readonly PhoneMessageView[];
  onInspectEvidence: (evidenceId: EvidenceId) => void;
  /** Return to the phone home screen. */
  onBack: () => void;
}

export const MESSAGES_APP_TEXT = {
  heading: "Messages",
  back: "Back",
  backToList: "Back to messages",
  empty: "No messages.",
  unread: "Unread",
  recorded: "Recorded in your journal",
  from: "From",
} as const;

const LIST_BUTTON =
  "flex w-full flex-col gap-1 rounded-lg border border-[#38344f] bg-[#171521] p-3 text-left motion-safe:transition-colors hover:border-[#7654d6] hover:bg-[#26233a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] cursor-pointer";

export const MessagesApp: React.FC<MessagesAppProps> = ({ messages, onInspectEvidence, onBack }) => {
  const [openId, setOpenId] = useState<MessageId | null>(null);
  const open = openId === null ? null : (messages.find((message) => message.id === openId) ?? null);

  const openMessage = (message: PhoneMessageView) => {
    setOpenId(message.id);
    if (!message.evidenceRecorded) onInspectEvidence(message.evidenceId);
  };

  if (open) {
    return (
      <div className="space-y-3">
        <button type="button" className={UI.buttonSecondary} onClick={() => setOpenId(null)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {MESSAGES_APP_TEXT.backToList}
        </button>
        <article className={`${UI.card} space-y-2`} aria-labelledby={`phone-message-${open.id}-from`}>
          <p className={UI.label}>{MESSAGES_APP_TEXT.from}</p>
          <h3 id={`phone-message-${open.id}-from`} className="text-sm font-bold text-[#f7f5ff]">
            {open.from}
          </h3>
          {/* Plain text only: the body includes a domain that must never become a link. */}
          <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[#f7f5ff]">{open.body}</p>
          {open.evidenceRecorded && (
            <p className={`flex items-center gap-1.5 text-xs font-semibold ${UI.textPositive}`}>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {MESSAGES_APP_TEXT.recorded}
            </p>
          )}
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" className={UI.buttonSecondary} onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {MESSAGES_APP_TEXT.back}
      </button>
      <h3 className={UI.label}>{MESSAGES_APP_TEXT.heading}</h3>
      {messages.length === 0 ? (
        <p className={UI.body}>{MESSAGES_APP_TEXT.empty}</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((message) => (
            <li key={message.id}>
              <button type="button" className={LIST_BUTTON} onClick={() => openMessage(message)}>
                <span className="flex items-center justify-between gap-2">
                  <span className={`text-sm text-[#f7f5ff] ${message.unread ? "font-bold" : "font-medium"}`}>
                    {message.from}
                  </span>
                  {message.unread && (
                    <span className="rounded-full bg-[#f2b24b] px-2 py-0.5 text-xs font-bold text-[#171521]">
                      {MESSAGES_APP_TEXT.unread}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-xs text-[#a9a4c4]">{message.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
