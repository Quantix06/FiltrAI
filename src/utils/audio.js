// audio.js
// Manage browser audio capture, volume visualizer, and dual transcription (Web Speech API and Deepgram WebSocket).

export class AudioSpeechManager {
  constructor(settings, callbacks = {}) {
    this.settings = settings;
    this.callbacks = {
      onTranscript: callbacks.onTranscript || (() => {}), // (text, isFinal, speakerId)
      onStatusChange: callbacks.onStatusChange || (() => {}), // (statusString)
      onError: callbacks.onError || (() => {}), // (errorMsg)
    };

    this.mediaStream = null;
    this.audioContext = null;
    this.processor = null;
    this.analyser = null;
    
    // Deepgram socket
    this.dgSocket = null;
    this.isRecording = false;

    // Web Speech API
    this.recognition = null;
    this.shouldRestartWebSpeech = false;

    // Deepgram speaker tracking
    this.utteranceBuffer = '';
    this.utteranceSpeakerCounts = {};

    // Animation frame for canvas visualizer
    this.animationFrameId = null;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  async start() {
    if (this.isRecording) return;
    this.isRecording = true;
    this.callbacks.onStatusChange('Initializing microphone...');

    try {
      // 1. Explicitly request microphone authorization
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      
      this.callbacks.onStatusChange('Listening...');
      
      // Initialize Web Audio API for visualizer & raw PCM conversion (needed for Deepgram)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Analyser node for volume visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const isDeepgram = this.settings.transcriptionMode === 'deepgram';

      if (isDeepgram) {
        if (!this.settings.deepgramKey) {
          throw new Error('Deepgram API key is missing. Set it in Settings or switch to Web Speech.');
        }
        await this.startDeepgram(source);
      } else {
        await this.startWebSpeech();
      }

    } catch (err) {
      this.stop();
      console.error('Audio start error:', err);
      let userFriendlyMsg = err.message;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendlyMsg = 'Microphone permission denied. Please grant microphone access in your browser settings to use FiltrAI.';
      }
      this.callbacks.onError(userFriendlyMsg);
      this.callbacks.onStatusChange('Error: Mic blocked');
    }
  }

  // ── Web Speech API ─────────────────────────────────────────────────────────

  async startWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('Web Speech API is not supported in this browser. Please use Chrome/Safari or provide a Deepgram API Key.');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.settings.language === 'zh' ? 'zh-CN' : this.settings.language || 'en';
    this.shouldRestartWebSpeech = true;

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        // Send final chunk
        this.callbacks.onTranscript(finalTranscript.trim(), true, 0); // Web Speech doesn't diarize (speaker id 0)
      } else if (interimTranscript) {
        // Send interim chunk
        this.callbacks.onTranscript(interimTranscript.trim(), false, 0);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Web Speech error:', event.error);
      if (event.error === 'not-allowed') {
        this.callbacks.onError('Microphone permission blocked by browser.');
      }
    };

    this.recognition.onend = () => {
      // Auto restart Web Speech to simulate continuous listening
      if (this.isRecording && this.shouldRestartWebSpeech) {
        try {
          this.recognition.start();
        } catch (e) {
          console.warn('Web Speech auto-restart blocked:', e);
        }
      }
    };

    this.recognition.start();
  }

  // ── Deepgram WebSocket ──────────────────────────────────────────────────────

  async startDeepgram(audioSourceNode) {
    const language = this.settings.language || 'en';
    const queryParams = [
      'encoding=linear16',
      'sample_rate=16000',
      'channels=1',
      'model=nova-2',
      'language=' + language,
      'punctuate=true',
      'interim_results=true',
      'utterance_end_ms=2500',
      'smart_format=true',
      'vad_events=true',
      'diarize=true',
    ].join('&');

    const wsUrl = `wss://api.deepgram.com/v1/listen?${queryParams}`;
    this.dgSocket = new WebSocket(wsUrl, ['token', this.settings.deepgramKey]);
    
    this.dgSocket.onopen = () => {
      this.callbacks.onStatusChange('Listening (Deepgram)...');
      this.startAudioProcessor(audioSourceNode);
    };

    this.dgSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'UtteranceEnd') {
          // Deepgram completed an utterance block
          return;
        }

        const result = data.channel?.alternatives?.[0];
        if (!result || !result.transcript) return;

        const text = result.transcript.trim();
        const isFinal = data.is_final;
        const speech = data.speech_final;

        // Diarization: track speaker word counts in current utterance
        if (result.words?.length) {
          result.words.forEach(w => {
            if (w.speaker !== null && w.speaker !== undefined) {
              this.utteranceSpeakerCounts[w.speaker] = (this.utteranceSpeakerCounts[w.speaker] || 0) + 1;
            }
          });
        }

        const getDominantSpeaker = () => {
          const entries = Object.entries(this.utteranceSpeakerCounts);
          if (!entries.length) return 0;
          // Sort descending by word counts
          return parseInt(entries.sort((a, b) => b[1] - a[1])[0][0]);
        };

        if (!text) return;

        if (isFinal && speech) {
          // utterance complete: flush buffer + text
          const fullText = this.utteranceBuffer ? this.utteranceBuffer + ' ' + text : text;
          const speaker = getDominantSpeaker();
          this.utteranceBuffer = '';
          this.utteranceSpeakerCounts = {};
          this.callbacks.onTranscript(fullText.trim(), true, speaker);
        } else if (isFinal && !speech) {
          // intermediate final: accumulate text
          this.utteranceBuffer += (this.utteranceBuffer ? ' ' : '') + text;
          this.callbacks.onTranscript(this.utteranceBuffer.trim(), false, getDominantSpeaker());
        } else {
          // interim results
          const currentText = this.utteranceBuffer ? this.utteranceBuffer + ' ' + text : text;
          this.callbacks.onTranscript(currentText.trim(), false, getDominantSpeaker());
        }

      } catch (err) {
        console.error('Deepgram message parse error:', err);
      }
    };

    this.dgSocket.onerror = (err) => {
      console.error('Deepgram Socket Error:', err);
      this.callbacks.onError('Deepgram WebSocket failed. Check connection & API key.');
    };

    this.dgSocket.onclose = (event) => {
      console.log('Deepgram socket closed:', event.code, event.reason);
      if (event.code === 1008 || event.code === 1011) {
        this.callbacks.onError('Deepgram authentication failed. Check your API key.');
      }
      this.callbacks.onStatusChange('Deepgram disconnected');
    };
  }

  startAudioProcessor(audioSourceNode) {
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.dgSocket || this.dgSocket.readyState !== WebSocket.OPEN) return;

      const float32 = e.inputBuffer.getChannelData(0);

      // Convert float32 raw audio to int16 linear PCM for Deepgram
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
      }

      this.dgSocket.send(int16.buffer);
    };

    audioSourceNode.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  // ── Canvas Audio Visualizer ────────────────────────────────────────────────

  drawVisualizer(canvasElement) {
    if (!canvasElement) return;
    const canvasCtx = canvasElement.getContext('2d');
    const width = canvasElement.width;
    const height = canvasElement.height;

    const draw = () => {
      this.animationFrameId = requestAnimationFrame(draw);
      
      canvasCtx.clearRect(0, 0, width, height);
      
      if (!this.isRecording || !this.analyser) {
        // Draw flat line
        canvasCtx.lineWidth = 3;
        canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, height / 2);
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
        return;
      }

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);

      // Draw center visualizer bars or waves
      canvasCtx.fillStyle = 'rgba(11, 12, 16, 0.5)';
      canvasCtx.fillRect(0, 0, width, height);

      // Draw symmetrical glowing frequency bars
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const percent = dataArray[i] / 255;
        const barHeight = percent * height * 0.8;

        // Color gradient based on volume level
        const red = Math.floor(99 + percent * 156);
        const green = Math.floor(102 - percent * 50);
        const blue = Math.floor(241 + percent * 14);
        
        canvasCtx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${0.4 + percent * 0.6})`;
        canvasCtx.shadowBlur = percent * 8;
        canvasCtx.shadowColor = `rgb(${red}, ${green}, ${blue})`;

        // Symmetrical bars centered vertically
        const y = (height - barHeight) / 2;
        canvasCtx.fillRect(x, y, barWidth - 1, barHeight);

        x += barWidth;
      }
      canvasCtx.shadowBlur = 0; // reset
    };

    draw();
  }

  stop() {
    this.isRecording = false;
    this.shouldRestartWebSpeech = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn(e);
      }
      this.recognition = null;
    }

    if (this.dgSocket) {
      try {
        this.dgSocket.close();
      } catch (e) {
        console.warn(e);
      }
      this.dgSocket = null;
    }

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch (e) {
        console.warn(e);
      }
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        console.warn(e);
      }
      this.audioContext = null;
    }

    this.analyser = null;
    this.utteranceBuffer = '';
    this.utteranceSpeakerCounts = {};

    this.callbacks.onStatusChange('Inactive');
  }
}
