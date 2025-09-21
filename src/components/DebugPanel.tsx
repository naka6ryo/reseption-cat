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
  const cfg = useAppStore(s=>s.config);
  const setConfig = useAppStore(s=>s.setConfig);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  // Enumerate video inputs
  async function refreshDevices() {
    try {
      // ensure permissions hint by calling getUserMedia with no constraints? We avoid that; rely on already granted
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter(d => d.kind === 'videoinput'));
    } catch (e) {
      console.warn('enumerateDevices failed', e);
    }
  }
  // ...既存UIの上に在庫を差し込む
  return (
    <div className="border rounded-lg bg-white shadow p-4 w-full max-w-2xl text-lg">
      <div className="flex items-center justify-between">
  <h3 className="font-semibold text-xl">デバッグ</h3>
  <button className="underline" onClick={()=>setOpen(!open)}>{open? '閉じる':'開く'}</button>
      </div>

      {/* ★ 音声エンジンの切替 */}
      <div className="mt-3 flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span>音声エンジン:</span>
          <select
            className="border rounded px-2 py-1"
            value={cfg.tts.engine ?? 'none'}
            onChange={(e)=> setConfig({ tts: { ...cfg.tts, engine: e.target.value as any } })}
          >
            <option value="none">なし</option>
            <option value="web">ブラウザ</option>
            <option value="voicevox">VOICEVOX</option>
          </select>
        </label>
        {cfg.tts.engine === 'voicevox' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="scale-125 accent-indigo-600"
              checked={!!cfg.tts.allowFallbackToWeb}
              onChange={(e)=> setConfig({ tts: { ...cfg.tts, allowFallbackToWeb: e.target.checked } })}
            />
            失敗時にブラウザ声へフォールバック
          </label>
        )}
      </div>

      {/* ★ カメラ選択 */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span>向き:</span>
          <select
            className="border rounded px-2 py-1"
            value={cfg.camera?.facingMode ?? 'environment'}
            onChange={(e)=> setConfig({ camera: { ...(cfg.camera||{}), facingMode: e.target.value as any, deviceId: null } })}
          >
            <option value="environment">外カメ</option>
            <option value="user">内カメ</option>
          </select>
        </label>
        <button className="px-3 py-1 rounded border" onClick={refreshDevices}>カメラを更新</button>
        <label className="flex items-center gap-2">
          <span>デバイス:</span>
          <select
            className="border rounded px-2 py-1 max-w-[18rem]"
            value={cfg.camera?.deviceId ?? ''}
            onChange={(e)=> setConfig({ camera: { ...(cfg.camera||{}), deviceId: e.target.value || null } })}
          >
            <option value="">自動（向き優先）</option>
            {devices.map(d=> (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0,6)}…`}</option>
            ))}
          </select>
        </label>
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