import React from 'react';
import { StoryCard as StoryCardType } from '../../types/index';
import { StoryCard } from './StoryCard';

interface Props {
  cards: StoryCardType[];
  isLoading: boolean;
  onDrillIn: (q: string) => void;
}

export const StoryCards: React.FC<Props> = ({ cards, isLoading, onDrillIn }) => {
  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-4 overflow-y-auto pb-4 custom-scrollbar">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="w-full h-48 bg-natwest-surface/50 border border-natwest-border rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (!cards || cards.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-4 overflow-y-auto pb-4 custom-scrollbar">
      {cards.map((card, i) => (
        <StoryCard key={i} index={i} card={card} onDrillIn={onDrillIn} />
      ))}
    </div>
  );
};
