import type en from "../../en/chapter1/story";
import type { LocaleShape } from "../../../types";

const story: LocaleShape<typeof en> = {
  dialogue: {
    playerSpeaker: "Bạn",
    systemSpeaker: "Dẫn truyện",
    optionsLabel: "Câu trả lời của bạn",
    noOptions: "Không có câu trả lời nào.",
    fallbackOption: "Kết thúc cuộc trò chuyện",
    caption: "Cuộc trò chuyện",
  },
  journal: {
    title: "Sổ ghi chép",
    evidenceHeading: "Bằng chứng",
    claimsHeading: "Lời khẳng định",
    emptyState: "Bạn chưa tìm thấy bằng chứng nào. Hãy nhìn quanh và kiểm tra những gì người gọi nói với bạn.",
    noClaimEvidence: "Chưa có bằng chứng nào về lời khẳng định này.",
    sourceLabel: "Nguồn",
    locationLabel: "Tìm thấy ở",
    statusLabel: "Trạng thái",
    notesHeading: "Ghi chú của bạn",
    decidePrompt: "Bây giờ bạn có thể quyết định nên làm gì.",
    decide: "Quyết định",
    close: "Đóng",
    stance: {
      supports: "Ủng hộ lời khẳng định này",
      contradicts: "Phản bác lời khẳng định này",
      inconclusive: "Chưa đủ để kết luận về lời khẳng định này",
      "needs-verification": "Cần kiểm tra qua một kênh bạn tin cậy",
    },
    claimStatus: {
      unverified: "Chưa kiểm tra",
      supported: "Bằng chứng ủng hộ lời khẳng định này",
      contradicted: "Bị phản bác bởi số điện thoại chính thức của Northgate Bank",
      inconclusive: "Đã kiểm tra, nhưng chưa có kết luận",
    },
    source: {
      physical: "Thứ bạn tìm thấy",
      device: "Điện thoại của bạn",
      dialogue: "Cuộc gọi điện thoại",
      npc: "Người bạn đã trò chuyện",
      verification: "Kiểm tra qua một kênh bạn tin cậy",
    },
  },
  inspection: {
    evidenceHeading: "Đã ghi vào sổ ghi chép",
    close: "Đóng",
  },
};

export default story;
