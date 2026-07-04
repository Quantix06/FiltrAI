import React, { useState } from 'react';
import { t } from '../utils/translations';

export function SettingsModal({ settings, onSave, onClose }) {
  const [localSettings, setLocalSettings] = useState({ ...settings });
  const lang = settings.language;

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{t(lang, 'settingsTitle')}</span>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {/* AI Provider */}
          <div className="form-group">
            <span className="form-label">{t(lang, 'aiProvider')}</span>
            <select
              className="form-select"
              value={localSettings.provider}
              onChange={(e) => handleChange('provider', e.target.value)}
            >
              <option value="openrouter">OpenRouter (Recommended)</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
          </div>

          {/* OpenRouter Config */}
          {localSettings.provider === 'openrouter' && (
            <>
              <div className="form-group">
                <span className="form-label">{t(lang, 'openrouterKey')}</span>
                <input
                  type="password"
                  className="form-input"
                  placeholder="sk-or-..."
                  value={localSettings.openrouterKey}
                  onChange={(e) => handleChange('openrouterKey', e.target.value)}
                />
                <span className="help-text">{t(lang, 'openrouterHelp')}</span>
              </div>
              <div className="form-group">
                <span className="form-label">{t(lang, 'openrouterModel')}</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="cohere/north-mini-code:free"
                  value={localSettings.openrouterModel}
                  onChange={(e) => handleChange('openrouterModel', e.target.value)}
                />
                <span className="help-text">Defaulting to: cohere/north-mini-code:free</span>
              </div>
            </>
          )}

          {/* Anthropic Config */}
          {localSettings.provider === 'anthropic' && (
            <>
              <div className="form-group">
                <span className="form-label">{t(lang, 'anthropicKey')}</span>
                <input
                  type="password"
                  className="form-input"
                  placeholder="sk-ant-..."
                  value={localSettings.anthropicKey}
                  onChange={(e) => handleChange('anthropicKey', e.target.value)}
                />
              </div>
              <div className="form-group">
                <span className="form-label">{t(lang, 'anthropicModel')}</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="claude-haiku-4-5-20251001"
                  value={localSettings.anthropicModel}
                  onChange={(e) => handleChange('anthropicModel', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Google Serper Key */}
          <div className="form-group">
            <span className="form-label">{t(lang, 'serperKey')}</span>
            <input
              type="password"
              className="form-input"
              placeholder="Enter Serper API Key"
              value={localSettings.serperKey}
              onChange={(e) => handleChange('serperKey', e.target.value)}
            />
            <span className="help-text">{t(lang, 'serperHelp')}</span>
          </div>

          {/* Transcription Mode */}
          <div className="form-group">
            <span className="form-label">{t(lang, 'transcriptionEngine')}</span>
            <select
              className="form-select"
              value={localSettings.transcriptionMode}
              onChange={(e) => handleChange('transcriptionMode', e.target.value)}
            >
              <option value="webspeech">{t(lang, 'webspeechOption')}</option>
              <option value="deepgram">{t(lang, 'deepgramOption')}</option>
            </select>
          </div>

          {/* Deepgram Key */}
          {localSettings.transcriptionMode === 'deepgram' && (
            <div className="form-group">
              <span className="form-label">{t(lang, 'deepgramKey')}</span>
              <input
                type="password"
                className="form-input"
                placeholder="Enter Deepgram Key"
                value={localSettings.deepgramKey}
                onChange={(e) => handleChange('deepgramKey', e.target.value)}
              />
              <span className="help-text">{t(lang, 'deepgramHelp')}</span>
            </div>
          )}

          {/* Language Selection */}
          <div className="form-group">
            <span className="form-label">{t(lang, 'conversationLanguage')}</span>
            <select
              className="form-select"
              value={localSettings.language}
              onChange={(e) => handleChange('language', e.target.value)}
            >
              <option value="en">🇺🇸 English</option>
              <option value="es">🇪🇸 Español</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="it">🇮🇹 Italiano</option>
              <option value="pt">🇧🇷 Português</option>
              <option value="zh">🇨🇳 中文</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn primary" onClick={() => onSave(localSettings)}>{t(lang, 'saveSettings')}</button>
          <button className="modal-btn secondary" onClick={onClose}>{t(lang, 'cancel')}</button>
        </div>
      </div>
    </div>
  );
}
