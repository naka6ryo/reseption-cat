import { useEffect, useRef, useState } from 'react';

export function useCamera(constraints: MediaStreamConstraints = { video: { facingMode: 'environment' }, audio: false }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    let mounted = true;
    // stop previous stream before switching
    try { stream?.getTracks().forEach((t) => t.stop()); } catch {}
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) { s.getTracks().forEach(t=>t.stop()); return; }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) {
        console.error('[camera] getUserMedia failed', e);
      }
    })();
    return () => {
      mounted = false;
      try { stream?.getTracks().forEach((t) => t.stop()); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(constraints)]);
  return { videoRef, stream };
}