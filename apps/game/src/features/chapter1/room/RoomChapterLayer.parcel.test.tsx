// Mission 02 "THE LAST INTERVIEW" through the real phone UI, with the real scenario and the real
// Vietnamese text. This is the playtest the PR said had not happened: the layer is mounted, the
// phone is opened through the bridge the 3D room uses, and the parcel thread is played by clicking
// what a player would click.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";
import { PARCEL_CONFIG } from "../../../game/narrative/chapter1/parcel";

// The real routing and the real Vietnamese overlay, not the suite-wide parked-story fixture.
vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function mountLayer(language: "en" | "vi" = "en") {
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
  render(
    <RoomChapterLayer
      session={SESSION}
      settings={{ ...DEFAULT_SETTINGS, language }}
      bridge={bridge}
      saveSource={SAVE_SOURCE}
      ringSettleMs={0}
      clockPaused
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  for (let i = 0; i < 12 && screen.queryByTestId("chapter-intro"); i += 1) {
    fireEvent.click(screen.getByTestId("chapter-intro"));
  }
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

describe("Mission 02 in the phone", () => {
  it("brings the courier message at 08:00 and shows it with the sender and the fee", async () => {
    const rig = mountLayer();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: PARCEL_CONFIG.opensAtMinute }));
    const phone = openPhone(rig);

    // The messages app carries the courier thread.
    fireEvent.click(within(phone).getByRole("button", { name: /Messages|Tin nhắn/ }));
    const entry = await waitFor(() => within(phone).getByText("Tốc Hành 24"));
    fireEvent.click(entry);

    expect(within(phone).getByText(/22,000 VND/)).toBeTruthy();
    expect(within(phone).getByText(/TH24 4471 0925/)).toBeTruthy();
  });

  it("opens the redelivery page from the courier app and charges the fee only after the details", async () => {
    const rig = mountLayer();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: PARCEL_CONFIG.opensAtMinute }));
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages|Tin nhắn/ }));
    fireEvent.click(await waitFor(() => within(phone).getByText("Tốc Hành 24")));

    // An SMS never becomes a link in this game, so the message names the app and the player goes
    // there: Messages -> home -> Files -> the courier's app -> the redelivery page.
    expect(within(phone).queryByTestId("mail-link")).toBeNull();
    expect(within(phone).getByText(/courier's app/)).toBeTruthy();

    fireEvent.click(within(phone).getByTestId("phone-home-indicator"));
    fireEvent.click(await waitFor(() => within(phone).getByRole("button", { name: /Files|Tệp/ })));
    fireEvent.click(await waitFor(() => within(phone).getByText("Tốc Hành 24 — parcel lookup")));
    fireEvent.click(await waitFor(() => within(phone).getByRole("button", { name: /Open the redelivery page/i })));
    // The app delivers the page; the player then opens Browser and types the address, which is the
    // only way the game ever reaches a page (nothing auto-navigates on the player's behalf).
    fireEvent.click(within(phone).getByTestId("phone-home-indicator"));
    fireEvent.click(await waitFor(() => within(phone).getByRole("button", { name: /Browser|Trình duyệt/ })));
    const address = await waitFor(() => within(phone).getByTestId("browser-address"));
    fireEvent.focus(address);
    fireEvent.change(address, { target: { value: "https://tochhanh24.example/redelivery" } });
    fireEvent.keyDown(address, { key: "Enter" });
    await within(phone).findByTestId("browser-site-parcel");

    // The page renders real copy in the game's language, never a raw key.
    expect(within(phone).getByTestId("parcel-heading").textContent ?? "").not.toMatch(/ueh\.parcel/);
    expect(within(phone).getByTestId("parcel-body").textContent ?? "").toContain("22,000");

    // The fee button does not exist yet: the page asks for the details first.
    expect(within(phone).queryByTestId("parcel-pay")).toBeNull();

    // The expensive part is typing the details.
    const before = rig.store().getState().resources.digitalSecurity;
    fireEvent.click(within(phone).getByTestId("parcel-enter"));
    expect(rig.store().getState().persistent.parcelCredentialsExposed).toBe(true);
    expect(rig.store().getState().resources.digitalSecurity).toBeLessThan(before);

    // Now the fee is offered, and paying writes one ledger line.
    const cashBefore = rig.store().getState().resources.cash;
    fireEvent.click(await waitFor(() => within(phone).getByTestId("parcel-pay")));
    expect(rig.store().getState().resources.cash).toBe(cashBefore - PARCEL_CONFIG.redeliveryFeeVnd);
    expect(rig.store().getState().device.ledger).toHaveLength(1);
  });

  it("lets the courier app answer the same question, and costs minutes instead of money", async () => {
    const rig = mountLayer();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: PARCEL_CONFIG.opensAtMinute }));
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Files|Tệp/ }));

    const cash = rig.store().getState().resources.cash;
    fireEvent.click(await waitFor(() => within(phone).getByText("Tốc Hành 24 — parcel lookup")));
    fireEvent.click(within(phone).getByRole("button", { name: /TH24 4471 0925/ }));

    await waitFor(() => expect(rig.store().getState().persistent.parcelAtCounter).toBe(true));
    // It answers the question and costs the player nothing but time.
    expect(rig.store().getState().resources.cash).toBe(cash);
    expect(rig.store().getState().resources.evidence).toBe(1);
  });

  it("reads the paper on the desk, which is what makes the lookup cheap", async () => {
    const rig = mountLayer();
    // The note prop is mapped by the room; its inspect text is the mission's own writing.
    const lines = rig.bridge.inspectLines("note");
    expect(lines, "the desk sheet has no inspect text").not.toBeNull();
    expect((lines ?? []).join(" ")).toContain("TH24 4471 0925");
  });
});
