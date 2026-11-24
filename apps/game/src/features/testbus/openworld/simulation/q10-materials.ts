import * as T from "three";
import { asset, canvasTexture, random, label } from "./scene-kit";

/** Build once per street, share across lots & LODs. Physical-scale chips + fan grooves
 * for the private shop apron; the public footpath retains the older concrete slabs. */
export function districtFinishes(loader: T.TextureLoader) {
  const photo = (file: string, color: number) => {
    const map = loader.load(asset(`survey/${file}.jpg`));
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    return new T.MeshStandardMaterial({ map, color, roughness: 0.83 });
  };
  const loggia = photo("loggia-q10", 0xe1dfcd),
    phones = photo("phone-bay-q10", 0xe8e2d8),
    interior = photo("shop-bay-q10", 0xcfcac1);
  const rng = random(462);
  const apron = label(384, 384, (c) => {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const x = i * 96,
          y = j * 96,
          l = 117 + rng() * 19;
        c.fillStyle = `rgb(${l + 22},${l - 3},${l - 16})`;
        c.fillRect(x, y, 96, 96);
        c.save();
        c.beginPath();
        c.rect(x, y, 96, 96);
        c.clip();
        for (let r = 13; r < 136; r += 16) {
          c.beginPath();
          c.arc(x + (j % 2) * 96, y, r, 0, Math.PI);
          c.strokeStyle = "#76695b";
          c.lineWidth = 2;
          c.stroke();
          c.beginPath();
          c.arc(x + (j % 2) * 96, y, r + 2, 0, Math.PI);
          c.strokeStyle = "#b4a28d";
          c.lineWidth = 1;
          c.stroke();
        }
        c.restore();
        c.strokeStyle = "#6e6a5e";
        c.strokeRect(x + 1, y + 1, 95, 95);
      }
    for (let i = 0; i < 17000; i++) {
      c.fillStyle = rng() > 0.45 ? "#ddd1b940" : "#433e3529";
      c.fillRect(rng() * 384, rng() * 384, 1 + rng() * 2, 1.5);
    }
  }) as T.MeshStandardMaterial;
  apron.map!.wrapS = apron.map!.wrapT = T.RepeatWrapping;
  // One repeat per UV unit: survey462.ts sets the UVs from world coordinates (0.66 repeats per metre).
  apron.map!.repeat.set(1, 1);
  apron.map!.anisotropy = 4;
  apron.bumpMap = apron.map;
  apron.bumpScale = 0.014;
  const cloth = label(512, 128, (c) => {
    c.fillStyle = "#d8cfab";
    c.fillRect(0, 0, 512, 128);
    for (let x = 0; x < 512; x += 32) {
      c.fillStyle = "#457c83";
      c.fillRect(x, 0, 18, 128);
      c.fillStyle = "#81a39d";
      c.fillRect(x + 20, 0, 3, 128);
    }
    for (let x = 0; x < 512; x += 4) {
      c.fillStyle = `rgba(75,63,48,${rng() * 0.16})`;
      c.fillRect(x, 0, 2, 128);
    }
  });
  const screen = canvasTexture(128, 128, (c) => {
    c.fillStyle = "#dcd1b4";
    c.fillRect(0, 0, 128, 128);
    for (const x of [32, 96])
      for (const y of [32, 96]) {
        c.save();
        c.translate(x, y);
        c.rotate(Math.PI / 4);
        c.clearRect(-19, -19, 38, 38);
        c.strokeStyle = "#91876e";
        c.lineWidth = 4;
        c.strokeRect(-20, -20, 40, 40);
        c.restore();
      }
    c.strokeStyle = "#a79e8b";
    c.lineWidth = 3;
    c.strokeRect(1, 1, 126, 126);
  });
  screen.wrapS = screen.wrapT = T.RepeatWrapping;
  screen.repeat.set(5, 3);
  const lattice = new T.MeshStandardMaterial({
    map: screen,
    side: T.DoubleSide,
    alphaTest: 0.48,
    roughness: 0.94,
  });
  return { loggia, phones, interior, apron, cloth, lattice };
}
