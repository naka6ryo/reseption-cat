// src/hooks/usePresence.ts
import { useEffect, useMemo, useRef, useState } from 'react';

type Opts = {
  // 画面をこの幅に縮小して処理（ノイズに強く＆速い）
  downscaleWidth?: number;
  // 1ピクセルを何個飛ばしでサンプリングするか（2 or 3が目安）
  step?: number;
  // 差分のしきい値（0–765 相当、RGB合計差）
  diffThr?: number;
  // 平滑化の強さ（0..1）、大きいほど直近に追従：0.2 目安
  emaAlpha?: number;
  // ヒステリシス：入場と退場のしきい値（比率）
  enterThr?: number; // 例: 0.020
  exitThr?: number;  // 例: 0.010
  // 「present=1」を確定するまで必要な連続時間
  holdMs?: number;   // 例: 800
};

export function usePresence(
  video: HTMLVideoElement | null,
  opts: Opts = {}
) {
  const {
    downscaleWidth = 320,
    step = 2,
    diffThr = 60,        // 1チャンネルじゃなくRGB合計差を見るので小さめでも十分
    emaAlpha = 0.2,
    enterThr = 0.020,    // 入場判定は少し高め
    exitThr = 0.010,     // 退場判定は少し低め（ヒステリシス）
    holdMs = 800,
  } = opts;

  const [present, setPresent] = useState(false);
  const [score, setScore] = useState(0); // 0..1（動きの量）
  const canvas = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const last = useRef<ImageData | null>(null);
  const ema = useRef(0);
  const enterStart = useRef<number | null>(null);

  // rAF ループ
  useEffect(() => {
    let stop = false;
    let raf = 0;

    const tick = () => {
      if (stop) return;

      if (video && video.readyState >= 2) {
        const vw = video.videoWidth || 0;
        const vh = video.videoHeight || 0;

        if (vw && vh) {
          // 処理負荷＆ノイズ低減のために縮小して解析
          const scale = downscaleWidth / vw;
          const w = Math.max(1, Math.round(vw * scale));
          const h = Math.max(1, Math.round(vh * scale));
          const c = canvas.current as HTMLCanvasElement;
          c.width = w; c.height = h;

          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          // 軽いぼかし（ノイズ低減）— 無ければ drawImage だけでも可
          ctx.filter = 'blur(1px)';
          ctx.drawImage(video, 0, 0, w, h);
          ctx.filter = 'none';

          const cur = ctx.getImageData(0, 0, w, h);

          if (last.current) {
            // 動きの比率を算出（RGB 合計差で簡易に）
            const a = last.current.data;
            const b = cur.data;
            let diff = 0, total = 0;
            for (let y = 0; y < h; y += step) {
              for (let x = 0; x < w; x += step) {
                const i = (y * w + x) * 4;
                const d =
                  Math.abs(b[i] - a[i]) +
                  Math.abs(b[i + 1] - a[i + 1]) +
                  Math.abs(b[i + 2] - a[i + 2]);
                if (d > diffThr) diff++;
                total++;
              }
            }
            const ratio = total ? diff / total : 0;

            // 指数移動平均で平滑化
            ema.current = ema.current * (1 - emaAlpha) + ratio * emaAlpha;
            setScore(ema.current);

            // デバッグ出力（差分計算後）
            console.debug('[presence]', { vw, vh, w, h, ratio, ema: ema.current });

            // ヒステリシス＋保持時間
            const now = performance.now();
            if (!present) {
              if (ema.current >= enterThr) {
                if (enterStart.current == null) enterStart.current = now;
                if (now - (enterStart.current ?? now) >= holdMs) {
                  setPresent(true);
                  enterStart.current = null;
                }
              } else {
                enterStart.current = null; // リセット
              }
            } else {
              // present=true の間は exitThr を下回るまでは維持
              if (ema.current < exitThr) {
                setPresent(false);
              }
            }
          } else {
            // 初回フレーム取り込み
            last.current = cur;
          }

          // 次フレーム用に更新
          if (last.current !== cur) {
            last.current = cur;
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [video, downscaleWidth, step, diffThr, emaAlpha, enterThr, exitThr, holdMs, present]);

  return { present, score };
}
