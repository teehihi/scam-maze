import * as THREE from 'three';
import { SeededRNG } from '../math/Noise';

const plankGeometry = new THREE.BoxGeometry(1, 1, 1);
const ribGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 5, 1, false);
ribGeometry.rotateZ(Math.PI / 2);

function applyInstance(
  mesh: THREE.InstancedMesh,
  index: number,
  position: THREE.Vector3,
  rotation: THREE.Euler,
  scale: THREE.Vector3,
  color: THREE.Color,
) {
  const dummy = new THREE.Object3D();
  dummy.position.copy(position);
  dummy.rotation.copy(rotation);
  dummy.scale.copy(scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  mesh.setColorAt(index, color);
}

/**
 * Real individual boards rather than a plank texture on a box. Each board has
 * a minute height, yaw and tonal offset; the narrow dark intervals are actual
 * shadowed gaps, so grazing light reveals construction instead of a print.
 */
export function createPlankSurface(options: {
  width: number;
  depth: number;
  plankWidth?: number;
  thickness?: number;
  material: THREE.Material;
  along?: 'x' | 'z';
  seed?: number;
  toneVariation?: number;
}): THREE.InstancedMesh {
  const plankWidth = options.plankWidth ?? 0.3;
  const thickness = options.thickness ?? 0.09;
  const along = options.along ?? 'x';
  const spanAcross = along === 'x' ? options.depth : options.width;
  const length = along === 'x' ? options.width : options.depth;
  const count = Math.max(1, Math.ceil(spanAcross / plankWidth));
  const mesh = new THREE.InstancedMesh(plankGeometry, options.material, count);
  const rng = new SeededRNG(options.seed ?? 1234);
  const baseColor = new THREE.Color(1, 1, 1);

  for (let i = 0; i < count; i++) {
    const across = -spanAcross / 2 + plankWidth * (i + 0.5);
    const tone = 1 + rng.range(-1, 1) * (options.toneVariation ?? 0.09);
    const color = baseColor.clone().multiplyScalar(tone);
    const pos =
      along === 'x'
        ? new THREE.Vector3(rng.range(-0.012, 0.012), rng.range(-0.006, 0.006), across)
        : new THREE.Vector3(across, rng.range(-0.006, 0.006), rng.range(-0.012, 0.012));
    const scale =
      along === 'x'
        ? new THREE.Vector3(length * rng.range(0.985, 1.0), thickness, plankWidth * 0.91)
        : new THREE.Vector3(plankWidth * 0.91, thickness, length * rng.range(0.985, 1.0));
    const rot =
      along === 'x'
        ? new THREE.Euler(rng.range(-0.004, 0.004), rng.range(-0.003, 0.003), rng.range(-0.004, 0.004))
        : new THREE.Euler(rng.range(-0.004, 0.004), rng.range(-0.003, 0.003), rng.range(-0.004, 0.004));
    applyInstance(mesh, i, pos, rot, scale, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'IndividualPlankSurface';
  return mesh;
}

export function createPlankWall(options: {
  width: number;
  height: number;
  plankHeight?: number;
  thickness?: number;
  material: THREE.Material;
  seed?: number;
  vertical?: boolean;
}): THREE.InstancedMesh {
  const plankHeight = options.plankHeight ?? 0.27;
  const count = Math.max(1, Math.ceil((options.vertical ? options.width : options.height) / plankHeight));
  const mesh = new THREE.InstancedMesh(plankGeometry, options.material, count);
  const rng = new SeededRNG(options.seed ?? 924);
  for (let i = 0; i < count; i++) {
    const tone = 1 + rng.range(-0.11, 0.11);
    const color = new THREE.Color(tone, tone * rng.range(0.96, 1.02), tone * rng.range(0.92, 1.0));
    let pos: THREE.Vector3;
    let scale: THREE.Vector3;
    if (options.vertical) {
      pos = new THREE.Vector3(
        -options.width / 2 + plankHeight * (i + 0.5),
        rng.range(-0.008, 0.008),
        rng.range(-0.006, 0.006),
      );
      scale = new THREE.Vector3(plankHeight * 0.9, options.height * rng.range(0.99, 1.0), options.thickness ?? 0.09);
    } else {
      pos = new THREE.Vector3(
        rng.range(-0.008, 0.008),
        -options.height / 2 + plankHeight * (i + 0.5),
        rng.range(-0.006, 0.006),
      );
      scale = new THREE.Vector3(options.width * rng.range(0.99, 1.0), plankHeight * 0.9, options.thickness ?? 0.09);
    }
    applyInstance(
      mesh,
      i,
      pos,
      new THREE.Euler(0, 0, rng.range(-0.003, 0.003)),
      scale,
      color,
    );
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = 'IndividualPlankWall';
  return mesh;
}

/**
 * Raised half-round ribs for a roof slope. Add as a child of the slope mesh:
 * local X follows the slope length and local Z crosses the roof.
 */
export function createRoofRibs(options: {
  slopeLength: number;
  roofDepth: number;
  spacing?: number;
  radius?: number;
  material: THREE.Material;
  y?: number;
}): THREE.InstancedMesh {
  const spacing = options.spacing ?? 0.46;
  const count = Math.max(2, Math.floor(options.roofDepth / spacing));
  const mesh = new THREE.InstancedMesh(ribGeometry, options.material, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(0, options.y ?? 0.1, -options.roofDepth / 2 + spacing * (i + 0.5));
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(options.slopeLength * 0.985, options.radius ?? 0.075, options.radius ?? 0.075);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = 'RaisedRoofTileRibs';
  return mesh;
}

/** Horizontal louvre panel whose width runs along local Z. */
export function createLouverPanel(options: {
  width: number;
  height: number;
  count?: number;
  material: THREE.Material;
  frameMaterial?: THREE.Material;
}): THREE.Group {
  const group = new THREE.Group();
  const count = options.count ?? 9;
  const slatGeo = new THREE.BoxGeometry(0.045, 0.105, options.width * 0.94);
  const slats = new THREE.InstancedMesh(slatGeo, options.material, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(0, -options.height / 2 + (i + 0.5) * (options.height / count), 0);
    dummy.rotation.set(0, 0, -0.58);
    dummy.updateMatrix();
    slats.setMatrixAt(i, dummy.matrix);
  }
  slats.instanceMatrix.needsUpdate = true;
  slats.castShadow = false;
  slats.receiveShadow = true;
  group.add(slats);

  if (options.frameMaterial) {
    const frameMat = options.frameMaterial;
    const sideGeo = new THREE.BoxGeometry(0.07, options.height, 0.07);
    for (const side of [-1, 1]) {
      const sideMesh = new THREE.Mesh(sideGeo, frameMat);
      sideMesh.position.set(0, 0, side * options.width * 0.5);
      group.add(sideMesh);
    }
    const railGeo = new THREE.BoxGeometry(0.07, 0.07, options.width + 0.07);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, frameMat);
      rail.position.set(0, side * options.height * 0.5, 0);
      group.add(rail);
    }
  }
  group.name = 'LouverPanel';
  return group;
}

export function createWaterlineCollar(radius = 0.14): THREE.Mesh {
  const geo = new THREE.TorusGeometry(radius, 0.038, 6, 14);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x24351e,
    roughness: 0.96,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'TidalAlgaeCollar';
  return mesh;
}

export function createRopeCurve(
  start: THREE.Vector3,
  end: THREE.Vector3,
  sag = 0.35,
  material: THREE.Material,
  radius = 0.018,
): THREE.Mesh {
  const midA = start.clone().lerp(end, 0.33);
  midA.y -= sag;
  const midB = start.clone().lerp(end, 0.72);
  midB.y -= sag * 0.82;
  const curve = new THREE.CatmullRomCurve3([start, midA, midB, end]);
  const geo = new THREE.TubeGeometry(curve, 14, radius, 5, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.name = 'SaggingRope';
  return mesh;
}

let stainTexture: THREE.CanvasTexture | null = null;
function getStainTexture(): THREE.CanvasTexture {
  if (stainTexture) return stainTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  const rng = new SeededRNG(4412);
  for (let i = 0; i < 46; i++) {
    const x = 42 + rng.next() * 172;
    const y = 30 + rng.next() * 205;
    const r = 12 + rng.next() * 58;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(24,22,14,${0.10 + rng.next() * 0.16})`);
    grad.addColorStop(0.62, `rgba(30,28,16,${0.05 + rng.next() * 0.08})`);
    grad.addColorStop(1, 'rgba(20,18,10,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r * rng.range(0.55, 1.25), r, rng.range(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
  // Fine downward rain streaks embedded in the decal alpha.
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#17150e';
  for (let i = 0; i < 34; i++) {
    const x = 24 + rng.next() * 208;
    ctx.lineWidth = rng.range(0.6, 2.2);
    ctx.beginPath();
    ctx.moveTo(x, rng.range(18, 90));
    ctx.lineTo(x + rng.range(-3, 3), rng.range(150, 246));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  stainTexture = new THREE.CanvasTexture(canvas);
  stainTexture.colorSpace = THREE.SRGBColorSpace;
  return stainTexture;
}

export function createStainDecal(
  width: number,
  height: number,
  opacity = 0.5,
  tint = 0x2b2417,
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: getStainTexture(),
    color: tint,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.renderOrder = 3;
  mesh.name = 'WeatherStainDecal';
  return mesh;
}
