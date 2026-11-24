import { strips } from "./q10-plan";
/** Local model axes: curb at X=0, median at X=-6.4. Not geodetic measurements.
 * Block rhythm, setbacks and silhouettes estimated from the two June 2024 views.
 * Camera origin is offset from the map POI (which denotes a building, not the lens).
 */
import type { districtFinishes } from "./q10-materials";
import * as T from "three";
import {
  box,
  plane,
  rod,
  tube,
  mesh,
  material,
  textLabel,
  label,
  write,
} from "./scene-kit";
import { rect, ROAD_WIDTH, type Solid } from "./boarding";
export const SURVEY = {
  width: ROAD_WIDTH,
  eye: [-7.57, 2.42, -22] as const,
  maps: "https://www.google.com/maps/search/?api=1&query=462+L%C3%BD+Th%C3%A1i+T%E1%BB%95%2C+V%C6%B0%E1%BB%9Dn+L%C3%A0i%2C+H%E1%BB%93+Ch%C3%AD+Minh",
  views: [
    { sign: 1, vanish: [0.545, 0.524] },
    { sign: -1, vanish: [0.435, 0.477] },
  ],
};
export function surveyCamera(cam: T.PerspectiveCamera, n: number, travel = 0) {
  const {
    sign,
    vanish: [u, v],
  } = SURVEY.views[n];
  const [x, y, z] = SURVEY.eye;
  cam.position.set(x, y, z + sign * travel);
  // The reference image uses cover in the wipe: account for cropping on wide or portrait screens.
  const photoAspect = n === 0 ? 3024 / 1676 : 3024 / 1648;
  const coverX = Math.max(1, photoAspect / cam.aspect),
    coverY = Math.max(1, cam.aspect / photoAspect);
  const tan = Math.tan(T.MathUtils.degToRad(cam.fov * 0.5));
  cam.rotation.set(
    Math.atan((v - 0.5) * 2 * coverY * tan),
    (sign > 0 ? Math.PI : 0) +
      Math.atan((u - 0.5) * 2 * coverX * tan * cam.aspect),
    0,
    "YXZ",
  );
}
/** Paving lines of the public footpath (m from the curb): the shop apron is laid out to this common edge. */
const APRON_EDGE = 2.0;
/** Apron pattern density (texture repeats per metre, both axes). */
const APRON_DENSITY = 0.66;

/**
 * The orange fan-pattern apron of one shop: from 0.9 m behind its front to the common line APRON_EDGE, so the edge stays
 * straight when the shop fronts are set back by different amounts, and the full shop width, so neighbours meet without gaps.
 * UVs follow world coordinates, so the pattern continues from shop to shop (the texture repeat is 1 in q10-materials.ts).
 */
function apron(g: T.Group, surface: T.Material, side: number, front: number, z: number, w: number) {
  const inner = front + side * 0.9;
  const outer = side > 0 ? APRON_EDGE : -SURVEY.width - APRON_EDGE;
  const length = Math.abs(inner - outer);
  if (length < 0.2) return;
  const geometry = new T.PlaneGeometry(1, 1);
  const uv = geometry.attributes.uv, pos = geometry.attributes.position;
  const cx = (inner + outer) / 2;
  for (let i = 0; i < pos.count; i++) {
    // The mesh is turned -90 degrees about X: local x is world x, local y is world -z.
    uv.setXY(i, (cx + pos.getX(i) * length) * APRON_DENSITY, -(z - pos.getY(i) * w) * APRON_DENSITY);
  }
  const item = mesh(g, geometry, surface, [cx, 0.167, z], false);
  item.scale.set(length, w, 1);
  item.rotation.set(-Math.PI / 2, 0, 0);
  item.receiveShadow = true;
}

export function makeSurveyKit(
  stucco: T.Texture,
  shops: T.MeshStandardMaterial[],
  finishes: ReturnType<typeof districtFinishes>,
  normalMap:T.Texture|null,
) {
  const wall = (col: number) =>
    new T.MeshStandardMaterial({ color: col, map: stucco, normalMap, normalScale:new T.Vector2(.38,.38), roughness: 0.86 });
  const cream = wall(0xf4eade),
    fog = wall(0xdce4df),
    terracotta = wall(0xc96049),
    brick = wall(0x914c41);
  const steel = material(0x6d7672, 0.45, 0.45),
    dark = material(0x303534, 0.6, 0.22),
    glazing = material(0x3a5664, 0.22, 0.4),
    door = material(0x728997, 0.62, 0.27),
    shade = material(0x272e2a),
    ochre = material(0xc99b45, 0.66),
    awning = material(0xbcb7a4);
  const mint = wall(0xa4c8b5),
    butter = wall(0xe2cea1),
    inox = material(0xc5cccb, 0.33, 0.73);
  // Commercial layers are readable obliquely from the road: perpendicular
  // projecting cabinets, a display plinth & shelving in the deep, shaded bay.
  const display = label(384, 192, (c) => {
    c.fillStyle = "#242627";
    c.fillRect(0, 0, 384, 192);
    for (let i = 0; i < 7; i++) {
      let x = 12 + i * 53;
      c.fillStyle = "#b4b7b2";
      c.fillRect(x, 46, 35, 76);
      c.fillStyle = ["#4b98a5", "#907480", "#688480"][i % 3];
      c.fillRect(x + 3, 50, 29, 61);
      c.fillStyle = "#e5c7a0";
      c.fillRect(x - 1, 137, 40, 14);
    }
    c.fillStyle = "#c4c4ba";
    c.fillRect(0, 156, 384, 5);
  });
  const tile = label(256, 128, (c) => {
    c.fillStyle = "#adaea2";
    c.fillRect(0, 0, 256, 128);
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 4; i++) {
        c.fillStyle = (i + j) % 3 === 0 ? "#d7ded3" : "#e3e6dd";
        c.fillRect(i * 64 + 1, j * 64 + 1, 62, 62);
        c.fillStyle = "#f2f1e7";
        c.fillRect(i * 64 + 2, j * 64 + 2, 59, 2);
      }
  });
  const phoneBlade = textLabel("360", "#d49822", "#27282a", 256, 128, 90);
  const kitchenBlade = textLabel("BẾP", "#8f352c", "#ebd8b1", 256, 128, 84);
  const phone = label(1024, 250, (c) => {
    c.fillStyle = "#dc971e";
    c.fillRect(0, 0, 1024, 250);
    write(c, "DIDONG360", 512, 125, 110, "#292322", 800, "center");
    for (const [i, t] of ["ĐIỆN THOẠI", "MÁY TÍNH BẢNG", "TRẢ GÓP"].entries()) {
      c.fillStyle = "#efe8d7";
      c.fillRect(75 + 310 * i, 166, 240, 46);
      write(c, t, 195 + 310 * i, 198, 26, "#423526", 700, "center");
    }
  });
  const kitchen=label(768,208,c=>{c.fillStyle='#923325';c.fillRect(0,0,768,208);write(c,'BẾP',384,121,106,'#f3e4ce',800,'center');c.fillStyle='#753325';c.fillRect(0,147,768,61);write(c,'THIẾT BỊ NHÀ BẾP',384,190,30,'#ecbd73',700,'center');});
  function block(
    index: number,
    start: number,
    side: number,
    near: T.Group,
    far: T.Group,
    solids: Solid[],
  ) {
    const strip = strips[index];
    if (!strip) return false;
    let edge = start;
    for (const [w, h, k, setback] of strip[side === 1 ? 0 : 1]) {
      const z = edge + w / 2;
      edge += w;
      const front = (side > 0 ? 4.85 : -SURVEY.width - 3.85) + side * setback,
        face = (d: number) => front - side * d,
        yaw = (-side * Math.PI) / 2;
      const bx = (
        g: T.Group,
        d: number,
        y: number,
        off: number,
        depth: number,
        height: number,
        width: number,
        m: T.Material,
      ) => box(g, [face(d), y, z + off], [depth, height, width], m);
      const pl = (
        g: T.Group,
        d: number,
        y: number,
        off: number,
        width: number,
        height: number,
        m: T.Material,
      ) => plane(g, [face(d), y, z + off], [width, height], m, yaw);
      const wallMat =
        k === "loggia"
          ? index % 2 === 0
            ? mint
            : butter
          : k === "blade"
            ? brick
            : k === "crest"
              ? terracotta
              : k === "balcony"
                ? cream
                : fog;
      for (const g of [near, far]) {
        const low = g === far;
        apron(g, finishes.apron, side, front, z, w);
        if (k === "hem") {
          const openToBoardingHouse = index === 8 && side === 1;
          // A passage between party walls; Block 8 East opens seamlessly into Dãy Trọ 462/14.
          bx(g, -4.2, 0.143, 0, 8.5, 0.035, w, shade);
          if (!openToBoardingHouse) bx(g, -9, 2.2, 0, 0.28, 4.4, w, mint);
          for (const f of [-1, 1]) {
            bx(g, -4, 2.82, w * f * 0.49, 8.6, 5.64, 0.14, wallMat);
            bx(g, -3.7, 1.35, w * f * 0.46, 8.2, 0.12, 0.09, steel);
          }
          if (!openToBoardingHouse) bx(g, -7, 1.85, w * 0.25, 0.22, 3.7, w * 0.55, door);
          if (!low) {
            for (const d of [1.8, 4.9]) bx(g, -d, 3.3, 0, 0.045, 0.04, w, dark);
          }
          continue;
        }
        if (k !== "gate" && !low) {
          for (const f of [-0.471, 0.471]) {
            bx(g, -0.6, 0.79, w * f, 1.55, 1.23, 0.105, tile);
            bx(g, 0.19, 0.79, w * f, 0.1, 1.23, 0.23, tile);
          }
        }
        if (k === "gate") {
          // Recessed building behind masonry piers, not another shop window.
          bx(g, -6.4, 3, 0, 6.5, 6, w - 0.12, cream);
          bx(g, 0.02, 0.32, 0, 0.24, 0.5, w, cream);
          for (const f of [-0.48, 0, 0.48])
            bx(g, 0, 1.28, w * f, 0.36, 2.34, 0.32, fog);
          for (const y of [0.66, 2.16])
            bx(g, 0, y, 0, 0.07, 0.08, w - 0.2, dark);
          for (let t = -w / 2 + 0.19; t < w / 2; t += low ? 0.36 : 0.15)
            bx(g, 0, 1.39, t, 0.044, 1.55, 0.045, dark);
          continue;
        }
        // Step the main mass back behind an open shop bay. Deep canopy creates a real soffit shadow.
        // Keep Block 8 East rear wall cleanly flush behind Dãy Trọ 462/14's west wall (x = 13.25) so ZERO geometry pokes into the courtyard!
        const massDepth = index === 8 && side === 1 ? Math.max(4.5, 13.1 - (front + 1.4)) : 7.8;
        const massOffset = -(1.4 + massDepth * 0.5);
        bx(g, massOffset, h / 2, 0, massDepth, h, w - 0.055, wallMat);
        const recessed = k === "loggia";
        if (recessed) {
          for (const f of [-1, 1])
            bx(
              g,
              -0.63,
              (h + 3.25) / 2,
              w * f * 0.475,
              1.59,
              h - 3.25,
              0.19,
              wallMat,
            );
        } else
          bx(g, -0.64, (h + 3.25) / 2, 0, 1.55, h - 3.25, w - 0.055, wallMat);
        const counter = k === "phone" || k === "kitchen";
        pl(
          g,
          -1.375,
          1.65,
          0,
          w - 0.22,
          2.94,
          k === "phone" ? finishes.phones : counter || k === "awning" || k === "loggia"
            ? finishes.interior
            : shops[index % 2],
        );
        for (const off of [-w * 0.475, w * 0.475])
          bx(g, 0.02, 1.72, off, 0.3, 3.15, 0.2, wallMat);
        if (counter) {
          const bladeZ = z + w * 0.435,
            blade = k === "phone" ? phoneBlade : kitchenBlade;
          box(
            g,
            [face(1.34), 3.58, bladeZ],
            [1.11, 0.69, 0.123],
            k === "phone" ? ochre : brick,
          );
          for (const f of [-1, 1])
            plane(
              g,
              [face(1.34), 3.58, bladeZ + f * 0.063],
              [1.08, 0.65],
              blade,
              f > 0 ? 0 : Math.PI,
            );
          bx(g, 0.65, 3.78, w * 0.435, 1.43, 0.054, 0.055, steel);
          bx(
            g,
            0.16,
            3.85,
            0,
            0.36,
            1.8,
            w - 0.06,
            k === "phone" ? ochre : brick,
          );
          pl(g, 0.345, 3.85, 0, w - 0.12, 1.7, k === "phone" ? phone : kitchen);
          if (!low) {
            for (const dz of [-0.34, 0.31]) {
              bx(g, -0.63, 0.61, w * dz, 0.54, 0.82, w * 0.27, steel);
              bx(g, -0.63, 1.11, w * dz, 0.52, 0.19, w * 0.27, glazing);
              if (k === "phone")
                pl(g, -0.35, 0.77, w * dz, w * 0.24, 0.39, display);
              else {
                bx(g, -0.61, 1.36, w * dz, 0.41, 0.33, w * 0.17, dark);
                bx(g, -0.61, 1.54, w * dz, 0.44, 0.035, w * 0.18, steel);
              }
            }
            bx(g, 0.35, 2.94, 0, 1.35, 0.15, w, cream);
          }
        } else if (k === "shutter") {
          bx(g, -0.26, 1.64, 0, 0.13, 2.97, w - 0.37, door);
          for (let y = 0.34; y < 2.99; y += low ? 0.4 : 0.16)
            bx(g, -0.17, y, 0, 0.035, 0.022, w - 0.4, steel);
        } else {
          const depth = k === "awning" ? 2.48 : 1.5;
          const lip = bx(
            g,
            depth * 0.47,
            2.96,
            0,
            depth,
            0.09,
            w - 0.06,
            k === "awning" ? finishes.cloth : awning,
          );
          if (k === "awning") {
            bx(g, depth * 0.95, 2.75, 0, 0.055, 0.24, w - 0.09, finishes.cloth);
            if (!low)
              for (const f of [-0.42, 0.42])
                rod(
                  g,
                  [face(0.06), 2.45, z + w * f],
                  [face(depth * 0.91), 2.8, z + w * f],
                  0.023,
                  steel,
                );
          }
          lip.rotation.z = side * 0.11;
        }
        if (recessed) {
          // Stack habitable loggias with deep shade, perforated claustra and a stepped terrace.
          for (let y = 3.27; y < h - 0.95; y += 2.9) {
            bx(g, -0.42, y, 0, 2.05, 0.19, w, wallMat);
            pl(g, -1.37, y + 1.39, 0, w - 0.3, 2.59, finishes.loggia);
            const scr = pl(
              g,
              0.47,
              y + 0.65,
              w * 0.16,
              w * 0.58,
              1.14,
              finishes.lattice,
            );
            scr.castShadow = true;
            bx(g, 0.49, y + 1.25, 0, 0.14, 0.08, w - 0.12, cream);
            if (!low)
              for (const f of [-0.46, -0.31, -0.18, 0.44])
                bx(g, 0.48, y + 0.64, w * f, 0.036, 1.23, 0.042, steel);
          }
          bx(g, -2.05, h + 0.35, w * 0.15, 2.9, 0.96, w * 0.63, wallMat);
          const d = face(-2.8);
          rod(
            g,
            [d, h + 0.58, z - 0.28],
            [d, h + 0.58, z + 0.92],
            0.46,
            inox,
            0.46,
            16,
          );
          if (!low)
            for (const ofz of [-0.22, 0.14, 0.53, 0.86])
              rod(
                g,
                [d, h + 0.58, z + ofz],
                [d, h + 0.58, z + ofz + 0.033],
                0.48,
                steel,
                0.48,
                16,
              );
        } else if (k === "office") {
          for (let y = 4.75; y < h - 0.65; y += 2.7) {
            pl(g, 0.145, y, 0, w * 0.82, 1.28, glazing);
            for (const f of [-0.32, -0.12, 0.12, 0.32])
              bx(g, 0.17, y, w * f, 0.09, 1.3, 0.12, cream);
          }
        } else if (k === "blade") {
          pl(g, 0.15, (h + 4.2) / 2, 0, w * 0.85, h - 4.65, glazing);
          for (const f of [-0.42, -0.15, 0.14, 0.42])
            bx(g, 0.32, (h + 4.15) / 2, w * f, 0.49, h - 4.15, 0.3, brick);
        } else if (k === "crest") {
          bx(g, -0.35, h + 0.36, 0, 0.98, 0.73, w, fog);
          bx(g, -1.6, h + 1.0, 0, 3.4, 1.08, w * 0.89, terracotta);
          for (let t = -0.33; t <= 0.34; t += 0.14)
            bx(g, 0.15, h - 0.81, t * w, 0.07, 1.05, 0.18, shade);
        } else if (k === "balcony") {
          for (let y = 4.6; y < h - 1; y += 2.8) {
            pl(g, 0.145, y, 0, w - 0.3, 2.63, finishes.loggia);
            bx(g, 0.55, y - 0.97, 0, 1.05, 0.14, w - 0.12, cream);
            bx(g, 1.0, y - 0.23, 0, 0.045, 0.055, w - 0.21, steel);
            if (!low)
              for (let t = -0.42; t <= 0.43; t += 0.085)
                bx(g, 1.0, y - 0.59, t * w, 0.03, 0.73, 0.032, steel);
          }
        } else if(k==='kitchen'){
          pl(g,.15,(h+4.9)/2,-w*.09,w*.64,h-5.15,finishes.loggia);
          const shutter=pl(g,.46,(h+4.9)/2,w*.32,w*.21,h-5.12,finishes.lattice);shutter.castShadow=true;
          bx(g,.61,4.91,0,1.13,.16,w,brick);bx(g,1.05,5.42,0,.12,.47,w,wallMat);
        } else if (counter) {
          // Street shop below an occupied, sun-screened mezzanine rather than a blank wall.
          pl(g, 0.15, (h + 4.9) / 2, 0, w - 0.48, h - 4.95, finishes.loggia);
          for (const f of [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45]) {
            const fin = bx(
              g,
              0.34,
              (h + 4.9) / 2,
              w * f,
              0.47,
              h - 4.95,
              0.08,
              cream,
            );
            fin.rotation.y = side * 0.38;
          }
          bx(g, 0.38, h - 0.24, 0, 0.64, 0.095, w - 0.16, cream);
        } else if (h > 6.1) {
          pl(g, 0.145, (h + 4.8) / 2, 0, w * 0.72, 1.42, glazing);
          for (let i = -1; i <= 1; i++)
            bx(g, 0.17, (h + 4.8) / 2, i * w * 0.23, 0.1, 1.44, 0.065, cream);
        }
        if (!low && (counter || recessed || k === "crest")) {
          const pz = w * 0.415;
          rod(
            g,
            [face(0.23), 0.23, z + pz],
            [face(0.23), h + 0.06, z + pz],
            0.052,
            steel,
            0.052,
            8,
          );
          bx(g, 0.33, 4.78, -w * 0.35, 0.39, 0.48, 0.74, cream);
          for (let i = 0; i < 6; i++)
            bx(g, 0.54, 4.6 + i * 0.067, -w * 0.35, 0.018, 0.025, 0.6, steel);
        }
        bx(g, 0.14, h - 0.04, 0, 0.44, 0.16, w + 0.04, cream);
      }
      if (k === "hem") {
        const openToBoardingHouse = index === 8 && side === 1;
        for (const f of [-1, 1])
          solids.push(rect(face(-4), z + w * f * 0.49, 8.6, 0.14));
        if (!openToBoardingHouse) solids.push(rect(face(-7), z, 0.27, w));
      } else {
        solids.push(rect(front + side * 5.3, z, 7.8, w));
        if (k === "shutter") solids.push(rect(face(-0.26), z, 0.13, w - 0.37));
        if (k !== "gate")
          for (const f of [-0.475, 0.475])
            solids.push(rect(face(0.02), z + w * f, 0.3, 0.2));
      }
      if (k === "gate") solids.push(rect(front, z, 0.32, w));
    }
    return true;
  }
  function lampPost(g: T.Group, x: number, z: number, side: number) {
    rod(g, [x, 0.16, z], [x, 6.8, z], 0.095, steel, 0.055, 10);
    tube(
      g,
      [
        [x, 6.76, z],
        [x - side * 0.05, 7.6, z],
        [x - side * 0.52, 8.02, z],
        [x - side * 2.9, 8.3, z],
      ],
      0.049,
      steel,
      14,
    );
    bxLamp();
    function bxLamp() {
      box(g, [x - side * 3.18, 8.31, z], [0.74, 0.105, 0.22], steel);
    }
  }
  const lit=[phone,kitchen,phoneBlade,kitchenBlade,display,finishes.phones,finishes.interior];
  for(const m of lit)if(m instanceof T.MeshStandardMaterial){m.emissiveMap=m.map;m.emissive.set(0xffe3be);}
  return { block, lampPost, lights(level:number){for(const m of lit)if(m instanceof T.MeshStandardMaterial)m.emissiveIntensity=.035+level*(m===finishes.interior||m===finishes.phones?.75:1.35);} };
}
// Vehicle silhouettes which set the scale in the west-facing photo. Local nose = -Z.
export function deliveryVehicle(cargo: boolean) {
  const g = new T.Group();
  const paint = material(0xe4e3db, 0.47, 0.18),
    al = material(0xb3b5b4, 0.38, 0.62),
    seal = material(0x252b2b, 0.67, 0.08),
    glass = material(0x43585c, 0.17, 0.43),
    red = material(0xb94c3d),
    rim = material(0x92979a, 0.4, 0.7);
  const b = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    l: number,
    m: T.Material,
  ) => box(g, [x, y, z], [w, h, l], m);
  const length = cargo ? 5.3 : 4.5,
    front = -length / 2;
  b(0, 0.63, 0, 1.7, 0.41, length, seal);
  b(0, 1.02, front + 0.76, 1.82, 0.72, 1.5, paint);
  b(0, 1.64, front + 0.85, 1.72, 0.72, 1.36, glass);
  b(0, 2.04, front + 0.9, 1.82, 0.13, 1.45, paint);
  for (const s of [-1, 1]) {
    for (const z of [front + 0.26, front + 1.48])
      b(s * 0.845, 1.7, z, 0.09, 0.7, 0.095, paint);
    b(s * 0.54, 0.97, front - 0.013, 0.44, 0.14, 0.036, al);
  }
  const back = length / 2;
  if (cargo) {
    b(0, 1.76, 0.78, 2, 2.04, length - 1.5, al);
    for (const s of [-1, 1]) {
      for (let y = 0.84; y < 2.75; y += 0.088)
        b(s * 1.009, y, 0.78, 0.028, 0.025, length - 1.55, rim);
      b(s * 0.48, 1.75, back + 0.028, 0.92, 1.94, 0.055, al);
      b(s * 0.36, 1.77, back + 0.08, 0.044, 1.93, 0.055, rim);
      b(s * 0.4, 1.4, back + 0.12, 0.21, 0.05, 0.06, seal);
      for (const y of [0.96, 1.53, 2.54])
        b(s * 0.85, y, back + 0.07, 0.17, 0.067, 0.043, seal);
      for (const y of [0.86, 2.69])
        b(s * 0.48, y, back + 0.07, 0.89, 0.06, 0.06, rim);
      b(s * 0.72, 0.72, back + 0.06, 0.24, 0.11, 0.06, red);
    }
  }
  if (cargo) {
    const id = label(180, 150, (c) => {
      c.clearRect(0, 0, 180, 150);
      write(c, "51C", 90, 62, 48, "#253f72", 800, "center");
      write(c, "553.36", 90, 125, 42, "#253f72", 800, "center");
    });
    id.transparent = true;
    plane(g, [-0.48, 1.61, back + 0.081], [0.48, 0.38], id);
  } else {
    b(0, 1.35, 0.68, 1.82, 1.33, length - 1.3, paint);
    b(0, 2.03, 0.68, 1.76, 0.12, length - 1.31, paint);
    b(0, 1.69, back + 0.034, 1.58, 0.54, 0.035, glass);
  }
  for (const s of [-1, 1])
    for (const z of [front + 0.83, back - 0.8]) {
      const wheel = mesh(
        g,
        new T.CylinderGeometry(0.365, 0.365, 0.23, 16),
        seal,
        [s * 0.875, 0.371, z],
      );
      wheel.rotation.z = Math.PI / 2;
      const hub = mesh(g, new T.CylinderGeometry(0.19, 0.19, 0.025, 12), rim, [
        s * 1.0,
        0.371,
        z,
      ]);
      hub.rotation.z = Math.PI / 2;
    }
  return g;
}
