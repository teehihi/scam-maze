// Mission 01 "THE MISSING ACCESS" through the real phone and laptop UI, with the real scenario
// (no fixture): the email, the three ways to play it and what they leave in the state and the HUD.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

// Load the real routing and the real Vietnamese text instead of the suite-wide parked-story fixture.
vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function mountLayer() {
  const bridge = new RoomStoryBridge();
  bridge.commands = {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
  } satisfies RoomStoryCommands;
  let store: ChapterStore | null = null;
  // Free-roam time is driven by the test, not by the real clock.
  render(
    <RoomChapterLayer
      session={SESSION}
      settings={DEFAULT_SETTINGS}
      bridge={bridge}
      saveSource={SAVE_SOURCE}
      ringSettleMs={0}
      clockPaused
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  for (let i = 0; i < 12 && screen.queryByTestId("chapter-intro"); i += 1) fireEvent.click(screen.getByTestId("chapter-intro"));
  return {
    bridge,
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
  };
}

const openPhone = (rig: ReturnType<typeof mountLayer>) => {
  act(() => rig.bridge.onProp("phone", "inspect-ready"));
  fireEvent.click(screen.getByTestId("phone-unlock"));
  return screen.getByRole("dialog", { name: /Phone|Điện thoại/ });
};

describe("Mission 01 in the phone", () => {
  it("shows the current step and the email at 17:10 with a notice", () => {
    const rig = mountLayer();
    // The tracker names the concrete step and where it happens, not only the mission's goal.
    expect(screen.getByTestId("task-current").textContent).toBe("Edit the introduction and literature review");
    expect(screen.getByTestId("task-where").textContent).toContain("Laptop · Thesis");
    expect(screen.getByTestId("task-objective").textContent).toBe("Finish the draft by Wednesday, 06:00, and confirm you can sign in to submit by Friday, 17:00.");
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 10 }));
    expect(screen.getByTestId("event-arrival-notice").textContent).toContain("Graduation Clearance — Action Required");
    expect(screen.getByTestId("task-current").textContent).toBe("Read the new email about your submission account");
    const phone = openPhone(rig);
    expect(within(phone).getByTestId("phone-app-mail").textContent).toContain("4 unread");
    expect(within(phone).queryByTestId("phone-app-calendar")?.textContent).not.toMatch(/unread/);
    expect(phone.textContent).not.toMatch(/Northgate/i);
  });

  it("way A: opening the page loses nothing, the login opens the SECURITY BREACH, the code costs money", async () => {
    const rig = mountLayer();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 10 }));
    const phone = openPhone(rig);
    // The phone's own Mail and Browser: the link of the email opens the page in the phone browser.
    fireEvent.click(within(phone).getByTestId("phone-app-mail"));
    fireEvent.click(within(phone).getByTestId("mail-row-mail.clearance"));
    fireEvent.click(within(phone).getByTestId("mail-link"));
    await within(phone).findByTestId("fake-step-notice");
    expect(rig.store().getState().resources.cash).toBe(2_500_000);
    fireEvent.click(within(phone).getByTestId("clearance-continue"));
    await within(phone).findByTestId("fake-step-login");
    fireEvent.focus(within(phone).getByTestId("login-id"));
    fireEvent.click(within(phone).getByTestId("login-fill"));
    fireEvent.click(within(phone).getByTestId("login-submit"));
    await within(phone).findByTestId("fake-step-payment");
    expect(rig.store().getState().persistent.loginCredentialsExposed).toBe(true);
    expect(rig.store().getState().world.missions["m01.security-breach"].status).toBe("open");
    expect(screen.getByTestId("task-objective").textContent).toBe("Secure your accounts first. Finish the draft by Wednesday, 06:00; submit by Friday, 17:00.");
    expect(rig.store().getState().resources.cash).toBe(2_500_000);
    fireEvent.focus(within(phone).getByTestId("pay-number"));
    fireEvent.click(within(phone).getByTestId("pay-fill"));
    // The saved card leaves the security code to the player, as the browser does.
    for (const key of "123") fireEvent.keyDown(within(phone).getByTestId("pay-cvc"), { key });
    fireEvent.click(within(phone).getByTestId("pay-submit"));
    await within(phone).findByTestId("fake-step-verify");
    fireEvent.focus(within(phone).getByTestId("verify-code"));
    fireEvent.click(within(phone).getByTestId("verify-fill"));
    fireEvent.click(within(phone).getByTestId("verify-submit"));
    await within(phone).findByTestId("fake-step-complete");
    expect(rig.store().getState().resources.cash).toBe(1_700_000);
    expect(rig.store().getState().persistent.accountCompromised).toBe(true);
    expect(rig.store().getState().resources.digitalSecurity).toBe(50);
    // The HUD follows the state, and the objective changes with the mission path.
    act(() => rig.bridge.onProp("phone", "inspect-end"));
    expect(screen.getByTestId("resource-cash").textContent).toContain("1,700,000 VND");
    expect(screen.getByTestId("resource-security").textContent).toContain("50%");
  }, 20_000);

  it("way B: the portal and the Training Office cost time, create evidence and change the objective", async () => {
    const rig = mountLayer();
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByTestId("phone-app-files"));
    fireEvent.click(within(phone).getByTestId("files-folder-bookmarks"));
    fireEvent.click(within(phone).getByTestId("device-row-portal.saved"));
    fireEvent.click(within(phone).getByTestId("device-action-portal.saved-check-account"));
    // The saved portal is already an authoritative route: its active status confirms access without requiring a call.
    expect(rig.store().getState().persistent.schoolAccessVerified).toBe(true);
    expect(rig.store().getState().world.missions["m01.missing-access"].path).toBe("verified");
    expect(screen.getByTestId("task-objective").textContent).toBe("Portal access is confirmed. Finish the draft by Wednesday, 06:00; submit by Friday, 17:00.");
    expect(rig.store().getState().resources.cash).toBe(2_500_000);
    fireEvent.click(within(phone).getByTestId("phone-home-indicator"));
    fireEvent.click(within(phone).getByRole("button", { name: /Calls/ }));
    fireEvent.click(within(phone).getByTestId("calls-tab-contacts"));
    fireEvent.click(within(phone).getByTestId("device-row-contact.training-office"));
    // A real call: it rings first, and nothing has happened in the game until the line picks up.
    fireEvent.click(within(phone).getByTestId("contact-call-contact.training-office"));
    expect(within(phone).getByTestId("call-screen").getAttribute("data-phase")).toBe("ringing");
    expect(rig.store().getState().device.items["contact.training-office"].done).not.toContain("call");
    // Each turn is one scenario action. The next turn is offered only after the answer was shown.
    const confirm = await within(phone).findByTestId("device-action-contact.training-office-confirm-fee", {}, { timeout: 9000 });
    expect(within(phone).getByTestId("conversation-history").textContent).toContain("Training Office, good afternoon.");
    expect(within(phone).queryByTestId("device-action-contact.training-office-ask-account")).toBeNull();
    fireEvent.click(confirm);
    const ask = await within(phone).findByTestId("device-action-contact.training-office-ask-account", {}, { timeout: 9000 });
    fireEvent.click(ask);
    // Every line stays on screen as a subtitle, in order, with no audio needed.
    await waitFor(() => expect(within(phone).getAllByTestId(/^conversation-line-/)).toHaveLength(6), { timeout: 9000 });
    fireEvent.click(within(phone).getByTestId("call-end"));
    expect(within(phone).getByTestId("call-screen").getAttribute("data-phase")).toBe("ended");
    const state = rig.store().getState();
    expect(state.persistent.schoolAccessVerified).toBe(true);
    expect(state.resources.evidence).toBe(1);
    expect(state.resources.cash).toBe(2_500_000);
    expect(state.resources.timeMinutes).toBe(72 * 60 - 55);
    // The mission moved to its "verified" path. The email is still unread, so the tracker asks for it before the draft.
    expect(state.world.missions["m01.missing-access"].path).toBe("verified");
    expect(screen.getByTestId("task-objective").textContent).toBe("Portal access is confirmed. Finish the draft by Wednesday, 06:00; submit by Friday, 17:00.");
    expect(screen.getByTestId("task-current").textContent).toBe("Read the new email about your submission account");
  }, 40_000);

  it("way C: writing the draft with the planner completes the mission and keeps the access unverified", () => {
    const rig = mountLayer();
    fireEvent.click(screen.getByTestId("hud-planner-chip"));
    const planner = screen.getByTestId("planner-overlay");
    fireEvent.click(within(planner).getByTestId("thesis-task-draft.intro-review"));
    fireEvent.click(within(planner).getByTestId("thesis-task-draft.findings"));
    fireEvent.click(within(planner).getByTestId("thesis-task-draft.final"));
    const state = rig.store().getState();
    expect(state.resources.thesisProgress).toBe(67);
    expect(state.world.missions["m01.missing-access"].status).toBe("completed");
    expect(state.persistent.schoolAccessVerified).toBe(false);
    expect(state.resources.cash).toBe(2_500_000);
  });

  it("shows the email in Vietnamese with the Vietnamese amount", () => {
    applyLocale("vi");
    const rig = mountLayer();
    expect(screen.getByTestId("task-objective").textContent).toBe("Hoàn thành bản thảo trước 06:00 thứ Tư và xác nhận bạn đăng nhập được vào hệ thống nộp bài trước 17:00 thứ Sáu.");
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 10 }));
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByTestId("phone-app-mail"));
    fireEvent.click(within(phone).getByTestId("mail-row-mail.clearance"));
    expect(phone.textContent).toContain("Phí: 800.000 VNĐ");
    // The link is a button with the address written out, in the phone's own Mail.
    expect(within(phone).getByTestId("mail-link")).toBeTruthy();
  });
});