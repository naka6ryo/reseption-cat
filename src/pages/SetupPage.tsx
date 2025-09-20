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
  const [editTargetId, setEditTargetId] = useState<string|undefined>(undefined);

  // ROI 追加用オーバーレイ
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const roisOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<{x:number;y:number}>({x:0,y:0});

  // ビデオサイズに合わせてオーバーレイの解像度を同期
  useEffect(()=>{
  const v = videoRef.current;
  const c = overlayRef.current;
  const ro = roisOverlayRef.current;
  if (!v || !c) return;
    const sync = () => {
      if (v.videoWidth && v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
    if (ro) { ro.width = v.videoWidth; ro.height = v.videoHeight; }
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
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = 'rgba(22,163,74,0.22)';
    ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.font = 'bold 20px ui-sans-serif';
  ctx.fillText('ここを四角で囲んでください', x + 8, y + 26);
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
    if (editTargetId) {
      // 既存ROIの置き換え
      const updated = cfg.rois.map(r => r.id === editTargetId ? { ...r, rect: { x, y, w, h } } : r);
      setConfig({ rois: updated });
    } else {
      // 新規追加
      const newRoi: ShelfROI = { id: uuid(), name: roiName || '棚', rect: { x, y, w, h } };
      setConfig({ rois: [...cfg.rois, newRoi] });
    }
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

  // 既存 ROI のプレビューを描画（見やすい太線と大きめ文字）
  useEffect(() => {
    const c = roisOverlayRef.current; const v = videoRef.current;
    if (!c || !v) return;
    if (!v.videoWidth || !v.videoHeight) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0,0,c.width,c.height);
    ctx.lineWidth = 3;
    for (const r of cfg.rois) {
      ctx.strokeStyle = '#ef4444';
      ctx.fillStyle = 'rgba(239,68,68,0.12)';
      ctx.strokeRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
      ctx.fillRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 18px ui-sans-serif';
      ctx.fillText(r.name, r.rect.x + 8, r.rect.y + 24);
    }
  }, [cfg.rois, videoRef.current?.videoWidth, videoRef.current?.videoHeight]);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* 左: 大きく分かりやすい手順 */}
      <section className="space-y-4">
        <h2 className="font-semibold text-3xl">かんたん設定（棚の位置）</h2>
        <ol className="space-y-3 text-2xl list-decimal pl-6">
          <li>棚が空の状態で「背景を撮る」を押します。</li>
          <li>下の映像で、棚の位置を四角くドラッグして囲みます。</li>
          <li>名前を入力して、もう一段の棚も同様に追加できます。</li>
        </ol>

  <div className="flex flex-wrap items-center gap-4">
    <button className="px-6 py-4 rounded bg-emerald-600 text-white text-2xl" onClick={captureBackground} aria-label="背景を撮る">
            背景を撮る
          </button>
    {cfg.bgDataUrl && <span className="text-xl text-emerald-700">背景を保存しました</span>}
        </div>

  {/* 左側の名前案内は撤去 */}

        <div className="relative w-full max-w-2xl mt-3">
          <video ref={videoRef as any} autoPlay playsInline muted className="w-full rounded border block" />
          {/* 既存ROIプレビュー */}
          <canvas ref={roisOverlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          {/* ROI 追加オーバーレイ（ドラッグ操作用） */}
          <canvas
            ref={overlayRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            className="absolute inset-0 w-full h-full cursor-crosshair"
          />
        </div>
      </section>

      {/* 右: 大きいボタンの棚リスト（微調整可能） */}
      <section className="space-y-4">
        <h2 className="font-semibold text-3xl">棚リスト（名前・位置の調整）</h2>
        <RoiEditor
          rois={cfg.rois}
          onChange={(r)=> setConfig({ rois: r })}
          nextName={roiName}
          onChangeNextName={setRoiName}
          editTargetId={editTargetId}
          onChangeEditTargetId={setEditTargetId}
        />

        <div className="pt-2 text-slate-700 text-xl">
          ヒント: ドラッグが難しい場合は、右側の「▲▼◀▶」ボタンで少しずつ動かせます。
        </div>
      </section>
    </div>
  );
}