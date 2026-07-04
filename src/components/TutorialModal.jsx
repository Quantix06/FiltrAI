import React from 'react';

export function TutorialModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📖 Guide d'utilisation FiltrAI</span>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body tutorial-content" style={{ fontSize: '13.5px', lineHeight: '1.6' }}>
          <div className="tuto-step">
            <span className="step-num">1</span>
            <div>
              <strong>Configuration de base</strong>
              <p>Cliquez sur l'icône ⚙️ en haut à droite. Renseignez votre clé <strong>Serper API</strong> (pour Google) et une clé pour le LLM (<strong>OpenRouter</strong> ou <strong>Anthropic</strong>).</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">2</span>
            <div>
              <strong>Écoute et capture</strong>
              <p>Appuyez sur <strong>Start Listening</strong> Parlez ou placez le micro près de la source audio. Le visualiseur affiche le signal d'entrée en temps réel.</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">3</span>
            <div>
              <strong>Analyse de pertinence</strong>
              <p>Le flux est découpé par phrase. Si une phrase contient un fait vérifiable, FiltrAI l'analyse (badge bleu <code>Analyse en cours...</code>). Sinon, elle est classée comme non vérifiable (badge orange).</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">4</span>
            <div>
              <strong>Verdicts et sources</strong>
              <p>Dans l'onglet <strong>Fact-Checks</strong>, observez les verdicts (TRUE, FALSE, MISLEADING) enrichis d'explications et de liens cliquables vers les sources Google.</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">5</span>
            <div>
              <strong>Gestion des locuteurs</strong>
              <p>Avec la transcription Deepgram, cliquez sur un badge de locuteur (ex: <i>Speaker 0</i>) pour lui donner son vrai nom. Tous les verdicts passés et futurs s'adaptent automatiquement.</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">6</span>
            <div>
              <strong>Exporter</strong>
              <p>Cliquez sur l'icône de téléchargement 📥 en haut à droite pour récupérer le rapport complet de fact-checking au format Markdown.</p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn primary" onClick={onClose}>Compris !</button>
        </div>
      </div>
    </div>
  );
}
