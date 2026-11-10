import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
import { GAME_URL, REPO_URL, isGameAvailable } from "../../config/site";

/**
 * Every "ENTER THE GAME" control on the site goes through this module.
 *
 * - VITE_GAME_URL set    -> controls render as plain links to the game app.
 * - VITE_GAME_URL unset  -> controls open an intentional "being prepared"
 *                           dialog. Nothing pretends the game is playable.
 */

const GameEntryContext = createContext<{ openEntry: () => void } | null>(null);

export function useGameEntry() {
  const ctx = useContext(GameEntryContext);
  if (!ctx) throw new Error("useGameEntry must be used inside GameEntryProvider");
  return ctx;
}

export function GameEntryProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openEntry = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      setIsOpen(true);
    }
  }, []);

  const closeEntry = useCallback(() => dialogRef.current?.close(), []);

  // Keep the page behind the dialog from scrolling.
  useEffect(() => {
    document.documentElement.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  const value = useMemo(() => ({ openEntry }), [openEntry]);

  return (
    <GameEntryContext.Provider value={value}>
      {children}
      {!isGameAvailable && (
        <dialog
          ref={dialogRef}
          aria-labelledby="entry-title"
          aria-describedby="entry-desc"
          onClose={() => setIsOpen(false)}
          onClick={(e) => {
            // Clicks on the backdrop land on the <dialog> itself.
            if (e.target === e.currentTarget) closeEntry();
          }}
          className="m-auto w-[calc(100%-2rem)] max-w-xl border border-hairline bg-navy p-0 text-ivory backdrop:bg-graphite/85 backdrop:backdrop-blur-sm"
        >
          <div className="dialog-in relative overflow-hidden p-7 sm:p-10">
            <div aria-hidden="true" className="glow-purple pointer-events-none absolute inset-0 opacity-70" />
            <button
              type="button"
              onClick={closeEntry}
              aria-label="Close and return to the page"
              className="absolute right-4 top-4 grid size-10 place-items-center border border-hairline text-mist transition-colors hover:border-lavender hover:text-lavender"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <div className="relative">
              <p className="label flex items-center gap-2 text-amber">
                <span aria-hidden="true" className="size-1.5 bg-amber" />
                Entry status · Not yet open
              </p>
              <h2 id="entry-title" className="display mt-5 text-4xl sm:text-5xl">
                The world is being prepared.
              </h2>
              <p id="entry-desc" className="mt-5 leading-relaxed text-mist">
                The SCAMMAZE game is still in development, so there is nothing to play today. This site shows the world,
                the cases and the systems being built. When the game opens, this button will take you straight in.
              </p>

              <dl className="mt-7 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-t border-hairline pt-5 text-sm">
                <dt className="label text-lavender">Status</dt>
                <dd className="text-ivory">In development</dd>
                <dt className="label text-lavender">Playable</dt>
                <dd className="text-ivory">Not yet</dd>
              </dl>

              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" onClick={closeEntry} className="btn btn-primary" autoFocus>
                  Back to the page
                </button>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-ghost"
                >
                  Follow the build
                </a>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </GameEntryContext.Provider>
  );
}

interface EnterGameButtonProps {
  variant?: "primary" | "ghost" | "halloween" | "dark";
  className?: string;
  children?: ReactNode;
}

/** The only component that should be used for entering the game. */
export function EnterGameButton({ variant = "primary", className = "", children = "Enter the game" }: EnterGameButtonProps) {
  const ctx = useContext(GameEntryContext);
  if (!ctx) throw new Error("EnterGameButton must be used inside GameEntryProvider");

  const variantClass =
    variant === "halloween"
      ? "btn-halloween"
      : variant === "dark"
        ? "btn-dark"
        : variant === "primary"
          ? "btn-primary"
          : "btn-ghost";

  const classes = `btn ${variantClass} ${className}`;
  const content = (
    <>
      {children}
      <ArrowRight size={16} aria-hidden="true" className="btn-arrow" />
    </>
  );

  if (isGameAvailable && GAME_URL) {
    return (
      <a href={GAME_URL} className={classes}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={ctx.openEntry} className={classes} aria-haspopup="dialog">
      {content}
    </button>
  );
}
