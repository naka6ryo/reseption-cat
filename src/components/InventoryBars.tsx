import type { Inventory } from '../types';
import { useAppStore } from '../store/useAppStore';

export default function InventoryBars({ data }: { data: Inventory[] }) {
  const rois = useAppStore(s=>s.config.rois);
  const name = (id:string)=> rois.find(r=>r.id===id)?.name ?? id;
  const color = (s:Inventory['state']) => s==='empty' ? 'bg-rose-500' : s==='low' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-2">
      {data.map(inv => (
        <div key={inv.shelfId}>
          <div className="text-xs text-slate-600 mb-1">{name(inv.shelfId)} — {inv.state} ({Math.round(inv.occupied*100)}%)</div>
          <div className="w-full h-2 bg-slate-200 rounded">
            <div className={`h-2 rounded ${color(inv.state)}`} style={{ width: `${Math.min(100, Math.max(0, inv.occupied*100))}%` }} />
          </div>
        </div>
      ))}
      {data.length===0 && <div className="text-xs text-slate-500">ROIがありません。</div>}
    </div>
  );
}
