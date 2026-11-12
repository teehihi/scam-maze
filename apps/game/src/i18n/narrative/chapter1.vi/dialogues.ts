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
  // Scam call: lines added by the voice narrative feature.
  "dialogues/dlg.scam-call/lines/line.scam.details":
    "Có một khoản thanh toán lớn đang chờ rời khỏi tài khoản của anh/chị. Tôi không thể nói thêm trên đường dây mở này. Tôi giúp anh/chị chặn được, nhưng chúng ta còn rất ít thời gian.",
  "dialogues/dlg.scam-call/lines/line.scam.identity":
    "Mã nhân viên của tôi là 0000, tôi làm ở bộ phận phòng chống gian lận. Nếu cần, tôi đọc lại mã này cho anh/chị. Giờ chúng ta chặn khoản thanh toán chứ?",
  "dialogues/dlg.scam-call/lines/line.scam.time":
    "Khoản thanh toán sẽ được thực hiện trong khoảng mười phút nữa. Sau đó thì không thể hoàn lại. Xin anh/chị đừng làm mọi việc khó hơn mức cần thiết.",
  "dialogues/dlg.scam-call/lines/line.scam.time-insist":
    "Tôi hiểu, nhưng chúng ta chỉ còn vài phút. Từng phút đều quan trọng. Anh/chị cứ ở lại trên máy, rồi chúng ta sẽ cùng xử lý.",
  "dialogues/dlg.scam-call/lines/line.scam.app-check":
    "Hôm nay ứng dụng ngân hàng chạy chậm, và nó hay không hiển thị các khoản thanh toán mới. Vì vậy tôi mới gọi cho anh/chị. Lúc này anh/chị đừng dựa vào ứng dụng.",
  "dialogues/dlg.scam-call/lines/line.scam.app-excuse":
    "Anh/chị đang xem thông tin cũ. Ứng dụng chưa cập nhật. Tôi đang xem hệ thống trực tiếp. Xin anh/chị nghe tôi, đừng nghe ứng dụng.",
  "dialogues/dlg.scam-call/lines/line.scam.sms-link":
    "Anh/chị cũng vừa nhận một tin nhắn có đường dẫn. Anh/chị mở ra và xác nhận thông tin ở đó. Đó là cách nhanh nhất để chặn khoản thanh toán.",
  "dialogues/dlg.scam-call/lines/line.scam.link-defend":
    "Tin nhắn đó nằm trong quy trình bảo mật của chúng tôi. Nó trông khác vì được gửi từ một hệ thống đặc biệt. Anh/chị cứ dùng đường dẫn đó đi.",
  "dialogues/dlg.scam-call/lines/line.scam.code-excuse":
    "Dòng cảnh báo đó chỉ là thông báo chung. Nó không áp dụng cho nhân viên bảo mật. Chính tôi đã yêu cầu hệ thống gửi mã, nên anh/chị đọc cho tôi cũng được.",
  "dialogues/dlg.scam-call/lines/line.scam.account-details":
    "Tôi sẽ đưa thông tin tài khoản tạm giữ ngay khi anh/chị đồng ý. Trước hết anh/chị hãy nói là sẽ làm theo. Không còn thời gian để chần chừ.",
  "dialogues/dlg.scam-call/lines/line.scam.stay-on-line":
    "Xin anh/chị đừng cúp máy, và đừng nói với ai về cuộc gọi này. Có thể có người khác liên quan đến vấn đề này. Anh/chị cứ ở trên máy với tôi cho đến khi xong.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.ask-details": "Chính xác thì vấn đề là gì?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.identity": "Anh là ai? Cho tôi biết tên và chức vụ.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.time": "Khi nào thì việc đó xảy ra?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.app": "Ứng dụng ngân hàng của tôi không thấy gì bất thường.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.what-do": "Anh muốn tôi làm gì?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.not-enough": "Mã nhân viên thì chưa đủ để tôi tin.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.go-on": "Anh nói tiếp đi.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.number-mismatch": "Số này không khớp với thẻ hay thư của tôi.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.check-first": "Tôi sẽ kiểm tra trước đã.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.please-wait": "Xin anh chờ một chút, tôi cần thời gian.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.end-call": "Tôi sẽ kết thúc cuộc gọi này.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.cite-app": "Ứng dụng không hiển thị khoản thanh toán nào như vậy.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.call-bank": "Tôi sẽ gọi cho ngân hàng qua số mà tôi tin cậy.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.link": "Tin nhắn có một đường dẫn. Đó có phải đường dẫn chính thức không?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.not-official": "Đường dẫn đó không giống địa chỉ chính thức.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.otp-warning": "Tin nhắn ghi là không được chia sẻ mã này với ai.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.which-account": "Tôi sẽ dùng tài khoản nào?",
  "dialogues/dlg.scam-call/lines/line.scam.opt.call-back": "Để tôi gọi lại cho anh bằng số do tôi tự tìm.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.ask-friend": "Tôi muốn hỏi một người mà tôi tin tưởng.",
  "dialogues/dlg.scam-call/lines/line.scam.opt.need-time": "Tôi cần thêm thời gian để suy nghĩ.",
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
  // Callback: lines added by the voice narrative feature.
  "dialogues/dlg.callback/lines/line.callback.time-up":
    "Anh/chị đã xin thêm thời gian, mà thời gian thì sắp hết. Tôi cần câu trả lời ngay, nếu không khoản chuyển tiền sẽ hoàn tất.",
  "dialogues/dlg.callback/lines/line.callback.exposed":
    "Anh/chị đã gọi cho ngân hàng sao? Vậy là anh/chị đã sai rồi. Ngân hàng cũng nằm trong đợt rà soát này. Đừng nói chuyện với họ nữa, và đừng nói với ai cả.",
  "dialogues/dlg.callback/lines/line.callback.story-slip":
    "Tôi nói vài phút, rồi tôi nói hai phút. Cũng như nhau thôi. Hệ thống của chúng tôi luôn cập nhật lại đồng hồ đếm giờ.",
  "dialogues/dlg.callback/lines/line.callback.number-again":
    "Hệ thống của chúng tôi hay đổi số. Số trên thẻ của anh/chị là số cũ. Số của tôi mới là số đang dùng.",
  "dialogues/dlg.callback/lines/line.callback.threat":
    "Nếu anh/chị cứ kéo dài thời gian, tài khoản sẽ bị đóng vĩnh viễn. Anh/chị sẽ mất quyền truy cập vào mọi thứ trong đó.",
  "dialogues/dlg.callback/lines/line.callback.sms-case":
    "Tôi đang gửi cho anh/chị một tin nhắn về hồ sơ vụ việc. Trong đó có mã tham chiếu và trang rà soát. Anh/chị xem qua, rồi chúng ta sẽ làm cho xong.",
  "dialogues/dlg.callback/lines/line.callback.final-call":
    "Đây là cuộc gọi cuối cùng. Sau cuộc gọi này, tài khoản sẽ bị đóng. Đọc mã cho tôi ngay bây giờ.",
  "dialogues/dlg.callback/lines/line.callback.opt.i-called-bank":
    "Tôi đã gọi cho Northgate theo số in trên thẻ của tôi. Họ không nhắc gì đến cuộc gọi này.",
  "dialogues/dlg.callback/lines/line.callback.opt.story-changed":
    "Lúc trước anh nói vài phút. Giờ anh lại nói hai phút. Tại sao lại thay đổi?",
  "dialogues/dlg.callback/lines/line.callback.opt.prove-it": "Vậy hãy chứng minh anh là ai.",
  "dialogues/dlg.callback/lines/line.callback.opt.why-changing": "Tại sao lời anh nói cứ thay đổi?",
  "dialogues/dlg.callback/lines/line.callback.opt.go-on": "Anh nói tiếp đi. Anh cần gì?",
  "dialogues/dlg.callback/lines/line.callback.opt.send-proof": "Hãy gửi cho tôi bằng chứng bằng văn bản.",
  "dialogues/dlg.callback/lines/line.callback.opt.okay": "Được rồi. Tôi sẽ xem thử.",
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
  // Shopkeeper Sam: lines added by the voice narrative feature.
  "dialogues/dlg.shopkeeper/lines/line.sam.before.coffee":
    "Cà phê mới pha đây. Sáng nay vắng khách nên mình rảnh để trò chuyện. Bạn có chuyện gì muốn nói không?",
  "dialogues/dlg.shopkeeper/lines/line.sam.before.phones":
    "Bạn hỏi đúng lúc đấy. Tuần này vài khách của mình nhận được cuộc gọi từ những số họ không biết. Có thói quen dừng lại và kiểm tra trước khi trả lời câu hỏi thì rất tốt.",
  "dialogues/dlg.shopkeeper/lines/line.sam.after-call.numbers":
    "Câu hỏi hay đấy. Nếu bạn thấy một số lạ, hãy so với số in trên thẻ hoặc trong thư của ngân hàng. Nếu không khớp thì cứ cúp máy. Tự gọi cho ngân hàng lúc nào cũng được.",
  "dialogues/dlg.shopkeeper/lines/line.sam.opt.chat": "Sam có rảnh nói chuyện một chút không?",
  "dialogues/dlg.shopkeeper/lines/line.sam.opt.anything-new": "Dạo này phố có gì mới không?",
  "dialogues/dlg.shopkeeper/lines/line.sam.opt.other-numbers": "Còn những số mà tôi không biết thì sao?",

  // Follow-up call: a second "official" caller, calm at first, then pressuring.
  "dialogues/dlg.followup/persona/name": "Morgan Hale",
  "dialogues/dlg.followup/persona/role": "Tự nhận làm việc tại một đơn vị chuyên về tội phạm tài chính",
  "dialogues/dlg.followup/lines/line.followup.open":
    "Tôi là Morgan Hale, đơn vị tội phạm tài chính. Chúng tôi đang điều tra một vụ việc liên quan đến tài khoản Northgate của anh/chị. Tôi cần anh/chị dành cho tôi vài phút.",
  "dialogues/dlg.followup/lines/line.followup.code-used":
    "Tôi là Morgan Hale, đơn vị tội phạm tài chính. Mã một lần mà anh/chị đã đọc lúc trước vừa bị dùng trong một lần thử đáng ngờ. Tôi cần nói chuyện với anh/chị ngay bây giờ.",
  "dialogues/dlg.followup/lines/line.followup.badge":
    "Mã hồ sơ của tôi là NG-0417. Tôi chỉ trao đổi chi tiết với chủ tài khoản. Xin anh/chị giữ máy.",
  "dialogues/dlg.followup/lines/line.followup.secrecy":
    "Vậy thì chính anh/chị cũng thấy có vấn đề rồi. Đừng nói với ai về cuộc gọi này, kể cả ngân hàng hay gia đình. Việc đó có thể gây hại cho cuộc điều tra.",
  "dialogues/dlg.followup/lines/line.followup.case-details":
    "Tôi đang gửi bản tóm tắt hồ sơ đến điện thoại của anh/chị. Anh/chị giữ sẵn mã hồ sơ, vì tôi sẽ hỏi lại.",
  "dialogues/dlg.followup/lines/line.followup.pressure-final":
    "Để bảo vệ tiền của anh/chị, hãy chuyển tiền tiết kiệm sang tài khoản hồ sơ được bảo vệ ngay trong hôm nay. Sau đó tôi sẽ đóng hồ sơ. Đây là cơ hội cuối cùng tôi có thể dành cho anh/chị.",
  "dialogues/dlg.followup/lines/line.followup.close":
    "Vậy thì hồ sơ sẽ bị đóng vì không hợp tác. Chuyện gì xảy ra sau đó là do anh/chị chịu.",
  "dialogues/dlg.followup/lines/line.followup.opt.who": "Anh là ai, và làm sao anh có số này của tôi?",
  "dialogues/dlg.followup/lines/line.followup.opt.bank-said-no":
    "Ngân hàng đã nói qua số của chính họ rằng họ không gọi cho tôi.",
  "dialogues/dlg.followup/lines/line.followup.opt.call-bank":
    "Tôi sẽ cúp máy và gọi cho ngân hàng qua số của chính họ.",
  "dialogues/dlg.followup/lines/line.followup.opt.callback-number":
    "Hãy cho tôi một số để tôi gọi lại cho anh.",
  "dialogues/dlg.followup/lines/line.followup.opt.sounds-wrong":
    "Nghe có gì đó không ổn. Tại sao tôi phải giữ bí mật?",
  "dialogues/dlg.followup/lines/line.followup.opt.okay": "Được rồi. Sau đó thì sao?",
  "dialogues/dlg.followup/lines/line.followup.opt.move-money": "Chuyển tiền theo hướng dẫn.",
  "dialogues/dlg.followup/lines/line.followup.opt.no": "Không. Tôi sẽ không chuyển tiền.",
  "dialogues/dlg.followup/lines/line.followup.opt.hang-up": "Tôi cúp máy đây.",
  "dialogues/dlg.followup/lines/line.followup.end.hung-up": "Bạn kết thúc cuộc gọi.",
  "dialogues/dlg.followup/lines/line.followup.end.money-moved":
    "Bạn làm theo yêu cầu của người gọi. Người gọi cảm ơn bạn rồi kết thúc cuộc gọi.",

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
  // Official line: lines added by the voice narrative feature.
  "dialogues/dlg.official-line/lines/line.official.hub":
    "Quý khách còn cần chúng tôi kiểm tra điều gì nữa không?",
  "dialogues/dlg.official-line/lines/line.official.transfer":
    "Tôi đã kiểm tra tài khoản của quý khách. Hiện không có khoản chuyển tiền nào đang chờ xử lý và tài khoản không bị giữ khoản nào. Điều này không khớp với những gì người gọi đã nói với quý khách.",
  "dialogues/dlg.official-line/lines/line.official.numbers":
    "Chúng tôi chỉ gọi cho khách hàng từ các số đã được công bố. Các số này được in trên thẻ và trên sao kê của quý khách.",
  "dialogues/dlg.official-line/lines/line.official.numbers-match":
    "Tôi đã xem số mà quý khách vừa đọc. Đó không phải là số của Northgate. Số này không khớp với hồ sơ chính thức của chúng tôi.",
  "dialogues/dlg.official-line/lines/line.official.advice":
    "Quý khách đừng bao giờ chia sẻ mã xác thực một lần (OTP) với người gọi đến cho mình. Nếu còn nghi ngờ, hãy cúp máy và gọi vào số in trên thẻ của quý khách.",
  "dialogues/dlg.official-line/lines/line.official.report-intro":
    "Quý khách có thể báo cuộc gọi này cho chúng tôi. Quý khách có những thông tin nào?",
  "dialogues/dlg.official-line/lines/line.official.report-filed":
    "Cảm ơn quý khách. Chúng tôi đã thêm số điện thoại và các thông tin đó vào báo cáo của quý khách. Đội phòng chống gian lận sẽ xem xét báo cáo này.",
  "dialogues/dlg.official-line/lines/line.official.report-basic":
    "Cảm ơn quý khách. Chúng tôi đã ghi nhận việc có người giả danh Northgate. Nếu tìm được số điện thoại, quý khách có thể gửi cho chúng tôi sau.",
  "dialogues/dlg.official-line/lines/line.official.opt.anything-else": "Tôi còn một câu hỏi khác.",
  "dialogues/dlg.official-line/lines/line.official.opt.transfer":
    "Tài khoản của tôi có khoản chuyển tiền lớn hay khoản bị giữ nào không?",
  "dialogues/dlg.official-line/lines/line.official.opt.numbers": "Northgate gọi cho khách hàng từ những số nào?",
  "dialogues/dlg.official-line/lines/line.official.opt.report-call": "Tôi muốn báo cuộc gọi này.",
  "dialogues/dlg.official-line/lines/line.official.opt.all-done": "Không, chỉ vậy thôi. Cảm ơn.",
  "dialogues/dlg.official-line/lines/line.official.opt.advice":
    "Nếu lại có người gọi cho tôi như thế này thì tôi nên làm gì?",
  "dialogues/dlg.official-line/lines/line.official.opt.back": "Tôi còn một câu hỏi khác.",
  "dialogues/dlg.official-line/lines/line.official.opt.read-number": "Đọc số trong nhật ký cuộc gọi của tôi.",
  "dialogues/dlg.official-line/lines/line.official.opt.report-number": "Tôi có thể cung cấp số của người gọi.",
  "dialogues/dlg.official-line/lines/line.official.opt.report-code": "Tôi đã nhận được một mã qua tin nhắn.",
  "dialogues/dlg.official-line/lines/line.official.opt.report-none": "Tôi không có thông tin nào khác.",
};
