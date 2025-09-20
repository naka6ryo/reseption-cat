import { memo, useMemo } from 'react';
import type { FlowState } from '../hooks/useFlow';

export default memo(function CatAnimator({ state }: { state: FlowState }) {
  // naive sprite: just switch CSS animation class by state
  const cls = useMemo(() => ({
    IDLE: 'animate-pulse',
    WELCOME: 'animate-bounce',
    GUIDE: 'animate-none',
    PAY_WAIT: 'animate-none',
    THANKS: 'animate-ping'
  }[state]), [state]);

  return (
    <div className="flex flex-col items-center gap-2">
      <img src="/cat-sprite.png" alt="cat" className={`w-64 h-64 object-contain ${cls}`} />
      <div className="text-xl font-semibold">
        {state === 'WELCOME' && 'いらっしゃいませ！'}
        {state === 'THANKS' && 'ありがとうございます！'}
        {state !== 'WELCOME' && state !== 'THANKS' && '…'}
      </div>
    </div>
  );
});