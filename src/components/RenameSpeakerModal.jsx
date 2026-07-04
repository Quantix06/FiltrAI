import React from 'react';

export function RenameSpeakerModal({ speaker, onSave, onCancel }) {
  if (!speaker) return null;

  return (
    <div className="rename-dialog-overlay">
      <div className="rename-dialog">
        <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px' }}>
          Rename Speaker ID {speaker.id}
        </h4>
        <input
          type="text"
          className="form-input"
          defaultValue={speaker.name}
          id="rename-speaker-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(speaker.id, e.target.value);
            }
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="prompt-btn"
            style={{ flex: 1 }}
            onClick={() => {
              const val = document.getElementById('rename-speaker-input').value;
              onSave(speaker.id, val);
            }}
          >
            Save
          </button>
          <button
            className="prompt-btn skip"
            style={{ flex: 1 }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
