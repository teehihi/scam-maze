import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ListenerBag, disposeObjectTree, watchContextLoss } from './lifecycle';

describe('ListenerBag', () => {
  it('adds a listener that actually fires', () => {
    const bag = new ListenerBag();
    const target = new EventTarget() as unknown as Window;
    const handler = vi.fn();
    bag.add(target, 'resize' as 'resize', handler as () => void);
    target.dispatchEvent(new Event('resize'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removeAll removes every listener added through the bag, in any order', () => {
    const bag = new ListenerBag();
    const a = new EventTarget();
    const b = new EventTarget();
    const onA = vi.fn();
    const onB = vi.fn();
    bag.add(a, 'resize', onA);
    bag.add(b, 'keydown', onB);
    bag.removeAll();
    a.dispatchEvent(new Event('resize'));
    b.dispatchEvent(new Event('keydown'));
    expect(onA).not.toHaveBeenCalled();
    expect(onB).not.toHaveBeenCalled();
  });

  it('removeAll is idempotent: calling it twice does not throw and leaves zero listeners', () => {
    const bag = new ListenerBag();
    const target = new EventTarget();
    bag.add(target, 'resize', vi.fn());
    bag.removeAll();
    expect(() => bag.removeAll()).not.toThrow();
    expect(bag.size).toBe(0);
  });

  it('tracks size as listeners are added and cleared', () => {
    const bag = new ListenerBag();
    const target = new EventTarget();
    expect(bag.size).toBe(0);
    bag.add(target, 'resize', vi.fn());
    bag.add(target, 'keydown', vi.fn());
    expect(bag.size).toBe(2);
    bag.removeAll();
    expect(bag.size).toBe(0);
  });

  it('removes a listener added with capture using the same capture flag', () => {
    const bag = new ListenerBag();
    const target = new EventTarget();
    const handler = vi.fn();
    bag.add(target, 'resize', handler, true);
    bag.removeAll();
    target.dispatchEvent(new Event('resize'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('a large, arbitrary add/remove sequence always ends with zero live listeners', () => {
    const bag = new ListenerBag();
    const targets = [new EventTarget(), new EventTarget(), new EventTarget()];
    const types = ['resize', 'keydown', 'contextmenu', 'visibilitychange'];
    const handlers: Array<() => void> = [];
    for (let i = 0; i < 40; i++) {
      const handler = vi.fn();
      handlers.push(handler);
      const target = targets[i % targets.length];
      const type = types[i % types.length];
      bag.add(target, type, handler);
    }
    bag.removeAll();
    for (let i = 0; i < 40; i++) {
      const target = targets[i % targets.length];
      const type = types[i % types.length];
      target.dispatchEvent(new Event(type));
    }
    for (const handler of handlers) expect(handler).not.toHaveBeenCalled();
  });
});

describe('disposeObjectTree', () => {
  function meshWithMaterial(): { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; texture: THREE.Texture } {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    return { mesh, geometry, material, texture };
  }

  it('disposes a mesh geometry, material and the material texture', () => {
    const { mesh, geometry, material, texture } = meshWithMaterial();
    const root = new THREE.Group();
    root.add(mesh);

    const geometrySpy = vi.spyOn(geometry, 'dispose');
    const materialSpy = vi.spyOn(material, 'dispose');
    const textureSpy = vi.spyOn(texture, 'dispose');

    disposeObjectTree(root);

    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
    expect(textureSpy).toHaveBeenCalledTimes(1);
  });

  it('disposes a shared material and its texture exactly once, even when many meshes use it', () => {
    const geometryA = new THREE.BoxGeometry();
    const geometryB = new THREE.SphereGeometry();
    const texture = new THREE.Texture();
    const sharedMaterial = new THREE.MeshStandardMaterial({ map: texture });
    const meshA = new THREE.Mesh(geometryA, sharedMaterial);
    const meshB = new THREE.Mesh(geometryB, sharedMaterial);
    const root = new THREE.Group();
    root.add(meshA, meshB);

    const materialSpy = vi.spyOn(sharedMaterial, 'dispose');
    const textureSpy = vi.spyOn(texture, 'dispose');
    const geometryASpy = vi.spyOn(geometryA, 'dispose');
    const geometryBSpy = vi.spyOn(geometryB, 'dispose');

    disposeObjectTree(root);

    expect(materialSpy).toHaveBeenCalledTimes(1);
    expect(textureSpy).toHaveBeenCalledTimes(1);
    expect(geometryASpy).toHaveBeenCalledTimes(1);
    expect(geometryBSpy).toHaveBeenCalledTimes(1);
  });

  it('disposes every material in a material array', () => {
    const geometry = new THREE.BoxGeometry();
    const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
    const mesh = new THREE.Mesh(geometry, materials);
    const root = new THREE.Group();
    root.add(mesh);

    const spies = materials.map((m) => vi.spyOn(m, 'dispose'));
    disposeObjectTree(root);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not throw on an object with no geometry or material (a plain Group or Light)', () => {
    const root = new THREE.Group();
    root.add(new THREE.Group());
    root.add(new THREE.AmbientLight());
    expect(() => disposeObjectTree(root)).not.toThrow();
  });

  it('disposes meshes nested under a chunk-style sub-group, matching what Hue previously did per chunk', () => {
    const chunkGroup = new THREE.Group();
    const { mesh, geometry, material, texture } = meshWithMaterial();
    chunkGroup.add(mesh);
    const scene = new THREE.Scene();
    scene.add(chunkGroup);

    const geometrySpy = vi.spyOn(geometry, 'dispose');
    const materialSpy = vi.spyOn(material, 'dispose');
    const textureSpy = vi.spyOn(texture, 'dispose');

    disposeObjectTree(scene);

    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
    // Unlike Hue's old narrow per-chunk pass, the shared function also frees the texture.
    expect(textureSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores a non-texture value that happens to have a dispose method', () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial() as THREE.MeshStandardMaterial & { fakeResource?: { dispose: () => void } };
    const fakeDispose = vi.fn();
    material.fakeResource = { dispose: fakeDispose };
    const mesh = new THREE.Mesh(geometry, material);
    const root = new THREE.Group();
    root.add(mesh);

    disposeObjectTree(root);
    expect(fakeDispose).not.toHaveBeenCalled();
  });
});

describe('watchContextLoss', () => {
  it('calls onLost (after preventDefault) and onRestored on the matching events', () => {
    const canvas = document.createElement('canvas');
    const onLost = vi.fn();
    const onRestored = vi.fn();
    watchContextLoss(canvas, { onLost, onRestored });

    const lostEvent = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lostEvent);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(lostEvent.defaultPrevented).toBe(true);

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it('the returned unsubscribe stops further callbacks, so forceContextLoss during dispose does not fire onLost', () => {
    const canvas = document.createElement('canvas');
    const onLost = vi.fn();
    const unsubscribe = watchContextLoss(canvas, { onLost });
    unsubscribe();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(onLost).not.toHaveBeenCalled();
  });

  it('works with only one handler supplied', () => {
    const canvas = document.createElement('canvas');
    const onRestored = vi.fn();
    expect(() => watchContextLoss(canvas, { onRestored })).not.toThrow();
    expect(() => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))).not.toThrow();
  });
});
