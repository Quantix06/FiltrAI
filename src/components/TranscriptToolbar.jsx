import React from 'react';
import { t } from '../utils/translations';

export function TranscriptToolbar({ showNotWorthy, onToggleShowNotWorthy, onPurge, language }) {
  return (
    <div className="transcript-toolbar">
      <button
        className={`toolbar-btn ${!showNotWorthy ? 'active' : ''}`}
        onClick={onToggleShowNotWorthy}
        title={showNotWorthy ? t(language, 'hideNotWorthy') : t(language, 'showNotWorthy')}
      >
        {showNotWorthy ? '👁️' : '🙈'} {showNotWorthy ? t(language, 'hideNotWorthy') : t(language, 'showNotWorthy')}
      </button>
      <button
        className="toolbar-btn purge-btn"
        onClick={onPurge}
        title={t(language, 'purge')}
      >
        🗑️ {t(language, 'purge')}
      </button>
    </div>
  );
}
