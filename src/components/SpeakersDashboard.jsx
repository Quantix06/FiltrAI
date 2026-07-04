import React from 'react';
import { t } from '../utils/translations';

export function SpeakersDashboard({ detectedSpeakerIds, speakersMap, onSpeakerClick, speakerColors, language }) {
  if (detectedSpeakerIds.length === 0) return null;

  return (
    <section className="speakers-dashboard">
      <div className="dashboard-title">{t(language, 'activeSpeakers')}</div>
      <div className="speakers-row">
        {detectedSpeakerIds.map(sid => {
          const name = speakersMap[sid] || `Speaker ${sid}`;
          const color = speakerColors[sid % speakerColors.length];
          return (
            <div
              key={sid}
              className="speaker-pill"
              onClick={() => onSpeakerClick({ id: sid, name })}
            >
              <span className="speaker-color-dot" style={{ backgroundColor: color }} />
              <span>{name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
