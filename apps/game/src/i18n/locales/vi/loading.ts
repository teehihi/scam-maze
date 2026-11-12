import type en from "../en/loading";
import type { LocaleShape } from "../../types";

const loading: LocaleShape<typeof en> = {
  stage: {
    starting: "Đang chuẩn bị",
    "restoring-save": "Đang đọc trò chơi đã lưu",
    "checking-device": "Đang kiểm tra thiết bị của bạn",
    "loading-assets": "Đang tải các tệp của chương",
    "initializing-state": "Đang thiết lập chương",
    "validating-save": "Đang kiểm tra tiến trình đã lưu",
    ready: "Sẵn sàng",
    error: "Tải không thành công",
  },
  menuStartup: {
    eyebrow: "Menu chính",
    title: "Con phố của bạn",
    subtitle: "Khu phố đang thức dậy.",
    startingEngine: "Đang khởi động công cụ 3D",
    loadingFiles: "Đang tải cảnh con phố",
    preparingScene: "Đang chuẩn bị cảnh con phố",
    ready: "Sẵn sàng",
  },
  newGameEyebrow: "Câu chuyện mới",
  newGameTitle: "Trở lại con phố của bạn",
  newGameSubtitle: "Khu phố đang thức dậy.",
  continueEyebrow: "Trò chơi đã lưu",
  continueTitle: "Tiếp tục",
  continueSubtitle: "Tiếp tục từ chỗ bạn đã dừng lại.",
  continueToMenu: "Tiếp tục vào menu",
  tipLabel: "Mẹo cảnh giác",
  nextTip: "Mẹo tiếp theo",
  progressLabel: "Tiến trình tải",
  slowNotice: "Việc tải đang lâu hơn bình thường. Bạn có thể tiếp tục chờ hoặc tải lại trang.",
  fileCount_other: "{{completed}} / {{total}} tệp",
  errors: {
    "invalid-chapter": {
      title: "Không tìm thấy chương",
      message: "Chương này không tồn tại hoặc chưa có. Hãy về menu chính để chọn lại.",
    },
    "asset-missing": {
      title: "Thiếu tệp trò chơi",
      message:
        "Máy chủ không có một tệp mà chương này cần. Hãy thử lại. Nếu lỗi này cứ lặp lại, có thể trò chơi đang được cập nhật.",
    },
    "asset-invalid": {
      title: "Không đọc được tệp trò chơi",
      message: "Một tệp mà chương này cần bị hỏng hoặc sai định dạng. Hãy thử lại.",
    },
    network: {
      title: "Lỗi kết nối",
      message: "Không tải được các tệp trò chơi. Hãy kiểm tra kết nối Internet rồi thử lại.",
    },
    stalled: {
      title: "Quá trình tải đã dừng",
      message: "Quá trình tải xuống không còn phản hồi. Hãy kiểm tra kết nối Internet rồi thử lại.",
    },
    "unsupported-device": {
      title: "Trình duyệt này không hiển thị được thế giới 3D",
      message:
        "SCAMMAZE cần WebGL 2, tính năng của trình duyệt dùng để vẽ đồ họa 3D. Hãy thử phiên bản mới của Chrome, Edge, Firefox hoặc Safari.",
    },
    "webgl-init": {
      title: "Không khởi động được đồ họa 3D",
      message:
        "Trình duyệt không khởi động được đồ họa 3D. Hãy bật tăng tốc phần cứng trong cài đặt trình duyệt, đóng các thẻ 3D khác rồi thử lại.",
    },
    "invalid-save": {
      title: "Không tải được trò chơi đã lưu",
      message:
        "Tiến trình đã lưu bị hỏng hoặc thuộc một phiên bản cũ của trò chơi. Hãy về menu chính và bắt đầu trò chơi mới.",
    },
    unknown: {
      title: "Đã xảy ra lỗi",
      message: "Tải không thành công vì một lý do không mong đợi. Hãy thử lại.",
    },
  },
  tips: {
    otp: "Ngân hàng và công ty giao hàng không hỏi mã xác thực một lần (OTP) của bạn qua tin nhắn hay cuộc gọi. Đừng bao giờ chia sẻ mã này.",
    urgency:
      "Sự gấp gáp là một chiêu gây áp lực. Một tổ chức thật vẫn ở đó nếu bạn dừng lại năm phút để kiểm tra.",
    trustedChannel:
      "Hãy liên hệ công ty qua ứng dụng hoặc số điện thoại bạn đã tin dùng, không qua đường dẫn hay số điện thoại trong tin nhắn.",
    readAddress:
      "Hãy đọc hết địa chỉ trang web trước khi nhập bất cứ thứ gì. Chỉ một chữ viết sai nhỏ cũng có thể che giấu một trang web giả.",
    payFirst:
      "Nếu bạn phải trả tiền trước để nhận giải thưởng, việc làm hay khoản hoàn tiền, hãy dừng lại và hỏi người bạn tin tưởng.",
    switchApp: "Hãy cẩn thận khi người lạ muốn chuyển cuộc trò chuyện sang một ứng dụng khác.",
    familyMessage:
      "Một tin nhắn nghe như của bạn bè hay người thân vẫn có thể là giả. Hãy gọi cho họ bằng số bạn đã biết.",
    smallSteps:
      "Nhiều vụ lừa đảo đi qua nhiều bước nhỏ. Mỗi bước có vẻ vô hại, nên hãy dừng lại và xem các bước đó dẫn tới đâu.",
  },
  webgl: {
    heading: "Không dùng được tăng tốc WebGL",
    body: "SCAMMAZE cần tăng tốc 3D WebGL 2.0 để hiển thị khu phố ở góc nhìn thứ nhất.",
    troubleshootingTitle: "Khắc phục nhanh:",
    hardwareAcceleration: "Hãy bật \"Tăng tốc phần cứng\" trong cài đặt trình duyệt.",
    updateDriver: "Hãy cập nhật trình điều khiển đồ họa hoặc thử trên Chrome / Edge / Firefox / Safari.",
    checkSupport: "Kiểm tra xem trình duyệt có hỗ trợ WebGL hay không tại <code>{{site}}</code>.",
    reload: "Tải lại trò chơi",
  },
};

export default loading;
