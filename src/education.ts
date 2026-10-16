import { soundManager } from './sound';

export type EduCategory = 'all' | 'hangul' | 'number' | 'english';
export type EduGameMode = 'quiz' | 'trace' | 'match';

interface QuizQuestion {
  category: 'hangul' | 'number' | 'english';
  mode: 'quiz';
  title: string;
  voicePrompt: string;
  showcaseItems?: string[]; // 숫자 세기용 상단 아이콘 배열
  options: {
    label: string;
    subLabel: string;
    emoji: string;
    voiceText: string;
    voiceLang?: 'ko-KR' | 'en-US';
    isCorrect: boolean;
  }[];
}

interface TraceActivity {
  category: 'hangul' | 'number' | 'english';
  mode: 'trace';
  char: string;
  name: string;
  wordExample: string;
  emoji: string;
  voicePrompt: string;
  // 0~1 정규화 좌표 스트로크 경로들
  strokes: { x: number; y: number }[][];
}

interface MatchActivity {
  category: 'hangul' | 'number' | 'english';
  mode: 'match';
  title: string;
  voicePrompt: string;
  pairs: {
    id: string;
    leftEmoji: string;
    leftLabel: string;
    rightText: string;
    rightSub: string;
    voiceText: string;
  }[];
}

type EduActivity = QuizQuestion | TraceActivity | MatchActivity;

const EDU_ACTIVITIES: EduActivity[] = [
  // ==================== 한글 놀이 (퀴즈, 따라쓰기, 선긋기) ====================
  {
    category: 'hangul',
    mode: 'quiz',
    title: '🚌 [한글] "버"로 시작하는 꼬마버스는 어디 있을까요?',
    voicePrompt: '부릉부릉! 버로 시작하는 버스는 어디 있을까요? 그림을 눌러보세요!',
    options: [
      { emoji: '🚌', label: '버스', subLabel: '부릉부릉 버스', voiceText: '버스! 맞았어요! 부릉부릉 버스!', isCorrect: true },
      { emoji: '🍎', label: '사과', subLabel: '빨간 사과', voiceText: '사과! 이건 아삭아삭 사과예요. 버스를 찾아볼까요?', isCorrect: false },
      { emoji: '🍌', label: '바나나', subLabel: '노란 바나나', voiceText: '바나나! 이건 달콤한 바나나예요. 버스를 찾아볼까요?', isCorrect: false }
    ]
  },
  {
    category: 'hangul',
    mode: 'quiz',
    title: '🍎 [한글] 아삭아삭 빨간 "사과"를 찾아 눌러보세요!',
    voicePrompt: '아삭아삭 맛있는 빨간 사과를 찾아 눌러보세요!',
    options: [
      { emoji: '🐶', label: '강아지', subLabel: '멍멍 강아지', voiceText: '강아지! 귀여운 강아지네요. 사과를 찾아볼까요?', isCorrect: false },
      { emoji: '🍎', label: '사과', subLabel: '빨간 사과', voiceText: '사과! 우와 맞았어요! 맛있는 사과!', isCorrect: true },
      { emoji: '🐘', label: '코끼리', subLabel: '코가 긴 코끼리', voiceText: '코끼리! 멋진 코끼리네요. 사과를 찾아볼까요?', isCorrect: false }
    ]
  },
  {
    category: 'hangul',
    mode: 'quiz',
    title: '🐶 [한글] 멍멍! 귀여운 "강아지"는 어디 있을까요?',
    voicePrompt: '멍멍! 귀여운 강아지는 어디 있을까요?',
    options: [
      { emoji: '🐶', label: '강아지', subLabel: '멍멍!', voiceText: '강아지! 딩동댕! 귀여운 강아지예요!', isCorrect: true },
      { emoji: '🐸', label: '개구리', subLabel: '개굴개굴!', voiceText: '개구리! 개굴개굴 개구리네요!', isCorrect: false },
      { emoji: '🍓', label: '딸기', subLabel: '새콤달콤 딸기', voiceText: '딸기! 맛있는 딸기네요!', isCorrect: false }
    ]
  },
  {
    category: 'hangul',
    mode: 'trace',
    char: 'ㄱ',
    name: '기역',
    wordExample: '🐶 강아지 · 🚂 기차',
    emoji: '🐶',
    voicePrompt: '한글 기역! 손가락이나 마우스로 반짝이는 길을 따라 쓱싹 그려보세요!',
    strokes: [
      [
        { x: 0.25, y: 0.28 },
        { x: 0.5, y: 0.28 },
        { x: 0.72, y: 0.28 },
        { x: 0.72, y: 0.52 },
        { x: 0.72, y: 0.76 }
      ]
    ]
  },
  {
    category: 'hangul',
    mode: 'trace',
    char: 'ㄴ',
    name: '니은',
    wordExample: '🦋 나비 · 🌳 나무',
    emoji: '🦋',
    voicePrompt: '한글 니은! 위에서 아래로, 오른쪽으로 쓱싹 따라 그려보세요!',
    strokes: [
      [
        { x: 0.28, y: 0.24 },
        { x: 0.28, y: 0.50 },
        { x: 0.28, y: 0.74 },
        { x: 0.52, y: 0.74 },
        { x: 0.75, y: 0.74 }
      ]
    ]
  },
  {
    category: 'hangul',
    mode: 'match',
    title: '🔗 [한글 선긋기] 그림과 같은 글자를 짝지어 주세요!',
    voicePrompt: '그림을 누르고 같은 글자를 눌러 선으로 이어주세요!',
    pairs: [
      { id: 'bus', leftEmoji: '🚌', leftLabel: '부릉부릉', rightText: '버스', rightSub: 'ㅂ ㅓ ㅅ ㅡ', voiceText: '버스! 참 잘했어요!' },
      { id: 'apple', leftEmoji: '🍎', leftLabel: '아삭아삭', rightText: '사과', rightSub: 'ㅅ ㅏ ㄱ ㅘ', voiceText: '사과! 짝짝짝!' }
    ]
  },

  // ==================== 숫자 놀이 (퀴즈, 따라쓰기, 선긋기) ====================
  {
    category: 'number',
    mode: 'quiz',
    title: '🍓 [숫자 세기] 딸기가 모두 몇 개일까요? (하나, 둘, 셋!)',
    voicePrompt: '딸기가 몇 개 있는지 세어볼까요? 하나, 둘, 셋! 숫자 3을 눌러보세요!',
    showcaseItems: ['🍓', '🍓', '🍓'],
    options: [
      { emoji: '⭐', label: '1', subLabel: '하나 (일)', voiceText: '숫자 일! 하나! 딸기는 세 개예요!', isCorrect: false },
      { emoji: '⭐⭐', label: '2', subLabel: '둘 (이)', voiceText: '숫자 이! 둘! 딸기는 세 개예요!', isCorrect: false },
      { emoji: '⭐⭐⭐', label: '3', subLabel: '셋 (삼)', voiceText: '숫자 삼! 셋! 맞았어요, 딸기가 세 개예요!', isCorrect: true }
    ]
  },
  {
    category: 'number',
    mode: 'quiz',
    title: '🚌 [숫자 세기] 꼬마버스가 몇 대 있을까요? (하나, 둘!)',
    voicePrompt: '꼬마버스가 몇 대 있을까요? 하나, 둘! 숫자 2를 찾아 눌러보세요!',
    showcaseItems: ['🚌', '🚌'],
    options: [
      { emoji: '⭐', label: '1', subLabel: '하나 (일)', voiceText: '숫자 일! 하나!', isCorrect: false },
      { emoji: '⭐⭐', label: '2', subLabel: '둘 (이)', voiceText: '숫자 이! 둘! 딩동댕 정답이에요!', isCorrect: true },
      { emoji: '⭐⭐⭐⭐', label: '4', subLabel: '넷 (사)', voiceText: '숫자 사! 넷!', isCorrect: false }
    ]
  },
  {
    category: 'number',
    mode: 'quiz',
    title: '🍎 [숫자 세기] 사과가 모두 몇 개일까요? (하나, 둘, 셋, 넷!)',
    voicePrompt: '사과가 몇 개인지 같이 세어봐요! 하나, 둘, 셋, 넷! 숫자 4를 눌러보세요!',
    showcaseItems: ['🍎', '🍎', '🍎', '🍎'],
    options: [
      { emoji: '⭐⭐', label: '2', subLabel: '둘 (이)', voiceText: '숫자 이! 둘!', isCorrect: false },
      { emoji: '⭐⭐⭐', label: '3', subLabel: '셋 (삼)', voiceText: '숫자 삼! 셋!', isCorrect: false },
      { emoji: '⭐⭐⭐⭐', label: '4', subLabel: '넷 (사)', voiceText: '숫자 사! 넷! 우와 정말 잘 세었어요!', isCorrect: true }
    ]
  },
  {
    category: 'number',
    mode: 'trace',
    char: '1',
    name: '숫자 1 (하나)',
    wordExample: '🚌 버스 1대',
    emoji: '1️⃣',
    voicePrompt: '숫자 일! 위에서 아래로 쭉 내려 그어보세요!',
    strokes: [
      [
        { x: 0.5, y: 0.2 },
        { x: 0.5, y: 0.4 },
        { x: 0.5, y: 0.6 },
        { x: 0.5, y: 0.8 }
      ]
    ]
  },
  {
    category: 'number',
    mode: 'trace',
    char: '2',
    name: '숫자 2 (둘)',
    wordExample: '🐰🐰 토끼 2마리',
    emoji: '2️⃣',
    voicePrompt: '숫자 이! 오리 모양처럼 둥글게 내려와서 옆으로 쓱 그어보세요!',
    strokes: [
      [
        { x: 0.3, y: 0.32 },
        { x: 0.5, y: 0.2 },
        { x: 0.7, y: 0.34 },
        { x: 0.52, y: 0.56 },
        { x: 0.3, y: 0.76 },
        { x: 0.52, y: 0.76 },
        { x: 0.74, y: 0.76 }
      ]
    ]
  },
  {
    category: 'number',
    mode: 'match',
    title: '🔗 [숫자 선긋기] 별의 개수와 알맞은 숫자를 이어주세요!',
    voicePrompt: '별이 몇 개인지 세어보고 알맞은 숫자와 연결해 보세요!',
    pairs: [
      { id: 'one', leftEmoji: '⭐', leftLabel: '하나!', rightText: '1', rightSub: '하나 (일)', voiceText: '하나! 숫자 일!' },
      { id: 'two', leftEmoji: '⭐⭐', leftLabel: '하나, 둘!', rightText: '2', rightSub: '둘 (이)', voiceText: '둘! 숫자 이!' }
    ]
  },

  // ==================== 영어 놀이 (퀴즈, 따라쓰기, 선긋기) ====================
  {
    category: 'english',
    mode: 'quiz',
    title: '🍎 [영어 놀이] A는 Apple(애플)! 사과 카드를 눌러보세요!',
    voicePrompt: '에이! 애플! 맛있는 사과, 애플 카드를 눌러보세요!',
    options: [
      { emoji: '🍎', label: 'A · Apple', subLabel: '애플 (사과)', voiceText: 'Apple', voiceLang: 'en-US', isCorrect: true },
      { emoji: '🐻', label: 'B · Bear', subLabel: '베어 (곰)', voiceText: 'Bear', voiceLang: 'en-US', isCorrect: false },
      { emoji: '🐱', label: 'C · Cat', subLabel: '캣 (고양이)', voiceText: 'Cat', voiceLang: 'en-US', isCorrect: false }
    ]
  },
  {
    category: 'english',
    mode: 'quiz',
    title: '🚌 [영어 놀이] B는 Bus(버스)! 버스 카드를 눌러보세요!',
    voicePrompt: '비! 버스! 타요 버스 카드를 찾아 눌러보세요!',
    options: [
      { emoji: '🐶', label: 'D · Dog', subLabel: '도그 (강아지)', voiceText: 'Dog', voiceLang: 'en-US', isCorrect: false },
      { emoji: '🚌', label: 'B · Bus', subLabel: '버스 (자동차)', voiceText: 'Bus', voiceLang: 'en-US', isCorrect: true },
      { emoji: '⭐', label: 'S · Star', subLabel: '스타 (별)', voiceText: 'Star', voiceLang: 'en-US', isCorrect: false }
    ]
  },
  {
    category: 'english',
    mode: 'quiz',
    title: '🐶 [영어 놀이] D는 Dog(도그)! 강아지 카드를 눌러보세요!',
    voicePrompt: '디! 도그! 멍멍 강아지 카드를 찾아 눌러보세요!',
    options: [
      { emoji: '🐶', label: 'D · Dog', subLabel: '도그 (강아지)', voiceText: 'Dog', voiceLang: 'en-US', isCorrect: true },
      { emoji: '🍎', label: 'A · Apple', subLabel: '애플 (사과)', voiceText: 'Apple', voiceLang: 'en-US', isCorrect: false },
      { emoji: '🐸', label: 'F · Frog', subLabel: '프로그 (개구리)', voiceText: 'Frog', voiceLang: 'en-US', isCorrect: false }
    ]
  },
  {
    category: 'english',
    mode: 'trace',
    char: 'O',
    name: '알파벳 O (오)',
    wordExample: '🍊 Orange (오렌지)',
    emoji: '🍊',
    voicePrompt: '영어 알파벳 오! 동그라미를 크게 쓱싹 그려보세요!',
    strokes: [
      [
        { x: 0.5, y: 0.2 },
        { x: 0.72, y: 0.34 },
        { x: 0.72, y: 0.66 },
        { x: 0.5, y: 0.8 },
        { x: 0.28, y: 0.66 },
        { x: 0.28, y: 0.34 },
        { x: 0.5, y: 0.2 }
      ]
    ]
  },
  {
    category: 'english',
    mode: 'match',
    title: '🔗 [영어 선긋기] 동물 친구들과 영어 이름을 이어주세요!',
    voicePrompt: '멍멍 강아지는 도그! 야옹 고양이는 캣! 짝꿍을 찾아 이어주세요!',
    pairs: [
      { id: 'dog', leftEmoji: '🐶', leftLabel: '멍멍 강아지', rightText: 'DOG', rightSub: '도그 (D-O-G)', voiceText: '도그! 강아지!' },
      { id: 'cat', leftEmoji: '🐱', leftLabel: '야옹 고양이', rightText: 'CAT', rightSub: '캣 (C-A-T)', voiceText: '캣! 고양이!' }
    ]
  }
];

export class EducationManager {
  private modalEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private passengerBadgeEl: HTMLElement | null = null;

  public isOpen: boolean = false;
  public selectedCategory: EduCategory = 'all';
  private activityIndex: number = 0;
  private onCompleteCallback: ((starsEarned: number) => void) | null = null;
  private animFrameId: number | null = null;

  public init(): void {
    this.modalEl = document.getElementById('edu-modal');
    this.bodyEl = document.getElementById('edu-body');
    this.titleEl = document.getElementById('edu-title');
    this.passengerBadgeEl = document.getElementById('edu-passenger-badge');

    // 카테고리 필터 탭 이벤트
    document.querySelectorAll('.edu-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat') as EduCategory | null;
        if (cat) {
          this.selectedCategory = cat;
          document.querySelectorAll('.edu-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          soundManager.playPop(1.1);
          this.renderCurrentActivity();
        }
      });
    });

    // 다시 듣기 버튼
    const btnReplayVoice = document.getElementById('btn-edu-voice');
    if (btnReplayVoice) {
      btnReplayVoice.addEventListener('click', () => {
        const act = this.getCurrentActivity();
        if (act) soundManager.speak(act.voicePrompt);
      });
    }

    // 건너뛰기 / 바로 출발 버튼 (아이들이 운전만 하고 싶을 때 언제든 닫기 가능)
    const btnSkip = document.getElementById('btn-edu-skip');
    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        this.close(1);
      });
    }
  }

  private getFilteredActivities(): EduActivity[] {
    if (this.selectedCategory === 'all') return EDU_ACTIVITIES;
    return EDU_ACTIVITIES.filter(a => a.category === this.selectedCategory);
  }

  private getCurrentActivity(): EduActivity {
    const list = this.getFilteredActivities();
    return list[this.activityIndex % list.length];
  }

  /**
   * 승객 탑승 시 또는 상단 '놀이학습' 버튼 클릭 시 호출
   */
  public openMissionActivity(
    passengerInfo: { icon: string; name: string; targetStopName: string } | null,
    onComplete: (starsEarned: number) => void
  ): void {
    if (!this.modalEl || !this.bodyEl) return;

    this.isOpen = true;
    this.onCompleteCallback = onComplete;
    this.modalEl.classList.remove('hidden');

    if (this.passengerBadgeEl) {
      if (passengerInfo) {
        this.passengerBadgeEl.innerHTML = `${passengerInfo.icon} <strong>${passengerInfo.name}</strong> 손님: "<strong>${passengerInfo.targetStopName}</strong>(으)로 출발하기 전에 재미있는 놀이 하나 해볼까요?"`;
      } else {
        this.passengerBadgeEl.innerHTML = `🚌 <strong>타요의 신나는 한글 · 숫자 · 영어 교실!</strong>`;
      }
    }

    this.renderCurrentActivity();
  }

  public close(starsEarned: number = 2): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isOpen = false;
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
    this.activityIndex++;
    if (this.onCompleteCallback) {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb(starsEarned);
    }
  }

  private renderCurrentActivity(): void {
    if (!this.bodyEl || !this.titleEl) return;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const act = this.getCurrentActivity();
    soundManager.speak(act.voicePrompt);

    if (act.mode === 'quiz') {
      this.renderQuiz(act);
    } else if (act.mode === 'trace') {
      this.renderTrace(act);
    } else if (act.mode === 'match') {
      this.renderMatch(act);
    }
  }

  /**
   * 1. 4세용 큼직한 그림·글자 터치 퀴즈
   */
  private renderQuiz(q: QuizQuestion): void {
    if (!this.bodyEl || !this.titleEl) return;
    this.titleEl.textContent = q.title;
    this.bodyEl.innerHTML = '';

    // 숫자 세기인 경우 상단에 클릭하며 하나, 둘, 셋 셀 수 있는 큰 과일/버스 아이콘 표시
    if (q.showcaseItems && q.showcaseItems.length > 0) {
      const countRow = document.createElement('div');
      countRow.className = 'edu-showcase-row';
      const korNums = ['하나!', '둘!', '셋!', '넷!', '다섯!'];
      q.showcaseItems.forEach((itemEmoji, idx) => {
        const itemBtn = document.createElement('button');
        itemBtn.className = 'edu-showcase-item';
        itemBtn.innerHTML = `<span>${itemEmoji}</span><small>${idx + 1}</small>`;
        itemBtn.addEventListener('click', () => {
          itemBtn.classList.add('counted');
          soundManager.playPop(1 + idx * 0.15);
          soundManager.speak(korNums[idx] || `${idx + 1}`);
        });
        countRow.appendChild(itemBtn);
      });
      this.bodyEl.appendChild(countRow);
    }

    // 선택지 카드 그리드
    const grid = document.createElement('div');
    grid.className = 'edu-quiz-grid';

    q.options.forEach(opt => {
      const card = document.createElement('button');
      card.className = 'edu-quiz-card';
      card.innerHTML = `
        <div class="edu-card-emoji">${opt.emoji}</div>
        <div class="edu-card-label">${opt.label}</div>
        <div class="edu-card-sub">${opt.subLabel}</div>
      `;

      card.addEventListener('click', () => {
        if (opt.isCorrect) {
          card.classList.add('correct');
          soundManager.playCelebration();
          if (opt.voiceLang === 'en-US') {
            soundManager.speak(opt.voiceText, 'en-US');
            setTimeout(() => soundManager.speak('우와! 정답이에요! 참 잘했어요!'), 900);
          } else {
            soundManager.speak(opt.voiceText, 'ko-KR');
          }
          this.showSuccessAndClose(card);
        } else {
          // 4세 아이가 스트레스 받지 않도록 부드럽게 흔들리며 친절하게 읽어줌
          card.classList.add('gentle-shake');
          soundManager.playBoing();
          soundManager.speak(opt.voiceText, opt.voiceLang || 'ko-KR');
          setTimeout(() => card.classList.remove('gentle-shake'), 600);
        }
      });

      grid.appendChild(card);
    });

    this.bodyEl.appendChild(grid);
  }

  /**
   * 2. 4세용 무지개 손가락 따라쓰기 (매우 넉넉한 판정 + 타요 가이드 애니메이션)
   */
  private renderTrace(t: TraceActivity): void {
    if (!this.bodyEl || !this.titleEl) return;
    this.titleEl.textContent = `✏️ [따라쓰기] "${t.name}"을(를) 손가락으로 쓱싹 따라 그려봐요!`;
    this.bodyEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'edu-trace-wrap';

    // 왼쪽 단어 카드
    const infoCard = document.createElement('div');
    infoCard.className = 'edu-trace-info';
    infoCard.innerHTML = `
      <div class="edu-trace-big-char">${t.char}</div>
      <div class="edu-trace-emoji">${t.emoji}</div>
      <div class="edu-trace-word">${t.wordExample}</div>
      <button class="edu-magic-complete-btn" id="btn-auto-trace">✨ 타요랑 같이 색칠하기!</button>
    `;
    wrap.appendChild(infoCard);

    // 오른쪽 따라쓰기 캔버스
    const canvasBox = document.createElement('div');
    canvasBox.className = 'edu-trace-canvas-box';
    const canvas = document.createElement('canvas');
    canvas.width = 340;
    canvas.height = 340;
    canvas.className = 'edu-trace-canvas';
    canvasBox.appendChild(canvas);
    wrap.appendChild(canvasBox);

    this.bodyEl.appendChild(wrap);

    const ctx = canvas.getContext('2d')!;
    const points: { x: number; y: number; painted: boolean }[] = [];

    // 스트로크 세분화 포인트 생성 (촘촘하게 배치하여 4세 아이가 스치기만 해도 색칠됨)
    t.strokes.forEach(stroke => {
      for (let i = 0; i < stroke.length - 1; i++) {
        const p1 = stroke[i];
        const p2 = stroke[i + 1];
        const steps = 10;
        for (let s = 0; s <= steps; s++) {
          const ratio = s / steps;
          points.push({
            x: (p1.x + (p2.x - p1.x) * ratio) * canvas.width,
            y: (p1.y + (p2.y - p1.y) * ratio) * canvas.height,
            painted: false
          });
        }
      }
    });

    let completed = false;
    let guideProgress = 0;

    const checkCompletion = () => {
      if (completed) return;
      const paintedCount = points.filter(p => p.painted).length;
      // 4세 눈높이: 55%만 스쳐도 전부 반짝이며 완성!
      if (paintedCount >= points.length * 0.55) {
        completed = true;
        points.forEach(p => (p.painted = true));
        soundManager.playCelebration();
        soundManager.speak(`우와! ${t.name} 따라쓰기 성공! 우리 친구 최고!`);
        setTimeout(() => this.close(2), 1400);
      }
    };

    const paintNear = (cx: number, cy: number) => {
      if (completed) return;
      let newlyPainted = false;
      points.forEach(pt => {
        const dist = Math.hypot(pt.x - cx, pt.y - cy);
        if (dist < 56 && !pt.painted) {
          pt.painted = true;
          newlyPainted = true;
        }
      });
      if (newlyPainted) {
        soundManager.playPop(1.2);
        checkCompletion();
      }
    };

    let isDrawing = false;
    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height
      };
    };

    canvas.addEventListener('mousedown', e => {
      isDrawing = true;
      const pos = getPos(e);
      paintNear(pos.x, pos.y);
    });
    canvas.addEventListener('mousemove', e => {
      if (!isDrawing) return;
      const pos = getPos(e);
      paintNear(pos.x, pos.y);
    });
    window.addEventListener('mouseup', () => (isDrawing = false));

    canvas.addEventListener(
      'touchstart',
      e => {
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        paintNear(pos.x, pos.y);
      },
      { passive: false }
    );
    canvas.addEventListener(
      'touchmove',
      e => {
        e.preventDefault();
        if (!isDrawing) return;
        const pos = getPos(e);
        paintNear(pos.x, pos.y);
      },
      { passive: false }
    );
    canvas.addEventListener('touchend', () => (isDrawing = false));

    // '타요랑 같이 색칠하기' 원클릭 완성 도우미 버튼
    const autoBtn = infoCard.querySelector('#btn-auto-trace');
    if (autoBtn) {
      autoBtn.addEventListener('click', () => {
        if (completed) return;
        points.forEach(p => (p.painted = true));
        checkCompletion();
      });
    }

    const renderLoop = () => {
      if (!this.isOpen) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. 바탕 가이드 트랙 (굵은 회색/하늘색 길)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      t.strokes.forEach(stroke => {
        ctx.beginPath();
        stroke.forEach((p, idx) => {
          const px = p.x * canvas.width;
          const py = p.y * canvas.height;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.lineWidth = 54;
        ctx.strokeStyle = '#E0F2FE';
        ctx.stroke();

        ctx.setLineDash([12, 12]);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#38BDF8';
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 2. 아이가 칠한 무지개/별빛 크레파스 원들
      points.forEach((pt, idx) => {
        if (pt.painted) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 26, 0, Math.PI * 2);
          const hue = (idx * 8) % 360;
          ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
          ctx.fill();
        }
      });

      // 3. 출발점 & 도착점 표시 + 움직이는 가이드 별
      if (points.length > 0 && !completed) {
        guideProgress = (guideProgress + 0.35) % points.length;
        const gPt = points[Math.floor(guideProgress)];
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚌', gPt.x, gPt.y);

        const startPt = points[0];
        ctx.fillText('🟢', startPt.x, startPt.y - 28);
      }

      this.animFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }

  /**
   * 3. 4세용 2쌍 짝꿍 선 긋기 놀이 (클릭-클릭 또는 드래그 모두 지원!)
   */
  private renderMatch(m: MatchActivity): void {
    if (!this.bodyEl || !this.titleEl) return;
    this.titleEl.textContent = m.title;
    this.bodyEl.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'edu-match-container';

    const leftCol = document.createElement('div');
    leftCol.className = 'edu-match-col';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'edu-match-svg');

    const rightCol = document.createElement('div');
    rightCol.className = 'edu-match-col';

    let selectedLeftId: string | null = null;
    const matchedIds = new Set<string>();
    const leftEls: Record<string, HTMLElement> = {};
    const rightEls: Record<string, HTMLElement> = {};

    const drawLines = () => {
      svg.innerHTML = '';
      const svgRect = svg.getBoundingClientRect();
      matchedIds.forEach(id => {
        const lEl = leftEls[id];
        const rEl = rightEls[id];
        if (!lEl || !rEl) return;
        const lRect = lEl.getBoundingClientRect();
        const rRect = rEl.getBoundingClientRect();

        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', String(lRect.right - svgRect.left));
        line.setAttribute('y1', String(lRect.top + lRect.height / 2 - svgRect.top));
        line.setAttribute('x2', String(rRect.left - svgRect.left));
        line.setAttribute('y2', String(rRect.top + rRect.height / 2 - svgRect.top));
        line.setAttribute('stroke', '#10B981');
        line.setAttribute('stroke-width', '10');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
      });
    };

    const tryMatch = (rightPair: MatchActivity['pairs'][0]) => {
      const activeLeft = selectedLeftId || (!matchedIds.has(rightPair.id) ? rightPair.id : null);
      if (activeLeft === rightPair.id) {
        matchedIds.add(rightPair.id);
        leftEls[rightPair.id]?.classList.remove('selected');
        leftEls[rightPair.id]?.classList.add('matched');
        rightEls[rightPair.id]?.classList.add('matched');
        selectedLeftId = null;

        soundManager.playPop(1.3);
        soundManager.speak(rightPair.voiceText);
        drawLines();

        if (matchedIds.size === m.pairs.length) {
          soundManager.playCelebration();
          setTimeout(() => {
            soundManager.speak('우와! 짝꿍을 모두 찾았어요! 참 잘했어요!');
            this.close(2);
          }, 1100);
        }
      } else {
        soundManager.playBoing();
        soundManager.speak('어? 다른 짝꿍을 찾아볼까요?');
      }
    };

    m.pairs.forEach(p => {
      const lBtn = document.createElement('button');
      lBtn.className = 'edu-match-card left-card';
      lBtn.innerHTML = `<span class="match-emoji">${p.leftEmoji}</span><span class="match-sub">${p.leftLabel}</span>`;
      lBtn.addEventListener('click', () => {
        if (matchedIds.has(p.id)) return;
        Object.values(leftEls).forEach(el => el.classList.remove('selected'));
        selectedLeftId = p.id;
        lBtn.classList.add('selected');
        soundManager.playPop(1.0);
        soundManager.speak(p.leftLabel);
      });
      leftEls[p.id] = lBtn;
      leftCol.appendChild(lBtn);
    });

    // 오른쪽 카드는 순서를 반대로 배치해 선긋기 재미 부여
    [...m.pairs].reverse().forEach(p => {
      const rBtn = document.createElement('button');
      rBtn.className = 'edu-match-card right-card';
      rBtn.innerHTML = `<span class="match-text">${p.rightText}</span><span class="match-sub">${p.rightSub}</span>`;
      rBtn.addEventListener('click', () => {
        if (matchedIds.has(p.id)) return;
        tryMatch(p);
      });
      rightEls[p.id] = rBtn;
      rightCol.appendChild(rBtn);
    });

    container.appendChild(leftCol);
    container.appendChild(svg);
    container.appendChild(rightCol);
    this.bodyEl.appendChild(container);
  }

  private showSuccessAndClose(cardEl: HTMLElement): void {
    cardEl.innerHTML += `<div class="edu-star-burst">⭐⭐ 정답! 최고! ⭐⭐</div>`;
    setTimeout(() => {
      this.close(2);
    }, 1350);
  }
}

export const educationManager = new EducationManager();

