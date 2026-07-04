import React from 'react';

export function NewSpeakerPrompt({ prompt, onConfirm, onSkip }) {
  if (!prompt) return null;

  return (
    <div className="speaker-prompt-banner">
      <div className="prompt-text">Who is speaking right now?</div>
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
          Save
        </button>
        <button
          className="prompt-btn skip"
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
