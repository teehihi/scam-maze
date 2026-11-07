# SCAMMAZE positioning

> **Version:** 1.0 · **Date:** 7 Nov 2026 · **Status:** agreed direction, to be validated in user testing
> This document extends section 2 ("Market & product thesis") of
> [`SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md`](../SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md).
> It does not replace it. If the two disagree, raise it in an issue.

## 1. Positioning in one sentence

**SCAMMAZE is a safe place to practise scams before they happen: you walk
through a real scam journey, make the risky choice without real
consequences, see exactly where the pressure worked, and leave with a
checklist that works in any country.**

### Positioning statement

For **everyday internet users in Vietnam and around the world** who already
know they should "be careful" but still get pulled in one step at a time,
**SCAMMAZE** is an **interactive scam simulator** that trains the decision
itself, under pressure, across several steps.
Unlike **phishing quizzes** (one screen, one answer) and **URL checkers**
(a verdict, no skill), SCAMMAZE shows the consequence of each choice, points to
the evidence, and tests whether the skill carries over to a new case.

## 2. The insight: the confidence gap

People do not lack warnings. They lack practice at acting on them when someone
is rushing them.

| Market | Finding | Source |
|---|---|---|
| Worldwide | 57% of adults experienced a scam in the past 12 months, and 23% lost money (survey of 46,000 adults in 42 markets). | [GASA, Global State of Scams 2025](https://gasa.org/knowledge-base/blog/global-scams-on-the-rise-over-half-of-adults-worldwide-report-scam-encounters) |
| Vietnam | 85% of adults encountered a scam in the past year. 55% feel confident they can recognize scams, yet 75% of those exposed interacted with the scammer (survey of 1,250 adults). | [GASA, State of Scams in Vietnam 2026](https://gasa.org/knowledge-base/reports/state-of-scams-in-vietnam-2026) |
| Vietnam | Police reported more than 24,000 online fraud cases since 2020, with nearly VND 40 trillion (about US$1.5 billion) stolen. | [VnExpress International, Jan 2026](https://e.vnexpress.net/news/news/crime/vietnamese-lose-nearly-1-5b-to-online-scams-in-last-5-years-how-to-spot-9-major-schemes-5001031.html) |

**What this means for us:** high awareness and high confidence do not stop
people from engaging. That gap between *knowing* and *doing* is exactly what
the learning loop targets: scenario → signals → checklist.

**Limits:** these are survey and police figures, not our results. We do not
claim any effect of SCAMMAZE until we measure it (see the kill test in the plan).

## 3. Audiences

| Segment | Who | What they need from us |
|---|---|---|
| **Primary A: Vietnam** | Internet users aged 16+ in Vietnam: students, online shoppers, people starting their first job. Mobile-first; SMS, chat apps, bank transfers and QR payments are part of daily life. | Scenarios that feel familiar without naming real local brands. Plain English now, and a Vietnamese version (plan feature F19) as soon as possible. |
| **Primary B: International** | Internet users aged 16+ outside Vietnam, at the same life stages. SMS, email, messaging apps, cards and instant payments. | Scenarios with no country-specific assumptions. Content that reads naturally for native and non-native English speakers. |
| **Secondary** | Educators, schools, libraries and community groups in both regions. | Short scenarios that fit a lesson, clear learning outcomes, no sign-up. |
| **Time-bound: Kiroween judges** | International, English-speaking, evaluating impact, implementation, design and use of Kiro. | A demo that shows branching, evidence and the checklist in under 3 minutes, in English. |

Both primary segments are equally important. The site must never feel like a
local tool translated for foreigners, or a foreign tool adapted for Vietnam.

## 4. What is shared and what differs

| Shared everywhere (teach in the core) | Differs by place (handle in region packs, later) |
|---|---|
| Urgency and countdowns | Which delivery companies, banks and shops are common |
| Impersonating a trusted company, official or relative | Which chat apps and channels scammers use |
| "Too good to be true" prizes, jobs and deals | How money moves (cards, bank transfer, QR, wallets) |
| Asking for an OTP, password or PIN | Phone and address formats, currency |
| Moving the conversation or payment off the platform | Where to report a scam, and to whom |
| Many small steps instead of one big request | Language, tone and cultural cues |

## 5. Strategy: global core, local packs

1. **Global core.** Every core scenario is built on a tactic from the left
   column above. It uses fictional companies and reserved domains
   (`.test`, `.example`, `.invalid`, `example.com`, `192.0.2.x`), and contains
   no currency, phone format or brand that only makes sense in one country.
2. **Region packs (later).** Extra scenarios tagged with a region (for example
   `region: "vn"`) can add local channels and local reporting information.
   Each pack is reviewed by someone who lives there. Packs never use real brand
   names in scenario content.
3. **Language.** English first, written in plain English (see section 7).
   Vietnamese next, as a translation of the same scenarios and UI (plan F19),
   not as a separate product.
4. **Real-life mode stays neutral.** The URL checker and checklists work the
   same everywhere and never say "safe". Country-specific "where to report"
   links come with region packs, after each link has been verified.

## 6. Messaging

**Brand line:** Escape the scam maze.

**Core message:** Scammers use the same tricks everywhere. Practise them safely
here, so you recognize them anywhere.

| Pillar | Message | Proof on the site |
|---|---|---|
| Learn by choosing | You can make the wrong choice here, safely, and see what it costs. | Two paths in the demo lead to different outcomes. |
| See the evidence | Every warning points to the exact words, link or request that gave it away. | Red flags quote the message; the URL checker shows each signal. |
| Take it into real life | The same checklist works for messages you receive tomorrow, wherever you live. | Checklist at the end of each path; URL check mode. |
| Safe by design | No real links are ever opened, nothing is called "safe", and the core works offline without AI. | Steering rules, string-only URL analysis, AI toggle. |

**We never say:** "safe" about a link or message, "first ever", "guaranteed",
or anything that blames victims or stereotypes a group (age, country,
education). We do not use fear as the main motivator.

## 7. Voice and writing rules

The English text has to work for native speakers, for Vietnamese readers who
use English as a second language, and later for translation.

- Short sentences (aim for 20 words or fewer) and common words.
- No idioms, slang, sports metaphors or references that only make sense in one
  country.
- Explain an acronym the first time it appears on a page (for example
  "one-time password (OTP)").
- Speak to the reader as "you". Calm and direct, never mocking.
- Dates as "7 Nov 2026"; times in 24-hour format with a time zone.
- Avoid amounts of money. If needed, use a generic phrase ("a small fee").
- Keep each sentence complete in itself. Do not build sentences from fragments,
  because word order changes in translation.

**Terms to keep consistent** (translate once, reuse everywhere, when
localization starts): scam, scammer, warning sign, red flag, verify
independently, official channel, one-time password (OTP), simulated, checklist,
the maze.

## 8. Competitive landscape

| Alternative | Where | Strength | How SCAMMAZE relates |
|---|---|---|---|
| Phishing quizzes (e.g. Google/Jigsaw Phishing Quiz) | Global | Fast, recognizable examples | We add multi-step journeys, consequences and a transfer test. |
| Online-safety games for children (e.g. Google Interland) | Global | Playful, school-friendly | We target teens and adults with realistic scam journeys. |
| Website reputation and reporting services (e.g. [ChongLuaDao](https://chongluadao.vn) in Vietnam, URL scanners worldwide) | Vietnam and global | Detect and block known bad sites | Complementary: they check a site, we train the person. Region packs may point to them for reporting. |
| Awareness campaigns by banks, police and governments | Both | Reach and authority | We turn the same advice into practice. |

We do not claim to be the first anti-scam game (plan section 2.3).

## 9. Implications and open items

| Item | Status |
|---|---|
| Landing page speaks to both audiences | Done in the PR that adds this document |
| Demo scenario uses a fictional courier and reserved domains | Done in the PR that adds this document |
| URL checker examples use reserved domains and IPs | Done in the PR that adds this document |
| URL checker brand list is Vietnam-centric and misses country-code domains (for example `google.co.uk` would be flagged) | Open: tracked as a GitHub issue |
| Vietnamese UI and content (F19) | Planned; not started |
| Region packs and "where to report" links | Later; each link must be verified |
| User testing includes both Vietnamese and international participants | To do in the usability sessions (plan task D01) |
