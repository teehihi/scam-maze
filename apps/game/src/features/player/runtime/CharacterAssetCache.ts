import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export const ARMS_MODEL_PATH = '/assets/3d/characters/first_person_animations.glb';
export const HIT_PUNCH_SOUND_PATH = '/assets/audio/hit_punch.mp3';
export const MISS_PUNCH_SOUND_PATH = '/assets/audio/miss_punch.mp3';

class CharacterAssetCacheSingleton {
  private gltfPromise: Promise<GLTF> | null = null;
  private cachedGltf: GLTF | null = null;

  private audioCtx: AudioContext | null = null;
  private hitBuffer: AudioBuffer | null = null;
  private missBuffer: AudioBuffer | null = null;
  private audioLoadingPromise: Promise<void> | null = null;

  /**
   * Preload or fetch the first-person arms model asynchronously.
   * Returns a cached raw GLTF container.
   */
  public async loadArmsModel(): Promise<GLTF> {
    if (this.cachedGltf) {
      return this.cachedGltf;
    }
    if (this.gltfPromise) {
      return this.gltfPromise;
    }

    const loader = new GLTFLoader();
    this.gltfPromise = new Promise<GLTF>((resolve, reject) => {
      loader.load(
        ARMS_MODEL_PATH,
        (gltf) => {
          this.cachedGltf = gltf;
          resolve(gltf);
        },
        undefined,
        (err) => {
          this.gltfPromise = null;
          reject(err);
        },
      );
    });

    return this.gltfPromise;
  }

  /**
   * Clone a fresh instance of the arms mesh and skeleton for an active camera viewmodel.
   */
  public cloneArmsScene(sourceGltf: GLTF): { scene: THREE.Group; animations: THREE.AnimationClip[] } {
    const clonedScene = SkeletonUtils.clone(sourceGltf.scene) as THREE.Group;

    clonedScene.traverse((child) => {
      const name = child.name || '';
      if (name.includes('Background')) {
        child.visible = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
        child.renderOrder = 999;
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.depthTest = true;
          mat.depthWrite = true;
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.needsUpdate = true;
          }
          if (mat.normalMap) {
            mat.normalScale.set(1.0, 1.0);
          }
          mat.roughness = 0.55;
          mat.metalness = 0.0;
          mat.needsUpdate = true;
          mesh.material = mat;
        }
      }
    });

    return {
      scene: clonedScene,
      animations: sourceGltf.animations,
    };
  }

  /**
   * Get or initialize the shared AudioContext and pre-decode punch sounds.
   */
  public async getAudioBuffers(): Promise<{
    ctx: AudioContext | null;
    hit: AudioBuffer | null;
    miss: AudioBuffer | null;
  }> {
    if (this.hitBuffer && this.missBuffer) {
      return { ctx: this.audioCtx, hit: this.hitBuffer, miss: this.missBuffer };
    }

    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }

    if (!this.audioCtx) {
      return { ctx: null, hit: null, miss: null };
    }

    if (!this.audioLoadingPromise) {
      this.audioLoadingPromise = (async () => {
        try {
          const [hitRes, missRes] = await Promise.all([
            fetch(HIT_PUNCH_SOUND_PATH),
            fetch(MISS_PUNCH_SOUND_PATH),
          ]);
          const [hitData, missData] = await Promise.all([
            hitRes.arrayBuffer(),
            missRes.arrayBuffer(),
          ]);
          const [hitBuf, missBuf] = await Promise.all([
            this.audioCtx!.decodeAudioData(hitData),
            this.audioCtx!.decodeAudioData(missData),
          ]);
          this.hitBuffer = hitBuf;
          this.missBuffer = missBuf;
        } catch (err) {
          console.warn('[CharacterAssetCache] Failed to load character audio buffers:', err);
        }
      })();
    }

    await this.audioLoadingPromise;
    return { ctx: this.audioCtx, hit: this.hitBuffer, miss: this.missBuffer };
  }
}

export const CharacterAssetCache = new CharacterAssetCacheSingleton();
