import React from 'react';
import { StoryCard as StoryCardType } from '../../types/index';
import { MiniChart } from '../Charts/MiniChart';

interface Props {
  card: StoryCardType;
  onDrillIn: (q: string) => void;
  index: number;
}

const ACCENT_COLORS = [
  'from-purple-500 to-indigo-600',
  'from-teal-400 to-emerald-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-sky-400 to-blue-500',
  'from-violet-400 to-purple-500',
];

export const StoryCard: React.FC<Props> = ({ card, onDrillIn, index }) => {
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <div className="w-full bg-[#151020] border border-white/10 rounded-xl overflow-hidden shadow-lg hover:border-white/20 transition-colors">
      {/* Gradient accent bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />

      <div className="p-4">
        {/* Headline */}
        <h4 className="font-bold font-display text-white text-sm leading-snug mb-1">
          {card.headline}
        </h4>

        {/* Explanation */}
        <p className="text-[11px] text-white/50 mb-3 leading-relaxed line-clamp-2">
          {card.explanation}
        </p>

        {/* Chart */}
        <div className="bg-black/20 rounded-lg p-2 mb-3 min-h-[120px] flex items-center justify-center">
          <MiniChart type={card.chart_type} data={card.chart_data} />
        </div>

        {/* Drill In */}
        <button
          onClick={() => onDrillIn(card.drill_in_question)}
          className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-all flex items-center justify-center gap-1.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Drill in
        </button>
      </div>
    </div>
  );
};
