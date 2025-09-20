export function speak(text: string, opt?: Partial<SpeechSynthesisUtterance>) {
  const u = new SpeechSynthesisUtterance(text);
  Object.assign(u, { rate: 1.0, pitch: 1.0, volume: 1.0 }, opt);
  try { speechSynthesis.cancel(); } catch {}
  speechSynthesis.speak(u);
}