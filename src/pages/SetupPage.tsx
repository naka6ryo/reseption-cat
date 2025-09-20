import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import RoiEditor from '../components/RoiEditor';
import { useCamera } from '../hooks/useCamera';
import { v4 as uuid } from 'uuid';
import type { ShelfROI } from '../types';

export default function SetupPage() {
  const cfg = useAppStore(s=>s.config);
  const { videoRef } = useCamera(); // ★ 追加：プレビューから背景を取る
  const setConfig = useAppStore(s=>s.setConfig);
  const [empty, setEmpty] = useState(cfg.thresholds.empty);
  const [low, setLow] = useState(cfg.thresholds.low);
  const [roiName, setRoiName] = useState('棚');

  // ROI 追加用オーバーレイ
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<{x:number;y:number}>({x:0,y:0});

  // ビデオサイズに合わせてオーバーレイの解像度を同期
  useEffect(()=>{
    const v = videoRef.current;
    const c = overlayRef.current;
    if (!v || !c) return;
    const sync = () => {
      if (v.videoWidth && v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
    };
    sync();
    v.addEventListener('loadedmetadata', sync);
    return () => v.removeEventListener('loadedmetadata', sync);
  }, [videoRef]);

  const getCanvasPos = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const c = overlayRef.current!;
    const rect = (c as HTMLCanvasElement).getBoundingClientRect();
    const x = ((ev.clientX - rect.left) * c.width) / rect.width;
    const y = ((ev.clientY - rect.top) * c.height) / rect.height;
    return { x: Math.max(0, Math.min(c.width, x)), y: Math.max(0, Math.min(c.height, y)) };
  };

  const clearOverlay = () => {
    const c = overlayRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
  };

  const drawRect = (a:{x:number;y:number}, b:{x:number;y:number}) => {
    const c = overlayRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(34,197,94,0.2)';
    ctx.fillRect(x, y, w, h);
  };

  const onMouseDown = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!videoRef.current) return;
    drawingRef.current = true;
    startRef.current = getCanvasPos(ev);
  };

  const onMouseMove = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const cur = getCanvasPos(ev);
    drawRect(startRef.current, cur);
  };

  const onMouseUp = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const end = getCanvasPos(ev);
    const a = startRef.current; const b = end;
    const x = Math.floor(Math.min(a.x, b.x));
    const y = Math.floor(Math.min(a.y, b.y));
    const w = Math.floor(Math.abs(b.x - a.x));
    const h = Math.floor(Math.abs(b.y - a.y));
    clearOverlay();
    if (w < 10 || h < 10) return; // 小さすぎるドラッグは無視
    const newRoi: ShelfROI = { id: uuid(), name: roiName || '棚', rect: { x, y, w, h } };
    setConfig({ rois: [...cfg.rois, newRoi] });
  };

  const captureBackground = () => {
    const v = videoRef.current!;
    if (!v || v.videoWidth === 0) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/png');
    setConfig({ bgDataUrl: url });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">カメラ / 背景キャプチャ & ROI 追加（ドラッグ）</h2>
        <div className="relative w-full max-w-md">
          <video ref={videoRef as any} autoPlay playsInline muted className="w-full rounded border block" />
          {/* ROI 追加オーバーレイ */}
          <canvas
            ref={overlayRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            className="absolute inset-0 w-full h-full cursor-crosshair"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">次のROI名</label>
          <input value={roiName} onChange={e=>setRoiName(e.target.value)} className="border px-2 py-1 rounded text-sm" />
          <button className="px-3 py-1 rounded bg-slate-900 text-white" onClick={captureBackground}>
            背景をキャプチャ
          </button>
          {cfg.bgDataUrl && <span className="text-xs text-emerald-600">背景保存済み</span>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">棚 ROI 設定</h2>
        <RoiEditor rois={cfg.rois} onChange={(r)=> setConfig({ rois: r })} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">閾値 / シリアル</h2>
        {/* 既存の empty / low / baud 入力はそのまま */}
      </section>
    </div>
  );
}