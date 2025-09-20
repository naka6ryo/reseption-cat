import { useState } from 'react';
import type { ShelfROI } from '../types';
import { v4 as uuid } from 'uuid';

export default function RoiEditor({ rois, onChange }:{ rois: ShelfROI[]; onChange:(r:ShelfROI[])=>void }) {
  const [name, setName] = useState('棚');
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <input className="border px-2 py-1 rounded" value={name} onChange={e=>setName(e.target.value)} />
        <button className="px-3 py-1 rounded bg-slate-900 text-white" onClick={()=>{
          const r: ShelfROI = { id: uuid(), name, rect: { x: 40, y: 40, w: 160, h: 100 } };
          onChange([...rois, r]);
        }}>ROI追加</button>
      </div>
      <ul className="space-y-1 text-sm">
        {rois.map(r=> (
          <li key={r.id} className="flex items-center gap-2">
            <span className="font-mono">{r.name}</span>
            <span className="text-xs text-slate-500">x:{r.rect.x} y:{r.rect.y} w:{r.rect.w} h:{r.rect.h}</span>
            <button className="text-xs underline" onClick={()=> onChange(rois.filter(x=>x.id!==r.id))}>削除</button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">※ 簡易エディタ（ドラッグ操作は最小）。運用で必要なら Canvas ドラッグに差し替え可。</p>
    </div>
  );
}