import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function DebugPanel({ onPing, onFakePay }: { onPing: ()=>void; onFakePay?: ()=>void }) {
  const log = useAppStore(s => s.serialLog);
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-lg bg-white shadow p-3 w-full max-w-xl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Debug</h3>
        <button className="text-sm underline" onClick={()=>setOpen(!open)}>{open? 'hide':'show'}</button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded bg-slate-900 text-white" onClick={onPing}>PING</button>
            {onFakePay && (
              <button className="px-3 py-1 rounded bg-slate-200" onClick={onFakePay}>FAKE PAY</button>
            )}
          </div>
          <div className="h-40 overflow-auto border p-2 text-xs bg-slate-50">
            {log.map((l,i)=>(<div key={i}>{l}</div>))}
          </div>
        </div>
      )}
    </div>
  );
}