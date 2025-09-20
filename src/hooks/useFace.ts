// src/hooks/useFace.ts
import { useEffect, useRef, useState } from 'react';
import * as blazeface from '@tensorflow-models/blazeface';
import * as tf from '@tensorflow/tfjs';

export type FaceBox = { x: number; y: number; w: number; h: number; score: number };

export function useFace(
  video: HTMLVideoElement | null,
  {
    scoreThr = 0.95,        // 少し緩めに（0.5〜0.7で調整）
    flipHorizontal = false, // 自撮り鏡像にしたい場合は true
    maxFaces = 5,
  }: { scoreThr?: number; flipHorizontal?: boolean; maxFaces?: number } = {}
) {
  const [boxes, setBoxes] = useState<FaceBox[]>([]);
  const [present, setPresent] = useState(false);
  const modelRef = useRef<blazeface.BlazeFaceModel | null>(null);
  const stopRef = useRef(false);
  const loggedRef = useRef(0);

  useEffect(() => {
    stopRef.current = false;

    (async () => {
      // backend 初期化（webgl → ダメなら cpu）
      try { await tf.setBackend('webgl'); } catch {}
      await tf.ready();
      if (tf.getBackend() !== 'webgl') {
        // 一部環境で webgl が封鎖されていることがある
        try { await tf.setBackend('cpu'); await tf.ready(); } catch {}
      }
      if (loggedRef.current < 3) {
        console.debug('[face] tf backend:', tf.getBackend());
        loggedRef.current++;
      }

      // モデル読込（しきい値はここでも指定できる）
      modelRef.current = await blazeface.load({
        maxFaces,
        iouThreshold: 0.3,
        scoreThreshold: scoreThr, // ここも緩めに
      });

      // 1回ウォームアップ（ビデオまだならスキップ可）
      if (video && video.videoWidth > 0) {
        try { await modelRef.current.estimateFaces(video, false); } catch {}
      }

      loop();
    })();

    return () => { stopRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loop = async () => {
    if (stopRef.current) return;

    const v = video;
    if (v && v.videoWidth > 0 && v.videoHeight > 0 && modelRef.current) {
      // ★ 重要：video をそのまま入れる（canvas 経由はやめる）
      // 返りは { topLeft:[x,y], bottomRight:[x,y], probability:[p] } の配列（ピクセル座標）
      let preds: any[] = [];
      try {
        preds = await modelRef.current.estimateFaces(v, /*returnTensors=*/ false, /*flipHorizontal=*/ flipHorizontal);
      } catch (e) {
        if (loggedRef.current < 3) { console.debug('[face] estimate error:', e); loggedRef.current++; }
        preds = [];
      }

      const faces: FaceBox[] = [];
      for (const p of preds) {
        const prob = Array.isArray(p.probability) ? Number(p.probability[0] ?? 0) : (p.probability ?? 0);
        if (prob < scoreThr) continue;
        const [x1, y1] = Array.isArray(p.topLeft) ? p.topLeft : [p.topLeft[0], p.topLeft[1]];
        const [x2, y2] = Array.isArray(p.bottomRight) ? p.bottomRight : [p.bottomRight[0], p.bottomRight[1]];
        faces.push({ x: Number(x1), y: Number(y1), w: Number(x2 - x1), h: Number(y2 - y1), score: prob });
      }

      if (loggedRef.current < 3) {
        console.debug('[face] faces:', faces.length, faces[0]);
        loggedRef.current++;
      }

      setBoxes(faces);
      setPresent(faces.length > 0);
    }

    requestAnimationFrame(loop);
  };

  return { present, boxes };
}
