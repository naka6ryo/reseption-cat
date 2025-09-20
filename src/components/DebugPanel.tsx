import { useState } from 'react';
import InventoryBars from './InventoryBars';
import { useAppStore } from '../store/useAppStore';
import type { Inventory } from '../types';
import { speak } from '../hooks/useSpeech';

  // propsに inventory を受け取れるように
export default function DebugPanel({ onPing, onFakePay, inventory }: { onPing: ()=>void; onFakePay?: ()=>void; inventory?: Inventory[] }) {
  const [open, setOpen] = useState(false);
  const log = useAppStore(s => s.serialLog);
  const inv = inventory ?? [];
  // ...既存UIの上に在庫を差し込む
  return (
    <div className="border rounded-lg bg-white shadow p-4 w-full max-w-2xl text-lg">
      <div className="flex items-center justify-between">
  <h3 className="font-semibold text-xl">デバッグ</h3>
  <button className="underline" onClick={()=>setOpen(!open)}>{open? '閉じる':'開く'}</button>
      </div>

      {/* ★ 在庫バー */}
      <div className="mt-3">
        <div className="font-medium mb-2">在庫（占有率）</div>
        <InventoryBars data={inv} />
      </div>
      {open && (
        <div className="mt-2 space-y-3">
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded bg-slate-900 text-white" onClick={onPing}>PING</button>
            {onFakePay && (
              <button className="px-4 py-2 rounded bg-slate-200" onClick={onFakePay}>支払いテスト</button>
            )}
            <button
              className="px-4 py-2 rounded bg-emerald-600 text-white"
              onClick={() => speak('テストです。にゃん。')}
            >
              音声テスト
            </button>
          </div>
          <div className="h-52 overflow-auto border p-3 text-base bg-slate-50">
            {log.map((l,i)=>(<div key={i}>{l}</div>))}
          </div>
        </div>
      )}
  </div>
  );
}