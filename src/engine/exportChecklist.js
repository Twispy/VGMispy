// ═══════════════════════════════════════════════════════════════
// Export Checklist — catches the classic "forgot to fill something
// in" mistakes before an export locks them into the video: leftover
// demo/placeholder text, missing cover art, a TTS hook with no voice
// configured, an untouched default export range on a track that's
// clearly longer than 30s.
// ═══════════════════════════════════════════════════════════════

/**
 * @param {object} config - current app config
 * @param {object} ctx - { coverName, audioDuration, defaults } — defaults is DEFAULT_CONFIG
 * @returns {string[]} human-readable warnings (empty = nothing to flag)
 */
export function getExportWarnings(config, { coverName, audioDuration, defaults }) {
  const warnings = [];

  if (config.showHookIntro && (config.hookText || '').trim() === (defaults.hookText || '').trim()) {
    warnings.push("Le texte du hook est resté sur l'exemple par défaut.");
  }

  if (config.gameName === defaults.gameName && config.gameStudio === defaults.gameStudio && config.gameYear === defaults.gameYear) {
    warnings.push("Les infos du jeu (nom / studio / année) semblent être restées sur l'exemple par défaut — pense à faire une recherche IGDB.");
  }

  if (config.trackTitle === defaults.trackTitle && config.artist === defaults.artist) {
    warnings.push("Titre et artiste sont restés sur l'exemple par défaut.");
  }

  if (!coverName) {
    warnings.push("Aucune pochette chargée — le centre du vinyle sera vide.");
  }

  if (config.showHookIntro && config.hookTTS && config.hookTTSProvider === 'elevenlabs'
      && (!(config.elevenLabsKey || '').trim() || !config.hookTTSVoiceId)) {
    warnings.push("TTS ElevenLabs activé mais clé API ou voix manquante — le hook n'aura pas de voix.");
  }

  if (audioDuration > 30) {
    const start = config.exportStart || 0;
    const end = config.exportEnd || 30;
    if (start === 0 && Math.abs(end - 30) < 0.5) {
      warnings.push("La plage d'export est toujours sur les 30 premières secondes par défaut — ajuste-la ou utilise 🎯 Meilleur passage.");
    }
  }

  return warnings;
}
