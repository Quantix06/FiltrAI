import React from 'react';
import { t, getStatusTranslation } from '../utils/translations';

export function VisualizerCard({ canvasRef, isListening, listeningStatus, activeEvaluations, onToggleListening, language }) {
  return (
    <section className="status-visualizer-card">
      <canvas
        ref={canvasRef}
        className="visualizer-canvas"
        width={400}
        height={48}
      />
      <div className="status-badge-row">
        <div className="status-indicator">
          <span className={`status-dot ${isListening ? 'listening' : ''}`} />
          <span>{getStatusTranslation(language, listeningStatus)}</span>
        </div>
        <button
          className={`control-btn ${isListening ? 'active' : ''}`}
          onClick={onToggleListening}
        >
          {isListening ? t(language, 'stopChecking') : t(language, 'startListening')}
        </button>
      </div>
      {activeEvaluations > 0 && (
        <div className="pipeline-loading-indicator animate-pulse">
          <span className="pulse-icon">🔍</span>
          <span>{t(language, 'checkingInProcess')}</span>
        </div>
      )}
    </section>
  );
}
