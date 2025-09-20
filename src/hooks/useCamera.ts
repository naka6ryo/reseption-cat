import { useEffect, useRef, useState } from 'react';

export function useCamera(constraints: MediaStreamConstraints = { video: { facingMode: 'environment' }, audio: false }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) return;
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { mounted = false; stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  return { videoRef, stream };
}