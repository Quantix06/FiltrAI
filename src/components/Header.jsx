import React from 'react';

export function Header({ settings, onExportSession, onOpenSettings }) {
  return (
    <header className="app-header">
      <div className="logo-section">
        <span className="logo-icon">🔍</span>
        <span className="app-title">FiltrAI</span>
        <span className="lang-header-badge">
          {settings.language === 'en' ? '🇺🇸 EN' :
           settings.language === 'fr' ? '🇫🇷 FR' :
           settings.language === 'es' ? '🇪🇸 ES' :
           settings.language === 'de' ? '🇩🇪 DE' :
           settings.language === 'it' ? '🇮🇹 IT' :
           settings.language === 'pt' ? '🇧🇷 PT' :
           settings.language === 'zh' ? '🇨🇳 ZH' :
           `🌐 ${settings.language.toUpperCase()}`}
        </span>
      </div>
      <div className="header-actions">
        <button className="icon-btn" onClick={onExportSession} title="Export Session">
          📥
        </button>
        <button className="icon-btn" onClick={onOpenSettings} title="Settings">
          ⚙️
        </button>
      </div>
    </header>
  );
}
