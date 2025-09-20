// src/hooks/useFlow.ts（差し替え）
import { useRef, useState } from 'react';
import { speak } from './useSpeech';

export type FlowState = 'IDLE' | 'WELCOME' | 'GUIDE' | 'PAY_WAIT' | 'THANKS';

export function useFlow() {
  const [state, setState] = useState<FlowState>('IDLE');
  const prevPresent = useRef(false);
  const lastWelcomeAt = useRef(0);
  const WELCOME_COOLDOWN_MS = 5000; // 連発防止

  function onPresence(present: boolean) {
    const now = performance.now();

    // 0→1の立ち上がりで歓迎（クールダウン内は抑制）
    if (present && !prevPresent.current && state === 'IDLE' && (now - lastWelcomeAt.current) > WELCOME_COOLDOWN_MS) {
      lastWelcomeAt.current = now;
      setState('WELCOME');
      try { speak('いらっしゃいませ！'); } catch {}
      setTimeout(() => setState('GUIDE'), 1200);
    }

    // 人がいなくなったら IDLE（THANKS中は維持）
    if (!present && state !== 'THANKS') setState('IDLE');

    prevPresent.current = present;
  }

  function onPay() {
    setState('THANKS');
    try { speak('ありがとうございます！'); } catch {}
    setTimeout(() => setState('IDLE'), 1500);
  }

  return { state, onPresence, onPay };
}
