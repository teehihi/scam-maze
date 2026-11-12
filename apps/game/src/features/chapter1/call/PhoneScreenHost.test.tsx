// PhoneScreenHost unit tests (task 8.4). Requirements 8.3, 8.6, 10.5 and 10.7.
import { act, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { computeCallLayout, SCREEN_CORNER_RATIO } from "./callLayout";
import type { Rect } from "./callLayout";
import { createPhoneScreenSink } from "./phoneScreenSink";
import { PhoneScreenHost } from "./PhoneScreenHost";
import type { PhoneScreenHostMode } from "./PhoneScreenHost";

const LAYOUT = computeCallLayout({ width: 1280, height: 800 });

/** Child that counts its own renders, standing in for the single `PhoneScreenUI`. */
function makeCountingChild(): { Child: React.FC; renders: () => number } {
  let count = 0;
  const Child: React.FC = () => {
    count += 1;
    return <div data-testid="screen-child">screen</div>;
  };
  return { Child, renders: () => count };
}

function hostElement(): HTMLElement {
  return screen.getByTestId("phone-screen-host");
}

/** Parses a `"<n>px"` value. jsdom serializes CSS numbers with at most 3 decimals. */
function px(value: string): number {
  expect(value).toMatch(/^-?[\d.]+px$/);
  return Number.parseFloat(value);
}

function expectRect(element: HTMLElement, rect: Rect): void {
  const match = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\)$/.exec(element.style.transform);
  expect(match).not.toBeNull();
  expect(Number(match?.[1])).toBeCloseTo(rect.left, 2);
  expect(Number(match?.[2])).toBeCloseTo(rect.top, 2);
  expect(px(element.style.width)).toBeCloseTo(rect.width, 2);
  expect(px(element.style.height)).toBeCloseTo(rect.height, 2);
}

describe("PhoneScreenHost", () => {
  it.each<PhoneScreenHostMode>(["pending", "fallback"])(
    "%s mode places the slot at layout.screen",
    (mode) => {
      const sink = createPhoneScreenSink();
      render(
        <PhoneScreenHost mode={mode} layout={LAYOUT} screenSink={sink}>
          <span />
        </PhoneScreenHost>,
      );
      const host = hostElement();
      expectRect(host, LAYOUT.screen);
      expect(px(host.style.borderRadius)).toBeCloseTo(LAYOUT.screenCornerRadius, 2);
      expect(host.style.position).toBe("fixed");
    },
  );

  it("pending mode is invisible and fallback mode is visible with a bezel", () => {
    const sink = createPhoneScreenSink();
    const { rerender } = render(
      <PhoneScreenHost mode="pending" layout={LAYOUT} screenSink={sink}>
        <span />
      </PhoneScreenHost>,
    );
    expect(hostElement().style.opacity).toBe("0");

    rerender(
      <PhoneScreenHost mode="fallback" layout={LAYOUT} screenSink={sink}>
        <span />
      </PhoneScreenHost>,
    );
    expect(hostElement().style.opacity).toBe("");
    expect(hostElement().style.outline).not.toBe("");
  });

  it("model mode follows sink publications without re-rendering the child", () => {
    const sink = createPhoneScreenSink();
    const { Child, renders } = makeCountingChild();
    render(
      <PhoneScreenHost mode="model" layout={LAYOUT} screenSink={sink}>
        <Child />
      </PhoneScreenHost>,
    );
    const host = hostElement();
    // No rectangle yet: the slot keeps the layout target.
    expectRect(host, LAYOUT.screen);
    const rendersAfterMount = renders();

    const first: Rect = { left: 410, top: 60, width: 300, height: 650 };
    const second: Rect = { left: 420.5, top: 64, width: 302, height: 654 };
    act(() => sink.publish(first));
    expectRect(host, first);
    expect(px(host.style.borderRadius)).toBeCloseTo(SCREEN_CORNER_RATIO * first.width, 2);
    act(() => sink.publish(second));
    expectRect(host, second);

    // `null` keeps the last rectangle until the parent switches modes.
    act(() => sink.publish(null));
    expectRect(host, second);

    expect(renders()).toBe(rendersAfterMount);
    expect(host.style.opacity).toBe("");
  });

  it("model mode starts from the current sink rectangle when one exists", () => {
    const sink = createPhoneScreenSink();
    const rect: Rect = { left: 500, top: 80, width: 280, height: 600 };
    sink.publish(rect);
    render(
      <PhoneScreenHost mode="model" layout={LAYOUT} screenSink={sink}>
        <span />
      </PhoneScreenHost>,
    );
    expectRect(hostElement(), rect);
  });

  it("switching modes keeps the same host and child DOM nodes", () => {
    const sink = createPhoneScreenSink();
    const { Child } = makeCountingChild();
    const renderMode = (mode: PhoneScreenHostMode) => (
      <PhoneScreenHost mode={mode} layout={LAYOUT} screenSink={sink}>
        <Child />
      </PhoneScreenHost>
    );
    const { rerender } = render(renderMode("pending"));
    const host = hostElement();
    const child = screen.getByTestId("screen-child");

    const rect: Rect = { left: 430, top: 70, width: 290, height: 630 };
    rerender(renderMode("model"));
    act(() => sink.publish(rect));
    expectRect(hostElement(), rect);

    rerender(renderMode("fallback"));
    expectRect(hostElement(), LAYOUT.screen);

    rerender(renderMode("model"));
    expectRect(hostElement(), rect);

    for (const mode of ["model", "fallback", "pending"] as const) {
      rerender(renderMode(mode));
      expect(hostElement()).toBe(host);
      expect(screen.getByTestId("screen-child")).toBe(child);
      expect(hostElement().dataset.mode).toBe(mode);
    }
  });

  it("model mode maps the screen onto a tilted quad with matrix3d", () => {
    const sink = createPhoneScreenSink();
    render(
      <PhoneScreenHost mode="model" layout={LAYOUT} screenSink={sink}>
        <span />
      </PhoneScreenHost>,
    );
    const quad = [
      { x: 820, y: 90 },
      { x: 1110, y: 104 },
      { x: 1104, y: 712 },
      { x: 824, y: 724 },
    ] as const;
    act(() => sink.publish({ left: 820, top: 90, width: 290, height: 634, quad }));
    const host = hostElement();
    expect(host.style.transform.startsWith("matrix3d(")).toBe(true);
    expect(host.style.transformOrigin).toMatch(/^0(px)? 0(px)?$/);
    // Natural size: the mean length of opposite edges.
    expect(px(host.style.width)).toBeCloseTo((Math.hypot(290, 14) + Math.hypot(280, 12)) / 2, 2);
    expect(px(host.style.height)).toBeCloseTo((Math.hypot(4, 634) + Math.hypot(6, 608)) / 2, 2);

    // A flat rectangle again goes back to the plain translate.
    const flat: Rect = { left: 410, top: 60, width: 300, height: 650 };
    act(() => sink.publish(flat));
    expectRect(host, flat);
  });
  it("stops following the sink after leaving model mode", () => {
    const sink = createPhoneScreenSink();
    const { rerender } = render(
      <PhoneScreenHost mode="model" layout={LAYOUT} screenSink={sink}>
        <span />
      </PhoneScreenHost>,
    );
    rerender(
      <PhoneScreenHost mode="fallback" layout={LAYOUT} screenSink={sink}>
        <span />
      </PhoneScreenHost>,
    );
    act(() => sink.publish({ left: 1, top: 2, width: 100, height: 200 }));
    expectRect(hostElement(), LAYOUT.screen);
  });
});
