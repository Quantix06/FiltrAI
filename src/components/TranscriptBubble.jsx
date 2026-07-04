import React from 'react';
import { t as translate } from '../utils/translations';

export function TranscriptBubble({ t, speakersMap, speakerColors, formatTime, language }) {
  const name = speakersMap[t.speakerId] || `Speaker ${t.speakerId}`;
  const color = speakerColors[t.speakerId % speakerColors.length];

  return (
    <div className={`transcript-bubble ${t.status || 'idle'}`}>
      <div className="transcript-meta">
        <span className="transcript-speaker" style={{ color }}>{name}</span>
        <span className="transcript-time">{formatTime(t.timestamp)}</span>
      </div>
      <p className="transcript-text">{t.text}</p>
      {t.status && t.status !== 'idle' && (
        <div className={`bubble-status-badge ${t.status}`}>
          {t.status === 'waiting' && (
            <>
              <span className="badge-icon pulse-soft">⏳</span>
              <span>{translate(language, 'waitingRelevance')}</span>
            </>
          )}
          {t.status === 'checking' && (
            <>
              <span className="badge-icon spin">🔍</span>
              <span>{translate(language, 'checkingRelevance')}</span>
            </>
          )}
          {t.status === 'worthy' && (
            <>
              <span className="badge-icon text-emerald">✅</span>
              <span>{translate(language, 'worthyFactual')}"{t.claims?.join(', ')}"</span>
            </>
          )}
          {t.status === 'not_worthy' && (
            <>
              <span className="badge-icon text-muted">⚠️</span>
              <span>{translate(language, 'notWorthyFactual')}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
