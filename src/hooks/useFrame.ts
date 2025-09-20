import { useEffect, useRef } from 'react';

export function useFrameGrabber(video: HTMLVideoElement | null) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(()=>{ if (!canvasRef.current) canvasRef.current = document.createElement('canvas'); },[]);
  const grab = (): ImageData | null => {
    const v = video;
    if (!v || v.videoWidth === 0) return null;
    const c = canvasRef.current!;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(v, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height);
  };
  return { grab };
}
