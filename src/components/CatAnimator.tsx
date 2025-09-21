import { memo, useEffect, useMemo, useState } from 'react';
import type { FlowState } from '../hooks/useFlow';
// Five poses
import imgSleep from '../../image/cat_sleep.png';
import imgWelcome from '../../image/cat_welcom.png';
import imgSorry from '../../image/cat_sorry.png';
import imgWait from '../../image/cat_wait.png';
import imgHappy from '../../image/cat_happy.png';

export default memo(function CatAnimator({
  state,
  present,
  soldOutAtWelcome,
  subtitle,
}: {
  state: FlowState;
  present: boolean;
  soldOutAtWelcome?: boolean;
  subtitle?: string;
}) {
  // During WELCOME with sold-out, show Welcome first then switch to Sorry
  const [showApology, setShowApology] = useState(false);
  useEffect(() => {
    if (state === 'WELCOME' && soldOutAtWelcome) {
      setShowApology(false);
      const t = setTimeout(() => setShowApology(true), 600);
      return () => clearTimeout(t);
    } else {
      setShowApology(false);
    }
  }, [state, soldOutAtWelcome]);

  const cls = useMemo(() => {
    switch (state) {
      case 'WELCOME':
        return 'animate-bounce';
      case 'THANKS':
        return 'animate-ping';
      case 'IDLE':
        return 'opacity-90';
      default:
        return 'animate-none';
    }
  }, [state]);

  const src = useMemo(() => {
    if (state === 'THANKS') return imgHappy;               // 喜び
    if (state === 'WELCOME') return showApology ? imgSorry : imgWelcome; // いらっしゃい→謝罪
    // 待機（人がいるが操作待ち）
    if (present && (state === 'GUIDE' || state === 'PAY_WAIT')) return imgWait;
    // 人がいない → 睡眠
    if (!present) return imgSleep;
    // デフォルトは待機
    return imgWait;
  }, [state, present, showApology]);

  return (
    <div className="flex flex-col items-center gap-2">
      <img src={src} alt="cat" className={`w-64 h-64 object-contain ${cls}`} />
      <div className="text-2xl md:text-3xl font-semibold text-center">
        {state === 'WELCOME' && 'いらっしゃいませ！'}
        {state === 'THANKS' && 'ありがとうございます！'}
        {state !== 'WELCOME' && state !== 'THANKS' && '…'}
      </div>
      {subtitle && (
        <div className="text-xl md:text-2xl text-center text-slate-800">
          {subtitle}
        </div>
      )}
    </div>
  );
});