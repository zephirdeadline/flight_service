const cache = new Map<string, HTMLImageElement>();

export const getTile = (
  tx: number,
  ty: number,
  tz: number,
  scheduleRedraw: () => void,
): HTMLImageElement | null => {
  const key = `${tz}/${tx}/${ty}`;
  const cached = cache.get(key);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `https://tile.openstreetmap.org/${tz}/${tx}/${ty}.png`;
  img.onload = () => {
    cache.set(key, img);
    scheduleRedraw();
  };
  cache.set(key, img);
  return null;
};
