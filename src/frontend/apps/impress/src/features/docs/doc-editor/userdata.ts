import type { User } from '@blocknote/core/comments';
const colors = [
  '#958DF1',
  '#F98181',
  '#FBBC88',
  '#FAF594',
  '#70CFF8',
  '#94FADB',
  '#B9F18D',
];

const getRandomElement = (list: unknown[]) =>
  list[Math.floor(Math.random() * list.length)];

export const getRandomColor = () => getRandomElement(colors);
export type MyUserType = User & {
  role: 'editor' | 'comment';
};
export const HARDCODED_USERS: MyUserType[] = [
  {
    id: 'fe07a07c-6247-47cc-a836-4c29de25d5c0',
    username: 'John Doe',
    avatarUrl: 'https://placehold.co/100x100?text=John',
    role: 'editor',
  },
  {
    id: '2',
    username: 'Jane Doe',
    avatarUrl: 'https://placehold.co/100x100?text=Jane',
    role: 'editor',
  },
  {
    id: '3',
    username: 'Bob Smith',
    avatarUrl: 'https://placehold.co/100x100?text=Bob',
    role: 'comment',
  },
  {
    id: '4',
    username: 'Betty Smith',
    avatarUrl: 'https://placehold.co/100x100?text=Betty',
    role: 'comment',
  },
];
