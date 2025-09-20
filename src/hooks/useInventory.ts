import type { Inventory, ShelfROI } from '../types';

export function occupancy(frame: ImageData, bg: ImageData, roi: {x:number;y:number;w:number;h:number}, step=2, thr=30) {
  const { width } = frame; const f = frame.data, b = bg.data; let total=0, diff=0;
  for (let y=roi.y; y<roi.y+roi.h; y+=step) {
    for (let x=roi.x; x<roi.x+roi.w; x+=step) {
      const i = (y*width + x) * 4;
      const fy = 0.299*f[i] + 0.587*f[i+1] + 0.114*f[i+2];
      const by = 0.299*b[i] + 0.587*b[i+1] + 0.114*b[i+2];
      if (Math.abs(fy - by) > thr) diff++; total++;
    }
  }
  return total? diff/total : 0;
}

export function decideState(occ: number, low: number, empty: number): 'ok'|'low'|'empty' {
  if (occ < empty) return 'empty';
  if (occ < low) return 'low';
  return 'ok';
}

export function calcInventory(rois: ShelfROI[], frame: ImageData, bg: ImageData, thrLow: number, thrEmpty: number): Inventory[] {
  return rois.map(r => {
    const occ = occupancy(frame, bg, r.rect);
    return { shelfId: r.id, occupied: occ, state: decideState(occ, thrLow, thrEmpty) };
  });
}