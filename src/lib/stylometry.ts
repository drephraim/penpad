export interface StylometryProfile {
  avgSentenceLength: number;
  topNGrams: Record<string, number>;
  passiveRatio: number;
}

export class StylometryEngine {
  analyze(text: string): StylometryProfile {
    // 1. Sentence Length
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const totalWords = text.split(/\s+/).filter(Boolean).length;
    const avgSentenceLength = sentences.length > 0 ? totalWords / sentences.length : 0;

    // 2. N-Grams (Bigrams for simplicity)
    const words = text.toLowerCase().match(/\b[A-Za-z']+\b/g) || [];
    const bigrams: Record<string, number> = {};
    for (let i = 0; i < words.length - 1; i++) {
      const pair = `${words[i]} ${words[i+1]}`;
      bigrams[pair] = (bigrams[pair] || 0) + 1;
    }
    
    // Take top 10 bigrams
    const sortedBigrams = Object.entries(bigrams)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
      
    const topNGrams = Object.fromEntries(sortedBigrams);

    // 3. Passive Voice Ratio
    const PASSIVE_VOICE_REGEX = /\b(am|is|are|was|were|be|been|being)\b\s+([a-z]+ed|had|done|said|told|seen|known|made|given|taken|found)\b/gi;
    const passiveMatches = text.match(PASSIVE_VOICE_REGEX) || [];
    const passiveRatio = sentences.length > 0 ? passiveMatches.length / sentences.length : 0;

    return {
      avgSentenceLength,
      topNGrams,
      passiveRatio
    };
  }

  // Heuristic to decide if a suggestion should be suppressed based on profile
  shouldSuppress(type: string, original: string, profile: StylometryProfile): boolean {
    if (type === 'style') {
      // If user consistently uses passive voice (e.g. > 0.3 per sentence), stop nagging
      if (original.match(/\b(am|is|are|was|were|be|been|being)\b\s+/i) && profile.passiveRatio > 0.3) {
        return true;
      }
      
      // If a "wordy phrase" is part of their top bigrams, maybe they like it?
      // (Simplified logic: if top bigrams contains words from the phrase)
      const wordsInPhrase = original.toLowerCase().split(' ');
      const commonBigramMatch = Object.keys(profile.topNGrams).some(bg => 
        wordsInPhrase.some(w => bg.includes(w))
      );
      
      if (commonBigramMatch && profile.avgSentenceLength > 25) {
        // Long sentences + favorite phrases = Stylistic choice
        return true;
      }
    }
    
    return false;
  }
}
