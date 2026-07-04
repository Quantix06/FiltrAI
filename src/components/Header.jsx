import React from 'react';
import { t } from '../utils/translations';

export function Header({ settings, onExportSession, onCopySession, onOpenSettings }) {
  const lang = settings.language;
  return (
    <header className="app-header">
      <div className="logo-section">
        <span className="logo-icon">🔍</span>
        <span className="app-title">FiltrAI</span>
        <span className="lang-header-badge">
          {lang === 'en' ? '🇺🇸 EN' :
           lang === 'fr' ? '🇫🇷 FR' :
           lang === 'es' ? '🇪🇸 ES' :
           lang === 'de' ? '🇩🇪 DE' :
           lang === 'it' ? '🇮🇹 IT' :
           lang === 'pt' ? '🇧🇷 PT' :
           lang === 'zh' ? '🇨🇳 ZH' :
           `🌐 ${lang.toUpperCase()}`}
        </span>
      </div>
      <div className="header-actions">
        <button className="icon-btn" onClick={onCopySession} title={t(lang, 'copySession')}>
          📋
        </button>
        <button className="icon-btn" onClick={onExportSession} title={t(lang, 'exportSession')}>
          📥
        </button>
        <button className="icon-btn" onClick={onOpenSettings} title={t(lang, 'settings')}>
          ⚙️
        </button>
      </div>
    </header>
  );
}
