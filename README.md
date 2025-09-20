# Reception Cat (Web Serial) — React + TypeScript + Vite

> 無人販売の受付猫アプリの雛形。Chrome (HTTPS or localhost) 上で、カメラ・TTS・**Web Serial** を用いた動作確認ができます。

## クイックスタート

```bash
npm create vite@latest reception-cat -- --template react-ts
cd reception-cat
# 既存ファイルを置き換え
# ↓この雛形のファイル群を上書きコピー
npm i
npm i -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/user-event
npx tailwindcss init -p
npm run dev
```

- `public/cat-sprite.png` を配置してください（任意の画像でも可）。
- 開発時は `http://localhost:5173` で表示されます。
- Web Serial は **HTTPS または localhost** のみで動作します。

## 主要機能
- `/display`: 猫＋セリフ、カメラ、デバッグパネル（**PING** / ログ）
- `/setup`: ROI/閾値/ボーレート設定（Zustand に保存）
- **Fake Serial**: `?fakeSerial=1` を URL に付けると、ハード無しで `PONG` 応答と `FAKE PAY` が使えます。

## 受け入れ基準 (MVP)
1. `/setup` で閾値/ROI を調整して保存
2. `/display` で「ポート選択して接続」→ `PING`→`PONG` を確認（Fake でも可）
3. `PAY,1` を受信すると「ありがとうございます！」のTTSと猫アニメが発火
4. カメラで動きがあれば 1.5 秒以内に「いらっしゃいませ！」（過剰発話は抑制）

## 注意事項
- 例外/切断時はログに出ます。再接続はページのボタンから。
- 実機シリアルの改行は `\n` 推奨（`\r\n` も受理）。
- M5 側参考スケッチは仕様書の付録を参照。
