/**
 * Web Speech API Engine wrapper for Voice Task PWA
 * Multi-segment Push-to-Talk with Android pause auto-restart and echo deduplication
 */

class SpeechEngine {
  constructor({ onStart, onInterim, onFinal, onError, onEnd }) {
    this.onStart = onStart || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onFinal = onFinal || (() => {});
    this.onError = onError || (() => {});
    this.onEnd = onEnd || (() => {});

    this.currentRec = null;
    this.isPressing = false;
    this.savedSegments = [];
    this.activeSegment = '';
    this.restartTimeout = null;
    this.isFinalizing = false;
  }

  // Cleans up any stutter, duplicated words or repeated phrases (1-grams, N-grams, suffix echoes)
  static cleanRecognizedText(str) {
    if (!str || typeof str !== 'string') return '';
    let tokens = str.trim().split(/\s+/);

    const norm = (w) => w.toLowerCase().replace(/^[.,!?:;"'«»—\-]+|[.,!?:;"'«»—\-]+$/g, '');

    // 1. Remove consecutive identical tokens (1-grams): 'собак собак' -> 'собак'
    let out = [];
    for (let i = 0; i < tokens.length; i++) {
      const currNorm = norm(tokens[i]);
      const prevNorm = i > 0 ? norm(tokens[i - 1]) : '';
      if (i > 0 && currNorm && currNorm === prevNorm) {
        continue;
      }
      out.push(tokens[i]);
    }
    tokens = out;

    // 2. Remove any repeated n-gram phrase of length k (from k = floor(len/2) down to 2)
    let changed = true;
    while (changed) {
      changed = false;
      const len = tokens.length;
      for (let k = Math.floor(len / 2); k >= 2; k--) {
        for (let i = 0; i <= len - 2 * k; i++) {
          let match = true;
          for (let j = 0; j < k; j++) {
            if (norm(tokens[i + j]) !== norm(tokens[i + k + j])) {
              match = false;
              break;
            }
          }
          if (match) {
            tokens.splice(i + k, k);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    // 3. Suffix echo check: if the end of the tokens matches ANY earlier multi-word slice
    for (let suffixLen = Math.floor(tokens.length / 2); suffixLen >= 2; suffixLen--) {
      const suffixNorm = tokens.slice(tokens.length - suffixLen).map(t => norm(t)).join(' ');
      const restNorm = tokens.slice(0, tokens.length - suffixLen).map(t => norm(t)).join(' ');
      if (restNorm.includes(suffixNorm) && suffixNorm.length > 0) {
        tokens = tokens.slice(0, tokens.length - suffixLen);
        break;
      }
    }

    return tokens.join(' ').trim();
  }

  commitActiveSegment() {
    if (!this.activeSegment || !this.activeSegment.trim()) return;
    const chunk = this.activeSegment.trim();
    this.activeSegment = '';

    if (this.savedSegments.length > 0) {
      const last = this.savedSegments[this.savedSegments.length - 1];
      const lastLower = last.toLowerCase();
      const chunkLower = chunk.toLowerCase();

      // 1. If this chunk is identical or is a substring/echo of what was already saved
      if (lastLower === chunkLower || lastLower.endsWith(chunkLower) || lastLower.includes(chunkLower)) {
        return;
      }

      // 2. If this new chunk contains the previous chunk plus new words (cumulative)
      if (chunkLower.startsWith(lastLower) || chunkLower.includes(lastLower)) {
        this.savedSegments[this.savedSegments.length - 1] = chunk;
        return;
      }
    }

    this.savedSegments.push(chunk);
  }

  getCombinedTranscript() {
    const parts = [...this.savedSegments];
    if (this.activeSegment && this.activeSegment.trim()) {
      parts.push(this.activeSegment.trim());
    }
    return SpeechEngine.cleanRecognizedText(parts.join(' '));
  }

  start() {
    this.isPressing = true;
    this.savedSegments = [];
    this.activeSegment = '';
    this.isFinalizing = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.currentRec) {
      try {
        this.currentRec.onend = null;
        this.currentRec.onerror = null;
        this.currentRec.abort();
      } catch (e) {}
      this.currentRec = null;
    }

    this.startRecognitionSession();
  }

  startRecognitionSession() {
    if (!this.isPressing) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API is not supported in this browser.");
      this.onError("Speech recognition not supported");
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'ru-RU';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.onStart();
      const currentText = this.getCombinedTranscript();
      if (currentText) {
        this.onInterim(currentText);
      }
    };

    rec.onresult = (event) => {
      let fullText = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i] && event.results[i][0]) {
          fullText += event.results[i][0].transcript + ' ';
        }
      }
      this.activeSegment = fullText.trim();
      const combined = this.getCombinedTranscript();
      this.onInterim(combined);
    };

    rec.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        this.isPressing = false;
        this.onError('not-allowed');
        this.onEnd();
        return;
      }
      // Non-fatal errors like 'no-speech' will be handled on onend without aborting hold
    };

    rec.onend = () => {
      this.commitActiveSegment();
      this.currentRec = null;

      // MULTI-SEGMENT CONTINUATION:
      // If user is STILL holding the category button, Android speech paused after a word or silence.
      // Instantly restart listening for the remaining words without cutting off the user!
      if (this.isPressing) {
        const textSoFar = this.getCombinedTranscript();
        if (textSoFar) {
          this.onInterim(textSoFar);
        }
        this.restartTimeout = setTimeout(() => {
          if (this.isPressing) {
            this.startRecognitionSession();
          }
        }, 60);
      } else {
        this.finalizeRecording();
      }
    };

    this.currentRec = rec;
    try {
      rec.start();
    } catch (e) {
      console.warn("Error starting recognition, retrying:", e);
      if (this.isPressing) {
        this.restartTimeout = setTimeout(() => {
          if (this.isPressing) {
            try { rec.start(); } catch (err) {}
          }
        }, 100);
      }
    }
  }

  stop() {
    this.isPressing = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.currentRec) {
      try {
        this.currentRec.stop();
      } catch (e) {}
    }

    // Allow 220ms grace period for final onresult / onend event to commit
    setTimeout(() => {
      this.finalizeRecording();
    }, 220);
  }

  finalizeRecording() {
    if (this.isFinalizing) return;
    this.isFinalizing = true;
    setTimeout(() => { this.isFinalizing = false; }, 400);

    this.commitActiveSegment();

    const rawJoined = this.savedSegments.join(' ').trim();
    this.savedSegments = [];
    this.activeSegment = '';
    this.currentRec = null;

    const phrase = SpeechEngine.cleanRecognizedText(rawJoined);
    this.onFinal(phrase);
    this.onEnd();
  }

  abort() {
    this.isPressing = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    this.savedSegments = [];
    this.activeSegment = '';

    if (this.currentRec) {
      try {
        this.currentRec.onend = null;
        this.currentRec.onerror = null;
        this.currentRec.abort();
      } catch (e) {}
      this.currentRec = null;
    }

    this.onEnd();
  }
}

if (typeof module !== 'undefined') {
  module.exports = { SpeechEngine };
}
