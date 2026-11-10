import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingScreen } from "./LoadingScreen";
import { LoadingTip } from "./LoadingTip";
import { createLoadingError } from "../../game/loading/loadingErrors";

const TIPS = ["First tip.", "Second tip.", "Third tip."];

afterEach(() => {
  vi.useRealTimers();
});

describe("LoadingScreen", () => {
  it("renders chapter branding, status and a determinate bar", () => {
    render(
      <LoadingScreen
        eyebrow="Chapter 1"
        chapterTitle="The Urgent Call"
        subtitle="The notification arrives before breakfast."
        loadingStage="Loading the street"
        progress={0.42}
        progressDetail="0 of 2 files"
      />,
    );
    expect(screen.getByRole("heading", { name: "The Urgent Call" })).toBeTruthy();
    expect(screen.getByText("SCAMMAZE")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText("42%")).toBeTruthy();
    expect(screen.getByText(/0 of 2 files/)).toBeTruthy();
  });

  it("renders no percentage for indeterminate progress", () => {
    render(<LoadingScreen eyebrow="Chapter 1" chapterTitle="T" loadingStage="Checking your device" progress={null} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Checking your device");
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it("replaces the progress area with a working error state", () => {
    const onRetry = vi.fn();
    const onBackToMenu = vi.fn();
    render(
      <LoadingScreen
        eyebrow="Chapter 1"
        chapterTitle="T"
        loadingStage="Loading failed"
        progress={null}
        error={createLoadingError("network", "HTTP 503")}
        onRetry={onRetry}
        onBackToMenu={onBackToMenu}
      />,
    );
    expect(screen.queryByRole("progressbar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Return to menu" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBackToMenu).toHaveBeenCalledTimes(1);
    expect(screen.getByText("HTTP 503")).toBeTruthy();
  });
});

describe("LoadingTip", () => {
  it("rotates tips on an interval and on demand", () => {
    vi.useFakeTimers();
    render(<LoadingTip tips={TIPS} intervalMs={1000} />);
    const text = () => screen.getByTestId("loading-tip-text").textContent;
    expect(text()).toBe("First tip.");
    act(() => vi.advanceTimersByTime(1000));
    expect(text()).toBe("Second tip.");
    fireEvent.click(screen.getByRole("button", { name: "Next tip" }));
    expect(text()).toBe("Third tip.");
  });

  it("pauses rotation while the tip has focus", () => {
    vi.useFakeTimers();
    render(<LoadingTip tips={TIPS} intervalMs={1000} />);
    fireEvent.focus(screen.getByRole("button", { name: "Next tip" }));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByTestId("loading-tip-text").textContent).toBe("First tip.");
  });
});
