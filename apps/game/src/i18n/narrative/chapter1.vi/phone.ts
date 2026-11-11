// Vietnamese Chapter 1 narrative overlay, phone part (game-i18n-en-vi, task 6.6).
// Keys: `phone/messages/*`, `phone/contacts/*/name` and `phone/bankApp/*`.
// Missing keys fall back to English.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const PHONE_VI: NarrativeOverlay = {
  "phone/messages/msg.sms-alert/from": "Northgate Bank",
  "phone/messages/msg.sms-alert/body":
    "Northgate Bank: Tài khoản có số đuôi 9284 đã bị tạm khóa do có hoạt động bất thường ở nước ngoài. Hãy xác minh danh tính trong vòng 15 phút tại northgate-secure-verify.invalid để tránh bị khóa vĩnh viễn.",
  "phone/messages/msg.otp-sms/from": "Northgate Bank",
  "phone/messages/msg.otp-sms/body":
    "Northgate Bank: Đây là mã xác thực một lần để duyệt đăng nhập trên thiết bị mới. Mã hết hạn sau 5 phút. Không chia sẻ mã này với bất kỳ ai, kể cả nhân viên ngân hàng.",
  "phone/contacts/+000 555 0142/name": "Bộ phận Bảo mật Northgate Bank",
  "phone/contacts/+000 555 0100/name": "Chăm sóc khách hàng Northgate Bank",
  "phone/bankApp/title": "Northgate Bank",
  "phone/bankApp/screens/bank.account/title": "Tài khoản của bạn",
  "phone/bankApp/screens/bank.account/body":
    "Tài khoản có số đuôi 9284 đang hoạt động bình thường. Tài khoản của bạn không có cảnh báo nào.",
  "phone/bankApp/screens/bank.activity/title": "Hoạt động gần đây",
  "phone/bankApp/screens/bank.activity/body":
    "Không có giao dịch chuyển tiền nào đang chờ xử lý. Hoạt động gần nhất của bạn là một lần thanh toán bằng thẻ tại cửa hàng ở góc phố hôm qua.",
  "phone/bankApp/screens/bank.help/title": "Trợ giúp và liên hệ",
  "phone/bankApp/screens/bank.help/body":
    "Gọi bộ phận chăm sóc khách hàng theo số +000 555 0100 hoặc truy cập northgate.example. Northgate Bank sẽ không bao giờ hỏi mã xác thực một lần của bạn hoặc yêu cầu bạn chuyển tiền sang tài khoản khác.",
};
