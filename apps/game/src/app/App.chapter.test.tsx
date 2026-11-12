import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChapterSession } from "../game/chapters/chapterSession";
import type { ChapterLoadRequest } from "../game/loading/chapterLoader";
import { SAVE_FORMAT_VERSION_V2, SAVE_STORAGE_KEY_V2, START_CHECKPOINT_ID } from "../game/saves/saveGame";
import { TEST_CHAPTER } from "../test/fakeAssets";

// Routing tests for the App shell (Requirements 1.1, 1.2, 1.3, 1.7). The 3D canvas, the chapter
// loader flow and the chapter page are replaced by small stubs; the menu and placeholder are real.

const harness = vi.hoisted(() => ({
  /** Chapter ID the loading stub puts in the session it hands to the App. */
  sessionChapterId: "chapter-1",
  loadingRequest: null as ChapterLoadRequest | null,
}));

vi.mock("../game/core/GameCanvas", () => ({ GameCanvas: () => <div data-testid="menu-canvas" /> }));
vi.mock("../features/loading/MenuStartupLoading", () => ({ MenuStartupLoading: () => null }));
vi.mock("../features/hochiminh", () => ({ HCMPage: () => null }));
vi.mock("../features/testmove", () => ({ TestMovePage: () => null }));
vi.mock("../features/ueh", () => ({ UEHPage: () => null }));
vi.mock("../features/hue", () => ({ HuePage: () => null }));

vi.mock("../features/loading/ChapterLoadingFlow", () => ({
  ChapterLoadingFlow: (props: {
    request: ChapterLoadRequest;
    onEnterChapter: (session: ChapterSession) => void;
    onBackToMenu: () => void;
  }) => {
    harness.loadingRequest = props.request;
    const session: ChapterSession = {
      chapterId: harness.sessionChapterId,
      chapterNumber: 1,
      sceneId: "street",
      origin: "new-game",
    };
    return (
      <div data-testid="chapter-loading">
        <button type="button" onClick={() => props.onEnterChapter(session)}>
          Stub enter chapter
        </button>
        <button type="button" onClick={props.onBackToMenu}>
          Stub loading back
        </button>
      </div>
    );
  },
}));

vi.mock("../features/chapter1/ChapterOnePage", () => ({
  ChapterOnePage: (props: { session: ChapterSession; onReturnToMenu: () => void }) => (
    <div data-testid="chapter-one-page" data-chapter-id={props.session.chapterId}>
      <button type="button" onClick={props.onReturnToMenu}>
        Stub return to menu
      </button>
    </div>
  ),
}));

// The real registry plus one test chapter whose gameplay is not available.
vi.mock("../game/chapters/chapterRegistry", async (importOriginal) => {
  const original = await importOriginal<typeof import("../game/chapters/chapterRegistry")>();
  const { TEST_CHAPTER: testChapter } = await import("../test/fakeAssets");
  return {
    ...original,
    getChapter: (id: string) => (id === testChapter.id ? testChapter : original.getChapter(id)),
  };
});

import { App } from "./App";

function continueButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /CONTINUE/ }) as HTMLButtonElement;
}

/** Menu → NEW GAME → prologue "Begin Chapter 1" → loading stub → enter the chapter. */
function startNewGameAndEnterChapter() {
  fireEvent.click(screen.getByRole("button", { name: /NEW GAME/ }));
  fireEvent.click(screen.getByRole("button", { name: "Begin Chapter 1" }));
  expect(screen.getByTestId("chapter-loading")).toBeTruthy();
  expect(harness.loadingRequest).toEqual({ kind: "new-game", chapterId: "chapter-1" });
  fireEvent.click(screen.getByRole("button", { name: "Stub enter chapter" }));
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  harness.sessionChapterId = "chapter-1";
  harness.loadingRequest = null;
});

afterEach(() => {
  window.localStorage.clear();
});

describe("App chapter routing", () => {
  it("renders the main menu with Continue disabled when nothing is saved", () => {
    render(<App />);
    expect(screen.getByRole("navigation", { name: "Game Main Menu" })).toBeTruthy();
    expect(screen.getByTestId("menu-canvas")).toBeTruthy();
    expect(continueButton().disabled).toBe(true);
  });

  it("renders the Chapter 1 page, not the placeholder, after New Game loading", () => {
    render(<App />);
    startNewGameAndEnterChapter();

    expect(screen.getByTestId("chapter-one-page").getAttribute("data-chapter-id")).toBe("chapter-1");
    expect(screen.queryByText("Gameplay for this chapter is still in development.")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Game Main Menu" })).toBeNull();
    // The menu canvas stays mounted underneath.
    expect(screen.getByTestId("menu-canvas")).toBeTruthy();
  });

  it("renders the placeholder for a chapter whose gameplay is not available", () => {
    harness.sessionChapterId = TEST_CHAPTER.id;
    render(<App />);
    startNewGameAndEnterChapter();

    expect(screen.getByText("Gameplay for this chapter is still in development.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: TEST_CHAPTER.title })).toBeTruthy();
    expect(screen.queryByTestId("chapter-one-page")).toBeNull();
  });

  it("returns to the menu from the chapter page and re-reads Continue availability", () => {
    render(<App />);
    expect(continueButton().disabled).toBe(true);
    startNewGameAndEnterChapter();

    // The chapter wrote a Checkpoint while it was open.
    window.localStorage.setItem(
      SAVE_STORAGE_KEY_V2,
      JSON.stringify({
        formatVersion: SAVE_FORMAT_VERSION_V2,
        chapterId: "chapter-1",
        sceneId: "street",
        savedAt: "2026-11-08T08:00:00.000Z",
        progress: { checkpointId: START_CHECKPOINT_ID, actions: [{ type: "START_CHAPTER" }], playerPose: null },
      }),
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Stub return to menu" }));
    });

    expect(screen.queryByTestId("chapter-one-page")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Game Main Menu" })).toBeTruthy();
    expect(continueButton().disabled).toBe(false);
  });

  it("returns to the menu when the loading flow is left", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /NEW GAME/ }));
    fireEvent.click(screen.getByRole("button", { name: "Begin Chapter 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Stub loading back" }));

    expect(screen.queryByTestId("chapter-loading")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Game Main Menu" })).toBeTruthy();
  });
});
