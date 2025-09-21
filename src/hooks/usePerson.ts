import { useEffect, useRef, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';

export type PersonBox = { x: number; y: number; w: number; h: number; score: number };

export function usePerson(video: HTMLVideoElement | null, {
  scoreThr = 0.5,
  maxDetections = 5,
  downscaleWidth = 512,   // 軽さと精度のバランス
}: { scoreThr?: number; maxDetections?: number; downscaleWidth?: number } = {}) {
  const [present, setPresent] = useState(false);
  const [boxes, setBoxes] = useState<PersonBox[]>([]);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    stopRef.current = false;
    (async () => {
      await tf.ready();
      await tf.setBackend('webgl'); // CPUより高速
      modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' }); // 軽量版
      loop();
    })();

    return () => { stopRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loop = async () => {
    if (stopRef.current) return;

    if (video && video.videoWidth > 0 && video.videoHeight > 0 && modelRef.current) {
      // 高速化：drawImage で縮小したオフスクリーンCanvasを検出に使う
      const vw = video.videoWidth, vh = video.videoHeight;
      const scale = Math.min(1, downscaleWidth / vw);
      const dw = Math.round(vw * scale), dh = Math.round(vh * scale);

      const c = document.createElement('canvas');
      c.width = dw; c.height = dh;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(video, 0, 0, dw, dh);

      const preds = await modelRef.current.detect(c, maxDetections);
      // person のみ抽出し、元の座標系に戻す
      const persons: PersonBox[] = preds
        .filter(p => p.class === 'person' && p.score >= scoreThr)
        .map(p => {
          const [x, y, w, h] = p.bbox;                  // 縮小座標
          const inv = 1 / scale;                        // 元サイズへ戻す
          return { x: x * inv, y: y * inv, w: w * inv, h: h * inv, score: p.score };
        });

      setBoxes(persons);
      setPresent(persons.length > 0);
    }

    // 次フレーム
    requestAnimationFrame(loop);
  };

  return { present, boxes };
}
