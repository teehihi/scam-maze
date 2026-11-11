// Northgate Bank app (Requirements 7.3, 7.4, 12.5).
// Opening the app calls `onVerifyBankApp` once per mount; the page dispatches
// VERIFY_CLAIM `bank-app`. The screens are plain text; numbers and domains are never links.

import React, { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import type { PhoneContent } from "../../../game/narrative/types";
import { UI } from "../theme";

export interface BankAppProps {
  bankApp: PhoneContent["bankApp"];
  onVerifyBankApp: () => void;
  /** Return to the phone home screen. */
  onBack: () => void;
}

export const BANK_APP_TEXT = {
  back: "Back",
} as const;

export const BankApp: React.FC<BankAppProps> = ({ bankApp, onVerifyBankApp, onBack }) => {
  // A ref guard keeps the call to once per mount, also under React StrictMode effect replays.
  const verifiedRef = useRef(false);
  const onVerifyRef = useRef(onVerifyBankApp);
  onVerifyRef.current = onVerifyBankApp;

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    onVerifyRef.current();
  }, []);

  return (
    <div className="space-y-3">
      <button type="button" className={UI.buttonSecondary} onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {BANK_APP_TEXT.back}
      </button>
      <h3 className={UI.label}>{bankApp.title}</h3>
      <ul className="space-y-2">
        {bankApp.screens.map((screen) => (
          <li key={screen.id}>
            <section className={`${UI.card} space-y-1`} aria-labelledby={`bank-screen-${screen.id}`}>
              <h4 id={`bank-screen-${screen.id}`} className="text-sm font-bold text-[#f7f5ff]">
                {screen.title}
              </h4>
              <p className="break-words text-sm leading-relaxed text-[#a9a4c4]">{screen.body}</p>
            </section>
          </li>
        ))}
      </ul>
    </div>
  );
};
