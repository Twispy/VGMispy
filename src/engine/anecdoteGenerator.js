// ═══════════════════════════════════════════════════════════════
// Anecdote Generator — asks Claude for a handful of short, subtitle-
// sized trivia lines about a game/soundtrack, meant to drop straight
// into the "after hook" text overlay.
//
// Runs client-side (renderer) with the official Anthropic SDK, the
// same trust model already used for the ElevenLabs key in this app
// (key lives in local config/localStorage, used directly). Vite
// bundles the SDK like any other dependency — no Electron packaging
// changes needed.
// ═══════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Tu génères de courtes anecdotes factuelles sur des jeux vidéo et leur musique, destinées à des sous-titres de vidéos courtes (TikTok / YouTube Shorts).

Règles :
- Chaque anecdote tient sur une ligne courte (visée : moins de 90 caractères).
- Reste factuel et vérifiable. Si tu n'es pas sûr d'un détail précis (date exacte, chiffre, citation), reste général plutôt que d'inventer.
- Pas de markdown, pas de guillemets autour du texte, pas d'emoji.
- Réponds UNIQUEMENT avec un tableau JSON de chaînes de caractères, sans aucun texte avant ou après.`;

/**
 * @param {string} apiKey
 * @param {{ gameName?: string, gameStudio?: string, gameYear?: string, trackTitle?: string, artist?: string }} info
 * @param {number} count - how many lines to ask for
 * @returns {Promise<string[]>}
 */
export async function generateAnecdotes(apiKey, info, count = 4) {
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
      content: `${userPrompt}\n\nGénère ${count} anecdotes courtes et intéressantes sur ce jeu et/ou cette musique.`,
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const raw = textBlock?.text || '[]';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  const lines = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

  if (!Array.isArray(lines) || lines.some(l => typeof l !== 'string')) {
    throw new Error('Réponse inattendue — réessaie.');
  }
  return lines;
}
