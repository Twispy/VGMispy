import React, { useRef, useState, useEffect, useCallback } from 'react';
import { STYLE_TEMPLATES } from '../styleTemplates';

// ══════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════

const panel = {
  position: 'fixed', top: 0, right: 0, width: 320, height: '100vh',
  background: 'rgba(8, 8, 16, 0.94)', borderLeft: '1px solid rgba(255,255,255,0.05)',
  backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
  display: 'flex', flexDirection: 'column', gap: 0,
  padding: '16px 0', overflowY: 'auto', zIndex: 100,
  fontFamily: "'Outfit', sans-serif",
};

const label = { fontSize: 11, color: 'rgba(241,240,245,0.45)', marginBottom: 3 };

const input = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)',
  color: '#f1f0f5', fontSize: 13, outline: 'none', fontFamily: "'Outfit',sans-serif",
};

const fileBtn = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)',
  color: 'rgba(241,240,245,0.55)', fontSize: 12, cursor: 'pointer',
  textAlign: 'center', fontFamily: "'Outfit',sans-serif", transition: 'all 0.2s',
};

const fileName = {
  fontSize: 10, color: 'rgba(241,240,245,0.3)', marginTop: 3,
  fontFamily: "'Space Mono',monospace", overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const textarea = {
  ...undefined, // will be spread from input
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)',
  color: '#f1f0f5', fontSize: 13, outline: 'none', fontFamily: "'Outfit',sans-serif",
  resize: 'vertical', minHeight: 38, lineHeight: 1.4,
};

const colorInput = {
  width: 34, height: 34, borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
  background: 'none', padding: 0,
};

const subDivider = {
  height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0',
};

const subHeader = (accentColor) => ({
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: accentColor || 'rgba(241,240,245,0.5)',
  paddingBottom: 2,
  borderLeft: `2px solid ${accentColor || 'rgba(241,240,245,0.3)'}`,
  paddingLeft: 7,
});

// ══════════════════════════════════════════
// COLOR PRESETS
// ══════════════════════════════════════════

const STYLE_PRESETS = [
  // ── Pastels ──
  { name: 'Lavande',  accent: '#c4b5fd', card: '#4c1d95', border: '#c4b5fd', fontColor: '#fff', colorFilter: 'pastel',  colorFilterIntensity: 0.10, vignetteIntensity: 0.30 },
  { name: 'Pêche',    accent: '#fda4af', card: '#881337', border: '#fda4af', fontColor: '#fff', colorFilter: 'warm',    colorFilterIntensity: 0.08, vignetteIntensity: 0.30 },
  { name: 'Menthe',   accent: '#86efac', card: '#14532d', border: '#86efac', fontColor: '#fff', colorFilter: 'pastel',  colorFilterIntensity: 0.08, vignetteIntensity: 0.25 },
  { name: 'Ciel',     accent: '#bae6fd', card: '#0c4a6e', border: '#bae6fd', fontColor: '#fff', colorFilter: 'cold',    colorFilterIntensity: 0.08, vignetteIntensity: 0.25 },
  { name: 'Lilas',    accent: '#e9d5ff', card: '#581c87', border: '#d8b4fe', fontColor: '#fff', colorFilter: 'pastel',  colorFilterIntensity: 0.12, vignetteIntensity: 0.35 },
  { name: 'Saumon',   accent: '#fca5a5', card: '#7f1d1d', border: '#fca5a5', fontColor: '#fff', colorFilter: 'warm',    colorFilterIntensity: 0.10, vignetteIntensity: 0.30 },
  // ── Ambiances ──
  { name: 'Rétro',    accent: '#fbbf24', card: '#451a03', border: '#d97706', fontColor: '#fef3c7', colorFilter: 'vintage', colorFilterIntensity: 0.25, vignetteIntensity: 0.55 },
  { name: 'Néon',     accent: '#f0abfc', card: '#4a044e', border: '#e879f9', fontColor: '#fff', colorFilter: 'neon',    colorFilterIntensity: 0.12, vignetteIntensity: 0.50 },
  { name: 'Minuit',   accent: '#818cf8', card: '#1e1b4b', border: '#818cf8', fontColor: '#e0e7ff', colorFilter: 'cold',  colorFilterIntensity: 0.15, vignetteIntensity: 0.55 },
  { name: 'Forêt',    accent: '#4ade80', card: '#14532d', border: '#4ade80', fontColor: '#f0fdf4', colorFilter: 'cold',  colorFilterIntensity: 0.06, vignetteIntensity: 0.40 },
];

// ══════════════════════════════════════════
// WAVEFORM SCRUBBER
// ══════════════════════════════════════════

function WaveformScrubber({ waveformData, duration, start, end, onChange, accentColor }) {
  const canvasRef = useRef(null);
  const draggingRef = useRef(null);

  const toRatio = (t) => duration > 0 ? t / duration : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.roundRect(0, 0, W, H, 6);
    ctx.fill();

    const startX = toRatio(start) * W;
    const endX   = toRatio(end)   * W;

    // Waveform bars
    if (waveformData && waveformData.length > 0) {
      const barW = W / waveformData.length;
      waveformData.forEach((v, i) => {
        const x = i * barW;
        const inRange = x >= startX && x <= endX;
        const barH = Math.max(2, v * (H - 8));
        ctx.fillStyle = inRange ? accentColor + 'cc' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(x + 0.5, (H - barH) / 2, Math.max(1, barW - 1), barH);
      });
    } else {
      // Fallback: flat line
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, H / 2 - 1, W, 2);
      ctx.fillStyle = accentColor + '50';
      ctx.fillRect(startX, H / 2 - 1, endX - startX, 2);
    }

    // Selection highlight
    ctx.fillStyle = accentColor + '22';
    ctx.fillRect(startX, 0, endX - startX, H);

    // Handles
    [[startX, '◀'], [endX, '▶']].forEach(([x, arrow]) => {
      ctx.fillStyle = accentColor;
      ctx.fillRect(x - 1, 0, 2, H);
      ctx.beginPath();
      ctx.arc(x, H / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(arrow, x, H / 2);
    });
  }, [waveformData, duration, start, end, accentColor]);

  const getT = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return Math.round(ratio * duration);
  };

  const handleMouseDown = (e) => {
    const t = getT(e);
    const dStart = Math.abs(t - start);
    const dEnd   = Math.abs(t - end);
    draggingRef.current = dStart <= dEnd ? 'start' : 'end';
  };

  const handleMouseMove = (e) => {
    if (!draggingRef.current) return;
    const t = getT(e);
    if (draggingRef.current === 'start') {
      onChange({ start: Math.min(t, end - 1), end });
    } else {
      onChange({ start, end: Math.max(t, start + 1) });
    }
  };

  const handleMouseUp = () => { draggingRef.current = null; };

  return (
    <canvas
      ref={canvasRef}
      width={284} height={52}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ width: '100%', height: 52, cursor: 'ew-resize', borderRadius: 6, display: 'block' }}
    />
  );
}

// ══════════════════════════════════════════
// COLLAPSIBLE SECTION
// ══════════════════════════════════════════

function Section({ title, icon, defaultOpen = false, children, accentColor }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px', cursor: 'pointer', userSelect: 'none',
          transition: 'background 0.15s',
          background: open ? 'rgba(255,255,255,0.02)' : 'transparent',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = open ? 'rgba(255,255,255,0.02)' : 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: open ? (accentColor || 'rgba(241,240,245,0.6)') : 'rgba(241,240,245,0.35)',
            transition: 'color 0.2s',
          }}>{title}</span>
        </div>
        <span style={{
          fontSize: 10, color: 'rgba(241,240,245,0.3)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: '6px 18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// REUSABLE COMPONENTS (outside to avoid re-creation)
// ══════════════════════════════════════════

function Toggle({ label: lbl, value, onChange, accentColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: 'rgba(241,240,245,0.6)' }}>{lbl}</span>
      <div onClick={() => onChange(!value)} style={{
        width: 38, height: 20, borderRadius: 10, cursor: 'pointer', position: 'relative',
        background: value ? accentColor : 'rgba(255,255,255,0.08)', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 20 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        }} />
      </div>
    </div>
  );
}

function Slider({ lbl, value, min, max, step, onChange, suffix, accentColor }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: 'rgba(241,240,245,0.45)', marginBottom: 3 }}>
        {lbl}{suffix ? `: ${value}${suffix}` : ''}
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange}
        style={{ width: '100%', accentColor: accentColor || '#a78bfa' }} />
    </div>
  );
}

// ══════════════════════════════════════════
// CONTROL PANEL
// ══════════════════════════════════════════

function useTTSVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  return voices;
}

const SHORTCUTS = [
  ['Espace',      'Play / Pause'],
  ['R',           'Reset au début'],
  ['L',           'Boucle on/off'],
  ['←',           '-5 secondes'],
  ['→',           '+5 secondes'],
  ['Ctrl+Z',      'Annuler'],
  ['Ctrl+Y',      'Refaire'],
  ['Ctrl+S',      'Sauvegarder'],
  ['Ctrl+O',      'Charger'],
];

export default function ControlPanel({
  config, onConfigChange, onLoadAudio, onLoadCover, onLoadBackground, onLoadGameImage, onLoadGameplay, onLoadWatermark,
  onExport, onCancelExport, isExporting, exportProgress, exportPhase, exportStartTime,
  audioName, coverName, bgName, gameImageName, gameplayName, gameplayDuration, bgDuration,
  audioDuration, waveformData,
  normGain,
  onSaveProject, onLoadProject, recentProjects, onLoadFromPath, onGenerateElevenLabs,
  onSearchGame, gameSearchResults, gameSearchError, onSelectGame,
}) {
  const audioRef = useRef(null);
  const coverRef = useRef(null);
  const bgRef = useRef(null);
  const gameImgRef = useRef(null);
  const watermarkRef = useRef(null);
  const gameplayRef = useRef(null);
  const ttsVoices = useTTSVoices();
  const [elVoices, setElVoices] = useState([]);
  const [elVoicesLoading, setElVoicesLoading] = useState(false);
  const [elVoicesError, setElVoicesError] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [elPreviewLoading, setElPreviewLoading] = useState(false);
  const [exportElapsed, setExportElapsed] = useState(0);

  useEffect(() => {
    if (!isExporting || !exportStartTime) { setExportElapsed(0); return; }
    const tick = () => setExportElapsed(Math.floor((Date.now() - exportStartTime) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isExporting, exportStartTime]);

  const fetchElVoices = useCallback(async (key) => {
    if (!key) return;
    setElVoicesLoading(true);
    setElVoicesError('');
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status} — clé API invalide ?`);
      const data = await res.json();
      setElVoices(data.voices || []);
    } catch (e) {
      setElVoicesError(e.message);
    } finally {
      setElVoicesLoading(false);
    }
  }, []);

  const set = (key, val) => onConfigChange({ ...config, [key]: val });

  return (
    <div style={panel}>
      {/* ── Header ── */}
      <div style={{ padding: '0 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>🎵 VGM Vinyl Creator</div>
            <div style={{ fontSize: 10, color: 'rgba(241,240,245,0.25)', marginTop: 2, fontFamily: "'Space Mono',monospace" }}>
              Build 9 • 1080×1920
            </div>
          </div>
          <button
            title="Raccourcis clavier"
            onClick={() => setShowShortcuts(v => !v)}
            style={{
              background: showShortcuts ? config.accentColor + '22' : 'rgba(255,255,255,0.04)',
              border: showShortcuts ? `1px solid ${config.accentColor}60` : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 7, padding: '5px 9px', cursor: 'pointer',
              fontSize: 13, color: showShortcuts ? config.accentColor : 'rgba(241,240,245,0.4)',
              transition: 'all 0.15s',
            }}>?</button>
        </div>

        {/* ── Shortcuts panel ── */}
        {showShortcuts && (
          <div style={{
            marginTop: 8, borderRadius: 8, padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: config.accentColor, background: config.accentColor + '15', border: `1px solid ${config.accentColor}30`, borderRadius: 4, padding: '2px 5px' }}>{key}</span>
                <span style={{ fontSize: 10, color: 'rgba(241,240,245,0.45)' }}>{desc}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button style={{ ...fileBtn, flex: 1, fontSize: 11, padding: '8px 10px' }} onClick={onSaveProject}>
            💾 Save
          </button>
          <button style={{ ...fileBtn, flex: 1, fontSize: 11, padding: '8px 10px' }} onClick={onLoadProject}>
            📂 Load
          </button>
          {recentProjects?.length > 0 && (
            <button
              title="Projets récents"
              onClick={() => setShowRecent(v => !v)}
              style={{
                ...fileBtn, fontSize: 11, padding: '8px 10px',
                background: showRecent ? config.accentColor + '18' : undefined,
                border: showRecent ? `1px solid ${config.accentColor}50` : undefined,
                color: showRecent ? config.accentColor : undefined,
              }}>🕐</button>
          )}
        </div>

        {/* ── Recent projects ── */}
        {showRecent && recentProjects?.length > 0 && (
          <div style={{ marginTop: 6, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            {recentProjects.slice(0, 8).map((p, i) => (
              <div key={i} onClick={() => { onLoadFromPath(p.path); setShowRecent(false); }} style={{
                padding: '7px 10px', cursor: 'pointer', fontSize: 11,
                color: 'rgba(241,240,245,0.7)', borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(255,255,255,0.02)', transition: 'background 0.1s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              >
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'Untitled'}</div>
                <div style={{ fontSize: 9, color: 'rgba(241,240,245,0.3)', marginTop: 1, fontFamily: "'Space Mono',monospace" }}>
                  {new Date(p.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════ */}
      {/* MEDIA */}
      {/* ══════════════════════════════════════ */}
      <Section title="Media" icon="📁" defaultOpen={true} accentColor={config.accentColor}>
        <div>
          <input ref={audioRef} type="file" accept="audio/*" hidden
            onChange={e => e.target.files[0] && onLoadAudio(e.target.files[0])} />
          <button style={fileBtn} onClick={() => audioRef.current.click()}>🎵 Audio Track</button>
          {audioName && <div style={fileName}>{audioName}</div>}
        </div>
        <div>
          <input ref={coverRef} type="file" accept="image/*" hidden
            onChange={e => e.target.files[0] && onLoadCover(e.target.files[0])} />
          <button style={fileBtn} onClick={() => coverRef.current.click()}>🖼️ Cover Art (Vinyl Label)</button>
          {coverName && <div style={fileName}>{coverName}</div>}
        </div>
        <div>
          <input ref={bgRef} type="file" accept="image/*,video/*" hidden
            onChange={e => e.target.files[0] && onLoadBackground(e.target.files[0])} />
          <button style={fileBtn} onClick={() => bgRef.current.click()}>🌄 Background (Image/Video)</button>
          {bgName && <div style={fileName}>{bgName}</div>}
        </div>
        <div>
          <input ref={gameplayRef} type="file" accept="video/*" hidden
            onChange={e => e.target.files[0] && onLoadGameplay(e.target.files[0])} />
          <button style={fileBtn} onClick={() => gameplayRef.current.click()}>🎬 Gameplay Video</button>
          {gameplayName && <div style={fileName}>{gameplayName}</div>}
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* TRACK INFO */}
      {/* ══════════════════════════════════════ */}
      <Section title="Track Info" icon="🎶" defaultOpen={true} accentColor={config.accentColor}>
        {/* ── Game Search ── */}
        <div>
          <div style={label}>🔍 Search Game (IGDB)</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input id="game-search" style={{ ...input, flex: 1 }}
              placeholder="Type game name..."
              onKeyDown={e => { if (e.key === 'Enter') onSearchGame(e.target.value); }} />
            <button onClick={() => {
              const v = document.getElementById('game-search')?.value;
              if (v) onSearchGame(v);
            }} style={{
              padding: '8px 12px', borderRadius: 8, border: `1px solid ${config.accentColor}40`,
              background: config.accentColor + '15', color: config.accentColor,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
            }}>Search</button>
          </div>
          {gameSearchError && (
            <div style={{ marginTop: 5, fontSize: 11, color: '#f87171' }}>{gameSearchError}</div>
          )}
          {gameSearchResults && gameSearchResults.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 320, overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
              {gameSearchResults.map((g, i) => (
                <div key={i} onClick={() => onSelectGame(g)} style={{
                  padding: '8px 10px', cursor: 'pointer', fontSize: 12,
                  color: 'rgba(241,240,245,0.7)', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                  {g.coverUrl ? (
                    <img src={g.coverUrl} alt="" style={{ width: 36, height: 48, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 48, borderRadius: 4, background: 'rgba(255,255,255,0.04)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎮</div>
                  )}
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(241,240,245,0.4)', marginTop: 2 }}>
                      {[g.year, g.studio, g.platforms].filter(Boolean).join(' • ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Manual fields ── */}
        <div>
          <div style={label}>Track Title</div>
          <textarea style={textarea} rows={2} value={config.trackTitle}
            onChange={e => set('trackTitle', e.target.value)} placeholder="e.g. Dire Dire Docks" />
        </div>
        <div>
          <div style={label}>Artist / Composer</div>
          <textarea style={textarea} rows={2} value={config.artist}
            onChange={e => set('artist', e.target.value)} placeholder="e.g. Koji Kondo" />
        </div>
        <div>
          <div style={label}>Game Name</div>
          <textarea style={textarea} rows={2} value={config.gameName}
            onChange={e => set('gameName', e.target.value)} placeholder="e.g. Super Mario 64" />
        </div>
        <div>
          <div style={label}>Year</div>
          <input style={input} value={config.gameYear || ''}
            onChange={e => set('gameYear', e.target.value)} placeholder="e.g. 1996" />
        </div>
        <div>
          <div style={label}>Studio</div>
          <input style={input} value={config.gameStudio || ''}
            onChange={e => set('gameStudio', e.target.value)} placeholder="e.g. Nintendo EAD" />
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* LAYOUT */}
      {/* ══════════════════════════════════════ */}
      <Section title="Layout" icon="📐" defaultOpen={false} accentColor={config.accentColor}>
        <div style={subHeader(config.accentColor)}>Vinyle</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Slider accentColor={config.accentColor} lbl="Size" value={config.vinylRadius || 340} min={150} max={450} step={5}
            onChange={e => set('vinylRadius', parseInt(e.target.value))} />
          <Slider accentColor={config.accentColor} lbl="Label %" value={Math.round((config.labelRatio || 0.36) * 100)} min={20} max={60} step={1}
            onChange={e => set('labelRatio', parseInt(e.target.value) / 100)} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Slider accentColor={config.accentColor} lbl="X" value={config.vinylX ?? 540} min={100} max={980} step={5} suffix="px"
            onChange={e => set('vinylX', parseInt(e.target.value))} />
          <Slider accentColor={config.accentColor} lbl="Y" value={config.vinylY ?? 614} min={200} max={1200} step={5} suffix="px"
            onChange={e => set('vinylY', parseInt(e.target.value))} />
        </div>
        <Slider accentColor={config.accentColor} lbl="Rotation Speed" value={Math.round((config.vinylSpeed ?? 1) * 100)} min={0} max={300} step={10} suffix="%"
          onChange={e => set('vinylSpeed', parseInt(e.target.value) / 100)} />

        {/* Cover Art */}
        <div style={subDivider} />
        <div style={subHeader(config.accentColor)}>Cover Art</div>
        <Slider accentColor={config.accentColor} lbl="Zoom" value={Math.round((config.coverZoom ?? 1) * 100)} min={50} max={300} step={5} suffix="%"
          onChange={e => set('coverZoom', parseInt(e.target.value) / 100)} />
        <div style={{ display: 'flex', gap: 6 }}>
          <Slider accentColor={config.accentColor} lbl="Pan X" value={config.coverPanX ?? 0} min={-200} max={200} step={5} suffix="px"
            onChange={e => set('coverPanX', parseInt(e.target.value))} />
          <Slider accentColor={config.accentColor} lbl="Pan Y" value={config.coverPanY ?? 0} min={-200} max={200} step={5} suffix="px"
            onChange={e => set('coverPanY', parseInt(e.target.value))} />
        </div>

        {/* Gameplay */}
        <div style={subDivider} />
        <div style={subHeader(config.accentColor)}>Gameplay Video</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Slider accentColor={config.accentColor} lbl="W" value={config.gameplayW || 340} min={100} max={600} step={10} suffix="px"
            onChange={e => set('gameplayW', parseInt(e.target.value))} />
          <Slider accentColor={config.accentColor} lbl="H" value={config.gameplayH || 280} min={80} max={320} step={10} suffix="px"
            onChange={e => set('gameplayH', parseInt(e.target.value))} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Slider accentColor={config.accentColor} lbl="X" value={config.gameplayX ?? 30} min={0} max={800} step={5} suffix="px"
            onChange={e => set('gameplayX', parseInt(e.target.value))} />
          <Slider accentColor={config.accentColor} lbl="Y" value={config.gameplayY ?? 30} min={0} max={300} step={5} suffix="px"
            onChange={e => set('gameplayY', parseInt(e.target.value))} />
        </div>
        <Slider accentColor={config.accentColor} lbl="Zoom" value={Math.round((config.gameplayZoom ?? 1) * 100)} min={50} max={300} step={5} suffix="%"
          onChange={e => set('gameplayZoom', parseInt(e.target.value) / 100)} />
        <div style={{ display: 'flex', gap: 6 }}>
          <Slider accentColor={config.accentColor} lbl="Pan X" value={config.gameplayPanX ?? 0} min={-200} max={200} step={5} suffix="px"
            onChange={e => set('gameplayPanX', parseInt(e.target.value))} />
          <Slider accentColor={config.accentColor} lbl="Pan Y" value={config.gameplayPanY ?? 0} min={-200} max={200} step={5} suffix="px"
            onChange={e => set('gameplayPanY', parseInt(e.target.value))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Toggle accentColor={config.accentColor} label="Glow" value={config.gameplayGlow !== false} onChange={v => set('gameplayGlow', v)} />
        </div>
        {config.gameplayGlow !== false && (
          <Slider accentColor={config.accentColor} lbl="Intensité glow" value={config.gameplayGlowSize ?? 16} min={0} max={40} step={2} suffix="px"
            onChange={e => set('gameplayGlowSize', parseInt(e.target.value))} />
        )}

        {/* Color filters */}
        <div style={{ marginTop: 8 }}>
          <div style={label}>Filtres couleur gameplay</div>
          <Slider accentColor={config.accentColor} lbl="Luminosité" value={Math.round((config.gameplayBrightness ?? 1) * 100)} min={20} max={200} step={5} suffix="%"
            onChange={e => set('gameplayBrightness', parseInt(e.target.value) / 100)} />
          <Slider accentColor={config.accentColor} lbl="Contraste" value={Math.round((config.gameplayContrast ?? 1) * 100)} min={20} max={200} step={5} suffix="%"
            onChange={e => set('gameplayContrast', parseInt(e.target.value) / 100)} />
          <Slider accentColor={config.accentColor} lbl="Saturation" value={Math.round((config.gameplaySaturation ?? 1) * 100)} min={0} max={300} step={5} suffix="%"
            onChange={e => set('gameplaySaturation', parseInt(e.target.value) / 100)} />
          <Slider accentColor={config.accentColor} lbl="Teinte" value={config.gameplayHue ?? 0} min={-180} max={180} step={5} suffix="°"
            onChange={e => set('gameplayHue', parseInt(e.target.value))} />
          {(config.gameplayBrightness !== 1 || config.gameplayContrast !== 1 || config.gameplaySaturation !== 1 || config.gameplayHue !== 0) && (
            <button onClick={() => onConfigChange({ ...config, gameplayBrightness: 1, gameplayContrast: 1, gameplaySaturation: 1, gameplayHue: 0 })}
              style={{ width: '100%', padding: '4px 0', marginTop: 4,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4, color: 'rgba(255,255,255,0.35)',
                cursor: 'pointer', fontSize: 10, fontFamily: "'Space Mono', monospace" }}>↺ Reset filtres</button>
          )}
        </div>

        {/* Trim */}
        {gameplayDuration > 0 && (() => {
          const dur = gameplayDuration;
          const trimStart = config.gameplayTrimStart ?? 0;
          const trimEnd = config.gameplayTrimEnd ?? dur;
          const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
          return (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={label}>Trim vidéo gameplay</div>
                <div style={{ fontSize: 9, color: 'rgba(241,240,245,0.3)', fontFamily: "'Space Mono',monospace" }}>
                  {fmt(trimStart)} → {fmt(trimEnd)} ({fmt(trimEnd - trimStart)})
                </div>
              </div>
              <WaveformScrubber
                waveformData={null}
                duration={dur}
                start={trimStart}
                end={trimEnd}
                accentColor={config.accentColor}
                onChange={({ start, end }) => onConfigChange({ ...config, gameplayTrimStart: start, gameplayTrimEnd: end })}
              />
              <button
                onClick={() => onConfigChange({ ...config, gameplayTrimStart: 0, gameplayTrimEnd: dur })}
                style={{
                  width: '100%', padding: '4px 0', marginTop: 6,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 4, color: 'rgba(255,255,255,0.35)',
                  cursor: 'pointer', fontSize: 10, fontFamily: "'Space Mono', monospace",
                }}>↺ Réinitialiser</button>
            </div>
          );
        })()}

        {/* Background */}
        <div style={subDivider} />
        <div style={subHeader(config.accentColor)}>Arrière-plan</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[{ k: 'file', l: 'Fichier' }, { k: 'color', l: 'Couleur unie' }].map(m => (
            <button key={m.k} onClick={() => set('bgMode', m.k)} style={{
              flex: 1, padding: '7px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              border: (config.bgMode || 'file') === m.k ? `1px solid ${config.accentColor}` : '1px solid rgba(255,255,255,0.07)',
              background: (config.bgMode || 'file') === m.k ? config.accentColor + '20' : 'rgba(255,255,255,0.03)',
              color: (config.bgMode || 'file') === m.k ? config.accentColor : 'rgba(241,240,245,0.5)',
              cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
            }}>{m.l}</button>
          ))}
        </div>
        {(config.bgMode || 'file') === 'color' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={label}>Couleur</div>
              <input type="color" value={config.bgColor || '#0d0d1a'} style={colorInput}
                onChange={e => set('bgColor', e.target.value)} />
            </div>
            <div style={{ fontSize: 11, color: 'rgba(241,240,245,0.35)', lineHeight: 1.4 }}>
              Le fond accent s'applique<br/>par-dessus automatiquement.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6 }}>
              <Slider accentColor={config.accentColor} lbl="Blur" value={config.bgBlur ?? 60} min={0} max={120} step={5} suffix="px"
                onChange={e => set('bgBlur', parseInt(e.target.value))} />
              <Slider accentColor={config.accentColor} lbl="Bright" value={Math.round((config.bgBrightness ?? 0.3) * 100)} min={5} max={100} step={5} suffix="%"
                onChange={e => set('bgBrightness', parseInt(e.target.value) / 100)} />
            </div>
            <Slider accentColor={config.accentColor} lbl="Zoom" value={Math.round((config.bgZoom ?? 1) * 100)} min={50} max={300} step={5} suffix="%"
              onChange={e => set('bgZoom', parseInt(e.target.value) / 100)} />
            <div style={{ display: 'flex', gap: 6 }}>
              <Slider accentColor={config.accentColor} lbl="Pan X" value={config.bgPanX ?? 0} min={-500} max={500} step={10} suffix="px"
                onChange={e => set('bgPanX', parseInt(e.target.value))} />
              <Slider accentColor={config.accentColor} lbl="Pan Y" value={config.bgPanY ?? 0} min={-500} max={500} step={10} suffix="px"
                onChange={e => set('bgPanY', parseInt(e.target.value))} />
            </div>
          </>
        )}

        {/* Background video trim */}
        {bgDuration > 0 && (config.bgMode || 'file') === 'file' && (() => {
          const dur = bgDuration;
          const trimStart = config.bgTrimStart ?? 0;
          const trimEnd = config.bgTrimEnd ?? dur;
          const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
          return (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={label}>Trim vidéo arrière-plan</div>
                <div style={{ fontSize: 9, color: 'rgba(241,240,245,0.3)', fontFamily: "'Space Mono',monospace" }}>
                  {fmt(trimStart)} → {fmt(trimEnd)} ({fmt(trimEnd - trimStart)})
                </div>
              </div>
              <WaveformScrubber
                waveformData={null}
                duration={dur}
                start={trimStart}
                end={trimEnd}
                accentColor={config.accentColor}
                onChange={({ start, end }) => onConfigChange({ ...config, bgTrimStart: start, bgTrimEnd: end })}
              />
              <button
                onClick={() => onConfigChange({ ...config, bgTrimStart: 0, bgTrimEnd: dur })}
                style={{
                  width: '100%', padding: '4px 0', marginTop: 6,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 4, color: 'rgba(255,255,255,0.35)',
                  cursor: 'pointer', fontSize: 10, fontFamily: "'Space Mono', monospace",
                }}>↺ Réinitialiser</button>
            </div>
          );
        })()}

        {/* Info Card */}
        <div style={subDivider} />
        <div style={subHeader(config.accentColor)}>Carte info</div>
        <Slider accentColor={config.accentColor} lbl="Hauteur" value={config.cardHeight || 340} min={100} max={600} step={10} suffix="px"
          onChange={e => set('cardHeight', parseInt(e.target.value))} />
        {(config.cardStyle || 'fullwidth') !== 'fullwidth' && (
          <Slider accentColor={config.accentColor} lbl="Position Y"
            value={Math.round((config.cardPositionY ?? 0.70) * 100)} min={30} max={92} step={1} suffix="%"
            onChange={e => set('cardPositionY', parseInt(e.target.value) / 100)} />
        )}
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* HOOK INTRO */}
      {/* ══════════════════════════════════════ */}
      <Section title="Hook Intro" icon="🎬" defaultOpen={false} accentColor={config.accentColor}>
        <Toggle accentColor={config.accentColor} label="Activer le Hook Intro" value={config.showHookIntro || false} onChange={v => set('showHookIntro', v)} />

        {config.showHookIntro && (
          <>
            <Slider accentColor={config.accentColor} lbl="Durée" value={config.hookDuration || 5} min={2} max={12} step={0.5} suffix="s"
              onChange={e => set('hookDuration', parseFloat(e.target.value))} />
            <Slider accentColor={config.accentColor} lbl="Opacité fond noir" value={Math.round((config.hookOverlayOpacity ?? 0.85) * 100)} min={0} max={100} step={5} suffix="%"
              onChange={e => set('hookOverlayOpacity', parseInt(e.target.value) / 100)} />

            <Toggle accentColor={config.accentColor} label="✍️ Texte perso" value={config.showHookText !== false} onChange={v => set('showHookText', v)} />
            {config.showHookText !== false && (
              <div style={{ paddingLeft: 12, marginTop: -4, marginBottom: 4 }}>
                <textarea style={textarea} rows={2} value={config.hookText || 'You forgot this masterpiece...'}
                  onChange={e => set('hookText', e.target.value)}
                  placeholder="ex: You forgot this masterpiece..." />
              </div>
            )}

            {/* ── TTS ── */}
            <Toggle accentColor={config.accentColor} label="🔊 Synthèse vocale" value={config.hookTTS || false} onChange={v => set('hookTTS', v)} />
            {config.hookTTS && (
              <div style={{ paddingLeft: 12, marginTop: -4, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {/* Provider toggle */}
                <div style={{ display: 'flex', gap: 5 }}>
                  {[{ k: 'system', l: '🖥 Système' }, { k: 'elevenlabs', l: '⚡ ElevenLabs' }].map(p => {
                    const active = (config.hookTTSProvider || 'system') === p.k;
                    return (
                      <button key={p.k} onClick={() => set('hookTTSProvider', p.k)} style={{
                        flex: 1, padding: '6px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                        border: active ? `1px solid ${config.accentColor}` : '1px solid rgba(255,255,255,0.07)',
                        background: active ? config.accentColor + '20' : 'rgba(255,255,255,0.03)',
                        color: active ? config.accentColor : 'rgba(241,240,245,0.5)',
                        cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                      }}>{p.l}</button>
                    );
                  })}
                </div>

                {/* ── Système ── */}
                {(config.hookTTSProvider || 'system') === 'system' && (<>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Slider accentColor={config.accentColor} lbl="Vitesse" value={config.hookTTSRate ?? 0.9} min={0.5} max={2} step={0.1}
                      onChange={e => set('hookTTSRate', parseFloat(e.target.value))} />
                    <Slider accentColor={config.accentColor} lbl="Hauteur" value={config.hookTTSPitch ?? 1.0} min={0.5} max={2} step={0.1}
                      onChange={e => set('hookTTSPitch', parseFloat(e.target.value))} />
                  </div>
                  {ttsVoices.length > 0 && (
                    <select value={config.hookTTSVoice || ''} onChange={e => set('hookTTSVoice', e.target.value)}
                      style={{ ...input, fontSize: 11 }}>
                      <option value="">Voix par défaut</option>
                      {ttsVoices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                    </select>
                  )}
                  <button onClick={() => {
                    window.speechSynthesis.cancel();
                    const utt = new SpeechSynthesisUtterance(config.hookText || 'You forgot this masterpiece...');
                    utt.rate  = config.hookTTSRate  ?? 0.9;
                    utt.pitch = config.hookTTSPitch ?? 1.0;
                    if (config.hookTTSVoice) {
                      const match = window.speechSynthesis.getVoices().find(v => v.name === config.hookTTSVoice);
                      if (match) utt.voice = match;
                    }
                    window.speechSynthesis.speak(utt);
                  }} style={{
                    width: '100%', padding: '5px 0', borderRadius: 5,
                    background: config.accentColor + '18', border: `1px solid ${config.accentColor}40`,
                    color: config.accentColor, fontSize: 11, cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                  }}>▶ Prévisualiser</button>
                </>)}

                {/* ── ElevenLabs ── */}
                {config.hookTTSProvider === 'elevenlabs' && (<>
                  <div>
                    <div style={label}>Clé API ElevenLabs</div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <input style={{ ...input, flex: 1, fontSize: 11 }} type="password"
                        value={config.elevenLabsKey || ''} placeholder="Coller ta clé ici..."
                        onChange={e => { set('elevenLabsKey', e.target.value); setElVoices([]); }} />
                      <button onClick={() => fetchElVoices(config.elevenLabsKey)} style={{
                        padding: '0 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${config.accentColor}40`, background: config.accentColor + '15',
                        color: config.accentColor, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap',
                      }}>{elVoicesLoading ? '…' : 'Charger'}</button>
                    </div>
                    {elVoicesError && <div style={{ fontSize: 10, color: '#f87171', marginTop: 3 }}>{elVoicesError}</div>}
                  </div>

                  {elVoices.length > 0 && (
                    <div>
                      <div style={label}>Voix</div>
                      <select value={config.hookTTSVoiceId || ''} onChange={e => set('hookTTSVoiceId', e.target.value)}
                        style={{ ...input, fontSize: 11 }}>
                        <option value="">-- Choisir une voix --</option>
                        {elVoices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <Slider accentColor={config.accentColor} lbl="Stabilité" value={Math.round((config.hookTTSStability ?? 0.5) * 100)} min={0} max={100} step={5} suffix="%"
                      onChange={e => set('hookTTSStability', parseInt(e.target.value) / 100)} />
                    <Slider accentColor={config.accentColor} lbl="Clarté" value={Math.round((config.hookTTSSimilarity ?? 0.75) * 100)} min={0} max={100} step={5} suffix="%"
                      onChange={e => set('hookTTSSimilarity', parseInt(e.target.value) / 100)} />
                  </div>

                  <button onClick={async () => {
                    if (!config.elevenLabsKey || !config.hookTTSVoiceId) return;
                    setElPreviewLoading(true);
                    const url = await onGenerateElevenLabs();
                    setElPreviewLoading(false);
                    if (url) { const a = new Audio(url); a.play(); }
                  }} style={{
                    width: '100%', padding: '5px 0', borderRadius: 5,
                    background: config.accentColor + '18', border: `1px solid ${config.accentColor}40`,
                    color: config.accentColor, fontSize: 11, cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                  }}>{elPreviewLoading ? '⏳ Génération…' : '▶ Générer & prévisualiser'}</button>

                  <div style={{ fontSize: 9, color: 'rgba(241,240,245,0.25)', lineHeight: 1.4 }}>
                    L'audio est mis en cache — il n'est regénéré que si le texte ou la voix changent.
                  </div>
                </>)}
              </div>
            )}

            <Toggle accentColor={config.accentColor} label="🎮 Nom du jeu" value={config.showHookGameName !== false} onChange={v => set('showHookGameName', v)} />
            <Toggle accentColor={config.accentColor} label="📅 Nostalgie" value={config.showHookNostalgia !== false} onChange={v => set('showHookNostalgia', v)} />

            <Slider accentColor={config.accentColor} lbl="Position Y" value={Math.round((config.hookPositionY ?? 0.45) * 100)} min={10} max={85} step={1} suffix="%"
              onChange={e => set('hookPositionY', parseInt(e.target.value) / 100)} />

            {/* ── Texte après le hook ── */}
            <div style={subDivider} />
            <Toggle accentColor={config.accentColor} label="Texte après le hook" value={config.afterHookEnabled || false} onChange={v => set('afterHookEnabled', v)} />
            {config.afterHookEnabled && (
              <div style={{ paddingLeft: 12, marginTop: -4 }}>
                <Slider accentColor={config.accentColor} lbl="Durée" value={config.afterHookDuration ?? 4} min={1} max={30} step={0.5} suffix="s"
                  onChange={e => set('afterHookDuration', parseFloat(e.target.value))} />
                <Slider accentColor={config.accentColor} lbl="Position Y" value={Math.round((config.afterHookPositionY ?? 0.78) * 100)} min={10} max={95} step={1} suffix="%"
                  onChange={e => set('afterHookPositionY', parseFloat(e.target.value) / 100)} />
                <Slider accentColor={config.accentColor} lbl="Taille police" value={config.afterHookFontSize ?? 44} min={20} max={90} step={2} suffix="px"
                  onChange={e => set('afterHookFontSize', parseFloat(e.target.value))} />
                <div style={{ marginBottom: 4 }}>
                  <div style={label}>Police</div>
                  <select value={config.afterHookFont || "'Outfit', sans-serif"} onChange={e => set('afterHookFont', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', color: '#f1f0f5', fontSize: 13, outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='rgba(255,255,255,0.4)' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
                    <option value="'Outfit', sans-serif">Outfit (Default)</option>
                    <option value="'Space Mono', monospace">Space Mono</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Georgia', serif">Georgia</option>
                    <option value="Impact, sans-serif">Impact</option>
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                    <option value="'Verdana', sans-serif">Verdana</option>
                    <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
                  </select>
                </div>
                {(config.afterHookLines || ['']).map((line, i) => {
                  const lines = config.afterHookLines || [''];
                  return (
                    <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                      <input style={{ ...input, flex: 1, margin: 0 }} value={line}
                        onChange={e => { const next = [...lines]; next[i] = e.target.value; set('afterHookLines', next); }}
                        placeholder={`Ligne ${i + 1}...`} />
                      {lines.length > 1 && (
                        <button onClick={() => set('afterHookLines', lines.filter((_, j) => j !== i))} style={{
                          background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)',
                          borderRadius: 4, color: 'rgba(255,120,120,0.8)', cursor: 'pointer',
                          width: 22, height: 22, fontSize: 12, padding: 0, flexShrink: 0,
                        }}>×</button>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => set('afterHookLines', [...(config.afterHookLines || ['']), ''])} style={{
                  width: '100%', padding: '4px 0',
                  background: `${config.accentColor || '#a78bfa'}12`,
                  border: `1px dashed ${config.accentColor || '#a78bfa'}40`,
                  borderRadius: 4, color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', fontSize: 10, fontFamily: "'Space Mono', monospace",
                }}>+ Ajouter une ligne</button>
              </div>
            )}
          </>
        )}
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* APPEARANCE */}
      {/* ══════════════════════════════════════ */}
      <Section title="Appearance" icon="🎨" defaultOpen={false} accentColor={config.accentColor}>

        {/* ── Templates ── */}
        <div style={subHeader(config.accentColor)}>Templates</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
          {STYLE_TEMPLATES.map(t => {
            const active = config._templateId === t.id;
            return (
              <button
                key={t.id}
                title={t.name}
                onClick={() => onConfigChange(prev => ({ ...prev, ...t.config, _templateId: t.id }))}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                  border: active ? `1px solid ${t.config.accentColor}` : '1px solid rgba(255,255,255,0.07)',
                  background: active ? t.config.accentColor + '18' : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.15s',
                }}
              >
                {/* Mini preview swatch */}
                <div style={{
                  width: 36, height: 24, borderRadius: 5, flexShrink: 0,
                  background: `linear-gradient(135deg, ${t.preview[0]} 50%, ${t.preview[1]})`,
                  border: active ? `1px solid ${t.config.accentColor}80` : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: active ? `0 0 8px ${t.config.accentColor}60` : 'none',
                }} />
                <span style={{
                  fontSize: 9, fontFamily: "'Space Mono', monospace",
                  color: active ? t.config.accentColor : 'rgba(241,240,245,0.45)',
                  fontWeight: 600, textAlign: 'center', lineHeight: 1.2,
                }}>{t.name}</span>
              </button>
            );
          })}
        </div>

        {/* ── Presets ── */}
        <div style={subHeader(config.accentColor)}>Presets couleur</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 4 }}>
          {STYLE_PRESETS.map(p => {
            const active = config.accentColor === p.accent;
            return (
              <button
                key={p.name}
                title={p.name}
                onClick={() => onConfigChange({
                  ...config,
                  accentColor: p.accent,
                  cardBgColor: p.card,
                  cardBorderColor: p.border,
                  fontColor: p.fontColor || '#ffffff',
                  colorFilter: p.colorFilter,
                  colorFilterIntensity: p.colorFilterIntensity,
                  vignetteIntensity: p.vignetteIntensity,
                })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 7, cursor: 'pointer',
                  border: active ? `1px solid ${p.accent}` : '1px solid rgba(255,255,255,0.07)',
                  background: active ? p.accent + '18' : 'rgba(255,255,255,0.03)',
                  color: active ? p.accent : 'rgba(241,240,245,0.5)',
                  fontSize: 11, fontWeight: 600, fontFamily: "'Outfit', sans-serif",
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${p.accent}, ${p.card})`,
                  boxShadow: active ? `0 0 6px ${p.accent}80` : 'none',
                }} />
                {p.name}
              </button>
            );
          })}
        </div>

        {/* ── Couleurs ── */}
        <div style={subDivider} />
        <div style={subHeader(config.accentColor)}>Couleurs</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { lbl: 'Accent',     key: 'accentColor',      def: '#a78bfa' },
            { lbl: 'Texte',      key: 'fontColor',        def: '#ffffff' },
            { lbl: 'Fond carte', key: 'cardBgColor',      def: config.accentColor },
            { lbl: 'Bordure',    key: 'cardBorderColor',  def: config.accentColor },
          ].map(({ lbl, key, def }) => (
            <div key={key}>
              <div style={label}>{lbl}</div>
              <input type="color"
                defaultValue={config[key] || def}
                style={colorInput}
                onInput={e => onConfigChange(prev => ({ ...prev, [key]: e.target.value }))}
                onChange={e => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* ── Carte info ── */}
        <div style={subDivider} />
        <div style={subHeader(config.accentColor)}>Carte info</div>
        <div>
          <div style={label}>Style</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {[
              { k: 'fullwidth',  l: 'Full Width',  icon: () => <><rect x="1" y="11" width="22" height="6" rx="1" fill="currentColor" opacity=".9"/></> },
              { k: 'glass',      l: 'Glass',       icon: () => <><rect x="3" y="7" width="18" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".7"/><rect x="3" y="7" width="18" height="2" rx="1" fill="currentColor" opacity=".3"/></> },
              { k: 'minimal',    l: 'Minimal',     icon: () => <><text x="12" y="11" textAnchor="middle" fontSize="6" fill="currentColor" fontWeight="bold" opacity=".9">Aa</text><text x="12" y="16" textAnchor="middle" fontSize="4" fill="currentColor" opacity=".5">artist</text></> },
              { k: 'neon',       l: 'Neon',        icon: () => <><rect x="3" y="7" width="18" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="7" width="18" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="4" opacity=".15"/><line x1="3" y1="7" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5"/><line x1="3" y1="7" x2="3" y2="11" stroke="currentColor" strokeWidth="1.5"/></> },
              { k: 'split',      l: 'Split',       icon: () => <><rect x="2" y="7" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".8"/><rect x="15" y="7" width="7" height="9" rx="1.5" fill="currentColor" opacity=".25"/><line x1="14" y1="7" x2="14" y2="16" stroke="currentColor" strokeWidth="1" opacity=".4"/></> },
              { k: 'cinematic',  l: 'Cinéma',      icon: () => <><rect x="1" y="9" width="22" height="7" rx="0" fill="currentColor" opacity=".85"/><rect x="1" y="7" width="22" height="2" rx="0" fill="currentColor" opacity=".3"/><rect x="1" y="16" width="22" height="2" rx="0" fill="currentColor" opacity=".3"/></> },
              { k: 'polaroid',   l: 'Polaroid',    icon: () => <><rect x="5" y="5" width="14" height="13" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".8"/><rect x="6" y="6" width="12" height="8" fill="currentColor" opacity=".2"/><rect x="6" y="15" width="12" height="2" fill="currentColor" opacity=".15"/></> },
            ].map(s => {
              const active = (config.cardStyle || 'fullwidth') === s.k;
              return (
                <button key={s.k} onClick={() => set('cardStyle', s.k)} style={{
                  padding: '8px 4px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                  border: active ? `1px solid ${config.accentColor}` : '1px solid rgba(255,255,255,0.07)',
                  background: active ? config.accentColor + '18' : 'rgba(255,255,255,0.03)',
                  color: active ? config.accentColor : 'rgba(241,240,245,0.45)',
                  cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <svg width="24" height="18" viewBox="0 0 24 18" style={{ display: 'block' }}>
                    {s.icon()}
                  </svg>
                  {s.l}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={label}>Police</div>
          <select value={config.cardFont || "'Outfit', sans-serif"} onChange={e => set('cardFont', e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)',
              color: '#f1f0f5', fontSize: 13, outline: 'none', fontFamily: "'Outfit',sans-serif",
              cursor: 'pointer', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='rgba(255,255,255,0.4)' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
            }}>
            <option value="'Outfit', sans-serif">Outfit (Default)</option>
            <option value="'Space Mono', monospace">Space Mono</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Georgia', serif">Georgia</option>
            <option value="Impact, sans-serif">Impact</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
            <option value="'Verdana', sans-serif">Verdana</option>
            <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
          </select>
        </div>

        {/* ── Watermark ── */}
        <div style={subDivider} />
        <div style={subHeader(config.accentColor)}>Watermark / Logo</div>
        <Toggle accentColor={config.accentColor} label="Activer le watermark" value={config.watermarkEnabled || false} onChange={v => set('watermarkEnabled', v)} />
        <input ref={watermarkRef} type="file" accept="image/png,image/webp,image/svg+xml" hidden
          onChange={e => e.target.files[0] && onLoadWatermark(e.target.files[0])} />
        <button style={fileBtn} onClick={() => watermarkRef.current.click()}>🖼️ Logo / Watermark (PNG)</button>
        {config.watermarkEnabled && (
          <div style={{ paddingLeft: 12, marginTop: -4 }}>
            <Slider accentColor={config.accentColor} lbl="Taille" value={config.watermarkSize ?? 120} min={30} max={400} step={10} suffix="px"
              onChange={e => set('watermarkSize', parseFloat(e.target.value))} />
            <Slider accentColor={config.accentColor} lbl="Opacité" value={Math.round((config.watermarkOpacity ?? 0.8) * 100)} min={10} max={100} step={5} suffix="%"
              onChange={e => set('watermarkOpacity', parseFloat(e.target.value) / 100)} />
            <Slider accentColor={config.accentColor} lbl="Position X" value={Math.round((config.watermarkX ?? 0.85) * 100)} min={0} max={100} step={1} suffix="%"
              onChange={e => set('watermarkX', parseFloat(e.target.value) / 100)} />
            <Slider accentColor={config.accentColor} lbl="Position Y" value={Math.round((config.watermarkY ?? 0.06) * 100)} min={0} max={100} step={1} suffix="%"
              onChange={e => set('watermarkY', parseFloat(e.target.value) / 100)} />
          </div>
        )}

        {/* ── Effets visuels ── */}
        <div style={subDivider} />
        <div style={subHeader(config.accentColor)}>Effets visuels</div>
        <Toggle accentColor={config.accentColor} label="Beat flash" value={config.beatEffects !== false} onChange={v => set('beatEffects', v)} />
        {config.beatEffects !== false && (
          <div style={{ paddingLeft: 12, marginTop: -4 }}>
            <Slider accentColor={config.accentColor} lbl="Sensibilité" value={Math.round((config.beatSensitivity ?? 1.2) * 10)} min={10} max={20} step={1}
              onChange={e => set('beatSensitivity', parseInt(e.target.value) / 10)} />
            <Slider accentColor={config.accentColor} lbl="Intensité flash" value={Math.round((config.beatIntensity ?? 1.0) * 10)} min={2} max={20} step={1}
              onChange={e => set('beatIntensity', parseInt(e.target.value) / 10)} />
          </div>
        )}
        <Toggle accentColor={config.accentColor} label="Beat-sync effets auto" value={config.beatSyncEffects || false} onChange={v => set('beatSyncEffects', v)} />
        {config.beatSyncEffects && (
          <div style={{ paddingLeft: 12, marginTop: -4 }}>
            <div style={{ fontSize: 11, color: 'rgba(241,240,245,0.45)', marginBottom: 5 }}>Effets déclenchés sur chaque beat</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['zoom', 'flash', 'glitch', 'shake'].map(t => {
                const active = (config.beatSyncTypes || ['zoom']).includes(t);
                return (
                  <button key={t} onClick={() => {
                    const types = config.beatSyncTypes || ['zoom'];
                    const next = active ? types.filter(x => x !== t) : [...types, t];
                    set('beatSyncTypes', next.length ? next : [t]);
                  }} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                    border: active ? `1px solid ${config.accentColor}` : '1px solid rgba(255,255,255,0.07)',
                    background: active ? config.accentColor + '20' : 'rgba(255,255,255,0.03)',
                    color: active ? config.accentColor : 'rgba(241,240,245,0.4)',
                    fontFamily: "'Space Mono', monospace",
                  }}>{t}</button>
                );
              })}
            </div>
          </div>
        )}
        <Toggle accentColor={config.accentColor} label="⚡ Intro animée (glitch)" value={config.vinylIntro || false} onChange={v => set('vinylIntro', v)} />
        {config.vinylIntro && (
          <Slider accentColor={config.accentColor} lbl="Durée intro" value={config.vinylIntroDuration ?? 1.5} min={0.5} max={4} step={0.5} suffix="s"
            onChange={e => set('vinylIntroDuration', parseFloat(e.target.value))} />
        )}
        <Toggle accentColor={config.accentColor} label="Blob Visualizer" value={config.showBlob} onChange={v => set('showBlob', v)} />
        <Toggle accentColor={config.accentColor} label="Particles" value={config.showParticles} onChange={v => set('showParticles', v)} />
        <Toggle accentColor={config.accentColor} label="Equalizer" value={config.showEqualizer} onChange={v => set('showEqualizer', v)} />
        {config.showEqualizer && (
          <div style={{ paddingLeft: 12, marginTop: -4 }}>
            <div style={label}>Style</div>
            <select
              value={config.equalizerStyle || 'bars'}
              onChange={e => set('equalizerStyle', e.target.value)}
              style={{ ...input, marginBottom: 4 }}
            >
              <option value="bars">Barres circulaires + peak dots</option>
              <option value="oscilloscope">Oscilloscope ring</option>
            </select>
          </div>
        )}
        <Toggle accentColor={config.accentColor} label="Gameplay Window" value={config.showGameplay} onChange={v => set('showGameplay', v)} />
        <Toggle accentColor={config.accentColor} label="Retro Scanlines" value={config.showScanlines} onChange={v => set('showScanlines', v)} />

        {/* ── Filtre couleur + Vignette ── */}
        <div style={subDivider} />
        <div style={subHeader(config.accentColor)}>Ambiance</div>

        <div style={{ marginBottom: 6 }}>
          <div style={label}>Filtre couleur</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {[
              { k: 'none',    l: 'Aucun',   color: 'rgba(255,255,255,0.1)' },
              { k: 'pastel',  l: 'Pastel',  color: '#fdf4ff' },
              { k: 'warm',    l: 'Chaud',   color: '#fbbf24' },
              { k: 'cold',    l: 'Froid',   color: '#60a5fa' },
              { k: 'vintage', l: 'Vintage', color: '#d97706' },
              { k: 'neon',    l: 'Néon',    color: '#e879f9' },
            ].map(f => {
              const active = (config.colorFilter || 'none') === f.k;
              return (
                <button key={f.k} onClick={() => set('colorFilter', f.k)} style={{
                  padding: '5px 4px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  border: active ? `1px solid ${config.accentColor}` : '1px solid rgba(255,255,255,0.07)',
                  background: active ? config.accentColor + '18' : 'rgba(255,255,255,0.03)',
                  color: active ? config.accentColor : 'rgba(241,240,245,0.45)',
                  fontFamily: "'Space Mono', monospace",
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: f.color, opacity: 0.85 }} />
                  {f.l}
                </button>
              );
            })}
          </div>
        </div>

        {config.colorFilter && config.colorFilter !== 'none' && (
          <Slider accentColor={config.accentColor} lbl="Intensité filtre"
            value={Math.round((config.colorFilterIntensity ?? 0.15) * 100)} min={1} max={60} step={1} suffix="%"
            onChange={e => set('colorFilterIntensity', parseInt(e.target.value) / 100)} />
        )}

        <Slider accentColor={config.accentColor} lbl="Vignette"
          value={Math.round((config.vignetteIntensity ?? 0) * 100)} min={0} max={90} step={5} suffix="%"
          onChange={e => set('vignetteIntensity', parseInt(e.target.value) / 100)} />
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* EFFECTS TIMELINE */}
      {/* ══════════════════════════════════════ */}
      <Section title="Effects" icon="⚡" defaultOpen={false} accentColor={config.accentColor}>
        <div style={{ fontSize: 10, color: 'rgba(241,240,245,0.4)', marginBottom: 6 }}>
          Add effects at specific timestamps during playback & export.
        </div>

        {/* Effect list */}
        {(config.effects || []).map((fx, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
            background: 'rgba(255,255,255,0.03)', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ flex: 1, fontSize: 11, color: 'rgba(241,240,245,0.6)' }}>
              <span style={{ color: config.accentColor, fontWeight: 700, fontFamily: "'Space Mono',monospace", fontSize: 10 }}>
                {fx.time}s
              </span>
              {' '}{fx.type === 'flash' ? '⚡ Flash' : fx.type === 'glitch' ? '📺 Glitch' : fx.type === 'shake' ? '🫨 Shake' : fx.type === 'invert' ? '🔄 Invert' : fx.type === 'zoom' ? '🔍 Zoom Pulse' : fx.type}
              {fx.duration ? ` (${fx.duration}s)` : ''}
            </div>
            <button onClick={() => {
              const effects = [...(config.effects || [])];
              effects.splice(i, 1);
              set('effects', effects);
            }} style={{
              width: 22, height: 22, borderRadius: 6, fontSize: 12,
              background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.2)',
              color: 'rgba(255,100,100,0.7)', cursor: 'pointer', lineHeight: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
        ))}

        {/* Add new effect */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={label}>Time (s)</div>
            <input id="fx-time" type="number" min="0" step="0.5" defaultValue="5"
              style={{ ...input, padding: '7px 10px', fontSize: 12 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={label}>Duration (s)</div>
            <input id="fx-dur" type="number" min="0.1" max="5" step="0.1" defaultValue="0.5"
              style={{ ...input, padding: '7px 10px', fontSize: 12 }} />
          </div>
        </div>

        <div>
          <div style={label}>Effect Type</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { k: 'flash', l: '⚡ Flash' },
              { k: 'glitch', l: '📺 Glitch' },
              { k: 'shake', l: '🫨 Shake' },
              { k: 'invert', l: '🔄 Invert' },
              { k: 'zoom', l: '🔍 Zoom' },
            ].map(fx => (
              <button key={fx.k} onClick={() => {
                const timeInput = document.getElementById('fx-time');
                const durInput = document.getElementById('fx-dur');
                const t = parseFloat(timeInput?.value) || 5;
                const d = parseFloat(durInput?.value) || 0.5;
                const effects = [...(config.effects || [])];
                effects.push({ type: fx.k, time: t, duration: d });
                effects.sort((a, b) => a.time - b.time);
                set('effects', effects);
              }} style={{
                padding: '6px 10px', borderRadius: 7, fontSize: 10, fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(241,240,245,0.6)', cursor: 'pointer',
                fontFamily: "'Outfit',sans-serif",
              }}>{fx.l}</button>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* EXPORT */}
      {/* ══════════════════════════════════════ */}
      <Section title="Export" icon="⬇" defaultOpen={false} accentColor={config.accentColor}>
        {/* Format */}
        <div>
          <div style={label}>Format</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['mp4', 'webm'].map(f => (
              <button key={f} onClick={() => set('exportFormat', f)} style={{
                flex: 1, padding: '8px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: config.exportFormat === f ? `1px solid ${config.accentColor}` : '1px solid rgba(255,255,255,0.07)',
                background: config.exportFormat === f ? config.accentColor + '20' : 'rgba(255,255,255,0.03)',
                color: config.exportFormat === f ? config.accentColor : 'rgba(241,240,245,0.5)',
                cursor: 'pointer', fontFamily: "'Outfit',sans-serif", textTransform: 'uppercase',
              }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Quality */}
        <div>
          <div style={label}>Quality</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ k: 'high', l: 'High' }, { k: 'medium', l: 'Med' }, { k: 'draft', l: 'Draft' }].map(q => (
              <button key={q.k} onClick={() => set('exportQuality', q.k)} style={{
                flex: 1, padding: '8px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                border: config.exportQuality === q.k ? `1px solid ${config.accentColor}` : '1px solid rgba(255,255,255,0.07)',
                background: config.exportQuality === q.k ? config.accentColor + '20' : 'rgba(255,255,255,0.03)',
                color: config.exportQuality === q.k ? config.accentColor : 'rgba(241,240,245,0.5)',
                cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
              }}>{q.l}</button>
            ))}
          </div>
        </div>

        {/* Time range — waveform scrubber */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div style={label}>Plage d'export</div>
            <div style={{ fontSize: 9, color: 'rgba(241,240,245,0.3)', fontFamily: "'Space Mono',monospace" }}>
              {Math.max(1, (config.exportEnd || audioDuration || 30) - (config.exportStart || 0))}s
              {audioDuration > 0 ? ` / ${Math.floor(audioDuration / 60)}:${String(audioDuration % 60).padStart(2, '0')}` : ''}
            </div>
          </div>
          <WaveformScrubber
            waveformData={waveformData}
            duration={audioDuration || 30}
            start={config.exportStart || 0}
            end={config.exportEnd || audioDuration || 30}
            accentColor={config.accentColor}
            onChange={({ start, end }) => onConfigChange({ ...config, exportStart: start, exportEnd: end })}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1 }}>
              <div style={label}>Début (s)</div>
              <input style={input} type="number" min="0" max={audioDuration || 999} step="1"
                value={config.exportStart || 0}
                onChange={e => set('exportStart', Math.max(0, parseFloat(e.target.value) || 0))} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={label}>Fin (s)</div>
              <input style={input} type="number" min="1" max={audioDuration || 999} step="1"
                value={config.exportEnd || audioDuration || 30}
                onChange={e => set('exportEnd', Math.max(1, parseFloat(e.target.value) || 30))} />
            </div>
          </div>
        </div>

        {/* Normalization */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Toggle accentColor={config.accentColor} label="Normaliser l'audio" value={config.normalizeAudio || false} onChange={v => set('normalizeAudio', v)} />
          {normGain != null && normGain !== 1 && (
            <span style={{ fontSize: 10, color: config.normalizeAudio ? config.accentColor : 'rgba(241,240,245,0.25)', fontFamily: "'Space Mono',monospace" }}>
              {(20 * Math.log10(normGain) >= 0 ? '+' : '') + (20 * Math.log10(normGain)).toFixed(1)} dB
            </span>
          )}
        </div>

        {/* Audio fades */}
        <div style={{ display: 'flex', gap: 6 }}>
          <Slider accentColor={config.accentColor} lbl="Fade in" value={config.exportFadeIn ?? 0} min={0} max={3} step={0.5} suffix="s"
            onChange={e => set('exportFadeIn', parseFloat(e.target.value))} />
          <Slider accentColor={config.accentColor} lbl="Fade out" value={config.exportFadeOut ?? 1} min={0} max={3} step={0.5} suffix="s"
            onChange={e => set('exportFadeOut', parseFloat(e.target.value))} />
        </div>

        {/* Export button + Stop */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onExport}
            disabled={isExporting}
            style={{
              flex: 1, padding: '13px', borderRadius: 11, border: 'none',
              background: isExporting
                ? 'rgba(255,255,255,0.08)'
                : `linear-gradient(135deg, ${config.accentColor} 0%, ${config.secondaryColor} 100%)`,
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: isExporting ? 'wait' : 'pointer',
              fontFamily: "'Outfit',sans-serif", letterSpacing: '0.02em',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { if (!isExporting) { e.target.style.transform = 'scale(1.02)'; e.target.style.boxShadow = `0 4px 24px ${config.accentColor}40`; }}}
            onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = 'none'; }}
          >
            {isExporting
              ? `${exportPhase === 'converting' ? '🔄 Converting' : exportPhase === 'saving' ? '💾 Saving' : '⏺ Recording'}...`
              : `⬇ Export ${(config.exportFormat || 'mp4').toUpperCase()}`}
          </button>
          {isExporting && (
            <button
              onClick={onCancelExport}
              style={{
                padding: '13px 16px', borderRadius: 11, border: '1px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.12)', color: '#f87171',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Outfit',sans-serif", transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.target.style.background = 'rgba(239,68,68,0.25)'}
              onMouseLeave={e => e.target.style.background = 'rgba(239,68,68,0.12)'}
            >
              ✕ Stop
            </button>
          )}
        </div>

        {isExporting && (() => {
          const pct = Math.round(exportProgress * 100);
          const eta = exportElapsed > 0 && exportProgress > 0.02
            ? Math.round(exportElapsed / exportProgress * (1 - exportProgress))
            : null;
          const fmtTime = s => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
          return (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Barre de progression */}
              <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 3,
                  background: `linear-gradient(90deg, ${config.accentColor}, ${config.secondaryColor || config.accentColor})`,
                  transition: 'width 0.3s',
                }} />
              </div>
              {/* Stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(241,240,245,0.5)', fontFamily: "'Space Mono',monospace" }}>
                <span>{pct}%</span>
                <span style={{ color: 'rgba(241,240,245,0.3)' }}>écoulé {fmtTime(exportElapsed)}</span>
                {eta !== null && <span>~{fmtTime(eta)} restant</span>}
              </div>
            </div>
          );
        })()}
      </Section>

      {/* ══════════════════════════════════════ */}
      {/* SETTINGS */}
      {/* ══════════════════════════════════════ */}
      <Section title="Settings" icon="⚙" defaultOpen={false} accentColor={config.accentColor}>
        <div>
          <div style={label}>ElevenLabs API Key <span style={{ fontSize: 9, color: 'rgba(241,240,245,0.25)' }}>(elevenlabs.io/profile)</span></div>
          <input style={input} type="password" value={config.elevenLabsKey || ''}
            onChange={e => set('elevenLabsKey', e.target.value)} placeholder="elevenlabs.io → Profile → API Keys" />
        </div>
        <div style={{ fontSize: 9, color: 'rgba(241,240,245,0.2)', lineHeight: 1.4, marginTop: -4 }}>
          💡 Gratuit jusqu'à 10 000 caractères/mois. Utilisé pour la synthèse vocale IA du hook.
        </div>
        <div style={subDivider} />
        <div>
          <div style={label}>Twitch Client ID <span style={{ fontSize: 9, color: 'rgba(241,240,245,0.25)' }}>(dev.twitch.tv/console)</span></div>
          <input style={input} value={config.twitchClientId || ''}
            onChange={e => set('twitchClientId', e.target.value)} placeholder="Twitch Client ID" />
        </div>
        <div>
          <div style={label}>Twitch Client Secret</div>
          <input style={input} type="password" value={config.twitchClientSecret || ''}
            onChange={e => set('twitchClientSecret', e.target.value)} placeholder="Twitch Client Secret" />
        </div>
        <div style={{ fontSize: 9, color: 'rgba(241,240,245,0.2)', lineHeight: 1.4 }}>
          💡 Free — create an app at dev.twitch.tv/console. Used for IGDB game search (cover art, studio, year).
        </div>
      </Section>

      {/* ── Footer ── */}
      <div style={{ padding: '8px 18px', fontSize: 9, color: 'rgba(241,240,245,0.12)', textAlign: 'center', fontFamily: "'Space Mono',monospace", marginTop: 'auto' }}>
        1080×1920 • 30fps • {config.exportFormat === 'mp4' ? 'H.264/AAC' : 'VP8/Opus'}
      </div>
    </div>
  );
}
