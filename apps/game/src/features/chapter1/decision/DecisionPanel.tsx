// Decision panel: the three ways to respond after the first call (Requirements 13.1-13.4).
// Props only: the page passes the `selectDecisionPanel` view and dispatches the actions.
// The official route has two steps: VERIFY_CLAIM `official-line` (the pre-step), then
// MAKE_DECISION `verify-independently`. Every MAKE_DECISION goes through a confirmation step.
// Escape is handled by the page through the overlay stack; this panel only offers Close.

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Info, PhoneCall, X } from "lucide-react";
import type { DecisionId } from "../../../game/narrative/chapter1/ids";
import type { DecisionOptionView, DecisionPanelView } from "../../../game/narrative/selectors";
import { UI } from "../theme";

export interface DecisionPanelProps {
  panel: DecisionPanelView;
  /** Dispatches VERIFY_CLAIM with the `official-line` method. */
  onStartOfficialCall: () => void;
  /** Dispatches MAKE_DECISION. Called only after the player confirms. */
  onDecide: (decisionId: DecisionId) => void;
  onClose: () => void;
}

export const DECISION_PANEL_TEXT = {
  heading: "Decide how to respond",
  intro: "Choose what to do about the call. You can keep looking around before you decide.",
  notOffered: "There is no decision to make right now.",
  stepOne: "Step 1",
  stepTwo: "Step 2",
  stepDone: "Done",
  confirmHeading: "Are you sure? This ends the chapter.",
  confirmChoiceLabel: "Your choice",
  confirm: "Confirm",
  back: "Back",
  close: "Close",
} as const;

const HEADING_ID = "decision-panel-heading";
const CONFIRM_HEADING_ID = "decision-panel-confirm-heading";

function hintId(id: string): string {
  return `decision-hint-${id}`;
}

const Hint: React.FC<{ id: string; text: string }> = ({ id, text }) => (
  <p id={id} className={`flex items-start gap-2 text-sm ${UI.textWarning}`}>
    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <span>{text}</span>
  </p>
);

const SimpleOption: React.FC<{ option: DecisionOptionView; onChoose: (id: DecisionId) => void }> = ({
  option,
  onChoose,
}) => {
  const describedBy = option.hint ? hintId(option.id) : undefined;
  return (
    <li className={`${UI.card} space-y-2`}>
      <button
        type="button"
        disabled={!option.available}
        aria-describedby={describedBy}
        onClick={() => onChoose(option.id)}
        className={`${UI.buttonSecondary} w-full justify-start text-left`}
      >
        {option.label}
      </button>
      {option.hint && <Hint id={hintId(option.id)} text={option.hint} />}
    </li>
  );
};

const TwoStepOption: React.FC<{
  option: DecisionOptionView;
  onStartOfficialCall: () => void;
  onChoose: (id: DecisionId) => void;
}> = ({ option, onStartOfficialCall, onChoose }) => {
  const preStep = option.preStep!;
  const preStepHintId = hintId(`${option.id}-pre-step`);
  // When the pre-step is not possible yet, the decision shows the same hint; show it once.
  const showDecisionHint = option.hint !== null && option.hint !== preStep.hint;

  return (
    <li className={`${UI.card} space-y-3`}>
      <div className="space-y-2">
        <p className={UI.label}>{DECISION_PANEL_TEXT.stepOne}</p>
        {preStep.done ? (
          <p className={`flex items-center gap-2 text-sm ${UI.textPositive}`}>
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{preStep.label}</span>
            <span className="font-semibold">{DECISION_PANEL_TEXT.stepDone}</span>
          </p>
        ) : (
          <button
            type="button"
            disabled={!preStep.available}
            aria-describedby={preStep.hint ? preStepHintId : undefined}
            onClick={onStartOfficialCall}
            className={`${UI.buttonSecondary} w-full justify-start text-left`}
          >
            <PhoneCall className="h-4 w-4 shrink-0" aria-hidden="true" />
            {preStep.label}
          </button>
        )}
        {preStep.hint && <Hint id={preStepHintId} text={preStep.hint} />}
      </div>

      <div className="space-y-2">
        <p className={UI.label}>{DECISION_PANEL_TEXT.stepTwo}</p>
        <button
          type="button"
          disabled={!option.available}
          aria-describedby={option.hint ? (showDecisionHint ? hintId(option.id) : preStepHintId) : undefined}
          onClick={() => onChoose(option.id)}
          className={`${UI.buttonSecondary} w-full justify-start text-left`}
        >
          {option.label}
        </button>
        {showDecisionHint && <Hint id={hintId(option.id)} text={option.hint!} />}
      </div>
    </li>
  );
};

export const DecisionPanel: React.FC<DecisionPanelProps> = ({ panel, onStartOfficialCall, onDecide, onClose }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null);
  const [pendingId, setPendingId] = useState<DecisionId | null>(null);

  // Drop the confirmation if the chosen option stops being available (for example a call rings).
  const pending = panel.options.find((option) => option.id === pendingId && option.available) ?? null;

  useEffect(() => {
    if (pending) confirmHeadingRef.current?.focus();
    else headingRef.current?.focus();
  }, [pending]);

  return (
    <div className={UI.backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={pending ? CONFIRM_HEADING_ID : HEADING_ID}
        className={`${UI.panel} max-w-lg space-y-4`}
      >
        {pending ? (
          <>
            <h2 id={CONFIRM_HEADING_ID} ref={confirmHeadingRef} tabIndex={-1} className={UI.heading}>
              {DECISION_PANEL_TEXT.confirmHeading}
            </h2>
            <div className={`${UI.card} space-y-1`}>
              <p className={UI.label}>{DECISION_PANEL_TEXT.confirmChoiceLabel}</p>
              <p className="text-sm text-[#f7f5ff]">{pending.label}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setPendingId(null)} className={UI.buttonSecondary}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {DECISION_PANEL_TEXT.back}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingId(null);
                  onDecide(pending.id);
                }}
                className={UI.buttonPrimary}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {DECISION_PANEL_TEXT.confirm}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id={HEADING_ID} ref={headingRef} tabIndex={-1} className={UI.heading}>
              {DECISION_PANEL_TEXT.heading}
            </h2>
            <p className={UI.body}>{panel.offered ? DECISION_PANEL_TEXT.intro : DECISION_PANEL_TEXT.notOffered}</p>
            <ul className="space-y-3">
              {panel.options.map((option) =>
                option.preStep ? (
                  <TwoStepOption
                    key={option.id}
                    option={option}
                    onStartOfficialCall={onStartOfficialCall}
                    onChoose={setPendingId}
                  />
                ) : (
                  <SimpleOption key={option.id} option={option} onChoose={setPendingId} />
                ),
              )}
            </ul>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className={UI.buttonSecondary}>
                <X className="h-4 w-4" aria-hidden="true" />
                {DECISION_PANEL_TEXT.close}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
