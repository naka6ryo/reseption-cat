import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import RoiEditor from '../components/RoiEditor';
import { useCamera } from '../hooks/useCamera';

export default function SetupPage() {
  const cfg = useAppStore(s=>s.config);
  const { videoRef } = useCamera(); // ★ 追加：プレビューから背景を取る
  const setConfig = useAppStore(s=>s.setConfig);
  const [empty, setEmpty] = useState(cfg.thresholds.empty);
  const [low, setLow] = useState(cfg.thresholds.low);

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
        <h2 className="font-semibold text-lg">カメラ / 背景キャプチャ</h2>
        <video ref={videoRef as any} autoPlay playsInline muted className="w-full max-w-md rounded border" />
        <div className="flex gap-2">
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