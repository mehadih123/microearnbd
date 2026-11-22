export interface GeneratedMathProblem {
  id: number;
  a: number;
  b: number;
  answer: number;
  options: number[];
}

export interface GeneratedCaptchaChallenge {
  id: number;
  code: string;
  options: string[];
  correctIndex: number;
  glyphs: { char: string; rotate: number; dy: number; color: string }[];
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBnDigits(num: number | string): string {
  return String(num).replace(/\d/g, d => BN_DIGITS[Number(d)]);
}

function shuffleWithCorrect<T>(items: T[], correctItem: T): { options: T[]; correctIndex: number } {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return {
    options: arr,
    correctIndex: arr.indexOf(correctItem)
  };
}

/**
 * 50,000+ SIMPLE ADDITION (+) GENERATOR (250 x 250 = 62,500 unique addition problems)
 * Strictly NO subtraction, multiplication, or division.
 */
export function generateAdditionProblem(excludeId?: number): GeneratedMathProblem {
  let a = 1;
  let b = 1;
  let id = 1;

  for (let tries = 0; tries < 5; tries++) {
    const useCompactRange = Math.random() < 0.65;
    a = useCompactRange ? Math.floor(Math.random() * 40) + 1 : Math.floor(Math.random() * 250) + 1;
    b = useCompactRange ? Math.floor(Math.random() * 40) + 1 : Math.floor(Math.random() * 250) + 1;
    id = (a - 1) * 250 + b;
    if (id !== excludeId) break;
  }

  const answer = a + b;
  const decoys = new Set<number>();
  const offsets = [-3, -2, -1, 1, 2, 3, 4, 5, 10, -10];
  let idx = 0;
  while (decoys.size < 3) {
    const delta = offsets[(Math.floor(Math.random() * offsets.length) + idx++) % offsets.length];
    const candidate = answer + delta;
    if (candidate > 0 && candidate !== answer) {
      decoys.add(candidate);
    }
  }

  const { options } = shuffleWithCorrect([answer, ...Array.from(decoys)], answer);
  return { id, a, b, answer, options };
}

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GLYPH_COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];

/**
 * 50,000+ SIMPLE TEXT/NUMBER CAPTCHA GENERATOR (32^5 = 33,554,432 combinations)
 * Structured cleanly with 4 button options + visual SVG glyph styling.
 */
export function generateCaptchaChallenge(): GeneratedCaptchaChallenge {
  const id = Math.floor(Math.random() * 50000) + 10001;
  const length = 5;
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  }

  const decoys = new Set<string>();
  while (decoys.size < 3) {
    const chars = code.split('');
    const mutType = decoys.size % 3;
    if (mutType === 0) {
      const pos = Math.floor(Math.random() * length);
      const replacement = CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
      chars[pos] = replacement;
    } else if (mutType === 1 && length >= 2) {
      const pos = Math.floor(Math.random() * (length - 1));
      [chars[pos], chars[pos + 1]] = [chars[pos + 1], chars[pos]];
    } else {
      const p1 = Math.floor(Math.random() * length);
      const p2 = (p1 + 2) % length;
      chars[p1] = CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
      chars[p2] = CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
    }
    const candidate = chars.join('');
    if (candidate !== code) {
      decoys.add(candidate);
    }
  }

  const { options, correctIndex } = shuffleWithCorrect([code, ...Array.from(decoys)], code);

  const glyphs = code.split('').map((char, idx) => ({
    char,
    rotate: Math.floor(Math.random() * 26) - 13,
    dy: Math.floor(Math.random() * 8) - 4,
    color: GLYPH_COLORS[idx % GLYPH_COLORS.length]
  }));

  return {
    id,
    code,
    options,
    correctIndex,
    glyphs
  };
}
