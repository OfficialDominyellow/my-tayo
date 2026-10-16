import { soundManager } from './sound';

export type EduCategory = 'all' | 'hangul' | 'number' | 'english' | 'safety' | 'music';
export type EduGameMode = 'quiz' | 'trace' | 'match' | 'xylophone' | 'emergency_dial' | 'counting_basket';

interface QuizQuestion {
  category: Exclude<EduCategory, 'all'>;
  mode: 'quiz';
  title: string;
  voicePrompt: string;
  showcaseItems?: string[];
  options: {
    label: string;
    subLabel: string;
    emoji: string;
    photoUrl?: string; // 우리 가족 실제 얼굴 사진 지원!
    voiceText: string;
    voiceLang?: 'ko-KR' | 'en-US';
    isCorrect: boolean;
  }[];
}

interface TraceActivity {
  category: Exclude<EduCategory, 'all'>;
  mode: 'trace';
  char: string;
  name: string;
  wordExample: string;
  emoji: string;
  voicePrompt: string;
  strokes: { x: number; y: number }[][];
}

interface MatchActivity {
  category: Exclude<EduCategory, 'all'>;
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

interface XylophoneActivity {
  category: 'music';
  mode: 'xylophone';
  title: string;
  songName: string;
  voicePrompt: string;
  /** 음계 인덱스 배열 (0=도, 1=레, 2=미, 3=파, 4=솔, 5=라, 6=시, 7=높은도) */
  notes: number[];
  lyrics: string[];
}

interface EmergencyDialActivity {
  category: 'safety';
  mode: 'emergency_dial';
  title: string;
  situationEmoji: string;
  situationDesc: string;
  targetNumber: string; // '119' | '112'
  responderName: string;
  responderEmoji: string;
  voicePrompt: string;
  successVoice: string;
}

interface CountingBasketActivity {
  category: 'number';
  mode: 'counting_basket';
  title: string;
  itemEmoji: string;
  itemName: string;
  targetCount: number;
  voicePrompt: string;
}

type EduActivity =
  | QuizQuestion
  | TraceActivity
  | MatchActivity
  | XylophoneActivity
  | EmergencyDialActivity
  | CountingBasketActivity;

const XYLOPHONE_KEYS = [
  { noteIdx: 0, kor: '도', eng: 'C', color: '#EF4444' },
  { noteIdx: 1, kor: '레', eng: 'D', color: '#F97316' },
  { noteIdx: 2, kor: '미', eng: 'E', color: '#FACC15' },
  { noteIdx: 3, kor: '파', eng: 'F', color: '#22C55E' },
  { noteIdx: 4, kor: '솔', eng: 'G', color: '#06B6D4' },
  { noteIdx: 5, kor: '라', eng: 'A', color: '#3B82F6' },
  { noteIdx: 6, kor: '시', eng: 'B', color: '#6366F1' },
  { noteIdx: 7, kor: '높은도', eng: 'C6', color: '#EC4899' }
];

const EDU_ACTIVITIES: EduActivity[] = [
  // ==================== 🎹 도레미 무지개 실로폰 & 동요 연주 (신규 SOTA 컨텐츠!) ====================
  {
    category: 'music',
    mode: 'xylophone',
    title: '🎹 [음악 교실] 반짝이는 무지개 건반을 눌러 "반짝반짝 작은 별"을 연주해요!',
    songName: '🎵 반짝반짝 작은 별',
    voicePrompt: '도레미 무지개 실로폰 시간이에요! 타요 버스가 가리키는 반짝이는 건반을 차례대로 톡톡 눌러 작은 별 노래를 연주해 보세요!',
    notes: [0, 0, 4, 4, 5, 5, 4],
    lyrics: ['반(도)', '짝(도)', '반(솔)', '짝(솔)', '작(라)', '은(라)', '별!(솔)']
  },
  {
    category: 'music',
    mode: 'xylophone',
    title: '🎹 [음악 교실] 무지개 실로폰으로 "나비야 나비야" 동요를 연주해 볼까요?',
    songName: '🦋 나비야 나비야',
    voicePrompt: '솔 미 미! 파 레 레! 반짝이는 무지개 실로폰 건반을 눌러 나비야 동요를 연주해 보세요!',
    notes: [4, 2, 2, 3, 1, 1],
    lyrics: ['나(솔)', '비(미)', '야(미)', '이(파)', '리(레)', '와!(레)']
  },
  {
    category: 'music',
    mode: 'xylophone',
    title: '🎹 [음악 교실] 타요 버스 출발 팡파레 "도-미-솔-높은도"를 연주해요!',
    songName: '🚌 타요 신나는 출발 팡파레',
    voicePrompt: '도, 미, 솔, 높은 도! 무지개 건반을 눌러 타요 출발 팡파레를 울려주세요!',
    notes: [0, 2, 4, 7],
    lyrics: ['도!', '미!', '솔!', '출발(높은도)!']
  },

  // ==================== 📞 119·112 긴급구조 전화 다이얼 시뮬레이터 (신규 SOTA 컨텐츠!) ====================
  {
    category: 'safety',
    mode: 'emergency_dial',
    title: '📞 [119 구조대] 앗! 건물에 불이 났어요! 몇 번으로 전화해야 소방차가 출동할까요?',
    situationEmoji: '🔥🏢🚒',
    situationDesc: '불이 났을 때는 침착하게 전화기에서 1 - 1 - 9 를 차례대로 눌러요!',
    targetNumber: '119',
    responderName: '프랭크 119 소방대장',
    responderEmoji: '🚒',
    voicePrompt: '삐뽀삐뽀! 건물에 불이 났어요! 전화기 버튼에서 일, 일, 구! 일일구를 차례대로 눌러 프랭크 소방차를 불러주세요!',
    successVoice: '일일구 소방서입니다! 프랭크 소방차가 지금 바로 출동합니다! 우리 친구 정말 침착하고 멋져요!'
  },
  {
    category: 'safety',
    mode: 'emergency_dial',
    title: '📞 [112 경찰서] 길을 잃어버렸어요! 경찰관 아저씨에게 전화하려면 몇 번을 누를까요?',
    situationEmoji: '🚓👮‍♂️🚨',
    situationDesc: '길을 잃거나 나쁜 사람을 만났을 때는 전화기에서 1 - 1 - 2 를 눌러요!',
    targetNumber: '112',
    responderName: '패트 112 경찰대장',
    responderEmoji: '🚓',
    voicePrompt: '위잉위잉! 길을 잃거나 도움이 필요할 땐 몇 번으로 전화할까요? 전화기에서 일, 일, 이! 일일이를 눌러 패트 경찰차를 불러주세요!',
    successVoice: '일일이 경찰서입니다! 패트 경찰차가 안전하게 지켜줄게요! 전화번호를 정확히 알고 있네요!'
  },

  // ==================== 👨‍👩‍👦‍👦 우리 가족 & 한글 놀이 ====================
  {
    category: 'hangul',
    mode: 'quiz',
    title: '👦👑 [우리 가족 한글] 우리 멋진 주인공 "선율이"와 "태율이" 가족을 찾아보세요!',
    voicePrompt: '우리 멋진 주인공 선율이와 귀여운 태율이! 선율이 카드를 찾아 눌러볼까요?',
    options: [
      {
        emoji: '👦',
        photoUrl: '/family/sunyul_badge.png',
        label: '선율이',
        subLabel: 'ㅅ ㅓ ㄴ ㅇ ㅠ ㄹ',
        voiceText: '선율이! 맞았어요! 우리 멋진 주인공 선율이예요!',
        isCorrect: true
      },
      {
        emoji: '👶',
        photoUrl: '/family/taeyul_badge.png',
        label: '태율이',
        subLabel: 'ㅌ ㅐ ㅇ ㅠ ㄹ',
        voiceText: '태율이! 귀여운 태율이네요! 이번엔 선율이를 찾아볼까요?',
        isCorrect: false
      },
      {
        emoji: '👨',
        photoUrl: '/family/dad_badge.png',
        label: '아빠',
        subLabel: 'ㅇ ㅏ ㅃ ㅏ',
        voiceText: '아빠! 든든한 아빠네요! 선율이를 찾아볼까요?',
        isCorrect: false
      }
    ]
  },
  {
    category: 'hangul',
    mode: 'quiz',
    title: '👶💛 [우리 가족 한글] 해맑게 웃는 귀염둥이 "태율이" 카드를 찾아 눌러보세요!',
    voicePrompt: '방긋방긋 웃는 우리 귀염둥이 태율이 카드는 어디 있을까요? 찾아서 눌러보세요!',
    options: [
      {
        emoji: '👩',
        photoUrl: '/family/mom_badge.png',
        label: '엄마',
        subLabel: 'ㅇ ㅓ ㅁ ㅁ ㅏ',
        voiceText: '엄마! 사랑하는 엄마예요! 태율이를 찾아볼까요?',
        isCorrect: false
      },
      {
        emoji: '👶',
        photoUrl: '/family/taeyul_badge.png',
        label: '태율이',
        subLabel: 'ㅌ ㅐ ㅇ ㅠ ㄹ',
        voiceText: '태율이! 딩동댕! 귀염둥이 태율이를 찾았어요!',
        isCorrect: true
      },
      {
        emoji: '👦',
        photoUrl: '/family/sunyul_badge.png',
        label: '선율이',
        subLabel: 'ㅅ ㅓ ㄴ ㅇ ㅠ ㄹ',
        voiceText: '선율이! 멋진 형아 선율이네요!',
        isCorrect: false
      }
    ]
  },
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
    mode: 'trace',
    char: 'ㅁ',
    name: '미음',
    wordExample: '🍌 마트 · 🧢 모자',
    emoji: '🧢',
    voicePrompt: '한글 미음! 네모 모양을 반짝이는 길을 따라 쓱싹 그려보세요!',
    strokes: [
      [
        { x: 0.26, y: 0.26 },
        { x: 0.74, y: 0.26 },
        { x: 0.74, y: 0.74 },
        { x: 0.26, y: 0.74 },
        { x: 0.26, y: 0.26 }
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

  // ==================== 🍎 숫자 놀이 & 바구니 담기 ====================
  {
    category: 'number',
    mode: 'counting_basket',
    title: '🍎 [숫자 바구니] 나무에 열린 빨간 사과 5개를 톡톡 눌러 타요 바구니에 담아보세요!',
    itemEmoji: '🍎',
    itemName: '빨간 사과',
    targetCount: 5,
    voicePrompt: '나무에 맛있는 사과가 열렸어요! 사과를 하나씩 톡톡 눌러 다섯 개를 모두 바구니에 담아보세요!'
  },
  {
    category: 'number',
    mode: 'counting_basket',
    title: '🍓 [숫자 바구니] 새콤달콤 딸기 4개를 톡톡 눌러 바구니에 담아보세요!',
    itemEmoji: '🍓',
    itemName: '달콤한 딸기',
    targetCount: 4,
    voicePrompt: '새콤달콤 딸기를 하나, 둘, 셋, 넷! 네 개 모두 톡톡 눌러 바구니에 담아주세요!'
  },
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
    mode: 'trace',
    char: '3',
    name: '숫자 3 (셋)',
    wordExample: '🍓🍓🍓 딸기 3개',
    emoji: '3️⃣',
    voicePrompt: '숫자 삼! 나비 날개처럼 볼록볼록 두 번 둥글게 그려보세요!',
    strokes: [
      [
        { x: 0.32, y: 0.24 },
        { x: 0.68, y: 0.28 },
        { x: 0.45, y: 0.50 },
        { x: 0.70, y: 0.70 },
        { x: 0.32, y: 0.78 }
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

  // ==================== 🔤 영어 파닉스 놀이 ====================
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
  },

  // ==================== 🚨 안전·생활 상식 ====================
  {
    category: 'safety',
    mode: 'quiz',
    title: '🚒 [안전 상식] 불이 났을 때 물대포로 불을 꺼주는 고마운 차는 누구일까요?',
    voicePrompt: '삐뽀삐뽀! 불이 났을 때 출동해서 물대포로 불을 꺼주는 고마운 자동차는 누구일까요?',
    options: [
      { emoji: '🚒', label: '119 소방차', subLabel: '프랭크 소방차', voiceText: '일일구 소방차! 맞았어요! 프랭크 소방차가 불을 꺼줘요!', isCorrect: true },
      { emoji: '🍦', label: '아이스크림차', subLabel: '달콤한 간식', voiceText: '아이스크림차! 맛있는 간식 차네요. 소방차를 찾아볼까요?', isCorrect: false },
      { emoji: '🚜', label: '트랙터', subLabel: '농장 일꾼', voiceText: '트랙터! 밭을 가는 트랙터예요. 빨간 소방차를 찾아볼까요?', isCorrect: false }
    ]
  },
  {
    category: 'safety',
    mode: 'match',
    title: '🔗 [안전 선긋기] 출동 자동차와 일하는 건물을 짝지어 주세요!',
    voicePrompt: '경찰차는 경찰서로! 소방차는 소방서로! 알맞은 건물을 찾아 이어주세요!',
    pairs: [
      { id: 'police', leftEmoji: '🚓', leftLabel: '패트 경찰차', rightText: '112 경찰서', rightSub: '우리 동네 지킴이', voiceText: '경찰차는 일일이 경찰서로 출동!' },
      { id: 'fire', leftEmoji: '🚒', leftLabel: '프랭크 소방차', rightText: '119 소방서', rightSub: '불끄기 대장', voiceText: '소방차는 일일구 소방서로 출동!' }
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
          this.activityIndex = 0;
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
    const filtered = EDU_ACTIVITIES.filter(a => a.category === this.selectedCategory);
    return filtered.length > 0 ? filtered : EDU_ACTIVITIES;
  }

  private getCurrentActivity(): EduActivity {
    const list = this.getFilteredActivities();
    return list[this.activityIndex % list.length];
  }

  /**
   * 승객 탑승 시 또는 상단 '놀이학습' 버튼 클릭 시 호출
   */
  public openMissionActivity(
    passengerInfo: { icon: string; name: string; targetStopName: string; photoUrl?: string } | null,
    onComplete: (starsEarned: number) => void
  ): void {
    if (!this.modalEl || !this.bodyEl) return;

    this.isOpen = true;
    this.onCompleteCallback = onComplete;
    this.modalEl.classList.remove('hidden');

    if (this.passengerBadgeEl) {
      if (passengerInfo) {
        const avatarHtml = passengerInfo.photoUrl
          ? `<img src="${passengerInfo.photoUrl}" class="edu-passenger-photo" alt="${passengerInfo.name}" />`
          : `<span class="edu-passenger-emoji">${passengerInfo.icon}</span>`;
        this.passengerBadgeEl.innerHTML = `${avatarHtml} <strong>${passengerInfo.name}</strong> 손님: "<strong>${passengerInfo.targetStopName}</strong>(으)로 출발하기 전에 신나는 놀이 하나 해볼까요?"`;
      } else {
        this.passengerBadgeEl.innerHTML = `🚌 <strong>타요 AI 스마트 놀이교실 2.0 (한글 · 숫자 · 영어 · 119안전 · 실로폰 음악)</strong>`;
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

    switch (act.mode) {
      case 'quiz':
        this.renderQuiz(act);
        break;
      case 'trace':
        this.renderTrace(act);
        break;
      case 'match':
        this.renderMatch(act);
        break;
      case 'xylophone':
        this.renderXylophone(act);
        break;
      case 'emergency_dial':
        this.renderEmergencyDial(act);
        break;
      case 'counting_basket':
        this.renderCountingBasket(act);
        break;
    }
  }

  /**
   * 🎹 1. 도레미 무지개 실로폰 & 동요 피아노 연주 (SOTA Music EdTech)
   */
  private renderXylophone(xAct: XylophoneActivity): void {
    if (!this.bodyEl || !this.titleEl) return;
    this.titleEl.textContent = xAct.title;
    this.bodyEl.innerHTML = '';

    let stepIdx = 0;
    let completed = false;

    const wrap = document.createElement('div');
    wrap.className = 'edu-xylophone-wrap';

    // 상단 악보 진행 바
    const sheetRow = document.createElement('div');
    sheetRow.className = 'edu-sheet-row';

    const noteBadges: HTMLElement[] = [];
    xAct.notes.forEach((nIdx, i) => {
      const keyMeta = XYLOPHONE_KEYS[nIdx];
      const badge = document.createElement('div');
      badge.className = 'edu-sheet-note' + (i === 0 ? ' active-target' : '');
      badge.style.borderColor = keyMeta.color;
      badge.innerHTML = `<span class="sheet-lyric">${xAct.lyrics[i] || keyMeta.kor}</span>`;
      sheetRow.appendChild(badge);
      noteBadges.push(badge);
    });
    wrap.appendChild(sheetRow);

    // 8키 무지개 실로폰 건반
    const keysRow = document.createElement('div');
    keysRow.className = 'edu-xylophone-keys';
    const keyButtons: HTMLButtonElement[] = [];

    const updateTargetHighlight = () => {
      keyButtons.forEach((btn, idx) => {
        const isTarget = !completed && xAct.notes[stepIdx] === idx;
        btn.classList.toggle('target-key', isTarget);
      });
      noteBadges.forEach((b, idx) => {
        b.classList.toggle('active-target', idx === stepIdx && !completed);
        b.classList.toggle('played-done', idx < stepIdx || completed);
      });
    };

    const handleKeyHit = (keyIdx: number, btn: HTMLButtonElement) => {
      soundManager.playXylophoneNote(keyIdx);
      btn.classList.remove('hit-anim');
      void btn.offsetWidth;
      btn.classList.add('hit-anim');

      if (completed) return;

      const expectedNote = xAct.notes[stepIdx];
      if (keyIdx === expectedNote) {
        stepIdx++;
        updateTargetHighlight();
        if (stepIdx >= xAct.notes.length) {
          completed = true;
          updateTargetHighlight();
          setTimeout(() => {
            soundManager.playCelebration();
            soundManager.speak(`우와! ${xAct.songName} 연주 성공! 꼬마 음악가 최고예요!`);
            this.showSuccessAndClose(wrap);
          }, 450);
        }
      }
    };

    XYLOPHONE_KEYS.forEach((k, idx) => {
      const btn = document.createElement('button');
      btn.className = 'edu-xylo-key';
      const heightPct = 100 - idx * 5.2;
      btn.style.height = `${heightPct}%`;
      btn.style.background = `linear-gradient(180deg, ${k.color} 0%, ${k.color}dd 100%)`;
      btn.innerHTML = `
        <span class="xylo-bolt">⚪</span>
        <span class="xylo-pointer">🚌</span>
        <span class="xylo-kor">${k.kor}</span>
        <span class="xylo-eng">${k.eng}</span>
        <span class="xylo-bolt">⚪</span>
      `;
      btn.addEventListener('click', () => handleKeyHit(idx, btn));
      keyButtons.push(btn);
      keysRow.appendChild(btn);
    });

    wrap.appendChild(keysRow);

    // 타요 자동 연주 도우미 버튼
    const autoBtn = document.createElement('button');
    autoBtn.className = 'edu-magic-complete-btn';
    autoBtn.textContent = '✨ 타요랑 같이 자동 연주하기!';
    autoBtn.addEventListener('click', () => {
      if (completed) return;
      xAct.notes.forEach((nIdx, i) => {
        setTimeout(() => {
          if (!this.isOpen) return;
          handleKeyHit(nIdx, keyButtons[nIdx]);
        }, i * 340);
      });
    });
    wrap.appendChild(autoBtn);

    this.bodyEl.appendChild(wrap);
    updateTargetHighlight();
  }

  /**
   * 📞 2. 119·112 긴급구조 전화 다이얼 시뮬레이터 (SOTA Safety EdTech)
   */
  private renderEmergencyDial(dAct: EmergencyDialActivity): void {
    if (!this.bodyEl || !this.titleEl) return;
    this.titleEl.textContent = dAct.title;
    this.bodyEl.innerHTML = '';

    let dialed = '';
    let completed = false;

    const wrap = document.createElement('div');
    wrap.className = 'edu-dial-wrap';

    // 왼쪽 상황 카드
    const leftCard = document.createElement('div');
    leftCard.className = 'edu-dial-situation';
    leftCard.innerHTML = `
      <div class="dial-sit-emoji">${dAct.situationEmoji}</div>
      <div class="dial-sit-target-badge">긴급신고 <strong>${dAct.targetNumber}</strong></div>
      <p class="dial-sit-desc">${dAct.situationDesc}</p>
      <div class="dial-responder-box">
        <span>${dAct.responderEmoji}</span>
        <strong>${dAct.responderName} 대기 중!</strong>
      </div>
    `;
    wrap.appendChild(leftCard);

    // 오른쪽 스마트폰 다이얼 패드
    const phoneBox = document.createElement('div');
    phoneBox.className = 'edu-phone-box';

    const screenEl = document.createElement('div');
    screenEl.className = 'edu-phone-screen';
    screenEl.innerHTML = `<span class="phone-placeholder">${dAct.targetNumber} 번을 눌러요</span>`;
    phoneBox.appendChild(screenEl);

    const keypad = document.createElement('div');
    keypad.className = 'edu-phone-keypad';
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    const digitBtns: Record<string, HTMLButtonElement> = {};

    const updateNextDigitHint = () => {
      Object.values(digitBtns).forEach(b => b.classList.remove('next-digit-hint'));
      if (!completed && dialed.length < dAct.targetNumber.length) {
        const nextChar = dAct.targetNumber[dialed.length];
        digitBtns[nextChar]?.classList.add('next-digit-hint');
      }
    };

    digits.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'edu-phone-key';
      btn.textContent = d;
      digitBtns[d] = btn;

      btn.addEventListener('click', () => {
        if (completed) return;
        soundManager.playDialTone(Number(d) || 0);

        const expectedChar = dAct.targetNumber[dialed.length];
        if (d === expectedChar) {
          dialed += d;
          screenEl.innerHTML = `<span class="phone-dialed-digits">${dialed.split('').join(' - ')} 📞</span>`;
          updateNextDigitHint();

          if (dialed === dAct.targetNumber) {
            completed = true;
            screenEl.classList.add('call-connected');
            screenEl.innerHTML = `<span>${dAct.responderEmoji} ${dAct.targetNumber} 출동 연결 완료!</span>`;
            soundManager.playSiren(dAct.targetNumber === '112' ? 'police' : 'fire');
            soundManager.playCelebration();
            soundManager.speak(dAct.successVoice);
            this.showSuccessAndClose(phoneBox);
          }
        } else {
          btn.classList.add('gentle-shake');
          soundManager.playBoing();
          soundManager.speak(`반짝이는 숫자 ${expectedChar} 버튼을 눌러볼까요?`);
          setTimeout(() => btn.classList.remove('gentle-shake'), 500);
        }
      });

      keypad.appendChild(btn);
    });

    phoneBox.appendChild(keypad);
    wrap.appendChild(phoneBox);
    this.bodyEl.appendChild(wrap);

    updateNextDigitHint();
  }

  /**
   * 🍎 3. 톡톡 과일 바구니 숫자 세기 놀이 (SOTA Counting Basket)
   */
  private renderCountingBasket(cAct: CountingBasketActivity): void {
    if (!this.bodyEl || !this.titleEl) return;
    this.titleEl.textContent = cAct.title;
    this.bodyEl.innerHTML = '';

    let count = 0;
    const korCounts = ['하나!', '둘!', '셋!', '넷!', '다섯!', '여섯!'];

    const wrap = document.createElement('div');
    wrap.className = 'edu-basket-wrap';

    const treeArea = document.createElement('div');
    treeArea.className = 'edu-tree-area';

    const basketArea = document.createElement('div');
    basketArea.className = 'edu-basket-box';
    basketArea.innerHTML = `
      <div class="basket-header">🧺 타요 숫자 바구니: <strong id="basket-count-num">0 / ${cAct.targetCount}</strong></div>
      <div class="basket-items-row" id="basket-collected-row"></div>
    `;

    for (let i = 0; i < cAct.targetCount; i++) {
      const fruitBtn = document.createElement('button');
      fruitBtn.className = 'edu-fruit-btn';
      fruitBtn.innerHTML = `<span>${cAct.itemEmoji}</span>`;
      fruitBtn.addEventListener('click', () => {
        if (fruitBtn.classList.contains('picked')) return;
        fruitBtn.classList.add('picked');
        count++;

        soundManager.playPop(1 + count * 0.14);
        soundManager.speak(`${korCounts[count - 1] || count} 숫자 ${count}!`);

        const countEl = basketArea.querySelector('#basket-count-num');
        const rowEl = basketArea.querySelector('#basket-collected-row');
        if (countEl) countEl.textContent = `${count} / ${cAct.targetCount}`;
        if (rowEl) {
          const pickedSpan = document.createElement('span');
          pickedSpan.className = 'basket-picked-item';
          pickedSpan.textContent = `${cAct.itemEmoji}${count}`;
          rowEl.appendChild(pickedSpan);
        }

        if (count >= cAct.targetCount) {
          setTimeout(() => {
            soundManager.playCelebration();
            soundManager.speak(`우와! ${cAct.itemName} ${cAct.targetCount}개를 모두 바구니에 담았어요! 참 잘했어요!`);
            this.showSuccessAndClose(basketArea);
          }, 550);
        }
      });
      treeArea.appendChild(fruitBtn);
    }

    wrap.appendChild(treeArea);
    wrap.appendChild(basketArea);
    this.bodyEl.appendChild(wrap);
  }

  /**
   * 4. 4세용 큼직한 그림·가족사진·글자 터치 퀴즈
   */
  private renderQuiz(q: QuizQuestion): void {
    if (!this.bodyEl || !this.titleEl) return;
    this.titleEl.textContent = q.title;
    this.bodyEl.innerHTML = '';

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

    const grid = document.createElement('div');
    grid.className = 'edu-quiz-grid';

    q.options.forEach(opt => {
      const card = document.createElement('button');
      card.className = 'edu-quiz-card';
      const visualHtml = opt.photoUrl
        ? `<img src="${opt.photoUrl}" class="edu-card-family-photo" alt="${opt.label}" />`
        : `<div class="edu-card-emoji">${opt.emoji}</div>`;

      card.innerHTML = `
        ${visualHtml}
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
   * 5. 4세용 무지개 손가락 따라쓰기 (실시간 별빛 파티클 + 넉넉한 판정)
   */
  private renderTrace(t: TraceActivity): void {
    if (!this.bodyEl || !this.titleEl) return;
    this.titleEl.textContent = `✏️ [따라쓰기] "${t.name}"을(를) 손가락으로 쓱싹 따라 그려봐요!`;
    this.bodyEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'edu-trace-wrap';

    const infoCard = document.createElement('div');
    infoCard.className = 'edu-trace-info';
    infoCard.innerHTML = `
      <div class="edu-trace-big-char">${t.char}</div>
      <div class="edu-trace-emoji">${t.emoji}</div>
      <div class="edu-trace-word">${t.wordExample}</div>
      <button class="edu-magic-complete-btn" id="btn-auto-trace">✨ 타요랑 같이 색칠하기!</button>
    `;
    wrap.appendChild(infoCard);

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
    const sparkles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];

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
      if (paintedCount >= points.length * 0.52) {
        completed = true;
        points.forEach(p => (p.painted = true));
        soundManager.playCelebration();
        soundManager.speak(`우와! ${t.name} 따라쓰기 성공! 우리 친구 최고!`);
        setTimeout(() => this.close(2), 1300);
      }
    };

    const paintNear = (cx: number, cy: number) => {
      if (completed) return;
      let newlyPainted = false;
      points.forEach(pt => {
        const dist = Math.hypot(pt.x - cx, pt.y - cy);
        if (dist < 58 && !pt.painted) {
          pt.painted = true;
          newlyPainted = true;
          for (let k = 0; k < 3; k++) {
            sparkles.push({
              x: pt.x,
              y: pt.y,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              life: 1.0,
              color: `hsl(${Math.floor(Math.random() * 360)}, 95%, 60%)`
            });
          }
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

      points.forEach((pt, idx) => {
        if (pt.painted) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 26, 0, Math.PI * 2);
          const hue = (idx * 8) % 360;
          ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
          ctx.fill();
        }
      });

      // 별빛 스파클 파티클 렌더링
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const sp = sparkles[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life -= 0.04;
        if (sp.life <= 0) {
          sparkles.splice(i, 1);
        } else {
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 6 * sp.life, 0, Math.PI * 2);
          ctx.fillStyle = sp.color;
          ctx.fill();
        }
      }

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
   * 6. 4세용 2쌍 짝꿍 선 긋기 놀이
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

    const shuffledRight = [...m.pairs].reverse();
    shuffledRight.forEach(p => {
      const rBtn = document.createElement('button');
      rBtn.className = 'edu-match-card right-card';
      rBtn.innerHTML = `<span class="match-title">${p.rightText}</span><span class="match-sub">${p.rightSub}</span>`;
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

  private showSuccessAndClose(targetCard: HTMLElement): void {
    const badge = document.createElement('div');
    badge.className = 'edu-star-burst';
    badge.innerHTML = '⭐⭐ 참 잘했어요! (+2 별)';
    targetCard.appendChild(badge);

    setTimeout(() => {
      this.close(2);
    }, 1350);
  }
}

export const educationManager = new EducationManager();

