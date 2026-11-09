import * as THREE from "three";
import type { HCMThemeId } from "./types";

// Hash function based on quantized 2D grid cell so entire buildings have uniform color
function gridHash(cellX: number, cellZ: number): number {
  const s = Math.sin(cellX * 127.1 + cellZ * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// =============================================================================
// COLOR PALETTES SAMPLED DIRECTLY FROM REAL HO CHI MINH CITY AERIAL PHOTOGRAPHY
// (Photos: Bến Bạch Đằng, Cột cờ Thủ Ngữ, Tháp Bitexco, Sông Sài Gòn & Quận 1)
// =============================================================================

// Sông Sài Gòn - Nước phù sa tự nhiên (alluvial sediment silt water)
const COLOR_WATER_ALLUVIAL = new THREE.Color("#606756");
const COLOR_WATER_SHALLOW = new THREE.Color("#525748");

// Bến Bạch Đằng & Công viên ven sông
const COLOR_PARK_LAWN = new THREE.Color("#4d753b");       // Bãi cỏ xanh uốn lượn Bến Bạch Đằng
const COLOR_PARK_TREES = new THREE.Color("#335328");      // Rặng cây xanh dọc bờ sông & đại lộ
const COLOR_PROMENADE_PAVER = new THREE.Color("#bab6ad"); // Lối đi bộ lát đá hoa cương ven sông
const COLOR_ROAD_ASPHALT = new THREE.Color("#2c3038");    // Lòng đường nhựa Tôn Đức Thắng, Hàm Nghi

// Mái nhà (Rooftops) - Đa số là bê tông sáng màu / tôn xám bạc, chỉ một phần nhỏ ngói đỏ cổ điển
const COLOR_ROOF_CONCRETE = new THREE.Color("#abb4bd");   // Sàn mái bê tông phẳng hiện đại
const COLOR_ROOF_ZINC = new THREE.Color("#959fa9");       // Mái tôn / trần kỹ thuật kim loại
const COLOR_ROOF_GRAVEL = new THREE.Color("#737e89");     // Màng chống thấm sẫm màu
const COLOR_ROOF_TERRACOTTA = new THREE.Color("#7c3e30"); // Ngói gạch nung trầm (Kiến trúc Pháp cũ)

// Mặt đứng tòa nhà thấp & trung tầng (Facades) - Tông màu trang nhã, trung tính
const DAY_FACADE_PALETTE = [
  new THREE.Color("#e4e0d7"), // Trắng ngà hiện đại (Chung cư & văn phòng)
  new THREE.Color("#d5cbbd"), // Đá sa thạch ấm
  new THREE.Color("#cfab65"), // Vàng thuộc địa Pháp (Nhà cổ Sài Gòn)
  new THREE.Color("#788490"), // Bê tông kiến trúc xám thanh lịch
  new THREE.Color("#7c483a"), // Điểm xuyết gạch đỏ / đá granite nâu
  new THREE.Color("#c8c0b2"), // Vữa xi măng cổ điển
  new THREE.Color("#82909e"), // Lam che nắng xám xanh
];

// Kính cao ốc chọc trời (Skyscraper Curtain-Wall Glass)
const COLOR_GLASS_SLATE = new THREE.Color("#566878");     // Kính cản nhiệt xám khói / xanh đá phiến
const COLOR_GLASS_SKY = new THREE.Color("#788c9e");       // Kính bắt bóng trời xanh
const COLOR_GLASS_DEEP = new THREE.Color("#3f4f5d");      // Kính phản quang sẫm màu
const COLOR_GLASS_EMERALD = new THREE.Color("#385750");   // Kính xanh lá bảo vệ môi trường (Times Square)
const COLOR_TOWER_SILVER = new THREE.Color("#dce3ea");    // Khung kim loại & vương miện tháp

export function computeVertexColor(
  wx: number,
  wy: number,
  wz: number,
  nx: number,
  ny: number,
  nz: number,
  theme: HCMThemeId,
  targetColor: THREE.Color
): void {
  const isUp = ny > 0.65;

  // Quantize space into 4-meter building cells to eliminate rainbow color smearing across vertices
  const cellX = Math.floor((wx + 100) / 4.0);
  const cellZ = Math.floor((wz + 100) / 4.0);
  const bldgSeed = gridHash(cellX, cellZ);

  // Landmark distance checks
  const distToBitexco = Math.hypot(wx - 5.77, wz - 8.67);
  const distToVietcombank = Math.hypot(wx - 3.57, wz - (-14.72));

  switch (theme) {
    case "daylight": {
      if (isUp) {
        if (wy < 0.44) {
          // Sông Sài Gòn: Màu nước phù sa tự nhiên đặc trưng (không dùng xanh dương chói lóa)
          targetColor.copy(COLOR_WATER_ALLUVIAL);
          if (wy < 0.25) targetColor.copy(COLOR_WATER_SHALLOW);
        } else if (wy < 0.88) {
          // Mặt đất: Phân tách rõ Lòng đường, Bãi cỏ Bến Bạch Đằng, và Phố đi bộ
          // Bến Bạch Đằng park curve along the river
          const isNearWaterfront = wz > 5.0 && wz < 13.5 && wx > 6.0 && wx < 11.5;
          const parkNoise = Math.sin(wx * 0.6) * Math.cos(wz * 0.6);

          if (isNearWaterfront && parkNoise > 0.1) {
            targetColor.copy(COLOR_PARK_LAWN); // Thảm cỏ xanh Bến Bạch Đằng
          } else if (isNearWaterfront) {
            targetColor.copy(COLOR_PROMENADE_PAVER); // Đường đi bộ ven sông
          } else if (parkNoise > 0.4) {
            targetColor.copy(COLOR_PARK_TREES); // Mảng cây xanh đô thị
          } else if (parkNoise < -0.2) {
            targetColor.copy(COLOR_ROAD_ASPHALT); // Lòng đường nhựa
          } else {
            targetColor.copy(COLOR_PROMENADE_PAVER); // Vỉa hè / quảng trường
          }
        } else if (distToBitexco < 1.8 && wy >= 2.0) {
          // Mái tháp & sân đỗ trực thăng Bitexco
          targetColor.copy(COLOR_TOWER_SILVER);
        } else if (wy >= 2.5) {
          // Sàn mái cao ốc hiện đại
          targetColor.copy(COLOR_ROOF_CONCRETE);
        } else {
          // Mái nhà khu phố thấp tầng: 80% là sàn bê tông/tôn xám, 20% là ngói đỏ trầm
          if (bldgSeed > 0.82) {
            targetColor.copy(COLOR_ROOF_TERRACOTTA);
          } else if (bldgSeed > 0.4) {
            targetColor.copy(COLOR_ROOF_CONCRETE);
          } else if (bldgSeed > 0.15) {
            targetColor.copy(COLOR_ROOF_ZINC);
          } else {
            targetColor.copy(COLOR_ROOF_GRAVEL);
          }
        }
      } else {
        // TƯỜNG & MẶT TIỀN TÒA NHÀ (Facades & Walls)
        if (distToBitexco < 1.8 && wy >= 1.5) {
          // THÁP BITEXCO: Kính màu xanh phiến xám bạc thanh thoát của hoa sen
          const hRatio = Math.min(1.0, (wy - 1.5) / 3.6);
          targetColor.copy(COLOR_GLASS_SLATE).lerp(COLOR_GLASS_SKY, hRatio * 0.7);
        } else if (distToVietcombank < 2.2 && wy >= 1.8) {
          // VIETCOMBANK TOWER / CỤM CÔNG TRƯỜNG MÊ LINH
          targetColor.copy(COLOR_GLASS_DEEP).lerp(COLOR_GLASS_SLATE, 0.5);
        } else if (wy >= 2.5) {
          // CÁC TÒA CAO ỐC CHỌC TRỜI: Kính kiến trúc PBR chuẩn
          if (bldgSeed > 0.7) {
            targetColor.copy(COLOR_GLASS_SLATE);
          } else if (bldgSeed > 0.4) {
            targetColor.copy(COLOR_GLASS_SKY);
          } else if (bldgSeed > 0.2) {
            targetColor.copy(COLOR_GLASS_EMERALD);
          } else {
            targetColor.copy(COLOR_GLASS_DEEP);
          }
        } else if (wy >= 1.35) {
          // TÒA NHÀ TRUNG TẦNG (10-25 tầng)
          const facadeIdx = Math.floor(bldgSeed * DAY_FACADE_PALETTE.length);
          targetColor.copy(DAY_FACADE_PALETTE[facadeIdx]);
        } else {
          // KHU PHỐ THẤP TẦNG & BIỆT THỰ SÀI GÒN
          const facadeIdx = Math.floor(bldgSeed * DAY_FACADE_PALETTE.length);
          targetColor.copy(DAY_FACADE_PALETTE[facadeIdx]);
          // Subtle orientation contrast (mặt đón nắng sáng hơn mặt khuất)
          const sunShade = (nx * 0.05 + nz * 0.03);
          targetColor.offsetHSL(0, 0, sunShade);
        }
      }
      break;
    }

    case "sunset": {
      // Hoàng hôn trên sông Sài Gòn: Ánh đồng, hổ phách ấm áp
      if (isUp) {
        if (wy < 0.44) {
          targetColor.set("#82543e"); // Nước sông phản chiếu ánh chiều tà
        } else if (wy < 0.88) {
          targetColor.set("#382e35"); // Bóng râm trên mặt đường
        } else if (wy >= 2.5) {
          targetColor.set("#e2b58e");
        } else {
          targetColor.set(bldgSeed > 0.6 ? "#a15942" : "#7d6f78");
        }
      } else {
        if (distToBitexco < 1.8 && wy >= 1.5) {
          targetColor.set("#c77f52");
        } else if (wy >= 2.5) {
          targetColor.set(bldgSeed > 0.5 ? "#b86b45" : "#7d5568");
        } else {
          targetColor.set(bldgSeed > 0.5 ? "#c98f65" : "#94766b");
        }
      }
      break;
    }

    case "cyberpunk": {
      // Đêm Sài Gòn hiện đại
      if (isUp) {
        if (wy < 0.44) {
          targetColor.set("#081220");
        } else if (wy < 0.88) {
          targetColor.set("#0d0f17");
        } else if (wy >= 2.5) {
          targetColor.set("#00f0ff");
        } else {
          targetColor.set("#151824");
        }
      } else {
        if (distToBitexco < 1.8 && wy >= 1.5) {
          targetColor.set("#00f5d4");
        } else if (wy >= 2.5) {
          const band = Math.sin(wy * 20.0);
          targetColor.set(band > 0.6 ? "#00f0ff" : band < -0.6 ? "#f72585" : "#111827");
        } else {
          targetColor.set(bldgSeed > 0.6 ? "#201a35" : "#131622");
        }
      }
      break;
    }

    case "blueprint": {
      // Bản đồ quy hoạch đô thị tối giản
      if (isUp) {
        if (wy < 0.44) {
          targetColor.set("#0284c7");
        } else if (wy < 0.88) {
          targetColor.set("#1e293b");
        } else if (wy >= 2.5) {
          targetColor.set("#60a5fa");
        } else {
          targetColor.set("#475569");
        }
      } else {
        if (wy >= 2.5) {
          targetColor.set("#2563eb");
        } else if (wy >= 1.35) {
          targetColor.set("#94a3b8");
        } else {
          targetColor.set("#cbd5e1");
        }
      }
      break;
    }
  }
}

export function applyCityTheme(scene: THREE.Object3D, theme: HCMThemeId): void {
  scene.updateMatrixWorld(true);

  const centerOffsetX = 27.756;
  const centerOffsetY = 0.0;
  const centerOffsetZ = -24.365;

  const tempV = new THREE.Vector3();
  const tempN = new THREE.Vector3();
  const tempColor = new THREE.Color();
  const normalMatrix = new THREE.Matrix3();

  scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const geo = mesh.geometry;
      const posAttr = geo.attributes.position;
      const normAttr = geo.attributes.normal;

      if (!posAttr) return;

      const vertexCount = posAttr.count;
      let colorAttr = geo.attributes.color as THREE.BufferAttribute | undefined;

      if (!colorAttr || colorAttr.count !== vertexCount) {
        colorAttr = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
        geo.setAttribute("color", colorAttr);
      }

      const colors = colorAttr.array as Float32Array;
      normalMatrix.getNormalMatrix(mesh.matrixWorld);

      for (let i = 0; i < vertexCount; i++) {
        tempV.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        tempV.applyMatrix4(mesh.matrixWorld);

        const wx = tempV.x - centerOffsetX;
        const wy = tempV.y - centerOffsetY;
        const wz = tempV.z - centerOffsetZ;

        if (normAttr) {
          tempN.set(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
          tempN.applyMatrix3(normalMatrix).normalize();
        } else {
          tempN.set(0, 1, 0);
        }

        computeVertexColor(wx, wy, wz, tempN.x, tempN.y, tempN.z, theme, tempColor);

        const i3 = i * 3;
        colors[i3] = tempColor.r;
        colors[i3 + 1] = tempColor.g;
        colors[i3 + 2] = tempColor.b;
      }

      colorAttr.needsUpdate = true;

      // Configure realistic PBR material
      let mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat || !mat.isMeshStandardMaterial) {
        mat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.55,
          metalness: 0.15,
          flatShading: false,
        });
        mesh.material = mat;
      } else {
        mat.vertexColors = true;
        mat.roughness = theme === "cyberpunk" ? 0.35 : 0.55;
        mat.metalness = theme === "cyberpunk" ? 0.25 : 0.15;
        mat.needsUpdate = true;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}
