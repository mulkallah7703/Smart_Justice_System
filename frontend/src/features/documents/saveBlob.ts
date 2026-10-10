/**
 * Hands a downloaded blob to the browser and releases the object URL again so
 * repeated downloads do not leak memory.
 */
export const saveBlob = (blob: Blob, fileName: string): void => {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
