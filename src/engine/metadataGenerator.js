// ═══════════════════════════════════════════════════════════════
// Metadata Generator — asks Claude for an upload-ready title,
// description, and hashtag set for the video, from the game/track
// info already known. Same client-side SDK pattern as
// anecdoteGenerator.js.
// ═══════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Tu écris des métadonnées d'upload (titre, description, hashtags) pour des vidéos courtes (TikTok / YouTube Shorts / Instagram Reels) sur la musique de jeux vidéo (VGM), pour un public nostalgique de gaming.

Règles :
- "title" : accrocheur, moins de 100 caractères, orienté nostalgie/reconnaissance, sans clickbait mensonger.
- "description" : 2 à 3 phrases courtes, mentionne le jeu/compositeur/année si pertinent, invite à commenter ou partager.
- "hashtags" : 8 à 12 hashtags pertinents (mélange générique VGM/gaming + spécifiques au jeu), chaque entrée au format #sansespace.
- Reste factuel sur les infos fournies. Pas de markdown, pas de guillemets superflus.
- Réponds UNIQUEMENT avec un objet JSON de la forme {"title": "...", "description": "...", "hashtags": ["...", ...]}, sans texte autour.`;

/**
 * @param {string} apiKey
 * @param {{ gameName?: string, gameStudio?: string, gameYear?: string, trackTitle?: string, artist?: string }} info
 * @returns {Promise<{ title: string, description: string, hashtags: string[] }>}
 */
export async function generateMetadata(apiKey, info) {
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
      content: `${userPrompt}\n\nGénère le titre, la description et les hashtags pour cette vidéo.`,
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const raw = textBlock?.text || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const data = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

  if (!data.title || !data.description || !Array.isArray(data.hashtags)) {
    throw new Error('Réponse inattendue — réessaie.');
  }
  return data;
}

/** Formats a metadata result as plain text for the companion .txt export. */
export function formatMetadataText({ title, description, hashtags }) {
  return `${title}\n\n${description}\n\n${(hashtags || []).join(' ')}\n`;
}
