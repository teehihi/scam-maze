import { describe, expect, it, vi } from 'vitest';
import { contextLossLogHandlers } from './ContextLossWatcher';
import { watchContextLoss } from './lifecycle';

describe('contextLossLogHandlers', () => {
  it('logs a warning on loss and an info message on restore, both naming the host', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const handlers = contextLossLogHandlers('testmove');

    handlers.onLost?.();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('testmove');

    handlers.onRestored?.();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][0]).toContain('testmove');

    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('wired through watchContextLoss, preventDefault is called so the browser may restore the context', () => {
    const canvas = document.createElement('canvas');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unsubscribe = watchContextLoss(canvas, contextLossLogHandlers('ueh'));

    const event = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
    warnSpy.mockClear();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('each host gets its own name in the log, so two watchers on different canvases are distinguishable', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const testmoveCanvas = document.createElement('canvas');
    const uehCanvas = document.createElement('canvas');
    watchContextLoss(testmoveCanvas, contextLossLogHandlers('testmove'));
    watchContextLoss(uehCanvas, contextLossLogHandlers('ueh'));

    testmoveCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    uehCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0][0]).toContain('testmove');
    expect(warnSpy.mock.calls[1][0]).toContain('ueh');

    warnSpy.mockRestore();
  });
});
