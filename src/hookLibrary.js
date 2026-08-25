// ═══════════════════════════════════════════════════════════════
// Hook Library — free, static, pre-written hook phrases for the
// video intro. No API key, no cost, no network call. Standalone
// data file (same pattern as styleTemplates.js — no circular deps).
// ═══════════════════════════════════════════════════════════════

export const HOOK_LIBRARY = [
  // Nostalgie directe
  "You forgot this masterpiece...",
  "This song lives in my head rent free...",
  "Nobody talks about this OST enough...",
  "This is what peace of mind sounds like...",
  "The most underrated video game song ever...",
  "This soundtrack raised a generation...",
  "You used to know every note of this...",
  "This is core memory unlocked...",

  // POV
  "POV: you just remembered this existed...",
  "POV: it's 2 AM and this song hits different...",
  "POV: you're 10 years old again...",
  "POV: your childhood just called...",

  // Question rhétorique
  "Remember when this song made you feel invincible?",
  "Why did nobody warn you this would hit this hard?",
  "Still gives you chills, doesn't it?",
  "Bet you can hum this from memory...",

  // Défi / pari
  "I bet you can't listen to this without smiling...",
  "Try not to get emotional in the first 10 seconds...",
  "This is your sign to replay this game...",
  "Turn the volume up before it's too late...",

  // Fait / affirmation forte
  "This is the best 30 seconds of music in gaming...",
  "This track deserves a Grammy...",
  "Video game music was never the same after this...",
  "This is why the composer is a legend...",
];

/** Returns a random hook, optionally avoiding immediate repeats of `exclude`. */
export function randomHook(exclude) {
  if (HOOK_LIBRARY.length <= 1) return HOOK_LIBRARY[0] || '';
  let pick;
  do {
    pick = HOOK_LIBRARY[Math.floor(Math.random() * HOOK_LIBRARY.length)];
  } while (pick === exclude);
  return pick;
}
