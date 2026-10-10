import { CONSULTATION_DURATION_MS } from './types/lawyers.types';

export interface Interval {
  startAt: Date;
  endAt: Date;
}

/** Half-open interval overlap: [aStart, aEnd) intersects [bStart, bEnd). */
export const overlaps = (a: Interval, b: Interval): boolean =>
  a.startAt.getTime() < b.endAt.getTime() &&
  a.endAt.getTime() > b.startAt.getTime();

/** True when [start, end) fits entirely inside the availability window. */
export const isWithinWindow = (block: Interval, window: Interval): boolean =>
  block.startAt.getTime() >= window.startAt.getTime() &&
  block.endAt.getTime() <= window.endAt.getTime();

/**
 * Splits an availability window into consecutive bookable blocks aligned to the
 * window start. A trailing remainder shorter than one block is dropped.
 */
export const enumerateBlocks = (
  window: Interval,
  durationMs: number = CONSULTATION_DURATION_MS,
): Interval[] => {
  const blocks: Interval[] = [];
  if (durationMs <= 0) {
    return blocks;
  }

  for (
    let start = window.startAt.getTime();
    start + durationMs <= window.endAt.getTime();
    start += durationMs
  ) {
    blocks.push({ startAt: new Date(start), endAt: new Date(start + durationMs) });
  }

  return blocks;
};

/** Blocks that start at or after `notBefore` and clash with no busy interval. */
export const filterBookableBlocks = (
  blocks: Interval[],
  busy: Interval[],
  notBefore: Date,
): Interval[] =>
  blocks.filter(
    (block) =>
      block.startAt.getTime() >= notBefore.getTime() &&
      !busy.some((taken) => overlaps(block, taken)),
  );
