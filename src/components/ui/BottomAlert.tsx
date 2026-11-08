import { useState } from "react";
import { X } from "lucide-react";
import { EnterGameButton } from "./GameEntry";

export function BottomAlert() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <aside
      aria-label="Simulation Status Notification"
      className="fixed bottom-5 left-5 z-40 hidden max-w-md items-center gap-4 rounded-xl border border-hairline bg-navy-2/95 p-3.5 shadow-2xl backdrop-blur-md transition-all sm:flex"
    >
      <div className="flex-1 text-xs">
        <p className="font-semibold text-ivory flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-lavender animate-pulse" />
          <span className="font-display tracking-wider text-lavender">SCAMMAZE DISPATCH</span>
        </p>
        <p className="mt-1 text-mist leading-tight">
          Can you escape the digital scam maze? Spot the traps before you click!
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <EnterGameButton className="!min-h-9 !px-3.5 !text-xs !py-1" variant="primary">
          Enter
        </EnterGameButton>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notification"
          className="grid size-8 place-items-center rounded-lg text-mist hover:text-white transition-colors"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
