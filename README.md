# 🎵 VGM Vinyl Creator

Create stunning YouTube Shorts & Instagram Reels featuring video game music with a spinning vinyl aesthetic, audio-reactive visualizer, and retro gaming vibes.

![Platform](https://img.shields.io/badge/Platform-Electron-blue) ![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

### 🎛️ Audio-Reactive Visuals
- **Spinning vinyl disc** — dynamic grooves, reflections, custom cover art, configurable rotation speed
- **Circular equalizer** — bars or oscilloscope ring, rotates in sync with the vinyl
- **Organic blob visualizer** — soft glow breathing with bass/mid/treble
- **Floating particles** — audio-reactive particle system
- **Burst particles on beat** — short-lived particles spawned from the vinyl center on each detected beat
- **Beat flash** — screen pulse on detected beats with configurable sensitivity & intensity
- **Beat-sync auto effects** — flash/zoom/glitch/shake triggered automatically on each beat
- **Retro scanlines & film grain** — CRT-style overlay

### 📋 Info Card — 6 Styles
- **Full Width** — opaque bottom card, gameplay video integrated left with scanlines
- **Glass** — floating glassmorphism panel with gradient border
- **Minimal** — text only, no background panel
- **Neon** — dark floating card with multi-layer glowing border
- **Split** — left panel with track info / right panel with gameplay thumbnail or accent block
- **Cinematic** — full-width letterbox banner with accent bars, large title, director-style layout
- Per-style height & Y-position sliders, word-wrap + manual line breaks on all text fields
- Gameplay window **glow border** with configurable intensity

### 🎬 Hook Intro
- Typewriter animation with dark overlay (configurable opacity)
- 3 phases: custom text, game name, nostalgia counter
- **Hook → card transition** — white flash + ripple animation when the info card appears
- **Text-to-speech** on the hook phrase — System voices (Web Speech API) or **ElevenLabs AI voices** (API key required, cached per text/voice)
- **Music ducking** — music volume automatically lowers during TTS playback
- **After-hook text overlay** — subtitle-style lines appearing sequentially, configurable font/size/position
- Hook and TTS **re-trigger on every preview loop**

### 🎨 Appearance
- **6 style templates** — Dark Neon, Lo-Fi Warm, Minimal, Retro Arcade, Synthwave, Ocean
- **Color filters** — Pastel, Warm, Cold, Vintage, Neon with intensity slider
- **Gameplay color filters** — per-clip brightness, contrast, saturation, hue sliders
- **Vignette** — radial darkening from edges
- **Logo / Watermark overlay** — PNG/WebP/SVG, configurable size, opacity, and position
- 4 color pickers: Accent, Text, Card BG, Card Border (live preview)
- Custom card font (9 options)

### ⏱️ Timeline
- **Interactive visual timeline** — shows fade in, hook, after-hook, and fade out segments
- Drag segment edges to adjust durations directly on the timeline
- Playback cursor updated in real-time (no React re-renders)

### 📹 Media
- Background image or video (blur, brightness, zoom, pan) + **trim controls** with interactive scrubber
- Gameplay footage in info card (size, position, zoom, pan) + **trim controls** with interactive scrubber
- Drag & drop files directly onto the window

### 🎵 Audio
- Progress bar with draggable thumb (preview only, not exported)
- **Preview loop** — loops between export start/end points with full hook/TTS reset each loop
- **Audio fade in/out** at export (sample-accurate via AudioContext gain scheduling)

### 🎬 Export
- **MP4** (H.264/AAC via FFmpeg) or **WebM** (VP9/Opus)
- 3 quality presets: High (20 Mbps), Medium (12 Mbps), Draft (6 Mbps)
- **Waveform scrubber** to select export segment visually
- **Thumbnail export** — save current frame as PNG
- 1080×1920 native resolution (9:16)
- ElevenLabs TTS voice included in exported audio

### 🔍 Game Search
- **IGDB search** (via Twitch API) — auto-fills game name, studio, year, and cover art (up to 20 results with platform info)

### ⌨️ Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `R` | Reset animation |
| `L` | Toggle preview loop |
| `←` / `→` | Seek ±5 seconds |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save project |
| `Ctrl+O` | Load project |

### 💾 Projects
- Save/Load as JSON (Ctrl+S / Ctrl+O)
- **Credentials persisted** — ElevenLabs & Twitch API keys saved across sessions

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Git (optional)

### Installation

```bash
git clone https://github.com/Twispy/vgm-creator.git
cd vgm-creator
npm install
```

### Run

```bash
# Desktop mode (Electron)
npm run electron:dev

# Browser mode (Vite dev server)
npm run dev
```

### Build Executable

```bash
npm run electron:build
```

The packaged installer will be in the `release/` folder.

---

## 🎮 Usage

1. **Load an audio track** — MP3, WAV, OGG, FLAC
2. **Load cover art** — appears in the vinyl label center
3. **Load a background** — image or video, blurred behind the vinyl; set trim loop points if video
4. **Load gameplay footage** — shown in the info card; set trim loop points
5. **Search a game** — IGDB search auto-fills name, studio, year, and cover art
6. **Fill in track info** — Title, Artist, Game, Studio, Year
7. **Customize** — pick a style template or adjust colors, card style, effects individually
8. **Configure Hook Intro** — enable TTS (system or ElevenLabs AI voice), add after-hook text lines
9. **Adjust the timeline** — drag fade/hook segment edges to set timings visually
10. **Press Space** to play/pause, preview loops automatically
11. **Export** — set format, quality, fade in/out, time range via waveform scrubber, then Export

---

## 🏗️ Architecture

```
vgm-vinyl-creator/
├── electron/
│   ├── main.cjs              # Electron main process + FFmpeg IPC + API proxy
│   └── preload.cjs           # Secure bridge (main ↔ renderer)
├── src/
│   ├── engine/
│   │   ├── CanvasRenderer.js  # Mono-canvas renderer (all visuals)
│   │   ├── AudioAnalyzer.js   # Web Audio API — analysis + GainNode chain (fades + ducking)
│   │   ├── VideoExporter.js   # MediaRecorder + FFmpeg pipeline
│   │   └── waveform.worker.js # Off-thread waveform generation
│   ├── ui/
│   │   ├── ControlPanel.jsx   # Collapsible sidebar — all controls
│   │   └── PreviewTimeline.jsx # Interactive timeline with drag handles
│   ├── styleTemplates.js      # 6 style presets (standalone, no circular deps)
│   ├── App.jsx                # Main orchestrator
│   └── main.jsx               # React entry point
├── index.html
├── package.json
└── vite.config.js
```

### Key Design Decisions

- **Mono-canvas rendering** — everything (background, blob, EQ, vinyl, particles, card, hook, scanlines) on a single 1080×1920 Canvas 2D. Export fidelity guaranteed.
- **captureStream(0) + manual requestFrame()** — prevents encoder lag by signaling new frames only after each render completes.
- **VP9 → FFmpeg H.264 pipeline** — MediaRecorder captures VP9 WebM, FFmpeg converts to MP4 H.264 for universal compatibility.
- **Single AudioContext + GainNode chain** — `source → analyzer → gainNode (fades) → duckNode (TTS ducking) → destination + exportDest`. Fresh `MediaElementSource` for each ElevenLabs export to bypass single-connection limitation.
- **Direct DOM refs for progress/timeline** — 60fps cursor updates without React re-renders, drag state managed via refs to avoid stale closures.
- **Beat detection via transient analysis** — fast average (8 frames) vs slow average (60 frames) detects energy spikes above baseline rather than absolute loudness thresholds.
- **Crash-proof render loop** — rAF rescheduled before drawing so a runtime error in any draw function never permanently kills the animation.

---

## 🛠️ Tech Stack

- **React 18** + **Vite 5** — fast UI development
- **Electron 28** — desktop app with native dialogs
- **Canvas 2D API** — all rendering
- **Web Audio API** — real-time frequency analysis + gain scheduling + TTS ducking
- **MediaRecorder API** — video capture
- **FFmpeg** (via ffmpeg-static) — WebM → MP4 conversion
- **Web Speech API** — system TTS voices
- **ElevenLabs API** — AI voice generation (optional)
- **IGDB / Twitch API** — game metadata & cover art

---

## 📝 Roadmap

- [x] Waveform scrubber for segment selection
- [x] 6 info card styles (Full Width, Glass, Minimal, Neon, Split, Cinematic)
- [x] 6 style templates
- [x] Color filters & vignette
- [x] Gameplay color filters (brightness/contrast/saturation/hue)
- [x] Hook intro with TTS (system + ElevenLabs)
- [x] After-hook subtitle overlay
- [x] Hook → card transition animation
- [x] Beat-sync auto effects + burst particles
- [x] Music ducking during TTS
- [x] Audio fade in/out at export
- [x] Interactive visual timeline with drag handles
- [x] Gameplay & background video trim
- [x] Thumbnail export (PNG)
- [x] Logo / watermark overlay
- [x] Undo / Redo (60 states)
- [x] Packaged .exe installer
- [ ] Animated intro (zoom vinyl + glitch)
- [ ] Theme presets (Hotline Miami, Zelda, Sonic, Doom…)
- [ ] Recent projects history on launch

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---

*Made with 🎵 for the VGM community*
