// src/pages/DisplayPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import CatAnimator from '../components/CatAnimator';
import DebugPanel from '../components/DebugPanel';
import { useFlow } from '../hooks/useFlow';
import { useCamera } from '../hooks/useCamera';
import { useFace } from '../hooks/useFace';
import { connectSerial } from '../hooks/useSerial';
import { useAppStore } from '../store/useAppStore';
import { createFakeSerial } from '../mocks/FakeSerial';

// ★ 追加：占有率（在庫）用のヘルパー
import { useFrameGrabber } from '../hooks/useFrame';
import { occupancy, decideState } from '../hooks/useInventory';

export default function DisplayPage() {
  const cfg = useAppStore((s) => s.config);
  const videoConstraints: MediaStreamConstraints = useMemo(() => {
    const devId = cfg.camera?.deviceId || undefined;
    if (devId) return { video: { deviceId: { exact: devId } }, audio: false };
    const facing = cfg.camera?.facingMode || 'environment';
    return { video: { facingMode: facing }, audio: false };
  }, [cfg.camera?.deviceId, cfg.camera?.facingMode]);
  const { videoRef } = useCamera(videoConstraints);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [leftOpen, setLeftOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('leftPaneOpen') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('leftPaneOpen', leftOpen ? '1' : '0'); } catch {}
  }, [leftOpen]);

  // 顔検出（present=顔の有無、boxes=顔の枠）
  // 顔が見えなくなってから不在にするまでの保持時間（ms）
  const FACE_EXIT_HOLD_MS = 3000; // 後から変更しやすいように定数化
  const { present, boxes, ready: faceReady } = useFace(videoRef, {
    scoreThr: 0.5,
    flipHorizontal: false,
    exitHoldMs: FACE_EXIT_HOLD_MS,
  });

  const { state, onPresence, onPay } = useFlow();
  const pushLog = useAppStore((s) => s.pushLog);
  const baud = useAppStore((s) => s.config.serial.baudRate);
  // cfg is already defined above
  const setConfig = useAppStore((s) => s.setConfig);
  const setInventory = useAppStore((s) => s.setInventory);
  const inventory = useAppStore((s) => s.inventory);

  const [connected, setConnected] = useState(false);
  const [lastRx, setLastRx] = useState<string | null>(null);
  const serialRef = useRef<{
    writeLine: (s: string) => Promise<void>;
    disconnect: () => Promise<void>;
    inject?: (l: string) => void;
  } | null>(null);

  const useFake = useMemo(
    () => new URLSearchParams(location.search).get('fakeSerial') === '1',
    []
  );

  // 顔の有無をフローへ通知（0→1立ち上がりで「いらっしゃいませ！」）
  useEffect(() => {
    onPresence(present);
  }, [present]);

  // FAKEモードは自動接続
  useEffect(() => {
    if (useFake && !connected) {
      void onConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useFake, connected]);

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
    } catch (e: any) {
      pushLog('connect error: ' + (e?.message || e));
    }
  };

  const handleLine = (line: string) => {
    const msg = line.trim(); // 余分な改行や空白を除去
    pushLog('« ' + msg);
    setLastRx(msg);

    // 既存の "PAY,1" に加えて、単独の "1" でもお礼フローを発火
    if (msg.startsWith('PAY,1') || msg === '1') {
      onPay();
    }
  };

  const onPing = async () => {
    if (!serialRef.current) return;
    await serialRef.current.writeLine('PING');
    pushLog('» PING');
  };

  // ====== ここから 在庫（占有率）計算の配線 ======
  const { grab } = useFrameGrabber(videoRef.current);

  // 背景（参照画像）を ImageData に展開して保持
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgRef = useRef<ImageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cfg.bgDataUrl) {
        bgRef.current = null;
        return;
      }
      const img = new Image();
      img.src = cfg.bgDataUrl;
      await img.decode();
      if (cancelled) return;
      const c =
        bgCanvasRef.current ?? (bgCanvasRef.current = document.createElement('canvas'));
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      bgRef.current = ctx.getImageData(0, 0, c.width, c.height);
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg.bgDataUrl]);

  // rAF で占有率を更新（ROIが設定され、背景もある時）
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const frame = grab();
      const bg = bgRef.current;
      if (faceReady && frame && bg && cfg.rois.length) {
        const inv = cfg.rois.map((r) => {
          const occ = occupancy(frame, bg, r.rect, 2, 140); // step=2, thr=30 は目安
          const state = decideState(occ, cfg.thresholds.low, cfg.thresholds.empty);
          return { shelfId: r.id, occupied: occ, state };
        });
        setInventory(inv);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [grab, cfg.rois, cfg.thresholds.low, cfg.thresholds.empty, setInventory, faceReady]);
  // ====== 在庫（占有率）ここまで ======

  // 顔の枠をビデオ上にオーバーレイ
  useEffect(() => {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    canvas.width = vw;
    canvas.height = vh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, vw, vh);

    // ROI の表示（在庫状態で色分け）
    const stateColor = (state: 'ok' | 'low' | 'empty' | undefined) => {
      switch (state) {
        case 'empty':
          return { stroke: '#ef4444', fill: 'rgba(239,68,68,0.15)' }; // red-500
        case 'low':
          return { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.15)' }; // amber-500
        case 'ok':
          return { stroke: '#22c55e', fill: 'rgba(34,197,94,0.12)' }; // emerald-500
        default:
          return { stroke: '#38bdf8', fill: 'rgba(56,189,248,0.12)' }; // sky-400
      }
    };

    cfg.rois.forEach((r) => {
      const inv = inventory.find((i) => i.shelfId === r.id);
      const colors = stateColor(inv?.state as any);
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.stroke;
      ctx.fillStyle = colors.fill;
      ctx.strokeRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
      ctx.fillRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
      // ラベル
      ctx.font = '14px ui-sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const label = inv
        ? `${r.name}  ${(inv.occupied * 100).toFixed(0)}%  ${inv.state}`
        : r.name;
      ctx.fillText(label, r.rect.x + 6, r.rect.y + 18);
    });

    boxes.forEach((b) => {
      ctx.lineWidth = 3;
      ctx.strokeStyle = present ? '#22c55e' : '#f97316';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.font = '16px ui-sans-serif';
      ctx.fillStyle = 'rgba(34,197,94,0.85)';
      ctx.fillText(`face ${(b.score * 100).toFixed(0)}%`, b.x + 6, b.y + 18);
    });
  }, [boxes, present, cfg.rois, inventory, videoRef.current?.videoWidth, videoRef.current?.videoHeight]);

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar with toggle */}
      <div className="flex items-center justify-end gap-2">
        <button
          className="px-3 py-1 rounded border text-sm"
          onClick={() => setLeftOpen(v => !v)}
          title={leftOpen ? '左ペインをしまう' : '左ペインをひらく'}
        >
          {leftOpen ? '左を閉じる' : '左を開く'}
        </button>
      </div>

      <div className="flex flex-row gap-4 items-start">
      {/* Left Pane: Camera + Debug */}
        <div
          className={
            (leftOpen
              ? 'flex-1 min-w-0 '
              : 'w-[1px] flex-[0_0_1px] overflow-hidden opacity-0 pointer-events-none ') +
            'flex flex-col items-stretch gap-3'
          }
          aria-hidden={!leftOpen}
        >
        {/* ビデオ + オーバーレイ */}
        <div className="relative w-full">
          <video
            ref={videoRef as any}
            autoPlay
            playsInline
            muted
            className="w-full rounded border block"
          />
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>

        <div className="text-sm text-slate-600 px-1">
          presence: {present ? '1' : '0'} / faces: {boxes.length} / serial:{' '}
          {connected ? 'connected' : 'disconnected'}{lastRx ? ` / rx: ${lastRx}` : ''}
        </div>

        <div className="flex gap-2 px-1">
          {!connected && (
            <button
              className="px-3 py-1 rounded bg-indigo-600 text-white"
              onClick={onConnect}
            >
              ポート選択して接続
            </button>
          )}
          {useFake && serialRef.current && 'inject' in (serialRef.current as any) && (
            <button
              className="px-3 py-1 rounded bg-slate-200"
              onClick={() => (serialRef.current as any).inject('PAY,1')}
            >
              FAKE PAY
            </button>
          )}
        </div>

        <DebugPanel
          onPing={onPing}
          onFakePay={
            useFake && serialRef.current && 'inject' in (serialRef.current as any)
              ? () => (serialRef.current as any).inject('PAY,1')
              : undefined
          }
          inventory={inventory}
        />
        </div>

      {/* Right Pane: Cat and Speech */}
      <div className="flex-1 min-w-0 flex flex-col items-center gap-3">
        <CatAnimator
          state={state}
          present={present}
          soldOutAtWelcome={
            state === 'WELCOME' && inventory.some((i) => i.state === 'empty')
          }
          subtitle={
            state === 'WELCOME'
              ? (() => {
                  const soldOut = inventory
                    .filter((i) => i.state === 'empty')
                    .map((i) => cfg.rois.find((r) => r.id === i.shelfId)?.name)
                    .filter((n): n is string => !!n);
                  if (soldOut.length === 0) return undefined;
                  const names = soldOut.join(' と ');
                  return `${names} は売り切れました。ごめんなさい。`;
                })()
              : undefined
          }
        />
      </div>
      </div>
    </div>
  );
}