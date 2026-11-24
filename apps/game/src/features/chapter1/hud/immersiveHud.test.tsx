// Tests for the AAA immersive UI/UX overhaul:
// 1. Live rotating Saigon GPS radar replacing indoor "No Signal" when outdoors in Chapter 1
// 2. Unified tactile StreetActionPrompt parsing (no raw "[E]" brackets)
// 3. Cinema DistrictArrivalBanner showing cleanly on zone entry and hiding during dialogue
// 4. CinemaNpcHud two-way Alex echo line, zero-overlap vertical stack, and reply dispatch
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CHAPTER_1_INITIAL_STATE } from "../../../game/narrative/resources";
import { resolveStoryNpcDialogue } from "../../../game/narrative/chapter1/storyCast";
import { ChapterStatusCluster } from "./ChapterStatusHud";
import { CinemaNpcHud } from "../../testbus/openworld/CinemaNpcHud";
import { DistrictArrivalBanner, parseStreetPrompt, StreetActionPrompt } from "../../testbus/openworld/StreetHudElements";
import { OutsideHud } from "../room/useOutsideWorld";

describe("AAA Immersive UI/UX Overhaul", () => {
  it("switches ChapterStatusCluster seamlessly from indoor standby disc to live Saigon radar when outdoors", () => {
    const resources = CHAPTER_1_INITIAL_STATE.resources;
    const { rerender } = render(<ChapterStatusCluster resources={resources} outsideRadar={null} />);
    expect(screen.getByTestId("minimap-no-signal")).toBeTruthy();
    expect(screen.queryByTestId("minimap-saigon-live")).toBeNull();

    rerender(
      <ChapterStatusCluster
        resources={resources}
        outsideRadar={{
          position: { x: 18, z: -12 },
          headingDeg: 45,
          busPosition: { x: -4, z: -2 },
          npcBlips: [{ id: "landlord_q10", x: 16.5, z: -14.2 }],
          zone: "Hẻm 462/14 Lý Thái Tổ",
          district: "Quận 10, TP.HCM",
        }}
      />,
    );
    expect(screen.queryByTestId("minimap-no-signal")).toBeNull();
    expect(screen.getByTestId("minimap-saigon-live")).toBeTruthy();
  });

  it("parses raw engine prompt strings into structured keycap + primary verb + role context", () => {
    expect(parseStreetPrompt("[E] Nói chuyện với chú Tuấn (Chủ trọ 462/14)")).toEqual({
      key: "E",
      primary: "Nói chuyện với chú Tuấn",
      secondary: "Chủ trọ 462/14",
    });
    expect(parseStreetPrompt("[F] Xác nhận lên xe buýt")).toEqual({
      key: "F",
      primary: "Xác nhận lên xe buýt",
      secondary: null,
    });
    expect(parseStreetPrompt("Đang chờ xe buýt Tuyến 06")).toEqual({
      key: null,
      primary: "Đang chờ xe buýt Tuyến 06",
      secondary: null,
    });
  });

  it("renders StreetActionPrompt without raw bracket syntax and suppresses it when room prompt is active", () => {
    const { rerender } = render(
      <OutsideHud
        state={{
          ready: true,
          outdoors: true,
          prompt: "[E] Nói chuyện với chú Tuấn (Chủ trọ 462/14)",
          zone: "Hẻm 462/14 Lý Thái Tổ",
          district: "Quận 10, TP.HCM",
          storyDialogue: null,
          ambientBark: null,
        }}
        suppressPrompt={false}
      />,
    );
    const promptEl = screen.getByTestId("street-action-prompt");
    expect(promptEl.textContent).toContain("Nói chuyện với chú Tuấn");
    expect(promptEl.textContent).toContain("Chủ trọ 462/14");
    expect(promptEl.textContent).not.toContain("[E]");

    const banner = screen.getByTestId("district-arrival-banner");
    expect(banner.textContent).toContain("Hẻm 462/14 Lý Thái Tổ");
    expect(banner.textContent).toContain("Quận 10, TP.HCM");

    rerender(
      <OutsideHud
        state={{
          ready: true,
          outdoors: true,
          prompt: "[E] Nói chuyện với chú Tuấn (Chủ trọ 462/14)",
          zone: "Hẻm 462/14 Lý Thái Tổ",
          district: "Quận 10, TP.HCM",
          storyDialogue: null,
          ambientBark: null,
        }}
        suppressPrompt={true}
      />,
    );
    expect(screen.queryByTestId("street-action-prompt")).toBeNull();
  });

  it("renders StreetActionPrompt standalone cleanly", () => {
    render(<StreetActionPrompt prompt="[E] Ngồi xuống · Đang đón khách" />);
    const el = screen.getByTestId("street-action-prompt");
    expect(el.textContent).toContain("Ngồi xuống");
    expect(el.textContent).toContain("Đang đón khách");
  });

  it("hides DistrictArrivalBanner during active NPC dialogue", () => {
    render(
      <DistrictArrivalBanner
        zone="Đường Lý Thái Tổ"
        district="Quận 10"
        weather="drizzle"
        hidden={true}
      />,
    );
    expect(screen.queryByTestId("district-arrival-banner")).toBeNull();
  });

  it("renders CinemaNpcHud two-way Alex echo line and dispatches reply selections cleanly", () => {
    const turn = resolveStoryNpcDialogue("landlord_q10", {
      elapsedMinutes: 60,
      thesisProgress: 40,
      fatigue: 20,
      money: 4500000,
      flags: {},
    });
    const onSelect = vi.fn();
    render(
      <CinemaNpcHud
        language="vi"
        dialogue={{
          npcId: "landlord_q10",
          turn,
          currentText: turn.replies[0].response,
          lastPlayerReply: turn.replies[0].label,
          currentMood: turn.replies[0].nextMood,
          activeInsight: turn.replies[0].insight ?? null,
          askedReplyIds: [turn.replies[0].id],
          closing: false,
          lineKey: 2,
        }}
        ambientBark={null}
        crowdReaction={null}
        onSelectReply={onSelect}
      />,
    );
    expect(screen.getByTestId("cinema-npc-dialogue")).toBeTruthy();
    expect(screen.getByTestId("cinema-player-echo").textContent).toContain(turn.replies[0].label.vi);

    const secondReplyBtn = screen.getByRole("button", { name: new RegExp(turn.replies[1].label.vi) });
    fireEvent.click(secondReplyBtn);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
