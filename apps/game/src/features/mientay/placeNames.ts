/**
 * Place names used in the Mekong Delta world UI. These are proper nouns: they stay the same in
 * every locale and reach the translated strings through interpolation.
 */
export const MIENTAY_PLACE_NAMES = {
  region: "Sông Nước Cửu Long",
  regionUpper: "SÔNG NƯỚC CỬU LONG",
  river: "Sông Hậu",
  riverUpper: "SÔNG HẬU",
} as const;

/** Zones reported by the engine, with the proper-noun name shown in the HUD. */
export const MIENTAY_ZONE_NAMES = {
  khmerPagoda: "Chùa Khmer Cổ & Miếu Cây Đa",
  oldHouse: "Khu Nhà Cổ Bình Thủy & Phố Cổ",
  stiltVillage: "Xóm Nhà Sàn Ven Rạch",
  orchard: "Vườn Miệt Vườn & Ao Sen",
  ferryPier: "Bến Đò Sông Hậu",
  creek: "Rạch Dừa Nước & Cầu Khỉ",
  floatingMarket: "Chợ Nổi Ngã Ba Sông",
} as const;

export type MientayZoneId = keyof typeof MIENTAY_ZONE_NAMES;
