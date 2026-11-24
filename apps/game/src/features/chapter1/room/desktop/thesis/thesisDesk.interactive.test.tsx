import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThesisTaskView } from "../../../../../game/narrative/world";
import type { DurationText } from "../../../world/formatDuration";
import { CitationDetective } from "./CitationDetective";
import { DataForensics } from "./DataForensics";
import { DraftAssembly } from "./DraftAssembly";
import type { ReviewProps, ThesisInvestigationState, Translate } from "./thesisDeskChrome";

const INVESTIGATION: ThesisInvestigationState = {
  citation: { claimInspected: false, selectedTerm: null, openSources: new Set() },
  findings: { inspectedExcerpt: false, inspectedChart: false, selectedParticipant: null, counts: { business: 4, economics: 4 }, compared: false },
  final: { pages: new Set(), checks: new Set() },
};

const t: Translate = (key, options) => `${key}${options?.term === undefined ? "" : ` ${String(options.term)}`}`;
const duration: DurationText = () => "90 minutes";

function task(id: ThesisTaskView["id"]): ThesisTaskView {
  return {
    id,
    label: id,
    description: "Review this section.",
    timeCostMinutes: 90,
    progressGain: 2,
    approaches: [
      { id: "qualify", label: "Qualify", description: "Qualify the claim.", timeCostMinutes: 90, progressGain: 2 },
      { id: "fix-chart", label: "Fix chart", description: "Fix the chart.", timeCostMinutes: 60, progressGain: 2 },
      { id: "full-review", label: "Full review", description: "Review everything.", timeCostMinutes: 90, progressGain: 3 },
    ],
    done: false,
    blocked: null,
  };
}

function props(id: ThesisTaskView["id"], overrides: Partial<ReviewProps> = {}): ReviewProps {
  return { task: task(id), index: 0, t, duration, onChoose: vi.fn(), ...overrides };
}

describe("Citation Detective", () => {
  it("does not offer an approach until the claim, wording and two sources are inspected", () => {
    render(<CitationDetective {...props("draft.intro-review")} />);
    const approach = screen.getByTestId("thesis-approach-draft.intro-review-qualify");

    expect(approach.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("citation-inspect-claim"));
    fireEvent.click(screen.getByTestId("citation-term-peer-forums"));
    fireEvent.click(screen.getByTestId("citation-source-0"));
    expect(approach.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("citation-source-1"));

    expect(approach.hasAttribute("disabled")).toBe(false);
    expect(screen.getByTestId("citation-selected").textContent).toContain("peer forums");
  });

  it("keeps the inspection when the section is closed and reopened", () => {
    function Harness() {
      const [state, setState] = React.useState(INVESTIGATION);
      return <CitationDetective {...props("draft.intro-review", { investigation: state, onInvestigationChange: (next) => setState((current) => ({ ...current, ...next })) })} />;
    }
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByTestId("citation-inspect-claim"));
    fireEvent.click(screen.getByTestId("citation-term-peer-forums"));
    fireEvent.click(screen.getByTestId("citation-source-0"));
    fireEvent.click(screen.getByTestId("citation-source-1"));
    rerender(<Harness />);

    expect(screen.getByTestId("citation-claim").getAttribute("data-inspected")).toBe("true");
    expect(screen.getByTestId("citation-source-count").textContent).toContain("2/3");
    expect(screen.getByTestId("citation-source-0").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("thesis-approach-draft.intro-review-qualify").hasAttribute("disabled")).toBe(false);
    // An opened card names its method, without marking any source as the answer.
    expect(screen.getByTestId("citation-source-0").textContent).toContain("laptop.thesisDesk.interactive.methodCorrelation");
    expect(screen.getByTestId("citation-source-1").textContent).toContain("laptop.thesisDesk.interactive.methodInterview");
  });
});

describe("Data Forensics", () => {
  it("requires a reconciled total and a fresh comparison before offering an approach", () => {
    render(<DataForensics {...props("draft.findings")} />);
    const approach = screen.getByTestId("thesis-approach-draft.findings-fix-chart");

    fireEvent.click(screen.getByTestId("findings-inspect-excerpt"));
    fireEvent.click(screen.getByTestId("findings-inspect-chart"));
    fireEvent.click(screen.getByTestId("findings-participant-0"));
    fireEvent.click(screen.getByTestId("findings-scan-duplicates"));
    fireEvent.click(screen.getByTestId("findings-compare"));
    expect(screen.getByTestId("findings-mismatch-feedback").getAttribute("data-state")).toBe("mismatch");
    expect(approach.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByTestId("findings-chart-minus-business"));
    fireEvent.click(screen.getByTestId("findings-chart-minus-business"));
    fireEvent.click(screen.getByTestId("findings-compare"));

    expect(screen.getByTestId("findings-mismatch-feedback").getAttribute("data-state")).toBe("matched");
    expect(screen.getByTestId("findings-total-value").textContent).toBe("6");
    expect(approach.hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByTestId("findings-chart-plus-business"));
    expect(approach.hasAttribute("disabled")).toBe(true);
  });

  it("says plainly when there is no participant data to scan for duplicates", () => {
    render(<DataForensics {...props("draft.findings")} />);
    const scan = screen.getByTestId("findings-scan-duplicates");
    expect(scan.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("findings-inspect-excerpt"));
    fireEvent.click(screen.getByTestId("findings-inspect-chart"));
    fireEvent.click(scan);
    expect(screen.getByTestId("findings-duplicate-feedback").textContent).toContain("noDuplicateData");
  });
});

describe("Final Draft Assembly", () => {
  it("requires every page and every checklist item before offering an approach", () => {
    render(<DraftAssembly {...props("draft.final")} />);
    const approach = screen.getByTestId("thesis-approach-draft.final-full-review");

    expect(approach.hasAttribute("disabled")).toBe(true);
    // A checklist item cannot be marked before the page it reviews has been opened.
    expect(screen.getByTestId("final-check-unsourced").hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("final-check-unsourced"));
    expect(screen.getByTestId("final-check-count").textContent).toContain("0/5");
    for (const page of ["intro", "findings", "submission"]) fireEvent.click(screen.getByTestId(`final-page-${page}`));
    for (const check of ["unsourced", "figures", "terms", "claims", "supervisor"]) {
      fireEvent.click(screen.getByTestId(`final-check-${check}`));
    }

    expect(approach.hasAttribute("disabled")).toBe(false);
    expect(screen.getByTestId("final-page-intro").getAttribute("data-marker")).toBe("red");
    expect(screen.getByTestId("final-page-findings").getAttribute("data-marker")).toBe("amber");
    expect(screen.getByTestId("final-page-submission").getAttribute("data-marker")).toBe("clear");

    fireEvent.click(screen.getByTestId("final-check-supervisor"));
    expect(approach.hasAttribute("disabled")).toBe(true);
  });
});
