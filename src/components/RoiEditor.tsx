import { useState } from 'react';
import type { ShelfROI } from '../types';
import { v4 as uuid } from 'uuid';

export default function RoiEditor({ rois, onChange, nextName, onChangeNextName, editTargetId, onChangeEditTargetId }:{ rois: ShelfROI[]; onChange:(r:ShelfROI[])=>void; nextName?: string; onChangeNextName?: (s:string)=>void; editTargetId?: string; onChangeEditTargetId?: (id?: string)=>void }) {
  const [fallbackName, setFallbackName] = useState('棚');
  const addRoi = () => {
    const nm = (nextName ?? fallbackName) || '棚';
    const r: ShelfROI = { id: uuid(), name: nm, rect: { x: 40, y: 40, w: 200, h: 120 } };
    onChange([...rois, r]);
  };
  const updateRoi = (id: string, patch: Partial<ShelfROI>) => {
    onChange(rois.map(r => r.id === id ? { ...r, ...patch, rect: { ...r.rect, ...(patch as any).rect } } : r));
  };
  const nudge = (id: string, dx=0, dy=0, dw=0, dh=0) => {
    const r = rois.find(x=>x.id===id); if (!r) return;
    updateRoi(id, { rect: { x: Math.max(0, r.rect.x + dx), y: Math.max(0, r.rect.y + dy), w: Math.max(5, r.rect.w + dw), h: Math.max(5, r.rect.h + dh) } } as any);
  };
  const del = (id: string) => {
    if (confirm('削除しますか？')) onChange(rois.filter(x=>x.id!==id));
  };

  return (
    <div className="space-y-4 text-lg">
      <div className="flex gap-3 items-center flex-wrap">
        <input
          className="border px-4 py-3 rounded text-xl"
          value={nextName ?? fallbackName}
          onChange={e=> onChangeNextName ? onChangeNextName(e.target.value) : setFallbackName(e.target.value)}
          aria-label="新しい棚の名前"
        />
        <button className="px-6 py-4 rounded bg-slate-900 text-white text-2xl" onClick={addRoi}>
          棚を追加
        </button>
      </div>

      <ul className="space-y-3">
        {rois.map(r=> (
          <li key={r.id} className="p-4 rounded border bg-white shadow-sm space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <input
                className="border px-4 py-3 rounded text-xl"
                value={r.name}
                onChange={e=> updateRoi(r.id, { name: e.target.value })}
                aria-label={`${r.name} の名前`}
              />
              <button className="px-5 py-3 rounded bg-rose-600 text-white text-lg" onClick={()=>del(r.id)}>
                削除
              </button>
              <label className="ml-auto flex items-center gap-3 text-xl">
                <input
                  type="checkbox"
                  checked={editTargetId === r.id}
                  onChange={e => onChangeEditTargetId?.(e.target.checked ? r.id : undefined)}
                  className="scale-125 accent-indigo-600"
                />
                ドラッグで編集
              </label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 items-center">
              <div className="col-span-3 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">位置</span>
                  <div className="flex gap-3">
                    <button className="px-4 py-3 rounded bg-slate-200 text-2xl" onClick={()=>nudge(r.id,-5,0)}>◀</button>
                    <div className="flex flex-col gap-3">
                      <button className="px-4 py-3 rounded bg-slate-200 text-2xl" onClick={()=>nudge(r.id,0,-5)}>▲</button>
                      <button className="px-4 py-3 rounded bg-slate-200 text-2xl" onClick={()=>nudge(r.id,0,5)}>▼</button>
                    </div>
                    <button className="px-4 py-3 rounded bg-slate-200 text-2xl" onClick={()=>nudge(r.id,5,0)}>▶</button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl">大きさ</span>
                  <div className="flex gap-3">
                    <button className="px-4 py-3 rounded bg-slate-200 text-xl" onClick={()=>nudge(r.id,0,0,-5,0)}>横を小さく</button>
                    <button className="px-4 py-3 rounded bg-slate-200 text-xl" onClick={()=>nudge(r.id,0,0,5,0)}>横を大きく</button>
                    <button className="px-4 py-3 rounded bg-slate-200 text-xl" onClick={()=>nudge(r.id,0,0,0,-5)}>縦を小さく</button>
                    <button className="px-4 py-3 rounded bg-slate-200 text-xl" onClick={()=>nudge(r.id,0,0,0,5)}>縦を大きく</button>
                  </div>
                </div>
              </div>
              {/* 座標表示は非表示に */}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}