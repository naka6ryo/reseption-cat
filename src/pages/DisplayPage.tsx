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
  const { videoRef } = useCamera();
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  // 顔検出（present=顔の有無、boxes=顔の枠）
  const { present, boxes } = useFace(videoRef.current, {
    scoreThr: 0.5,
    flipHorizontal: false,
  });

  const { state, onPresence, onPay } = useFlow();
  const pushLog = useAppStore((s) => s.pushLog);
  const baud = useAppStore((s) => s.config.serial.baudRate);
  const cfg = useAppStore((s) => s.config);
  const setConfig = useAppStore((s) => s.setConfig);
  const setInventory = useAppStore((s) => s.setInventory);
  const inventory = useAppStore((s) => s.inventory);

  const [connected, setConnected] = useState(false);
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
    pushLog('« ' + line);
    if (line.startsWith('PAY,1')) onPay();
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
      if (frame && bg && cfg.rois.length) {
        const inv = cfg.rois.map((r) => {
          const occ = occupancy(frame, bg, r.rect, 2, 30); // step=2, thr=30 は目安
          const state = decideState(occ, cfg.thresholds.low, cfg.thresholds.empty);
          return { shelfId: r.id, occupied: occ, state };
        });
        setInventory(inv);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [grab, cfg.rois, cfg.thresholds.low, cfg.thresholds.empty, setInventory]);
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

    boxes.forEach((b) => {
      ctx.lineWidth = 3;
      ctx.strokeStyle = present ? '#22c55e' : '#f97316';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.font = '16px ui-sans-serif';
      ctx.fillStyle = 'rgba(34,197,94,0.85)';
      ctx.fillText(`face ${(b.score * 100).toFixed(0)}%`, b.x + 6, b.y + 18);
    });
  }, [boxes, present, videoRef.current?.videoWidth, videoRef.current?.videoHeight]);

  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      <div className="flex flex-col items-center gap-3">
        {/* ビデオ + オーバーレイ */}
        <div className="relative w-full max-w-md">
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

        <CatAnimator state={state} />

        <div className="text-sm text-slate-600">
          presence: {present ? '1' : '0'} / faces: {boxes.length} / serial:{' '}
          {connected ? 'connected' : 'disconnected'}
        </div>

        <div className="flex gap-2">
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
      </div>

      <DebugPanel
        onPing={onPing}
        onFakePay={
          useFake && serialRef.current && 'inject' in (serialRef.current as any)
            ? () => (serialRef.current as any).inject('PAY,1')
            : undefined
        }
        // ★ 在庫バーに渡す
        inventory={inventory}
      />
    </div>
  );
}