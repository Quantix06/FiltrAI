import React from 'react';
import { t } from '../utils/translations';

export function VerdictCard({ card, speakerColors, formatTime, onClick, language }) {
  const colorIndex = card.dominantSpeakerId !== null && card.dominantSpeakerId !== undefined
    ? parseInt(card.dominantSpeakerId)
    : 0;
  const spkColor = speakerColors[colorIndex % speakerColors.length];

  return (
    <div
      className={`verdict-card ${card.verdict.toLowerCase().replace(' ', '_')} ${card.pending ? 'pending' : ''}`}
      onClick={onClick}
    >
      <div className="card-header-row">
        <div className="speaker-tag-box">
          <span className="speaker-color-dot" style={{ backgroundColor: spkColor }} />
          <span>{card.speaker || 'Unknown'}</span>
        </div>
        <span className="card-verdict-badge">
          {card.pending ? t(language, 'verdictVerifying') : card.verdict}
        </span>
      </div>
      <div className="card-claim">"{card.claim}"</div>
      <div className="card-explanation">{card.explanation}</div>
      <div className="card-meta-row">
        <span>{formatTime(card.timestamp)}</span>
        {!card.pending && card.sources?.length > 0 && (
          <span className="sources-count">
            📚 {card.sources.length} {card.sources.length > 1 ? 'sources' : 'source'}
          </span>
        )}
      </div>
    </div>
  );
}
