import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingScreen } from "./LoadingScreen";
import { LoadingTip } from "./LoadingTip";
import { WebGLFallback } from "./WebGLFallback";
import { createLoadingError, type LoadingErrorCode } from "../../game/loading/loadingErrors";
import { applyLocale, i18n } from "../../i18n";
import enLoading from "../../i18n/locales/en/loading";
import viLoading from "../../i18n/locales/vi/loading";

const TIPS = ["First tip.", "Second tip.", "Third tip."];
const ERROR_CODES = Object.keys(enLoading.errors) as LoadingErrorCode[];

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

describe("LoadingScreen in Vietnamese", () => {
  it("formats the percentage with Intl for vi and translates the bar label and Cancel", () => {
    applyLocale("vi");
    render(
      <LoadingScreen
        eyebrow="Chương 1"
        chapterTitle="Cuộc gọi khẩn cấp"
        loadingStage="Đang tải con phố"
        progress={0.42}
        progressDetail="0 / 2 tệp"
        onCancel={() => {}}
      />,
    );
    const bar = screen.getByRole("progressbar", { name: "Tiến trình tải" });
    const expectedPercent = new Intl.NumberFormat("vi", { style: "percent", maximumFractionDigits: 0 }).format(0.42);
    expect(bar.getAttribute("aria-valuetext")).toBe(expectedPercent);
    expect(screen.getByText(expectedPercent)).toBeTruthy();
    expect(screen.getByText("Đang tải con phố")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeTruthy();
  });

  it.each(ERROR_CODES)("shows the Vietnamese title and message for the %s error", (code) => {
    applyLocale("vi");
    const error = createLoadingError(code, "HTTP 503");
    render(
      <LoadingScreen
        eyebrow="Chương 1"
        chapterTitle="T"
        loadingStage="Tải không thành công"
        progress={null}
        error={error}
        onRetry={() => {}}
        onBackToMenu={() => {}}
      />,
    );
    const { title, message } = viLoading.errors[code];
    expect(title).not.toBe(enLoading.errors[code].title);
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText(enLoading.errors[code].title)).toBeNull();
    // Technical detail stays untranslated plain text.
    expect(screen.getByText("HTTP 503")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Về menu chính" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thử lại" }) !== null).toBe(error.retryable);
  });

  it("runs Retry and Return to menu from the Vietnamese buttons", () => {
    applyLocale("vi");
    const onRetry = vi.fn();
    const onBackToMenu = vi.fn();
    render(
      <LoadingScreen
        eyebrow="Chương 1"
        chapterTitle="T"
        loadingStage="Tải không thành công"
        progress={null}
        error={createLoadingError("network")}
        onRetry={onRetry}
        onBackToMenu={onBackToMenu}
      />,
    );
    expect(screen.getByRole("heading", { name: "Lỗi kết nối" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    fireEvent.click(screen.getByRole("button", { name: "Về menu chính" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBackToMenu).toHaveBeenCalledTimes(1);
  });

  it("updates the error text in place when the language changes at runtime", () => {
    render(
      <LoadingScreen
        eyebrow="Chapter 1"
        chapterTitle="T"
        loadingStage="Loading failed"
        progress={null}
        error={createLoadingError("stalled")}
        onRetry={() => {}}
        onBackToMenu={() => {}}
      />,
    );
    const heading = screen.getByRole("heading", { name: "Loading stopped" });
    const retry = screen.getByRole("button", { name: "Try again" });
    act(() => applyLocale("vi"));
    // Same DOM nodes: the text changed without a remount.
    expect(heading.textContent).toBe("Quá trình tải đã dừng");
    expect(screen.getByRole("heading", { name: "Quá trình tải đã dừng" })).toBe(heading);
    expect(screen.getByRole("button", { name: "Thử lại" })).toBe(retry);
    expect(screen.getByRole("button", { name: "Về menu chính" })).toBeTruthy();
  });
});

describe("LoadingTip in Vietnamese", () => {
  it("shows the Vietnamese tip label, next button and tip text", () => {
    applyLocale("vi");
    const tips = [i18n.t("loading:tips.otp"), i18n.t("loading:tips.urgency")];
    expect(tips[0]).toBe(viLoading.tips.otp);
    render(<LoadingTip tips={tips} intervalMs={1000} />);
    expect(screen.getByRole("complementary", { name: "Mẹo cảnh giác" })).toBeTruthy();
    expect(screen.getByText("Mẹo cảnh giác")).toBeTruthy();
    expect(screen.getByTestId("loading-tip-text").textContent).toBe(viLoading.tips.otp);
    fireEvent.click(screen.getByRole("button", { name: "Mẹo tiếp theo" }));
    expect(screen.getByTestId("loading-tip-text").textContent).toBe(viLoading.tips.urgency);
  });
});

describe("WebGLFallback", () => {
  it("shows the English text and the check site as plain text", () => {
    render(<WebGLFallback error="WebGL2 context lost" />);
    expect(screen.getByRole("heading", { name: enLoading.webgl.heading })).toBeTruthy();
    expect(screen.getByRole("button", { name: enLoading.webgl.reload })).toBeTruthy();
    expect(screen.getByText("get.webgl.org").tagName).toBe("CODE");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the Vietnamese text, keeps the check site and the technical detail unchanged", () => {
    applyLocale("vi");
    render(<WebGLFallback error="WebGL2 context lost" />);
    expect(screen.getByRole("heading", { name: "Không dùng được tăng tốc WebGL" })).toBeTruthy();
    expect(screen.getByText(viLoading.webgl.body)).toBeTruthy();
    expect(screen.getByText(viLoading.webgl.troubleshootingTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: viLoading.webgl.reload })).toBeTruthy();
    expect(screen.getByText("get.webgl.org").tagName).toBe("CODE");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("WebGL2 context lost")).toBeTruthy();
  });

  it("switches to Vietnamese at runtime without a remount", () => {
    render(<WebGLFallback />);
    const heading = screen.getByRole("heading", { name: enLoading.webgl.heading });
    act(() => applyLocale("vi"));
    expect(heading.textContent).toBe(viLoading.webgl.heading);
  });
});
