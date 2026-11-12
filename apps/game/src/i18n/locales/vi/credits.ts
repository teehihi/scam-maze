import type en from "../en/credits";
import type { LocaleShape } from "../../types";

// Asset names, creators, license names and URLs are not translated (see en/credits.ts).
const credits: LocaleShape<typeof en> = {
  title: "Ghi công dự án & tài nguyên 3D đã xác minh",
  subtitle: "Ghi nhận tác giả tài nguyên, giấy phép mở và người đóng góp",
  licenseNotice:
    "SCAMMAZE kiểm tra kỹ giấy phép của các tác phẩm bên thứ ba. Mọi tài nguyên 3D về môi trường và xe cộ trong cảnh đường phố của trò chơi đều được phát hành theo giấy phép {{license}} hoặc các giấy phép mã nguồn mở cho phép sử dụng kèm ghi công.",
  creatorLabel: "Tác giả:",
  viewSource: "Xem nguồn trên Sketchfab",
  sourceLabel: "Nguồn:",
  groups: {
    environments: { category: "Môi trường & kiến trúc thế giới 3D" },
    vehicles: { category: "Xe cộ & vật dụng đường phố 3D" },
    project: { category: "Thiết kế trò chơi, cốt truyện & kỹ thuật" },
  },
  items: {
    menuStreetScene: {
      notes:
        "Con phố khu dân cư Việt Nam chi tiết bằng 3D với nhà phố, đường chân trời Sài Gòn (Landmark 81, Bitexco), xe bánh mì, xe điện và người đi bộ địa phương.",
    },
    lowPolyCity: {
      notes:
        "Môi trường thành phố low poly hoàn chỉnh với giao lộ, mặt tiền cửa hàng, nhà thờ Hồi giáo, cối xay gió, xe cộ và vật dụng đô thị.",
    },
    lowPolyCityGameReady: {
      notes:
        "Môi trường khu phố đầy đủ với chung cư cao tầng, nhà nghỉ, quán ăn, cửa hàng, đại lộ nhiều làn, vỉa hè và cây xanh đường phố.",
    },
    lowPolyCityAssetPack: {
      notes: "Tòa nhà thành phố dạng mô-đun, mặt tiền cửa hàng, bệnh viện, các đoạn đường và vật dụng đường phố.",
    },
    lowPolyCarsPack: {
      notes: "Xe low poly gồm xe sedan, xe tải nhỏ và ô tô đỗ trong khu phố.",
    },
    callPhone: {
      notes:
        "Mô hình điện thoại cầm tay dùng cho các cuộc gọi. Bản đã tối ưu, đã bỏ hình nền và không có dấu hiệu thương hiệu nào.",
    },
    coreArchitecture: {
      notes: "Trò chơi mô phỏng điều tra lừa đảo 3D góc nhìn thứ nhất, xây dựng cho Kiroween 2026.",
    },
  },
};

export default credits;
