// Vietnamese Chapter 1 narrative overlay, core part (game-i18n-en-vi, task 6.2).
// Keys: `title`, `subtitle`, `objectives/*`, `claims/*`, `warningSigns/*`, `journalNotes/*`,
// `prompts/*`. Missing keys fall back to English.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const CORE_VI: NarrativeOverlay = {
  title: "Cuộc gọi khẩn cấp",
  subtitle: "Thông báo đến trước cả bữa sáng.",

  "objectives/obj.look-around/text": "Hãy nhìn quanh con phố của bạn.",
  "objectives/obj.answer-call/text": "Điện thoại của bạn đang đổ chuông. Hãy nghe máy hoặc từ chối.",
  "objectives/obj.check-claims/text": "Kiểm tra những gì người gọi đã nói với bạn.",
  "objectives/obj.decide/text": "Quyết định xem bạn sẽ làm gì với yêu cầu của người gọi.",
  "objectives/obj.review/text": "Xem lại những gì đã xảy ra.",

  "claims/claim.caller-identity/text": "Người gọi là nhân viên của Northgate Bank.",
  "claims/claim.account-suspended/text": "Tài khoản của bạn đã bị tạm khóa.",
  "claims/claim.code-needed/text":
    "Ngân hàng cần mã xác thực một lần của bạn để chặn một giao dịch chuyển tiền.",
  "claims/claim.protected-account/text":
    "Chuyển tiền sang một tài khoản tạm giữ được bảo vệ sẽ giúp giữ tiền của bạn.",

  "warningSigns/ws.urgency/label": "Thúc giục gấp gáp",
  "warningSigns/ws.urgency/description":
    "Tin nhắn chỉ cho bạn rất ít thời gian. Kẻ lừa đảo hối thúc để người khác không kịp dừng lại kiểm tra.",
  "warningSigns/ws.look-alike-link/label": "Đường link giả mạo",
  "warningSigns/ws.look-alike-link/description":
    "Đường link có tên ngân hàng, nhưng đó không phải trang web chính thức của ngân hàng. Ai cũng có thể đặt tên một ngân hàng vào địa chỉ web.",
  "warningSigns/ws.code-request/label": "Yêu cầu mã xác thực một lần",
  "warningSigns/ws.code-request/description":
    "Mã xác thực một lần cho phép người khác đăng nhập hoặc duyệt thanh toán dưới tên bạn. Ngân hàng thật không bao giờ yêu cầu bạn đọc mã này ra.",
  "warningSigns/ws.unknown-number/label": "Số điện thoại lạ",
  "warningSigns/ws.unknown-number/description":
    "Cuộc gọi đến từ một số không phải số điện thoại chính thức của ngân hàng. Số hiển thị cũng có thể bị giả mạo, nên chỉ dựa vào số điện thoại thì không chứng minh được điều gì.",
  "warningSigns/ws.move-money/label": "Yêu cầu chuyển tiền",
  "warningSigns/ws.move-money/description":
    "Người gọi bảo bạn chuyển tiền sang một tài khoản khác để bảo vệ số tiền đó. Ngân hàng thật không yêu cầu như vậy.",
  "warningSigns/ws.partial-details/label": "Biết một vài thông tin cá nhân",
  "warningSigns/ws.partial-details/description":
    "Người gọi biết tên bạn và một phần số tài khoản của bạn. Những thông tin này có thể đến từ dữ liệu bị rò rỉ, nên chúng không chứng minh được người gọi là ai.",
  "warningSigns/ws.emotional-pressure/label": "Gây áp lực cảm xúc",
  "warningSigns/ws.emotional-pressure/description":
    "Người gọi khiến bạn lo lắng hoặc thấy có lỗi để bạn hành động trước khi kịp suy nghĩ.",

  "journalNotes/note.number-mismatch/text":
    "Hai số điện thoại khác nhau. Đó là một dấu hiệu cảnh báo, nhưng số hiển thị có thể bị giả mạo, nên dù hai số có trùng nhau thì cũng không chứng minh được điều gì.",

  "prompts/obj.wallet": "Nhấn E để xem ví của bạn trên bàn quán cà phê",
  "prompts/obj.mailbox": "Nhấn E để mở hộp thư của bạn",
  "prompts/obj.shop-poster": "Nhấn E để đọc thông báo của Northgate trên cửa kính cửa hàng",
  "prompts/obj.shopkeeper": "Nhấn E để nói chuyện với Sam ở quầy cửa hàng",
  "prompts/obj.notice-board": "Nhấn E để đọc bảng tin của khu phố",
};
