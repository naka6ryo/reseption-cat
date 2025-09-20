import { useEffect, useMemo, useRef, useState } from 'react';
import CatAnimator from '../components/CatAnimator';
import DebugPanel from '../components/DebugPanel';
import { useFlow } from '../hooks/useFlow';
import { useCamera } from '../hooks/useCamera';
import { usePresence } from '../hooks/usePresence';
import { connectSerial } from '../hooks/useSerial';
import { useAppStore } from '../store/useAppStore';
import { createFakeSerial } from '../mocks/FakeSerial';

export default function DisplayPage() {
  const { videoRef } = useCamera();
  // 変更前:
    // const present = usePresence(videoRef.current);

    // 変更後:
    const { present, score } = usePresence(videoRef.current, {
    enterThr: 0.001,   // お店前で少し動けば入店扱い
    exitThr: 0.008,    // 小さく落ちたら退場扱い（ヒステリシス）
    holdMs: 300,       // 0.8秒続いたら入店確定
    emaAlpha: 0.2,     // 平滑化の強さ（0.1~0.3で調整）
    step: 2,           // サンプリング間引き
    diffThr: 60,       // 差分しきい値（ノイズ強ければ上げる）
    downscaleWidth: 320,
    });

  const { state, onPresence, onPay } = useFlow();
  const pushLog = useAppStore(s=>s.pushLog);
  const baud = useAppStore(s=>s.config.serial.baudRate);
  const [connected, setConnected] = useState(false);
  const serialRef = useRef<{ writeLine:(s:string)=>Promise<void>; disconnect:()=>Promise<void>; inject?: (l:string)=>void } | null>(null);

  const useFake = useMemo(()=> new URLSearchParams(location.search).get('fakeSerial') === '1', []);

  useEffect(()=> { onPresence(present); }, [present]);

  const onConnect = async () => {
    try {
      if (useFake) {
        const fake = createFakeSerial(handleLine);
        serialRef.current = fake as any;
        setConnected(true);
        pushLog('[FAKE] connected');
        return;
      }
      const h = await connectSerial(baud, handleLine);
      serialRef.current = h;
      setConnected(true);
      pushLog('connected');
    } catch (e:any) { pushLog('connect error: ' + (e?.message||e)); }
  };

  const handleLine = (line: string) => {
    pushLog('« ' + line);
    if (line.startsWith('PAY,1')) onPay();
  };

  const onPing = async () => {
    if (!serialRef.current) return;
    await serialRef.current.writeLine('PING');
    pushLog('» PING');
  };

  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      <div className="flex flex-col items-center gap-3">
        <video ref={videoRef as any} autoPlay playsInline muted className="w-full max-w-md rounded border" />
        <CatAnimator state={state} />
        <div className="text-sm text-slate-600">presence: {present? '1':'0'} / serial: {connected? 'connected':'disconnected'}</div>
        <div className="flex gap-2">
          {!connected && <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={onConnect}>ポート選択して接続</button>}
          {useFake && serialRef.current && 'inject' in serialRef.current && (
            <button className="px-3 py-1 rounded bg-slate-200" onClick={()=> (serialRef.current as any).inject('PAY,1')}>FAKE PAY</button>
          )}
        </div>
      </div>

      <DebugPanel onPing={onPing} onFakePay={useFake && serialRef.current && 'inject' in serialRef.current ? ()=> (serialRef.current as any).inject('PAY,1') : undefined} />
    </div>
  );
}