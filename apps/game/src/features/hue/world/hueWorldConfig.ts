export interface LandmarkDef {
  id: string;
  name: string;
  subtitle: string;
  era: string;
  locationLabel: string;
  materialsNote: string;
  description: string;
  position: [number, number, number];
  lookAt: [number, number, number];
  /** Center point used for proximity discovery */
  zoneCenter: [number, number, number];
  zoneRadius: number;
}

export type AtmosphereId = 'dawn' | 'morning' | 'sunset' | 'night' | 'drizzle';

export interface AtmospherePreset {
  id: AtmosphereId;
  label: string;
  subtitle: string;
  sunElevation: number; // degrees above horizon
  sunAzimuth: number;   // degrees from +Z
  sunColor: string;
  sunIntensity: number;
  ambientSky: string;
  ambientGround: string;
  ambientIntensity: number;
  skyZenith: string;
  skyHorizon: string;
  fogColor: string;
  fogDensity: number;
  waterShallow: string;
  waterDeep: string;
  lanternGlow: number;
  stars: number;
  rainIntensity: number;
  exposure: number;
}

export const WORLD_SIZE = 1040;
export const WATER_LEVEL_RIVER = 0.0;
export const WATER_LEVEL_TU_DUC = 4.0;

// ---------------------------------------------------------------------------
// Deterministic Noise Utilities for Hue Topography
// ---------------------------------------------------------------------------
function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function noise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * (noise2D(x * freq, z * freq) * 2 - 1);
    freq *= 2.03;
    amp *= 0.5;
  }
  return value;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// Sông Hương & Kênh Như Ý River Geometry
// ---------------------------------------------------------------------------
export function getRiverCenterZ(x: number): number {
  return (
    -24 * Math.sin(x * 0.009) -
    18 * Math.exp(-Math.pow((x + 210) / 115, 2)) +
    22 * Math.exp(-Math.pow((x - 195) / 140, 2))
  );
}

export function getRiverHalfWidth(x: number): number {
  // Slightly wider near Cầu Trường Tiền (x ~ 195) and gentle bend near Thiên Mụ
  return 43 + 9 * Math.exp(-Math.pow((x - 195) / 135, 2)) + 4 * Math.sin(x * 0.015);
}

export function getCanalCenterX(z: number): number {
  return 258 + 13 * Math.sin((z - 80) * 0.018);
}

export function getCanalHalfWidth(): number {
  return 8.8;
}

/** Signed mask > 0 inside Hồ Lưu Khiêm basin (Lăng Tự Đức) */
export function getTuDucLakeFactor(x: number, z: number): number {
  const cx = -72;
  const cz = 175;
  const dx = (x - cx) / 43;
  const dz = (z - cz) / 27;
  // Subtle organic crescent warp
  const warp = 0.14 * Math.sin((x - cx) * 0.06) + 0.1 * Math.cos((z - cz) * 0.08);
  const d = Math.sqrt(dx * dx + dz * dz) + warp;
  return 1 - smoothstep(0.84, 1.08, d);
}

/** Returns 0..1 proximity to major Hue stone roads / trails */
export function getPathFactor(x: number, z: number): number {
  let mask = 0;

  // Northern riverside lane connecting Thiên Mụ (-210, -64) -> Kim Long (-45, -70) -> Trường Tiền (+195, -72)
  const northRoadZ = -65 - 5 * Math.sin(x * 0.014);
  if (x > -245 && x < 230) {
    const d = Math.abs(z - northRoadZ);
    mask = Math.max(mask, 1 - smoothstep(2.4, 5.2, d));
  }

  // Southern riverside promenade & road from Cầu Trường Tiền (+195, +74) -> Vọng Cảnh / Tự Đức / Khải Định
  const southPromZ = 73 + 6 * Math.sin(x * 0.012);
  if (x > -240 && x < 275) {
    const d = Math.abs(z - southPromZ);
    mask = Math.max(mask, 1 - smoothstep(2.6, 5.5, d));
  }

  // Pine forest path from southern promenade (-110, 75) -> Hồ Lưu Khiêm (-65, 138)
  if (z >= 73 && z <= 145) {
    const t = (z - 73) / (145 - 73);
    const px = lerp(-112, -55, t) + 12 * Math.sin(t * Math.PI);
    const d = Math.abs(x - px);
    mask = Math.max(mask, 1 - smoothstep(2.0, 4.2, d));
  }

  // Trail from Lăng Tự Đức (-30, 180) -> Lăng Khải Định forecourt (+40, 236)
  if (z >= 175 && z <= 240) {
    const t = (z - 175) / (240 - 175);
    const px = lerp(-28, 40, t) - 10 * Math.sin(t * Math.PI);
    const d = Math.abs(x - px);
    mask = Math.max(mask, 1 - smoothstep(2.0, 4.2, d));
  }

  // Eastern road toward Cầu Ngói Thanh Toàn (+200..+325, z ~ 215)
  if (z >= 75 && z <= 218) {
    const t = (z - 75) / (218 - 75);
    const px = lerp(195, 224, t) + 6 * Math.sin(t * Math.PI);
    const d = Math.abs(x - px);
    mask = Math.max(mask, 1 - smoothstep(2.2, 4.6, d));
  }
  if (x >= 215 && x <= 325) {
    const d = Math.abs(z - 215);
    mask = Math.max(mask, 1 - smoothstep(2.2, 4.8, d));
  }

  // Vọng Cảnh Pine Trail (-185, 76 -> -220, 92)
  if (x >= -232 && x <= -150 && z >= 72 && z <= 125) {
    const d = Math.hypot(x + 220, z - 94);
    if (d < 18) mask = Math.max(mask, 1 - smoothstep(8, 16, d));
  }

  return Math.min(1, mask);
}

// ---------------------------------------------------------------------------
// Continuous Sculpted Hue Terrain Elevation Function
// ---------------------------------------------------------------------------
function plateauBlend(
  baseH: number,
  targetH: number,
  dist: number,
  innerR: number,
  outerR: number,
): number {
  const w = 1 - smoothstep(innerR, outerR, dist);
  return lerp(baseH, targetH, w);
}

export function getTerrainHeight(x: number, z: number): number {
  // 1. Natural rolling Huế hills & southern mountain backdrop
  let h = 3.2 + fbm2D(x * 0.0048, z * 0.0048, 4) * 4.5 + fbm2D(x * 0.016, z * 0.016, 2) * 0.9;

  // Southern Trường Sơn / Châu Chữ foothills rise naturally as z > 200
  const southSlope = smoothstep(170, 460, z);
  h += southSlope * (22 + 9 * fbm2D(x * 0.007 + 4.1, z * 0.007 - 2.3, 3));

  // Distant north-west hills behind Thiên Mụ
  const nwHills = smoothstep(-160, -420, z) * smoothstep(-60, -340, x);
  h += nwHills * 15;

  // 2. Sculpt specific monumental landforms & plateaus
  // --- Đồi Hà Khê (Chùa Thiên Mụ: center -210, -112, plateau y = 9.5m) ---
  {
    const dx = (x + 210) / 1.15;
    const dz = (z + 112) / 1.12;
    const dist = Math.hypot(dx, dz);
    h = plateauBlend(h, 9.5, dist, 38, 66);

    // Gentle approach terrace at Tam Quan / bottom of 15-step stairs (-210, -68)
    const dGate = Math.hypot((x + 210) / 1.3, (z + 65) / 0.8);
    h = plateauBlend(h, 3.6, dGate, 8, 22);
  }

  // --- Nhà Vườn Kim Long terrace (-45, -108, y = 3.2m) ---
  {
    const dist = Math.hypot((x + 45) / 1.2, z + 108);
    h = plateauBlend(h, 3.2, dist, 24, 42);
  }

  // --- Đồi Vọng Cảnh bluff (-220, +94, y = 18.8m) ---
  {
    const dist = Math.hypot((x + 220) / 1.15, (z - 94) / 1.0);
    h = plateauBlend(h, 18.8, dist, 18, 52);
  }

  // --- Thung Lũng Lăng Tự Đức (-86, +172, surrounding terrace y = 5.4m, lake bed y = 1.6m) ---
  {
    const valleyDist = Math.hypot((x + 88) / 1.45, (z - 174) / 1.1);
    h = plateauBlend(h, 5.4, valleyDist, 64, 98);

    // Raised Điện Hòa Khiêm terrace west of Khiêm Cung Môn
    const palaceDist = Math.hypot((x + 132) / 0.9, (z - 172) / 1.1);
    h = plateauBlend(h, 6.4, palaceDist, 18, 30);

    // Excavate Hồ Lưu Khiêm basin cleanly below WATER_LEVEL_TU_DUC (4.0m)
    const lakeW = getTuDucLakeFactor(x, z);
    h = lerp(h, 1.6, lakeW);
  }

  // --- Lăng Khải Định stepped slope on Núi Châu Chữ (center x = 40, z = 238..372) ---
  {
    const latDist = Math.abs(x - 40);
    const latW = 1 - smoothstep(26, 62, latDist);
    if (latW > 0.001 && z >= 225 && z <= 400) {
      let targetKH = 6.0;
      if (z < 248) {
        targetKH = 6.0;
      } else if (z < 262) {
        targetKH = lerp(6.0, 10.2, (z - 248) / 14);
      } else if (z < 270) {
        targetKH = 10.2;
      } else if (z < 280) {
        targetKH = lerp(10.2, 13.6, (z - 270) / 10);
      } else if (z < 310) {
        targetKH = 13.6;
      } else if (z < 324) {
        targetKH = lerp(13.6, 18.6, (z - 310) / 14);
      } else if (z < 332) {
        targetKH = 18.6;
      } else if (z < 340) {
        targetKH = lerp(18.6, 21.4, (z - 332) / 8);
      } else if (z < 376) {
        targetKH = 21.4;
      } else {
        targetKH = lerp(21.4, 34.0, smoothstep(376, 400, z));
      }
      h = lerp(h, targetKH, latW);
    }
  }

  // --- Cầu Trường Tiền North & South road embankments (x ~ 195) ---
  {
    const lat = Math.abs(x - 195);
    const wLat = 1 - smoothstep(8, 22, lat);
    if (wLat > 0.001) {
      if (z <= -66 && z >= -95) {
        const ramp = lerp(6.6, 3.0, smoothstep(-66, -92, z));
        h = lerp(h, ramp, wLat);
      } else if (z >= 66 && z <= 95) {
        const ramp = lerp(6.6, 3.0, smoothstep(66, 92, z));
        h = lerp(h, ramp, wLat);
      }
    }
  }

  // --- Làng Thủy Thanh & Cầu Ngói Thanh Toàn plateau (x ~ 215..320, z ~ 180..255) ---
  {
    const dist = Math.hypot((x - 258) / 1.4, (z - 215) / 1.15);
    h = plateauBlend(h, 2.3, dist, 38, 62);
  }

  // 3. Carve Sông Hương continuous riverbed (y = 0 water plane)
  {
    const rcZ = getRiverCenterZ(x);
    const rHalf = getRiverHalfWidth(x);
    const distRiver = Math.abs(z - rcZ);
    const bankSlope = smoothstep(rHalf - 6, rHalf + 18, distRiver);
    const bedDepth = -3.8 - 1.2 * Math.cos((distRiver / Math.max(1, rHalf)) * Math.PI * 0.5);
    // Keep riverbank ground smoothly above water outside rHalf
    const minBankH = Math.max(h, 1.35);
    h = lerp(bedDepth, minBankH, bankSlope);
  }

  // 4. Carve Kênh Như Ý village canal (branches south from Sông Hương at z > 30)
  {
    const rcZ = getRiverCenterZ(x);
    if (z > rcZ + 12) {
      const cx = getCanalCenterX(z);
      const cw = getCanalHalfWidth();
      const dCanal = Math.abs(x - cx);
      const canalSlope = smoothstep(cw - 2.2, cw + 7.5, dCanal);
      const canalBed = -2.4;
      const bankFloor = Math.max(h, 1.55);
      h = lerp(canalBed, bankFloor, canalSlope);
    }
  }

  return h;
}

// ---------------------------------------------------------------------------
// Walkable Architectural Surfaces (Bridges, Stairs, Pavilions, Floors)
// ---------------------------------------------------------------------------
export function getWalkableHeight(x: number, z: number): number {
  let y = getTerrainHeight(x, z);

  // 1. Cầu Trường Tiền deck (x in [190.8, 199.2], z in [-72, +72])
  if (Math.abs(x - 195) <= 4.3 && z >= -72 && z <= 72) {
    // Gentle camber arch across the 6 spans
    const t = Math.abs(z) / 72;
    const deckY = 6.95 - t * t * 0.35;
    y = Math.max(y, deckY);
  }

  // 2. Cầu Ngói Thanh Toàn arched wooden deck (z in [212.5, 217.5], x in [246.5, 269.5])
  if (Math.abs(z - 215) <= 2.6 && x >= 246.5 && x <= 269.5) {
    const u = (x - 258) / 11.5; // -1..+1
    const archY = 2.35 + (1 - u * u) * 1.45;
    y = Math.max(y, archY);
  }

  // 3. Chùa Thiên Mụ stairs & pagoda plinth
  if (Math.abs(x + 210) <= 4.2 && z >= -64 && z <= -45) {
    // Bến thuyền 24 steps rising from z = -45 (y=0.6) to z = -64 (y=3.6)
    const t = (-45 - z) / 19;
    y = Math.max(y, lerp(0.6, 3.6, Math.max(0, Math.min(1, t))));
  }
  if (Math.abs(x + 210) <= 5.5 && z >= -78 && z <= -66) {
    // 15 steps from Tam Quan up to Đình Hương Nguyện courtyard
    const t = (-66 - z) / 12;
    y = Math.max(y, lerp(3.6, 9.5, Math.max(0, Math.min(1, t))));
  }
  if (Math.hypot(x + 210, z + 104) <= 7.8) {
    // Tháp Phước Duyên stone plinth
    y = Math.max(y, 10.65);
  }

  // 4. Xung Khiêm Tạ overwater deck (x in [-48.5, -28.5], z in [161.5, 174.5])
  if (x >= -48.5 && x <= -28.5 && z >= 161.5 && z <= 174.5) {
    y = Math.max(y, 5.25);
  }
  // Dũ Khiêm Tạ overwater deck
  if (x >= -56.5 && x <= -47.5 && z >= 139.5 && z <= 148.5) {
    y = Math.max(y, 5.1);
  }
  // Cầu Tiểu Khiêm Trì footbridge
  if (Math.abs(z - 172) <= 2.1 && x >= -100 && x <= -84) {
    const u = (x + 92) / 8;
    y = Math.max(y, 5.45 + (1 - u * u) * 0.9);
  }

  // 5. Lăng Khải Định — Cung Thiên Định podium & interior floor (x in [21, 59], z in [340, 370])
  if (x >= 21 && x <= 59 && z >= 340 && z <= 370) {
    y = Math.max(y, 22.1);
    // Inner rear altar terrace
    if (x >= 32 && x <= 48 && z >= 359 && z <= 368) {
      y = Math.max(y, 22.7);
    }
  }

  // 6. Nhà Vườn Kim Long porch
  if (x >= -54 && x <= -36 && z >= -116 && z <= -104) {
    y = Math.max(y, 3.85);
  }

  return y;
}

// ---------------------------------------------------------------------------
// Curated Huế Heritage Landmarks (Zero Kinh Thành!)
// ---------------------------------------------------------------------------
export const HUE_LANDMARKS: LandmarkDef[] = [
  {
    id: 'thien-mu',
    name: 'Chùa Thiên Mụ & Tháp Phước Duyên',
    subtitle: 'Quốc Tự Trên Đồi Hà Khê • 1601 / 1844',
    era: 'Chúa Nguyễn Hoàng & Vua Thiệu Trị',
    locationLabel: 'Tả ngạn Sông Hương • Đồi Hà Khê',
    materialsNote: 'Gạch vồ mộc, vôi vữa hồng phai, pháp lam men ngọc & đá thanh rêu phong',
    description:
      'Tòa bửu tháp bát giác 7 tầng cao 22,26m soi bóng xuống khúc uốn Sông Hương. Trước tháp là Đình Hương Nguyện, hai bên là Bi Đình và lầu lục giác treo Đại Hồng Chung đúc năm 1710 cùng bến thuyền 24 bậc đá thanh.',
    position: [-210, 6.2, -52],
    lookAt: [-210, 17.5, -104],
    zoneCenter: [-210, 9.5, -100],
    zoneRadius: 54,
  },
  {
    id: 'khai-dinh',
    name: 'Lăng Khải Định (Ứng Lăng)',
    subtitle: 'Giao Thoa Đông – Tây & Kiệt Tác Khảm Sành Sứ • 1920–1931',
    era: 'Vua Khải Định & Vua Bảo Đại',
    locationLabel: 'Triền Núi Châu Chữ • Thủy Bằng',
    materialsNote: 'Đá hộc viền vữa, bê tông rêu đen cổ kính & khảm sành sứ thủy tinh màu',
    description:
      'Vươn cao 127 bậc cấp rồng đá trên sườn núi Châu Chữ. Ngoại thất mang dáng lâu đài Gothic–Á Đông trầm mặc; bước vào Cung Thiên Định là thế giới lộng lẫy của hàng vạn mảnh sành sứ, thủy tinh màu, tượng đồng mạ vàng và bức Bửu Tán nặng một tấn.',
    position: [40, 13.8, 250],
    lookAt: [40, 21.5, 345],
    zoneCenter: [40, 16, 310],
    zoneRadius: 68,
  },
  {
    id: 'khai-dinh-interior',
    name: 'Nội Điện Cung Thiên Định',
    subtitle: 'Bửu Tán & Cửu Long Ẩn Vân • Bên Trong Ứng Lăng',
    era: 'Nghệ nhân Phan Văn Tánh & đồng sự',
    locationLabel: 'Tầng sân cao nhất • Lăng Khải Định',
    materialsNote: 'Khảm sành sứ đa sắc tráng men, nền đá hoa cẩm thạch & tượng đồng thếp vàng',
    description:
      'Sáu mặt không gian nội điện phủ kín phù điêu Tứ Quý, Bát Bửu ghép từ mảnh sứ và thủy tinh màu bắt sáng lung linh dưới ánh nến, tôn vinh bức Bửu Tán mềm mại như lụa rủ che trên pho tượng đồng mạ vàng vua Khải Định.',
    position: [40, 23.8, 344.5],
    lookAt: [40, 24.4, 358],
    zoneCenter: [40, 22.1, 355],
    zoneRadius: 18,
  },
  {
    id: 'tu-duc',
    name: 'Lăng Tự Đức & Xung Khiêm Tạ',
    subtitle: 'Bức Tranh Sơn Thủy Khiêm Lăng • 1864–1867',
    era: 'Vua Tự Đức',
    locationLabel: 'Thung Lũng Dương Xuân • Đồi Thông Thủy Xuân',
    materialsNote: 'Gỗ lim trầm mặc, ngói ống hoàng lưu ly, kè đá hộc phủ rêu & hồ sen',
    description:
      'Xung Khiêm Tạ và Dũ Khiêm Tạ vươn mình trên những hàng cọc gỗ lim giữa mặt nước xanh thẫm Hồ Lưu Khiêm. Mái trùng thiềm điệp ốc lợp ngói lưu ly hổ phách rực sáng phản chiếu giữa rừng thông và hương sen tĩnh lặng.',
    position: [-20, 7.6, 192],
    lookAt: [-48, 6.2, 166],
    zoneCenter: [-68, 5.4, 170],
    zoneRadius: 68,
  },
  {
    id: 'trang-tien',
    name: 'Cầu Trường Tiền & Đôi Bờ Sông Hương',
    subtitle: 'Nhịp Cầu Vành Lược Hãng Eiffel • 1899',
    era: 'Vua Thành Thái • Thiết kế Eiffel',
    locationLabel: 'Bắc – Nam Sông Hương',
    materialsNote: 'Thép nhũ bạc ghép đinh tán, trụ đá thanh vát mũi rẽ nước & lan can sắt mỹ thuật',
    description:
      'Sáu nhịp dầm thép bán nguyệt uyển chuyển nối đôi bờ Hương Giang, tôn thêm đôi hành lang ban công ngắm cảnh dựng năm 1937. Đứng trên cầu ngắm thuyền rồng xuôi mái chèo và Tháp Phước Duyên mờ sương phía thượng nguồn.',
    position: [195, 9.2, -55],
    lookAt: [195, 7.5, 25],
    zoneCenter: [195, 6.9, 0],
    zoneRadius: 72,
  },
  {
    id: 'thanh-toan',
    name: 'Cầu Ngói Thanh Toàn & Làng Hương',
    subtitle: 'Thượng Gia Hạ Kiều 250 Tuổi • 1776',
    era: 'Bà Trần Thị Đạo • Làng Thanh Thủy Chánh',
    locationLabel: 'Kênh Như Ý & Làng Hương Thủy Xuân',
    materialsNote: 'Vì kèo gỗ lim, ngói thanh lưu ly, cuốn thư & rồng phượng khảm sành sứ',
    description:
      'Cây cầu vòm gỗ 7 gian mái ngói ống men ngọc bắc qua dòng kênh làng quê, bên trong đặt bục gỗ ngồi nghỉ và bàn thờ bà Trần Thị Đạo ở gian giữa. Cạnh cầu là sân phơi những bó hương sắc đỏ, vàng, tím rực rỡ của nghề hương xứ Huế.',
    position: [233, 5.2, 215],
    lookAt: [258, 4.8, 215],
    zoneCenter: [258, 3.2, 215],
    zoneRadius: 38,
  },
  {
    id: 'vong-canh',
    name: 'Đồi Vọng Cảnh & Nhà Vườn Kim Long',
    subtitle: 'Góc Nhìn Khúc Quanh Sông Hương',
    era: 'Cảnh Quan Thiên Nhiên & Nhà Rường Cố Đô',
    locationLabel: 'Nam Ngạn Đồi Vọng Cảnh & Làng Vườn Kim Long',
    materialsNote: 'Thông đỏ xứ Huế, đá thanh tự nhiên, nhà rường gỗ mít & bình phong khảm sành',
    description:
      'Từ mỏm đồi thông Vọng Cảnh, toàn bộ khúc quanh chữ S của Sông Hương mở ra như dải lụa mềm đối diện Chùa Thiên Mụ; bên tả ngạn là ngôi nhà vườn Kim Long ẩn mình sau bức bình phong rồng cuốn.',
    position: [-214, 21.8, 86],
    lookAt: [-210, 14.0, -90],
    zoneCenter: [-220, 18.8, 94],
    zoneRadius: 36,
  },
];

// ---------------------------------------------------------------------------
// Authentic Huế Atmosphere Presets
// ---------------------------------------------------------------------------
export const ATMOSPHERE_PRESETS: Record<AtmosphereId, AtmospherePreset> = {
  morning: {
    id: 'morning',
    label: 'Nắng Vàng Cố Đô',
    subtitle: 'Sáng trong nắng ấm rọi gạch vồ & mái ngói lưu ly',
    sunElevation: 36,
    sunAzimuth: 132,
    sunColor: '#ffe7be',
    sunIntensity: 3.1,
    ambientSky: '#98c2ea',
    ambientGround: '#4a4337',
    ambientIntensity: 0.92,
    skyZenith: '#2c67a8',
    skyHorizon: '#d9d8cc',
    fogColor: '#c9d5da',
    fogDensity: 0.00145,
    waterShallow: '#285e58',
    waterDeep: '#102e34',
    lanternGlow: 0.28,
    stars: 0.0,
    rainIntensity: 0,
    exposure: 1.06,
  },
  dawn: {
    id: 'dawn',
    label: 'Bình Minh Sương Giăng',
    subtitle: 'Sương ngọc trai lan tỏa trên khúc quanh Sông Hương',
    sunElevation: 11,
    sunAzimuth: 102,
    sunColor: '#ffb788',
    sunIntensity: 2.1,
    ambientSky: '#9a9dc6',
    ambientGround: '#3d3942',
    ambientIntensity: 0.88,
    skyZenith: '#3e5484',
    skyHorizon: '#e9baa8',
    fogColor: '#cfc1ca',
    fogDensity: 0.0026,
    waterShallow: '#2e515c',
    waterDeep: '#152736',
    lanternGlow: 0.85,
    stars: 0.08,
    rainIntensity: 0,
    exposure: 1.08,
  },
  sunset: {
    id: 'sunset',
    label: 'Hoàng Hôn Tím Huế',
    subtitle: 'Chiều buông hổ phách & sương tím dãy Trường Sơn',
    sunElevation: 8,
    sunAzimuth: 248,
    sunColor: '#ff8a48',
    sunIntensity: 2.85,
    ambientSky: '#8c6b9c',
    ambientGround: '#3b2833',
    ambientIntensity: 0.82,
    skyZenith: '#2d2858',
    skyHorizon: '#df7b5c',
    fogColor: '#9f6c7c',
    fogDensity: 0.0019,
    waterShallow: '#39465a',
    waterDeep: '#181c30',
    lanternGlow: 1.45,
    stars: 0.0,
    rainIntensity: 0,
    exposure: 1.12,
  },
  night: {
    id: 'night',
    label: 'Đêm Trăng Hoa Đăng',
    subtitle: 'Ánh trăng bạc & đèn lồng hoa đăng trôi trên Hương Giang',
    sunElevation: 24,
    sunAzimuth: 215,
    sunColor: '#9ab6e6',
    sunIntensity: 0.72,
    ambientSky: '#233252',
    ambientGround: '#10141f',
    ambientIntensity: 0.56,
    skyZenith: '#070c1a',
    skyHorizon: '#1c2842',
    fogColor: '#121a2d',
    fogDensity: 0.0021,
    waterShallow: '#132436',
    waterDeep: '#070e18',
    lanternGlow: 2.8,
    stars: 1.0,
    rainIntensity: 0,
    exposure: 1.16,
  },
  drizzle: {
    id: 'drizzle',
    label: 'Mưa Bụi Xứ Huế',
    subtitle: 'Mưa bụi giăng nhẹ làm thẫm màu đá thanh & rêu phong',
    sunElevation: 28,
    sunAzimuth: 155,
    sunColor: '#c8d6df',
    sunIntensity: 1.35,
    ambientSky: '#7d8e99',
    ambientGround: '#313a36',
    ambientIntensity: 1.02,
    skyZenith: '#4c5e6c',
    skyHorizon: '#a3b1b8',
    fogColor: '#8d9ca4',
    fogDensity: 0.0031,
    waterShallow: '#264446',
    waterDeep: '#132529',
    lanternGlow: 1.15,
    stars: 0.0,
    rainIntensity: 1.0,
    exposure: 1.0,
  },
};
