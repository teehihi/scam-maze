// The laptop's Mail client and Browser window with the real Mission 01 scenario: the inbox, the
// read state, the sender details, and a link that opens the Browser without finishing the story.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };
const URL = "https://payment-ueh.vn/confirm";

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

function openMail(rig: ReturnType<typeof mountLayer>) {
  act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 10 }));
  act(() => rig.bridge.onProp("laptop", "inspect-ready"));
  const laptop = screen.getByRole("dialog");
  fireEvent.click(within(laptop).getByTestId("desktop-icon-device-mail"));
  return laptop;
}

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("the laptop Mail client", () => {
  it("lists the inbox with sender, subject, preview, time and unread marks, and no warning labels", () => {
    const rig = mountLayer();
    const laptop = openMail(rig);
    const row = within(laptop).getByTestId("mail-row-mail.clearance");
    expect(row.getAttribute("data-unread")).toBe("true");
    expect(row.textContent).toContain("Graduation Office");
    expect(row.textContent).toContain("Graduation Clearance");
    expect(row.textContent).toContain("Your thesis submission account has been locked");
    expect(within(laptop).getByTestId("mail-row-mail.supervisor")).toBeTruthy();
    expect(within(laptop).getByTestId("mail-unread-count").textContent).toBe("4 unread");
    // Web pages are not messages.
    expect(within(laptop).queryByTestId("mail-row-page.fee")).toBeNull();
    // Nothing tells the player what to think before they check for themselves.
    expect(laptop.textContent).not.toMatch(/scam|phish|fraud|suspicious|warning|danger|unsafe/i);
  });

  it("reading a message sets its read state and nothing else", () => {
    const rig = mountLayer();
    const laptop = openMail(rig);
    const before = rig.store().getState();
    expect(before.device.items["mail.clearance"].read).toBe(false);
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    const after = rig.store().getState();
    expect(after.device.items["mail.clearance"].read).toBe(true);
    expect(after.resources.cash).toBe(before.resources.cash);
    expect(after.persistent.loginCredentialsExposed).toBeFalsy();
    expect(after.events).toHaveLength(before.events.length + 1);
    expect(within(laptop).getByTestId("mail-body").textContent).toContain("Pay now to unlock your account");
    // Back to Inbox shows the list again, with the message now read.
    fireEvent.click(within(laptop).getByTestId("mail-back"));
    expect(within(laptop).getByTestId("mail-row-mail.clearance").getAttribute("data-unread")).toBe("false");
    expect(within(laptop).getByTestId("mail-unread-count").textContent).toBe("3 unread");
  });

  it("shows the sender's real address and domain on request, without judging it", () => {
    const rig = mountLayer();
    const laptop = openMail(rig);
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    expect(within(laptop).getByTestId("mail-sender-address").textContent).toBe("clearance@payment-ueh.vn");
    expect(within(laptop).queryByTestId("mail-sender-details")).toBeNull();
    fireEvent.click(within(laptop).getByTestId("mail-sender-toggle"));
    expect(within(laptop).getByTestId("mail-detail-domain").textContent).toBe("payment-ueh.vn");
    expect(within(laptop).getByTestId("mail-sender-toggle").getAttribute("aria-expanded")).toBe("true");
  });

  it("filters by folder and shows an empty folder state", () => {
    const rig = mountLayer();
    const laptop = openMail(rig);
    fireEvent.click(within(laptop).getByTestId("mail-folder-other"));
    expect(within(laptop).getByTestId("mail-row-mail.print-shop")).toBeTruthy();
    expect(within(laptop).queryByTestId("mail-row-mail.clearance")).toBeNull();
  });
});

describe("a link in the Mail client", () => {
  it("is a visible address in a button, not an anchor, and opens the Browser with the page of the link", async () => {
    const rig = mountLayer();
    const laptop = openMail(rig);
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    const link = within(laptop).getByTestId("mail-link");
    expect(link.tagName).toBe("BUTTON");
    expect(link.textContent).toBe(URL);
    expect(laptop.querySelector("a[href]")).toBeNull();
    fireEvent.pointerEnter(link);
    expect(within(laptop).getByTestId("mail-link-status").textContent).toContain(URL);
    const before = rig.store().getState();

    fireEvent.click(link);
    expect(within(laptop).getByTestId("desktop-window").getAttribute("data-app")).toBe("browser");
    expect((within(laptop).getByTestId("browser-address") as HTMLInputElement).value).toBe(URL);
    const site = await within(laptop).findByTestId("fake-step-notice");
    // Opening the page is the story's "open the link" step: a few minutes, and nothing else.
    const after = rig.store().getState();
    expect(after.device.items["page.fee"]).toBeDefined();
    expect(after.resources.cash).toBe(before.resources.cash);
    expect(after.resources.timeMinutes).toBe(before.resources.timeMinutes - 3);
    expect(after.persistent.loginCredentialsExposed).toBeFalsy();
    expect(after.persistent.verificationCodeExposed).toBeFalsy();
    expect(after.persistent.accountCompromised).toBeFalsy();
    expect(after.world.missions["m01.security-breach"].status).not.toBe("open");
    expect(site.textContent).toContain("800,000 VND");
    // The page carries no verdict and shows no lock.
    expect(laptop.textContent).not.toMatch(/scam|fake|phish|fraud|suspicious|dangerous|unsafe|secure/i);
  });

  it("goes back to Mail from the Browser, and a running Browser shows on the taskbar", async () => {
    const rig = mountLayer();
    const laptop = openMail(rig);
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    fireEvent.click(within(laptop).getByTestId("mail-link"));
    expect(within(laptop).getByTestId("taskbar-app-browser").getAttribute("data-status")).toBe("active");
    fireEvent.click(within(laptop).getByTestId("taskbar-app-device-mail"));
    expect(within(laptop).getByTestId("mail-client")).toBeTruthy();
    expect(within(laptop).getByTestId("taskbar-app-browser").getAttribute("data-status")).toBe("open");
  });
});

describe("the Mail client in Vietnamese", () => {
  it("shows the inbox and the reader in Vietnamese", () => {
    act(() => {
      applyLocale("vi");
    });
    const rig = mountLayer();
    const laptop = openMail(rig);
    expect(within(laptop).getByText("Hộp thư đến")).toBeTruthy();
    expect(within(laptop).getByTestId("mail-unread-count").textContent).toBe("4 chưa đọc");
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    expect(within(laptop).getByTestId("mail-sender-toggle").textContent).toContain("Chi tiết người gửi");
    expect(within(laptop).getByTestId("mail-link").textContent).toBe(URL);
  });
});

describe("the in-game browser from Mail", () => {
  async function openLinkFromMail(rig: ReturnType<typeof mountLayer>) {
    const laptop = openMail(rig);
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    fireEvent.click(within(laptop).getByTestId("mail-link"));
    await within(laptop).findByTestId("fake-step-notice");
    return laptop;
  }

  it("runs Mail, link, Browser tab, Back, New Tab, Bookmark and History without any further story step", async () => {
    const rig = mountLayer();
    const laptop = await openLinkFromMail(rig);
    const before = rig.store().getState();
    expect((within(laptop).getByTestId("browser-address") as HTMLInputElement).value).toBe(URL);
    // Back goes to the New Tab page that the link reused.
    fireEvent.click(within(laptop).getByTestId("browser-back"));
    await within(laptop).findByTestId("browser-newtab");
    // A new tab, then a saved bookmark.
    fireEvent.click(within(laptop).getByTestId("browser-new-tab"));
    fireEvent.click(await within(laptop).findByTestId("newtab-bookmark-https://lib.ueh.edu.vn/hours"));
    await within(laptop).findByTestId("browser-site-library");
    fireEvent.click(within(laptop).getByTestId("browser-star"));
    fireEvent.click(within(laptop).getByTestId("browser-history-button"));
    await within(laptop).findByTestId("browser-history");
    expect(within(laptop).getByTestId("history-entry-0").textContent).toContain("University Library");
    const after = rig.store().getState();
    expect(after.events).toHaveLength(before.events.length);
    expect(after.resources).toEqual(before.resources);
  });

  it("keeps the tabs when the player switches apps, and does not open a second tab for the same link", async () => {
    const rig = mountLayer();
    const laptop = await openLinkFromMail(rig);
    expect(within(laptop).getAllByRole("tab")).toHaveLength(1);
    fireEvent.click(within(laptop).getByTestId("taskbar-app-device-mail"));
    fireEvent.click(within(laptop).getByTestId("mail-row-mail.clearance"));
    fireEvent.click(within(laptop).getByTestId("mail-link"));
    expect(within(laptop).getAllByRole("tab")).toHaveLength(1);
    expect((within(laptop).getByTestId("browser-address") as HTMLInputElement).value).toBe(URL);
    // Closing the laptop and opening it again keeps the browser too.
    fireEvent.click(within(laptop).getByTestId("desktop-close-laptop"));
    act(() => rig.bridge.onProp("laptop", "inspect-ready"));
    expect(within(screen.getByRole("dialog")).getAllByRole("tab")).toHaveLength(1);
  });

  it("path 1 and 2: the player looks at the page and closes it, with no loss", async () => {
    const rig = mountLayer();
    const laptop = await openLinkFromMail(rig);
    const before = rig.store().getState();
    fireEvent.click(within(laptop).getByTestId("clearance-continue"));
    await within(laptop).findByTestId("fake-step-login");
    fireEvent.focus(within(laptop).getByTestId("login-id"));
    fireEvent.click(within(laptop).getByTestId("login-fill"));
    fireEvent.click(within(laptop).getByRole("tab").parentElement!.querySelector("[data-testid^=browser-tab-close-]")!);
    await within(laptop).findByTestId("browser-newtab");
    const after = rig.store().getState();
    expect(after.events).toHaveLength(before.events.length);
    expect(after.resources).toEqual(before.resources);
    expect(after.persistent.loginCredentialsExposed).toBeFalsy();
  });

  it("path 3: every step of the fake site is its own action, and the consequences grow step by step", async () => {
    const rig = mountLayer();
    const laptop = await openLinkFromMail(rig);
    const start = rig.store().getState();
    fireEvent.click(within(laptop).getByTestId("clearance-continue"));
    await within(laptop).findByTestId("fake-step-login");
    fireEvent.focus(within(laptop).getByTestId("login-id"));
    fireEvent.click(within(laptop).getByTestId("login-fill"));
    expect(rig.store().getState().persistent.loginCredentialsExposed).toBeFalsy();
    fireEvent.click(within(laptop).getByTestId("login-submit"));
    // The login is exposed. The fee is not paid, and no code was given.
    let state = rig.store().getState();
    expect(state.persistent.loginCredentialsExposed).toBe(true);
    expect(state.resources.cash).toBe(start.resources.cash);
    expect(state.persistent.verificationCodeExposed).toBeFalsy();
    expect(state.world.missions["m01.security-breach"].status).toBe("open");
    await within(laptop).findByTestId("fake-step-payment");
    fireEvent.focus(within(laptop).getByTestId("pay-number"));
    fireEvent.click(within(laptop).getByTestId("pay-fill"));
    // The saved card leaves the security code to the player, as the browser does.
    for (const key of "123") fireEvent.keyDown(within(laptop).getByTestId("pay-cvc"), { key });
    expect(rig.store().getState().resources.cash).toBe(start.resources.cash);
    fireEvent.click(within(laptop).getByTestId("pay-submit"));
    state = rig.store().getState();
    // The card details alone take nothing: the bank asks for its code first.
    expect(state.resources.cash).toBe(start.resources.cash);
    expect(state.persistent.accountCompromised).toBeFalsy();
    await within(laptop).findByTestId("fake-step-verify");
    // On the laptop the code is read on the phone and typed in.
    fireEvent.change(within(laptop).getByTestId("verify-code"), { target: { value: "481206" } });
    fireEvent.click(within(laptop).getByTestId("verify-submit"));
    state = rig.store().getState();
    expect(state.resources.cash).toBe(start.resources.cash - 800_000);
    expect(state.persistent.verificationCodeExposed).toBe(true);
    expect(state.persistent.accountCompromised).toBe(true);
    await within(laptop).findByTestId("fake-step-complete");
  });

  it("path 4: the portal is already bookmarked, the fees can be compared, and checking the account saves evidence", async () => {
    const rig = mountLayer();
    const laptop = openMail(rig);
    // Open the Browser from the desktop and use the saved bookmark.
    fireEvent.click(within(laptop).getByTestId("desktop-back"));
    fireEvent.click(within(laptop).getByTestId("desktop-icon-browser"));
    fireEvent.click(within(laptop).getByTestId("browser-bookmarks"));
    fireEvent.click(within(laptop).getByTestId("menu-bookmark-https://student.ueh.edu.vn/"));
    await within(laptop).findByTestId("portal-site");
    // Nothing has verified the account yet: the portal says so instead of claiming it is active.
    expect(within(laptop).getByTestId("portal-access-dashboard").textContent).toBe("Not yet checked");
    // Services: the published fees and the Training Office number saved in the phone.
    fireEvent.click(within(laptop).getByTestId("portal-nav-services"));
    await within(laptop).findByTestId("portal-fees");
    expect(within(laptop).getByTestId("portal-fees").textContent).not.toMatch(/confirmation/i);
    const saved = rig.store().getState();
    expect(within(laptop).getByTestId("portal-training-phone").textContent).toBe("+000 100 0200");
    const savedContact = (await import("../../../game/narrative/chapter1/mission01")).MISSION_01_DEVICE_ITEMS.find((entry) => entry.id === "contact.training-office");
    expect(savedContact?.detail).toBe("+000 100 0200");
    // Account: the check is the story's own action, taken by the player.
    fireEvent.click(within(laptop).getByTestId("portal-nav-account"));
    await within(laptop).findByTestId("portal-check");
    expect(saved.device.items["portal.saved"].done).not.toContain("check-account");
    fireEvent.click(within(laptop).getByTestId("portal-check-account"));
    const state = rig.store().getState();
    expect(state.device.items["portal.saved"].done).toContain("check-account");
    expect(state.device.items["file.portal-status"]).toBeDefined();
    expect(state.resources.cash).toBe(saved.resources.cash);
    expect(within(laptop).getByTestId("portal-check-result")).toBeTruthy();
    // The check is what flips the portal from "not yet checked" to an active account.
    fireEvent.click(within(laptop).getByTestId("portal-nav-dashboard"));
    expect((await within(laptop).findByTestId("portal-access-dashboard")).textContent).toBe("Active");
  });

  it("shows the Browser and the clearance site in Vietnamese", async () => {
    act(() => {
      applyLocale("vi");
    });
    const rig = mountLayer();
    const laptop = await openLinkFromMail(rig);
    expect(within(laptop).getByTestId("clearance-fee").textContent).toBe("800.000 VNĐ");
    expect(within(laptop).getByTestId("browser-back").getAttribute("aria-label")).toBe("Quay lại");
    expect(within(laptop).getByTestId("browser-star").getAttribute("aria-label")).toBe("Đánh dấu trang này");
  });
});
