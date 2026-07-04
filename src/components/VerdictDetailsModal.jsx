import React from 'react';
import { t } from '../utils/translations';

export function VerdictDetailsModal({ card, onClose, language }) {
  if (!card) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{t(language, 'detailsTitle')}</span>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body card-detail-content">
          <div className="form-group">
            <span className="form-label">{t(language, 'claimStatement')}</span>
            <p className="card-claim" style={{ fontSize: '15px' }}>"{card.claim}"</p>
          </div>

          <div className="detail-verdict-section">
            <span className="form-label">{t(language, 'verdict')}</span>
            <span
              className="detail-verdict-value"
              style={{
                color: card.verdict === 'TRUE' || card.verdict === 'SUBSTANTIALLY TRUE' ? 'var(--color-true)' :
                  card.verdict === 'MISLEADING' ? 'var(--color-misleading)' :
                    card.verdict === 'FALSE' ? 'var(--color-false)' : 'var(--color-unverifiable)'
              }}
            >
              {card.verdict}
            </span>
          </div>

          <div className="form-group">
            <span className="form-label">{t(language, 'explanation')}</span>
            <p className="card-explanation" style={{ fontSize: '14px' }}>{card.explanation}</p>
          </div>

          {!card.pending && card.sources?.length > 0 && (
            <div className="form-group">
              <span className="form-label">{t(language, 'sources')}</span>
              <div className="sources-list">
                {card.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link-item"
                    title={src}
                  >
                    🔗 {src}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="modal-btn secondary" onClick={onClose}>{t(language, 'close')}</button>
        </div>
      </div>
    </div>
  );
}
