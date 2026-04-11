import { useRef } from 'react';

/**
 * PreviewTimeline — interactive timeline.
 * - Curseur mis à jour via DOM ref (pas de re-render par frame)
 * - Segments draggables : fade in, hook, after-hook, fade out
 * - Clic sur la piste = seek
 */
export default function PreviewTimeline({
  config, audioDuration, accentColor,
  cursorRef, timeRef,
  onSeek, onConfigChange,
}) {
  const accent     = accentColor || '#a78bfa';
  const exportStart = config.exportStart || 0;
  const exportEnd   = config.exportEnd   || audioDuration || 30;
  const exportDur   = Math.max(1, exportEnd - exportStart);

  const trackRef    = useRef(null);
  const draggingRef = useRef(null); // { key, onMove }

  // Map a time relative to exportStart → % on the track
  const pct = (t) => Math.max(0, Math.min(100, (t / exportDur) * 100));

  // Convert clientX → time relative to exportStart
  const xToRelTime = (clientX) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * exportDur;
  };

  // ── Drag handle factory ──
  const makeDragHandle = (key, getClamped) => ({
    onMouseDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = key;

      const onMove = (ev) => {
        const relT = xToRelTime(ev.clientX);
        onConfigChange(prev => ({ ...prev, ...getClamped(relT, prev) }));
      };
      const onUp = () => {
        draggingRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
  });

  // ── Drag configs ──
  const fadeInHandle = makeDragHandle('fadeIn', (relT, prev) => ({
    exportFadeIn: Math.max(0, Math.min(exportDur * 0.5, relT)),
  }));
  const hookHandle = makeDragHandle('hook', (relT, prev) => ({
    hookDuration: Math.max(1, Math.min(exportDur * 0.9, relT)),
  }));
  const afterHookHandle = makeDragHandle('afterHook', (relT, prev) => {
    const hookEnd = prev.hookDuration || 5;
    return { afterHookDuration: Math.max(0.5, Math.min(exportDur - hookEnd, relT - hookEnd)) };
  });
  const fadeOutHandle = makeDragHandle('fadeOut', (relT, prev) => ({
    exportFadeOut: Math.max(0, Math.min(exportDur * 0.5, exportDur - relT)),
  }));

  // ── Segment definitions ──
  const fadeIn   = config.exportFadeIn   || 0;
  const hookDur  = config.hookDuration   || 5;
  const afterDur = config.afterHookDuration || 4;
  const fadeOut  = config.exportFadeOut  || 0;

  const segments = [];
  if (fadeIn > 0) segments.push({
    id: 'fadeIn', label: 'Fade in',
    start: 0, end: fadeIn,
    color: 'rgba(167,139,250,0.45)',
    handle: fadeInHandle, handleSide: 'right',
  });
  if (config.showHookIntro) segments.push({
    id: 'hook', label: 'Hook',
    start: 0, end: hookDur,
    color: 'rgba(251,191,36,0.45)',
    handle: hookHandle, handleSide: 'right',
  });
  if (config.showHookIntro && config.afterHookEnabled) segments.push({
    id: 'afterHook', label: 'After hook',
    start: hookDur, end: hookDur + afterDur,
    color: 'rgba(52,211,153,0.45)',
    handle: afterHookHandle, handleSide: 'right',
  });
  if (fadeOut > 0) segments.push({
    id: 'fadeOut', label: 'Fade out',
    start: exportDur - fadeOut, end: exportDur,
    color: 'rgba(167,139,250,0.45)',
    handle: fadeOutHandle, handleSide: 'left',
  });

  const handleTrackClick = (e) => {
    // Don't seek if we were dragging
    if (draggingRef.current) return;
    if (!onSeek) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(exportStart + ratio * exportDur);
  };

  if (!audioDuration) return null;

  const handleStyle = {
    position: 'absolute', top: 0, height: '100%',
    width: 10, cursor: 'ew-resize', zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const handleBarStyle = {
    width: 3, height: '70%', borderRadius: 2,
    background: 'rgba(255,255,255,0.8)',
    boxShadow: '0 0 4px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
  };

  return (
    <div style={{ width: '100%', userSelect: 'none', marginBottom: 10 }}>
      {/* Legend */}
      {segments.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[...segments.map(s => ({ label: s.label, color: s.color })),
            { label: 'Musique', color: 'rgba(255,255,255,0.1)' }
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: "'Space Mono', monospace" }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: item.color,
                border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
              {item.label}
            </div>
          ))}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)',
            fontFamily: "'Space Mono', monospace", alignSelf: 'center' }}>
            ↔ drag edges
          </div>
        </div>
      )}

      {/* Track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{
          position: 'relative', height: 28, borderRadius: 6,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer', overflow: 'visible',
        }}
      >
        {/* Clip overflow for segments only */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden' }}>
          {segments.map(s => (
            <div key={s.id} style={{
              position: 'absolute', top: 0, height: '100%',
              left: `${pct(s.start)}%`,
              width: `${Math.max(0, pct(s.end) - pct(s.start))}%`,
              background: s.color,
            }}>
              {(pct(s.end) - pct(s.start)) > 12 && (
                <span style={{
                  position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 8, color: 'rgba(255,255,255,0.8)',
                  fontFamily: "'Space Mono', monospace",
                  whiteSpace: 'nowrap', pointerEvents: 'none',
                }}>{s.label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Drag handles (outside clip so hit area is accessible) */}
        {segments.map(s => {
          const edgePct = s.handleSide === 'right' ? pct(s.end) : pct(s.start);
          return (
            <div
              key={s.id + '_handle'}
              {...s.handle}
              style={{
                ...handleStyle,
                left: `calc(${edgePct}% - 5px)`,
              }}
              title={`Drag to adjust ${s.label}`}
            >
              <div style={handleBarStyle} />
            </div>
          );
        })}

        {/* Cursor — updated via ref */}
        <div ref={cursorRef} style={{
          position: 'absolute', top: 0, height: '100%',
          left: '0%', width: 2,
          background: '#fff',
          boxShadow: `0 0 8px ${accent}`,
          transform: 'translateX(-1px)',
          pointerEvents: 'none',
          borderRadius: 1,
        }} />

        {/* Start / end labels */}
        <div style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)',
          fontSize: 8, color: 'rgba(255,255,255,0.25)',
          fontFamily: "'Space Mono', monospace", pointerEvents: 'none' }}>
          {fmtTime(exportStart)}
        </div>
        <div style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
          fontSize: 8, color: 'rgba(255,255,255,0.25)',
          fontFamily: "'Space Mono', monospace", pointerEvents: 'none' }}>
          {fmtTime(exportEnd)}
        </div>
      </div>

      {/* Current time label — updated via ref */}
      <div ref={timeRef} style={{
        marginTop: 4, textAlign: 'center',
        fontSize: 9, color: 'rgba(255,255,255,0.3)',
        fontFamily: "'Space Mono', monospace",
      }}>
        0:00 / {fmtTime(exportDur)} export
      </div>
    </div>
  );
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
}
