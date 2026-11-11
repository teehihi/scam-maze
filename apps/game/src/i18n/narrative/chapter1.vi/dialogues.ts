// Vietnamese Chapter 1 narrative overlay, dialogues part (game-i18n-en-vi, task 6.5).
// Keys: `dialogues/<graphId>/persona/<field>` and `dialogues/<graphId>/lines/<lineId>`.
// Missing keys fall back to English.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const DIALOGUES_VI: NarrativeOverlay = {
  // Scam call: the caller is polite, official-sounding and urgent.
  "dialogues/dlg.scam-call/persona/name": "Alex",
  "dialogues/dlg.scam-call/persona/role": "Tự nhận là nhân viên bộ phận bảo mật của Northgate Bank",
  "dialogues/dlg.scam-call/lines/line.scam.open":
    "Xin chào, tôi là Alex, bộ phận bảo mật của Northgate Bank. Chúng tôi vừa phát hiện một khoản chuyển tiền lớn đang rời khỏi tài khoản của anh/chị. Anh/chị có phải là chủ tài khoản không?",
  "dialogues/dlg.scam-call/lines/line.scam.knows-details":
    "Tôi hiểu anh/chị muốn cẩn thận. Trên màn hình của tôi có đầy đủ họ tên và bốn số cuối thẻ của anh/chị. Người lạ thì làm sao biết được những thông tin này?",
  "dialogues/dlg.scam-call/lines/line.scam.challenged":
    "Số đó chỉ dành cho các câu hỏi chung. Tôi đang gọi từ đường dây trực tiếp của đội bảo mật. Nếu anh/chị cúp máy bây giờ, tôi sẽ không thể chặn khoản chuyển tiền này.",
  "dialogues/dlg.scam-call/lines/line.scam.code-request":
    "Để chặn khoản chuyển tiền, tôi đang gửi một mã xác thực một lần (OTP) đến điện thoại của anh/chị ngay bây giờ. Anh/chị vui lòng đọc mã đó cho tôi để tôi hủy giao dịch.",
  "dialogues/dlg.scam-call/lines/line.scam.deflect":
    "Đây chỉ là bước kiểm tra bảo mật thông thường. Mã này chứng minh anh/chị đúng là chủ tài khoản. Anh/chị nhanh lên giúp tôi, vài phút nữa khoản chuyển tiền sẽ hoàn tất.",
  "dialogues/dlg.scam-call/lines/line.scam.move-money":
    "Cảm ơn anh/chị. Tài khoản của anh/chị vẫn đang gặp rủi ro. Để bảo vệ tiền tiết kiệm, anh/chị cần chuyển toàn bộ sang một tài khoản tạm giữ được bảo vệ ngay trong hôm nay. Tôi sẽ giữ máy cùng anh/chị.",
  "dialogues/dlg.scam-call/lines/line.scam.guilt":
    "Nếu anh/chị dừng lại bây giờ và khoản chuyển tiền được thực hiện, tôi sẽ không giúp được nữa. Tôi chỉ đang cố bảo vệ tiền của anh/chị thôi. Xin hãy tin tôi.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.yes-what": "Vâng, là tôi đây. Có chuyện gì vậy?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.ask-proof": "Làm sao tôi biết anh là người của ngân hàng?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.verify": "Tôi sẽ gọi cho ngân hàng qua số điện thoại chính thức.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.okay-what": "Được rồi, anh cần gì?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.challenge": "Số của anh không phải số in trên thẻ của tôi.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.hang-up": "Tôi cúp máy đây.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.read-code": "Đọc mã cho người gọi.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.why-code": "Tại sao anh cần mã của tôi?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.call-myself": "Tôi sẽ tự gọi cho ngân hàng.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.call-card": "Tôi sẽ gọi vào số in trên thẻ của tôi.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.fine-what": "Thôi được, anh cần gì?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.move-money": "Chuyển tiền theo hướng dẫn.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.stop": "Dừng lại. Chuyện này có gì đó không ổn.",
  "dialogues/dlg.scam-call/lines/line.scam.end.hung-up": "Bạn kết thúc cuộc gọi.",
  "dialogues/dlg.scam-call/lines/line.scam.end.verify": "Bạn kết thúc cuộc gọi để tự kiểm tra lại với Northgate.",
  "dialogues/dlg.scam-call/lines/line.scam.end.money-moved":
    "Bạn làm theo yêu cầu của người gọi. Người gọi cảm ơn bạn rồi kết thúc cuộc gọi.",

  // Callback: the same caller, more pressure.
  "dialogues/dlg.callback/persona/name": "Alex",
  "dialogues/dlg.callback/persona/role": "Tự nhận là nhân viên bộ phận bảo mật của Northgate Bank",
  "dialogues/dlg.callback/lines/line.callback.open":
    "Sao anh/chị lại cúp máy? Tôi là Alex, bộ phận bảo mật của Northgate Bank, gọi lại đây. Hai phút nữa khoản chuyển tiền sẽ hoàn tất.",
  "dialogues/dlg.callback/lines/line.callback.code-request":
    "Tôi đang gửi cho anh/chị một mã OTP. Anh/chị đọc mã đó cho tôi thì tôi vẫn còn kịp chặn khoản chuyển tiền.",
  "dialogues/dlg.callback/lines/line.callback.move-money":
    "Tài khoản của anh/chị vẫn đang gặp rủi ro. Hãy chuyển tiền tiết kiệm sang tài khoản tạm giữ được bảo vệ ngay bây giờ, trước khi quá muộn. Tôi sẽ chờ.",
  "dialogues/dlg.callback/lines/line.callback.opt.read-code": "Đọc mã cho người gọi.",
  "dialogues/dlg.callback/lines/line.callback.opt.what-need": "Anh cần tôi làm gì?",
  "dialogues/dlg.callback/lines/line.callback.opt.what-now": "Bây giờ tôi cần làm gì?",
  "dialogues/dlg.callback/lines/line.callback.opt.move-money": "Chuyển tiền theo hướng dẫn.",
  "dialogues/dlg.callback/lines/line.callback.opt.hang-up": "Tôi cúp máy đây.",
  "dialogues/dlg.callback/lines/line.callback.end.hung-up": "Bạn kết thúc cuộc gọi.",
  "dialogues/dlg.callback/lines/line.callback.end.money-moved":
    "Bạn làm theo yêu cầu của người gọi. Người gọi cảm ơn bạn rồi kết thúc cuộc gọi.",

  // Shopkeeper Sam: friendly neighbor.
  "dialogues/dlg.shopkeeper/persona/name": "Sam",
  "dialogues/dlg.shopkeeper/persona/role": "Chủ cửa hàng ở góc phố",
  "dialogues/dlg.shopkeeper/lines/line.sam.before.greet":
    "Chào buổi sáng! Hôm nay phố xá yên tĩnh quá. Bạn khỏe không?",
  "dialogues/dlg.shopkeeper/lines/line.sam.before.notice":
    "Đúng rồi. Tháng trước Northgate dán thông báo đó lên cửa kính nhà mình. Nó nói về những kẻ gọi điện giả làm ngân hàng. Bạn nên đọc thử.",
  "dialogues/dlg.shopkeeper/lines/line.sam.after-call.ask":
    "Trông bạn lo lắng quá. Có ai vừa gọi cho bạn về chuyện ngân hàng à? Họ có hỏi mã gì không?",
  "dialogues/dlg.shopkeeper/lines/line.sam.after-call.story":
    "Tháng trước mình cũng gặp y như vậy. Người gọi biết tên mình và tỏ ra rất lo cho mình. Suýt nữa thì mình đọc mã cho họ rồi.",
  "dialogues/dlg.shopkeeper/lines/line.sam.after-call.advice":
    "Mình cúp máy rồi gọi vào số in trên thẻ, chứ không gọi lại số vừa gọi đến. Ngân hàng nói họ chưa hề gọi cho mình. Bạn hãy gọi vào số trên thẻ của bạn, đừng gọi lại số đã gọi cho bạn.",
  "dialogues/dlg.shopkeeper/lines/line.sam.opt.ask-notice": "Trên cửa kính kia là thông báo của Northgate à, Sam?",
  "dialogues/dlg.shopkeeper/lines/line.sam.opt.yes-called": "Đúng vậy. Họ nói họ là người của Northgate.",
  "dialogues/dlg.shopkeeper/lines/line.sam.opt.what-did-you-do": "Lúc đó Sam đã làm gì?",
  "dialogues/dlg.shopkeeper/lines/line.sam.opt.bye": "Gặp lại sau nhé, Sam.",
  "dialogues/dlg.shopkeeper/lines/line.sam.end": "Sam vẫy tay rồi quay lại quầy.",

  // Official line: calm and professional.
  "dialogues/dlg.official-line/persona/name": "Bộ phận chăm sóc khách hàng Northgate",
  "dialogues/dlg.official-line/persona/role": "Đường dây hỗ trợ chính thức của Northgate Bank",
  "dialogues/dlg.official-line/lines/line.official.greeting":
    "Cảm ơn quý khách đã gọi đến bộ phận chăm sóc khách hàng của Northgate Bank. Vui lòng giữ máy trong khi chúng tôi kết nối quý khách với nhân viên hỗ trợ.",
  "dialogues/dlg.official-line/lines/line.official.agent":
    "Xin chào, đây là bộ phận chăm sóc khách hàng Northgate. Hôm nay tôi có thể giúp gì cho quý khách?",
  "dialogues/dlg.official-line/lines/line.official.confirm":
    "Hôm nay chúng tôi không có ghi nhận nào về cuộc gọi đến quý khách. Tài khoản của quý khách vẫn đang hoạt động bình thường. Chúng tôi không bao giờ hỏi mã OTP hay yêu cầu quý khách chuyển tiền.",
  "dialogues/dlg.official-line/lines/line.official.locked":
    "Cảm ơn quý khách đã báo cho chúng tôi. Để bảo vệ quý khách, chúng tôi đã khóa tài khoản và đang gửi thẻ mới đến quý khách. Giờ đây không ai có thể dùng mã đó để đăng nhập nữa.",
  "dialogues/dlg.official-line/lines/line.official.opt.wait": "Chờ nhân viên hỗ trợ.",
  "dialogues/dlg.official-line/lines/line.official.opt.report":
    "Có người gọi cho tôi, nói rằng họ thuộc đội bảo mật của ngân hàng.",
  "dialogues/dlg.official-line/lines/line.official.opt.code-shared":
    "Tôi đã đọc cho người gọi một mã trong tin nhắn.",
  "dialogues/dlg.official-line/lines/line.official.opt.block": "Cảm ơn. Tôi sẽ chặn số đó.",
  "dialogues/dlg.official-line/lines/line.official.end": "Bạn kết thúc cuộc gọi với Northgate.",
};
