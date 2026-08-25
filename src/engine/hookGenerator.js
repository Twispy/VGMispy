// ═══════════════════════════════════════════════════════════════
// Hook Generator — asks Claude for a handful of short, punchy hook
// phrase options for the video intro, tailored to the loaded game
// and track. Same client-side SDK pattern as anecdoteGenerator.js
// and metadataGenerator.js.
// ═══════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Tu écris des phrases d'accroche (hooks) courtes pour l'intro de vidéos courtes (TikTok / YouTube Shorts / Instagram Reels) sur la musique de jeux vidéo (VGM), pour un public nostalgique de gaming.

Règles :
- Chaque hook est une phrase courte et percutante, moins de 80 caractères, du style "You forgot this masterpiece...", "This song lives in my head rent free...", "POV: you just remembered this existed...".
- Ton nostalgique, familier, accrocheur — jamais de clickbait mensonger ou de fait inventé sur le jeu.
- En anglais par défaut (c'est le style dominant sur ce format de vidéo), sauf si le contexte fourni suggère clairement le français.
- Varie les angles entre les propositions (nostalgie directe, question rhétorique, POV, défi/pari).
- Réponds UNIQUEMENT avec un tableau JSON de chaînes de caractères, sans aucun texte autour.`;

/**
 * @param {string} apiKey
 * @param {{ gameName?: string, gameStudio?: string, gameYear?: string, trackTitle?: string, artist?: string }} info
 * @param {number} count - how many hook options to generate
 * @returns {Promise<string[]>}
 */
export async function generateHooks(apiKey, info, count = 4) {
  const key = (apiKey || '').trim();
  if (!key) throw new Error('Clé API Anthropic manquante.');

  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });

  const { gameName, gameStudio, gameYear, trackTitle, artist } = info || {};
  const userPrompt = [
    gameName && `Jeu : ${gameName}`,
    gameStudio && `Studio : ${gameStudio}`,
    gameYear && `Année : ${gameYear}`,
    trackTitle && `Morceau : ${trackTitle}`,
    artist && `Compositeur : ${artist}`,
  ].filter(Boolean).join('\n');

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1024,
    output_config: { effort: 'medium' },
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `${userPrompt}\n\nGénère ${count} phrases d'accroche différentes pour cette vidéo.`,
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const raw = textBlock?.text || '[]';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  const hooks = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

  if (!Array.isArray(hooks) || hooks.some(h => typeof h !== 'string')) {
    throw new Error('Réponse inattendue — réessaie.');
  }
  return hooks;
}
