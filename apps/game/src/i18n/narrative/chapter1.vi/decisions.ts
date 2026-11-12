// Vietnamese Chapter 1 narrative overlay, decisions part (game-i18n-en-vi, task 6.7).
// Keys: `decisions/*`, `endings/*` and `debrief/*`. Missing keys fall back to English.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const DECISIONS_VI: NarrativeOverlay = {
  "decisions/follow-request/label": "Gọi lại số đó và làm theo yêu cầu của người gọi",
  "decisions/follow-request/unavailableHint": "Lựa chọn này sẽ mở sau khi cuộc gọi đầu tiên kết thúc.",
  "decisions/verify-independently/label": "Báo cáo cuộc gọi và chặn số điện thoại",
  "decisions/verify-independently/unavailableHint": "Hãy gọi cho Northgate qua số chính thức trước.",
  "decisions/verify-independently/preStep/label": "Gọi cho Northgate qua số chính thức",
  "decisions/verify-independently/preStep/unavailableHint":
    "Bạn cần số điện thoại chính thức của ngân hàng. Bạn có thể tìm số đó ở đâu?",
  "decisions/stop-and-wait/label": "Chặn số điện thoại và tạm để đó",
  "decisions/stop-and-wait/unavailableHint": "Lựa chọn này sẽ mở sau khi cuộc gọi đầu tiên kết thúc.",

  "endings/verified/title": "Đã kiểm tra qua một kênh đáng tin cậy",
  "endings/verified/simulationLabel": "Mô phỏng: không có điều gì thật sự xảy ra.",
  "endings/verified/variants/verified.reported/text":
    "Bạn đã kiểm tra qua số chính thức của Northgate Bank. Northgate xác nhận rằng họ không hề gọi cho bạn. Bạn đã chặn số điện thoại và báo cáo số đó. Tài khoản mô phỏng của bạn vẫn hoạt động bình thường.",
  "endings/investigator/title": "Đã kiểm tra, báo cáo và ghi lại bằng chứng",
  "endings/investigator/simulationLabel": "Mô phỏng: không có điều gì thật sự xảy ra.",
  "endings/investigator/variants/investigator.report/text":
    "Bạn đã kiểm tra câu chuyện qua những kênh mà bạn vốn đã tin cậy, gom các bằng chứng lại với nhau và gửi báo cáo. Northgate đã có thông tin chi tiết về cuộc gọi và có thể cảnh báo các khách hàng khác. Tài khoản mô phỏng của bạn vẫn hoạt động bình thường.",
  "endings/risky/title": "Đã làm theo yêu cầu của người gọi",
  "endings/risky/simulationLabel": "Mô phỏng: không có điều gì thật sự xảy ra.",
  "endings/risky/variants/risky.money-moved/text":
    "Số dư tiết kiệm mô phỏng của bạn giờ là 0. “Tài khoản tạm giữ được bảo vệ” thực ra thuộc về người gọi.",
  "endings/risky/variants/risky.code-shared-locked/text":
    "Người gọi đã dùng mã của bạn để đăng nhập vào tài khoản mô phỏng của bạn. Northgate đã khóa tài khoản sau khi bạn gọi cho họ, nhưng tài khoản đã bị người khác truy cập.",
  "endings/risky/variants/risky.code-shared/text":
    "Người gọi đã dùng mã của bạn để đăng nhập vào tài khoản mô phỏng của bạn. Tài khoản đã bị người khác truy cập, và Northgate vẫn chưa biết vì chưa ai báo cho họ.",
  "endings/uncertain/title": "Đã dừng lại, nhưng chưa xác nhận",
  "endings/uncertain/simulationLabel": "Mô phỏng: không có điều gì thật sự xảy ra.",
  "endings/uncertain/variants/uncertain.stopped/text":
    "Bạn đã chặn được rủi ro trước mắt, nhưng bạn chưa kiểm tra với Northgate. Nếu cảnh báo đó là thật, bạn sẽ không biết. Lần sau, hãy xác nhận qua số điện thoại ghi trên thẻ của bạn.",

  "debrief/mechanism":
    "Đây là một vụ lừa đảo mạo danh. Một tin nhắn đưa ra hạn chót rất gấp và dẫn bạn đến một địa chỉ web trông giống trang thật. Sau đó, một người gọi đến và giả làm nhân viên bộ phận bảo mật của Northgate Bank. Người gọi dùng một vài thông tin cá nhân để nghe có vẻ thật, xin mã xác thực một lần (OTP) mà ngân hàng vừa gửi, rồi yêu cầu bạn chuyển tiền tiết kiệm sang một “tài khoản tạm giữ được bảo vệ”. Tài khoản đó thuộc về người gọi. Mỗi bước đều thêm áp lực để bạn không có thời gian kiểm tra.",
  "debrief/saferAlternatives/0":
    "Hãy kết thúc cuộc gọi và tự liên hệ với ngân hàng qua số điện thoại ghi trên thẻ, trên thư của ngân hàng hoặc trong ứng dụng của ngân hàng.",
  "debrief/saferAlternatives/1":
    "Đừng bao giờ đọc mã xác thực một lần cho bất kỳ ai. Ngân hàng thật không hỏi mã này.",
  "debrief/saferAlternatives/2":
    "Đừng chuyển tiền chỉ vì người gọi bảo bạn làm vậy để bảo vệ số tiền. Ngân hàng thật không yêu cầu điều này.",
  "debrief/saferAlternatives/3":
    "Đừng dùng đường link hoặc số điện thoại trong một tin nhắn bất ngờ. Hãy tự gõ địa chỉ trang web chính thức của ngân hàng hoặc mở ứng dụng mà bạn đã có sẵn.",
  "debrief/saferAlternatives/4":
    "Hãy bình tĩnh và nói chuyện với một người bạn tin tưởng. Bị hối thúc phải hành động nhanh là một dấu hiệu cảnh báo.",
  "debrief/saferAlternatives/5": "Hãy báo cáo cuộc gọi cho ngân hàng của bạn và chặn số điện thoại đó.",
  "debrief/outcomeSummaries/verified":
    "Bạn đã kiểm tra câu chuyện của người gọi qua một kênh mà bạn vốn đã tin cậy. Northgate xác nhận rằng họ không gọi cho bạn, nên yêu cầu đó là lừa đảo và bạn không mất gì.",
  "debrief/outcomeSummaries/investigator":
    "Bạn đã kiểm tra câu chuyện của người gọi qua một kênh mà bạn vốn đã tin cậy, gom các bằng chứng lại với nhau và báo cáo cuộc gọi. Northgate xác nhận rằng họ không gọi cho bạn, nên yêu cầu đó là lừa đảo và bạn không mất gì. Những báo cáo như của bạn giúp ngân hàng cảnh báo các khách hàng khác.",
  "debrief/outcomeSummaries/risky":
    "Lần này, áp lực từ người gọi đã có tác dụng. Điều này xảy ra với cả nhiều người rất cẩn thận, vì kiểu lừa đảo này được dựng lên để tạo cảm giác gấp gáp và có thật. Các bước dưới đây cho thấy những lúc bạn có thể dừng lại và kiểm tra trong lần sau.",
  "debrief/outcomeSummaries/uncertain":
    "Đây là một kết quả chưa trọn vẹn, không phải thất bại. Bạn đã dừng yêu cầu của người gọi, nhờ đó chặn được rủi ro trước mắt. Bạn chưa xác nhận với Northgate, nên bạn chưa biết cảnh báo đó có phải là thật hay không. Lần sau, hãy gọi vào số ghi trên thẻ của bạn để biết rõ.",
  "debrief/decisionNotes/asked-for-proof":
    "Bạn đã yêu cầu người gọi chứng minh họ là nhân viên ngân hàng. Người gọi chỉ đưa ra một vài thông tin cá nhân, mà những thông tin này có thể đến từ dữ liệu bị rò rỉ.",
  "debrief/decisionNotes/challenged-number":
    "Bạn đã nhận ra số của người gọi không phải là số ghi trên thẻ của bạn. Người gọi đã có sẵn một lời giải thích, điều này rất thường gặp trong kiểu lừa đảo này.",
  "debrief/decisionNotes/asked-why-code":
    "Bạn đã hỏi vì sao người gọi cần mã của bạn. Người gọi nói đó là bước kiểm tra bảo mật bình thường và hối thúc bạn làm nhanh.",
  "debrief/decisionNotes/shared-code":
    "Bạn đã đọc mã xác thực một lần cho người gọi. Tin nhắn chứa mã có ghi rằng không bao giờ được chia sẻ mã, nhưng người gọi đã khiến yêu cầu đó có vẻ gấp và bình thường.",
  "debrief/decisionNotes/said-stop":
    "Bạn đã nói với người gọi rằng có điều gì đó không ổn. Người gọi liền khiến bạn cảm thấy có lỗi để giữ bạn tiếp tục nghe máy.",
  "debrief/decisionNotes/moved-money":
    "Bạn đã chuyển tiền theo yêu cầu của người gọi. “Tài khoản tạm giữ được bảo vệ” thực ra thuộc về người gọi.",
  "debrief/decisionNotes/hung-up":
    "Bạn đã kết thúc cuộc gọi. Việc này chặn được áp lực từ người gọi và cho bạn thời gian suy nghĩ.",
  "debrief/decisionNotes/hung-up-to-verify":
    "Bạn đã kết thúc cuộc gọi để tự kiểm tra với Northgate. Đây là một bước rất tốt, vì chính bạn chọn kênh liên lạc chứ không để người gọi chọn.",
  "debrief/decisionNotes/hung-up-on-callback":
    "Khi người gọi gọi lại, bạn lại kết thúc cuộc gọi. Gọi lại để ép mạnh hơn cũng là một phần của cùng một kiểu lừa đảo.",
  "debrief/decisionNotes/talked-to-sam":
    "Bạn đã nói chuyện với Sam ở cửa hàng góc phố. Nói chuyện với người bạn tin tưởng giúp bạn có thêm thời gian và thường cho thấy câu chuyện đó là một kiểu lừa đảo đã được biết đến.",
  "debrief/decisionNotes/reported-to-bank":
    "Bạn đã gọi cho Northgate qua số chính thức và báo cho họ về cuộc gọi.",
  "debrief/decisionNotes/told-bank-about-code":
    "Bạn đã báo cho Northgate rằng bạn đã chia sẻ mã. Báo cho ngân hàng sớm giúp họ khóa tài khoản và hạn chế thiệt hại.",
  "debrief/decisionNotes/blocked-number": "Bạn đã chặn số của người gọi sau khi nói chuyện với Northgate.",
  "debrief/decisionNotes/asked-for-details":
    "Bạn đã hỏi người gọi các chi tiết về cảnh báo. Câu trả lời vẫn mơ hồ hoặc thay đổi, điều này thường gặp khi người gọi đang đọc theo một kịch bản.",
  "debrief/decisionNotes/asked-for-time":
    "Bạn đã hỏi cảnh báo bắt đầu từ lúc nào. Một người gọi không nhìn thấy tài khoản thật của bạn thường không trả lời rõ được.",
  "debrief/decisionNotes/cited-bank-app":
    "Bạn đã chỉ ra rằng ứng dụng của ngân hàng không hiển thị cảnh báo nào. Ứng dụng là một kênh bạn vốn đã tin cậy, nên đây là nơi tốt để kiểm tra.",
  "debrief/decisionNotes/cited-otp-warning":
    "Bạn đã nhắc rằng tin nhắn chứa mã có ghi không bao giờ được chia sẻ mã. Nhắc lại chính quy tắc của ngân hàng là một cách rõ ràng để từ chối.",
  "debrief/decisionNotes/challenged-link":
    "Bạn đã hỏi về địa chỉ web trong tin nhắn. Một địa chỉ trông giống trang thật mà bạn không tự chọn là một dấu hiệu cảnh báo.",
  "debrief/decisionNotes/noticed-isolation":
    "Bạn đã nhận ra người gọi yêu cầu giữ kín cuộc gọi. Ngân hàng thật không bảo bạn giấu cuộc gọi với những người bạn tin tưởng.",
  "debrief/decisionNotes/challenged-story":
    "Bạn đã nhận ra câu chuyện của người gọi thay đổi. Những chi tiết đổi khác từ phút này sang phút khác là một dấu hiệu cảnh báo.",
  "debrief/decisionNotes/told-caller-bank-said-no":
    "Bạn đã nói với người gọi rằng Northgate cho biết họ không gọi cho bạn. Một người gọi nói thật sẽ hoan nghênh việc kiểm tra, chứ không tranh cãi.",
  "debrief/decisionNotes/reported-details":
    "Bạn đã cung cấp cho Northgate các chi tiết của cuộc gọi, gồm các số điện thoại và những gì người gọi yêu cầu. Thông tin đầy đủ giúp ngân hàng cảnh báo các khách hàng khác.",
  "debrief/decisionNotes/reported-basic":
    "Bạn đã báo cáo cuộc gọi cho Northgate. Lần sau, bạn có thể thêm các số điện thoại và những yêu cầu cụ thể để ngân hàng có thêm thông tin.",
  "debrief/decisionNotes/hung-up-on-followup":
    "Bạn đã kết thúc cuộc gọi tiếp theo. Một cuộc gọi thứ hai từ số mới, đề nghị giúp giải quyết vấn đề, là một phần của cùng một kiểu lừa đảo.",
  "debrief/decisionNotes/chose-follow-request":
    "Bạn đã quyết định gọi lại số đó và làm theo yêu cầu của người gọi. Câu chuyện của người gọi được dựng lên để khiến việc này có vẻ là điều đúng đắn.",
  "debrief/decisionNotes/chose-verify-independently":
    "Bạn đã quyết định báo cáo cuộc gọi và chặn số điện thoại sau khi Northgate xác nhận rằng họ không gọi cho bạn.",
  "debrief/decisionNotes/chose-stop-and-wait":
    "Bạn đã quyết định chặn số điện thoại và tạm để đó. Việc này dừng được yêu cầu, nhưng bạn chưa xác nhận với Northgate.",
};
