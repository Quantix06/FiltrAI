import React from 'react';

export function VisualizerCard({ canvasRef, isListening, listeningStatus, activeEvaluations, onToggleListening }) {
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
          <span>{listeningStatus}</span>
        </div>
        <button
          className={`control-btn ${isListening ? 'active' : ''}`}
          onClick={onToggleListening}
        >
          {isListening ? 'Stop Checking' : 'Start Listening'}
        </button>
      </div>
      {activeEvaluations > 0 && (
        <div className="pipeline-loading-indicator animate-pulse">
          <span className="pulse-icon">🔍</span>
          <span>Analyse de pertinence IA en cours... Veuillez patienter</span>
        </div>
      )}
    </section>
  );
}
