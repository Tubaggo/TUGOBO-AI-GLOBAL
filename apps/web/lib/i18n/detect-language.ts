/**
 * Lightweight script/diacritic-based language detection.
 * Returns a BCP-47 language tag or null when confidence is too low.
 * No external dependencies.
 */

// Cyrillic block: U+0400–U+04FF
const RE_CYRILLIC = /[Ѐ-ӿ]/g;

// Turkish-specific characters not found in any Western-Latin language
const RE_TR_SPECIFIC = /[ığşçöüİĞŞÇÖÜ]/gi;

// German-specific characters
const RE_DE_SPECIFIC = /[äöüÄÖÜß]/g;

// Common English function words (whole-word match)
const RE_EN_WORDS =
  /\b(the|and|is|are|was|were|have|has|had|will|would|could|should|this|that|with|for|from|what|when|where|how|why|not|but|can|you|your|our|we|i'm|it's|don't|doesn't|isn't|there|their|they|please|hello|hi|thank|thanks|need|want|like|just|get|do|to|of|in|on|at|by)\b/gi;

const RE_TR_WORDS =
  /\b(ve|bir|bu|da|de|için|ile|var|yok|mi|mı|mu|mü|ne|ki|ya|ama|nasıl|nerede|hangi|kaç|evet|hayır|tamam|merhaba|teşekkür|lütfen|fiyat|oda|rezervasyon|müsait|hafta|sonu)\b/gi;

const RE_DE_WORDS =
  /\b(und|ist|sind|das|die|der|ein|eine|ich|sie|wir|haben|wird|kann|bitte|danke|hallo|guten|zimmer|preis|buchung|verfügbar|wochenende|wie|was|wo|warum|nicht|aber|oder)\b/gi;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/**
 * Infers the language of `text`.
 * Returns an uppercase language code ("RU" | "TR" | "DE" | "EN") or null.
 */
export function detectLanguage(text: string): string | null {
  if (!text || text.trim().length < 4) return null;

  const len = text.length;

  // Cyrillic dominance → Russian
  const cyrillicCount = countMatches(text, RE_CYRILLIC);
  if (cyrillicCount / len > 0.15) return "RU";

  // Turkish diacritics are highly distinctive
  const trSpecific = countMatches(text, RE_TR_SPECIFIC);
  const trWords = countMatches(text, RE_TR_WORDS);
  if (trSpecific >= 2 || trWords >= 2) return "TR";

  // German diacritics
  const deSpecific = countMatches(text, RE_DE_SPECIFIC);
  const deWords = countMatches(text, RE_DE_WORDS);
  if (deSpecific >= 1 || deWords >= 2) return "DE";

  // English function words
  const enWords = countMatches(text, RE_EN_WORDS);
  if (enWords >= 2) return "EN";

  return null;
}
