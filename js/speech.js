/**
 * Web Speech API Engine wrapper for Voice Task PWA
 * Handles microphone permissions, speech recognition events, and fallback
 */

class SpeechEngine {
  constructor({ onStart, onInterim, onFinal, onError, onEnd }) {
    this.onStart = onStart || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onFinal = onFinal || (() => {});
    this.onError = onError || (() => {});
    this.onEnd = onEnd || (() => {});

    this.recognition = null;
    this.isListening = false;
    this.finalTranscript = '';
    this.interimTranscript = '';

    this.init();
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API is not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'ru-RU';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.finalTranscript = '';
      this.interimTranscript = '';
      this.onStart();
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          this.finalTranscript += item[0].transcript + ' ';
        } else {
          interim += item[0].transcript;
        }
      }
      this.interimTranscript = interim;
      this.onInterim((this.finalTranscript + ' ' + this.interimTranscript).trim());
    };

    this.recognition.onerror = (event) => {
      console.error("SpeechRecognition error:", event.error);
      this.onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      const fullText = (this.finalTranscript + ' ' + this.interimTranscript).trim();
      this.onFinal(fullText);
      this.onEnd();
    };
  }

  start() {
    if (!this.recognition) return;
    try {
      this.finalTranscript = '';
      this.interimTranscript = '';
      this.recognition.start();
    } catch (e) {
      console.warn("Recognition already active or failed to start:", e);
    }
  }

  stop() {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch (e) {
      console.warn("Error stopping recognition:", e);
    }
  }

  abort() {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
      this.isListening = false;
    } catch (e) {
      console.warn("Error aborting recognition:", e);
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = { SpeechEngine };
}
