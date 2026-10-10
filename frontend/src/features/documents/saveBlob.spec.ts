import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveBlob } from './saveBlob';

describe('saveBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('revokes the object URL after handing the blob to the browser', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clicks: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function click(this: HTMLAnchorElement) {
        clicks.push(this.getAttribute('download') ?? '');
      });

    saveBlob(new Blob(['%PDF-1.4']), 'lease.pdf');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clicks).toEqual(['lease.pdf']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
