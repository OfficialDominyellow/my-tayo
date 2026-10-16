/**
 * Tayo Sound, BGM & Voice Manager
 * Web Audio API 신디사이저 기반 효과음/배경음악 및 Web Speech API 한/영 더빙
 */

export class SoundManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isEngineRunning: boolean = false;
  public muted: boolean = false;
  public isVoiceEnabled: boolean = true;

  // 배경음악 (BGM) 상태
  public isBgmPlaying: boolean = false;
  private bgmTimer: number | null = null;
  private bgmStep: number = 0;

  public init(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 신나는 꼬마버스 동요풍 배경음악 토글
  public toggleBgm(): boolean {
    this.init();
    if (this.isBgmPlaying) {
      this.stopBgm();
      return false;
    } else {
      this.startBgm();
      return true;
    }
  }

  public startBgm(): void {
    this.init();
    if (this.isBgmPlaying || this.muted) return;
    this.isBgmPlaying = true;
    this.bgmStep = 0;

    // 밝고 경쾌한 실로폰/오르골 멜로디 시퀀스 (C 메이저 동요 풍)
    const melody = [
      261.63, 329.63, 392.00, 523.25, // 도 미 솔 높은도
      440.00, 392.00, 329.63, 261.63, // 라 솔 미 도
      293.66, 349.23, 440.00, 392.00, // 레 파 라 솔
      329.63, 293.66, 261.63, 0,      // 미 레 도 (쉼표)
      392.00, 392.00, 440.00, 392.00, // 솔 솔 라 솔
      523.25, 493.88, 392.00, 0,      // 도 시 솔
      349.23, 329.63, 293.66, 392.00, // 파 미 레 솔
      523.25, 0, 523.25, 0            // 도! 도!
    ];

    const playNextNote = () => {
      if (!this.isBgmPlaying || !this.ctx || this.muted) return;
      const freq = melody[this.bgmStep % melody.length];
      this.bgmStep++;

      if (freq > 0) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
      }
    };

    this.bgmTimer = window.setInterval(playNextNote, 280);
  }

  public stopBgm(): void {
    this.isBgmPlaying = false;
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  // 빵빵! 경적 (F4 + A4 화음 2연타)
  public playHorn(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const playHonk = (time: number, duration: number) => {
      if (!this.ctx) return;
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

    playHonk(now, 0.16);
    playHonk(now + 0.20, 0.22);
  }

  // 엔진 부릉 사운드
  public startEngine(): void {
    this.init();
    if (!this.ctx || this.isEngineRunning || this.muted) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'triangle';
      this.engineOsc.frequency.setValueAtTime(50, this.ctx.currentTime);
      this.engineGain.gain.setValueAtTime(0.03, this.ctx.currentTime);

      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.isEngineRunning = true;
    } catch (e) {
      console.warn('Engine start failed:', e);
    }
  }

  // 속도에 따른 엔진 피치 조절
  public updateEngine(speedRatio: number): void {
    if (!this.ctx || !this.isEngineRunning || !this.engineOsc) return;
    const ratio = Math.max(0, Math.min(1, Math.abs(speedRatio)));
    const targetFreq = 50 + ratio * 75;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    if (this.engineGain) {
      const targetGain = 0.025 + ratio * 0.04;
      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    }
  }

  public stopEngine(): void {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
    }
    this.isEngineRunning = false;
  }

  // 문 열림 ("치익-")
  public playDoor(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const bufferSize = this.ctx.sampleRate * 0.35;
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
    filter.Q.setValueAtTime(2.2, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  // 칭찬 별 획득 소리 (도-미-솔-도 차임벨)
  public playStar(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = this.ctx.currentTime + idx * 0.075;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.3);
    });
  }

  // 학습 퀴즈 카드 터치음 (경쾌한 물방울 퐁!)
  public playPop(pitchMultiplier: number = 1.0): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const time = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380 * pitchMultiplier, time);
    osc.frequency.exponentialRampToValueAtTime(760 * pitchMultiplier, time + 0.11);

    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.12);
  }

  // 세차장 보글보글 물방울 소리
  public playCarWash(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    for (let i = 0; i < 6; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.08;
      const freq = 400 + Math.random() * 600;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.6, t + 0.07);

      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  // 통통 튕기는 충돌음 / 부드러운 재시도 알림음
  public playBoing(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const time = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(520, time + 0.12);
    osc.frequency.exponentialRampToValueAtTime(310, time + 0.26);

    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.26);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.26);
  }

  // 팡파레 축하음
  public playCelebration(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const chords = [
      { freqs: [523.25, 659.25, 783.99], time: 0.0, dur: 0.18 },
      { freqs: [587.33, 739.99, 880.00], time: 0.18, dur: 0.18 },
      { freqs: [659.25, 783.99, 1046.50], time: 0.36, dur: 0.45 }
    ];

    chords.forEach(c => {
      c.freqs.forEach(f => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = this.ctx.currentTime + c.time;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + c.dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + c.dur);
      });
    });
  }

  // 한국어 / 영어 TTS 음성
  public speak(text: string, lang: 'ko-KR' | 'en-US' = 'ko-KR'): void {
    if (!this.isVoiceEnabled || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = lang === 'en-US' ? 0.92 : 1.02;
      utterance.pitch = 1.2;

      const voices = window.speechSynthesis.getVoices();
      const prefix = lang.slice(0, 2);
      const matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS speak error:', e);
    }
  }

  // 🚨 경찰차 / 소방차 / 구급차 리얼 사이렌 사운드
  public playSiren(kind: 'police' | 'fire' | 'ambulance' = 'police'): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (kind === 'ambulance') {
      // 구급차: 삐-뽀-삐-뽀 (2음 교차 하이-로우 차임)
      osc.type = 'triangle';
      const tones = [780, 585, 780, 585, 780, 585];
      tones.forEach((freq, idx) => {
        osc.frequency.setValueAtTime(freq, now + idx * 0.28);
      });
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 1.68);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.7);
    } else if (kind === 'fire') {
      // 소방차: 애앵~애앵~ (길게 오르내리는 웨일 사이렌)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.55);
      osc.frequency.linearRampToValueAtTime(460, now + 1.1);
      osc.frequency.linearRampToValueAtTime(900, now + 1.65);
      osc.frequency.linearRampToValueAtTime(440, now + 2.1);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 2.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 2.15);
    } else {
      // 경찰차: 삐용삐용 빠른 옐프 사이렌
      osc.type = 'sine';
      for (let i = 0; i < 4; i++) {
        const t = now + i * 0.36;
        osc.frequency.setValueAtTime(560, t);
        osc.frequency.exponentialRampToValueAtTime(1020, t + 0.18);
        osc.frequency.exponentialRampToValueAtTime(560, t + 0.36);
      }
      gain.gain.setValueAtTime(0.17, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 1.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.46);
    }
  }

  // 💦 소방차 물대포 쏴아아! 분사 사운드
  public playWaterSplash(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const duration = 0.65;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1650, this.ctx.currentTime + duration);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  // 🏎️ F1 레이싱카 초고속 통과 배기음 (도플러 하이피치 부아아앙~)
  public playF1Passby(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';

    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.exponentialRampToValueAtTime(760, now + 0.35);
    osc1.frequency.exponentialRampToValueAtTime(340, now + 0.85);

    osc2.frequency.setValueAtTime(560, now);
    osc2.frequency.exponentialRampToValueAtTime(1520, now + 0.35);
    osc2.frequency.exponentialRampToValueAtTime(680, now + 0.85);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.85);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.86);
    osc2.stop(now + 0.86);
  }

  // 💖 병원 응급실 반짝반짝 치료 완료 하프 차임
  public playHealChime(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + idx * 0.065;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.002, t + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // 🎹 도레미 무지개 실로폰/피아노 맑은 종소리 합성음
  public playXylophoneNote(freq: number, duration: number = 0.55): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const oscFund = this.ctx.createOscillator();
    const oscHarm = this.ctx.createOscillator();
    const gainFund = this.ctx.createGain();
    const gainHarm = this.ctx.createGain();

    oscFund.type = 'sine';
    oscHarm.type = 'triangle';
    oscFund.frequency.setValueAtTime(freq, now);
    oscHarm.frequency.setValueAtTime(freq * 3.0, now); // 실로폰 특유의 배음

    gainFund.gain.setValueAtTime(0.28, now);
    gainFund.gain.exponentialRampToValueAtTime(0.001, now + duration);

    gainHarm.gain.setValueAtTime(0.09, now);
    gainHarm.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.35);

    oscFund.connect(gainFund);
    oscHarm.connect(gainHarm);
    gainFund.connect(this.ctx.destination);
    gainHarm.connect(this.ctx.destination);

    oscFund.start(now);
    oscHarm.start(now);
    oscFund.stop(now + duration);
    oscHarm.stop(now + duration * 0.36);
  }

  // ⛽ 주유소 꿀꺽꿀꺽 주유 & 초고속 충전 사운드
  public playRefuelGlug(stepRatio: number = 0.5): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const baseFreq = 260 + stepRatio * 460;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.09);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // 🔧 정비소 임팩트 렌치 위이잉-철컥! 사운드
  public playRepairWrench(): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.09;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520 + i * 95, t);
      osc.frequency.exponentialRampToValueAtTime(980 + i * 110, t + 0.07);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.005, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  // 📞 긴급출동 119 / 112 전화기 버튼 DTMF 다이얼 사운드
  public playDialTone(digit: number): void {
    this.init();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const dtmfMap: Record<number, [number, number]> = {
      1: [697, 1209],
      2: [697, 1336],
      3: [697, 1477],
      4: [770, 1209],
      5: [770, 1336],
      6: [770, 1477],
      7: [852, 1209],
      8: [852, 1336],
      9: [852, 1477],
      0: [941, 1336]
    };
    const [f1, f2] = dtmfMap[digit] || [697, 1209];

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(f1, now);
    osc2.frequency.setValueAtTime(f2, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.17);
    osc2.stop(now + 0.17);
  }
}

export const soundManager = new SoundManager();


