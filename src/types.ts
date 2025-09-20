export type ShelfROI = { id: string; name: string; rect: { x:number; y:number; w:number; h:number } };
export type InventoryState = 'ok' | 'low' | 'empty';
export type Inventory = { shelfId: string; occupied: number; state: InventoryState };

export type Item = { id: string; name: string; description?: string; shelfId?: string };

export type Config = {
  rois: ShelfROI[];
  items: Item[];
  thresholds: { empty: number; low: number; smoothFrames: number };
  serial: { baudRate: number };
  tts: {
    rate: number;
    pitch: number;
    volume: number;
    voice?: string; // Web Speech voice name or identifier
    engine?: 'web' | 'voicevox';
  voicevoxSpeaker?: number; // VOICEVOX speaker id (e.g., 3=ずんだもん等)
  voicevoxIntonation?: number; // VOICEVOX intonationScale (抑揚)
  };
  bgDataUrl?: string | null; // ★ 追加：背景画像（dataURL）
};

