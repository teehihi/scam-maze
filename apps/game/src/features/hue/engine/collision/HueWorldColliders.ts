/**
 * SCAMMAZE — Huế Heritage World Environmental Colliders
 *
 * Populates physical collision representations for all authentic Huế
 * monuments, architectural structures, temple walls, pagodas, bridges,
 * pavilions, and major tree trunks while guaranteeing unobstructed passage
 * through open doorways, stairs, portals, and bridge decks.
 */

import { getCanalCenterX, getTerrainHeight } from '../../world/hueWorldConfig';
import { HueCollisionSystem } from './HueCollisionSystem';

export function populateHueWorldColliders(collision: HueCollisionSystem) {
  // =========================================================================
  // 1. CHÙA THIÊN MỤ & THÁP PHƯỚC DUYÊN (CX = -210)
  // =========================================================================
  const CX = -210;
  const PLATEAU_Y = 9.5;

  // 1.1 Pier Jetty & Mooring Posts (-210, y ~ 0.6, z ~ -43)
  collision.addBox('thien_mu_jetty_left', CX - 5.8, CX - 4.2, -45.5, -37.5, -0.5, 1.2, 'pier');
  collision.addBox('thien_mu_jetty_right', CX + 4.2, CX + 5.8, -45.5, -37.5, -0.5, 1.2, 'pier');
  collision.addCylinder('thien_mu_bollard_1', CX - 4.8, -39.0, 0.35, 0.5, 2.0, 'bollard');
  collision.addCylinder('thien_mu_bollard_2', CX + 4.8, -39.0, 0.35, 0.5, 2.0, 'bollard');
  collision.addBox('thien_mu_lantern_post_1', CX - 4.9, CX - 4.3, -44.5, -43.9, 0.5, 3.8, 'lantern_post');
  collision.addBox('thien_mu_lantern_post_2', CX + 4.3, CX + 4.9, -44.5, -43.9, 0.5, 3.8, 'lantern_post');

  // 1.2 Cổng Tam Quan (4 Trụ Biểu at z = -65.5, y = 3.6)
  const trụBieuXs = [-6.2, -2.5, 2.5, 6.2];
  trụBieuXs.forEach((ox, idx) => {
    collision.addCylinder(
      `thien_mu_tru_bieu_${idx}`,
      CX + ox,
      -65.5,
      0.5,
      3.6,
      9.8,
      'tru_bieu',
    );
  });
  // Tam Quan flanking wing walls (leaving central portal x in [-2.0, 2.0] open!)
  collision.addBox('thien_mu_tam_quan_wing_l', CX - 6.1, CX - 2.8, -65.9, -65.1, 3.6, 6.2, 'wall');
  collision.addBox('thien_mu_tam_quan_wing_r', CX + 2.8, CX + 6.1, -65.9, -65.1, 3.6, 6.2, 'wall');

  // 1.3 Đồi Hà Khê Retaining Balustrades (z = -78.0, y = 9.5)
  // Leaves central stair approach (x in [-214.5, -205.5]) open!
  collision.addBox('thien_mu_balustrade_l', CX - 28.5, CX - 4.8, -78.6, -77.4, 7.0, 10.8, 'balustrade');
  collision.addBox('thien_mu_balustrade_r', CX + 4.8, CX + 28.5, -78.6, -77.4, 7.0, 10.8, 'balustrade');

  // 1.4 Đình Hương Nguyện 8 Columns (center: CX, -85)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    collision.addCylinder(
      `thien_mu_huong_nguyen_col_${i}`,
      CX + Math.sin(a) * 3.85,
      -85 + Math.cos(a) * 3.85,
      0.24,
      PLATEAU_Y,
      PLATEAU_Y + 4.2,
      'column',
    );
  }

  // 1.5 Hai Bi Đình (Stele Pavilions, x = CX - 14.2 & CX + 14.2, z = -85)
  for (const sx of [-14.2, 14.2]) {
    const px = CX + sx;
    const tag = sx < 0 ? 'bi_dinh_w' : 'bi_dinh_e';
    for (const cx of [-1.55, 1.55]) {
      for (const cz of [-1.55, 1.55]) {
        collision.addCylinder(
          `thien_mu_${tag}_col_${cx}_${cz}`,
          px + cx,
          -85 + cz,
          0.2,
          PLATEAU_Y,
          PLATEAU_Y + 3.5,
          'column',
        );
      }
    }
    // Imperial stele stone slab inside pavilion
    collision.addBox(`thien_mu_${tag}_stele`, px - 0.6, px + 0.6, -85.2, -84.8, PLATEAU_Y, PLATEAU_Y + 2.5, 'stele');
  }

  // 1.6 THÁP PHƯỚC DUYÊN (Center: CX, -104, y = 9.5)
  // Solid octagonal brick pagoda body (cylinder radius 4.8m, height 22.3m)
  collision.addCylinder(
    'thien_mu_tower_body',
    CX,
    -104,
    4.8,
    PLATEAU_Y + 1.16,
    PLATEAU_Y + 23.5,
    'tower',
  );
  // Pagoda outer base balustrade (radius 6.35m, except south entrance at z > -99.0)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const isSouth = Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) > 0.8;
    if (!isSouth) {
      const bx = CX + Math.sin(a) * 6.2;
      const bz = -104 + Math.cos(a) * 6.2;
      collision.addCylinder(
        `thien_mu_tower_balustrade_${i}`,
        bx,
        bz,
        0.55,
        PLATEAU_Y + 1.16,
        PLATEAU_Y + 2.4,
        'balustrade',
      );
    }
  }

  // 1.7 Lầu Lục Giác Đại Hồng Chung (West: CX - 18.5, -118)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    collision.addCylinder(
      `thien_mu_bell_col_${i}`,
      CX - 18.5 + Math.sin(a) * 3.1,
      -118 + Math.cos(a) * 3.1,
      0.22,
      PLATEAU_Y,
      PLATEAU_Y + 4.0,
      'column',
    );
  }
  // Suspended 2-ton Đại Hồng Chung bell center
  collision.addCylinder('thien_mu_bell_core', CX - 18.5, -118, 0.75, PLATEAU_Y + 1.8, PLATEAU_Y + 4.0, 'bell');

  // 1.8 Lầu Lục Giác Rùa Đá (East: CX + 18.5, -118)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    collision.addCylinder(
      `thien_mu_turtle_col_${i}`,
      CX + 18.5 + Math.sin(a) * 3.1,
      -118 + Math.cos(a) * 3.1,
      0.22,
      PLATEAU_Y,
      PLATEAU_Y + 4.0,
      'column',
    );
  }
  // Giant stone turtle stele
  collision.addBox('thien_mu_turtle_stele', CX + 18.5 - 0.9, CX + 18.5 + 0.9, -119.4, -116.6, PLATEAU_Y, PLATEAU_Y + 3.2, 'turtle_stele');

  // 1.9 Tường Cổ Rêu Phong & Cổng Tam Quan Nội Viện (z = -129)
  // Flanking walls: leave central doorway (x in [-212.0, -208.0]) OPEN!
  collision.addBox('thien_mu_inner_wall_l', CX - 23.5, CX - 2.5, -129.5, -128.5, PLATEAU_Y, PLATEAU_Y + 3.8, 'wall');
  collision.addBox('thien_mu_inner_wall_r', CX + 2.5, CX + 23.5, -129.5, -128.5, PLATEAU_Y, PLATEAU_Y + 3.8, 'wall');
  collision.addCylinder('thien_mu_inner_gate_pier_l', CX - 2.8, -129.0, 0.75, PLATEAU_Y, PLATEAU_Y + 4.8, 'pier');
  collision.addCylinder('thien_mu_inner_gate_pier_r', CX + 2.8, -129.0, 0.75, PLATEAU_Y, PLATEAU_Y + 4.8, 'pier');

  // 1.10 Điện Đại Hùng (Main Sanctuary Hall at z = -146)
  collision.addBox('thien_mu_sanctuary_hall', CX - 9.8, CX + 9.8, -152.0, -141.5, PLATEAU_Y, PLATEAU_Y + 8.5, 'building');
  for (let i = -3; i <= 3; i++) {
    collision.addCylinder(
      `thien_mu_hall_col_${i}`,
      CX + i * 2.9,
      -140.6,
      0.24,
      PLATEAU_Y,
      PLATEAU_Y + 4.4,
      'column',
    );
  }

  // =========================================================================
  // 2. LĂNG KHẢI ĐỊNH (CX = 40, z = 240..370)
  // =========================================================================
  const K_CX = 40;

  // 2.1 Forecourt Gate Pillars (z = 246, y = 6.0)
  [-6.8, -2.6, 2.6, 6.8].forEach((px, idx) => {
    collision.addCylinder(`khai_dinh_gate_pillar_${idx}`, K_CX + px, 246, 0.55, 6.0, 12.0, 'pillar');
  });

  // 2.2 Sân Bái Đình (Court of Honor: stone mandarins, elephants, horses)
  // Mandarins rows at x = K_CX ± 7.5
  for (const sx of [-7.5, 7.5]) {
    [286, 290, 294, 298, 302, 306].forEach((mz, idx) => {
      collision.addCylinder(`khai_dinh_mandarin_${sx}_${idx}`, K_CX + sx, mz, 0.45, 13.6, 16.2, 'statue');
    });
    // Stone elephants & horses
    collision.addBox(`khai_dinh_elephant_${sx}`, K_CX + sx - 0.7, K_CX + sx + 0.7, 281.0, 283.0, 13.6, 16.0, 'statue');
    collision.addBox(`khai_dinh_horse_${sx}`, K_CX + sx - 0.6, K_CX + sx + 0.6, 283.5, 285.5, 13.6, 16.0, 'statue');
  }

  // 2.3 Bi Đình (Octagonal Stele Pavilion at center: K_CX, 295)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    collision.addCylinder(
      `khai_dinh_bi_dinh_col_${i}`,
      K_CX + Math.sin(a) * 3.6,
      295 + Math.cos(a) * 3.6,
      0.24,
      13.6,
      18.5,
      'column',
    );
  }
  collision.addCylinder('khai_dinh_stele_core', K_CX, 295, 1.1, 13.6, 17.5, 'stele');

  // 2.4 Trụ Biểu Obelisks (K_CX ± 13.5, 308)
  for (const sx of [-13.5, 13.5]) {
    collision.addCylinder(`khai_dinh_obelisk_${sx}`, K_CX + sx, 308, 0.9, 13.6, 26.0, 'obelisk');
  }

  // 2.5 CUNG THIÊN ĐỊNH (Center: K_CX, 355, floor y = 22.1m)
  // Front facade walls: leave OPEN entrance doorway portal at x in [K_CX - 2.4, K_CX + 2.4]!
  collision.addBox('cung_thien_dinh_front_l', K_CX - 14.5, K_CX - 2.5, 344.0, 345.5, 21.4, 30.5, 'wall');
  collision.addBox('cung_thien_dinh_front_r', K_CX + 2.5, K_CX + 14.5, 344.0, 345.5, 21.4, 30.5, 'wall');
  // Left and right side exterior walls
  collision.addBox('cung_thien_dinh_side_l', K_CX - 14.8, K_CX - 13.3, 344.0, 366.5, 21.4, 30.5, 'wall');
  collision.addBox('cung_thien_dinh_side_r', K_CX + 13.3, K_CX + 14.8, 344.0, 366.5, 21.4, 30.5, 'wall');
  // Rear sanctuary wall
  collision.addBox('cung_thien_dinh_rear', K_CX - 14.5, K_CX + 14.5, 365.8, 367.2, 21.4, 30.5, 'wall');
  // Interior Royal Altar Platform & Statue enclosure
  collision.addBox('cung_thien_dinh_altar', K_CX - 3.2, K_CX + 3.2, 362.5, 365.8, 22.1, 26.0, 'altar');

  // =========================================================================
  // 3. LĂNG TỰ ĐỨC & XUNG KHIÊM TẠ (CX ~ -38.5, z ~ 168)
  // =========================================================================
  const T_CX = -38.5;
  const T_CZ = 168.0;
  const T_Y = 5.25;

  // 3.1 Xung Khiêm Tạ Balustrades (keeping east entrance connected to land open)
  // North railing
  collision.addBox('tu_duc_north_rail', T_CX - 6.6, T_CX + 6.6, T_CZ + 9.5, T_CZ + 10.2, T_Y, T_Y + 1.2, 'railing');
  // South railing
  collision.addBox('tu_duc_south_rail', T_CX - 6.6, T_CX + 6.6, T_CZ - 10.2, T_CZ - 9.5, T_Y, T_Y + 1.2, 'railing');
  // West lake railing (leaves two small boat stairway gaps)
  collision.addBox('tu_duc_west_rail_1', T_CX - 6.8, T_CX - 6.1, T_CZ - 9.5, T_CZ - 5.8, T_Y, T_Y + 1.2, 'railing');
  collision.addBox('tu_duc_west_rail_2', T_CX - 6.8, T_CX - 6.1, T_CZ - 4.6, T_CZ + 4.6, T_Y, T_Y + 1.2, 'railing');
  collision.addBox('tu_duc_west_rail_3', T_CX - 6.8, T_CX - 6.1, T_CZ + 5.8, T_CZ + 9.5, T_Y, T_Y + 1.2, 'railing');

  // 3.2 Xung Khiêm Tạ Colonnade Columns
  [-4.8, 0, 4.8].forEach((ox) => {
    [-8.2, -4.1, 0, 4.1, 8.2].forEach((oz) => {
      collision.addCylinder(`tu_duc_col_${ox}_${oz}`, T_CX + ox, T_CZ + oz, 0.22, T_Y, T_Y + 4.2, 'column');
    });
  });

  // =========================================================================
  // 4. CẦU TRƯỜNG TIỀN (CX = 195, z in [-74, +74])
  // =========================================================================
  const B_CX = 195;
  // Left side railing & steel truss barrier (x = 195 - 4.35 = 190.65)
  collision.addBox('trang_tien_rail_left', B_CX - 4.65, B_CX - 4.15, -74.0, 74.0, 5.5, 14.0, 'bridge_rail');
  // Right side railing & steel truss barrier (x = 195 + 4.35 = 199.35)
  collision.addBox('trang_tien_rail_right', B_CX + 4.15, B_CX + 4.65, -74.0, 74.0, 5.5, 14.0, 'bridge_rail');

  // =========================================================================
  // 5. CẦU NGÓI THANH TOÀN (x in [246.5, 269.5], z = 215)
  // =========================================================================
  const TT_BZ = 215;
  const TT_BX = getCanalCenterX(TT_BZ); // ~ 260m

  // Left & Right wooden balustrades along bridge deck
  collision.addBox('thanh_toan_rail_north', TT_BX - 11.5, TT_BX + 11.5, TT_BZ - 2.85, TT_BZ - 2.45, 1.8, 5.0, 'bridge_rail');
  collision.addBox('thanh_toan_rail_south', TT_BX - 11.5, TT_BX + 11.5, TT_BZ + 2.45, TT_BZ + 2.85, 1.8, 5.0, 'bridge_rail');
  // Central altar shrine on north side of bridge interior
  collision.addBox('thanh_toan_central_altar', TT_BX - 1.2, TT_BX + 1.2, TT_BZ - 2.45, TT_BZ - 1.4, 2.5, 5.2, 'altar');

  // =========================================================================
  // 6. NHÀ VƯỜN KIM LONG & ĐỒI VỌNG CẢNH
  // =========================================================================
  // 6.1 Nhà Vườn Kim Long
  const KL_CX = -45;
  const KL_CZ = -110;
  // Nhà Rường main building
  collision.addBox('kim_long_house_body', KL_CX - 7.5, KL_CX + 7.5, KL_CZ - 6.5, KL_CZ + 1.2, 3.8, 8.5, 'building');
  // Front colonnade columns
  for (let i = -3; i <= 3; i++) {
    collision.addCylinder(`kim_long_col_${i}`, KL_CX + i * 2.25, KL_CZ + 1.6, 0.2, 3.8, 7.2, 'column');
  }
  // Dragon screen wall ("bình phong khảm sành")
  collision.addBox('kim_long_screen_wall', KL_CX - 3.2, KL_CX + 3.2, KL_CZ + 5.5, KL_CZ + 6.3, 3.8, 6.5, 'screen_wall');
  // Stone well
  collision.addCylinder('kim_long_stone_well', KL_CX + 6.5, KL_CZ + 2.0, 0.88, 3.8, 5.0, 'well');

  // 6.2 Đồi Vọng Cảnh lookout benches and posts (-220, 18.8, 94)
  [-3.0, 3.0].forEach((bx) => {
    collision.addBox(`vong_canh_bench_${bx}`, -220 + bx - 1.1, -220 + bx + 1.1, 95.8, 96.6, 18.8, 20.0, 'bench');
  });

  // =========================================================================
  // 7. MAJOR TREE TRUNKS (Frangipani in courtyards & pines near landmarks)
  // =========================================================================
  const courtyardTrees: [number, number, number][] = [
    [-218, -96, 0.4],
    [-202, -96, 0.4],
    [-222, -79, 0.38],
    [-198, -79, 0.38],
    [-226, -108, 0.42],
    [-194, -108, 0.42],
    [-216, -64, 0.36],
    [-204, -64, 0.36],
    [-55, -102, 0.38],
    [-35, -102, 0.38],
    [-52, -118, 0.4],
    // Key landmark pines
    [-205, 105, 0.45],
    [-232, 85, 0.48],
    [58, 275, 0.45],
    [22, 275, 0.45],
    [62, 320, 0.48],
    [18, 320, 0.48],
  ];

  courtyardTrees.forEach(([tx, tz, tr], idx) => {
    const ty = getTerrainHeight(tx, tz);
    collision.addCylinder(`tree_trunk_${idx}`, tx, tz, tr, ty - 0.5, ty + 6.0, 'tree');
  });
}
