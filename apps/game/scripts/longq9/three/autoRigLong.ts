import * as THREE from 'three';
import { CustomPoseAdjustments, PosePresetId } from '../types/scene';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Bone indices in our 17-bone humanoid rig
const BONE = {
  PELVIS: 0,
  SPINE: 1,
  CHEST: 2,
  NECK: 3,
  HEAD: 4,
  UPPER_ARM_L: 5,
  FORE_ARM_L: 6,
  HAND_L: 7,
  UPPER_ARM_R: 8,
  FORE_ARM_R: 9,
  HAND_R: 10,
  THIGH_L: 11,
  SHIN_L: 12,
  FOOT_L: 13,
  THIGH_R: 14,
  SHIN_R: 15,
  FOOT_R: 16,
} as const;

export interface RiggedChuLong {
  rootGroup: THREE.Group;
  skinnedMesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  skeletonHelper: THREE.SkeletonHelper;
  bones: THREE.Bone[];
  handAttachmentR: THREE.Group;
  handAttachmentL: THREE.Group;
  applyPose: (
    pose: PosePresetId,
    timeSec: number,
    adj: CustomPoseAdjustments,
    animateMotion: boolean
  ) => void;
  bakeCurrentPoseToMesh: () => THREE.Mesh;
}

export function createRiggedChuLong(
  baseGeometry: THREE.BufferGeometry,
  baseMaterial: THREE.MeshStandardMaterial
): RiggedChuLong {
  const geom = baseGeometry.clone();
  const posAttr = geom.getAttribute('position');
  const vertCount = posAttr.count;

  // Exact anatomical landmarks in meter space (standing height = 1.704m, facing +Z, +X = Left)
  const worldJoints: [string, number, [number, number, number]][] = [
    ['Pelvis', -1, [0, 0.777, 0.005]],
    ['Spine', BONE.PELVIS, [0, 0.918, 0.008]],
    ['Chest', BONE.SPINE, [0, 1.110, 0.012]],
    ['Neck', BONE.CHEST, [0, 1.384, -0.012]],
    ['Head', BONE.NECK, [0, 1.458, -0.010]],

    ['UpperArm_L', BONE.CHEST, [0.215, 1.329, -0.027]],
    ['ForeArm_L', BONE.UPPER_ARM_L, [0.437, 1.322, -0.015]],
    ['Hand_L', BONE.FORE_ARM_L, [0.644, 1.282, 0.041]],

    ['UpperArm_R', BONE.CHEST, [-0.215, 1.329, -0.027]],
    ['ForeArm_R', BONE.UPPER_ARM_R, [-0.437, 1.322, -0.015]],
    ['Hand_R', BONE.FORE_ARM_R, [-0.644, 1.282, 0.041]],

    ['Thigh_L', BONE.PELVIS, [0.136, 0.747, -0.006]],
    ['Shin_L', BONE.THIGH_L, [0.148, 0.422, -0.025]],
    ['Foot_L', BONE.SHIN_L, [0.175, 0.096, -0.022]],

    ['Thigh_R', BONE.PELVIS, [-0.136, 0.747, -0.006]],
    ['Shin_R', BONE.THIGH_R, [-0.148, 0.422, -0.025]],
    ['Foot_R', BONE.SHIN_R, [-0.175, 0.096, -0.022]],
  ];

  const bones: THREE.Bone[] = [];
  for (let i = 0; i < worldJoints.length; i++) {
    const [name, parentIdx, wPos] = worldJoints[i];
    const bone = new THREE.Bone();
    bone.name = name;
    if (parentIdx === -1) {
      bone.position.set(wPos[0], wPos[1], wPos[2]);
    } else {
      const pPos = worldJoints[parentIdx][2];
      bone.position.set(
        wPos[0] - pPos[0],
        wPos[1] - pPos[1],
        wPos[2] - pPos[2]
      );
      bones[parentIdx].add(bone);
    }
    bones.push(bone);
  }

  // Add visual tip bones so SkeletonHelper renders head top, fingers, and toes clearly
  const headTip = new THREE.Bone();
  headTip.name = 'Head_Top';
  headTip.position.set(0, 0.22, 0);
  bones[BONE.HEAD].add(headTip);

  const handTipL = new THREE.Bone();
  handTipL.name = 'HandTip_L';
  handTipL.position.set(0.13, -0.01, 0.01);
  bones[BONE.HAND_L].add(handTipL);

  const handTipR = new THREE.Bone();
  handTipR.name = 'HandTip_R';
  handTipR.position.set(-0.13, -0.01, 0.01);
  bones[BONE.HAND_R].add(handTipR);

  const toeTipL = new THREE.Bone();
  toeTipL.name = 'Toe_L';
  toeTipL.position.set(0, -0.07, 0.13);
  bones[BONE.FOOT_L].add(toeTipL);

  const toeTipR = new THREE.Bone();
  toeTipR.name = 'Toe_R';
  toeTipR.position.set(0, -0.07, 0.13);
  bones[BONE.FOOT_R].add(toeTipR);

  // Tool attachment sockets on left & right palms
  const handAttachmentR = new THREE.Group();
  handAttachmentR.name = 'Socket_Hand_R';
  handAttachmentR.position.set(-0.07, -0.01, 0.02);
  bones[BONE.HAND_R].add(handAttachmentR);

  const handAttachmentL = new THREE.Group();
  handAttachmentL.name = 'Socket_Hand_L';
  handAttachmentL.position.set(0.07, -0.01, 0.02);
  bones[BONE.HAND_L].add(handAttachmentL);

  // Compute smooth 4-bone skin weights per vertex using clean T-pose partitioning
  const skinIndices = new Uint16Array(vertCount * 4);
  const skinWeights = new Float32Array(vertCount * 4);

  for (let i = 0; i < vertCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const absX = Math.abs(x);
    const isLeft = x >= 0;

    const weights = new Map<number, number>();
    const addW = (boneIdx: number, w: number) => {
      if (w > 1e-5) {
        weights.set(boneIdx, (weights.get(boneIdx) ?? 0) + w);
      }
    };

    // Check arm influence band (y between 1.12m and 1.47m and extending outward along X)
    const armVerticalMask =
      smoothstep(1.10, 1.20, y) * (1 - smoothstep(1.42, 1.48, y));
    const armOutwardBlend = smoothstep(0.165, 0.255, absX) * armVerticalMask;

    if (armOutwardBlend > 0.001) {
      const upperIdx = isLeft ? BONE.UPPER_ARM_L : BONE.UPPER_ARM_R;
      const foreIdx = isLeft ? BONE.FORE_ARM_L : BONE.FORE_ARM_R;
      const handIdx = isLeft ? BONE.HAND_L : BONE.HAND_R;

      const toFore = smoothstep(0.385, 0.485, absX);
      const toHand = smoothstep(0.595, 0.675, absX);

      const wUpper = 1 - toFore;
      const wFore = toFore * (1 - toHand);
      const wHand = toFore * toHand;

      addW(upperIdx, armOutwardBlend * wUpper);
      addW(foreIdx, armOutwardBlend * wFore);
      addW(handIdx, armOutwardBlend * wHand);
    }

    const bodyShare = 1 - armOutwardBlend;
    if (bodyShare > 0.001) {
      // Lower body (legs) vs Pelvis/Torso transition around y = 0.68 .. 0.81
      const torsoMask = smoothstep(0.68, 0.81, y);
      const legShare = bodyShare * (1 - torsoMask);
      const torsoShare = bodyShare * torsoMask;

      if (legShare > 0.001) {
        const thighIdx = isLeft ? BONE.THIGH_L : BONE.THIGH_R;
        const shinIdx = isLeft ? BONE.SHIN_L : BONE.SHIN_R;
        const footIdx = isLeft ? BONE.FOOT_L : BONE.FOOT_R;

        // y decreases down the leg: hip (0.75) -> knee (0.422) -> ankle (0.096) -> sole (0)
        const aboveKnee = smoothstep(0.365, 0.475, y);
        const aboveAnkle = smoothstep(0.065, 0.145, y);

        const wThigh = aboveKnee;
        const wShin = (1 - aboveKnee) * aboveAnkle;
        const wFoot = (1 - aboveKnee) * (1 - aboveAnkle);

        addW(thighIdx, legShare * wThigh);
        addW(shinIdx, legShare * wShin);
        addW(footIdx, legShare * wFoot);
      }

      if (torsoShare > 0.001) {
        const toSpine = smoothstep(0.80, 0.93, y);
        const toChest = smoothstep(0.99, 1.15, y);
        const toNeck = smoothstep(1.33, 1.40, y);
        const toHead = smoothstep(1.41, 1.465, y);

        const wPelvis = 1 - toSpine;
        const wSpine = toSpine * (1 - toChest);
        const wChest = toSpine * toChest * (1 - toNeck);
        const wNeck = toSpine * toChest * toNeck * (1 - toHead);
        const wHead = toSpine * toChest * toNeck * toHead;

        addW(BONE.PELVIS, torsoShare * wPelvis);
        addW(BONE.SPINE, torsoShare * wSpine);
        addW(BONE.CHEST, torsoShare * wChest);
        addW(BONE.NECK, torsoShare * wNeck);
        addW(BONE.HEAD, torsoShare * wHead);
      }
    }

    // Sort top 4 bone weights & normalize to 1.0
    const sorted = Array.from(weights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    let sum = 0;
    for (const [, w] of sorted) sum += w;
    if (sum <= 0) {
      skinIndices[i * 4] = BONE.PELVIS;
      skinWeights[i * 4] = 1;
    } else {
      for (let k = 0; k < 4; k++) {
        if (k < sorted.length) {
          skinIndices[i * 4 + k] = sorted[k][0];
          skinWeights[i * 4 + k] = sorted[k][1] / sum;
        } else {
          skinIndices[i * 4 + k] = 0;
          skinWeights[i * 4 + k] = 0;
        }
      }
    }
  }

  geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  const skinnedMesh = new THREE.SkinnedMesh(geom, baseMaterial);
  skinnedMesh.name = 'ChuLongQ9_SkinnedMesh';
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;

  const rootGroup = new THREE.Group();
  rootGroup.name = 'ChuLongQ9_RigRoot';
  skinnedMesh.add(bones[BONE.PELVIS]);
  rootGroup.add(skinnedMesh);

  rootGroup.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skinnedMesh.bind(skeleton);

  const skeletonHelper = new THREE.SkeletonHelper(skinnedMesh);
  skeletonHelper.visible = false;
  const helperMat = skeletonHelper.material as THREE.LineBasicMaterial;
  helperMat.linewidth = 2;
  helperMat.depthTest = false;

  // Bind-pose Pelvis default position
  const bindPelvisPos = new THREE.Vector3(0, 0.777, 0.005);

  // Reusable math temporaries
  const tmpRootWorld = new THREE.Vector3();
  const tmpRootRig = new THREE.Vector3();
  const tmpToTarget = new THREE.Vector3();
  const tmpFwd = new THREE.Vector3();
  const tmpBend = new THREE.Vector3();
  const tmpJoint = new THREE.Vector3();
  const tmpEnd = new THREE.Vector3();
  const tmpDir1 = new THREE.Vector3();
  const tmpDir2 = new THREE.Vector3();
  const tmpParentWorldQuat = new THREE.Quaternion();
  const tmpMeshWorldQuat = new THREE.Quaternion();

  /**
   * Solves exact 2-bone analytic IK in skinnedMesh (rig) coordinate space.
   */
  function solveLimbIK(
    upperBone: THREE.Bone,
    lowerBone: THREE.Bone,
    endBone: THREE.Bone,
    targetInRig: THREE.Vector3,
    poleDirInRig: THREE.Vector3,
    endOrientRigQuat?: THREE.Quaternion
  ) {
    upperBone.quaternion.identity();
    lowerBone.quaternion.identity();
    endBone.quaternion.identity();
    skinnedMesh.updateMatrixWorld(true);

    skinnedMesh.getWorldQuaternion(tmpMeshWorldQuat);
    const invMeshWorldQuat = tmpMeshWorldQuat.clone().invert();

    upperBone.getWorldPosition(tmpRootWorld);
    tmpRootRig.copy(tmpRootWorld);
    skinnedMesh.worldToLocal(tmpRootRig);

    const L1 = lowerBone.position.length();
    const L2 = endBone.position.length();

    tmpToTarget.subVectors(targetInRig, tmpRootRig);
    const rawDist = Math.max(tmpToTarget.length(), 1e-4);
    const clampedDist = THREE.MathUtils.clamp(
      rawDist,
      Math.abs(L1 - L2) + 0.015,
      (L1 + L2) * 0.992
    );

    const cosA = THREE.MathUtils.clamp(
      (L1 * L1 + clampedDist * clampedDist - L2 * L2) / (2 * L1 * clampedDist),
      -1,
      1
    );
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

    tmpFwd.copy(tmpToTarget).divideScalar(rawDist);
    tmpBend.copy(poleDirInRig).addScaledVector(tmpFwd, -poleDirInRig.dot(tmpFwd));
    if (tmpBend.lengthSq() < 1e-5) {
      tmpBend.set(0, 0, 1).addScaledVector(tmpFwd, -tmpFwd.z);
    }
    tmpBend.normalize();

    tmpJoint
      .copy(tmpRootRig)
      .addScaledVector(tmpFwd, L1 * cosA)
      .addScaledVector(tmpBend, L1 * sinA);

    tmpEnd.copy(tmpRootRig).addScaledVector(tmpFwd, clampedDist);

    tmpDir1.subVectors(tmpJoint, tmpRootRig).normalize();
    tmpDir2.subVectors(tmpEnd, tmpJoint).normalize();

    // Parent quaternion in rig space
    upperBone.parent!.getWorldQuaternion(tmpParentWorldQuat);
    const parentRigQuat = invMeshWorldQuat.clone().multiply(tmpParentWorldQuat);

    const localDir1 = tmpDir1
      .clone()
      .applyQuaternion(parentRigQuat.clone().invert())
      .normalize();
    const restDir1 = lowerBone.position.clone().normalize();
    upperBone.quaternion.setFromUnitVectors(restDir1, localDir1);

    const upperRigQuat = parentRigQuat.clone().multiply(upperBone.quaternion);
    const localDir2 = tmpDir2
      .clone()
      .applyQuaternion(upperRigQuat.clone().invert())
      .normalize();
    const restDir2 = endBone.position.clone().normalize();
    lowerBone.quaternion.setFromUnitVectors(restDir2, localDir2);

    if (endOrientRigQuat) {
      const lowerRigQuat = upperRigQuat.clone().multiply(lowerBone.quaternion);
      endBone.quaternion
        .copy(lowerRigQuat.clone().invert())
        .multiply(endOrientRigQuat);
    }
  }

  function resetAllBones() {
    for (const b of bones) {
      b.quaternion.identity();
    }
    bones[BONE.PELVIS].position.copy(bindPelvisPos);
  }

  function applyPose(
    pose: PosePresetId,
    timeSec: number,
    adj: CustomPoseAdjustments,
    animateMotion: boolean
  ) {
    resetAllBones();

    const t = animateMotion ? timeSec : 0;
    const breath = animateMotion ? Math.sin(t * 2.1) * 0.015 : 0;
    const deg = THREE.MathUtils.degToRad;

    const extraLean = deg(adj.spineLean);
    const extraYaw = deg(adj.headYaw);
    const extraPitch = deg(adj.headPitch);
    const squatOffset = adj.squatDepth * 0.28;

    if (pose === 't_pose') {
      bones[BONE.PELVIS].position.y = bindPelvisPos.y - squatOffset;
      bones[BONE.PELVIS].rotation.y = deg(adj.bodyTurn);
      bones[BONE.SPINE].rotation.x = extraLean * 0.5 + breath * 0.4;
      bones[BONE.CHEST].rotation.x = extraLean * 0.5 + breath * 0.6;
      bones[BONE.HEAD].rotation.set(extraPitch, extraYaw, 0);

      // Direct FK/Euler tweaks for T-Pose inspection
      bones[BONE.UPPER_ARM_L].rotation.set(
        0,
        -deg(adj.armLForward),
        deg(adj.armLLift)
      );
      bones[BONE.FORE_ARM_L].rotation.set(
        0,
        -deg(Math.max(0, adj.armLForward * 0.5)),
        0
      );
      bones[BONE.UPPER_ARM_R].rotation.set(
        0,
        deg(adj.armRForward),
        -deg(adj.armRLift)
      );
      bones[BONE.FORE_ARM_R].rotation.set(
        0,
        deg(Math.max(0, adj.armRForward * 0.5)),
        0
      );

      if (squatOffset > 0.005) {
        const footFlatL = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, deg(10), 0)
        );
        const footFlatR = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, deg(-10), 0)
        );
        solveLimbIK(
          bones[BONE.THIGH_L],
          bones[BONE.SHIN_L],
          bones[BONE.FOOT_L],
          new THREE.Vector3(0.175, 0.096, -0.02),
          new THREE.Vector3(0.25, 0.2, 1.0),
          footFlatL
        );
        solveLimbIK(
          bones[BONE.THIGH_R],
          bones[BONE.SHIN_R],
          bones[BONE.FOOT_R],
          new THREE.Vector3(-0.175, 0.096, -0.02),
          new THREE.Vector3(-0.25, 0.2, 1.0),
          footFlatR
        );
      }
      skinnedMesh.updateMatrixWorld(true);
      return;
    }

    if (pose === 'driving_active') {
      // Actively cruising / driving Honda Wave: feet up on footpegs, leaning into wind & banking into turns
      const roadBump = animateMotion
        ? Math.sin(t * 22) * 0.0028 + (Math.sin(t * 6.5) > 0.85 ? 0.0045 : 0)
        : 0;
      const bankAngle = animateMotion ? Math.sin(t * 1.5) * deg(5.2) : 0;
      const pitchSway = animateMotion ? Math.sin(t * 0.9) * deg(1.8) : 0;
      const steerYaw = animateMotion ? Math.cos(t * 1.5) * deg(3.2) : 0;

      bones[BONE.PELVIS].position.set(
        0,
        0.792 - squatOffset + roadBump,
        -0.05
      );
      bones[BONE.PELVIS].rotation.set(
        deg(6) + pitchSway,
        deg(adj.bodyTurn) + steerYaw * 0.35,
        -bankAngle * 0.75
      );
      bones[BONE.SPINE].rotation.set(
        deg(15) + extraLean * 0.5,
        0,
        -bankAngle * 0.25
      );
      bones[BONE.CHEST].rotation.set(
        deg(13) + extraLean * 0.5 + breath,
        0,
        -bankAngle * 0.2
      );

      // Head scanning the road ahead
      bones[BONE.NECK].rotation.set(deg(-6), 0, 0);
      bones[BONE.HEAD].rotation.set(
        deg(-10) + extraPitch,
        extraYaw + steerYaw * 0.6,
        -bankAngle * 0.15
      );

      // Feet placed securely on the Honda Wave's footpegs (gác chân xe Wave)
      const footLQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(deg(14), deg(8), 0)
      );
      const footRQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(deg(14), deg(-8), 0)
      );
      solveLimbIK(
        bones[BONE.THIGH_L],
        bones[BONE.SHIN_L],
        bones[BONE.FOOT_L],
        new THREE.Vector3(0.185, 0.29 + roadBump * 0.3, 0.10),
        new THREE.Vector3(0.36, 0.62, 0.95),
        footLQuat
      );
      solveLimbIK(
        bones[BONE.THIGH_R],
        bones[BONE.SHIN_R],
        bones[BONE.FOOT_R],
        new THREE.Vector3(-0.185, 0.29 + roadBump * 0.3, 0.10),
        new THREE.Vector3(-0.36, 0.62, 0.95),
        footRQuat
      );

      // Hands gripping handlebars & right wrist twisting throttle
      const throttleTwist = animateMotion ? Math.sin(t * 3.2) * 0.006 : 0;
      const handTargetL = new THREE.Vector3(
        0.33 - adj.armLForward * 0.002,
        0.985 + roadBump * 0.4 + adj.armLLift * 0.004,
        0.36 + adj.armLForward * 0.003
      );
      const handTargetR = new THREE.Vector3(
        -0.33 + adj.armRForward * 0.002,
        0.985 + roadBump * 0.4 + throttleTwist + adj.armRLift * 0.004,
        0.36 + adj.armRForward * 0.003
      );

      solveLimbIK(
        bones[BONE.UPPER_ARM_L],
        bones[BONE.FORE_ARM_L],
        bones[BONE.HAND_L],
        handTargetL,
        new THREE.Vector3(0.75, -0.55, -0.3)
      );
      solveLimbIK(
        bones[BONE.UPPER_ARM_R],
        bones[BONE.FORE_ARM_R],
        bones[BONE.HAND_R],
        handTargetR,
        new THREE.Vector3(-0.75, -0.55, -0.3)
      );

      skinnedMesh.updateMatrixWorld(true);
      return;
    }

    if (pose === 'riding_wave') {
      // Straddling the stopped yellow Honda Wave, talking warmly to student
      const idleBob = animateMotion ? Math.sin(t * 14) * 0.0025 : 0;
      bones[BONE.PELVIS].position.set(0, 0.805 - squatOffset + idleBob, -0.04);
      bones[BONE.PELVIS].rotation.set(deg(4), deg(adj.bodyTurn), 0);
      bones[BONE.SPINE].rotation.set(deg(8) + extraLean * 0.5, 0, 0);
      bones[BONE.CHEST].rotation.set(
        deg(7) + extraLean * 0.5 + breath,
        deg(6),
        0
      );

      const talkNod = animateMotion ? Math.sin(t * 2.8) * deg(4) : 0;
      const talkTurn = animateMotion ? Math.sin(t * 1.3) * deg(5) : 0;
      bones[BONE.NECK].rotation.set(deg(-4), deg(12), 0);
      bones[BONE.HEAD].rotation.set(
        deg(-2) + talkNod + extraPitch,
        deg(14) + talkTurn + extraYaw,
        deg(-3)
      );

      // Feet planted wide on asphalt straddling the Wave (exact Photo 1 Top stance)
      const footLQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(deg(4), deg(16), 0)
      );
      const footRQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(deg(4), deg(-16), 0)
      );
      solveLimbIK(
        bones[BONE.THIGH_L],
        bones[BONE.SHIN_L],
        bones[BONE.FOOT_L],
        new THREE.Vector3(0.30, 0.096, 0.08),
        new THREE.Vector3(0.55, 0.35, 1.0),
        footLQuat
      );
      solveLimbIK(
        bones[BONE.THIGH_R],
        bones[BONE.SHIN_R],
        bones[BONE.FOOT_R],
        new THREE.Vector3(-0.30, 0.096, 0.08),
        new THREE.Vector3(-0.55, 0.35, 1.0),
        footRQuat
      );

      // Hands gripping Honda Wave handlebars (+ subtle friendly gesture on right/left)
      const gestureWave = animateMotion
        ? Math.max(0, Math.sin(t * 1.6)) * 0.05
        : 0;
      const handTargetL = new THREE.Vector3(
        0.33 - adj.armLForward * 0.002,
        0.99 + gestureWave + adj.armLLift * 0.004,
        0.36 + adj.armLForward * 0.003
      );
      const handTargetR = new THREE.Vector3(
        -0.33 + adj.armRForward * 0.002,
        0.99 + adj.armRLift * 0.004,
        0.36 + adj.armRForward * 0.003
      );

      solveLimbIK(
        bones[BONE.UPPER_ARM_L],
        bones[BONE.FORE_ARM_L],
        bones[BONE.HAND_L],
        handTargetL,
        new THREE.Vector3(0.7, -0.6, -0.3)
      );
      solveLimbIK(
        bones[BONE.UPPER_ARM_R],
        bones[BONE.FORE_ARM_R],
        bones[BONE.HAND_R],
        handTargetR,
        new THREE.Vector3(-0.7, -0.6, -0.3)
      );

      skinnedMesh.updateMatrixWorld(true);
      return;
    }

    if (pose === 'crouch_tire') {
      // Deep Vietnamese mechanic squat (ngồi xổm) prying tire & tucking inner tube
      const workCycle = animateMotion ? Math.sin(t * 3.4) : 0;
      const workCycleCos = animateMotion ? Math.cos(t * 3.4) : 0;

      bones[BONE.PELVIS].position.set(
        0,
        0.41 - squatOffset * 0.35 + workCycle * 0.008,
        -0.11
      );
      bones[BONE.PELVIS].rotation.set(deg(12), deg(adj.bodyTurn), 0);
      bones[BONE.SPINE].rotation.set(deg(18) + extraLean * 0.5, 0, 0);
      bones[BONE.CHEST].rotation.set(
        deg(16) + extraLean * 0.5 + breath,
        workCycle * deg(2.5),
        0
      );
      bones[BONE.NECK].rotation.set(deg(8), 0, 0);
      bones[BONE.HEAD].rotation.set(
        deg(14) + extraPitch + workCycle * deg(2),
        extraYaw + workCycleCos * deg(3),
        0
      );

      const footLQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, deg(18), 0)
      );
      const footRQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, deg(-18), 0)
      );
      solveLimbIK(
        bones[BONE.THIGH_L],
        bones[BONE.SHIN_L],
        bones[BONE.FOOT_L],
        new THREE.Vector3(0.19, 0.096, 0.09),
        new THREE.Vector3(0.55, 0.85, 1.0),
        footLQuat
      );
      solveLimbIK(
        bones[BONE.THIGH_R],
        bones[BONE.SHIN_R],
        bones[BONE.FOOT_R],
        new THREE.Vector3(-0.19, 0.096, 0.09),
        new THREE.Vector3(-0.55, 0.85, 1.0),
        footRQuat
      );

      // Hands reaching forward to wheel rim prying tire lever & holding tube
      const pryOffset = workCycle * 0.035;
      const handTargetL = new THREE.Vector3(
        0.11,
        0.40 + pryOffset * 0.7 + adj.armLLift * 0.004,
        0.41 + workCycleCos * 0.02 + adj.armLForward * 0.003
      );
      const handTargetR = new THREE.Vector3(
        -0.10,
        0.37 - pryOffset + adj.armRLift * 0.004,
        0.43 - workCycleCos * 0.025 + adj.armRForward * 0.003
      );

      solveLimbIK(
        bones[BONE.UPPER_ARM_L],
        bones[BONE.FORE_ARM_L],
        bones[BONE.HAND_L],
        handTargetL,
        new THREE.Vector3(0.85, -0.35, -0.25)
      );
      solveLimbIK(
        bones[BONE.UPPER_ARM_R],
        bones[BONE.FORE_ARM_R],
        bones[BONE.HAND_R],
        handTargetR,
        new THREE.Vector3(-0.85, -0.35, -0.25)
      );

      skinnedMesh.updateMatrixWorld(true);
      return;
    }

    if (pose === 'sit_wrench') {
      // Sitting directly on tiled sidewalk (ngồi bệt vỉa hè) turning chrome socket wrench
      const crank = animateMotion ? Math.sin(t * 3.0) : 0;
      const crankCos = animateMotion ? Math.cos(t * 3.0) : 0;

      bones[BONE.PELVIS].position.set(0, 0.125, -0.14);
      bones[BONE.PELVIS].rotation.set(deg(-8), deg(adj.bodyTurn), deg(-3));
      bones[BONE.SPINE].rotation.set(deg(16) + extraLean * 0.5, deg(-4), 0);
      bones[BONE.CHEST].rotation.set(
        deg(14) + extraLean * 0.5 + breath + crank * deg(2),
        deg(-5) + crank * deg(3),
        0
      );
      bones[BONE.NECK].rotation.set(deg(4), deg(-4), 0);
      bones[BONE.HEAD].rotation.set(
        deg(10) + extraPitch,
        deg(-6) + extraYaw,
        deg(3)
      );

      // Legs stretched forward onto sidewalk pavement toward bike undercarriage
      const footSidewalkL = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(deg(-62), deg(18), deg(10))
      );
      const footSidewalkR = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(deg(-55), deg(-22), deg(-12))
      );
      solveLimbIK(
        bones[BONE.THIGH_L],
        bones[BONE.SHIN_L],
        bones[BONE.FOOT_L],
        new THREE.Vector3(0.18, 0.105, 0.54),
        new THREE.Vector3(0.28, 0.95, 0.25),
        footSidewalkL
      );
      solveLimbIK(
        bones[BONE.THIGH_R],
        bones[BONE.SHIN_R],
        bones[BONE.FOOT_R],
        new THREE.Vector3(-0.22, 0.105, 0.43),
        new THREE.Vector3(-0.42, 0.95, 0.25),
        footSidewalkR
      );

      // Hands cranking the chrome T-socket wrench into the center-stand bolt
      const handTargetR = new THREE.Vector3(
        -0.05 + crankCos * 0.03,
        0.31 + crank * 0.045 + adj.armRLift * 0.004,
        0.42 + adj.armRForward * 0.003
      );
      const handTargetL = new THREE.Vector3(
        0.10 + crankCos * 0.02,
        0.33 - crank * 0.035 + adj.armLLift * 0.004,
        0.39 + adj.armLForward * 0.003
      );

      solveLimbIK(
        bones[BONE.UPPER_ARM_L],
        bones[BONE.FORE_ARM_L],
        bones[BONE.HAND_L],
        handTargetL,
        new THREE.Vector3(0.85, -0.45, -0.35)
      );
      solveLimbIK(
        bones[BONE.UPPER_ARM_R],
        bones[BONE.FORE_ARM_R],
        bones[BONE.HAND_R],
        handTargetR,
        new THREE.Vector3(-0.85, -0.45, -0.35)
      );

      skinnedMesh.updateMatrixWorld(true);
      return;
    }

    if (pose === 'kneel_pump') {
      // Kneeling on one knee pumping the floor tire pump
      const pumpStroke = animateMotion ? (Math.sin(t * 4.2) + 1) * 0.5 : 0.4;
      const pumpY = 0.48 + pumpStroke * 0.16;

      bones[BONE.PELVIS].position.set(
        0,
        0.48 - squatOffset * 0.25 - (1 - pumpStroke) * 0.03,
        -0.06
      );
      bones[BONE.PELVIS].rotation.set(deg(8), deg(adj.bodyTurn), 0);
      bones[BONE.SPINE].rotation.set(
        deg(14) + (1 - pumpStroke) * deg(6) + extraLean * 0.5,
        0,
        0
      );
      bones[BONE.CHEST].rotation.set(
        deg(12) + (1 - pumpStroke) * deg(5) + extraLean * 0.5,
        0,
        0
      );
      bones[BONE.HEAD].rotation.set(deg(12) + extraPitch, extraYaw, 0);

      const footFlatL = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, deg(8), 0)
      );
      solveLimbIK(
        bones[BONE.THIGH_L],
        bones[BONE.SHIN_L],
        bones[BONE.FOOT_L],
        new THREE.Vector3(0.17, 0.096, 0.24),
        new THREE.Vector3(0.25, 0.9, 1.0),
        footFlatL
      );
      solveLimbIK(
        bones[BONE.THIGH_R],
        bones[BONE.SHIN_R],
        bones[BONE.FOOT_R],
        new THREE.Vector3(-0.16, 0.12, -0.34),
        new THREE.Vector3(-0.2, -0.6, 0.9)
      );

      solveLimbIK(
        bones[BONE.UPPER_ARM_L],
        bones[BONE.FORE_ARM_L],
        bones[BONE.HAND_L],
        new THREE.Vector3(
          0.11,
          pumpY + adj.armLLift * 0.004,
          0.36 + adj.armLForward * 0.003
        ),
        new THREE.Vector3(0.8, -0.3, -0.3)
      );
      solveLimbIK(
        bones[BONE.UPPER_ARM_R],
        bones[BONE.FORE_ARM_R],
        bones[BONE.HAND_R],
        new THREE.Vector3(
          -0.11,
          pumpY + adj.armRLift * 0.004,
          0.36 + adj.armRForward * 0.003
        ),
        new THREE.Vector3(-0.8, -0.3, -0.3)
      );

      skinnedMesh.updateMatrixWorld(true);
      return;
    }

    // Default / 'thumbs_up' — Cheerful standing thumbs-up & wave beside the Wave bike
    const waveOsc = animateMotion ? Math.sin(t * 3.2) * 0.035 : 0;
    bones[BONE.PELVIS].position.set(0, 0.768 - squatOffset, 0);
    bones[BONE.PELVIS].rotation.set(0, deg(-6) + deg(adj.bodyTurn), deg(2));
    bones[BONE.SPINE].rotation.set(deg(-2) + extraLean * 0.5, deg(4), 0);
    bones[BONE.CHEST].rotation.set(
      deg(-2) + extraLean * 0.5 + breath,
      deg(4),
      deg(-2)
    );
    bones[BONE.HEAD].rotation.set(
      deg(-3) + extraPitch,
      deg(6) + extraYaw + (animateMotion ? Math.sin(t * 1.5) * deg(4) : 0),
      deg(3)
    );

    const footLQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, deg(10), 0)
    );
    const footRQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, deg(-12), 0)
    );
    solveLimbIK(
      bones[BONE.THIGH_L],
      bones[BONE.SHIN_L],
      bones[BONE.FOOT_L],
      new THREE.Vector3(0.17, 0.096, 0.02),
      new THREE.Vector3(0.25, 0.2, 1.0),
      footLQuat
    );
    solveLimbIK(
      bones[BONE.THIGH_R],
      bones[BONE.SHIN_R],
      bones[BONE.FOOT_R],
      new THREE.Vector3(-0.18, 0.096, -0.03),
      new THREE.Vector3(-0.25, 0.2, 1.0),
      footRQuat
    );

    // Left hand relaxed on hip/side, Right hand raised in friendly Thumbs-Up!
    solveLimbIK(
      bones[BONE.UPPER_ARM_L],
      bones[BONE.FORE_ARM_L],
      bones[BONE.HAND_L],
      new THREE.Vector3(
        0.24,
        0.86 + adj.armLLift * 0.004,
        0.10 + adj.armLForward * 0.003
      ),
      new THREE.Vector3(0.9, -0.4, -0.4)
    );
    solveLimbIK(
      bones[BONE.UPPER_ARM_R],
      bones[BONE.FORE_ARM_R],
      bones[BONE.HAND_R],
      new THREE.Vector3(
        -0.29 + waveOsc * 0.5,
        1.34 + waveOsc + adj.armRLift * 0.004,
        0.34 + adj.armRForward * 0.003
      ),
      new THREE.Vector3(-0.85, -0.55, -0.25)
    );

    skinnedMesh.updateMatrixWorld(true);
  }

  /**
   * Bakes the currently deformed SkinnedMesh vertices & normals into a standalone
   * standard THREE.Mesh so GLTFExporter produces a universally clean .GLB file.
   */
  function bakeCurrentPoseToMesh(): THREE.Mesh {
    rootGroup.updateMatrixWorld(true);
    skeleton.update();

    const bakedGeo = new THREE.BufferGeometry();
    const srcPos = geom.getAttribute('position');
    const srcNorm = geom.getAttribute('normal');
    const srcUv = geom.getAttribute('uv');
    const count = srcPos.count;

    const outPos = new Float32Array(count * 3);
    const outNorm = new Float32Array(count * 3);

    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const origin = new THREE.Vector3();
    const nEnd = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(srcPos, i);
      skinnedMesh.applyBoneTransform(i, v);
      outPos[i * 3] = v.x;
      outPos[i * 3 + 1] = v.y;
      outPos[i * 3 + 2] = v.z;

      if (srcNorm) {
        origin.fromBufferAttribute(srcPos, i);
        n.fromBufferAttribute(srcNorm, i);
        nEnd.copy(origin).addScaledVector(n, 0.05);
        skinnedMesh.applyBoneTransform(i, origin);
        skinnedMesh.applyBoneTransform(i, nEnd);
        nEnd.sub(origin).normalize();
        outNorm[i * 3] = nEnd.x;
        outNorm[i * 3 + 1] = nEnd.y;
        outNorm[i * 3 + 2] = nEnd.z;
      }
    }

    bakedGeo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
    bakedGeo.setAttribute('normal', new THREE.BufferAttribute(outNorm, 3));
    if (srcUv) {
      bakedGeo.setAttribute('uv', srcUv.clone());
    }
    if (geom.index) {
      bakedGeo.setIndex(geom.index.clone());
    }
    if (!srcNorm) {
      bakedGeo.computeVertexNormals();
    }
    bakedGeo.computeBoundingBox();
    bakedGeo.computeBoundingSphere();

    const bakedMesh = new THREE.Mesh(bakedGeo, baseMaterial.clone());
    bakedMesh.name = 'ChuLongQuan9_Posed';
    bakedMesh.position.copy(rootGroup.position);
    bakedMesh.quaternion.copy(rootGroup.quaternion);
    bakedMesh.scale.copy(rootGroup.scale);
    return bakedMesh;
  }

  return {
    rootGroup,
    skinnedMesh,
    skeleton,
    skeletonHelper,
    bones,
    handAttachmentR,
    handAttachmentL,
    applyPose,
    bakeCurrentPoseToMesh,
  };
}
