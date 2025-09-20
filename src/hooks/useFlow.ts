// src/hooks/useFlow.ts
import { useEffect, useRef, useState } from 'react';
import { speak, speakAll, preloadTTS, initVoiceVox } from './useSpeech';
import { useAppStore } from '../store/useAppStore';

export type FlowState = 'IDLE' | 'WELCOME' | 'GUIDE' | 'PAY_WAIT' | 'THANKS';

export function useFlow() {
  const [state, setState] = useState<FlowState>('IDLE');
  const inventory = useAppStore((s) => s.inventory);
  const rois = useAppStore((s) => s.config.rois);

  // 在庫・ROI変化時に、売り切れ案内を先読み生成
  useEffect(() => {
    try {
      const soldOut = inventory
        .filter((i) => i.state === 'empty')
        .map((i) => rois.find((r) => r.id === i.shelfId)?.name)
        .filter((n): n is string => !!n);
      if (soldOut.length > 0) {
        const names = soldOut.join(' と ');
  const combined = `いらっしゃいませ！ ${names} は売り切れました。ごめんなさい。`;
        preloadTTS(combined).catch(()=>{});
      }
    } catch {}
  }, [inventory, rois]);

  const prevPresent = useRef(false);
  const lastWelcomeAt = useRef(0);
  const lastThanksAt = useRef(0);
  const lastPayAt = useRef(0);
  const lastEnterAt = useRef(0);
  const welcomeSeq = useRef(0);

  // 調整用（必要なら変更OK）
  const WELCOME_COOLDOWN_MS = 5000;
  const THANKS_COOLDOWN_MS = 4000;
  const DEPART_SKIP_AFTER_PAY_MS = 4000;
  const MIN_STAY_FOR_DEPART_THANKS_MS = 1500;
  const THANKS_DURATION_MS = 1500; // 表示時間（アニメ/セリフ）

  const safeSpeak = (t: string) => { try { speak(t); } catch {} };

  function onPresence(present: boolean) {
    const now = performance.now();

    // --- 入店: 0 -> 1 ---
    if (present && !prevPresent.current) {
      lastEnterAt.current = now;
      if ((now - lastWelcomeAt.current) > WELCOME_COOLDOWN_MS && state === 'IDLE') {
  lastWelcomeAt.current = now;
        setState('WELCOME');
        welcomeSeq.current += 1;
        // 一拍（microtask）置いてから在庫を評価（同期状態のズレ対策）
        queueMicrotask(async () => {
          try { await initVoiceVox(); } catch {}
          const soldOut = inventory
            .filter((i) => i.state === 'empty')
            .map((i) => rois.find((r) => r.id === i.shelfId)?.name)
            .filter((n): n is string => !!n);
          if (soldOut.length > 0) {
            const names = soldOut.join(' と ');
            const combined = `いらっしゃいませニャー！  ${names} は売り切れたのにゃ。ごめんなさいにゃーあ。`;
            try { preloadTTS(combined).catch(()=>{}); } catch {}
            safeSpeak(combined);
          } else {
            safeSpeak('いらっしゃいませニャー！');
          }
        });
        setTimeout(() => setState('GUIDE'), 1200);
      }
      prevPresent.current = present;
      return; // 入店処理したらここで終わり
    }

    // --- 退店: 1 -> 0 ---
    if (!present && prevPresent.current) {
      const stayedMs = now - lastEnterAt.current;
      const sincePay  = now - lastPayAt.current;
      const sinceThx  = now - lastThanksAt.current;

      const canThank =
        stayedMs >= MIN_STAY_FOR_DEPART_THANKS_MS &&
        sinceThx >= THANKS_COOLDOWN_MS &&
        sincePay >= DEPART_SKIP_AFTER_PAY_MS;

      if (canThank) {
        lastThanksAt.current = now;
        setState('THANKS');           // ← THANKSに遷移
        safeSpeak('ありがとうございましたニャー！');
        setTimeout(() => setState('IDLE'), THANKS_DURATION_MS); // 表示を維持
        prevPresent.current = present;
        return;                       // ★ ここで早期リターン：IDLEで上書きしない
      } else {
        setState('IDLE');             // 条件未満なら静かにIDLE
        prevPresent.current = present;
        return;
      }
    }

    // --- それ以外の定常状態 ---
    if (!present && state !== 'THANKS') {
      setState('IDLE');
    }

    prevPresent.current = present;
  }

  function onPay() {
    const now = performance.now();
    if (now - lastThanksAt.current >= THANKS_COOLDOWN_MS) {
      lastPayAt.current = now;
      lastThanksAt.current = now;
      setState('THANKS');
      safeSpeak('ありがとうございます！');
      setTimeout(() => setState('IDLE'), THANKS_DURATION_MS);
    }
  }

  // 追補発話はせず、歓迎時点の在庫で一続き発話（元の処理方針）

  return { state, onPresence, onPay };
}
