// Vietnamese Chapter 1 narrative overlay, world part (game-i18n-en-vi, task 6.4).
// Keys: `interactables/*`, `npcs/*` and `calls/*/displayName`. Missing keys fall back to English.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const WORLD_VI: NarrativeOverlay = {
  "interactables/obj.wallet/label": "ví của bạn trên bàn quán cà phê",
  "interactables/obj.wallet/actionLabel": "kiểm tra",
  "interactables/obj.wallet/inspectionText":
    "Thẻ Northgate Bank của bạn nằm trong ví. Mặt sau thẻ ghi số điện thoại chính thức của ngân hàng: +000 555 0100.",

  "interactables/obj.mailbox/label": "hộp thư của bạn",
  "interactables/obj.mailbox/actionLabel": "mở",
  "interactables/obj.mailbox/inspectionText":
    "Có một lá thư từ Northgate Bank về bản sao kê hằng năm của bạn. Thư ghi số hỗ trợ khách hàng +000 555 0100 và trang web northgate.example. Thư không nhắc đến vấn đề nào với tài khoản của bạn.",

  "interactables/obj.shop-poster/label": "thông báo của Northgate trên cửa kính cửa hàng",
  "interactables/obj.shop-poster/actionLabel": "đọc",
  "interactables/obj.shop-poster/inspectionText":
    "Thông báo ghi: “Northgate Bank sẽ không bao giờ hỏi mã xác thực một lần của bạn. Chúng tôi sẽ không bao giờ yêu cầu bạn chuyển tiền sang tài khoản khác để bảo vệ số tiền đó.”",

  "interactables/obj.shopkeeper/label": "Sam ở quầy cửa hàng",
  "interactables/obj.shopkeeper/actionLabel": "nói chuyện với",
  "interactables/obj.shopkeeper/inspectionText":
    "Sam là chủ cửa hàng ở góc phố và quen biết hầu hết mọi người trên con phố này.",

  "interactables/obj.notice-board/label": "bảng thông báo của khu phố",
  "interactables/obj.notice-board/actionLabel": "đọc",
  "interactables/obj.notice-board/inspectionText":
    "Trên bảng có ghim một cảnh báo của khu phố: “Một số hàng xóm đã nhận được cuộc gọi từ những người tự xưng là nhân viên ngân hàng. Họ yêu cầu chuyển tiền tiết kiệm sang một ‘tài khoản được bảo vệ’. Đừng chuyển tiền chỉ vì người gọi yêu cầu. Hãy gọi cho ngân hàng của bạn qua số mà bạn đã biết từ trước.”",

  "calls/call.scam-1/displayName": "Bộ phận Bảo mật Northgate Bank",
  "calls/call.callback/displayName": "Bộ phận Bảo mật Northgate Bank",
  "calls/call.official/displayName": "Chăm sóc khách hàng Northgate Bank",

  "npcs/npc.sam/name": "Sam",
};
