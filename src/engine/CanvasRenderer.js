// ═══════════════════════════════════════════════════════════════
// VGM Vinyl Creator — Mono-Canvas Renderer
// Everything drawn on a single 1080×1920 canvas.
// This canvas IS the export target — what you see is what you get.
// ═══════════════════════════════════════════════════════════════

const W = 1080;
const H = 1920;
const CX = W / 2;
const CY_VINYL = H * 0.32;
const VINYL_RADIUS = 340;
const LABEL_RATIO = 0.36;
const GROOVE_COUNT = 55;
const NUM_BLOB_POINTS = 10;
const NUM_PARTICLES = 80;
const CARD_H = 340;
const CARD_W = W;
const CARD_THUMB_SIZE = 200;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = W;
  canvas.height = H;

  // ── State ──
  let rotation = 0;
  let time = 0;
  let bands = { bass: 0, mid: 0, treble: 0 };
  let freqData = new Float32Array(128); // raw frequency bins for circular EQ
  let isPlaying = false;
  let coverImg = null;
  let gameImg = null;  // screenshot/artwork for the info card
  let bgImg = null;
  let watermarkImg = null;
  let bgVideo = null;
  let bgType = 'none'; // 'none' | 'image' | 'video'
  let gameplayVideo = null; // gameplay footage for corner window

  // Offscreen canvases for blur
  const bgOffscreen = document.createElement('canvas');
  bgOffscreen.width = 540;
  bgOffscreen.height = 960;
  const bgCtx = bgOffscreen.getContext('2d');

  // Config
  let config = {
    trackTitle: 'Track Title',
    artist: 'Artist',
    gameName: 'Game Name',
    accentColor: '#a78bfa',
    secondaryColor: '#f472b6',
    showParticles: true,
    showBlob: true,
    showEqualizer: true,
    showGameplay: true,
    showScanlines: true,
  };

  // ── Blob points ──
  const blobPoints = Array.from({ length: NUM_BLOB_POINTS }, (_, i) => ({
    angle: (i / NUM_BLOB_POINTS) * Math.PI * 2,
    radius: 160,
    velocity: 0,
    baseOffset: Math.random() * Math.PI * 2,
  }));

  // ── Particles ──
  const particles = Array.from({ length: NUM_PARTICLES }, () => spawnParticle());
  let burstParticles = []; // short-lived beat-burst particles

  function spawnParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -Math.random() * 0.6 - 0.3,
      size: Math.random() * 3 + 0.8,
      opacity: Math.random() * 0.4 + 0.1,
      phase: Math.random() * Math.PI * 2,
    };
  }

  // ── Intro animation state ──
  let introProgress = 0;
  const INTRO_DURATION = 1.5; // seconds
  let startTime = null;
  let cardProgress = 0;       // separate progress for card — starts after hook ends
  const CARD_ANIM_DURATION = 1.0;

  // ── Fade state (for export) ──
  let fadeAlpha = 0; // 0 = fully visible, 1 = fully black
  let fadeMode = 'none'; // 'in' | 'out' | 'none'
  let fadeStart = 0;
  const FADE_DURATION = 1.2;

  // ── Hook→Card transition flash ──
  let hookTransitionTime = null; // set once when hook ends
  const HOOK_TRANSITION_DUR = 0.6;

  // ── Beat flash state ──
  let beatFlash = 0; // 0-1, decays each frame

  // ── Beat-sync auto effects queue ──
  let beatSyncQueue = [];

  // ── Vinyl intro glitch ──
  let introGlitchFired = false;

  // ── Setters ──
  let audioCurrentTime = 0;
  let audioDuration = 0;
  let timeDomainData = new Float32Array(128).fill(0.5);
  function setBands(b) { bands = b; }
  function setFreqData(d) { freqData = d; }
  function setTimeDomainData(d) { timeDomainData = d; }
  function setAudioTime(current, total) { audioCurrentTime = current; audioDuration = total; }
  function setPlaying(p) {
    if (p && !isPlaying) {
      startTime = null;
      introGlitchFired = false;
    }
    isPlaying = p;
  }
  function setConfig(c) { config = { ...config, ...c }; }

  function setGameplayVideo(videoEl) {
    gameplayVideo = videoEl;
  }

  function setCoverArt(src) {
    if (!src) { coverImg = null; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { coverImg = img; };
    img.src = src;
  }

  function setBackground(src, type) {
    bgType = type;
    if (type === 'image') {
      bgVideo = null;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { bgImg = img; };
      img.src = src;
    } else if (type === 'video') {
      bgImg = null;
      // video element created externally, passed in
    } else if (type === 'color') {
      bgImg = null;
      bgVideo = null;
    } else {
      bgImg = null;
      bgVideo = null;
      bgType = 'none';
    }
  }

  function setBackgroundVideo(videoEl) {
    bgVideo = videoEl;
    bgType = 'video';
  }

  function setGameImage(src) {
    if (!src) { gameImg = null; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { gameImg = img; };
    img.src = src;
  }

  function setWatermark(src) {
    if (!src) { watermarkImg = null; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { watermarkImg = img; };
    img.src = src;
  }

  function startFadeIn() { fadeMode = 'in'; fadeStart = time; fadeAlpha = 1; }
  function startFadeOut() { fadeMode = 'out'; fadeStart = time; fadeAlpha = 0; }
  function triggerBeat(intensity) {
    const mult = 1.6 * (config.beatIntensity ?? 1.0);
    beatFlash = Math.min(1, (intensity || 0.8) * mult);

    // Burst particles from vinyl center
    if (config.showParticles) {
      const cx = config.vinylX ?? CX;
      const cy = config.vinylY ?? H * 0.38;
      const count = Math.floor(8 + intensity * 18);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5 * intensity;
        burstParticles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          size: Math.random() * 3 + 1,
          life: 1.0,
          decay: 0.03 + Math.random() * 0.04,
        });
      }
    }
  }

  function triggerBeatSyncEffect(type, duration) {
    beatSyncQueue.push({ type, startTime: time, duration: duration || 0.28 });
  }

  // ── Word-wrap text helper ──
  // Respects \n line breaks AND auto-wraps at maxWidth.
  // Returns the Y coordinate after the last drawn line.
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return y;
    const paragraphs = String(text).split('\n');
    let curY = y;
    for (const para of paragraphs) {
      if (!para.trim()) { curY += lineHeight * 0.5; continue; }
      const words = para.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, x, curY);
          line = word;
          curY += lineHeight;
        } else {
          line = test;
        }
      }
      if (line) { ctx.fillText(line, x, curY); curY += lineHeight; }
    }
    return curY;
  }

  // ── Hex to RGBA helper ──
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ══════════════════════════════════════════
  // DRAW FUNCTIONS
  // ══════════════════════════════════════════

  function drawBackground() {
    const blurAmount = config.bgBlur ?? 60;
    const bgBrightness = config.bgBrightness ?? 0.3;
    const filterStr = `blur(${blurAmount}px) brightness(${bgBrightness}) saturate(1.4)`;

    // Draw blurred background from source
    const bgZoom = config.bgZoom ?? 1;
    const bgPanX = config.bgPanX ?? 0;
    const bgPanY = config.bgPanY ?? 0;
    const bgDrawW = (W + 80) * bgZoom;
    const bgDrawH = (H + 80) * bgZoom;
    const bgDrawX = -40 - (bgDrawW - W - 80) / 2 + bgPanX;
    const bgDrawY = -40 - (bgDrawH - H - 80) / 2 + bgPanY;

    if (bgType === 'color') {
      ctx.fillStyle = config.bgColor || '#0d0d1a';
      ctx.fillRect(0, 0, W, H);
    } else if (bgType === 'image' && bgImg) {
      bgCtx.drawImage(bgImg, 0, 0, 540, 960);
      ctx.save();
      ctx.filter = filterStr;
      ctx.drawImage(bgOffscreen, bgDrawX, bgDrawY, bgDrawW, bgDrawH);
      ctx.filter = 'none';
      ctx.restore();
    } else if (bgType === 'video' && bgVideo && bgVideo.readyState >= 2) {
      bgCtx.drawImage(bgVideo, 0, 0, 540, 960);
      ctx.save();
      ctx.filter = filterStr;
      ctx.drawImage(bgOffscreen, bgDrawX, bgDrawY, bgDrawW, bgDrawH);
      ctx.filter = 'none';
      ctx.restore();
    } else {
      // Default gradient background
      ctx.fillStyle = '#06060c';
      ctx.fillRect(0, 0, W, H);

      // Ambient glow from accent
      const g1 = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, 600);
      g1.addColorStop(0, rgba(config.accentColor, 0.06));
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      const g2 = ctx.createRadialGradient(W * 0.7, H * 0.75, 0, W * 0.7, H * 0.75, 500);
      g2.addColorStop(0, rgba(config.secondaryColor, 0.04));
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
    }

    // Vignette overlay — always
    const vig = ctx.createRadialGradient(CX, H * 0.4, H * 0.15, CX, H * 0.4, H * 0.7);
    vig.addColorStop(0, 'rgba(6,6,12,0)');
    vig.addColorStop(0.7, 'rgba(6,6,12,0.3)');
    vig.addColorStop(1, 'rgba(6,6,12,0.85)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBlob() {
    if (!config.showBlob) return;

    const { bass, mid, treble } = bands;
    const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

    // Update blob points
    blobPoints.forEach((p, i) => {
      const targetRadius = 420
        + bass * 90 * Math.sin(time * 1.8 + p.baseOffset)
        + mid * 55 * Math.cos(time * 2.5 + p.baseOffset * 1.5)
        + treble * 30 * Math.sin(time * 4 + p.baseOffset * 2.2);

      p.velocity = (p.velocity + (targetRadius - p.radius) * 0.05) * 0.90;
      p.radius += p.velocity;
    });

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Draw 2 soft layered blobs (not 3 — less buildup)
    for (let layer = 1; layer >= 0; layer--) {
      const layerScale = 1 + layer * 0.1;
      const layerAlpha = 0.11 + energy * 0.08 - layer * 0.02;

      ctx.save();
      ctx.translate(config.vinylX ?? CX, config.vinylY ?? CY_VINYL);
      ctx.scale(layerScale, layerScale);

      // Build blob path
      ctx.beginPath();
      const pts = blobPoints;
      const n = pts.length;

      const firstX = Math.cos(pts[0].angle) * pts[0].radius;
      const firstY = Math.sin(pts[0].angle) * pts[0].radius;
      ctx.moveTo(firstX, firstY);

      for (let i = 0; i < n; i++) {
        const curr = pts[i];
        const next = pts[(i + 1) % n];
        const afterNext = pts[(i + 2) % n];

        const x1 = Math.cos(curr.angle) * curr.radius;
        const y1 = Math.sin(curr.angle) * curr.radius;
        const x2 = Math.cos(next.angle) * next.radius;
        const y2 = Math.sin(next.angle) * next.radius;
        const x3 = Math.cos(afterNext.angle) * afterNext.radius;
        const y3 = Math.sin(afterNext.angle) * afterNext.radius;

        const cpX = x2 - (x3 - x1) * 0.2;
        const cpY = y2 - (y3 - y1) * 0.2;

        ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      }
      ctx.closePath();

      // Soft gradient — fades heavily from center outward
      const grad = ctx.createRadialGradient(0, 0, 120, 0, 0, 480);
      grad.addColorStop(0, rgba(config.accentColor, layerAlpha));
      grad.addColorStop(0.4, rgba(config.accentColor, layerAlpha * 0.65));
      grad.addColorStop(0.7, rgba(config.secondaryColor, layerAlpha * 0.3));
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.restore();
    }

    // Soft center glow
    if (energy > 0.03) {
      const vx = config.vinylX ?? CX;
      const vy = config.vinylY ?? CY_VINYL;
      const glow = ctx.createRadialGradient(vx, vy, 60, vx, vy, 350);
      glow.addColorStop(0, rgba(config.accentColor, energy * 0.20));
      glow.addColorStop(0.5, rgba(config.secondaryColor, energy * 0.09));
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(vx - 360, vy - 360, 720, 720);
    }

    ctx.restore();
  }

  function drawVinyl() {
    const { bass, mid } = bands;

    if (isPlaying) {
      const speed = config.vinylSpeed ?? 1;
      rotation += (0.012 + bass * 0.005) * speed;
    }

    // Configurable values with defaults
    const vinylR = config.vinylRadius || VINYL_RADIUS;
    const vinylX = config.vinylX ?? CX;
    const vinylY = config.vinylY ?? CY_VINYL;
    const labelRatio = config.labelRatio ?? LABEL_RATIO;

    // Intro scale
    const introScale = easeOutBack(Math.min(introProgress / 0.8, 1));
    const vinylScale = introScale;
    const r = vinylR;
    const labelR = r * labelRatio;

    ctx.save();
    ctx.translate(vinylX, vinylY);
    ctx.scale(vinylScale, vinylScale);
    ctx.rotate(rotation);

    // ── Outer glow (audio reactive) ──
    if (bass > 0.1) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(config.accentColor, bass * 0.35);
      ctx.lineWidth = 4 + bass * 10;
      ctx.shadowColor = config.accentColor;
      ctx.shadowBlur = 30 + bass * 40;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Vinyl disc ──
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const discGrad = ctx.createRadialGradient(0, 0, labelR, 0, 0, r);
    discGrad.addColorStop(0, '#1a1a1a');
    discGrad.addColorStop(0.2, '#0f0f0f');
    discGrad.addColorStop(0.5, '#111111');
    discGrad.addColorStop(0.8, '#0d0d0d');
    discGrad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = discGrad;
    ctx.fill();

    // ── Grooves ──
    for (let i = 0; i < GROOVE_COUNT; i++) {
      const t = i / GROOVE_COUNT;
      const gr = labelR + (r - labelR - 8) * t;
      const wave = Math.sin(t * 15 + rotation * 2.5) * 0.5 + 0.5;
      const intensity = 0.02 + mid * 0.12 * wave;

      ctx.beginPath();
      ctx.arc(0, 0, gr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${intensity})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // ── Shine reflection (stays fixed) ──
    ctx.save();
    ctx.rotate(-rotation); // counter-rotate
    const shine = ctx.createLinearGradient(-r, -r, r * 0.5, r * 0.5);
    shine.addColorStop(0, 'rgba(255,255,255,0)');
    shine.addColorStop(0.4, 'rgba(255,255,255,0.02)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    shine.addColorStop(0.6, 'rgba(255,255,255,0.02)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();
    ctx.restore();

    // ── Label ──
    ctx.beginPath();
    ctx.arc(0, 0, labelR, 0, Math.PI * 2);
    if (coverImg) {
      ctx.save();
      ctx.clip();
      // Configurable zoom + pan for cover art inside the label
      const coverZoom = config.coverZoom ?? 1;
      const coverPanX = config.coverPanX ?? 0;
      const coverPanY = config.coverPanY ?? 0;
      const drawSize = labelR * 2 * coverZoom;
      const drawX = -drawSize / 2 + coverPanX;
      const drawY = -drawSize / 2 + coverPanY;
      ctx.drawImage(coverImg, drawX, drawY, drawSize, drawSize);
      ctx.restore();

      // Label border
      ctx.beginPath();
      ctx.arc(0, 0, labelR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const labelGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, labelR);
      labelGrad.addColorStop(0, rgba(config.accentColor, 0.3));
      labelGrad.addColorStop(0.6, rgba(config.accentColor, 0.15));
      labelGrad.addColorStop(1, rgba(config.accentColor, 0.08));
      ctx.fillStyle = labelGrad;
      ctx.fill();
      ctx.strokeStyle = rgba(config.accentColor, 0.2);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Default label text
      ctx.save();
      ctx.rotate(-rotation);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `bold ${labelR * 0.25}px 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VGM', 0, -labelR * 0.12);
      ctx.font = `${labelR * 0.16}px 'Outfit', sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText('VINYL', 0, labelR * 0.16);
      ctx.restore();
    }

    // ── Center spindle hole ──
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#06060c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  function drawParticles() {
    if (!config.showParticles) return;

    const { bass, mid, treble } = bands;
    const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

    particles.forEach(p => {
      // Physics
      p.x += p.vx + Math.sin(time * 0.8 + p.phase) * 0.3;
      p.y += p.vy - energy * 2;
      p.phase += 0.01;

      const sizeBoost = 1 + bass * 3;
      const opBoost = Math.min(1, p.opacity + energy * 0.3);
      const sz = p.size * sizeBoost;

      // Main dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = rgba(config.accentColor, opBoost);
      ctx.fill();

      // Glow halo for larger particles
      if (p.size > 1.5 && energy > 0.08) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz * 3, 0, Math.PI * 2);
        ctx.fillStyle = rgba(config.accentColor, opBoost * 0.12);
        ctx.fill();
      }

      // Respawn
      if (p.y < -20 || p.x < -20 || p.x > W + 20) {
        Object.assign(p, spawnParticle());
        p.y = H + 20;
      }
    });

    // Burst particles (short-lived, from beat)
    ctx.save();
    burstParticles = burstParticles.filter(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.15; // gravity
      p.vx *= 0.97;
      p.life -= p.decay;
      if (p.life <= 0) return false;

      const sz = p.size * p.life;
      ctx.globalAlpha = p.life * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = config.accentColor || '#a78bfa';
      ctx.fill();

      // Glow
      ctx.globalAlpha = p.life * 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * 3, 0, Math.PI * 2);
      ctx.fill();

      return true;
    });
    ctx.restore();
  }

  function drawGlassCard() {
    const style = config.cardStyle || 'fullwidth';
    const font = config.cardFont || "'Outfit', sans-serif";
    const fontColor = config.fontColor || '#ffffff';

    // Card animates in after the hook — uses its own cardProgress
    const introSlide = easeOutBack(cardProgress);   // spring bounce on arrival
    const cardAlpha = easeOutCubic(cardProgress);   // fade in separately (no overshoot on alpha)

    ctx.save();
    ctx.globalAlpha = cardAlpha;

    if      (style === 'fullwidth')  drawCardFullWidth(font, fontColor, introSlide);
    else if (style === 'glass')      drawCardGlass(font, fontColor, introSlide);
    else if (style === 'minimal')    drawCardMinimal(font, fontColor, introSlide);
    else if (style === 'neon')       drawCardNeon(font, fontColor, introSlide);
    else if (style === 'split')      drawCardSplit(font, fontColor, introSlide);
    else if (style === 'cinematic')  drawCardCinematic(font, fontColor, introSlide);
    else if (style === 'polaroid')   drawCardPolaroid(font, fontColor, introSlide);

    ctx.restore();
  }

  // ── Helper: draw gameplay video inside a given rect ──
  function drawGameplayInRect(gx, gy, gw, gh, gr) {
    if (!config.showGameplay || !gameplayVideo || gameplayVideo.readyState < 2) return false;

    ctx.save();
    roundRect(ctx, gx, gy, gw, gh, gr);
    ctx.clip();

    const gpZoom = config.gameplayZoom ?? 1;
    const gpPanX = config.gameplayPanX ?? 0;
    const gpPanY = config.gameplayPanY ?? 0;
    const drawW = gw * gpZoom;
    const drawH = gh * gpZoom;
    const drawX = gx - (drawW - gw) / 2 + gpPanX;
    const drawY = gy - (drawH - gh) / 2 + gpPanY;

    const vAspect = gameplayVideo.videoWidth / gameplayVideo.videoHeight;
    const wAspect = drawW / drawH;
    let sx = 0, sy = 0, sw = gameplayVideo.videoWidth, sh = gameplayVideo.videoHeight;
    if (vAspect > wAspect) { sw = sh * wAspect; sx = (gameplayVideo.videoWidth - sw) / 2; }
    else { sh = sw / wAspect; sy = (gameplayVideo.videoHeight - sh) / 2; }

    // Gameplay color filters
    const brightness  = config.gameplayBrightness  ?? 1;
    const contrast    = config.gameplayContrast     ?? 1;
    const saturation  = config.gameplaySaturation   ?? 1;
    const hue         = config.gameplayHue          ?? 0;
    if (brightness !== 1 || contrast !== 1 || saturation !== 1 || hue !== 0) {
      ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg)`;
    }
    ctx.drawImage(gameplayVideo, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
    ctx.filter = 'none';

    // Scanlines
    for (let y = 0; y < gh; y += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(gx, gy + y, gw, 1);
    }
    ctx.restore();

    // Glow border
    const glowSize = config.gameplayGlow !== false ? (config.gameplayGlowSize ?? 16) : 0;
    ctx.save();
    if (glowSize > 0) {
      ctx.shadowBlur = glowSize * 2;
      ctx.shadowColor = config.accentColor || '#a78bfa';
    }
    roundRect(ctx, gx, gy, gw, gh, gr);
    ctx.strokeStyle = glowSize > 0 ? (config.accentColor || '#a78bfa') + 'cc' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = glowSize > 0 ? 2 : 1.5;
    ctx.stroke();
    ctx.restore();
    return true;
  }

  // ═══════════════════════════════════════
  // STYLE 1: FULL-WIDTH BOTTOM
  // ═══════════════════════════════════════
  function drawCardFullWidth(font, fontColor, introSlide) {
    const cardH = config.cardHeight || CARD_H;
    const cardY = H - cardH;
    const slideY = cardY + (1 - introSlide) * cardH;

    // Border
    const borderSize = 6;
    const borderColor = config.cardBorderColor || config.accentColor;
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, slideY - borderSize, W, borderSize);

    // Background
    const cardBg = config.cardBgColor || config.accentColor;
    ctx.fillStyle = cardBg;
    ctx.fillRect(0, slideY, W, cardH);

    // Noise
    ctx.save();
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(Math.random() * W, slideY + Math.random() * cardH, 2, 2);
    }
    ctx.restore();

    // Gameplay
    const gpMargin = 30;
    const gpW = config.gameplayW || 340;
    const gpH = config.gameplayH || (cardH - gpMargin * 2);
    const gpX = config.gameplayX ?? gpMargin;
    const gpY = (config.gameplayY ?? gpMargin) + slideY;
    const hasGP = drawGameplayInRect(gpX, gpY, gpW, gpH, 14);

    // Text
    const textX = hasGP ? gpX + gpW + 30 : gpMargin;
    const textMaxW = W - textX - 40;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let textY = slideY + 35;

    ctx.fillStyle = fontColor;
    ctx.font = `900 48px ${font}`;
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 4;
    textY = wrapText(ctx, config.trackTitle, textX, textY, textMaxW, 56) + 12;
    ctx.shadowBlur = 0;

    ctx.fillStyle = rgba(fontColor, 0.9);
    ctx.font = `700 32px ${font}`;
    textY = wrapText(ctx, config.artist, textX, textY, textMaxW, 38) + 12;

    ctx.fillStyle = rgba(fontColor, 0.75);
    ctx.font = `700 28px ${font}`;
    textY = wrapText(ctx, config.gameName, textX, textY, textMaxW, 34) + 8;

    if (config.gameStudio) {
      ctx.fillStyle = rgba(fontColor, 0.6);
      ctx.font = `600 22px ${font}`;
      textY = wrapText(ctx, config.gameStudio, textX, textY, textMaxW, 28) + 8;
    }

    if (config.gameYear) {
      ctx.fillStyle = rgba(fontColor, 0.7);
      ctx.font = `800 36px ${font}`;
      ctx.textAlign = 'right';
      ctx.fillText(config.gameYear, W - 40, textY, textMaxW);
    }
  }

  // ═══════════════════════════════════════
  // STYLE 2: GLASSMORPHISM FLOATING
  // ═══════════════════════════════════════
  function drawCardGlass(font, fontColor, introSlide) {
    const cardW = 750;
    const cardH = config.cardHeight || 240;
    const cardX = CX - cardW / 2;
    const cardY = H * (config.cardPositionY ?? 0.68) + (1 - introSlide) * 80;
    const r = 22;

    // Glass background
    roundRect(ctx, cardX, cardY, cardW, cardH, r);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();

    // Accent top border
    ctx.save();
    roundRect(ctx, cardX, cardY, cardW, cardH, r);
    ctx.clip();
    const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
    borderGrad.addColorStop(0, 'transparent');
    borderGrad.addColorStop(0.3, rgba(config.accentColor, 0.4));
    borderGrad.addColorStop(0.7, rgba(config.cardBgColor || config.accentColor, 0.3));
    borderGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = borderGrad;
    ctx.fillRect(cardX, cardY, cardW, 2);
    ctx.restore();

    // Border stroke
    roundRect(ctx, cardX, cardY, cardW, cardH, r);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Gameplay on left
    const gpMargin = 20;
    const gpW = config.gameplayW || 180;
    const gpH = config.gameplayH || (cardH - gpMargin * 2);
    const gpX = cardX + gpMargin;
    const gpY = cardY + gpMargin;
    const hasGP = drawGameplayInRect(gpX, gpY, gpW, gpH, 12);

    // Text
    const textX = hasGP ? gpX + gpW + 20 : cardX + 30;
    const textMaxW = cardX + cardW - textX - 30;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let textY = cardY + 25;

    ctx.fillStyle = fontColor;
    ctx.font = `bold 34px ${font}`;
    textY = wrapText(ctx, config.trackTitle, textX, textY, textMaxW, 40) + 8;

    ctx.fillStyle = rgba(fontColor, 0.7);
    ctx.font = `500 24px ${font}`;
    textY = wrapText(ctx, config.artist, textX, textY, textMaxW, 30) + 10;

    // Divider
    const divGrad = ctx.createLinearGradient(textX, 0, textX + textMaxW, 0);
    divGrad.addColorStop(0, rgba(fontColor, 0.1));
    divGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = divGrad;
    ctx.fillRect(textX, textY, textMaxW, 1);
    textY += 12;

    ctx.fillStyle = rgba(fontColor, 0.4);
    ctx.font = `400 16px 'Space Mono', monospace`;
    textY = wrapText(ctx, (config.gameName || '').toUpperCase(), textX, textY, textMaxW, 22) + 6;

    if (config.gameStudio) {
      ctx.fillStyle = rgba(fontColor, 0.3);
      ctx.font = `400 14px 'Space Mono', monospace`;
      textY = wrapText(ctx, config.gameStudio, textX, textY, textMaxW, 20) + 4;
    }

    if (config.gameYear) {
      ctx.fillStyle = rgba(fontColor, 0.25);
      ctx.font = `400 14px 'Space Mono', monospace`;
      wrapText(ctx, config.gameYear, textX, textY, textMaxW, 20);
    }
  }

  // ═══════════════════════════════════════
  // STYLE 3: MINIMAL — text only, no panel
  // ═══════════════════════════════════════
  function drawCardMinimal(font, fontColor, introSlide) {
    const baseY = H * (config.cardPositionY ?? 0.82) + (1 - introSlide) * 60;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let textY = baseY;

    // Title
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = fontColor;
    ctx.font = `900 54px ${font}`;
    textY = wrapText(ctx, config.trackTitle, CX, textY, W - 80, 62);
    ctx.restore();
    textY += 8;

    // Artist
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = rgba(fontColor, 0.75);
    ctx.font = `600 30px ${font}`;
    textY = wrapText(ctx, config.artist, CX, textY, W - 80, 36);
    ctx.restore();
    textY += 16;

    // Accent separator line
    const lineW = 120;
    const lineGrad = ctx.createLinearGradient(CX - lineW, textY, CX + lineW, textY);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.5, rgba(config.accentColor, 0.8));
    lineGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(CX - lineW, textY, lineW * 2, 2);
    textY += 14;

    // Game name + year
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = rgba(config.accentColor, 0.9);
    ctx.font = `700 22px 'Space Mono', monospace`;
    const gameStr = [config.gameName, config.gameYear].filter(Boolean).join('  ·  ');
    wrapText(ctx, gameStr, CX, textY, W - 80, 28);
    ctx.restore();
  }

  // ═══════════════════════════════════════
  // STYLE 6: NEON — floating with glow border
  // ═══════════════════════════════════════
  function drawCardNeon(font, fontColor, introSlide) {
    const cardW = 720;
    const cardH = config.cardHeight || 210;
    const cardX = CX - cardW / 2;
    const cardY = H * (config.cardPositionY ?? 0.70) + (1 - introSlide) * 80;
    const r = 16;
    const accent = config.accentColor || '#a78bfa';

    // Dark background
    roundRect(ctx, cardX, cardY, cardW, cardH, r);
    ctx.fillStyle = 'rgba(4, 4, 14, 0.88)';
    ctx.fill();

    // Multi-layer neon glow border
    [
      { width: 12, alpha: 0.06 },
      { width:  6, alpha: 0.12 },
      { width:  2, alpha: 0.5  },
      { width:  1, alpha: 0.9  },
    ].forEach(({ width, alpha }) => {
      roundRect(ctx, cardX, cardY, cardW, cardH, r);
      ctx.strokeStyle = rgba(accent, alpha);
      ctx.lineWidth = width;
      ctx.stroke();
    });

    // Corner accent marks
    const mk = 18, mkT = 2;
    ctx.fillStyle = accent;
    [
      [cardX, cardY], [cardX + cardW - mk, cardY],
      [cardX, cardY + cardH - mkT], [cardX + cardW - mk, cardY + cardH - mkT],
    ].forEach(([x, y]) => ctx.fillRect(x, y, mk, mkT));
    [
      [cardX, cardY], [cardX + cardW - mkT, cardY],
      [cardX, cardY + cardH - mk], [cardX + cardW - mkT, cardY + cardH - mk],
    ].forEach(([x, y]) => ctx.fillRect(x, y, mkT, mk));

    // Gameplay
    const gpMargin = 20;
    const gpW = config.gameplayW || 170;
    const gpH = cardH - gpMargin * 2;
    const hasGP = drawGameplayInRect(cardX + gpMargin, cardY + gpMargin, gpW, gpH, 10);

    const textX = hasGP ? cardX + gpMargin + gpW + 20 : cardX + 28;
    const textMaxW = cardX + cardW - textX - 24;

    // Accent label
    ctx.fillStyle = rgba(accent, 0.7);
    ctx.font = `600 11px 'Space Mono', monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('NOW PLAYING', textX, cardY + 18, textMaxW);

    let textY = cardY + 38;

    // Title with glow
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillStyle = fontColor;
    ctx.font = `800 36px ${font}`;
    textY = wrapText(ctx, config.trackTitle, textX, textY, textMaxW, 42) + 8;
    ctx.restore();

    ctx.fillStyle = rgba(fontColor, 0.65);
    ctx.font = `500 22px ${font}`;
    textY = wrapText(ctx, config.artist, textX, textY, textMaxW, 28) + 10;

    // Neon divider
    const divGrad = ctx.createLinearGradient(textX, 0, textX + 200, 0);
    divGrad.addColorStop(0, rgba(accent, 0.6));
    divGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = divGrad;
    ctx.fillRect(textX, textY, 200, 1);
    textY += 10;

    ctx.fillStyle = rgba(accent, 0.55);
    ctx.font = `500 14px 'Space Mono', monospace`;
    textY = wrapText(ctx, (config.gameName || '').toUpperCase(), textX, textY, textMaxW, 20) + 6;

    if (config.gameStudio) {
      ctx.fillStyle = rgba(fontColor, 0.3);
      ctx.font = `400 12px 'Space Mono', monospace`;
      textY = wrapText(ctx, config.gameStudio, textX, textY, textMaxW, 18);
    }

    if (config.gameYear) {
      ctx.fillStyle = rgba(accent, 0.4);
      ctx.font = `700 28px ${font}`;
      ctx.textAlign = 'right';
      ctx.fillText(config.gameYear, cardX + cardW - 24, cardY + cardH - 44, 120);
    }
  }

  // ═══════════════════════════════════════
  // STYLE 5: SPLIT — left text / right album art or gameplay
  // ═══════════════════════════════════════
  function drawCardSplit(font, fontColor, introSlide) {
    const cardW  = 860;
    const cardH  = config.cardHeight || 230;
    const cardX  = CX - cardW / 2 + (1 - introSlide) * -80;
    const cardY  = H * (config.cardPositionY ?? 0.70);
    const r      = 18;
    const accent = config.accentColor || '#a78bfa';

    // Card background
    roundRect(ctx, cardX, cardY, cardW, cardH, r);
    ctx.fillStyle = 'rgba(8,8,20,0.90)';
    ctx.fill();

    // Accent border
    roundRect(ctx, cardX, cardY, cardW, cardH, r);
    ctx.strokeStyle = rgba(accent, 0.35);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Vertical divider
    const divX = cardX + cardW * 0.62;
    ctx.fillStyle = rgba(accent, 0.18);
    ctx.fillRect(divX, cardY + 20, 1.5, cardH - 40);

    // ── Left: text content ──
    const textX   = cardX + 28;
    const textMaxW = divX - textX - 20;
    let   textY   = cardY + 22;

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';

    // Label pill
    ctx.save();
    const pillW = 90; const pillH = 18;
    roundRect(ctx, textX, textY, pillW, pillH, 5);
    ctx.fillStyle = rgba(accent, 0.22);
    ctx.fill();
    ctx.fillStyle = rgba(accent, 0.9);
    ctx.font      = `600 10px 'Space Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('NOW PLAYING', textX + pillW / 2, textY + 4);
    ctx.restore();
    textY += 28;

    // Track title
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = fontColor;
    ctx.font        = `800 34px ${font}`;
    ctx.textAlign   = 'left';
    textY = wrapText(ctx, config.trackTitle, textX, textY, textMaxW, 40) + 6;
    ctx.restore();

    // Artist
    ctx.fillStyle = rgba(fontColor, 0.70);
    ctx.font      = `500 20px ${font}`;
    ctx.textAlign = 'left';
    textY = wrapText(ctx, config.artist, textX, textY, textMaxW, 26) + 10;

    // Game info row
    ctx.fillStyle = rgba(accent, 0.75);
    ctx.font      = `600 13px 'Space Mono', monospace`;
    const gameStr = [config.gameName, config.gameYear].filter(Boolean).join('  ·  ');
    wrapText(ctx, gameStr.toUpperCase(), textX, textY, textMaxW, 18);

    // ── Right: gameplay thumbnail or accent block ──
    const thumbX = divX + 18;
    const thumbW = cardX + cardW - thumbX - 18;
    const thumbH = cardH - 40;
    const thumbY = cardY + 20;
    const thumbR = 12;

    const didDraw = drawGameplayInRect(thumbX, thumbY, thumbW, thumbH, thumbR);
    if (!didDraw) {
      // Fallback: accent gradient block
      roundRect(ctx, thumbX, thumbY, thumbW, thumbH, thumbR);
      const grad = ctx.createLinearGradient(thumbX, thumbY, thumbX + thumbW, thumbY + thumbH);
      grad.addColorStop(0, rgba(accent, 0.30));
      grad.addColorStop(1, rgba(accent, 0.05));
      ctx.fillStyle = grad;
      ctx.fill();

      // Centered game name short
      ctx.fillStyle = rgba(fontColor, 0.35);
      ctx.font      = `700 16px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.gameName || '', thumbX + thumbW / 2, thumbY + thumbH / 2);
    }
  }

  // ═══════════════════════════════════════
  // STYLE 6: CINEMATIC — full-width banner with letterbox bars
  // ═══════════════════════════════════════
  function drawCardCinematic(font, fontColor, introSlide) {
    const barH   = config.cardHeight || 200;
    const barY   = H * (config.cardPositionY ?? 0.74) + (1 - introSlide) * 60;
    const accent = config.accentColor || '#a78bfa';

    // Letterbox bars
    const topBarH = 4;
    ctx.fillStyle = rgba(accent, 0.6);
    ctx.fillRect(0, barY - topBarH, W, topBarH);
    ctx.fillRect(0, barY + barH, W, topBarH);

    // Dark cinematic strip
    const grad = ctx.createLinearGradient(0, barY, 0, barY + barH);
    grad.addColorStop(0,   'rgba(0,0,0,0.92)');
    grad.addColorStop(0.5, 'rgba(4,4,16,0.96)');
    grad.addColorStop(1,   'rgba(0,0,0,0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY, W, barH);

    // Subtle left-side accent glow
    const glowGrad = ctx.createLinearGradient(0, barY, 200, barY);
    glowGrad.addColorStop(0, rgba(accent, 0.25));
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, barY, 200, barH);

    const padX = 60;
    const midY = barY + barH / 2;

    // Director-style uppercase game name top-left
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = rgba(accent, 0.55);
    ctx.font         = `400 12px 'Space Mono', monospace`;
    // Simulate letter-spacing by drawing each char with offset
    const gameName = (config.gameName || '').toUpperCase();
    let cx = padX;
    for (const ch of gameName) {
      ctx.fillText(ch, cx, barY + 18);
      cx += ctx.measureText(ch).width + 3;
    }

    // Large title centered vertically
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = fontColor;
    ctx.font        = `900 58px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(config.trackTitle || '', padX, midY - 4, W - padX * 2);
    ctx.restore();

    // Artist bottom-left
    ctx.fillStyle    = rgba(fontColor, 0.55);
    ctx.font         = `400 20px ${font}`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(config.artist || '', padX, barY + barH - 18, W - padX * 2);

    // Year badge top-right
    if (config.gameYear) {
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = rgba(accent, 0.40);
      ctx.font         = `700 32px ${font}`;
      ctx.fillText(config.gameYear, W - padX, barY + 18);
    }
  }

  // ═══════════════════════════════════════
  // STYLE 7: POLAROID — photo card with white border
  // ═══════════════════════════════════════
  function drawCardPolaroid(font, fontColor, introSlide) {
    const cardW    = 480;
    const padding  = 18;
    const photoSize = cardW - padding * 2;
    const textAreaH = 110;
    const cardH    = padding + photoSize + 10 + textAreaH + padding;
    const cardX    = CX - cardW / 2;
    const cardY    = H * (config.cardPositionY ?? 0.52) + (1 - introSlide) * 80;
    const tilt     = (2 * Math.PI) / 180;

    ctx.save();
    ctx.translate(CX, cardY + cardH / 2);
    ctx.rotate(tilt);
    ctx.translate(-CX, -(cardY + cardH / 2));

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur   = 28;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#f0ebe3';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.restore();

    // Paper background
    ctx.fillStyle = '#f0ebe3';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Photo area
    const photoX = cardX + padding;
    const photoY = cardY + padding;

    if (coverImg || gameImg) {
      const img = coverImg || gameImg;
      ctx.save();
      ctx.beginPath();
      ctx.rect(photoX, photoY, photoSize, photoSize);
      ctx.clip();
      ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
      ctx.fillStyle = 'rgba(160,100,40,0.07)';
      ctx.fillRect(photoX, photoY, photoSize, photoSize);
      ctx.restore();
    } else {
      const accent = config.accentColor || '#a78bfa';
      const grad = ctx.createLinearGradient(photoX, photoY, photoX + photoSize, photoY + photoSize);
      grad.addColorStop(0, rgba(accent, 0.65));
      grad.addColorStop(1, rgba(config.secondaryColor || accent, 0.35));
      ctx.fillStyle = grad;
      ctx.fillRect(photoX, photoY, photoSize, photoSize);
    }

    // Photo border
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(photoX, photoY, photoSize, photoSize);

    // Text area (dark ink on white)
    let textY = photoY + photoSize + 12;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#1a1510';
    ctx.font = `800 26px ${font}`;
    textY = wrapText(ctx, config.trackTitle, cardX + padding, textY, cardW - padding * 2, 32) + 3;

    ctx.fillStyle = '#4a4035';
    ctx.font = `500 17px ${font}`;
    textY = wrapText(ctx, config.artist, cardX + padding, textY, cardW - padding * 2, 22) + 4;

    ctx.fillStyle = '#7a6a55';
    ctx.font = `500 13px 'Space Mono', monospace`;
    wrapText(ctx, (config.gameName || '').toUpperCase(), cardX + padding, textY, cardW - padding * 2, 17);

    ctx.restore();
  }

  // ══════════════════════════════════════════
  // CIRCULAR EQUALIZER
  // ══════════════════════════════════════════

  // ── Peak dots state for bar EQ (persists between frames) ──
  const NUM_BARS_EQ = 120;
  const peakDots = Array.from({ length: NUM_BARS_EQ }, () => ({ height: 0, vel: 0 }));

  function drawCircularEQ() {
    if (!config.showEqualizer) return;
    const style = config.equalizerStyle || 'bars';
    if (style === 'oscilloscope') drawOscilloscopeRing();
    else drawCircularEQBars();
  }

  // ── Option C: circular bars with peak dots ──
  function drawCircularEQBars() {
    const vinylR = config.vinylRadius || VINYL_RADIUS;
    const innerR = vinylR + 8;
    const maxBarH = 110;
    const barWidth = 4;

    ctx.save();
    ctx.translate(config.vinylX ?? CX, config.vinylY ?? CY_VINYL);
    ctx.rotate(rotation);

    for (let i = 0; i < NUM_BARS_EQ; i++) {
      const angle = (i / NUM_BARS_EQ) * Math.PI * 2 - Math.PI / 2;

      // Mirror left/right for symmetry
      const halfBars = NUM_BARS_EQ / 2;
      const mirrorI = i < halfBars ? i : NUM_BARS_EQ - 1 - i;
      const freqIndex = Math.floor((mirrorI / halfBars) * freqData.length * 0.6);
      const rawValue = freqData[freqIndex] || 0;

      // More aggressive power curve for stronger contrast
      const value = Math.pow(rawValue, 0.6);
      const barH = value * maxBarH;

      // Update peak dot with gravity
      const peak = peakDots[i];
      if (barH > peak.height) {
        peak.height = barH;
        peak.vel = 0;
      } else {
        peak.vel += 0.18;
        peak.height = Math.max(0, peak.height - peak.vel);
      }

      if (barH < 2 && peak.height < 2) continue;

      const x1 = Math.cos(angle) * innerR;
      const y1 = Math.sin(angle) * innerR;
      const x2 = Math.cos(angle) * (innerR + barH);
      const y2 = Math.sin(angle) * (innerR + barH);

      // Glow layer
      if (barH >= 2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = rgba(config.accentColor, 0.08 + value * 0.18);
        ctx.lineWidth = barWidth + 8;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main bar
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = rgba(config.accentColor, 0.7 + value * 0.3);
        ctx.lineWidth = barWidth;
        ctx.stroke();
      }

      // Peak dot
      if (peak.height > 3) {
        const px = Math.cos(angle) * (innerR + peak.height);
        const py = Math.sin(angle) * (innerR + peak.height);
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = rgba(config.accentColor, 0.95);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // ── Option A: oscilloscope waveform ring ──
  function drawOscilloscopeRing() {
    const vinylR = config.vinylRadius || VINYL_RADIUS;
    const cx = config.vinylX ?? CX;
    const cy = config.vinylY ?? CY_VINYL;
    const innerR = vinylR + 14;
    const maxOffset = 90;
    const numPoints = timeDomainData.length;
    const energy = bands.bass * 0.7 + bands.mid * 0.2 + bands.treble * 0.1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    // Outer glow pass
    ctx.beginPath();
    for (let i = 0; i <= numPoints; i++) {
      const idx = i % numPoints;
      const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
      const sample = timeDomainData[idx];
      const offset = (sample - 0.5) * 2 * maxOffset * (1 + energy * 0.6);
      const r = innerR + offset;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba(config.accentColor, 0.15 + energy * 0.1);
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Main line pass
    ctx.beginPath();
    for (let i = 0; i <= numPoints; i++) {
      const idx = i % numPoints;
      const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
      const sample = timeDomainData[idx];
      const offset = (sample - 0.5) * 2 * maxOffset * (1 + energy * 0.6);
      const r = innerR + offset;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba(config.accentColor, 0.85 + energy * 0.15);
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
  }

  // ══════════════════════════════════════════
  // GAMEPLAY VIDEO WINDOW
  // ══════════════════════════════════════════

  // Gameplay video is now drawn inside drawGlassCard
  function drawGameplayWindow() {}

  // ══════════════════════════════════════════
  // BEAT FLASH
  // ══════════════════════════════════════════

  function drawBeatFlash() {
    if (beatFlash <= 0.01) return;
    const cx = config.vinylX ?? CX;
    const cy = config.vinylY ?? CY_VINYL;

    // Inner bright burst
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 800);
    glow.addColorStop(0,   rgba(config.accentColor, beatFlash * 0.75));
    glow.addColorStop(0.15, rgba(config.accentColor, beatFlash * 0.5));
    glow.addColorStop(0.5, rgba(config.accentColor, beatFlash * 0.15));
    glow.addColorStop(1,   'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Edge vignette flash (full screen rim)
    const edge = ctx.createRadialGradient(cx, cy, 400, cx, cy, W);
    edge.addColorStop(0,   'transparent');
    edge.addColorStop(1,   rgba(config.accentColor, beatFlash * 0.3));
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);

    beatFlash = Math.max(0, beatFlash - dt * 3.5); // ~285ms decay
  }

  // ══════════════════════════════════════════
  // RETRO / SCANLINE OVERLAY
  // ══════════════════════════════════════════

  function drawRetroOverlay() {
    if (!config.showScanlines) return;

    // ── Scanlines (every 3px, very subtle) ──
    ctx.save();
    ctx.globalAlpha = 0.04;
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── Film grain (noise texture) ──
    ctx.save();
    ctx.globalAlpha = 0.025;
    const grainSize = 3;
    for (let i = 0; i < 600; i++) {
      const gx = Math.random() * W;
      const gy = Math.random() * H;
      const brightness = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
      ctx.fillRect(gx, gy, grainSize, grainSize);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── Chromatic aberration on edges (subtle color shift) ──
    // We fake this with colored semi-transparent bars at the very edges
    const aberrationStrength = 0.03;
    ctx.save();
    ctx.globalAlpha = aberrationStrength;
    // Red shift left edge
    ctx.fillStyle = 'rgba(255,50,50,1)';
    ctx.fillRect(0, 0, 3, H);
    // Cyan shift right edge
    ctx.fillStyle = 'rgba(50,255,255,1)';
    ctx.fillRect(W - 3, 0, 3, H);
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── CRT vignette (darker, more rounded than the cinematic one) ──
    const crtVig = ctx.createRadialGradient(CX, H / 2, H * 0.25, CX, H / 2, H * 0.65);
    crtVig.addColorStop(0, 'rgba(0,0,0,0)');
    crtVig.addColorStop(0.8, 'rgba(0,0,0,0.08)');
    crtVig.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = crtVig;
    ctx.fillRect(0, 0, W, H);
  }

  // ══════════════════════════════════════════
  // TIME COUNTER / PROGRESS BAR
  // ══════════════════════════════════════════

  function drawTimeCounter() {
    if (!isPlaying || audioDuration <= 0) return;

    const font = config.cardFont || "'Outfit', sans-serif";

    // Format time as M:SS
    const formatTime = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const progress = Math.min(audioCurrentTime / audioDuration, 1);

    // Progress bar at bottom of vinyl area
    const barY = H - (config.cardHeight || CARD_H) - 50;
    const barX = 80;
    const barW = W - 160;
    const barH = 4;

    // Background track
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 2);
    ctx.fill();

    // Progress fill
    ctx.fillStyle = rgba(config.accentColor, 0.6);
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, 2);
    ctx.fill();

    // Dot at current position
    ctx.beginPath();
    ctx.arc(barX + barW * progress, barY + 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = config.accentColor;
    ctx.fill();

    // Time text
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `400 16px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(formatTime(audioCurrentTime), barX, barY + 12);

    ctx.textAlign = 'right';
    ctx.fillText(formatTime(audioDuration), barX + barW, barY + 12);
  }

  // ══════════════════════════════════════════
  // TIMED EFFECTS
  // ══════════════════════════════════════════

  function drawTimedEffects() {
    const effects = config.effects;
    if (!effects || effects.length === 0 || !isPlaying) return;

    const currentTime = audioCurrentTime;

    effects.forEach(fx => {
      const elapsed = currentTime - fx.time;
      if (elapsed < 0 || elapsed > fx.duration) return;

      const progress = elapsed / fx.duration; // 0 → 1

      switch (fx.type) {
        case 'flash':
          drawEffectFlash(progress);
          break;
        case 'glitch':
          drawEffectGlitch(progress);
          break;
        case 'shake':
          drawEffectShake(progress);
          break;
        case 'invert':
          drawEffectInvert(progress);
          break;
        case 'zoom':
          drawEffectZoom(progress);
          break;
      }
    });
  }

  function drawEffectFlash(progress) {
    // Quick white flash that fades out
    const alpha = (1 - progress) * 0.7;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawEffectGlitch(progress) {
    const intensity = (1 - progress);
    ctx.save();

    // RGB split
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.2 * intensity;
    const shift = 15 * intensity;
    ctx.drawImage(canvas, shift, 0, W, H, 0, 0, W, H);
    ctx.drawImage(canvas, -shift, 0, W, H, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Random horizontal slices
    const numSlices = Math.floor(4 + Math.random() * 6 * intensity);
    for (let i = 0; i < numSlices; i++) {
      if (Math.random() > 0.5) continue;
      const sliceY = Math.random() * H;
      const sliceH = 5 + Math.random() * 50 * intensity;
      const offset = (Math.random() - 0.5) * 80 * intensity;
      ctx.drawImage(canvas, 0, sliceY, W, sliceH, offset, sliceY, W, sliceH);
    }

    // Noise burst
    ctx.globalAlpha = 0.08 * intensity;
    for (let i = 0; i < 60; i++) {
      const brightness = Math.random() * 255;
      ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 10 + 2, 2);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawEffectShake(progress) {
    // We can't really "shake" after drawing, but we can simulate it
    // by drawing a displaced copy. This is applied next frame via a flag.
    const intensity = (1 - progress) * 20;
    const shakeX = (Math.random() - 0.5) * intensity;
    const shakeY = (Math.random() - 0.5) * intensity;

    ctx.save();
    ctx.drawImage(canvas, shakeX, shakeY);
    // Fill the edges
    ctx.fillStyle = '#06060c';
    if (shakeX > 0) ctx.fillRect(0, 0, shakeX, H);
    else ctx.fillRect(W + shakeX, 0, -shakeX, H);
    if (shakeY > 0) ctx.fillRect(0, 0, W, shakeY);
    else ctx.fillRect(0, H + shakeY, W, -shakeY);
    ctx.restore();
  }

  function drawEffectInvert(progress) {
    // Color inversion with fade
    const alpha = 0.8 * (progress < 0.5 ? progress * 2 : (1 - progress) * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function drawEffectZoom(progress) {
    // Quick zoom pulse — zooms in then back out
    const t = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    const scale = 1 + t * 0.08;
    const offsetX = (W - W * scale) / 2;
    const offsetY = (H - H * scale) / 2;

    ctx.save();
    ctx.drawImage(canvas, offsetX, offsetY, W * scale, H * scale, 0, 0, W, H);
    ctx.restore();
  }

  function drawBeatSyncEffects() {
    if (beatSyncQueue.length === 0) return;
    beatSyncQueue = beatSyncQueue.filter(fx => {
      const elapsed = time - fx.startTime;
      if (elapsed < 0 || elapsed > fx.duration) return false;
      const progress = elapsed / fx.duration;
      switch (fx.type) {
        case 'flash':  drawEffectFlash(progress);  break;
        case 'glitch': drawEffectGlitch(progress); break;
        case 'zoom':   drawEffectZoom(progress);   break;
        case 'shake':  drawEffectShake(progress);  break;
      }
      return true;
    });
  }

  // ══════════════════════════════════════════
  // HOOK INTRO SYSTEM
  // ══════════════════════════════════════════

  let hookStartTime = null;
  function resetHookIntro() {
    hookStartTime = null;
    startTime = null;
    cardProgress = 0;
    hookTransitionTime = null;
    introGlitchFired = false;
  }

  function drawHookIntro() {
    if (!config.showHookIntro) return;
    if (!isPlaying) { hookStartTime = null; return; }

    if (hookStartTime === null) hookStartTime = time;
    const elapsed = time - hookStartTime;

    const hookDuration = config.hookDuration || 5;
    const font = config.cardFont || "'Outfit', sans-serif";
    const fontColor = config.fontColor || '#ffffff';

    if (elapsed > hookDuration) return;

    const activePhases = ['hooktext', 'gamename', 'nostalgia'].filter(p => {
      if (p === 'hooktext') return config.showHookText !== false;
      if (p === 'gamename') return config.showHookGameName !== false;
      if (p === 'nostalgia') return config.showHookNostalgia !== false;
      return false;
    });

    if (activePhases.length === 0) return;

    // Dark overlay — opacity controlled by config
    const maxAlpha = config.hookOverlayOpacity ?? 0.85;
    const hookAlpha = elapsed < hookDuration * 0.85
      ? maxAlpha
      : maxAlpha * (1 - (elapsed - hookDuration * 0.85) / (hookDuration * 0.15));
    ctx.save();
    ctx.fillStyle = `rgba(6, 6, 12, ${hookAlpha})`;
    ctx.fillRect(0, 0, W, H);

    // Divide time equally among active phases
    const phaseTime = hookDuration / activePhases.length;
    const currentPhaseIdx = Math.min(Math.floor(elapsed / phaseTime), activePhases.length - 1);
    const currentPhase = activePhases[currentPhaseIdx];
    const phaseElapsed = elapsed - currentPhaseIdx * phaseTime;
    const phaseProgress = Math.min(phaseElapsed / phaseTime, 1);

    if (currentPhase === 'hooktext') drawHookPhaseText(font, fontColor, phaseProgress);
    else if (currentPhase === 'gamename') drawHookPhaseGameName(font, fontColor, phaseProgress);
    else if (currentPhase === 'nostalgia') drawHookPhaseNostalgia(font, fontColor, phaseProgress);

    ctx.restore();
  }

  // Text overlay AFTER the hook — subtitle style, one line at a time
  function drawHookTextOverlay() {
    if (!config.showHookIntro) return;
    if (!config.afterHookEnabled) return;
    if (!isPlaying || hookStartTime === null) return;

    const hookDuration = config.hookDuration || 5;
    const overlayDuration = config.afterHookDuration ?? 4;
    const elapsed = time - hookStartTime;
    const overlayElapsed = elapsed - hookDuration;

    if (overlayElapsed < 0 || overlayElapsed > overlayDuration) return;

    const lines = (config.afterHookLines || []).filter(l => l && l.trim());
    if (lines.length === 0) return;

    const font = config.afterHookFont || config.cardFont || "'Outfit', sans-serif";
    const fontColor = config.fontColor || '#ffffff';
    const accent = config.accentColor || '#a78bfa';
    const fontSize = config.afterHookFontSize || 44;
    const padX = 52;
    const padY = 22;
    const radius = 14;
    // Fixed Y near bottom, above info card
    const baseY = H * (config.afterHookPositionY ?? 0.78);

    // Which line is active
    const sliceSize = 1 / lines.length;
    const p = overlayElapsed / overlayDuration;
    const lineIdx = Math.min(Math.floor(p / sliceSize), lines.length - 1);
    const line = lines[lineIdx];
    const lp = Math.max(0, Math.min(1, (p - lineIdx * sliceSize) / sliceSize));

    // Alpha: quick fade in, hold, quick fade out
    let alpha;
    if      (lp < 0.08) alpha = lp / 0.08;
    else if (lp > 0.88 && lineIdx < lines.length - 1) alpha = (1 - lp) / 0.12;
    else if (p > 0.92)  alpha = (1 - p) / 0.08;
    else                alpha = 1;

    // Words appear one by one (no typewriter flicker)
    const words = line.split(' ');
    const wordP = Math.max(0, Math.min(1, (lp - 0.05) / 0.45));
    const wordsToShow = Math.ceil(wordP * words.length);
    const visible = words.slice(0, wordsToShow).join(' ');

    if (!visible) return;

    ctx.save();
    ctx.font = `600 ${fontSize}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(visible).width;
    const badgeW = textW + padX * 2;
    const badgeH = fontSize + padY * 2;
    const badgeX = CX - badgeW / 2;
    const badgeY = baseY - badgeH / 2;

    // Pill background
    ctx.globalAlpha = alpha * 0.88;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, radius);
    ctx.fill();

    // Accent bottom border line
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, radius);
    ctx.stroke();

    // Text
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fontColor;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.fillText(visible, CX, baseY);
    ctx.shadowBlur = 0;

    // Progress dots (which line we're on)
    if (lines.length > 1) {
      const dotR = 5;
      const dotGap = 18;
      const dotsW = lines.length * dotGap - (dotGap - dotR * 2);
      let dotX = CX - dotsW / 2 + dotR;
      const dotY = badgeY + badgeH + 16;
      lines.forEach((_, i) => {
        ctx.globalAlpha = alpha * (i === lineIdx ? 1 : 0.3);
        ctx.fillStyle = i === lineIdx ? accent : fontColor;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
        dotX += dotGap;
      });
    }

    ctx.restore();
  }

  function drawHookPhaseText(font, fontColor, progress) {
    const hookText = config.hookText || "You forgot this masterpiece...";
    const posY = H * (config.hookPositionY ?? 0.45);

    const charsToShow = Math.floor(progress * hookText.length * 1.2);
    const visibleText = hookText.substring(0, Math.min(charsToShow, hookText.length));
    const flickering = charsToShow <= hookText.length && Math.random() > 0.7;

    // RGB split
    if (progress < 0.8) {
      ctx.globalAlpha = 0.15;
      ctx.font = `600 42px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff0040';
      ctx.fillText(visibleText, CX + 2, posY);
      ctx.fillStyle = '#00aaff';
      ctx.fillText(visibleText, CX - 2, posY);
    }

    ctx.globalAlpha = flickering ? 0.5 : 1;
    ctx.fillStyle = fontColor;
    ctx.font = `600 42px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(visibleText, CX, posY);

    // Cursor
    if (charsToShow <= hookText.length && Math.floor(time * 4) % 2 === 0) {
      const cursorX = CX + ctx.measureText(visibleText).width / 2 + 4;
      ctx.fillRect(cursorX, posY - 16, 3, 32);
    }

    // Fade out at end
    if (progress > 0.85) {
      ctx.fillStyle = `rgba(6, 6, 12, ${(progress - 0.85) / 0.15 * 0.9})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }

  function drawHookPhaseGameName(font, fontColor, progress) {
    const gameName = config.gameName || 'GAME';
    const posY = H * (config.hookPositionY ?? 0.45);
    const glitchChars = '█▓░▒╔╗╚╝║═!@#$%&*?<>';
    const settledRatio = Math.pow(progress, 0.6);

    let displayText = '';
    for (let i = 0; i < gameName.length; i++) {
      if ((i / gameName.length) < settledRatio) displayText += gameName[i];
      else displayText += glitchChars[Math.floor(Math.random() * glitchChars.length)];
    }

    const shakeX = progress < 0.5 ? (Math.random() - 0.5) * 10 * (1 - progress * 2) : 0;
    const shakeY = progress < 0.5 ? (Math.random() - 0.5) * 6 * (1 - progress * 2) : 0;
    const scale = 1 + (1 - progress) * 0.3;

    ctx.save();
    ctx.translate(CX + shakeX, posY + shakeY);
    ctx.scale(scale, scale);
    ctx.shadowColor = config.accentColor;
    ctx.shadowBlur = 30 * (1 - progress);
    ctx.fillStyle = fontColor;
    ctx.font = `900 72px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText.toUpperCase(), 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Glitch lines
    if (progress < 0.4) {
      const intensity = (1 - progress / 0.4);
      for (let i = 0; i < 3; i++) {
        if (Math.random() > 0.5) continue;
        const sy = Math.random() * H;
        const sh = 3 + Math.random() * 20;
        ctx.drawImage(canvas, 0, sy, W, sh, (Math.random() - 0.5) * 40 * intensity, sy, W, sh);
      }
    }

    if (progress > 0.85) {
      ctx.fillStyle = `rgba(6, 6, 12, ${(progress - 0.85) / 0.15 * 0.9})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawHookPhaseNostalgia(font, fontColor, progress) {
    const currentYear = new Date().getFullYear();
    const gameYear = parseInt(config.gameYear) || currentYear;
    const yearsAgo = currentYear - gameYear;
    if (yearsAgo <= 0) return;
    const posY = H * (config.hookPositionY ?? 0.45);

    const displayNum = Math.min(Math.floor(progress * 3 * yearsAgo), yearsAgo);
    const fadeIn = Math.min(progress * 3, 1);
    ctx.globalAlpha = fadeIn;

    ctx.fillStyle = rgba(fontColor, 0.5);
    ctx.font = `500 28px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Released', CX, posY - H * 0.05);

    ctx.fillStyle = config.accentColor;
    ctx.font = `900 120px ${font}`;
    ctx.fillText(displayNum.toString(), CX, posY + H * 0.03);

    ctx.fillStyle = rgba(fontColor, 0.5);
    ctx.font = `500 28px ${font}`;
    ctx.fillText('years ago', CX, posY + H * 0.10);
  }

  function drawHookTransition() {
    if (!config.showHookIntro || hookTransitionTime === null) return;
    const elapsed = time - hookTransitionTime;
    if (elapsed > HOOK_TRANSITION_DUR) return;
    const p = elapsed / HOOK_TRANSITION_DUR; // 0→1

    const accent = config.accentColor || '#a78bfa';

    // 1. White flash that fades quickly
    const flashA = Math.max(0, 1 - p * 3.5);
    if (flashA > 0) {
      ctx.save();
      ctx.globalAlpha = flashA * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 2. Radial ripple expanding from center
    const rippleR = p * H * 0.8;
    const rippleA = Math.max(0, (1 - p) * 0.6);
    if (rippleA > 0) {
      ctx.save();
      ctx.globalAlpha = rippleA;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3 * (1 - p);
      ctx.shadowBlur = 20;
      ctx.shadowColor = accent;
      ctx.beginPath();
      ctx.arc(CX, H * 0.38, rippleR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Second ripple with slight delay
    const p2 = Math.max(0, p - 0.15);
    const ripple2R = p2 * H * 0.7;
    const ripple2A = Math.max(0, (1 - p2) * 0.35);
    if (ripple2A > 0 && p2 > 0) {
      ctx.save();
      ctx.globalAlpha = ripple2A;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2 * (1 - p2);
      ctx.shadowBlur = 12;
      ctx.shadowColor = accent;
      ctx.beginPath();
      ctx.arc(CX, H * 0.38, ripple2R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawWatermark() {
    if (!watermarkImg || !config.watermarkEnabled) return;
    const opacity  = config.watermarkOpacity ?? 0.8;
    const size     = config.watermarkSize    ?? 120;
    const posX     = config.watermarkX       ?? 0.85; // 0-1 of W
    const posY     = config.watermarkY       ?? 0.06; // 0-1 of H

    const ratio = watermarkImg.naturalWidth / watermarkImg.naturalHeight;
    const imgW = size;
    const imgH = size / ratio;
    const x = posX * W - imgW / 2;
    const y = posY * H - imgH / 2;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(watermarkImg, x, y, imgW, imgH);
    ctx.restore();
  }

  function drawFade() {
    if (fadeMode === 'none') return;

    const elapsed = time - fadeStart;
    const t = Math.min(elapsed / FADE_DURATION, 1);

    if (fadeMode === 'in') {
      fadeAlpha = 1 - easeOutCubic(t);
    } else if (fadeMode === 'out') {
      fadeAlpha = easeInCubic(t);
    }

    if (t >= 1) fadeMode = 'none';

    if (fadeAlpha > 0.001) {
      ctx.fillStyle = `rgba(6, 6, 12, ${fadeAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ══════════════════════════════════════════
  // COLOR FILTER + VIGNETTE
  // ══════════════════════════════════════════

  const FILTER_COLORS = {
    warm:    [255, 160,  50],
    cold:    [ 80, 140, 255],
    vintage: [200, 130,  60],
    neon:    [180,  40, 255],
    pastel:  [255, 255, 255],
  };

  function drawColorFilter() {
    const filter = config.colorFilter;
    if (!filter || filter === 'none') return;
    const intensity = config.colorFilterIntensity ?? 0.15;
    if (intensity <= 0) return;
    const [r, g, b] = FILTER_COLORS[filter] || FILTER_COLORS.warm;
    ctx.save();
    ctx.globalCompositeOperation = filter === 'pastel' ? 'screen' : 'multiply';
    ctx.globalAlpha = intensity;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawVignette() {
    const intensity = config.vignetteIntensity ?? 0;
    if (intensity <= 0) return;
    const grad = ctx.createRadialGradient(CX, H * 0.5, H * 0.25, CX, H * 0.5, H * 0.85);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(0,0,0,${intensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ══════════════════════════════════════════
  // MAIN RENDER LOOP
  // ══════════════════════════════════════════

  let animFrame = null;
  let exportInterval = null;
  let lastTimestamp = 0;
  let dt = 0; // module-level so draw functions (drawBeatFlash etc.) can access it
  let captureStreamTrack = null; // for manual frame signaling

  function render() {
    // Always reschedule first so a draw error never kills the loop
    if (!exportInterval) {
      animFrame = requestAnimationFrame(render);
    }

    const now = performance.now();
    dt = Math.min((now - lastTimestamp) / 1000, 0.05);
    lastTimestamp = now;
    time += dt;

    // Intro progress (vinyl zoom-in)
    if (startTime === null) startTime = time;

    // If hook intro is active + vinylIntro enabled, delay vinyl zoom until after hook
    const vinylIntroDelay = (config.showHookIntro && config.vinylIntro)
      ? (config.hookDuration || 5)
      : 0;
    const vinylIntroStart = startTime + vinylIntroDelay;
    const introDur = config.vinylIntroDuration || INTRO_DURATION;
    introProgress = Math.min(Math.max(0, (time - vinylIntroStart) / introDur), 1);

    // Fire glitch + flash at the moment the vinyl intro begins
    if (config.vinylIntro && !introGlitchFired && time >= vinylIntroStart) {
      const introDur = config.vinylIntroDuration || INTRO_DURATION;
      beatSyncQueue.push({ type: 'glitch', startTime: time, duration: introDur });
      beatSyncQueue.push({ type: 'flash',  startTime: time, duration: 0.3 });
      introGlitchFired = true;
    }

    // Card progress — starts after hook ends (or immediately if hook is off)
    const hookDelay = config.showHookIntro ? (config.hookDuration || 5) : 0;
    const cardStartAt = startTime + hookDelay;
    cardProgress = Math.min(Math.max(0, (time - cardStartAt) / CARD_ANIM_DURATION), 1);

    // Detect hook→card transition moment (first frame cardProgress > 0 with hook enabled)
    if (config.showHookIntro && cardProgress > 0 && hookTransitionTime === null) {
      hookTransitionTime = time;
    }

    // ── Clear ──
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, W, H);

    // ── Draw layers in order ──
    try {
      drawBackground();
      drawBlob();
      drawCircularEQ();
      drawVinyl();
      drawParticles();
      drawBeatFlash();
      drawGameplayWindow();
      drawGlassCard();
      drawRetroOverlay();
      drawColorFilter();
      drawVignette();
      drawTimedEffects();
      drawBeatSyncEffects();
      drawHookIntro();
      drawHookTextOverlay();
      drawHookTransition();
      drawWatermark();
      drawFade();
    } catch (e) {
      console.error('[Renderer] Draw error:', e);
    }

    // ── Signal new frame to captureStream (mode 0 = manual) ──
    if (captureStreamTrack) {
      try { captureStreamTrack.requestFrame(); } catch (e) {}
    }
  }

  function start() {
    startTime = null;
    lastTimestamp = performance.now();
    animFrame = requestAnimationFrame(render);
  }

  function stop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (exportInterval) { clearInterval(exportInterval); exportInterval = null; }
  }

  /**
   * Returns a MediaStream from the canvas in manual-frame mode.
   * Switches the render loop from requestAnimationFrame to setInterval
   * at a fixed 60fps so the loop stays stable even if the window is
   * backgrounded (rAF gets throttled to 1fps by Chromium when hidden).
   */
  function getStream() {
    const stream = canvas.captureStream(0);
    const tracks = stream.getVideoTracks();
    if (tracks.length > 0) {
      captureStreamTrack = tracks[0];
    }
    // Cancel rAF and switch to fixed-rate interval for export
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    lastTimestamp = performance.now();
    exportInterval = setInterval(render, 1000 / 60);
    return stream;
  }

  function stopStream() {
    if (exportInterval) { clearInterval(exportInterval); exportInterval = null; }
    captureStreamTrack = null;
    // Resume normal rAF preview loop
    lastTimestamp = performance.now();
    animFrame = requestAnimationFrame(render);
  }

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInCubic(t) {
    return t * t * t;
  }

  // ══════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════

  return {
    start,
    stop,
    setBands,
    setFreqData,
    setTimeDomainData,
    setAudioTime,
    setPlaying,
    setConfig,
    setCoverArt,
    setGameImage,
    setGameplayVideo,
    setBackground,
    setBackgroundVideo,
    setWatermark,
    startFadeIn,
    startFadeOut,
    triggerBeat,
    triggerBeatSyncEffect,
    resetHookIntro,
    getStream,
    stopStream,
    canvas,
    W,
    H,
  };
}
