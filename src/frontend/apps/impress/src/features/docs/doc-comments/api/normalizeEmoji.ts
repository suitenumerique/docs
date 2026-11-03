// The emoji data of the picker adds the variation selector to emojis that
// are already drawn as emojis (a thumbs up), which the backend refuses.
// It is kept on the others (a red heart), where it picks the emoji style.
const REDUNDANT_VARIATION_SELECTOR = /^(\p{Emoji_Presentation})️$/u;

export const normalizeEmoji = (emoji: string) =>
  emoji.replace(REDUNDANT_VARIATION_SELECTOR, '$1');
