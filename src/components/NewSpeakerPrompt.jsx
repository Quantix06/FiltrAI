import React from 'react';
import { t } from '../utils/translations';

export function NewSpeakerPrompt({ prompt, onConfirm, onSkip, language }) {
  if (!prompt) return null;

  return (
    <div className="speaker-prompt-banner">
      <div className="prompt-text">{t(language, 'whoIsSpeaking')}</div>
      <div className="prompt-sample">"{prompt.sample}..."</div>
      <div className="prompt-input-row">
        <input
          type="text"
          className="prompt-input"
          placeholder="e.g. Alice"
          id="speaker-name-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onConfirm(prompt.id, e.target.value);
            }
          }}
        />
        <button
          className="prompt-btn"
          onClick={() => {
            const val = document.getElementById('speaker-name-input').value;
            onConfirm(prompt.id, val || `Speaker ${prompt.id}`);
          }}
        >
          {t(language, 'save')}
        </button>
        <button
          className="prompt-btn skip"
          onClick={onSkip}
        >
          {t(language, 'skip')}
        </button>
      </div>
    </div>
  );
}
