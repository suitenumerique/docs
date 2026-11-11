/**
 * The doc title laid out for the preview card. next/og draws text left to
 * right, does not reorder right-to-left text, and measures Arabic before
 * joining its letters (so words end up far apart). This module does that work:
 * it joins Arabic letters into their presentation forms, reverses the letters
 * of right-to-left runs, and orders the words, so the card only has to place
 * them in a wrapping row (`row-reverse` for a right-to-left title).
 */

const char = (codePoint: number) => String.fromCodePoint(codePoint);
const range = (from: number, to: number) => `${char(from)}-${char(to)}`;

// Arabic letters: [first presentation form, joins on both sides]. The forms
// follow each other: isolated, final, then initial and medial for the letters
// that join on both sides.
const ARABIC_FORMS = new Map<number, [number, boolean]>([
  [0x0621, [0xfe80, false]],
  [0x0622, [0xfe81, false]],
  [0x0623, [0xfe83, false]],
  [0x0624, [0xfe85, false]],
  [0x0625, [0xfe87, false]],
  [0x0626, [0xfe89, true]],
  [0x0627, [0xfe8d, false]],
  [0x0628, [0xfe8f, true]],
  [0x0629, [0xfe93, false]],
  [0x062a, [0xfe95, true]],
  [0x062b, [0xfe99, true]],
  [0x062c, [0xfe9d, true]],
  [0x062d, [0xfea1, true]],
  [0x062e, [0xfea5, true]],
  [0x062f, [0xfea9, false]],
  [0x0630, [0xfeab, false]],
  [0x0631, [0xfead, false]],
  [0x0632, [0xfeaf, false]],
  [0x0633, [0xfeb1, true]],
  [0x0634, [0xfeb5, true]],
  [0x0635, [0xfeb9, true]],
  [0x0636, [0xfebd, true]],
  [0x0637, [0xfec1, true]],
  [0x0638, [0xfec5, true]],
  [0x0639, [0xfec9, true]],
  [0x063a, [0xfecd, true]],
  [0x0641, [0xfed1, true]],
  [0x0642, [0xfed5, true]],
  [0x0643, [0xfed9, true]],
  [0x0644, [0xfedd, true]],
  [0x0645, [0xfee1, true]],
  [0x0646, [0xfee5, true]],
  [0x0647, [0xfee9, true]],
  [0x0648, [0xfeed, false]],
  [0x0649, [0xfeef, false]],
  [0x064a, [0xfef1, true]],
  // Persian
  [0x067e, [0xfb56, true]],
  [0x0686, [0xfb7a, true]],
  [0x0698, [0xfb8a, false]],
  [0x06a9, [0xfb8e, true]],
  [0x06af, [0xfb92, true]],
  [0x06cc, [0xfbfc, true]],
]);
const TATWEEL = 0x0640;
const LAM = 0x0644;
// Lam followed by an alef: [isolated ligature]; the final form follows it
const LAM_ALEF = new Map<number, number>([
  [0x0622, 0xfef5],
  [0x0623, 0xfef7],
  [0x0625, 0xfef9],
  [0x0627, 0xfefb],
]);

// Vowel and cantillation marks: dropped, they would land on the wrong letter
// once the letters are reversed
const MARKS = new RegExp(
  `[${range(0x0591, 0x05bd)}${char(0x05bf)}${range(0x05c1, 0x05c2)}${range(
    0x05c4,
    0x05c5,
  )}${char(0x05c7)}${range(0x064b, 0x065f)}${char(0x0670)}]`,
  'g',
);
const RTL_LETTER = new RegExp(
  `[${range(0x05d0, 0x05ea)}${range(0x05f0, 0x05f4)}${range(
    0x0600,
    0x06ff,
  )}${range(0xfb50, 0xfdff)}${range(0xfe70, 0xfeff)}]`,
);
const LTR_LETTER = new RegExp(`[A-Za-z0-9${range(0xc0, 0x24f)}]`);
const DIGITS = /^[0-9.,:/%+-]+$/;
const MIRRORED: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
};

// Characters the card fonts have: Latin, Hebrew, the Arabic letters above and
// Arabic punctuation and digits. For any other one, next/og would fetch a font
// or an emoji from the internet: the card then goes without the title.
const ARABIC_SUPPORTED = [...ARABIC_FORMS.keys(), TATWEEL]
  .map((codePoint) => char(codePoint))
  .join('');
const SUPPORTED = new RegExp(
  `^[${range(0x20, 0x7e)}${range(0xa0, 0x17f)}${range(0x2013, 0x2014)}${range(
    0x2018,
    0x201d,
  )}${char(0x2026)}${range(0x05d0, 0x05ea)}${range(0x05f0, 0x05f4)}${char(
    0x05be,
  )}${char(0x05c0)}${char(0x05c3)}${char(0x05c6)}${ARABIC_SUPPORTED}${char(
    0x060c,
  )}${char(0x061b)}${char(0x061f)}${range(0x0660, 0x0669)}]*$`,
);

const isRtl = (text: string) => {
  for (const c of text) {
    if (RTL_LETTER.test(c)) {
      return true;
    }
    if (LTR_LETTER.test(c)) {
      return false;
    }
  }
  return undefined;
};

/**
 * Arabic letters in their joined forms, in logical order.
 */
export const joinArabic = (word: string) => {
  const codePoints = [...word].map((c) => c.codePointAt(0) ?? 0);
  const joinsBoth = (codePoint?: number) =>
    codePoint === TATWEEL ||
    (codePoint !== undefined && ARABIC_FORMS.get(codePoint)?.[1] === true);
  const joins = (codePoint?: number) =>
    codePoint === TATWEEL ||
    (codePoint !== undefined && ARABIC_FORMS.has(codePoint));

  let out = '';
  for (let i = 0; i < codePoints.length; i++) {
    const codePoint = codePoints[i];
    const forms = ARABIC_FORMS.get(codePoint);
    if (!forms) {
      out += char(codePoint);
      continue;
    }
    const joinsPrevious = joinsBoth(codePoints[i - 1]);
    const ligature =
      codePoint === LAM ? LAM_ALEF.get(codePoints[i + 1]) : undefined;
    if (ligature) {
      out += char(ligature + (joinsPrevious ? 1 : 0));
      i++;
      continue;
    }
    const [first, both] = forms;
    const joinsNext = both && joins(codePoints[i + 1]);
    const offset = joinsPrevious ? (joinsNext ? 3 : 1) : joinsNext ? 2 : 0;
    out += char(first + offset);
  }
  return out;
};

/**
 * A word as it is drawn left to right: runs of right-to-left characters
 * reversed (brackets mirrored), and, for a right-to-left word, its runs in
 * reverse order.
 */
export const visualWord = (word: string) => {
  const runs: { rtl: boolean; text: string }[] = [];
  for (const c of joinArabic(word)) {
    const rtl = !LTR_LETTER.test(c);
    const last = runs[runs.length - 1];
    if (last && last.rtl === rtl) {
      last.text += c;
    } else {
      runs.push({ rtl, text: c });
    }
  }
  const drawn = runs.map(({ rtl, text }) =>
    rtl
      ? [...text]
          .reverse()
          .map((c) => MIRRORED[c] ?? c)
          .join('')
      : text,
  );

  return (isRtl(word) ? drawn.reverse() : drawn).join('');
};

/**
 * The title as words to place in a wrapping row, `null` when the card fonts
 * can't draw it. For a right-to-left title the words come in the order a
 * `row-reverse` row places them from the right.
 */
export const previewTitle = (title: string) => {
  const text = title.replace(MARKS, '').replace(/\s+/g, ' ').trim();
  if (!SUPPORTED.test(text)) {
    return null;
  }

  const rtl = isRtl(text) ?? false;
  const words: string[] = [];
  // Words running against the title's direction stay together as one item,
  // drawn left to right, so a line break can't split the run in the wrong
  // place: English in a Hebrew title in its own order, Hebrew in an English
  // title from its last word
  let against: string[] = [];
  const flush = () => {
    if (against.length) {
      words.push((rtl ? against : against.reverse()).join(' '));
    }
    against = [];
  };
  for (const word of text.split(' ')) {
    // A number stays with the run it is in ("React 18 Native")
    const direction = DIGITS.test(word)
      ? against.length
        ? !rtl
        : undefined
      : isRtl(word);
    if (direction !== undefined && direction !== rtl) {
      against.push(visualWord(word));
    } else {
      flush();
      words.push(visualWord(word));
    }
  }
  flush();

  return { rtl, words };
};
