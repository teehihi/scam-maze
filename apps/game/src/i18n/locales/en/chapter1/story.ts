/**
 * English source text for the `chapter1` namespace, `story` area: the dialogue panel, the evidence
 * journal and the inspection panel. Owns the `dialogue`, `journal` and `inspection` key groups.
 * Narrative text (lines, evidence, claims, persona names) comes from the display scenario instead.
 */
const story = {
  dialogue: {
    /** Speaker label for the player's own lines (core `speaker: "player"`). */
    playerSpeaker: "You",
    /** Speaker label for system lines, which have no speaker name. */
    systemSpeaker: "Narration",
    /** Accessible name of the option list. */
    optionsLabel: "Your reply",
    /** Shown when the current node has no options (for example a closing line). */
    noOptions: "No replies available.",
    /** Text of the engine-provided fallback option (core `fallback: true`). */
    fallbackOption: "End the conversation",
    /** Small caption above the persona name in the face-to-face dialogue overlay. */
    caption: "Conversation",
  },
  journal: {
    title: "Journal",
    evidenceHeading: "Evidence",
    claimsHeading: "Claims",
    emptyState: "You have not found any evidence yet. Look around and check what the caller tells you.",
    noClaimEvidence: "No evidence about this claim yet.",
    sourceLabel: "Source",
    locationLabel: "Found at",
    statusLabel: "Status",
    notesHeading: "Your notes",
    decidePrompt: "You can decide what to do now.",
    decide: "Decide",
    close: "Close",
    /** Text for each Stance. A `contradicts` Stance points against a Claim; it is never proof. */
    stance: {
      supports: "Points toward this claim",
      contradicts: "Points against this claim",
      inconclusive: "Does not settle this claim",
      "needs-verification": "Needs checking through a channel you trust",
    },
    /** Text for each Claim status. */
    claimStatus: {
      unverified: "Not checked yet",
      supported: "Evidence points toward this claim",
      contradicted: "Contradicted by Northgate's official line",
      inconclusive: "Checked, but not settled",
    },
    /** Text for each Evidence_Item source. */
    source: {
      physical: "Something you found",
      device: "Your phone",
      dialogue: "The phone call",
      npc: "A person you talked to",
      verification: "A check through a channel you trust",
    },
  },
  inspection: {
    evidenceHeading: "Recorded in your journal",
    close: "Close",
  },
};

export default story;
