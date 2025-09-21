import { create } from 'zustand';
import type { Config, Inventory } from '../types';

const defaultCfg: Config = {
  rois: [],
  items: [],
  thresholds: { empty: 0.15, low: 0.35, smoothFrames: 5 },
  serial: { baudRate: 115200 },
  camera: { facingMode: 'environment', deviceId: null },
  tts: { rate: 1, pitch: 1, volume: 1, engine: 'none', voicevoxSpeaker: 3, voicevoxIntonation: 2, allowFallbackToWeb: false },
  bgDataUrl: null, // ★ 追加
};

type State = {
  config: Config;
  inventory: Inventory[];
  setConfig: (p: Partial<Config>) => void;
  setInventory: (inv: Inventory[]) => void;
  serialLog: string[];
  pushLog: (l: string) => void;
};

export const useAppStore = create<State>((set, get) => ({
  config: defaultCfg,
  inventory: [],
  setConfig: (p) => set({ config: { ...get().config, ...p } }),
  setInventory: (inventory) => set({ inventory }),
  serialLog: [],
  pushLog: (l) => set({ serialLog: [...get().serialLog.slice(-200), l] }),
}));

