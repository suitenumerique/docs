/**
 * "emoji-mart" is a singleton, multiple imports in the same
 * application could cause issues.
 * BlockNote uses "emoji-mart" internally as well, if
 * Blocknote emoji picker is init before the callout emoji picker,
 * the callout emoji picker will not be set up correctly.
 * To avoid this, we initialize emoji-mart here and before any
 * other components that uses it.
 */
import data, { Category, EmojiMartData } from '@emoji-mart/data';
import { init } from 'emoji-mart';

type EmojiMartDataFixed = Omit<EmojiMartData, 'categories'> & {
  categories: (Category & { name: string })[];
};

const emojidata = structuredClone(data) as EmojiMartDataFixed;

const CALLOUT_ID = 'callout';
const CALLOUT_EMOJIS = [
  'bulb',
  'point_right',
  'point_up',
  'ok_hand',
  'key',
  'construction',
  'warning',
  'fire',
  'pushpin',
  'scissors',
  'question',
  'no_entry',
  'no_entry_sign',
  'alarm_clock',
  'phone',
  'rotating_light',
  'recycle',
  'white_check_mark',
  'lock',
  'paperclip',
  'book',
  'speaking_head_in_silhouette',
  'arrow_right',
  'loudspeaker',
  'hammer_and_wrench',
  'gear',
];

if (!emojidata.categories.some((c) => c.id === CALLOUT_ID)) {
  emojidata.categories.unshift({
    id: CALLOUT_ID,
    name: 'Callout',
    emojis: CALLOUT_EMOJIS,
  });
}

void init({ data: emojidata });

const calloutCategories = [
  'callout',
  'people',
  'nature',
  'foods',
  'activity',
  'places',
  'flags',
  'objects',
  'symbols',
];

const calloutEmojiData = {
  emojidata,
  calloutCategories,
};

export default calloutEmojiData;
