// ═══════════════════════════════════════════════════════════════
// Audio Analyzer — extracts bass/mid/treble from audio playback
//
// IMPORTANT: An AudioElement can only be connected to ONE AudioContext
// via createMediaElementSource. This module owns that connection.
// For export, use getExportStream() which taps into the SAME context.
// ═══════════════════════════════════════════════════════════════

export function createAudioAnalyzer() {
  let audioContext = null;
  let analyzer = null;
  let source = null;
  let gainNode = null;  // export fades
  let normNode = null;  // normalization gain
  let duckNode = null;  // TTS ducking (independent of fades)
  let connectedElement = null;
  let exportDest = null; // MediaStreamDestination for video export

  function connect(audioElement) {
    if (!audioElement || connectedElement === audioElement) return;

    // Clean up previous
    if (audioContext) {
      try { audioContext.close(); } catch (e) {}
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 1024;
    analyzer.smoothingTimeConstant = 0.65;

    // Create the one and only MediaElementSource for this audio element
    source = audioContext.createMediaElementSource(audioElement);

    // GainNode for fade in/out on export
    gainNode = audioContext.createGain();
    gainNode.gain.value = 1;

    // NormNode for audio normalization
    normNode = audioContext.createGain();
    normNode.gain.value = 1;

    // DuckNode for TTS ducking (separate from fades)
    duckNode = audioContext.createGain();
    duckNode.gain.value = 1;

    // Create a MediaStreamDestination for export (always ready)
    exportDest = audioContext.createMediaStreamDestination();

    // Route: source → analyzer → gainNode (fades) → normNode (normalization) → duckNode (ducking) → destination + exportDest
    source.connect(analyzer);
    analyzer.connect(gainNode);
    gainNode.connect(normNode);
    normNode.connect(duckNode);
    duckNode.connect(audioContext.destination);
    duckNode.connect(exportDest);

    connectedElement = audioElement;
  }

  /**
   * Schedule audio fade in and/or fade out using AudioContext clock (sample-accurate).
   * Call this just before starting export playback.
   */
  function scheduleFades(fadeInDur, fadeOutDur, totalDur) {
    if (!gainNode || !audioContext) return;
    const now = audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    if (fadeInDur > 0) {
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(1, now + fadeInDur);
    } else {
      gainNode.gain.setValueAtTime(1, now);
    }
    if (fadeOutDur > 0 && totalDur > fadeOutDur) {
      gainNode.gain.setValueAtTime(1, now + Math.max(0, totalDur - fadeOutDur));
      gainNode.gain.linearRampToValueAtTime(0, now + totalDur);
    }
  }

  function resume() {
    if (audioContext?.state === 'suspended') {
      audioContext.resume();
    }
  }

  /**
   * Returns a MediaStream containing the audio tracks.
   * Used by VideoExporter to mux audio into the recorded video.
   * This uses the SAME AudioContext — no duplicate connection.
   */
  function getExportStream() {
    if (!exportDest) return null;
    return exportDest.stream;
  }

  /**
   * Duck or restore music gain around TTS playback.
   * Uses a separate duckNode so export fades are unaffected.
   * @param {number} targetValue - 0.15 to duck, 1.0 to restore
   * @param {number} rampDuration - seconds for the ramp (default 0.3)
   */
  function duckGain(targetValue, rampDuration = 0.3) {
    if (!duckNode || !audioContext) return;
    const now = audioContext.currentTime;
    duckNode.gain.cancelScheduledValues(now);
    duckNode.gain.setValueAtTime(duckNode.gain.value, now);
    duckNode.gain.linearRampToValueAtTime(targetValue, now + rampDuration);
  }

  /**
   * Create a FRESH Audio element from a blob URL and connect it to the
   * export stream. Each call creates a new element so createMediaElementSource
   * is always valid (no single-connection limitation).
   * Returns the Audio element; call .play() when you want it to start.
   */
  function connectFreshAudioForExport(blobUrl) {
    if (!audioContext || !exportDest) return null;
    try {
      const el = new Audio(blobUrl);
      const src = audioContext.createMediaElementSource(el);
      src.connect(exportDest);
      src.connect(audioContext.destination);
      console.log('[TTS] Fresh audio element connected to exportDest');
      return el;
    } catch (e) {
      console.warn('[TTS] connectFreshAudioForExport failed:', e);
      return null;
    }
  }

  function getBands() {
    if (!analyzer) return { bass: 0, mid: 0, treble: 0 };

    const data = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(data);

    const len = data.length;
    // Focus on lower spectrum for VGM
    const bassEnd = Math.floor(len * 0.12);
    const midEnd = Math.floor(len * 0.45);

    let bass = 0, mid = 0, treble = 0;
    for (let i = 0; i < len; i++) {
      if (i < bassEnd) bass += data[i];
      else if (i < midEnd) mid += data[i];
      else treble += data[i];
    }

    return {
      bass: Math.min(1, bass / (bassEnd * 255)),
      mid: Math.min(1, mid / ((midEnd - bassEnd) * 255)),
      treble: Math.min(1, treble / ((len - midEnd) * 255)),
    };
  }

  function getAverage() {
    if (!analyzer) return 0;
    const data = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(data);
    return data.reduce((a, b) => a + b, 0) / (data.length * 255);
  }

  /**
   * Returns raw frequency data normalized to 0-1 for each bin.
   * Used by the circular equalizer.
   */
  function getFrequencyData() {
    if (!analyzer) return new Float32Array(64);
    const data = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteFrequencyData(data);
    const normalized = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      normalized[i] = data[i] / 255;
    }
    return normalized;
  }

  /**
   * Returns time-domain (waveform) data normalized to 0-1.
   * Used by the oscilloscope ring visualizer.
   */
  function getTimeDomainData() {
    if (!analyzer) return new Float32Array(128).fill(0.5);
    const data = new Uint8Array(analyzer.frequencyBinCount);
    analyzer.getByteTimeDomainData(data);
    const normalized = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      normalized[i] = data[i] / 255;
    }
    return normalized;
  }

  function setNormGain(value) {
    if (normNode) normNode.gain.value = value;
  }

  return { connect, resume, getBands, getAverage, getFrequencyData, getTimeDomainData, getExportStream, scheduleFades, connectFreshAudioForExport, duckGain, setNormGain };
}
