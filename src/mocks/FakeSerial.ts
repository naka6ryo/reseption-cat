export function createFakeSerial(onLine: (line: string) => void) {
  let closed = false;
  const writeLine = async (s: string) => {
    if (s.trim() === 'PING') setTimeout(() => onLine('PONG'), 100);
  };
  const disconnect = async () => { closed = true; };
  const inject = (line: string) => { if (!closed) onLine(line); };
  return { writeLine, disconnect, inject } as const;
}