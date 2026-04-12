import React, { useState, useRef, useEffect, useCallback } from 'react';
import ControlPanel from './ui/ControlPanel';
import PreviewTimeline from './ui/PreviewTimeline';
import { createRenderer } from './engine/CanvasRenderer';
import { createAudioAnalyzer } from './engine/AudioAnalyzer';
import { createExporter } from './engine/VideoExporter';
export { STYLE_TEMPLATES } from './styleTemplates';

const DEFAULT_CONFIG = {
  trackTitle: 'Dire Dire Docks',
  artist: 'Koji Kondo',
  gameName: 'Super Mario 64',
  gameYear: '1996',
  gameStudio: 'Nintendo EAD',
  accentColor: '#a78bfa',
  fontColor: '#ffffff',
  cardBgColor: '#7c3aed',
  cardBorderColor: '#a78bfa',
  cardStyle: 'fullwidth',
  cardPositionY: 0.70,
  showParticles: true,
  showBlob: true,
  showEqualizer: true,
  showGameplay: true,
  showScanlines: true,
  equalizerStyle: 'bars',
  beatEffects: true,
  beatSensitivity: 1.2,
  beatIntensity: 1.0,
  colorFilter: 'none',
  colorFilterIntensity: 0.15,
  vignetteIntensity: 0.0,
  bgMode: 'file',
  bgColor: '#0d0d1a',
  showHookIntro: false,
  hookText: "You forgot this masterpiece...",
  hookTextFontSize: 42,
  hookDuration: 5,
  hookOverlayOpacity: 0.85,
  afterHookEnabled: false,
  afterHookLines: [""],
  afterHookDuration: 4,
  afterHookPositionY: 0.78,
  afterHookFontSize: 44,
  afterHookFont: "'Outfit', sans-serif",
  hookTTS: false,
  hookTTSProvider: 'system',  // 'system' | 'elevenlabs'
  hookTTSRate: 0.9,
  hookTTSPitch: 1.0,
  hookTTSVoice: '',
  hookTTSVoiceId: '',         // ElevenLabs voice ID
  hookTTSStability: 0.5,
  hookTTSSimilarity: 0.75,
  elevenLabsKey: '',
  watermarkEnabled: false,
  watermarkOpacity: 0.8,
  watermarkSize: 120,
  watermarkX: 0.85,
  watermarkY: 0.06,
  gameplayBrightness: 1,
  gameplayContrast: 1,
  gameplaySaturation: 1,
  gameplayHue: 0,
  beatSyncEffects: false,
  beatSyncTypes: ['zoom'],
  exportFormat: 'mp4',
  exportQuality: 'high',
  exportStart: 0,
  exportEnd: 30,
  exportFadeIn: 0,
  exportFadeOut: 1,
  normalizeAudio: false,
  vinylIntro: false,
  vinylIntroDuration: 1.5,
  gameplayTrimStart: 0,
  gameplayTrimEnd: 0,
  bgTrimStart: 0,
  bgTrimEnd: 0,
};

export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioName, setAudioName] = useState('');
  const [coverName, setCoverName] = useState('');
  const [bgName, setBgName] = useState('');
  const [gameImageName, setGameImageName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState('');
  const [exportStartTime, setExportStartTime] = useState(null);
  const [loopPreview, setLoopPreview] = useState(false);
  const loopPreviewRef = useRef(false);
  const [safeZoneMode, setSafeZoneMode] = useState(null); // null | 'tiktok' | 'shorts'
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 0, h: 0 });
  const hookVoiceRef = useRef(null);       // HTMLAudioElement for ElevenLabs hook audio
  const hookVoiceCacheRef = useRef(null);  // { key, url } – avoid regenerating same audio
  const triggerHookTTSRef = useRef(null);  // callable from rAF loop for loop-triggered TTS

  // Refs
  const canvasContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const rendererRef = useRef(null);
  const analyzerRef = useRef(null);
  const exporterRef = useRef(null);
  const bgVideoRef = useRef(null);
  const audioUrlRef = useRef(null);
  const bandsLoopRef = useRef(null);
  const configRef = useRef(config);
  const beatStateRef = useRef({ history: new Float32Array(60), idx: 0, lastBeat: 0 });

  // ── Undo / Redo ──
  const historyRef      = useRef([config]);
  const historyIdxRef   = useRef(0);
  const isUndoRedoRef   = useRef(false);
  const historyDebounce = useRef(null);
  const bgFileRef = useRef({ url: null, type: null }); // last loaded bg file, for restoring from color mode
  const progressFillRef = useRef(null);  // direct DOM update — no re-render
  const progressThumbRef = useRef(null);
  const progressTimeRef = useRef(null);
  const progressBarRef = useRef(null);
  const progressDraggingRef = useRef(false);
  const timelineCursorRef = useRef(null); // direct DOM update for timeline cursor
  const timelineTimeRef = useRef(null);   // direct DOM update for timeline time label

  // ══════════════════════════════════════════
  // NORMALIZATION
  // ══════════════════════════════════════════
  const [normGain, setNormGain] = useState(1);
  useEffect(() => {
    const gain = config.normalizeAudio ? normGain : 1;
    analyzerRef.current?.setNormGain(gain);
  }, [config.normalizeAudio, normGain]);

  // ══════════════════════════════════════════
  // CREDENTIALS PERSISTENCE
  // ══════════════════════════════════════════
  useEffect(() => {
    const saved = {
      elevenLabsKey:     localStorage.getItem('cred_elevenLabsKey')     || '',
      twitchClientId:    localStorage.getItem('cred_twitchClientId')    || '',
      twitchClientSecret:localStorage.getItem('cred_twitchClientSecret')|| '',
    };
    if (saved.elevenLabsKey || saved.twitchClientId || saved.twitchClientSecret) {
      setConfig(prev => ({ ...prev, ...saved }));
    }
  }, []);

  useEffect(() => {
    if (config.elevenLabsKey     !== undefined) localStorage.setItem('cred_elevenLabsKey',      config.elevenLabsKey);
    if (config.twitchClientId    !== undefined) localStorage.setItem('cred_twitchClientId',     config.twitchClientId);
    if (config.twitchClientSecret!== undefined) localStorage.setItem('cred_twitchClientSecret', config.twitchClientSecret);
  }, [config.elevenLabsKey, config.twitchClientId, config.twitchClientSecret]);

  // ══════════════════════════════════════════
  // INIT RENDERER
  // ══════════════════════════════════════════
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;
    canvasContainerRef.current.appendChild(canvas);

    const renderer = createRenderer(canvas);
    rendererRef.current = renderer;
    renderer.setConfig(configRef.current);
    renderer.start();

    analyzerRef.current = createAudioAnalyzer();
    exporterRef.current = createExporter();

    // Audio bands + frequency data + time → renderer loop
    function updateBands() {
      if (analyzerRef.current) {
        const bands = analyzerRef.current.getBands();
        const freq = analyzerRef.current.getFrequencyData();
        const timeData = analyzerRef.current.getTimeDomainData();
        renderer.setBands(bands);
        renderer.setFreqData(freq);
        renderer.setTimeDomainData(timeData);

        // Beat detection — transient: fast avg vs slow avg
        if (configRef.current.beatEffects !== false) {
          const state = beatStateRef.current;
          const slot = state.idx % 60;
          state.history[slot] = bands.bass;
          state.idx++;

          // Slow average: full 60-frame window (~1s)
          let slowSum = 0;
          for (let k = 0; k < 60; k++) slowSum += state.history[k];
          const slowAvg = slowSum / 60;

          // Fast average: last 8 frames (~130ms) — reacts to transients
          let fastSum = 0;
          for (let k = 0; k < 8; k++) fastSum += state.history[((state.idx - 1 - k) + 60) % 60];
          const fastAvg = fastSum / 8;

          // sensitivity 1.0 = fire on any spike above baseline
          // sensitivity 2.0 = only strong spikes
          const sensitivity = configRef.current.beatSensitivity ?? 1.2;
          const now = performance.now();
          if (fastAvg > slowAvg * sensitivity && fastAvg > 0.08 && now - state.lastBeat > 220) {
            state.lastBeat = now;
            renderer.triggerBeat(fastAvg);
            if (configRef.current.beatSyncEffects) {
              const types = configRef.current.beatSyncTypes || ['zoom'];
              const type = types[Math.floor(Math.random() * types.length)];
              renderer.triggerBeatSyncEffect(type, 0.28);
            }
          }
        }
      }
      // Send audio time for canvas progress ring
      if (audioRef.current && !isNaN(audioRef.current.duration)) {
        const ct = audioRef.current.currentTime || 0;
        const dur = audioRef.current.duration || 0;
        renderer.setAudioTime(ct, dur);

        // Update HTML progress bar — direct DOM, no React re-render
        if (!progressDraggingRef.current && dur > 0) {
          const pct = ct / dur * 100;
          if (progressFillRef.current) progressFillRef.current.style.width = pct + '%';
          if (progressThumbRef.current) progressThumbRef.current.style.left = pct + '%';
          if (progressTimeRef.current) {
            const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
            progressTimeRef.current.textContent = `${fmt(ct)} / ${fmt(dur)}`;
          }
          // Update timeline cursor
          const cfg = configRef.current;
          const expStart = cfg.exportStart || 0;
          const expEnd   = cfg.exportEnd   || dur;
          const expDur   = Math.max(1, expEnd - expStart);
          const tlPct    = Math.max(0, Math.min(100, ((ct - expStart) / expDur) * 100));
          if (timelineCursorRef.current) timelineCursorRef.current.style.left = tlPct + '%';
          if (timelineTimeRef.current) {
            const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(Math.max(0,s) % 60)).padStart(2, '0')}`;
            timelineTimeRef.current.textContent = `${fmt(ct - expStart)} / ${fmt(expDur)} export`;
          }
        }
      }
      // Preview loop: jump back to exportStart when reaching exportEnd
      if (loopPreviewRef.current && audioRef.current && !isNaN(audioRef.current.duration)) {
        const end = configRef.current.exportEnd || 0;
        const start = configRef.current.exportStart || 0;
        if (end > start && audioRef.current.currentTime >= end) {
          audioRef.current.currentTime = start;
          // Reset hook intro animation + re-trigger TTS at each loop
          rendererRef.current?.resetHookIntro();
          if (triggerHookTTSRef.current) triggerHookTTSRef.current();
        }
      }

      bandsLoopRef.current = requestAnimationFrame(updateBands);
    }
    updateBands();

    // Style the canvas to fit the preview area (scaled down from 1080×1920)
    function resizeCanvas() {
      const container = canvasContainerRef.current;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const aspect = 1080 / 1920;

      let displayW, displayH;
      if (cw / ch < aspect) {
        displayW = cw;
        displayH = cw / aspect;
      } else {
        displayH = ch;
        displayW = ch * aspect;
      }

      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
      canvas.style.borderRadius = '6px';
      canvas.style.cursor = 'pointer';
      canvas.style.boxShadow = '0 0 80px rgba(0,0,0,0.6)';
      setCanvasDisplaySize({ w: displayW, h: displayH });
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      renderer.stop();
      cancelAnimationFrame(bandsLoopRef.current);
      window.removeEventListener('resize', resizeCanvas);
      canvas.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync config to renderer + configRef ──
  useEffect(() => {
    rendererRef.current?.setConfig(config);
    configRef.current = config;

    // Push to undo history (debounced 400ms, skip if triggered by undo/redo)
    if (isUndoRedoRef.current) { isUndoRedoRef.current = false; return; }
    clearTimeout(historyDebounce.current);
    historyDebounce.current = setTimeout(() => {
      const next = historyRef.current.slice(0, historyIdxRef.current + 1);
      next.push({ ...config });
      historyRef.current = next.slice(-60); // keep last 60 states
      historyIdxRef.current = historyRef.current.length - 1;
    }, 400);
  }, [config]);

  // ── Sync loopPreview to ref (accessible in rAF closure) ──
  useEffect(() => { loopPreviewRef.current = loopPreview; }, [loopPreview]);

  // ── Sync background mode ──
  useEffect(() => {
    if (!rendererRef.current) return;
    if (config.bgMode === 'color') {
      rendererRef.current.setBackground(null, 'color');
    } else if (bgFileRef.current.url) {
      // Restore last loaded file when switching back from color mode
      if (bgFileRef.current.type === 'video' && bgVideoRef.current) {
        rendererRef.current.setBackgroundVideo(bgVideoRef.current);
      } else if (bgFileRef.current.url) {
        rendererRef.current.setBackground(bgFileRef.current.url, 'image');
      }
    }
  }, [config.bgMode]);

  // ── Sync playing state ──
  useEffect(() => {
    rendererRef.current?.setPlaying(isPlaying);
  }, [isPlaying]);

  // ══════════════════════════════════════════
  // AUDIO
  // ══════════════════════════════════════════
  const [audioDuration, setAudioDuration] = useState(0);
  const [waveformData, setWaveformData] = useState(null);


  const handleLoadAudio = useCallback((file) => {
    // Clean up previous audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);

    const url = URL.createObjectURL(file);
    audioUrlRef.current = url;
    setAudioName(file.name);
    setIsPlaying(false);

    // Create fresh audio element
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = url;
    audio.addEventListener('canplay', () => {
      analyzerRef.current.connect(audio);
    }, { once: true });
    audio.addEventListener('loadedmetadata', () => {
      const dur = Math.floor(audio.duration);
      setAudioDuration(dur);
      // Auto-set export end to full track duration
      setConfig(prev => ({ ...prev, exportEnd: dur }));
    });
    audio.addEventListener('ended', () => setIsPlaying(false));
    audioRef.current = audio;

    // Generate waveform in an isolated Worker — OOM stays in the Worker thread
    setWaveformData(null);
    const worker = new Worker(new URL('./engine/waveform.worker.js', import.meta.url));
    worker.onmessage = ({ data }) => {
      if (data.bars) setWaveformData(data.bars);
      worker.terminate();
    };
    worker.onerror = () => worker.terminate();
    // Use FileReader for Electron compatibility (file.arrayBuffer() can be unstable)
    const reader = new FileReader();
    reader.onload = () => {
      worker.postMessage({ buffer: reader.result }, [reader.result]);
    };
    reader.onerror = () => worker.terminate();
    reader.readAsArrayBuffer(file);
  }, []);

  async function generateWaveform(file) {
    try {
      // Read file as ArrayBuffer using FileReader (safer than file.arrayBuffer() in Electron)
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsArrayBuffer(file);
      });

      // Decode audio data in a temporary context
      const tempCtx = new AudioContext();
      let audioBuffer;
      try {
        audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        console.warn('decodeAudioData failed:', decodeErr);
        tempCtx.close().catch(() => {});
        setWaveformData(null);
        return;
      }

      // Compute peak across all channels for normalization
      let peak = 0;
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const ch = audioBuffer.getChannelData(c);
        for (let i = 0; i < ch.length; i++) {
          const abs = Math.abs(ch[i]);
          if (abs > peak) peak = abs;
        }
      }
      if (peak > 0) {
        const TARGET_PEAK = Math.pow(10, -1 / 20); // -1 dBFS
        setNormGain(Math.min(TARGET_PEAK / peak, 4.0)); // cap at +12 dB
      }

      const rawData = audioBuffer.getChannelData(0);
      tempCtx.close().catch(() => {});

      // Downsample to ~200 bars
      const numBars = 200;
      const blockSize = Math.floor(rawData.length / numBars);
      if (blockSize === 0) { setWaveformData(null); return; }

      const bars = [];
      for (let i = 0; i < numBars; i++) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[start + j] || 0);
        }
        bars.push(sum / blockSize);
      }
      const max = Math.max(...bars);
      if (max === 0) { setWaveformData(null); return; }
      setWaveformData(bars.map(b => b / max));
    } catch (e) {
      console.warn('Waveform generation failed:', e);
      setWaveformData(null);
    }
  }

  const generateElevenLabsVoice = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg.elevenLabsKey || !cfg.hookTTSVoiceId) return null;

    const text = cfg.hookText || 'You forgot this masterpiece...';
    const cacheKey = `${cfg.elevenLabsKey}|${cfg.hookTTSVoiceId}|${text}|${cfg.hookTTSStability}|${cfg.hookTTSSimilarity}`;

    if (hookVoiceCacheRef.current?.key === cacheKey) {
      return hookVoiceCacheRef.current.url;
    }

    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.hookTTSVoiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': cfg.elevenLabsKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: cfg.hookTTSStability ?? 0.5,
            similarity_boost: cfg.hookTTSSimilarity ?? 0.75,
          },
        }),
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
      const blob = await res.blob();
      if (hookVoiceCacheRef.current?.url) URL.revokeObjectURL(hookVoiceCacheRef.current.url);
      const url = URL.createObjectURL(blob);
      hookVoiceCacheRef.current = { key: cacheKey, url };
      return url;
    } catch (e) {
      console.error('ElevenLabs TTS error:', e);
      return null;
    }
  }, []);

  // Shared TTS trigger — used by togglePlay AND loop detection
  const playHookTTS = useCallback(() => {
    const cfg = configRef.current;
    if (!cfg.showHookIntro || !cfg.hookTTS) return;
    if (cfg.hookTTSProvider === 'elevenlabs' && cfg.elevenLabsKey && cfg.hookTTSVoiceId) {
      generateElevenLabsVoice().then(url => {
        if (!url) return;
        if (!hookVoiceRef.current) hookVoiceRef.current = new Audio();
        hookVoiceRef.current.src = url;
        analyzerRef.current.duckGain(0.15);
        hookVoiceRef.current.play().catch(() => {});
        hookVoiceRef.current.addEventListener('ended', () => {
          analyzerRef.current.duckGain(1.0);
        }, { once: true });
      });
    } else {
      const text = cfg.hookText || 'You forgot this masterpiece...';
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate  = cfg.hookTTSRate  ?? 0.9;
      utterance.pitch = cfg.hookTTSPitch ?? 1.0;
      if (cfg.hookTTSVoice) {
        const match = window.speechSynthesis.getVoices().find(v => v.name === cfg.hookTTSVoice);
        if (match) utterance.voice = match;
      }
      analyzerRef.current.duckGain(0.15);
      utterance.onend = () => analyzerRef.current.duckGain(1.0);
      window.speechSynthesis.speak(utterance);
    }
  }, [generateElevenLabsVoice]);

  // Keep ref in sync so rAF loop can call it without stale closure
  useEffect(() => { triggerHookTTSRef.current = playHookTTS; }, [playHookTTS]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    analyzerRef.current.resume();

    if (audio.paused) {
      rendererRef.current?.resetHookIntro();
      audio.play().then(() => {
        setIsPlaying(true);
        playHookTTS();
      }).catch(console.error);
    } else {
      audio.pause();
      window.speechSynthesis.cancel();
      hookVoiceRef.current?.pause();
      analyzerRef.current.duckGain(1.0);
      setIsPlaying(false);
    }
  }, [playHookTTS]);

  // ══════════════════════════════════════════
  // COVER ART
  // ══════════════════════════════════════════
  const handleLoadWatermark = useCallback((file) => {
    const url = URL.createObjectURL(file);
    rendererRef.current?.setWatermark(url);
  }, []);

  const handleLoadCover = useCallback((file) => {
    const url = URL.createObjectURL(file);
    rendererRef.current?.setCoverArt(url);
    setCoverName(file.name);
  }, []);

  // ══════════════════════════════════════════
  // GAME IMAGE (card thumbnail)
  // ══════════════════════════════════════════
  const handleLoadGameImage = useCallback((file) => {
    const url = URL.createObjectURL(file);
    rendererRef.current?.setGameImage(url);
    setGameImageName(file.name);
  }, []);

  // ══════════════════════════════════════════
  // GAMEPLAY VIDEO (corner window)
  // ══════════════════════════════════════════
  const [gameplayName, setGameplayName] = useState('');
  const [gameplayDuration, setGameplayDuration] = useState(0);
  const gameplayVideoRef = useRef(null);
  const gameplayTrimRef = useRef({ start: 0, end: 0 });
  const [bgDuration, setBgDuration] = useState(0);
  const bgTrimRef = useRef({ start: 0, end: 0 });

  // Keep trim ref in sync with config (accessible in timeupdate closure)
  useEffect(() => {
    gameplayTrimRef.current = {
      start: config.gameplayTrimStart || 0,
      end: config.gameplayTrimEnd || 0,
    };
    // Seek immediately when trim start changes so the preview reflects the new in-point
    if (gameplayVideoRef.current && gameplayVideoRef.current.readyState >= 1) {
      gameplayVideoRef.current.currentTime = config.gameplayTrimStart || 0;
    }
  }, [config.gameplayTrimStart]);

  useEffect(() => {
    gameplayTrimRef.current = {
      start: config.gameplayTrimStart || 0,
      end: config.gameplayTrimEnd || 0,
    };
  }, [config.gameplayTrimEnd]);

  useEffect(() => {
    bgTrimRef.current = {
      start: config.bgTrimStart || 0,
      end: config.bgTrimEnd || 0,
    };
    // Seek immediately when trim start changes so the preview reflects the new in-point
    if (bgVideoRef.current && bgVideoRef.current.readyState >= 1) {
      bgVideoRef.current.currentTime = config.bgTrimStart || 0;
    }
  }, [config.bgTrimStart]);

  useEffect(() => {
    bgTrimRef.current = {
      start: config.bgTrimStart || 0,
      end: config.bgTrimEnd || 0,
    };
  }, [config.bgTrimEnd]);

  const handleLoadGameplay = useCallback((file) => {
    const url = URL.createObjectURL(file);
    setGameplayName(file.name);

    if (gameplayVideoRef.current) {
      gameplayVideoRef.current.pause();
      gameplayVideoRef.current.src = '';
    }
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.loop = false; // manual loop so trim works
    video.muted = true;
    video.playsInline = true;

    video.addEventListener('loadedmetadata', () => {
      const dur = video.duration;
      setGameplayDuration(dur);
      // auto-set trim end to full duration on first load
      setConfig(prev => ({ ...prev, gameplayTrimEnd: dur }));
      gameplayTrimRef.current = { start: 0, end: dur };
    });

    video.addEventListener('timeupdate', () => {
      const { start, end } = gameplayTrimRef.current;
      if (end > 0 && video.currentTime >= end) {
        video.currentTime = start;
        video.play().catch(() => {});
      }
    });

    video.addEventListener('ended', () => {
      video.currentTime = gameplayTrimRef.current.start;
      video.play().catch(() => {});
    });

    video.play();
    gameplayVideoRef.current = video;
    rendererRef.current?.setGameplayVideo(video);
  }, []);

  // ══════════════════════════════════════════
  // BACKGROUND
  // ══════════════════════════════════════════
  const handleLoadBackground = useCallback((file) => {
    const url = URL.createObjectURL(file);
    setBgName(file.name);
    setConfig(prev => ({ ...prev, bgMode: 'file' }));

    if (file.type.startsWith('video')) {
      bgFileRef.current = { url, type: 'video' };
      // Create video element for background
      if (bgVideoRef.current) {
        bgVideoRef.current.pause();
        bgVideoRef.current.src = '';
      }
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.loop = false; // manual loop so trim works
      video.muted = true;
      video.playsInline = true;

      video.addEventListener('loadedmetadata', () => {
        const dur = video.duration;
        setBgDuration(dur);
        setConfig(prev => ({ ...prev, bgTrimEnd: dur }));
        bgTrimRef.current = { start: 0, end: dur };
      });

      video.addEventListener('timeupdate', () => {
        const { start, end } = bgTrimRef.current;
        if (end > 0 && video.currentTime >= end) {
          video.currentTime = start;
          video.play().catch(() => {});
        }
      });

      video.addEventListener('ended', () => {
        video.currentTime = bgTrimRef.current.start;
        video.play().catch(() => {});
      });

      video.play();
      bgVideoRef.current = video;
      rendererRef.current?.setBackgroundVideo(video);
    } else {
      bgFileRef.current = { url, type: 'image' };
      rendererRef.current?.setBackground(url, 'image');
    }
  }, []);

  // ══════════════════════════════════════════
  // EXPORT
  // ══════════════════════════════════════════
  const handleCancelExport = useCallback(() => {
    exporterRef.current?.cancelExport();
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const handleExport = useCallback(async () => {
    const renderer = rendererRef.current;
    const audio = audioRef.current;

    if (!renderer) return;
    if (!audio) {
      alert('Charge un fichier audio d\'abord !');
      return;
    }

    const startTime = config.exportStart || 0;
    const endTime = config.exportEnd || 30;
    const duration = Math.max(1, endTime - startTime);

    setIsExporting(true);
    setExportProgress(0);
    setExportStartTime(Date.now());

    // Pre-generate ElevenLabs TTS and connect a fresh Audio element to the export stream
    let ttsExportEl = null;
    if (config.showHookIntro && config.hookTTS && config.hookTTSProvider === 'elevenlabs') {
      const url = await generateElevenLabsVoice();
      if (url) {
        ttsExportEl = analyzerRef.current.connectFreshAudioForExport(url);
      }
    }

    // Get streams
    const videoStream = renderer.getStream();
    const audioStream = analyzerRef.current.getExportStream();

    exporterRef.current.setCleanup(() => {
      renderer.stopStream();
    });

    // Start playback at the chosen start time
    audio.currentTime = startTime;
    analyzerRef.current.resume();
    analyzerRef.current.scheduleFades(
      config.exportFadeIn || 0,
      config.exportFadeOut || 0,
      duration
    );
    audio.play().then(() => {
      setIsPlaying(true);
      renderer.startFadeIn();
      // Play TTS simultaneously with music start, duck music while speaking
      if (ttsExportEl) {
        analyzerRef.current.duckGain(0.15);
        ttsExportEl.play().catch(e => console.warn('[TTS] export play failed:', e));
        ttsExportEl.addEventListener('ended', () => {
          analyzerRef.current.duckGain(1.0);
        }, { once: true });
      }
    });

    exporterRef.current.startExport(videoStream, audioStream, {
      duration,
      format: config.exportFormat || 'mp4',
      quality: config.exportQuality || 'high',
    }, {
      onProgress: (p) => setExportProgress(p),
      onPhase: (phase) => setExportPhase(phase),
      onComplete: (result) => {
        setIsExporting(false);
        setExportPhase('');
        setExportStartTime(null);
        audio.pause();
        setIsPlaying(false);
        if (result.success) {
          console.log('Export complete:', result.path);
        } else if (result.error !== 'Cancelled') {
          alert('Export error: ' + result.error);
        }
      },
    });

    // Schedule fade out near the end
    setTimeout(() => {
      renderer.startFadeOut();
    }, (duration - 1.5) * 1000);
  }, [config.exportStart, config.exportEnd, config.exportFormat, config.exportQuality, config.exportFadeIn, config.exportFadeOut, config.showHookIntro, config.hookTTS, config.hookTTSProvider, generateElevenLabsVoice]);

  // ══════════════════════════════════════════
  // THUMBNAIL EXPORT
  // ══════════════════════════════════════════
  const handleExportThumbnail = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
    const result = await window.electronAPI.saveThumbnail(buffer);
    if (result?.success) console.log('Thumbnail saved:', result.path);
  }, []);

  // ══════════════════════════════════════════
  // SAVE / LOAD PROJECT
  // ══════════════════════════════════════════
  const handleSaveProject = useCallback(async () => {
    if (!window.electronAPI?.isElectron) return;
    const projectData = {
      version: 5,
      config,
      audioName,
      coverName,
      bgName,
      gameImageName,
      gameplayName,
    };
    const result = await window.electronAPI.saveProject(projectData);
    if (result.success) {
      console.log('Project saved:', result.path);
    }
  }, [config, audioName, coverName, bgName, gameImageName, gameplayName]);

  const handleLoadProject = useCallback(async () => {
    if (!window.electronAPI?.isElectron) return;
    const result = await window.electronAPI.loadProject();
    if (result.success && result.data) {
      const proj = result.data;
      if (proj.config) setConfig(prev => ({ ...prev, ...proj.config }));
    }
  }, []);

  const handleLoadFromPath = useCallback(async (path) => {
    if (!window.electronAPI?.isElectron) return;
    const result = await window.electronAPI.loadProjectFromPath(path);
    if (result.success && result.data?.config) {
      setConfig(prev => ({ ...prev, ...result.data.config }));
    }
  }, []);

  const [recentProjects, setRecentProjects] = useState([]);
  useEffect(() => {
    if (window.electronAPI?.isElectron) {
      window.electronAPI.getRecentProjects().then(r => setRecentProjects(r || []));
    }
  }, []);

  // ══════════════════════════════════════════
  // GAME SEARCH (IGDB via main process proxy — no CORS)
  // ══════════════════════════════════════════
  const [gameSearchResults, setGameSearchResults] = useState(null);
  const [gameSearchError, setGameSearchError] = useState('');

  const handleSearchGame = useCallback(async (query) => {
    if (!query) return;
    setGameSearchError('');

    const clientId = config.twitchClientId;
    const clientSecret = config.twitchClientSecret;
    if (!clientId || !clientSecret) {
      setGameSearchError('Twitch Client ID et Secret requis (Settings)');
      return;
    }

    try {
      const result = await window.electronAPI.searchGame(query, clientId, clientSecret);
      if (!result.success) {
        setGameSearchError(result.error || 'Recherche IGDB échouée');
        setGameSearchResults([]);
        return;
      }

      const results = (result.data || []).map(g => {
        const devCompany = g.involved_companies?.find(ic => ic.developer);
        const anyCompany = g.involved_companies?.[0];
        const year = g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear().toString() : '';
        const coverUrl = g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : null;
        const platforms = (g.platforms || []).map(p => p.abbreviation).filter(Boolean).slice(0, 3).join(', ');

        return {
          name: g.name,
          year,
          platforms,
          studio: devCompany?.company?.name || anyCompany?.company?.name || '',
          coverUrl,
        };
      });

      setGameSearchResults(results);
    } catch (e) {
      setGameSearchError(e.message);
      setGameSearchResults([]);
    }
  }, [config.twitchClientId, config.twitchClientSecret]);

  const handleSelectGame = useCallback((game) => {
    setConfig(prev => ({
      ...prev,
      gameName: game.name || prev.gameName,
      gameYear: game.year || prev.gameYear,
      gameStudio: game.studio || prev.gameStudio,
    }));

    // Auto-load cover art from IGDB
    if (game.coverUrl) {
      rendererRef.current?.setCoverArt(game.coverUrl);
      setCoverName('IGDB: ' + game.name);
    }

    setGameSearchResults(null);
    console.log('Game selected:', game.name, game.year, game.studio);
  }, []);


  // ══════════════════════════════════════════
  // KEYBOARD
  // ══════════════════════════════════════════
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
      // R = retour au début de la plage d'export
      if (e.code === 'KeyR' && !e.ctrlKey) {
        e.preventDefault();
        if (audioRef.current) {
          audioRef.current.currentTime = configRef.current.exportStart || 0;
          rendererRef.current?.resetHookIntro();
        }
      }
      // L = toggle loop
      if (e.code === 'KeyL' && !e.ctrlKey) {
        e.preventDefault();
        setLoopPreview(v => !v);
      }
      // ← → = seek ±5s
      if (e.code === 'ArrowLeft' && !e.ctrlKey) {
        e.preventDefault();
        if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
      }
      if (e.code === 'ArrowRight' && !e.ctrlKey) {
        e.preventDefault();
        if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5);
      }
      // Ctrl+Z = undo
      if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        const idx = historyIdxRef.current;
        if (idx > 0) {
          historyIdxRef.current = idx - 1;
          isUndoRedoRef.current = true;
          setConfig(historyRef.current[historyIdxRef.current]);
        }
      }
      // Ctrl+Y / Ctrl+Shift+Z = redo
      if ((e.ctrlKey && e.code === 'KeyY') || (e.ctrlKey && e.shiftKey && e.code === 'KeyZ')) {
        e.preventDefault();
        const idx = historyIdxRef.current;
        if (idx < historyRef.current.length - 1) {
          historyIdxRef.current = idx + 1;
          isUndoRedoRef.current = true;
          setConfig(historyRef.current[historyIdxRef.current]);
        }
      }
      // Ctrl+S = save project
      if (e.ctrlKey && e.code === 'KeyS') {
        e.preventDefault();
        handleSaveProject();
      }
      // Ctrl+O = load project
      if (e.ctrlKey && e.code === 'KeyO') {
        e.preventDefault();
        handleLoadProject();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, handleSaveProject, handleLoadProject]);

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════
  // DRAG & DROP
  // ══════════════════════════════════════════
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      const type = file.type;
      if (type.startsWith('audio/')) {
        handleLoadAudio(file);
      } else if (type.startsWith('video/')) {
        // Check filename for hints
        const name = file.name.toLowerCase();
        if (name.includes('gameplay') || name.includes('game')) {
          handleLoadGameplay(file);
        } else {
          handleLoadBackground(file);
        }
      } else if (type.startsWith('image/')) {
        // First image = cover, subsequent = background
        if (!coverName) {
          handleLoadCover(file);
        } else {
          handleLoadBackground(file);
        }
      }
    });
  }, [handleLoadAudio, handleLoadCover, handleLoadBackground, handleLoadGameplay, coverName]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ══════════════════════════════════════════
  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        display: 'flex', width: '100vw', height: '100vh',
        background: '#040408', overflow: 'hidden',
        border: isDragging ? '3px dashed rgba(167,139,250,0.6)' : '3px solid transparent',
        transition: 'border-color 0.2s',
      }}
    >
      {/* ── Canvas Preview Area ── */}
      <div
        ref={canvasContainerRef}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingRight: 320, // room for panel
          position: 'relative',
        }}
      >
        {/* ── Safe Zone buttons ── */}
        <div style={{
          position: 'absolute', top: 16, left: '50%',
          transform: 'translateX(calc(-50% - 160px))',
          zIndex: 60, display: 'flex', gap: 6,
        }}>
          {[{ id: 'tiktok', label: '🎵 TikTok' }, { id: 'shorts', label: '▶ Shorts' }].map(({ id, label }) => {
            const active = safeZoneMode === id;
            return (
              <button key={id} onClick={() => setSafeZoneMode(active ? null : id)} style={{
                padding: '4px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 6,
                fontFamily: "'Space Mono', monospace",
                background: active ? `${config.accentColor || '#a78bfa'}30` : 'rgba(255,255,255,0.06)',
                border: `1px solid ${active ? config.accentColor || '#a78bfa' : 'rgba(255,255,255,0.15)'}`,
                color: active ? config.accentColor || '#a78bfa' : 'rgba(255,255,255,0.35)',
              }}>{label}</button>
            );
          })}
        </div>

        {/* ── Safe Zone overlay (preview only, never exported) ── */}
        {safeZoneMode && canvasDisplaySize.w > 0 && (() => {
          const { w, h } = canvasDisplaySize;
          const s = w / 1080; // scale factor
          const px = n => Math.round(n * s);
          const sp = (size, weight = 400) => ({
            fontSize: px(size), fontWeight: weight,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: 1.2,
          });
          const mono = { fontFamily: "'Space Mono', monospace" };

          if (safeZoneMode === 'tiktok') {
            return (
              <div style={{ position: 'absolute', width: w, height: h, pointerEvents: 'none', zIndex: 55, overflow: 'hidden', borderRadius: 6 }}>
                {/* Bottom gradient */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: px(700),
                  background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
                }} />

                {/* Top bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: px(90),
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: `0 ${px(32)}px`, boxSizing: 'border-box',
                }}>
                  <span style={{ color: '#fff', ...sp(36) }}>←</span>
                  <div style={{ display: 'flex', gap: px(40), alignItems: 'center' }}>
                    {['Abonnements', 'Pour toi'].map((t, i) => (
                      <span key={t} style={{ color: i === 1 ? '#fff' : 'rgba(255,255,255,0.6)', ...sp(28, i === 1 ? 700 : 400) }}>{t}</span>
                    ))}
                  </div>
                  <span style={{ color: '#fff', ...sp(32) }}>🔍</span>
                </div>
                {/* Tab underline */}
                <div style={{ position: 'absolute', top: px(82), left: '50%', transform: 'translateX(-50%)', width: px(80), height: px(3), background: '#fff', borderRadius: 2 }} />

                {/* Right side buttons */}
                {[
                  { icon: '🧡', label: '142K' },
                  { icon: '💬', label: '1824' },
                  { icon: '🔖', label: 'Enreg.' },
                  { icon: '↗', label: 'Partager' },
                  { icon: '⋯', label: '' },
                ].map(({ icon, label }, i) => (
                  <div key={i} style={{
                    position: 'absolute', right: px(20),
                    bottom: px(300 + (4 - i) * 145),
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(6),
                  }}>
                    {i === 0 && (
                      <div style={{ width: px(64), height: px(64), borderRadius: '50%', background: '#555', border: `${px(3)}px solid #fff`, marginBottom: px(4), overflow: 'hidden' }}>
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#888,#444)' }} />
                      </div>
                    )}
                    <div style={{ width: px(54), height: px(54), borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ ...sp(28) }}>{icon}</span>
                    </div>
                    {label && <span style={{ color: '#fff', ...sp(22, 600) }}>{label}</span>}
                  </div>
                ))}

                {/* Bottom info */}
                <div style={{ position: 'absolute', bottom: px(100), left: px(20), right: px(130), display: 'flex', flexDirection: 'column', gap: px(12) }}>
                  <span style={{ color: '#fff', ...sp(32, 700) }}>@twispy_vgm</span>
                  <span style={{ color: 'rgba(255,255,255,0.9)', ...sp(28) }}>🎮 Tu te souviens de cette musique ? 👇</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', ...sp(26) }}>#vgm #nostalgie #gaming</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: px(12), marginTop: px(4) }}>
                    <span style={{ ...sp(24) }}>🎵</span>
                    <span style={{ color: '#fff', ...sp(24) }}>Son original – twispy_vgm</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ position: 'absolute', bottom: px(10), left: 0, width: '100%', height: px(3), background: 'rgba(255,255,255,0.3)' }}>
                  <div style={{ width: '45%', height: '100%', background: '#fff' }} />
                </div>

                {/* Bottom nav bar */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: px(90),
                  background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                  {[{ icon: '🏠', label: 'Accueil' }, { icon: '🔍', label: 'Recherche' }, { icon: null, label: null }, { icon: '📥', label: 'Boîte' }, { icon: '👤', label: 'Profil' }].map(({ icon, label }, i) =>
                    i === 2 ? (
                      <div key={i} style={{ width: px(88), height: px(48), borderRadius: px(12), background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#000', ...sp(30, 700) }}>+</span>
                      </div>
                    ) : (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(4) }}>
                        <span style={{ ...sp(28) }}>{icon}</span>
                        <span style={{ color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)', ...sp(18) }}>{label}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          }

          if (safeZoneMode === 'shorts') {
            return (
              <div style={{ position: 'absolute', width: w, height: h, pointerEvents: 'none', zIndex: 55, overflow: 'hidden', borderRadius: 6 }}>
                {/* Bottom gradient */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: px(600),
                  background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)',
                }} />

                {/* Top bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: px(100),
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: `0 ${px(28)}px`, boxSizing: 'border-box',
                }}>
                  <span style={{ color: '#fff', ...sp(38) }}>←</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: px(12) }}>
                    <span style={{ color: '#fff', ...sp(28, 700) }}>Shorts</span>
                  </div>
                  <span style={{ color: '#fff', ...sp(32) }}>⋯</span>
                </div>

                {/* Right side buttons */}
                {[
                  { icon: '👍', label: '24K' },
                  { icon: '👎', label: '' },
                  { icon: '💬', label: '312' },
                  { icon: '↗', label: 'Partager' },
                  { icon: '⋯', label: '' },
                ].map(({ icon, label }, i) => (
                  <div key={i} style={{
                    position: 'absolute', right: px(16),
                    bottom: px(280 + (4 - i) * 140),
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(6),
                  }}>
                    <div style={{ width: px(56), height: px(56), borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ ...sp(30) }}>{icon}</span>
                    </div>
                    {label && <span style={{ color: '#fff', ...sp(22, 600) }}>{label}</span>}
                  </div>
                ))}

                {/* Bottom info */}
                <div style={{ position: 'absolute', bottom: px(100), left: px(20), right: px(130), display: 'flex', flexDirection: 'column', gap: px(14) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: px(16) }}>
                    <div style={{ width: px(52), height: px(52), borderRadius: '50%', background: 'linear-gradient(135deg,#888,#444)', border: `${px(2)}px solid rgba(255,255,255,0.3)` }} />
                    <span style={{ color: '#fff', ...sp(30, 700) }}>twispy_vgm</span>
                    <div style={{ padding: `${px(8)}px ${px(22)}px`, borderRadius: px(20), border: '1.5px solid #fff' }}>
                      <span style={{ color: '#fff', ...sp(24, 600) }}>S'abonner</span>
                    </div>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.9)', ...sp(28) }}>🎮 Tu te souviens de cette musique ?</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: px(10) }}>
                    <span style={{ ...sp(22) }}>🎵</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', ...sp(24) }}>Son original</span>
                  </div>
                </div>

                {/* Progress bar (YouTube red) */}
                <div style={{ position: 'absolute', bottom: px(90), left: 0, width: '100%', height: px(3), background: 'rgba(255,255,255,0.2)' }}>
                  <div style={{ width: '35%', height: '100%', background: '#FF0000' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '35%', transform: 'translate(-50%,-50%)', width: px(16), height: px(16), borderRadius: '50%', background: '#FF0000' }} />
                </div>

                {/* Bottom nav */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: px(90),
                  background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'space-around',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                }}>
                  {[{ icon: '🏠', label: 'Accueil' }, { icon: '🔍', label: 'Explore' }, { icon: '➕', label: '' }, { icon: '📚', label: 'Abonnem.' }, { icon: '👤', label: 'Vous' }].map(({ icon, label }, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(4) }}>
                      <span style={{ ...sp(i === 2 ? 38 : 28) }}>{icon}</span>
                      {label && <span style={{ color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)', ...sp(18) }}>{label}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
        })()}

        {/* Play hint */}
        {audioRef.current && !isPlaying && (
          <div style={{
            position: 'absolute', bottom: 40, left: 'calc(50% - 160px)',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)', borderRadius: 12,
            padding: '8px 20px', backdropFilter: 'blur(10px)',
            fontSize: 12, color: 'rgba(255,255,255,0.5)',
            fontFamily: "'Space Mono', monospace", zIndex: 50,
            pointerEvents: 'none',
          }}>
            ▶ Press Space to play
          </div>
        )}

        {/* ── Audio Progress Bar + Timeline (preview only, not exported) ── */}
        {audioDuration > 0 && (
          <div style={{
            position: 'absolute', bottom: 18, left: '50%',
            transform: 'translateX(calc(-50% - 160px))',
            width: 'min(400px, 65%)',
            zIndex: 60, userSelect: 'none',
          }}>
            {/* ── Timeline ── */}
            <PreviewTimeline
              config={config}
              audioDuration={audioDuration}
              accentColor={config.accentColor}
              cursorRef={timelineCursorRef}
              timeRef={timelineTimeRef}
              onSeek={(t) => {
                if (audioRef.current) audioRef.current.currentTime = t;
              }}
              onConfigChange={setConfig}
            />
            {/* Time label + buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span ref={progressTimeRef} style={{
                fontSize: 10, color: 'rgba(255,255,255,0.45)',
                fontFamily: "'Space Mono', monospace",
              }}>0:00 / 0:00</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Loop toggle */}
                <button onClick={() => setLoopPreview(v => !v)} title="Boucler la zone d'export" style={{
                  padding: '2px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 4,
                  fontFamily: "'Space Mono', monospace",
                  background: loopPreview ? `${config.accentColor || '#a78bfa'}30` : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${loopPreview ? config.accentColor || '#a78bfa' : 'rgba(255,255,255,0.15)'}`,
                  color: loopPreview ? config.accentColor || '#a78bfa' : 'rgba(255,255,255,0.35)',
                }}>⟳ Loop</button>
                {/* Thumbnail */}
                <button onClick={handleExportThumbnail} title="Exporter la frame actuelle en PNG" style={{
                  padding: '2px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 4,
                  fontFamily: "'Space Mono', monospace",
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.35)',
                }}>🖼 PNG</button>
                {/* Export range label */}
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: "'Space Mono', monospace" }}>
                  {`${Math.floor(config.exportStart/60)}:${String(Math.floor(config.exportStart%60)).padStart(2,'0')}→${Math.floor(config.exportEnd/60)}:${String(Math.floor(config.exportEnd%60)).padStart(2,'0')}`}
                </span>
              </div>
            </div>

            {/* Track */}
            <div
              ref={progressBarRef}
              onMouseDown={e => {
                e.stopPropagation();
                progressDraggingRef.current = true;

                const seek = (clientX) => {
                  const rect = progressBarRef.current.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                  if (audioRef.current && !isNaN(audioRef.current.duration)) {
                    audioRef.current.currentTime = pct * audioRef.current.duration;
                  }
                  if (progressFillRef.current) progressFillRef.current.style.width = (pct * 100) + '%';
                  if (progressThumbRef.current) progressThumbRef.current.style.left = (pct * 100) + '%';
                  if (progressTimeRef.current && audioRef.current) {
                    const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
                    const dur = audioRef.current.duration || 0;
                    progressTimeRef.current.textContent = `${fmt(pct * dur)} / ${fmt(dur)}`;
                  }
                };

                seek(e.clientX);

                const onMove = ev => seek(ev.clientX);
                const onUp = () => {
                  progressDraggingRef.current = false;
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              style={{
                position: 'relative', height: 6, borderRadius: 3,
                background: 'rgba(255,255,255,0.1)',
                cursor: 'pointer',
                marginTop: 6,
              }}
            >
              {/* Fill */}
              <div ref={progressFillRef} style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                borderRadius: 3,
                background: config.accentColor || '#a78bfa',
                width: '0%',
              }} />

              {/* Thumb */}
              <div ref={progressThumbRef} style={{
                position: 'absolute', top: '50%',
                width: 14, height: 14, borderRadius: '50%',
                background: '#fff',
                boxShadow: `0 0 6px ${config.accentColor || '#a78bfa'}`,
                transform: 'translate(-50%, -50%)',
                left: '0%',
                pointerEvents: 'none',
                transition: progressDraggingRef.current ? 'none' : undefined,
              }} />

              {/* Export start marker */}
              <div style={{
                position: 'absolute', top: -3, width: 2, height: 10,
                borderRadius: 1, background: 'rgba(255,255,255,0.6)',
                left: `${(config.exportStart / audioDuration) * 100}%`,
                pointerEvents: 'none',
              }} />
              {/* Export end marker */}
              <div style={{
                position: 'absolute', top: -3, width: 2, height: 10,
                borderRadius: 1, background: 'rgba(255,255,255,0.6)',
                left: `${(config.exportEnd / audioDuration) * 100}%`,
                pointerEvents: 'none',
              }} />

              {/* Export range highlight */}
              <div style={{
                position: 'absolute', top: 0, height: '100%',
                background: 'rgba(255,255,255,0.08)',
                left: `${(config.exportStart / audioDuration) * 100}%`,
                width: `${((config.exportEnd - config.exportStart) / audioDuration) * 100}%`,
                pointerEvents: 'none',
              }} />
            </div>
          </div>
        )}

        {/* Resolution badge */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: 'rgba(0,0,0,0.5)', borderRadius: 6,
          padding: '4px 10px', fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          fontFamily: "'Space Mono', monospace",
          backdropFilter: 'blur(6px)', zIndex: 50,
        }}>
          Preview — 1080×1920 native
        </div>
      </div>

      {/* ── Control Panel ── */}
      <ControlPanel
        config={config}
        onConfigChange={setConfig}
        onLoadAudio={handleLoadAudio}
        onLoadCover={handleLoadCover}
        onLoadBackground={handleLoadBackground}
        onLoadGameImage={handleLoadGameImage}
        onLoadWatermark={handleLoadWatermark}
        onLoadGameplay={handleLoadGameplay}
        onExport={handleExport}
        onCancelExport={handleCancelExport}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportPhase={exportPhase}
        exportStartTime={exportStartTime}
        audioName={audioName}
        coverName={coverName}
        bgName={bgName}
        gameImageName={gameImageName}
        gameplayName={gameplayName}
        gameplayDuration={gameplayDuration}
        bgDuration={bgDuration}
        audioDuration={audioDuration}
        waveformData={waveformData}
        normGain={normGain}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        recentProjects={recentProjects}
        onLoadFromPath={handleLoadFromPath}
        onGenerateElevenLabs={generateElevenLabsVoice}
        onSearchGame={handleSearchGame}
        gameSearchResults={gameSearchResults}
        gameSearchError={gameSearchError}
        onSelectGame={handleSelectGame}
      />
    </div>
  );
}
