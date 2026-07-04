import React from 'react';

export function TranscriptToolbar({ showNotWorthy, onToggleShowNotWorthy, onPurge }) {
  return (
    <div className="transcript-toolbar">
      <button
        className={`toolbar-btn ${!showNotWorthy ? 'active' : ''}`}
        onClick={onToggleShowNotWorthy}
        title={showNotWorthy ? "Masquer les phrases non vérifiables" : "Afficher les phrases non vérifiables"}
      >
        {showNotWorthy ? '👁️' : '🙈'} {showNotWorthy ? 'Masquer' : 'Afficher'} non-intéressantes
      </button>
      <button
        className="toolbar-btn purge-btn"
        onClick={onPurge}
        title="Supprimer définitivement les phrases non intéressantes"
      >
        🗑️ Purger les inutiles
      </button>
    </div>
  );
}
