// ═══════════════════════════════════════════════════════════════
// Video Exporter — records the mono-canvas as WebM, optionally
// converts to MP4 via FFmpeg (Electron only).
//
// Supports:
// - Format choice: WebM or MP4
// - Bitrate/quality settings
// - Time range export (startTime → endTime of the audio)
// ═══════════════════════════════════════════════════════════════

// Bitrate presets by quality level
// VP9 is much more efficient than VP8 — same bitrate = much better quality
const QUALITY_PRESETS = {
  high:   { bitrate: 20_000_000, label: '1080×1920 High (20 Mbps)' },
  medium: { bitrate: 12_000_000, label: '1080×1920 Medium (12 Mbps)' },
  draft:  { bitrate: 6_000_000,  label: '1080×1920 Draft (6 Mbps)' },
};

export { QUALITY_PRESETS };

export function createExporter() {
  let mediaRecorder = null;
  let chunks = [];
  let progressCallback = null;
  let phaseCallback = null;
  let completeCallback = null;
  let progressInterval = null;
  let onStopCleanup = null;
  let cancelled = false;

  /**
   * @param {MediaStream} videoStream - From renderer.getStream()
   * @param {MediaStream|null} audioStream - From analyzer.getExportStream()
   * @param {object} options - Export options
   * @param {number} options.duration - Total recording duration in seconds
   * @param {string} options.format - 'webm' or 'mp4'
   * @param {string} options.quality - 'high' | 'medium' | 'draft'
   * @param {object} callbacks - { onProgress, onPhase, onComplete }
   */
  async function startExport(videoStream, audioStream, options = {}, callbacks = {}) {
    const {
      duration = 30,
      format = 'mp4',
      quality = 'high',
    } = options;

    progressCallback = callbacks.onProgress || (() => {});
    phaseCallback = callbacks.onPhase || (() => {});
    completeCallback = callbacks.onComplete || (() => {});

    chunks = [];
    cancelled = false;
    phaseCallback('recording');

    // ── Combine video + audio ──
    const combinedStream = new MediaStream();
    videoStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
    if (audioStream) {
      audioStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
      console.log('✅ Audio tracks added:', audioStream.getAudioTracks().length);
    }

    // ── MediaRecorder setup ──
    // VP9 = much better quality than VP8 at same bitrate
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

    const bitrate = QUALITY_PRESETS[quality]?.bitrate || QUALITY_PRESETS.high.bitrate;

    console.log(`📹 Recording: ${mimeType} @ ${(bitrate/1e6).toFixed(0)} Mbps, ${duration}s, format=${format}`);

    mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: bitrate,
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      if (cancelled) return;
      const blob = new Blob(chunks, { type: 'video/webm' });
      console.log('📦 WebM blob:', (blob.size / 1024 / 1024).toFixed(1), 'MB');

      if (onStopCleanup) onStopCleanup();

      if (format === 'mp4' && window.electronAPI?.isElectron) {
        await saveAsMp4(blob);
      } else if (window.electronAPI?.isElectron) {
        await saveAsWebm(blob);
      } else {
        // Browser fallback
        downloadBlob(blob, format === 'mp4' ? 'vgm-vinyl-export.webm' : 'vgm-vinyl-export.webm');
      }
    };

    mediaRecorder.start(33);

    // ── Progress ──
    const startTime = Date.now();
    const totalMs = duration * 1000;
    progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      progressCallback(Math.min(elapsed / totalMs, 0.99));
      if (elapsed >= totalMs) stopExport();
    }, 250);
  }

  // ── Save as WebM (Electron) ──
  async function saveAsWebm(blob) {
    phaseCallback('saving');
    const filePath = await window.electronAPI.saveExportDialog('vgm-vinyl-export.webm', 'webm');
    if (!filePath) {
      completeCallback({ success: false, error: 'Cancelled' });
      return;
    }
    const arrayBuffer = await blob.arrayBuffer();
    const result = await window.electronAPI.writeBlob(filePath, arrayBuffer);
    completeCallback(result.success
      ? { success: true, path: result.path }
      : { success: false, error: result.error }
    );
  }

  // ── Save as MP4 (Electron + FFmpeg) ──
  async function saveAsMp4(blob) {
    phaseCallback('converting');

    // 1. Ask user where to save the MP4
    const mp4Path = await window.electronAPI.saveExportDialog('vgm-vinyl-export.mp4', 'mp4');
    if (!mp4Path) {
      completeCallback({ success: false, error: 'Cancelled' });
      return;
    }

    // 2. Write WebM to temp file
    const tempDir = await window.electronAPI.getTempDir();
    const tempWebm = tempDir + '/vgm-vinyl-temp-' + Date.now() + '.webm';
    const arrayBuffer = await blob.arrayBuffer();
    const writeResult = await window.electronAPI.writeBlob(tempWebm, arrayBuffer);
    if (!writeResult.success) {
      completeCallback({ success: false, error: 'Failed to write temp file: ' + writeResult.error });
      return;
    }

    // 3. Convert via FFmpeg
    console.log('🔄 Converting WebM → MP4...');
    phaseCallback('converting');
    const convertResult = await window.electronAPI.convertToMp4(tempWebm, mp4Path);
    
    if (convertResult.success) {
      console.log('✅ MP4 saved:', convertResult.path);
      completeCallback({ success: true, path: convertResult.path });
    } else {
      console.error('❌ FFmpeg error:', convertResult.error);
      completeCallback({ success: false, error: 'FFmpeg: ' + convertResult.error });
    }
  }

  // ── Browser fallback download ──
  function downloadBlob(blob, filename) {
    phaseCallback('saving');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    completeCallback({ success: true, path: 'download' });
  }

  function setCleanup(fn) { onStopCleanup = fn; }

  function stopExport() {
    if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }

  function cancelExport() {
    cancelled = true;
    stopExport();
    chunks = [];
    if (onStopCleanup) { onStopCleanup(); onStopCleanup = null; }
    phaseCallback('');
    completeCallback({ success: false, error: 'Cancelled' });
  }

  return { startExport, stopExport, cancelExport, setCleanup };
}
