import { useState } from 'react';
import { StoryCard } from '../types/index';
import api from '../services/api';

export const useStory = (sessionId: string | null, precomputedInsights: StoryCard[] = []) => {
  const [cards, setCards] = useState<StoryCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runStory = async () => {
    if (!sessionId) {
      console.warn('[useStory] No sessionId, aborting.');
      return;
    }

    setIsLoading(true);

    // Path A: Use precomputed insights if available (instant)
    if (precomputedInsights && precomputedInsights.length > 0) {
      console.log('[useStory] Using precomputed insights:', precomputedInsights.length, 'cards');
      setCards(precomputedInsights);
      setIsLoading(false);
      return;
    }

    // Path B: Fallback — call backend API (for page reloads / old sessions)
    console.log('[useStory] No precomputed insights, calling /api/story for session:', sessionId);
    try {
      const res = await api.post('/api/story', { session_id: sessionId });
      console.log('[useStory] API returned', res.data?.length || 0, 'cards');
      setCards(res.data || []);
    } catch (err) {
      console.error('[useStory] API call failed:', err);
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearStory = () => setCards([]);

  return { cards, runStory, isLoading, clearStory };
};
