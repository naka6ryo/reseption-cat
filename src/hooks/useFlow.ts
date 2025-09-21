// src/hooks/useFlow.ts
import { useEffect, useRef, useState } from 'react';
import { speak, speakAll, preloadTTS, initVoiceVox } from './useSpeech';
import { useAppStore } from '../store/useAppStore';

export type FlowState = 'IDLE' | 'WELCOME' | 'GUIDE' | 'PAY_WAIT' | 'THANKS';

export function useFlow() {
  const [state, setState] = useState<FlowState>('IDLE');
  const inventory = useAppStore((s) => s.inventory);
  const rois = useAppStore((s) => s.config.rois);

  // 起動時にVOIVEVOXをウォームアップ（可能なら）
  useEffect(() => {
    (async () => {
      try { await initVoiceVox(); } catch {}
    })();
  }, []);

  // 在庫・ROI変化時に、売り切れ案内を先読み生成
  useEffect(() => {
    try {
      const soldOut = inventory
        .filter((i) => i.state === 'empty')
        .map((i) => rois.find((r) => r.id === i.shelfId)?.name)
        .filter((n): n is string => !!n);
      // 先に歓迎と、必要なら売り切れ案内を分割してプリロード
      try { preloadTTS('いらっしゃいませニャー！').catch(()=>{}); } catch {}
      if (soldOut.length > 0) {
        const names = soldOut.join(' と ');
        const apology = `${names} は売り切れたのにゃ。ごめんなさいにゃーあ。`;
        try { preloadTTS(apology).catch(()=>{}); } catch {}
      }
    } catch {}
  }, [inventory, rois]);

  const prevPresent = useRef(false);
  const lastWelcomeAt = useRef(0);
  const lastThanksAt = useRef(0);
  const lastPayAt = useRef(0);
  const lastEnterAt = useRef(0);
  const welcomeSeq = useRef(0);
  const presentRef = useRef(false);
  const entrySeqRef = useRef(0);

  // 調整用（必要なら変更OK）
  const WELCOME_COOLDOWN_MS = 5000;
  const THANKS_COOLDOWN_MS = 4000;
  const DEPART_SKIP_AFTER_PAY_MS = 4000;
  const MIN_STAY_FOR_DEPART_THANKS_MS = 1500;
  const THANKS_DURATION_MS = 1500; // 表示時間（アニメ/セリフ）
  const WELCOME_ENTER_HOLD_MS = 1000; // ★ 追加：1秒連続で見えたら歓迎

  const safeSpeak = (t: string) => { try { speak(t); } catch {} };

  function onPresence(present: boolean) {
    presentRef.current = present;
    const now = performance.now();

    // --- 入店: 0 -> 1 ---
    if (present && !prevPresent.current) {
      lastEnterAt.current = now;
      // 立ち上がり時に、1秒後にまだ見えていれば歓迎を発火
      entrySeqRef.current += 1;
      const mySeq = entrySeqRef.current;
      setTimeout(() => {
        const stillSameEntry = mySeq === entrySeqRef.current;
        const stillPresent = presentRef.current;
        const now2 = performance.now();
        const cooldownOk = (now2 - lastWelcomeAt.current) > WELCOME_COOLDOWN_MS;
        if (
          stillSameEntry &&
          stillPresent &&
          cooldownOk &&
          state === 'IDLE'
        ) {
          lastWelcomeAt.current = now2;
          setState('WELCOME');
          welcomeSeq.current += 1;
          queueMicrotask(async () => {
            try { await initVoiceVox(); } catch {}
            const soldOut = inventory
              .filter((i) => i.state === 'empty')
              .map((i) => rois.find((r) => r.id === i.shelfId)?.name)
              .filter((n): n is string => !!n);
            if (soldOut.length > 0) {
              const names = soldOut.join(' と ');
              const apology = `${names} は売り切れたのにゃ。ごめんなさいにゃーあ。`;
              // 歓迎→売り切れの順に確実に再生（第一声はすぐ始めたい）
              try { await speakAll(['いらっしゃいませニャー！', apology]); } catch { safeSpeak('いらっしゃいませニャー！'); safeSpeak(apology); }
            } else {
              safeSpeak('いらっしゃいませニャー！');
            }
          });
          setTimeout(() => setState('GUIDE'), 1200);
        }
      }, WELCOME_ENTER_HOLD_MS);
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
      safeSpeak('ありがとうにゃ！また来てにゃ！');
      setTimeout(() => setState('IDLE'), THANKS_DURATION_MS);
    }
  }

  // 追補発話はせず、歓迎時点の在庫で一続き発話（元の処理方針）

  return { state, onPresence, onPay };
}
