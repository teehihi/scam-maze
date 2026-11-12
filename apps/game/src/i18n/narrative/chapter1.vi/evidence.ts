// Vietnamese Chapter 1 narrative overlay, evidence part (game-i18n-en-vi, task 6.3).
// Keys: `evidence/<id>/<field>` and `evidence/<id>/relations/<claimId>/note`.
// Missing keys fall back to English.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const EVIDENCE_VI: NarrativeOverlay = {
  // ev.sms-alert
  "evidence/ev.sms-alert/title": "Tin nhắn khẩn cấp",
  "evidence/ev.sms-alert/description":
    "Một tin nhắn báo rằng tài khoản Northgate Bank của bạn đã bị tạm khóa và yêu cầu bạn xác minh danh tính trong vòng 15 phút tại northgate-secure-verify.invalid.",
  "evidence/ev.sms-alert/location": "Điện thoại · Tin nhắn",
  "evidence/ev.sms-alert/relations/claim.account-suspended/note":
    "Tin nhắn nói tài khoản đã bị tạm khóa, nhưng chỉ một tin nhắn thì không chứng minh được điều đó là thật.",
  "evidence/ev.sms-alert/relevance":
    "Tin nhắn lừa đảo thường đặt ra thời hạn rất ngắn và kèm một đường link trông giống trang web của ngân hàng.",
  "evidence/ev.sms-alert/debriefHint":
    "Tin nhắn khẩn cấp đặt thời hạn 15 phút và dùng một địa chỉ web không phải là trang web chính thức của ngân hàng.",

  // ev.otp-sms
  "evidence/ev.otp-sms/title": "Tin nhắn mã xác thực một lần",
  "evidence/ev.otp-sms/description":
    "Một tin nhắn từ Northgate Bank chứa mã xác thực một lần. Tin nhắn ghi: \"Tuyệt đối không chia sẻ mã này với bất kỳ ai, kể cả nhân viên ngân hàng.\"",
  "evidence/ev.otp-sms/location": "Điện thoại · Tin nhắn",
  "evidence/ev.otp-sms/relations/claim.code-needed/note":
    "Chính tin nhắn của ngân hàng dặn không bao giờ chia sẻ mã, kể cả với nhân viên ngân hàng.",
  "evidence/ev.otp-sms/relevance":
    "Mã xác thực một lần chỉ dành riêng cho bạn. Khi có người hỏi mã này, có thể họ đang tìm cách đăng nhập dưới tên bạn.",
  "evidence/ev.otp-sms/debriefHint":
    "Tin nhắn mã xác thực một lần đã dặn không bao giờ chia sẻ mã với bất kỳ ai, kể cả nhân viên ngân hàng.",

  // ev.caller-number
  "evidence/ev.caller-number/title": "Số điện thoại người gọi",
  "evidence/ev.caller-number/description":
    "Lịch sử cuộc gọi cho thấy \"Northgate Bank Security\" đã gọi từ số +000 555 0142.",
  "evidence/ev.caller-number/location": "Điện thoại · Cuộc gọi",
  "evidence/ev.caller-number/relations/claim.caller-identity/note":
    "Tên hiện trên màn hình là do người gọi đặt. Hãy so số này với một số bạn đã tin cậy từ trước.",
  "evidence/ev.caller-number/relevance":
    "Tên và số hiện khi có cuộc gọi đến có thể bị giả mạo. Hãy đối chiếu với số in trên thẻ hoặc trong thư của ngân hàng.",
  "evidence/ev.caller-number/debriefHint":
    "Lịch sử cuộc gọi đã cho thấy số mà người gọi dùng: +000 555 0142.",

  // ev.bank-card
  "evidence/ev.bank-card/title": "Số điện thoại trên thẻ ngân hàng",
  "evidence/ev.bank-card/description":
    "Mặt sau thẻ Northgate Bank của bạn in số điện thoại chính thức +000 555 0100.",
  "evidence/ev.bank-card/location": "Bàn quán cà phê · ví",
  "evidence/ev.bank-card/relations/claim.caller-identity/note":
    "Đây là số chính thức của ngân hàng. Hãy dùng số này để kiểm tra ai thật sự đã gọi cho bạn.",
  "evidence/ev.bank-card/relevance":
    "Số trên thẻ là số bạn có thể tin cậy, vì bạn không nhận nó từ người gọi.",
  "evidence/ev.bank-card/debriefHint":
    "Chiếc ví trên bàn quán cà phê có thẻ ngân hàng của bạn, in số chính thức +000 555 0100.",

  // ev.bank-letter
  "evidence/ev.bank-letter/title": "Thư từ Northgate Bank",
  "evidence/ev.bank-letter/description":
    "Một lá thư sao kê hằng năm ghi số hỗ trợ +000 555 0100 và trang web northgate.example. Thư không nhắc đến vấn đề nào với tài khoản của bạn.",
  "evidence/ev.bank-letter/location": "Hộp thư",
  "evidence/ev.bank-letter/relations/claim.caller-identity/note":
    "Lá thư ghi số chính thức của ngân hàng. Hãy dùng số này để kiểm tra ai thật sự đã gọi cho bạn.",
  "evidence/ev.bank-letter/relations/claim.account-suspended/note":
    "Lá thư không nhắc đến việc tạm khóa, nhưng thư được gửi trước tin nhắn, nên hãy hỏi lại ngân hàng.",
  "evidence/ev.bank-letter/relevance":
    "Thư bạn đã có sẵn cho biết thông tin liên hệ thật của ngân hàng. Hãy so sánh với thông tin trong tin nhắn hoặc cuộc gọi.",
  "evidence/ev.bank-letter/debriefHint":
    "Lá thư trong hộp thư ghi số chính thức và trang web chính thức northgate.example.",

  // ev.bank-app
  "evidence/ev.bank-app/title": "Ứng dụng Northgate Bank",
  "evidence/ev.bank-app/description":
    "Ứng dụng Northgate Bank trên điện thoại cho thấy tài khoản của bạn vẫn đang hoạt động, không có cảnh báo và không có giao dịch chuyển tiền nào đang chờ.",
  "evidence/ev.bank-app/location": "Điện thoại · Northgate Bank",
  "evidence/ev.bank-app/relations/claim.account-suspended/note":
    "Ứng dụng do chính bạn cài đặt không hiển thị việc tạm khóa nào.",
  "evidence/ev.bank-app/relevance":
    "Tự mở ứng dụng ngân hàng, không bấm vào link trong tin nhắn, là một cách để kiểm tra một cảnh báo.",
  "evidence/ev.bank-app/debriefHint":
    "Ứng dụng Northgate Bank trên điện thoại đã cho thấy tài khoản của bạn vẫn hoạt động và không có cảnh báo.",

  // ev.shop-poster
  "evidence/ev.shop-poster/title": "Thông báo của Northgate trên cửa kính cửa hàng",
  "evidence/ev.shop-poster/description":
    "Thông báo của Northgate Bank ghi rằng ngân hàng sẽ không bao giờ hỏi mã xác thực một lần của bạn và không bao giờ yêu cầu bạn chuyển tiền sang tài khoản khác để bảo vệ số tiền đó.",
  "evidence/ev.shop-poster/location": "Cửa kính cửa hàng ở góc phố",
  "evidence/ev.shop-poster/relations/claim.code-needed/note":
    "Ngân hàng cho biết họ không bao giờ hỏi mã xác thực một lần.",
  "evidence/ev.shop-poster/relations/claim.protected-account/note":
    "Ngân hàng cho biết họ không bao giờ yêu cầu bạn chuyển tiền để bảo vệ số tiền đó.",
  "evidence/ev.shop-poster/relevance":
    "Ngân hàng công bố những việc họ sẽ không bao giờ yêu cầu bạn làm. Một yêu cầu đi ngược lại điều này là dấu hiệu cảnh báo rõ ràng.",
  "evidence/ev.shop-poster/debriefHint":
    "Thông báo trên cửa kính cửa hàng ghi rằng Northgate không bao giờ hỏi mã hay yêu cầu bạn chuyển tiền.",

  // ev.community-alert
  "evidence/ev.community-alert/title": "Cảnh báo của khu phố",
  "evidence/ev.community-alert/description":
    "Một cảnh báo trên bảng tin cho biết nhiều người hàng xóm đã nhận cuộc gọi từ những người tự xưng là nhân viên ngân hàng, yêu cầu họ chuyển tiền tiết kiệm sang một \"tài khoản được bảo vệ\".",
  "evidence/ev.community-alert/location": "Bảng tin",
  "evidence/ev.community-alert/relations/claim.protected-account/note":
    "Hàng xóm đã nhận cùng một yêu cầu từ những người gọi không phải là nhân viên ngân hàng.",
  "evidence/ev.community-alert/relevance":
    "Cùng một câu chuyện thường đến với nhiều người. Nghe người khác kể giúp bạn nhận ra kiểu lừa này.",
  "evidence/ev.community-alert/debriefHint":
    "Bảng tin khu phố mô tả những cuộc gọi yêu cầu hàng xóm chuyển tiền tiết kiệm sang một \"tài khoản được bảo vệ\".",

  // ev.partial-info
  "evidence/ev.partial-info/title": "Những gì người gọi biết",
  "evidence/ev.partial-info/description":
    "Người gọi biết tên bạn và bốn số cuối của số tài khoản.",
  "evidence/ev.partial-info/location": "Cuộc gọi lừa đảo",
  "evidence/ev.partial-info/relations/claim.caller-identity/note":
    "Những thông tin này có thể đến từ dữ liệu bị rò rỉ, nên chúng không cho biết người gọi là ai.",
  "evidence/ev.partial-info/relevance":
    "Biết một vài thông tin cá nhân khiến người gọi nghe có vẻ thật, nhưng điều đó không chứng minh họ làm việc cho ngân hàng của bạn.",
  "evidence/ev.partial-info/debriefHint":
    "Nếu hỏi người gọi làm sao bạn biết họ là nhân viên ngân hàng, bạn sẽ thấy họ chỉ biết vài thông tin nhỏ.",

  // ev.sam-testimony
  "evidence/ev.sam-testimony/title": "Câu chuyện của Sam",
  "evidence/ev.sam-testimony/description":
    "Sam kể rằng có lần một người gọi nói với bạn của Sam rằng tài khoản đang gặp nguy hiểm, hỏi mã rồi yêu cầu chuyển tiền. Sam khuyên hãy gọi vào số trên thẻ của bạn, không gọi lại số vừa gọi cho bạn.",
  "evidence/ev.sam-testimony/location": "Cửa hàng ở góc phố",
  "evidence/ev.sam-testimony/relations/claim.caller-identity/note":
    "Câu chuyện của Sam giống cuộc gọi này, nhưng nó không cho biết ai đã gọi cho bạn.",
  "evidence/ev.sam-testimony/relevance":
    "Nói chuyện với người bạn tin tưởng giúp bạn có thời gian suy nghĩ, và thường cho thấy câu chuyện này là một kiểu lừa quen thuộc.",
  "evidence/ev.sam-testimony/debriefHint":
    "Sam ở cửa hàng góc phố đã từng nghe về kiểu cuộc gọi tương tự.",

  // ev.official-confirmation
  "evidence/ev.official-confirmation/title": "Đường dây chính thức của Northgate",
  "evidence/ev.official-confirmation/description":
    "Bạn đã gọi cho Northgate theo số +000 555 0100. Ngân hàng không có ghi nhận nào về cuộc gọi cho bạn hôm nay, tài khoản của bạn vẫn hoạt động, và họ không bao giờ hỏi mã xác thực một lần hay yêu cầu bạn chuyển tiền.",
  "evidence/ev.official-confirmation/location": "Điện thoại · cuộc gọi chính thức",
  "evidence/ev.official-confirmation/relations/claim.caller-identity/note":
    "Khi bạn liên hệ qua số chính thức, ngân hàng cho biết không có ghi nhận nào về việc đã gọi cho bạn.",
  "evidence/ev.official-confirmation/relations/claim.account-suspended/note":
    "Ngân hàng cho biết tài khoản của bạn vẫn đang hoạt động.",
  "evidence/ev.official-confirmation/relations/claim.code-needed/note":
    "Ngân hàng cho biết họ không bao giờ hỏi mã xác thực một lần.",
  "evidence/ev.official-confirmation/relevance":
    "Tự gọi cho ngân hàng theo số bạn đã tin cậy từ trước là cách đáng tin nhất để kiểm tra một cuộc gọi hoặc tin nhắn.",
  "evidence/ev.official-confirmation/debriefHint":
    "Nếu gọi cho Northgate theo số trên thẻ hoặc trong thư, bạn sẽ biết chắc rằng ngân hàng không hề gọi cho bạn.",

  // ev.transfer-check
  "evidence/ev.transfer-check/title": "Không có giao dịch chuyển tiền nào đang chờ",
  "evidence/ev.transfer-check/description":
    "Bạn đã hỏi đường dây chính thức về khoản chuyển tiền lớn mà người gọi nhắc đến. Northgate cho biết không có giao dịch nào đang chờ và không có khoản nào bị giữ trong tài khoản của bạn. Điều này không khớp với câu chuyện của người gọi.",
  "evidence/ev.transfer-check/location": "Điện thoại · cuộc gọi chính thức",
  "evidence/ev.transfer-check/relations/claim.account-suspended/note":
    "Ghi nhận của chính ngân hàng cho thấy không có giao dịch và không có khoản bị giữ, điều này không khớp với lời người gọi nói.",
  "evidence/ev.transfer-check/relevance":
    "Hỏi thêm một câu trên kênh bạn tin cậy có thể cho thấy chi tiết của người gọi có khớp với ghi nhận chính thức hay không.",
  "evidence/ev.transfer-check/debriefHint":
    "Khi hỏi Northgate về khoản chuyển tiền, bạn biết rằng ngân hàng không có ghi nhận nào về nó, nên câu chuyện của người gọi không khớp.",

  // ev.second-number
  "evidence/ev.second-number/title": "Số thứ ba mang tên \"Northgate\"",
  "evidence/ev.second-number/description":
    "Lịch sử cuộc gọi cho thấy \"Northgate Case Desk\" gọi từ số +000 555 0177. Đây là một số khác với người gọi đầu tiên (+000 555 0142) và với số chính thức (+000 555 0100).",
  "evidence/ev.second-number/location": "Điện thoại · Cuộc gọi",
  "evidence/ev.second-number/relations/claim.caller-identity/note":
    "Số này không trùng với số chính thức trên thẻ hoặc trong thư của bạn.",
  "evidence/ev.second-number/relevance":
    "Khi một số mới dùng tên ngân hàng, hãy so nó với một số bạn đã tin cậy từ trước. Bạn không cần nghe máy để làm việc này.",
  "evidence/ev.second-number/debriefHint":
    "Cuộc gọi tiếp theo đến từ +000 555 0177, một số thứ ba không trùng với số chính thức +000 555 0100.",

  // ev.case-sms
  "evidence/ev.case-sms/title": "Tin nhắn hồ sơ có địa chỉ giống thật",
  "evidence/ev.case-sms/description":
    "Một tin nhắn từ \"Northgate Bank\" nêu mã hồ sơ và yêu cầu bạn xem lại hồ sơ tại northgate-case-review.invalid. Địa chỉ này không trùng với trang web chính thức northgate.example.",
  "evidence/ev.case-sms/location": "Điện thoại · Tin nhắn",
  "evidence/ev.case-sms/relations/claim.caller-identity/note":
    "Đường link không trùng với trang web chính thức của ngân hàng.",
  "evidence/ev.case-sms/relevance":
    "Mã hồ sơ khiến tin nhắn trông có vẻ chính thức, nhưng địa chỉ web vẫn phải trùng với trang web thật của ngân hàng. Đừng mở link do người gọi gửi.",
  "evidence/ev.case-sms/debriefHint":
    "Tin nhắn hồ sơ dẫn đến northgate-case-review.invalid, địa chỉ không trùng với trang web chính thức northgate.example.",

  // ev.shifting-story
  "evidence/ev.shifting-story/title": "Thời hạn đã thay đổi",
  "evidence/ev.shifting-story/description":
    "Trong cuộc gọi đầu, người gọi nói bạn chỉ có vài phút. Khi gọi lại, người gọi kể về thời hạn theo cách khác. Hai lời kể này không khớp nhau.",
  "evidence/ev.shifting-story/location": "Cuộc gọi lại",
  "evidence/ev.shifting-story/relations/claim.caller-identity/note":
    "Một vấn đề thật với tài khoản chỉ có một ghi nhận rõ ràng. Câu chuyện thay đổi giữa các cuộc gọi là một dấu hiệu cảnh báo.",
  "evidence/ev.shifting-story/relevance":
    "Hãy nhớ những gì người gọi đã nói trước đó. Khi chi tiết thay đổi, hãy hỏi về điểm khác biệt hoặc kết thúc cuộc gọi và tự kiểm tra.",
  "evidence/ev.shifting-story/debriefHint":
    "Việc nhắc lại câu \"vài phút\" lúc trước cho thấy câu chuyện về thời hạn của người gọi đã thay đổi.",
};
