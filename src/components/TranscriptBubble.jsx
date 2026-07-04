import React from 'react';

export function TranscriptBubble({ t, speakersMap, speakerColors, formatTime }) {
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
              <span>En attente de pertinence...</span>
            </>
          )}
          {t.status === 'checking' && (
            <>
              <span className="badge-icon spin">🔍</span>
              <span>Analyse de pertinence en cours (Attendre)...</span>
            </>
          )}
          {t.status === 'worthy' && (
            <>
              <span className="badge-icon text-emerald">✅</span>
              <span>Fait vérifiable détecté : "{t.claims?.join(', ')}"</span>
            </>
          )}
          {t.status === 'not_worthy' && (
            <>
              <span className="badge-icon text-muted">⚠️</span>
              <span>Contenu non vérifiable (sans affirmation factuelle)</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
