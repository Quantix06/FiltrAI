// App.jsx
import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { AudioSpeechManager } from './utils/audio';
import { FactCheckPipeline } from './utils/pipeline';
import { SPEAKER_COLORS, formatTime } from './utils/helpers';

// Import Components
import { Header } from './components/Header';
import { VisualizerCard } from './components/VisualizerCard';
import { SpeakersDashboard } from './components/SpeakersDashboard';
import { NewSpeakerPrompt } from './components/NewSpeakerPrompt';
import { TranscriptBubble } from './components/TranscriptBubble';
import { VerdictCard } from './components/VerdictCard';
import { RenameSpeakerModal } from './components/RenameSpeakerModal';
import { VerdictDetailsModal } from './components/VerdictDetailsModal';
import { TutorialModal } from './components/TutorialModal';
import { SettingsModal } from './components/SettingsModal';

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
  const [showTuto, setShowTuto] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Settings state
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('filtrai_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  // Data states
  const [transcripts, setTranscripts] = useState([]); // Array of { id, text, isFinal, speakerId, timestamp, status, claims }
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
      {/* Tuto side button */}
      <button className="tuto-side-btn" onClick={() => setShowTuto(true)} title="Afficher le guide">
        TUTO 💡
      </button>

      {/* Header */}
      <Header
        settings={settings}
        onExportSession={handleExportSession}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Mic Capture & Volume Visualizer */}
      <VisualizerCard
        canvasRef={canvasRef}
        isListening={isListening}
        listeningStatus={listeningStatus}
        activeEvaluations={activeEvaluations}
        onToggleListening={handleToggleListening}
      />

      {/* Speaker Dashboard */}
      <SpeakersDashboard
        detectedSpeakerIds={detectedSpeakerIds}
        speakersMap={speakersMap}
        onSpeakerClick={setSpeakerToRename}
        speakerColors={SPEAKER_COLORS}
      />

      {/* New Speaker Identification prompt */}
      <NewSpeakerPrompt
        prompt={newSpeakerPrompt}
        onConfirm={handleConfirmSpeakerName}
        onSkip={() => setNewSpeakerPrompt(null)}
      />

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
            verdicts.map(card => (
              <VerdictCard
                key={card.id}
                card={card}
                speakerColors={SPEAKER_COLORS}
                formatTime={formatTime}
                onClick={() => setSelectedCard(card)}
              />
            ))
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
              {transcripts.map(t => (
                <TranscriptBubble
                  key={t.id}
                  t={t}
                  speakersMap={speakersMap}
                  speakerColors={SPEAKER_COLORS}
                  formatTime={formatTime}
                />
              ))}
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
      <RenameSpeakerModal
        speaker={speakerToRename}
        onSave={(id, name) => {
          handleConfirmSpeakerName(id, name);
          setSpeakerToRename(null);
        }}
        onCancel={() => setSpeakerToRename(null)}
      />

      {/* Card Details Modal Drawer */}
      <VerdictDetailsModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
      />

      {/* Tutorial Modal Drawer */}
      {showTuto && (
        <TutorialModal onClose={() => setShowTuto(false)} />
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

export default App;
