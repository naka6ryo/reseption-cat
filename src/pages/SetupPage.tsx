import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import RoiEditor from '../components/RoiEditor';

export default function SetupPage() {
  const cfg = useAppStore(s=>s.config);
  const setConfig = useAppStore(s=>s.setConfig);
  const [empty, setEmpty] = useState(cfg.thresholds.empty);
  const [low, setLow] = useState(cfg.thresholds.low);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">棚 ROI 設定</h2>
        <RoiEditor rois={cfg.rois} onChange={(r)=> setConfig({ rois: r })} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">閾値 / シリアル</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm">empty</label>
          <input type="number" step="0.01" className="border px-2 py-1 rounded w-24" value={empty} onChange={e=> setEmpty(parseFloat(e.target.value))} />
          <label className="text-sm">low</label>
          <input type="number" step="0.01" className="border px-2 py-1 rounded w-24" value={low} onChange={e=> setLow(parseFloat(e.target.value))} />
          <button className="px-3 py-1 rounded bg-slate-900 text-white" onClick={()=> setConfig({ thresholds: { ...cfg.thresholds, empty, low } })}>保存</button>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm">baud</label>
          <input type="number" className="border px-2 py-1 rounded w-28" value={cfg.serial.baudRate} onChange={e=> setConfig({ serial: { baudRate: parseInt(e.target.value||'115200',10) } })} />
        </div>
        <p className="text-xs text-slate-500">Web Serial は https または localhost でのみ動作します。</p>
      </section>
    </div>
  );
}