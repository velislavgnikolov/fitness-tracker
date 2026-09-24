// Thin wrapper around the html5-qrcode library, loaded lazily from a CDN so
// pages that never scan a barcode don't pay for it. https://github.com/mebjas/html5-qrcode
const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
let loadPromise = null;

function loadLibrary() {
  if (window.Html5Qrcode) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Неуспешно зареждане на скенера'));
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

// Starts scanning barcodes with the rear camera into the element with the
// given id, calling onDetected(text) once with the first successful read
// (already stopped by then). Resolves with a stop() you can call early -
// e.g. if the user cancels - safe to call even more than once.
export async function startBarcodeScan(elementId, onDetected) {
  await loadLibrary();
  const scanner = new window.Html5Qrcode(elementId);
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try { await scanner.stop(); } catch (e) { /* never started or already stopped */ }
  };

  await scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 260, height: 160 } },
    async (decodedText) => {
      await stop();
      onDetected(decodedText);
    },
    () => {} // ignore per-frame misses while still scanning
  );

  return stop;
}
