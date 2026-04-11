// Waveform Worker — runs in an isolated thread so OOM can't crash the renderer.
// Receives: { buffer: ArrayBuffer }  (transferred, zero-copy)
// Posts:    { bars: number[] }  or  { error: string }

self.onmessage = async ({ data: { buffer } }) => {
  try {
    // OfflineAudioContext is available in Web Workers (Chromium / Electron)
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const audioBuffer = await ctx.decodeAudioData(buffer);

    const raw = audioBuffer.getChannelData(0);
    const N = 200;
    const blockSize = Math.floor(raw.length / N);

    if (blockSize === 0) {
      self.postMessage({ error: 'Audio too short' });
      return;
    }

    const bars = new Array(N);
    for (let i = 0; i < N; i++) {
      let sum = 0;
      const off = i * blockSize;
      for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[off + j] || 0);
      bars[i] = sum / blockSize;
    }

    const max = Math.max(...bars) || 1;
    self.postMessage({ bars: bars.map(b => b / max) });
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
