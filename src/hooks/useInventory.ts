import type { Inventory, ShelfROI } from '../types';

// 占有率: RGBのユークリッド距離 d = sqrt((ΔR)^2 + (ΔG)^2 + (ΔB)^2)
// パフォーマンスのため sqrt は避け、(ΔR^2 + ΔG^2 + ΔB^2) > thr^2 で判定します。
// しきい値の目安: 60〜100 程度（環境光やカメラノイズに合わせて調整）
export function occupancy(
  frame: ImageData,
  bg: ImageData,
  roi: { x: number; y: number; w: number; h: number },
  step = 2,
  thr = 40,
) {
  const { width } = frame;
  const f = frame.data, b = bg.data;
  let total = 0, diff = 0;
  const thr2 = thr * thr;
  for (let y = roi.y; y < roi.y + roi.h; y += step) {
    for (let x = roi.x; x < roi.x + roi.w; x += step) {
      const i = (y * width + x) * 4;
      const dr = f[i] - b[i];
      const dg = f[i + 1] - b[i + 1];
      const db = f[i + 2] - b[i + 2];
      const d2 = dr * dr + dg * dg + db * db;
      if (d2 > thr2) diff++;
      total++;
    }
  }
  return total ? diff / total : 0;
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