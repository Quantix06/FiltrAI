// App.jsx
import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { AudioSpeechManager } from './utils/audio';
import { FactCheckPipeline } from './utils/pipeline';

const SPEAKER_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

const DEFAULT_SETTINGS = {
  provider: 'openrouter',
  openrouterKey: '',
  openrouterModel: 'cohere/north-mini-code:free',
  anthropicKey: '',
  anthropicModel: 'claude-haiku-4-5-20251001',
  deepgramKey: '',
  serperKey: '',
  transcriptionMode: 'webspeech',
  language: 'en',
};

function App() {
  // UI states
  const [activeTab, setActiveTab] = useState('verdicts'); // 'verdicts' or 'transcript'
  const [isListening, setIsListening] = useState(false);
  const [listeningStatus, setListeningStatus] = useState('Inactive');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Settings state
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('filtrai_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  // Data states
  const [transcripts, setTranscripts] = useState([]); // Array of { id, text, isFinal, speakerId, timestamp }
  const [interimTranscript, setInterimTranscript] = useState('');
  const [verdicts, setVerdicts] = useState([]); // Array of cards
  const [speakersMap, setSpeakersMap] = useState({}); // { id: name }
  const [detectedSpeakerIds, setDetectedSpeakerIds] = useState([]); // Array of IDs seen
  const [newSpeakerPrompt, setNewSpeakerPrompt] = useState(null); // { id, sample }
  const [speakerToRename, setSpeakerToRename] = useState(null); // { id, name }
  const [activeEvaluations, setActiveEvaluations] = useState(0);

  // Canvas visualizer reference
  const canvasRef = useRef(null);

  // References for managers
  const audioManagerRef = useRef(null);
  const pipelineRef = useRef(null);

  // Persistence of settings
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('filtrai_settings', JSON.stringify(newSettings));
    setShowSettings(false);

    // Update active instances if they exist
    if (audioManagerRef.current) {
      audioManagerRef.current.updateSettings(newSettings);
    }
    if (pipelineRef.current) {
      pipelineRef.current.updateSettings(newSettings);
    }
  };

  // Setup/Tear down pipeline
  useEffect(() => {
    pipelineRef.current = new FactCheckPipeline(settings, {
      onNewVerdict: (newCards) => {
        // Prepend new claims to the feed
        setVerdicts(prev => [...newCards, ...prev]);
      },
      onUpdateVerdicts: (updatedCards) => {
        // Merge updated/grounded claims
        setVerdicts(prev => prev.map(card => {
          const match = updatedCards.find(u => u.id === card.id);
          return match ? { ...card, ...match } : card;
        }));
      },
      onNewSpeaker: (id, sample) => {
        const sid = parseInt(id);
        setDetectedSpeakerIds(prev => {
          if (prev.includes(sid)) return prev;

          // Automatically add a default name to map
          setSpeakersMap(prevMap => {
            if (prevMap[sid]) return prevMap;
            return { ...prevMap, [sid]: `Speaker ${sid}` };
          });

          // Prompt user to customize the name
          setNewSpeakerPrompt({ id: sid, sample });
          return [...prev, sid];
        });
      },
      onError: (msg) => {
        setErrorMessage(msg);
      },
      onCheckingBubbles: (bubbleIds) => {
        setActiveEvaluations(prev => prev + 1);
        setTranscripts(prev => prev.map(t => {
          if (bubbleIds.includes(t.id)) {
            return { ...t, status: 'checking' };
          }
          return t;
        }));
      },
      onCheckComplete: (bubbleIds, claimsFound) => {
        setActiveEvaluations(prev => Math.max(0, prev - 1));
        setTranscripts(prev => prev.map(t => {
          if (bubbleIds.includes(t.id)) {
            const hasClaims = claimsFound && claimsFound.length > 0;
            return {
              ...t,
              status: hasClaims ? 'worthy' : 'not_worthy',
              claims: claimsFound || []
            };
          }
          return t;
        }));
      }
    });

    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.stop();
      }
    };
  }, []);

  // Sync settings updates to pipeline
  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.updateSettings(settings);
    }
  }, [settings]);

  // Connect visualizer canvas when state changes
  useEffect(() => {
    if (isListening && audioManagerRef.current && canvasRef.current) {
      audioManagerRef.current.drawVisualizer(canvasRef.current);
    }
  }, [isListening]);

  // Handle speaker renaming
  const handleConfirmSpeakerName = (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Register in map
    setSpeakersMap(prev => ({ ...prev, [id]: trimmed }));

    // Register in pipeline
    if (pipelineRef.current) {
      pipelineRef.current.registerSpeakerName(id, trimmed);
    }

    // Retroactively update speaker names in current lists
    setVerdicts(prev => prev.map(v => {
      if (v.dominantSpeakerId === id || parseInt(v.dominantSpeakerId) === id) {
        return { ...v, speaker: trimmed };
      }
      return v;
    }));

    setNewSpeakerPrompt(null);
  };

  // Toggle Listening
  const handleToggleListening = async () => {
    if (isListening) {
      // Stop listening
      if (audioManagerRef.current) {
        audioManagerRef.current.stop();
      }
      setIsListening(false);
      setInterimTranscript('');
    } else {
      // Start listening
      setErrorMessage('');
      setTranscripts([]);
      setInterimTranscript('');
      setVerdicts([]);
      setSpeakersMap({});
      setDetectedSpeakerIds([]);
      setNewSpeakerPrompt(null);
      setActiveEvaluations(0);

      if (pipelineRef.current) {
        pipelineRef.current.reset();
      }

      // Initialize speech manager
      audioManagerRef.current = new AudioSpeechManager(settings, {
        onTranscript: (text, isFinal, speakerId) => {
          if (isFinal) {
            setInterimTranscript('');
            const sid = speakerId !== null && speakerId !== undefined ? parseInt(speakerId) : 0;

            // Register speaker ID internally in case the pipeline event was skipped
            setDetectedSpeakerIds(prev => {
              if (!prev.includes(sid)) {
                setSpeakersMap(prevMap => ({
                  ...prevMap,
                  [sid]: prevMap[sid] || `Speaker ${sid}`
                }));
                return [...prev, sid];
              }
              return prev;
            });

            const bubbleId = 't_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            // Add transcript bubble
            setTranscripts(prev => [
              ...prev,
              {
                id: bubbleId,
                text,
                isFinal: true,
                speakerId: sid,
                timestamp: Date.now(),
                status: 'waiting'
              }
            ]);

            // Forward to fact-checking pipeline
            if (pipelineRef.current) {
              pipelineRef.current.handleNewSentence(text, sid, bubbleId);
            }
          } else {
            setInterimTranscript(text);
          }
        },
        onStatusChange: (status) => {
          setListeningStatus(status);
        },
        onError: (msg) => {
          setErrorMessage(msg);
        }
      });

      try {
        await audioManagerRef.current.start();
        setIsListening(true);
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  // Format timestamp helper
  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Export current session
  const handleExportSession = () => {
    if (transcripts.length === 0 && verdicts.length === 0) {
      alert('No data to export yet!');
      return;
    }

    const title = `FiltrAI Session — ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    let md = `# ${title}\n\n`;
    md += `## Settings\n`;
    md += `- Provider: ${settings.provider}\n`;
    md += `- Model: ${settings.provider === 'openrouter' ? settings.openrouterModel : settings.anthropicModel}\n`;
    md += `- Language: ${settings.language}\n`;
    md += `- Mode: ${settings.transcriptionMode}\n\n`;

    md += `## Transcription Log\n\n`;
    if (transcripts.length === 0) {
      md += `*No transcripts recorded.*\n\n`;
    } else {
      transcripts.forEach(t => {
        const name = speakersMap[t.speakerId] || `Speaker ${t.speakerId}`;
        md += `**[${formatTime(t.timestamp)}] ${name}**: ${t.text}\n\n`;
      });
    }

    md += `## Fact-Checks & Verdicts\n\n`;
    if (verdicts.length === 0) {
      md += `*No claims evaluated.*\n\n`;
    } else {
      verdicts.forEach((v, index) => {
        const name = v.speaker || speakersMap[v.dominantSpeakerId] || 'Unknown Speaker';
        md += `### ${index + 1}. Claim: "${v.claim}"\n`;
        md += `- **Speaker**: ${name}\n`;
        md += `- **Verdict**: ${v.verdict}\n`;
        md += `- **Explanation**: ${v.explanation}\n`;
        if (v.sources && v.sources.length > 0) {
          md += `- **Sources**: \n`;
          v.sources.forEach(src => {
            md += `  - [${src}](${src})\n`;
          });
        }
        md += `\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `filtrai-factcheck-session-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-container">
      {/* Header */}
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
          <button className="icon-btn" onClick={handleExportSession} title="Export Session">
            📥
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
            ⚙️
          </button>
        </div>
      </header>

      {/* Mic Capture & Volume Visualizer */}
      <section className="status-visualizer-card">
        <canvas
          ref={canvasRef}
          className="visualizer-canvas"
          width={400}
          height={48}
        />
        <div className="status-badge-row">
          <div className="status-indicator">
            <span className={`status-dot ${isListening ? 'listening' : ''}`} />
            <span>{listeningStatus}</span>
            <span className="lang-mini-badge">
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
          <button
            className={`control-btn ${isListening ? 'active' : ''}`}
            onClick={handleToggleListening}
          >
            {isListening ? 'Stop Checking' : 'Start Listening'}
          </button>
        </div>
        {activeEvaluations > 0 && (
          <div className="pipeline-loading-indicator animate-pulse">
            <span className="pulse-icon">🔍</span>
            <span>Analyse de pertinence IA en cours... Veuillez patienter</span>
          </div>
        )}
      </section>

      {/* Speaker Dashboard */}
      {detectedSpeakerIds.length > 0 && (
        <section className="speakers-dashboard">
          <div className="dashboard-title">Active Speakers (Tap to Rename)</div>
          <div className="speakers-row">
            {detectedSpeakerIds.map(sid => {
              const name = speakersMap[sid] || `Speaker ${sid}`;
              const color = SPEAKER_COLORS[sid % SPEAKER_COLORS.length];
              return (
                <div
                  key={sid}
                  className="speaker-pill"
                  onClick={() => setSpeakerToRename({ id: sid, name })}
                >
                  <span className="speaker-color-dot" style={{ backgroundColor: color }} />
                  <span>{name}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* New Speaker Identification prompt */}
      {newSpeakerPrompt && (
        <div className="speaker-prompt-banner">
          <div className="prompt-text">Who is speaking right now?</div>
          <div className="prompt-sample">"{newSpeakerPrompt.sample}..."</div>
          <div className="prompt-input-row">
            <input
              type="text"
              className="prompt-input"
              placeholder="e.g. Alice"
              id="speaker-name-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmSpeakerName(newSpeakerPrompt.id, e.target.value);
                }
              }}
            />
            <button
              className="prompt-btn"
              onClick={() => {
                const val = document.getElementById('speaker-name-input').value;
                handleConfirmSpeakerName(newSpeakerPrompt.id, val || `Speaker ${newSpeakerPrompt.id}`);
              }}
            >
              Save
            </button>
            <button
              className="prompt-btn skip"
              onClick={() => setNewSpeakerPrompt(null)}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Error Message banner */}
      {errorMessage && (
        <div className="error-toast">
          <span>⚠️ {errorMessage}</span>
          <button className="toast-close" onClick={() => setErrorMessage('')}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="view-tabs">
        <button
          className={`tab-btn ${activeTab === 'verdicts' ? 'active' : ''}`}
          onClick={() => setActiveTab('verdicts')}
        >
          Fact-Checks ({verdicts.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
          onClick={() => setActiveTab('transcript')}
        >
          Live Transcripts
        </button>
      </div>

      {/* Main Content Feed */}
      <main className="feed-content">
        {activeTab === 'verdicts' ? (
          /* Fact Checking list */
          verdicts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🛡️</span>
              <p className="empty-text">
                No claims evaluated yet.<br />
                Start listening to a conversation to identify and fact-check factual claims in real-time.
              </p>
            </div>
          ) : (
            verdicts.map(card => {
              const colorIndex = card.dominantSpeakerId !== null && card.dominantSpeakerId !== undefined
                ? parseInt(card.dominantSpeakerId)
                : 0;
              const spkColor = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];

              return (
                <div
                  key={card.id}
                  className={`verdict-card ${card.verdict.toLowerCase().replace(' ', '_')} ${card.pending ? 'pending' : ''}`}
                  onClick={() => setSelectedCard(card)}
                >
                  <div className="card-header-row">
                    <div className="speaker-tag-box">
                      <span className="speaker-color-dot" style={{ backgroundColor: spkColor }} />
                      <span>{card.speaker || 'Unknown'}</span>
                    </div>
                    <span className="card-verdict-badge">
                      {card.pending ? 'Verifying...' : card.verdict}
                    </span>
                  </div>
                  <div className="card-claim">"{card.claim}"</div>
                  <div className="card-explanation">{card.explanation}</div>
                  <div className="card-meta-row">
                    <span>{formatTime(card.timestamp)}</span>
                    {!card.pending && card.sources?.length > 0 && (
                      <span className="sources-count">📚 {card.sources.length} sources</span>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* Live transcripts list */
          transcripts.length === 0 && !interimTranscript ? (
            <div className="empty-state">
              <span className="empty-icon">💬</span>
              <p className="empty-text">
                No speech captured yet.<br />
                Speak into your microphone to view the real-time transcription feed.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {transcripts.map(t => {
                const name = speakersMap[t.speakerId] || `Speaker ${t.speakerId}`;
                const color = SPEAKER_COLORS[t.speakerId % SPEAKER_COLORS.length];

                return (
                  <div key={t.id} className={`transcript-bubble ${t.status || 'idle'}`}>
                    <div className="transcript-meta">
                      <span className="transcript-speaker" style={{ color }}>{name}</span>
                      <span className="transcript-time">{formatTime(t.timestamp)}</span>
                    </div>
                    <p className="transcript-text">{t.text}</p>
                    {t.status && t.status !== 'idle' && (
                      <div className={`bubble-status-badge ${t.status}`}>
                        {t.status === 'waiting' && (
                          <>
                            <span className="badge-icon pulse-soft">⏳</span>
                            <span>En attente de pertinence...</span>
                          </>
                        )}
                        {t.status === 'checking' && (
                          <>
                            <span className="badge-icon spin">🔍</span>
                            <span>Analyse de pertinence en cours (Attendre)...</span>
                          </>
                        )}
                        {t.status === 'worthy' && (
                          <>
                            <span className="badge-icon text-emerald">✅</span>
                            <span>Fait vérifiable détecté : "{t.claims?.join(', ')}"</span>
                          </>
                        )}
                        {t.status === 'not_worthy' && (
                          <>
                            <span className="badge-icon text-muted">⚠️</span>
                            <span>Contenu non vérifiable (sans affirmation factuelle)</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {interimTranscript && (
                <div className="transcript-bubble">
                  <div className="transcript-meta">
                    <span className="transcript-speaker" style={{ color: '#9ca3af' }}>Listening...</span>
                  </div>
                  <p className="transcript-text transcript-interim">"{interimTranscript}"</p>
                </div>
              )}
            </div>
          )
        )}
      </main>

      {/* Speaker Rename Modal Overlay */}
      {speakerToRename && (
        <div className="rename-dialog-overlay">
          <div className="rename-dialog">
            <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px' }}>
              Rename Speaker ID {speakerToRename.id}
            </h4>
            <input
              type="text"
              className="form-input"
              defaultValue={speakerToRename.name}
              id="rename-speaker-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmSpeakerName(speakerToRename.id, e.target.value);
                  setSpeakerToRename(null);
                }
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="prompt-btn"
                style={{ flex: 1 }}
                onClick={() => {
                  const val = document.getElementById('rename-speaker-input').value;
                  handleConfirmSpeakerName(speakerToRename.id, val);
                  setSpeakerToRename(null);
                }}
              >
                Save
              </button>
              <button
                className="prompt-btn skip"
                style={{ flex: 1 }}
                onClick={() => setSpeakerToRename(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Details Modal Drawer */}
      {selectedCard && (
        <div className="modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Fact-Check Details</span>
              <button className="icon-btn" onClick={() => setSelectedCard(null)}>×</button>
            </div>
            <div className="modal-body card-detail-content">
              <div className="form-group">
                <span className="form-label">Claim Statement</span>
                <p className="card-claim" style={{ fontSize: '15px' }}>"{selectedCard.claim}"</p>
              </div>

              <div className="detail-verdict-section">
                <span className="form-label">Verdict</span>
                <span
                  className="detail-verdict-value"
                  style={{
                    color: selectedCard.verdict === 'TRUE' || selectedCard.verdict === 'SUBSTANTIALLY TRUE' ? 'var(--color-true)' :
                      selectedCard.verdict === 'MISLEADING' ? 'var(--color-misleading)' :
                        selectedCard.verdict === 'FALSE' ? 'var(--color-false)' : 'var(--color-unverifiable)'
                  }}
                >
                  {selectedCard.verdict}
                </span>
              </div>

              <div className="form-group">
                <span className="form-label">Analysis & Explanation</span>
                <p className="card-explanation" style={{ fontSize: '14px' }}>{selectedCard.explanation}</p>
              </div>

              {!selectedCard.pending && selectedCard.sources?.length > 0 && (
                <div className="form-group">
                  <span className="form-label">Supporting Evidence & Sources</span>
                  <div className="sources-list">
                    {selectedCard.sources.map((src, i) => (
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
              <button className="modal-btn secondary" onClick={() => setSelectedCard(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal Drawer */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ── Settings Modal Component ──────────────────────────────────────────────────

function SettingsModal({ settings, onSave, onClose }) {
  const [localSettings, setLocalSettings] = useState({ ...settings });

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Fact-Checking Settings</span>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {/* AI Provider */}
          <div className="form-group">
            <span className="form-label">AI Fact-Check Provider</span>
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
                <span className="form-label">OpenRouter API Key</span>
                <input
                  type="password"
                  className="form-input"
                  placeholder="sk-or-..."
                  value={localSettings.openrouterKey}
                  onChange={(e) => handleChange('openrouterKey', e.target.value)}
                />
                <span className="help-text">Get your free or paid keys at openrouter.ai</span>
              </div>
              <div className="form-group">
                <span className="form-label">OpenRouter Model</span>
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
                <span className="form-label">Anthropic API Key</span>
                <input
                  type="password"
                  className="form-input"
                  placeholder="sk-ant-..."
                  value={localSettings.anthropicKey}
                  onChange={(e) => handleChange('anthropicKey', e.target.value)}
                />
              </div>
              <div className="form-group">
                <span className="form-label">Anthropic Model</span>
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
            <span className="form-label">Google Serper API Key</span>
            <input
              type="password"
              className="form-input"
              placeholder="Enter Serper API Key"
              value={localSettings.serperKey}
              onChange={(e) => handleChange('serperKey', e.target.value)}
            />
            <span className="help-text">Required for web search grounding. Get a free key at serper.dev</span>
          </div>

          {/* Transcription Mode */}
          <div className="form-group">
            <span className="form-label">Transcription Engine</span>
            <select
              className="form-select"
              value={localSettings.transcriptionMode}
              onChange={(e) => handleChange('transcriptionMode', e.target.value)}
            >
              <option value="webspeech">Web Speech API (Free / Built-in)</option>
              <option value="deepgram">Deepgram WebSocket (Requires Key)</option>
            </select>
          </div>

          {/* Deepgram Key */}
          {localSettings.transcriptionMode === 'deepgram' && (
            <div className="form-group">
              <span className="form-label">Deepgram API Key</span>
              <input
                type="password"
                className="form-input"
                placeholder="Enter Deepgram Key"
                value={localSettings.deepgramKey}
                onChange={(e) => handleChange('deepgramKey', e.target.value)}
              />
              <span className="help-text">Required for speaker diarization (separating Alice/Bob). Get a key at deepgram.com</span>
            </div>
          )}

          {/* Language Selection */}
          <div className="form-group">
            <span className="form-label">Conversation Language</span>
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
          <button className="modal-btn primary" onClick={() => onSave(localSettings)}>Save Settings</button>
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default App;
