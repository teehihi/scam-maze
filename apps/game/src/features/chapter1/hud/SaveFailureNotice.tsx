// HUD notice shown when a Checkpoint cannot be written (Requirement 15.14).
// A polite status region that stays until the player dismisses it. Gameplay continues.

import React from "react";
import { TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UI } from "../theme";

export interface SaveFailureNoticeProps {
  onDismiss: () => void;
}

export const SaveFailureNotice: React.FC<SaveFailureNoticeProps> = ({ onDismiss }) => {
  const { t } = useTranslation("chapter1");
  return (
    <div role="status" data-testid="save-failure-notice" className={`${UI.hudPanel} flex max-w-sm items-start gap-2`}>
      <TriangleAlert className={`mt-0.5 h-4 w-4 shrink-0 ${UI.textWarning}`} aria-hidden="true" />
      <span className="flex-1">{t("saveFailure.message")}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("saveFailure.dismiss")}
        className="shrink-0 cursor-pointer rounded p-0.5 text-[#a9a4c4] hover:text-[#f7f5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b9a5f5]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
