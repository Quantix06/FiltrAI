import React from 'react';
import { t } from '../utils/translations';

export function TutorialModal({ onClose, language }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{t(language, 'tutoTitle')}</span>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body tutorial-content" style={{ fontSize: '13.5px', lineHeight: '1.6' }}>
          <div className="tuto-step">
            <span className="step-num">1</span>
            <div>
              <strong>{t(language, 'step1Title')}</strong>
              <p>{t(language, 'step1Desc')}</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">2</span>
            <div>
              <strong>{t(language, 'step2Title')}</strong>
              <p>{t(language, 'step2Desc')}</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">3</span>
            <div>
              <strong>{t(language, 'step3Title')}</strong>
              <p>{t(language, 'step3Desc')}</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">4</span>
            <div>
              <strong>{t(language, 'step4Title')}</strong>
              <p>{t(language, 'step4Desc')}</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">5</span>
            <div>
              <strong>{t(language, 'step5Title')}</strong>
              <p>{t(language, 'step5Desc')}</p>
            </div>
          </div>

          <div className="tuto-step">
            <span className="step-num">6</span>
            <div>
              <strong>{t(language, 'step6Title')}</strong>
              <p>{t(language, 'step6Desc')}</p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn primary" onClick={onClose}>{t(language, 'tutoBtnClose')}</button>
        </div>
      </div>
    </div>
  );
}
