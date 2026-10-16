/**
 * Tayo Sound & Voice Manager
 * Web Audio API를 이용한 귀여운 효과음 생성 및 브라우저 한국어 음성(TTS) 지원
 */
class SoundManager {
    constructor() {
        this.ctx = null;
        this.engineOsc = null;
        this.engineGain = null;
        this.isEngineRunning = false;
        this.muted = false;
        this.isVoiceEnabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // 경적 소리 (빵빵!)
    playHorn() {
        this.init();
        if (this.muted) return;

        const now = this.ctx.currentTime;
        const playHonk = (time, duration) => {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc1.type = 'sawtooth';
            osc2.type = 'triangle';
            osc1.frequency.setValueAtTime(349.23, time); // F4
            osc2.frequency.setValueAtTime(440.00, time); // A4

            gain.gain.setValueAtTime(0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.ctx.destination);

            osc1.start(time);
            osc2.start(time);
            osc1.stop(time + duration);
            osc2.stop(time + duration);
        };

        // "빵-빵!" 두 번 울림
        playHonk(now, 0.18);
        playHonk(now + 0.22, 0.25);
    }

    // 엔진 소리 시작
    startEngine() {
        this.init();
        if (this.isEngineRunning || this.muted) return;

        try {
            this.engineOsc = this.ctx.createOscillator();
            this.engineGain = this.ctx.createGain();

            this.engineOsc.type = 'triangle';
            this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // 낮은 부릉 소리

            this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

            this.engineOsc.connect(this.engineGain);
            this.engineGain.connect(this.ctx.destination);

            this.engineOsc.start();
            this.isEngineRunning = true;
        } catch (e) {
            console.warn('Engine sound error:', e);
        }
    }

    // 속도에 따른 엔진 피치 조절
    updateEngine(speedRatio) {
        if (!this.isEngineRunning || !this.engineOsc) return;
        const clamped = Math.max(0, Math.min(1, Math.abs(speedRatio)));
        const targetFreq = 55 + clamped * 85; // 55Hz ~ 140Hz
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
        if (this.engineGain) {
            const targetGain = 0.03 + clamped * 0.05;
            this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
        }
    }

    stopEngine() {
        if (this.engineOsc) {
            try {
                this.engineOsc.stop();
                this.engineOsc.disconnect();
            } catch (e) {}
            this.engineOsc = null;
        }
        this.isEngineRunning = false;
    }

    // 버스 문 열림/닫힘 소리 ("치익-")
    playDoor() {
        this.init();
        if (this.muted) return;

        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
        filter.Q.setValueAtTime(2.5, this.ctx.currentTime);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start();
    }

    // 칭찬 별 / 미션 성공 소리 (도-미-솔-도 맑은 차임벨)
    playStar() {
        this.init();
        if (this.muted) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const time = this.ctx.currentTime + idx * 0.09;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.22, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(time);
            osc.stop(time + 0.35);
        });
    }

    // 통통 튕기는 귀여운 충돌음
    playBoing() {
        this.init();
        if (this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const time = this.ctx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, time);
        osc.frequency.exponentialRampToValueAtTime(580, time + 0.15);
        osc.frequency.exponentialRampToValueAtTime(330, time + 0.3);

        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.3);
    }

    // 브레이크 끼익 소리
    playBrake() {
        this.init();
        if (this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const time = this.ctx.currentTime;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1800, time);
        osc.frequency.linearRampToValueAtTime(900, time + 0.25);

        gain.gain.setValueAtTime(0.07, time);
        gain.gain.exponentialRampToValueAtTime(0.005, time + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.25);
    }

    // 미션 완료 축하 팡파레
    playCelebration() {
        this.init();
        if (this.muted) return;

        const chords = [
            { freqs: [523.25, 659.25, 783.99], time: 0.0, dur: 0.2 }, // C
            { freqs: [587.33, 739.99, 880.00], time: 0.2, dur: 0.2 }, // D
            { freqs: [659.25, 783.99, 1046.50], time: 0.4, dur: 0.5 } // High C
        ];

        chords.forEach(c => {
            c.freqs.forEach(f => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const start = this.ctx.currentTime + c.time;

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, start);

                gain.gain.setValueAtTime(0.15, start);
                gain.gain.exponentialRampToValueAtTime(0.001, start + c.dur);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(start);
                osc.stop(start + c.dur);
            });
        });
    }

    // 한국어 음성 안내 (브라우저 내장 TTS)
    speak(text) {
        if (!this.isVoiceEnabled || !('speechSynthesis' in window)) return;

        try {
            window.speechSynthesis.cancel(); // 이전 발화 취소
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            utterance.rate = 1.05; // 살짝 경쾌한 속도
            utterance.pitch = 1.25; // 5살 아이가 친근하게 느끼는 밝은 목소리

            // 한국어 음성 선택
            const voices = window.speechSynthesis.getVoices();
            const koVoice = voices.find(v => v.lang.startsWith('ko'));
            if (koVoice) {
                utterance.voice = koVoice;
            }

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn('TTS speak error:', e);
        }
    }
}

window.soundManager = new SoundManager();

