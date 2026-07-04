import React from 'react';
import { t } from '../utils/translations';

export function SessionDivider({ timestamp, language }) {
  return (
    <div className="session-divider">
      <span>
        {t(language, 'newSession')} — {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}
