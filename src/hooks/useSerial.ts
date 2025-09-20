export type SerialHandle = {
  writeLine: (s: string) => Promise<void>;
  disconnect: () => Promise<void>;
};

export function parseLinesFactory(onLine: (l: string)=>void) {
  let buf = '';
  return (chunk: string) => {
    buf += chunk ?? '';
    let idx;
    while ((idx = buf.search(/\r?\n/)) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + (buf[idx] === '\r' && buf[idx+1] === '\n' ? 2 : 1));
      if (line) onLine(line);
    }
    if (buf.length > 4096) buf = ''; // safety
  };
}

export async function connectSerial(baud = 115200, onLine: (line: string)=>void): Promise<SerialHandle> {
  if (!('serial' in navigator)) throw new Error('Web Serial not supported. Use Chrome with https or localhost.');
  const port = await (navigator as any).serial.requestPort();
  await port.open({ baudRate: baud, dataBits: 8, stopBits: 1, parity: 'none' });

  const decoder = new TextDecoderStream();
  const closed = port.readable.pipeTo(decoder.writable);
  const reader = decoder.readable.getReader();
  const push = parseLinesFactory(onLine);

  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) push(value);
      }
    } catch {}
    finally { reader.releaseLock(); }
  })();

  const writer = port.writable.getWriter();
  const writeLine = async (s: string) => {
    const data = new TextEncoder().encode(s.endsWith('\n') ? s : s + '\n');
    await writer.write(data);
  };

  const disconnect = async () => {
    try { writer.releaseLock(); } catch {}
    try { await closed; } catch {}
    await port.close();
  };

  return { writeLine, disconnect };
}