// "Click to resume", shown after the last overlay closes until pointer lock is active again
// (Requirement 4.4). The page handles the click on the game view; this element lets clicks through.

import React from "react";
import { MousePointerClick } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UI } from "../theme";

export interface ResumePromptProps {
  visible: boolean;
}

export const ResumePrompt: React.FC<ResumePromptProps> = ({ visible }) => {
  const { t } = useTranslation("chapter1");
  if (!visible) return null;
  return (
    <p
      data-testid="resume-prompt"
      className={`${UI.hudPanel} pointer-events-none flex items-center gap-2 font-semibold`}
    >
      <MousePointerClick className="h-4 w-4 text-[#b9a5f5]" aria-hidden="true" />
      {t("resume.prompt")}
    </p>
  );
};
