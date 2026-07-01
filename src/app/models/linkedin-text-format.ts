const BOLD_UPPER_BASE = 0x1d400;
const BOLD_LOWER_BASE = 0x1d41a;
const BOLD_DIGIT_BASE = 0x1d7ce;

const BOLD_UPPER_START = 0x1d400;
const BOLD_UPPER_END = 0x1d419;
const BOLD_LOWER_START = 0x1d41a;
const BOLD_LOWER_END = 0x1d433;
const BOLD_DIGIT_START = 0x1d7ce;
const BOLD_DIGIT_END = 0x1d7d7;

const COMBINING_SHORT_STROKE_OVERLAY = '\u0335';

const LINKEDIN_BOLD_POLISH_MAP: Readonly<Record<string, string>> = {
  ł: `${String.fromCodePoint(BOLD_LOWER_BASE + ('l'.charCodeAt(0) - 0x61))}${COMBINING_SHORT_STROKE_OVERLAY}`,
  Ł: `${String.fromCodePoint(BOLD_UPPER_BASE + ('L'.charCodeAt(0) - 0x41))}${COMBINING_SHORT_STROKE_OVERLAY}`,
};

const LINKEDIN_PLAIN_POLISH_ENTRIES = Object.entries(LINKEDIN_BOLD_POLISH_MAP).map(
  ([plain, bold]) => [bold, plain] as const
);

function toBoldCodePoint(code: number): number | null {
  if (code >= 0x41 && code <= 0x5a) {
    return BOLD_UPPER_BASE + (code - 0x41);
  }

  if (code >= 0x61 && code <= 0x7a) {
    return BOLD_LOWER_BASE + (code - 0x61);
  }

  if (code >= 0x30 && code <= 0x39) {
    return BOLD_DIGIT_BASE + (code - 0x30);
  }

  return null;
}

function fromBoldCodePoint(code: number): number | null {
  if (code >= BOLD_UPPER_START && code <= BOLD_UPPER_END) {
    return 0x41 + (code - BOLD_UPPER_START);
  }

  if (code >= BOLD_LOWER_START && code <= BOLD_LOWER_END) {
    return 0x61 + (code - BOLD_LOWER_START);
  }

  if (code >= BOLD_DIGIT_START && code <= BOLD_DIGIT_END) {
    return 0x30 + (code - BOLD_DIGIT_START);
  }

  return null;
}

function mapNfdText(text: string, mapCodePoint: (code: number) => number | null): string {
  let result = '';

  for (const char of text.normalize('NFD')) {
    const code = char.codePointAt(0);
    if (code === undefined) {
      continue;
    }

    const mapped = mapCodePoint(code);
    result += mapped === null ? char : String.fromCodePoint(mapped);
  }

  return result;
}

function toLinkedInBoldChar(char: string): string {
  const polishBold = LINKEDIN_BOLD_POLISH_MAP[char];
  if (polishBold) {
    return polishBold;
  }

  return mapNfdText(char, (code) => toBoldCodePoint(code) ?? null);
}

function fromLinkedInBoldChar(char: string): string {
  return mapNfdText(char, (code) => fromBoldCodePoint(code) ?? null);
}

export function toLinkedInBoldText(text: string): string {
  let result = '';

  for (const char of text) {
    result += toLinkedInBoldChar(char);
  }

  return result;
}

export function fromLinkedInBoldText(text: string): string {
  const codePoints = [...text];
  let result = '';
  let index = 0;

  outer: while (index < codePoints.length) {
    const rest = codePoints.slice(index).join('');

    for (const [bold, plain] of LINKEDIN_PLAIN_POLISH_ENTRIES) {
      if (rest.startsWith(bold)) {
        result += plain;
        index += [...bold].length;
        continue outer;
      }
    }

    result += fromLinkedInBoldChar(codePoints[index]);
    index += 1;
  }

  return result.normalize('NFC');
}

export function hasLinkedInBoldFormattableChars(text: string): boolean {
  for (const char of text) {
    if (LINKEDIN_BOLD_POLISH_MAP[char]) {
      return true;
    }

    for (const part of char.normalize('NFD')) {
      const code = part.codePointAt(0);
      if (code === undefined) {
        continue;
      }

      if (toBoldCodePoint(code) !== null || fromBoldCodePoint(code) !== null) {
        return true;
      }
    }
  }

  return false;
}

export function isLinkedInBoldText(text: string): boolean {
  if (!hasLinkedInBoldFormattableChars(text)) {
    return false;
  }

  const plain = fromLinkedInBoldText(text);
  return plain !== text && toLinkedInBoldText(plain) === text;
}

export type LinkedInBoldSelectionResult = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

export function toggleLinkedInBoldSelection(
  text: string,
  start: number,
  end: number
): LinkedInBoldSelectionResult {
  if (start === end) {
    return { text, selectionStart: start, selectionEnd: end };
  }

  const selected = text.slice(start, end);
  if (!hasLinkedInBoldFormattableChars(selected)) {
    return { text, selectionStart: start, selectionEnd: end };
  }

  const transformed = isLinkedInBoldText(selected)
    ? fromLinkedInBoldText(selected)
    : toLinkedInBoldText(selected);
  const next = `${text.slice(0, start)}${transformed}${text.slice(end)}`;

  return {
    text: next,
    selectionStart: start,
    selectionEnd: start + transformed.length,
  };
}
