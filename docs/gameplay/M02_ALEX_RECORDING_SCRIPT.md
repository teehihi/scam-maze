# Mission 02 "THE RIDE": Alex recording script (EN / VI)

Status: implemented in the game as of 2026-11-25. Recordings are pending except
`m02.coba.confirm.0`. A test (`mission02AlexScript.test.ts`) checks that this script lists every Alex
voice ID and file of Mission 02, so it cannot drift from the game.

## 1. Who Alex is in this mission

Alex is a 23-year-old international final-year student in Ho Chi Minh City, three days from the
thesis deadline. In Mission 01 his voice is quiet, practical and a little anxious. He talks to
himself in short sentences, notices when something does not add up, and steadies himself
("Okay. One section at a time."). Keep the same voice here. Mission 02 is the morning of his last
interview, so the baseline is focused and slightly tense, and it opens up with relief when things
go right.

- English: natural, plain, never theatrical. Contractions are fine.
- Vietnamese: Alex talks to himself as "mình". He calls Cô Ba "cô" and himself "cháu", and he uses
  "anh" / "em" with the street driver and "Minh" / "mình" with his friend. Speak the lines as they
  are written, including "ạ" where it appears: it is politeness, not hesitation.
- Recording format: the same as Mission 01. Mono, 48 kHz, peaks around -3 dBFS, no music, no room
  effect. One file per line per language, with natural pauses at the line breaks (subtitles are cut
  at sentence and line boundaries).

## 2. Coverage audit (what exists in Mission 02 and what Alex says there)

| Mission beat | In the game | Alex voice |
|---|---|---|
| From Mission 01 | Minh calls once the draft is done (or messages, if the call is declined) | New: `m02.alex.briefed`. Minh's call reuses his recorded `minh.setup.0` and `minh.m02_coba.0`; Alex's question in it reuses `alex.minh.m02_coba.0` |
| Mission introduction | The mission opens Wednesday 11:00 | New: `m02.alex.open` |
| Preparing for the interview | The calendar appointment, and Minh the evening before | New: `m02.alex.prepare`, plus 3 existing replies to Minh (IDs added) |
| Street driver | The driver at the Bus 06 stop and his cash offer | New: `m02.alex.driver_offer`, plus 3 existing replies |
| Checking the route | The Bus 06 route board and fare | New: `m02.alex.route_checked` |
| Calling Cô Ba | The confirmation call to the number in the notes | Existing and recorded: `m02.coba.confirm.0`. New: `m02.alex.confirmed` after the call |
| Bus 06 journey | Paying the fare at the validator | New: `m02.alex.on_bus` |
| Cash ride (alternative) | The driver stops three blocks short and asks for more | New: `m02.alex.wrong_stop` |
| District 5 / Chợ Lớn arrival | Stepping off at the market office | New: `m02.alex.arrived` |
| Meeting Cô Ba before 11:30 | Her conversation at the entrance | 3 existing replies |
| Physical interview | The three interview questions | 4 existing replies (also the phone transcript) |
| Late arrival | Arriving after the 12:30 window closed | New: `m02.alex.arrived_late`, plus 3 existing replies |
| Rescheduling and recovery | Cô Ba agrees to a late interview | New: `m02.alex.rescheduled`, plus 3 existing replies |
| Leaving without the interview | The player declines to reschedule | New: `m02.alex.left_without` |
| Mission success | The interview is complete | New: `m02.alex.interview_done`, plus 3 existing replies after it |
| Mission failure | 14:00 without an interview | New: `m02.alex.failed` |
| Transition toward the rest of the chapter | No Mission 03 exists in the game yet | The success line ends on the next step ("Back to the draft. Friday isn't moving.") |
| Parcel inspection and pickup | Not in Mission 02 (no parcel item, event or scene) | None: nothing to trigger it |
| Hard drive connection | Not in Mission 02 (no hard drive item, event or scene) | None: nothing to trigger it |

No Mission 01 recording is reused. None of the Mission 01 lines fits a Mission 02 moment word for
word, and a near fit would be a wrong line. Mission 01 lines still play in their own moments.

Totals:
- **14 new story lines.** In one playthrough the player hears about 8 to 10 of them, because the
  bus and cash-ride branches, and the on-time, late, success and failure branches, exclude each
  other.
- **23 dialogue lines** that Alex speaks in conversations. 19 were already authored with voice IDs
  but had no recording. 3 replies to Minh got new IDs (their text is unchanged). 1 line,
  `m02.coba.confirm.0`, is already recorded.

## 3. How the lines play in the game

- **Story lines** (`m02.alex.*`) play through the same Alex voice queue as Mission 01:
  - One line at a time, so no Alex line ever overlaps another.
  - A story line waits while a phone call, a recorded conversation line or a street conversation is
    open, and plays when it closes.
  - A line that waited more than 30 seconds of play time is dropped.
  - A waiting line whose moment no longer holds is dropped instead of being said late. Examples:
    the "on the bus" line after Alex has already arrived, or the late-arrival line after Cô Ba
    agreed to reschedule.
- **One shot, also across saves.** Each story line is derived from the saved game state. Every line
  whose moment already holds when a game is continued counts as played, so nothing is replayed
  after loading.
- **Conversation replies.** On the street, after the player picks a reply, Alex says it first and
  the NPC answers when he has finished. Both use the one line channel, so they never play together.
  The interview questions use the same recording on the phone transcript.
- **Silent fallback.** A line without a recording is a placeholder: no file is requested. A story
  line then shows its subtitle alone for about 6 seconds. A reply shows its written echo, and the
  NPC answers at once. The game never waits for a voice.
- **Subtitles.**
  - Story lines: `voice.alex.<cue>` in `apps/game/src/i18n/locales/{en,vi}/chapter1/voice.ts`.
  - Replies: the reply label in `storyCast.ts` (EN and VI).
  - Phone transcript: `lastSubmission.vi.ts`.
- **Enabling a recording.**
  - Story line: put both files in place, then add the cue to `MISSION02_ALEX_RECORDED` in
    `apps/game/src/features/chapter1/voice/mission02AlexVoice.ts`.
  - Dialogue line: put both files in place, then move the entry from
    `MISSION02_VOICE_PLACEHOLDERS` to `MISSION02_VOICE_STEMS` in `mission02Voice.ts`.
  - Tests fail if a delivered file is not enabled, or if an enabled line has a missing file.

File locations (both languages, same file name pattern):
- Story lines: `apps/game/public/audio/mission02/<en|vi>/alex_m02_<stem>_<en|vi>.mp3`
- Dialogue lines: `apps/game/public/audio/mission02/<en|vi>/lines/<stem>.mp3`

## 4. New story lines (14)

All are inner voice: Alex talks to himself, close to the microphone, not projected.

### 4.0 `m02.alex.briefed`: after Minh's call

- Trigger: Alex has taken Minh's call after finishing the draft (the line waits until Minh has
  spoken), or he declined it and opened Minh's message. Only before he reaches the market office.
- File EN: `audio/mission02/en/alex_m02_briefed_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_briefed_vi.mp3`
- Direction: relieved for the first half, then focused. The second line is a note to himself.
- Status: new.

| EN | VI |
|---|---|
| Chapter 3 is done, but Section 3.3 still has a gap.<br>I need Cô Ba's answer: how shopkeepers spot a fake transfer receipt. | Chương 3 xong rồi, nhưng Mục 3.3 vẫn còn thiếu.<br>Mình cần câu trả lời của Cô Ba: tiểu thương nhận ra biên lai chuyển khoản giả thế nào. |

### 4.1 `m02.alex.open`: mission introduction

- Trigger: Mission 02 "THE RIDE" opens, Wednesday 11:00 on the story clock.
- File EN: `audio/mission02/en/alex_m02_open_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_open_vi.mp3`
- Direction: focused and a little tense. The first line is a time check, the second a promise to
  himself.
- Status: recorded (both languages).

| EN | VI |
|---|---|
| Eleven o'clock. Cô Ba is at half past eleven, in Chợ Lớn.<br>My last interview. I can't be late for this one. | Mười một giờ rồi. Hẹn Cô Ba lúc mười một rưỡi, ở Chợ Lớn.<br>Buổi phỏng vấn cuối cùng. Lần này không được trễ. |

### 4.2 `m02.alex.prepare`: preparing for the interview

- Trigger: the player opens the calendar appointment "Interview with Cô Ba" for the first time,
  before reaching the market office.
- File EN: `audio/mission02/en/alex_m02_prepare_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_prepare_vi.mp3`
- Direction: practical, reading the note to himself, planning ahead.
- Status: recorded (both languages).

| EN | VI |
|---|---|
| Main entrance of the market office, not the alley.<br>I should decide how I'm getting there before I go. | Cửa chính văn phòng chợ, không phải trong hẻm.<br>Mình nên tính trước xem sẽ đi bằng gì. |

### 4.3 `m02.alex.driver_offer`: the street driver's offer

- Trigger: the player has heard the driver's cash offer. Either the street conversation with the
  driver at the Bus 06 stop (the line plays when the conversation closes), or "Ask the driver about
  his fare" on the phone.
- File EN: `audio/mission02/en/alex_m02_driver_offer_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_driver_offer_vi.mp3`
- Direction: tempted for half a second, then uneasy. Slow down on the second line, with a short
  pause at the ellipsis.
- Status: recorded (both languages).

| EN | VI |
|---|---|
| Sixty thousand, cash, and he'll stop wherever I say.<br>No app, no trip record... Nobody would know where I went. | Sáu mươi nghìn, tiền mặt, muốn dừng đâu cũng được.<br>Không app, không lịch sử chuyến đi... Chẳng ai biết mình đã đi đâu. |

### 4.4 `m02.alex.route_checked`: checking Bus 06

- Trigger: the player reads the Bus 06 route board and notes the fare.
- File EN: `audio/mission02/en/alex_m02_route_checked_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_route_checked_vi.mp3`
- Direction: calm, weighing it up, settling on the safer choice. Light reassurance at the end.
- Status: recorded (both languages).

| EN | VI |
|---|---|
| Seven thousand, three stops, and the route is on record.<br>Slower, maybe. But I know exactly where it ends. | Bảy nghìn, ba trạm, lộ trình có ghi lại hẳn hoi.<br>Có thể chậm hơn. Nhưng mình biết chắc nó dừng ở đâu. |

### 4.5 `m02.alex.confirmed`: after calling Cô Ba

- Trigger: the confirmation call to Cô Ba through the number in the interview notes is done. The
  line plays after the call ends, never during it.
- File EN: `audio/mission02/en/alex_m02_confirmed_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_confirmed_vi.mp3`
- Direction: relieved, a small exhale. Quietly pleased that checking paid off.
- Status: new.

| EN | VI |
|---|---|
| Main entrance, market side. And she's expecting me.<br>Good thing I called the number I already had. | Cửa chính, phía chợ. Và Cô Ba đang đợi mình.<br>May mà mình gọi đúng số mình đã có sẵn. |

### 4.6 `m02.alex.on_bus`: the Bus 06 journey

- Trigger: the Bus 06 fare is paid at the validator (on the bus in the street, or on the phone).
- File EN: `audio/mission02/en/alex_m02_on_bus_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_on_bus_vi.mp3`
- Direction: settled, sitting down, a little lighter. The last sentence is a quiet "back to work".
- Status: new.

| EN | VI |
|---|---|
| Fare paid, and it's on the record.<br>Thirty-four minutes to Chợ Lớn. Time to go over my questions. | Trả vé rồi, có ghi nhận đàng hoàng.<br>Ba mươi bốn phút tới Chợ Lớn. Tranh thủ xem lại mấy câu hỏi. |

### 4.7 `m02.alex.wrong_stop`: the cash ride stops short

- Trigger: the cash ride ends at the corner of Nguyễn Trãi, three blocks from the market office
  (after "Pay 60,000 VND and ride with him").
- File EN: `audio/mission02/en/alex_m02_wrong_stop_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_wrong_stop_vi.mp3`
- Direction: surprised, then frustrated, under his breath. Not shouting: the driver is right there.
- Status: new.

| EN | VI |
|---|---|
| This isn't the market office.<br>Three blocks short, and now he wants thirty thousand more? | Đây đâu phải văn phòng chợ.<br>Còn cách ba dãy nhà, giờ lại đòi thêm ba mươi nghìn nữa? |

### 4.8 `m02.alex.arrived`: arriving at Chợ Lớn on time

- Trigger: Alex reaches the market office while the appointment window is still open (stepping
  off Bus 06, or walking or riding the last blocks).
- File EN: `audio/mission02/en/alex_m02_arrived_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_arrived_vi.mp3`
- Direction: relief and quiet resolve. A short breath after "Made it."
- Status: new.

| EN | VI |
|---|---|
| Made it. Chợ Lớn.<br>Main entrance, not the alley. Let's find Cô Ba. | Tới rồi. Chợ Lớn.<br>Cửa chính, không phải trong hẻm. Đi tìm Cô Ba thôi. |

### 4.9 `m02.alex.arrived_late`: late arrival

- Trigger: Alex is at the market office and the 11:30 slot was missed (the window closed at
  12:30, before he arrived or before the interview started).
- File EN: `audio/mission02/en/alex_m02_arrived_late_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_arrived_late_vi.mp3`
- Direction: a sinking feeling, then responsibility. No self-pity. He decides to face it.
- Status: new.

| EN | VI |
|---|---|
| It's after twelve thirty. I missed the slot.<br>She waited for me. The least I can do is go and apologize. | Quá mười hai rưỡi rồi. Mình lỡ giờ hẹn.<br>Cô Ba đã đợi mình. Ít nhất cũng phải tới xin lỗi cô. |

### 4.10 `m02.alex.rescheduled`: rescheduling and recovery

- Trigger: Cô Ba agrees to do the interview late (the player asks to reschedule, or accepts the
  late interview).
- File EN: `audio/mission02/en/alex_m02_rescheduled_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_rescheduled_vi.mp3`
- Direction: grateful, determined. The second line is firm, almost a whisper to himself.
- Status: new.

| EN | VI |
|---|---|
| She's still willing to do it.<br>I'm not wasting this second chance. | Cô vẫn đồng ý phỏng vấn.<br>Mình không được phí cơ hội thứ hai này. |

### 4.11 `m02.alex.left_without`: leaving without the interview

- Trigger: the player chooses "Leave without rescheduling the interview".
- File EN: `audio/mission02/en/alex_m02_left_without_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_left_without_vi.mp3`
- Direction: tired, disappointed in himself, matter-of-fact. No drama.
- Status: new.

| EN | VI |
|---|---|
| I came all the way to Chợ Lớn, and I'm leaving with nothing.<br>Chapter three is going to have a gap. | Đi cả quãng đường tới Chợ Lớn, rồi về tay không.<br>Chương ba sẽ bị hổng một đoạn. |

### 4.12 `m02.alex.interview_done`: mission success and what comes next

- Trigger: the interview is complete (Alex asked one of the interview questions face to face, or on
  the phone fallback). The line plays after the conversation with Cô Ba closes.
- File EN: `audio/mission02/en/alex_m02_interview_done_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_interview_done_vi.mp3`
- Direction: satisfied, with energy coming back. The first line is the lesson in his own words. The
  second turns him toward the rest of the chapter: the draft and the Friday deadline.
- Status: new.

| EN | VI |
|---|---|
| Check it yourself, in your own account. That's the quote my chapter needed.<br>Back to the draft. Friday isn't moving. | Tự kiểm tra, trên chính tài khoản của mình. Đó đúng là trích dẫn chương này còn thiếu.<br>Quay lại bản thảo thôi. Hạn thứ Sáu không chờ ai cả. |

### 4.13 `m02.alex.failed`: mission failure

- Trigger: the mission's 14:00 deadline passes without the interview. This line does not play when
  the player already chose to leave (`m02.alex.left_without` covers that moment).
- File EN: `audio/mission02/en/alex_m02_failed_en.mp3`
- File VI: `audio/mission02/vi/alex_m02_failed_vi.mp3`
- Direction: low and heavy, accepting the consequence. Not defeated: he already knows what he has
  to do.
- Status: new.

| EN | VI |
|---|---|
| Two o'clock. No interview.<br>Now I have to explain to my supervisor why chapter three is missing a source. | Hai giờ chiều rồi. Không có buổi phỏng vấn nào.<br>Giờ mình phải giải thích với giảng viên vì sao chương ba thiếu nguồn. |

## 5. Dialogue lines (23)

Alex speaks these aloud to another character, at normal conversational volume. In the street
conversations the player picks them as replies ([1] / [2] / [3]), and the other character answers
after Alex has finished. All files are in `audio/mission02/<en|vi>/lines/`. "Existing ID" means the
line and its voice ID were already in the game without a recording. "New ID" means the text
already existed and only the voice ID is new.

### 5.1 Minh, the evening before (preparing for the interview)

Trigger: Alex picks the reply in the street conversation with Minh (Mission 01 → 02, the evening
before the interview). Direction: relaxed and friendly, talking to a close friend.

| Dialogue ID | EN | VI | File (EN and VI) | Status |
|---|---|---|---|---|
| `m02.minh.minh_m02_route.alex` | Best way down to District 5? | Mai đi Quận 5 bằng gì tiện nhất? | `alex.minh.m02_route.0.mp3` | New ID |
| `m02.minh.minh_m02_coba.alex` | What should I ask Cô Ba? | Gặp Cô Ba cần chốt số liệu gì? | `alex.minh.m02_coba.0.mp3` | New ID |
| `m02.minh.minh_leave.alex` | See you tomorrow morning. | Hẹn sáng mai nha Minh. | `alex.minh.leave.0.mp3` | New ID |

### 5.2 The street driver at the Bus 06 stop

Trigger: Alex picks the reply in the street conversation with the driver. Direction: polite but
guarded. "Which route" is a careful question. "No thanks" is friendly and final.

| Dialogue ID | EN | VI | File (EN and VI) | Status |
|---|---|---|---|---|
| `m02.driver.driver_ask_app.alex` | Why don't you run through the ride app? | Sao anh không bật app để em đặt cho an toàn? | `alex.driver.ask_app.0.mp3` | Existing ID, not recorded |
| `m02.driver.driver_ask_plate.alex` | Which route do you take to District 5? | Anh chạy tuyến nào xuống Quận 5? | `alex.driver.ask_plate.0.mp3` | Existing ID, not recorded |
| `m02.driver.driver_wait_bus.alex` | No thanks — I'll take Bus 06. | Thôi cảm ơn anh — em đi xe Buýt 06. | `alex.driver.wait_bus.0.mp3` | Existing ID, not recorded |

### 5.3 Calling Cô Ba

Trigger: the player uses "Call and confirm the appointment and the meeting point" on Cô Ba's
contact. This is the first line of the call. Direction: polite and a little formal, on the phone.

| Dialogue ID | EN | VI | File (EN and VI) | Status |
|---|---|---|---|---|
| `m02.coba.confirm.0` | Hello, this is Alex. I am calling the number in my interview notes about the 11:30 appointment. | Chào cô, cháu là Alex. Cháu gọi số trong ghi chú phỏng vấn về lịch hẹn 11:30. | `coba.confirm.0.mp3` | Already implemented and recorded, but `en/lines/` and `vi/lines/` hold the same take. Check which language it is and record the other one |

### 5.4 Cô Ba at the entrance, before the interview

Trigger: Alex picks the reply in the conversation with Cô Ba before the interview has started.
Direction: respectful and eager, a student meeting an interviewee.

| Dialogue ID | EN | VI | File (EN and VI) | Status |
|---|---|---|---|---|
| `m02.coba.waiting.where.alex` | Where exactly is the main entrance? | Cửa chính nằm chính xác ở đâu ạ? | `alex.coba.waiting.where.0.mp3` | Existing ID, not recorded |
| `m02.coba.waiting.slot.alex` | I will be there at 11:30. | 11:30 cháu sẽ có mặt ạ. | `alex.coba.waiting.slot.0.mp3` | Existing ID, not recorded |
| `m02.coba.waiting.ledger.alex` | Should I bring anything to the interview? | Cháu có cần mang gì tới buổi phỏng vấn không cô? | `alex.coba.waiting.ledger.0.mp3` | Existing ID, not recorded |

### 5.5 The interview at Chợ Lớn

Trigger: Alex picks the question in the interview conversation. The same question in the phone
transcript of the interview ("Ask how shopkeepers verify a transfer receipt" and the others) uses
the same recording. Direction: attentive interviewer, clear and unhurried. The reschedule line is
apologetic.

| Dialogue ID | EN | VI | File (EN and VI) | Status |
|---|---|---|---|---|
| `m02.coba.interview.transfer_check.alex` | How do you check a transfer receipt? | Cô kiểm tra bill chuyển khoản thế nào? | `alex.coba.interview.transfer_check.0.mp3` | Existing ID, not recorded |
| `m02.coba.interview.process.alex` | What is your full checking process? | Quy trình kiểm tra đầy đủ của cô là gì? | `alex.coba.interview.process.0.mp3` | Existing ID, not recorded |
| `m02.coba.interview.exception.alex` | What if the receipt looks wrong? | Nếu bill có gì không đúng thì sao cô? | `alex.coba.interview.exception.0.mp3` | Existing ID, not recorded |
| `m02.coba.interview.invite_reschedule.alex` | I am late — can we reschedule? | Cháu tới trễ rồi — mình dời lại được không cô? | `alex.coba.interview.invite_reschedule.0.mp3` | Existing ID, not recorded |

### 5.6 Late arrival

Trigger: Alex picks the reply in the conversation with Cô Ba after the 11:30 slot was missed.
Direction: sincerely sorry, quiet, not grovelling.

| Dialogue ID | EN | VI | File (EN and VI) | Status |
|---|---|---|---|---|
| `m02.coba.late.reschedule.alex` | Could we do it now, at the entrance? | Mình làm luôn bây giờ ở cửa chính được không cô? | `alex.coba.late.reschedule.0.mp3` | Existing ID, not recorded |
| `m02.coba.late.thanks.alex` | I am sorry I kept you waiting. | Cháu xin lỗi vì để cô phải đợi. | `alex.coba.late.thanks.0.mp3` | Existing ID, not recorded |
| `m02.coba.late.leave.alex` | I should not keep you from the stall. | Cháu không giữ cô khỏi việc bán hàng nữa. | `alex.coba.late.leave.0.mp3` | Existing ID, not recorded |

### 5.7 The rescheduled interview

Trigger: Alex picks the reply in the conversation with Cô Ba after she agreed to reschedule.
Direction: grateful and warm.

| Dialogue ID | EN | VI | File (EN and VI) | Status |
|---|---|---|---|---|
| `m02.coba.rescheduled.start.alex` | Thank you for fitting me in. | Cảm ơn cô đã sắp xếp lại cho cháu. | `alex.coba.rescheduled.start.0.mp3` | Existing ID, not recorded |
| `m02.coba.rescheduled.confirm.alex` | Can we use the main entrance again? | Mình vẫn gặp ở cửa chính phải không cô? | `alex.coba.rescheduled.confirm.0.mp3` | Existing ID, not recorded |
| `m02.coba.rescheduled.leave.alex` | I should come back another day. | Chắc cháu nên quay lại hôm khác. | `alex.coba.rescheduled.leave.0.mp3` | Existing ID, not recorded |

### 5.8 After the interview

Trigger: Alex picks the reply in the conversation with Cô Ba after the interview is complete.
Direction: thankful and relieved, a warm goodbye.

| Dialogue ID | EN | VI | File (EN and VI) | Status |
|---|---|---|---|---|
| `m02.coba.after.thanks.alex` | Thank you for the time, Cô Ba. | Cảm ơn cô đã dành thời gian ạ. | `alex.coba.after.thanks.0.mp3` | Existing ID, not recorded |
| `m02.coba.after.recap.alex` | Anything else I should not miss? | Cô còn điều gì cháu không nên bỏ sót ạ? | `alex.coba.after.recap.0.mp3` | Existing ID, not recorded |
| `m02.coba.after.leave.alex` | I should get going. | Cháu phải đi đây ạ. | `alex.coba.after.leave.0.mp3` | Existing ID, not recorded |

## 6. Delivery checklist

- The full set is 37 lines × 2 languages = 74 files. Delivered: `open`, `prepare`, `driver_offer` and
  `route_checked` (8 files). 65 are still to record; `coba.confirm.0` has one take, which is
  currently copied into both language folders.
- Each file contains exactly the text in the table, nothing before or after.
- The file names are exactly as listed (lower case, dots and underscores as shown).
- After delivery, enable each line (section 3) and run
  `pnpm --filter @scammaze/game exec vitest run src/features/chapter1/voice`.
