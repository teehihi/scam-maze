// The two simulated UEH sites on their own: the student portal and the look-alike clearance site.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceActionView, DeviceItemView, DeviceView } from "../../../../../../game/narrative/device";
import { applyLocale } from "../../../../../../i18n";
import { urlOfPage } from "../sites";
import { ClearanceSite } from "./ClearanceSite";
import { PortalSite, type PortalFacts } from "./PortalSite";

function item(id: string, extra: Partial<DeviceItemView> = {}): DeviceItemView {
  return {
    id,
    app: "mail",
    title: id,
    from: null,
    detail: null,
    body: "",
    folder: null,
    arrivedAtMinute: 0,
    read: false,
    tracksUnread: true,
    startsAtMinute: null,
    endsAtMinute: null,
    amount: null,
    actions: [],
    conversation: [],
    figures: null,
    ...extra,
  };
}

function act1(id: string, extra: Partial<DeviceActionView> = {}): DeviceActionView {
  return { id, label: id, timeCostMinutes: 2, cashCost: 0, available: true, blocked: null, placesCall: false, speaks: false, ...extra };
}

const doneAction = (id: string) => act1(id, { available: false, blocked: "done" });

function viewOf(mail: DeviceItemView[] = [], files: DeviceItemView[] = [], progress = 60): DeviceView {
  return { apps: { mail, files }, calendar: { minutesLeft: 4230, thesisProgress: progress, submission: "not-submitted", now: 0 } } as unknown as DeviceView;
}

const FACTS: PortalFacts = { accountLocked: false, draftFinished: false, tasksDone: [] };

const savedPortal = (action: DeviceActionView = act1("check-account", { timeCostMinutes: 15 })) =>
  item("portal.saved", { app: "files", folder: "bookmarks", actions: [action] });

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("UEH Student Portal", () => {
  function portal(section: "dashboard" | "thesis" | "services" | "account", over: { view?: DeviceView; facts?: PortalFacts } = {}) {
    const go = vi.fn();
    const onUseItem = vi.fn();
    const rendered = render(<PortalSite section={section} view={over.view ?? viewOf([], [savedPortal()])} facts={over.facts ?? FACTS} go={go} onUseItem={onUseItem} />);
    return { go, onUseItem, unmount: rendered.unmount };
  }

  it("shows the dashboard: the student, the status, the key dates and the notices, with breadcrumbs and a sidebar", () => {
    portal("dashboard");
    expect(screen.getByTestId("portal-site").getAttribute("data-section")).toBe("dashboard");
    expect(screen.getByText("Welcome, Alex")).toBeTruthy();
    expect(screen.getByText("Final-year international student")).toBeTruthy();
    expect(screen.getByTestId("portal-access-dashboard").textContent).toBe("Not yet checked");
    expect(screen.getByText("Friday, 17:00")).toBeTruthy();
    expect(screen.getByText("Thesis submission closes on Friday at 17:00")).toBeTruthy();
    expect(screen.getByTestId("site-breadcrumbs")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Portal sections" })).toBeTruthy();
    expect(screen.getByTestId("portal-nav-dashboard").getAttribute("aria-current")).toBe("page");
  });

  it("offers a real submit action only when the draft, account and access are ready, then shows a receipt", () => {
    const readyFacts: PortalFacts = {
      accountLocked: false,
      accessVerified: true,
      draftFinished: true,
      tasksDone: ["draft.intro-review", "draft.findings", "draft.final"],
    };
    const { onUseItem, unmount } = portal("thesis", {
      view: viewOf([], [savedPortal(act1("submit-thesis", { timeCostMinutes: 5 }))]),
      facts: readyFacts,
    });
    fireEvent.click(screen.getByTestId("portal-submit-thesis"));
    expect(onUseItem).toHaveBeenCalledWith("portal.saved", "submit-thesis");
    expect(screen.getByTestId("portal-submission-status").textContent).toBe("Not submitted");
    unmount();

    const submittedView = viewOf([], [savedPortal(act1("submit-thesis", { available: false, blocked: "done" }))]);
    submittedView.calendar.submission = "submitted";
    portal("thesis", { view: submittedView, facts: readyFacts });
    expect(screen.getByTestId("portal-submission-receipt").textContent).toContain("Submission received");
  });

  it("states that it is a game simulation and uses the school's name", () => {
    portal("dashboard");
    expect(screen.getByText("Game simulation. This is not the official UEH website.")).toBeTruthy();
    expect(screen.getByTestId("ueh-mark").textContent).toContain("University of Economics Ho Chi Minh City");
  });

  it("navigates between its pages with the sidebar", () => {
    const { go } = portal("dashboard");
    fireEvent.click(screen.getByTestId("portal-nav-thesis"));
    expect(go).toHaveBeenLastCalledWith(urlOfPage("portal-thesis"));
    fireEvent.click(screen.getByTestId("portal-nav-services"));
    expect(go).toHaveBeenLastCalledWith(urlOfPage("portal-services"));
    fireEvent.click(screen.getByTestId("portal-nav-account"));
    expect(go).toHaveBeenLastCalledWith(urlOfPage("portal-account"));
  });

  it("shows the thesis progress, the tasks and the Friday 17:00 deadline from the game", () => {
    portal("thesis", { view: viewOf([], [savedPortal()], 62), facts: { accountLocked: false, draftFinished: false, tasksDone: ["draft.findings"] } });
    expect(screen.getByTestId("portal-thesis-progress").textContent).toBe("62% complete");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("62");
    expect(screen.getByTestId("portal-task-findings").getAttribute("data-done")).toBe("true");
    expect(screen.getByTestId("portal-task-intro").getAttribute("data-done")).toBe("false");
    expect(screen.getByTestId("portal-draft-status").textContent).toBe("In progress");
    expect(screen.getByText("Friday, 17:00")).toBeTruthy();
    expect(screen.getByTestId("portal-access-thesis").textContent).toBe("Not yet checked");
  });

  it("lists the published fees, and no international student confirmation fee", () => {
    portal("services");
    expect(screen.getByTestId("portal-fee-thesis").textContent).toContain("No fee");
    expect(screen.getByTestId("portal-fee-transcript").textContent).toContain("30,000 VND");
    expect(screen.getByTestId("portal-fees").textContent).not.toMatch(/confirmation/i);
    expect(screen.getByTestId("portal-payment-domain").textContent).toBe("payment.ueh.edu.vn");
    expect(screen.queryByRole("link", { name: "payment.ueh.edu.vn" })).toBeNull();
    expect(screen.getByTestId("portal-training-phone").textContent).toBe("+000 100 0200");
    expect(screen.getByTestId("portal-training-email").textContent).toBe("training@ueh.edu.vn");
  });

  it("checks the account only when the player asks, through the story's saved-portal action", () => {
    const { onUseItem } = portal("account");
    expect(screen.queryByTestId("portal-check-result")).toBeNull();
    expect(onUseItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("portal-check-account"));
    expect(onUseItem).toHaveBeenCalledWith("portal.saved", "check-account");
    expect(onUseItem).toHaveBeenCalledTimes(1);
  });

  it("shows the result once the check is done, and the locked state when the account was taken over", () => {
    portal("account", { view: viewOf([], [savedPortal(doneAction("check-account"))]), facts: { ...FACTS, accountLocked: true } });
    expect(screen.getByTestId("portal-check-result").textContent).toContain("Fees owed: none");
    expect(screen.queryByTestId("portal-check-account")).toBeNull();
    expect(screen.getByTestId("portal-access-account").textContent).toBe("Access locked");
  });

  it("shows in Vietnamese", () => {
    act(() => {
      applyLocale("vi");
    });
    portal("services");
    expect(screen.getByRole("heading", { level: 2, name: "Dịch vụ sinh viên" })).toBeTruthy();
    expect(screen.getByTestId("portal-payment-domain").textContent).toBe("payment.ueh.edu.vn");
    expect(screen.getByText("Cổng thanh toán (được ghi trong sổ tay sinh viên)")).toBeTruthy();
    expect(screen.getByText("Mô phỏng trong trò chơi. Đây không phải website chính thức của UEH.")).toBeTruthy();
  });
});

describe("the look-alike clearance site", () => {
  const FEE = "https://payment-ueh.vn/confirm";
  const source = item("mail.src", { body: `Pay: ${FEE}`, actions: [act1("open-link")] });

  function pageItem(done: { signIn?: boolean; pay?: boolean; code?: boolean } = {}, extra: Partial<DeviceItemView> = {}) {
    return item("page.fee", {
      detail: "payment-ueh.vn",
      actions: [
        act1("close"),
        done.signIn ? doneAction("sign-in") : act1("sign-in"),
        ...(done.signIn ? [done.pay ? doneAction("pay-card") : act1("pay-card", { cashCost: 800000 })] : []),
        ...(done.pay ? [done.code ? doneAction("enter-code") : act1("enter-code")] : []),
      ],
      ...extra,
    });
  }

  function site(step: "notice" | "login" | "payment" | "verify" | "complete", done: { signIn?: boolean; pay?: boolean; code?: boolean } = {}, fields: Record<string, string> = {}) {
    const go = vi.fn();
    const onUseItem = vi.fn();
    const setFields = vi.fn();
    render(
      <ClearanceSite
        page={{ id: "fee", url: FEE, kind: "clearance", step }}
        step={step}
        view={viewOf([source, pageItem(done)])}
        fields={fields}
        setFields={setFields}
        go={go}
        onOpenItem={vi.fn()}
        onUseItem={onUseItem}
      />,
    );
    return { go, onUseItem, setFields };
  }

  it("looks like an academic services page with the school's name, the fee and a deadline, and carries no verdict", () => {
    site("notice");
    expect(screen.getByTestId("ueh-mark").textContent).toContain("UEH");
    expect(screen.getByTestId("clearance-fee").textContent).toBe("800,000 VND");
    expect(screen.getByText("Today, 23:59")).toBeTruthy();
    expect(screen.getByTestId("clearance-nav").textContent).toContain("Thesis submission");
    expect(screen.getByTestId("clearance-site").textContent).not.toMatch(/scam|fake|phish|fraud|warning|dangerous|unsafe|suspicious|official fee/i);
    expect(screen.getByText("Game simulation. This is not the official UEH website.")).toBeTruthy();
  });

  it("differs from the portal in details a careful player can find, without saying so", () => {
    site("notice");
    const footer = screen.getByTestId("clearance-footer").textContent ?? "";
    expect(footer).toContain("Graduation Clearance Office");
    expect(footer).not.toContain("+000 100 0200");
    expect(footer).toContain("payment-ueh.vn");
    expect(footer).not.toContain("training@ueh.edu.vn");
  });

  it("moves between pages without touching the story", () => {
    const { go, onUseItem } = site("notice");
    fireEvent.click(screen.getByTestId("clearance-continue"));
    expect(go).toHaveBeenCalledWith(urlOfPage("fee-login"));
    expect(onUseItem).not.toHaveBeenCalled();
  });

  it("fills the login form with the game's details and signs in only on the sign in button", () => {
    const first = site("login");
    fireEvent.focus(screen.getByTestId("login-id"));
    fireEvent.click(screen.getByTestId("login-fill"));
    expect(first.setFields).toHaveBeenCalledWith({ "login.id": "ALEX-0001", "login.password": "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" });
    expect(first.onUseItem).not.toHaveBeenCalled();
    expect(screen.getByTestId("login-submit").hasAttribute("disabled")).toBe(true);
  });

  it("signs in with filled fields: one core action, then the payment page", () => {
    const { go, onUseItem } = site("login", {}, { "login.id": "ALEX-0001", "login.password": "x" });
    fireEvent.click(screen.getByTestId("login-submit"));
    expect(onUseItem).toHaveBeenCalledTimes(1);
    expect(onUseItem).toHaveBeenCalledWith("page.fee", "sign-in");
    expect(go).toHaveBeenCalledWith(urlOfPage("fee-payment"));
  });

  it("asks to sign in first when the payment page is opened without signing in", () => {
    const { onUseItem } = site("payment");
    expect(screen.getByTestId("fake-step-needlogin")).toBeTruthy();
    expect(onUseItem).not.toHaveBeenCalled();
  });

  it("pays only on the pay button with the card filled in, and then goes on to verification", () => {
    const { go, onUseItem } = site("payment", { signIn: true }, { "pay.holder": "ALEX", "pay.number": "\u2022\u2022\u2022\u2022 0451", "pay.expiry": "04/28", "pay.cvc": "\u2022\u2022\u2022" });
    expect(onUseItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("pay-submit"));
    expect(onUseItem).toHaveBeenCalledWith("page.fee", "pay-card");
    expect(go).toHaveBeenCalledWith(urlOfPage("fee-verify"));
  });

  it("gives the verification code only on the confirm button, after the payment", () => {
    const { go, onUseItem } = site("verify", { signIn: true, pay: true }, { "verify.code": "481206" });
    fireEvent.click(screen.getByTestId("verify-submit"));
    expect(onUseItem).toHaveBeenCalledTimes(1);
    expect(onUseItem).toHaveBeenCalledWith("page.fee", "enter-code");
    expect(go).toHaveBeenCalledWith(urlOfPage("fee-complete"));
  });

  it("refuses a code that is not the one from the bank's text", () => {
    const { onUseItem } = site("verify", { signIn: true, pay: true }, { "verify.code": "123456" });
    fireEvent.click(screen.getByTestId("verify-submit"));
    expect(onUseItem).not.toHaveBeenCalled();
    expect(screen.getByTestId("verify-code").getAttribute("aria-invalid")).toBe("true");
  });
  it("types the game's fictional login whatever keys are pressed, and never takes a paste", () => {
    const { setFields } = site("login");
    const id = screen.getByTestId("login-id");
    fireEvent.keyDown(id, { key: "m" });
    expect(setFields).toHaveBeenLastCalledWith({ "login.id": "A" });
    fireEvent.paste(id, { clipboardData: { getData: () => "my-real-password" } });
    expect(setFields).toHaveBeenCalledTimes(1);
  });
  it("does not show the verification step before the payment, nor a thank-you before the code", () => {
    site("verify", { signIn: true });
    expect(screen.getByTestId("fake-step-needpayment")).toBeTruthy();
  });

  it("shows the thank-you page only after the whole chain", () => {
    site("complete", { signIn: true, pay: true, code: true });
    expect(within(screen.getByTestId("fake-step-complete")).getByText("Thank you")).toBeTruthy();
  });

  it("shows the thank-you page as empty when the chain was not completed", () => {
    site("complete", { signIn: true });
    expect(screen.getByTestId("fake-step-notdone")).toBeTruthy();
  });

  it("shows in Vietnamese", () => {
    act(() => {
      applyLocale("vi");
    });
    site("notice");
    expect(screen.getByTestId("clearance-fee").textContent).toBe("800.000 VNĐ");
    expect(screen.getByText("Hôm nay, 23:59")).toBeTruthy();
    expect(screen.getByText("Mô phỏng trong trò chơi. Đây không phải website chính thức của UEH.")).toBeTruthy();
  });
});
