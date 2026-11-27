/**
 * Documents as the Yjs 13 editor wrote them, to check that the legacy corpus
 * still opens once it has been migrated to Yjs 14.
 *
 * `legacyDocuments.test.ts` checks each of them in the Yjs 14 editor, and
 * writes them to `src/backend/demo/data/legacy_documents.json`, the fixture
 * the `create_legacy_documents` command seeds the preview environments with.
 *
 * The ids are fixed so that the documents can point to each other (doc links,
 * children) and to their attachments, uploaded by the seed under
 * `{docId}/attachments/`. The media urls are relative: the editor stores them
 * absolute, but the host of a preview environment is only known there.
 *
 * The seed gives every run fresh ids: these ones, documents, threads, owner
 * and users, are swapped in the content for the ids of the run, which only
 * works with uuids of the same length.
 */

export const LEGACY_ROOT_ID = '6c0d1d6e-7a3e-4c5e-9a51-000000000000';
export const LEGACY_BLOCKS_ID = '6c0d1d6e-7a3e-4c5e-9a51-000000000001';
export const LEGACY_INLINE_ID = '6c0d1d6e-7a3e-4c5e-9a51-000000000002';
export const LEGACY_REVISIONS_ID = '6c0d1d6e-7a3e-4c5e-9a51-000000000003';
export const LEGACY_LONG_ID = '6c0d1d6e-7a3e-4c5e-9a51-000000000004';

export const LEGACY_AUTHORS_ID = '6c0d1d6e-7a3e-4c5e-9a51-000000000005';
export const LEGACY_HISTORY_ID = '6c0d1d6e-7a3e-4c5e-9a51-000000000006';

/** The user the seed creates, mentioned in the documents. */
export const LEGACY_OWNER = {
  id: '6c0d1d6e-7a3e-4c5e-9a51-0000000000aa',
  fullName: 'Docs',
};

/**
 * Editors of the documents, who change them once migrated: their edits are
 * attributed to them, the legacy content to `system`.
 */
export const LEGACY_USERS = {
  alice: {
    id: '6c0d1d6e-7a3e-4c5e-9a51-0000000000b1',
    email: 'alice@example.com',
    fullName: 'Alice Martin',
  },
  bob: {
    id: '6c0d1d6e-7a3e-4c5e-9a51-0000000000b2',
    email: 'bob@example.com',
    fullName: 'Bob Dupont',
  },
  chloe: {
    id: '6c0d1d6e-7a3e-4c5e-9a51-0000000000b3',
    email: 'chloe@example.com',
    fullName: 'Chloé Bernard',
  },
};

export type LegacyUser = keyof typeof LEGACY_USERS;

/**
 * The operations of the Yjs 14 editor an edit is made of. Typed loosely: the
 * test hands the real editor over.
 */
export interface LegacyEditActions {
  document: { id: string; content?: unknown }[];
  replaceBlocks: (ids: string[], blocks: LegacyBlock[]) => unknown;
  insertBlocks: (
    blocks: LegacyBlock[],
    reference: string,
    placement: 'before' | 'after',
  ) => unknown;
  updateBlock: (id: string, update: LegacyBlock) => unknown;
  removeBlocks: (ids: string[]) => unknown;
  /** Put a comment mark of the thread on the whole content of the block. */
  comment: (blockId: string, threadId: string) => void;
}

export interface LegacyEdit {
  user: LegacyUser;
  /**
   * How long before the seed the edit was made, so that the history spreads
   * over days. Without it, the edit is made when the seed runs.
   */
  minutesAgo?: number;
  /** What the user does in the editor. */
  apply: (editor: LegacyEditActions) => void;
  /** A thread this user starts on a block, created by the seed. */
  thread?: LegacyThread;
}

/** The kinds of attachment the seed knows how to generate. */
export type LegacyAttachmentKind = 'png' | 'pdf' | 'wav' | 'txt';

export interface LegacyAttachment {
  /** The name of the file in the bucket: a uuid, as the media urls require. */
  name: string;
  kind: LegacyAttachmentKind;
}

export interface LegacyThread {
  id: string;
  /** The block whose content, inline nodes included, carries the comment. */
  blockId: string;
  comment: string;
}

/** Loosely typed: the blocks are checked against the schema when converted. */
export type LegacyBlock = Record<string, unknown>;

export interface LegacyDocument {
  id: string;
  title: string;
  parentId?: string;
  /**
   * Successive states of the document, each saved as an S3 version of
   * `{id}/file` like Django did: the soft migration seeds the last one, the
   * full migration replays them all. None for a document born after the
   * migration, written by its edits alone.
   */
  revisions: LegacyBlock[][];
  attachments?: LegacyAttachment[];
  threads?: LegacyThread[];
  /**
   * Made once the document is migrated, in order, each by a user through the
   * Yjs 14 editor: the seed writes them into the collaboration server in the
   * name of that user.
   */
  edits?: LegacyEdit[];
}

const media = (docId: string, name: string) =>
  `/media/${docId}/attachments/${name}`;

const text = (value: string, styles: Record<string, unknown> = {}) => ({
  type: 'text',
  text: value,
  styles,
});

const COLORS = { textColor: 'red', backgroundColor: 'yellow' };

/** The files of the attachments: the media urls only take uuids. */
const FILES = {
  png: '6c0d1d6e-7a3e-4c5e-9a51-0000000000f1.png',
  pdf: '6c0d1d6e-7a3e-4c5e-9a51-0000000000f2.pdf',
  wav: '6c0d1d6e-7a3e-4c5e-9a51-0000000000f3.wav',
  txt: '6c0d1d6e-7a3e-4c5e-9a51-0000000000f4.txt',
};

const rootDocument: LegacyDocument = {
  id: LEGACY_ROOT_ID,
  title: 'Legacy documents (Yjs 13)',
  revisions: [
    [
      {
        type: 'heading',
        props: { level: 1 },
        content: 'Legacy documents (Yjs 13)',
      },
      {
        type: 'paragraph',
        content:
          'These documents were saved by the Yjs 13 editor, as the documents written before the migration to Yjs 14. Open each of them and check that nothing is missing.',
      },
      { type: 'docChildren' },
    ],
  ],
};

const blocksDocument: LegacyDocument = {
  id: LEGACY_BLOCKS_ID,
  parentId: LEGACY_ROOT_ID,
  title: 'Every block',
  attachments: [
    { name: FILES.png, kind: 'png' },
    { name: FILES.pdf, kind: 'pdf' },
    { name: FILES.wav, kind: 'wav' },
    { name: FILES.txt, kind: 'txt' },
  ],
  revisions: [
    [
      { type: 'heading', props: { level: 1 }, content: 'Heading 1' },
      { type: 'heading', props: { level: 2 }, content: 'Heading 2' },
      { type: 'heading', props: { level: 3 }, content: 'Heading 3' },
      { type: 'heading', props: { level: 4 }, content: 'Heading 4' },
      { type: 'heading', props: { level: 5 }, content: 'Heading 5' },
      { type: 'heading', props: { level: 6 }, content: 'Heading 6' },
      {
        type: 'heading',
        props: { level: 2, isToggleable: true },
        content: 'Toggleable heading',
        children: [{ type: 'paragraph', content: 'Inside the heading' }],
      },
      {
        type: 'paragraph',
        props: { textAlignment: 'center', ...COLORS },
        content: 'A centered paragraph, in color',
      },
      {
        type: 'paragraph',
        props: { textAlignment: 'right' },
        content: 'A paragraph aligned right',
      },
      {
        type: 'paragraph',
        props: { textAlignment: 'justify' },
        content:
          'A justified paragraph, long enough to wrap on a few lines so that the justification shows: the quick brown fox jumps over the lazy dog, again and again.',
      },
      { type: 'paragraph', content: 'פסקה בעברית, מימין לשמאל' },
      { type: 'quote', props: COLORS, content: 'A quote' },
      {
        type: 'bulletListItem',
        content: 'Bullet item',
        children: [
          {
            type: 'bulletListItem',
            content: 'Nested bullet item',
            children: [
              { type: 'bulletListItem', content: 'Deeply nested bullet' },
            ],
          },
        ],
      },
      { type: 'numberedListItem', content: 'Numbered item' },
      {
        type: 'numberedListItem',
        content: 'Second numbered item',
        children: [{ type: 'numberedListItem', content: 'Nested numbered' }],
      },
      {
        type: 'numberedListItem',
        props: { start: 5 },
        content: 'Numbered from 5',
      },
      { type: 'checkListItem', content: 'Unchecked item' },
      {
        type: 'checkListItem',
        props: { checked: true },
        content: 'Checked item',
      },
      {
        type: 'toggleListItem',
        content: 'Toggle item',
        children: [{ type: 'paragraph', content: 'Inside the toggle' }],
      },
      {
        id: 'legacy-blocks-callout',
        type: 'callout',
        props: { emoji: '⚠️', backgroundColor: 'orange' },
        content: [text('A callout with '), text('bold', { bold: true })],
      },
      {
        id: 'legacy-blocks-code',
        type: 'codeBlock',
        props: { language: 'typescript' },
        content: 'const answer: number = 42;\nconsole.log(answer);',
      },
      {
        // the language name the former code block stored
        type: 'codeBlock',
        props: { language: 'js' },
        content: 'const legacy = true;',
      },
      { type: 'mathBlock', content: 'e^{i\\pi} + 1 = 0' },
      {
        type: 'diagram',
        content: 'graph TD;\n  A[Yjs 13] --> B[Yjs 14];',
      },
      { type: 'divider' },
      {
        type: 'table',
        content: {
          type: 'tableContent',
          headerRows: 1,
          columnWidths: [200, undefined, undefined],
          rows: [
            { cells: ['Header 1', 'Header 2', 'Header 3'] },
            {
              cells: [
                [text('Bold cell', { bold: true })],
                {
                  type: 'tableCell',
                  props: { colspan: 2, backgroundColor: 'blue' },
                  content: [text('Merged cells')],
                },
              ],
            },
            {
              cells: [
                {
                  type: 'tableCell',
                  props: { textAlignment: 'center', textColor: 'green' },
                  content: [text('Centered')],
                },
                'Plain',
                '',
              ],
            },
          ],
        },
      },
      {
        type: 'columnList',
        children: [
          {
            type: 'column',
            props: { width: 1.5 },
            children: [
              { type: 'paragraph', content: 'Left column' },
              { type: 'bulletListItem', content: 'A list in a column' },
            ],
          },
          {
            type: 'column',
            props: { width: 0.5 },
            children: [{ type: 'paragraph', content: 'Right column' }],
          },
        ],
      },
      { type: 'pageBreak' },
      {
        type: 'image',
        props: {
          url: media(LEGACY_BLOCKS_ID, FILES.png),
          name: 'legacy-image.png',
          caption: 'An uploaded image',
          previewWidth: 320,
          textAlignment: 'center',
        },
      },
      {
        type: 'pdf',
        props: {
          url: media(LEGACY_BLOCKS_ID, FILES.pdf),
          name: 'legacy.pdf',
          caption: 'An uploaded PDF',
        },
      },
      {
        type: 'audio',
        props: {
          url: media(LEGACY_BLOCKS_ID, FILES.wav),
          name: 'legacy-audio.wav',
          caption: 'An uploaded audio file',
        },
      },
      {
        type: 'video',
        props: {
          // the seed has no video encoder: a video element plays the sound
          url: media(LEGACY_BLOCKS_ID, FILES.wav),
          name: 'legacy-video.wav',
          caption: 'A video block',
        },
      },
      {
        type: 'file',
        props: {
          url: media(LEGACY_BLOCKS_ID, FILES.txt),
          name: 'legacy-file.txt',
          caption: 'An uploaded file',
        },
      },
      {
        // saved while a file was still being analysed: an editor opening the
        // document turns it into an image, the seed marks the file as ready
        type: 'uploadLoader',
        props: {
          information: 'Analyzing file...',
          type: 'loading',
          blockUploadName: 'legacy-image.png',
          blockUploadType: 'image',
          blockUploadUrl: `/api/v1.0/documents/${LEGACY_BLOCKS_ID}/media-check/?key=${LEGACY_BLOCKS_ID}/attachments/${FILES.png}`,
          blockUploadShowPreview: true,
          blockUploadCaption: '',
          blockUploadTextAlignment: 'left',
        },
      },
      { type: 'paragraph', content: '' },
    ],
  ],
  edits: [
    {
      user: 'alice',
      apply: (editor) => {
        editor.updateBlock('legacy-blocks-callout', {
          content: [
            text('A callout with '),
            text('bold', { bold: true }),
            text(', completed by Alice'),
          ],
        });
      },
    },
    {
      user: 'bob',
      apply: (editor) => {
        editor.updateBlock('legacy-blocks-code', {
          content:
            'const answer: number = 42;\n// Bob adds this line\nconsole.log(answer);',
        });
      },
    },
  ],
};

const COMMENTED_TEXT_ID = 'legacy-inline-commented-text';
const COMMENTED_NODES_ID = 'legacy-inline-commented-nodes';

const inlineDocument: LegacyDocument = {
  id: LEGACY_INLINE_ID,
  parentId: LEGACY_ROOT_ID,
  title: 'Inline content and styles',
  threads: [
    {
      id: '6c0d1d6e-7a3e-4c5e-9a51-0000000000c1',
      blockId: COMMENTED_TEXT_ID,
      comment: 'A comment on some text',
    },
    {
      id: '6c0d1d6e-7a3e-4c5e-9a51-0000000000c2',
      blockId: COMMENTED_NODES_ID,
      comment: 'A comment on a doc link and a mention',
    },
  ],
  revisions: [
    [
      {
        type: 'paragraph',
        content: [
          text('Bold', { bold: true }),
          text(' '),
          text('italic', { italic: true }),
          text(' '),
          text('underline', { underline: true }),
          text(' '),
          text('strike', { strike: true }),
          text(' '),
          text('code', { code: true }),
          text(' '),
          text('all at once', {
            bold: true,
            italic: true,
            underline: true,
            strike: true,
          }),
        ],
      },
      {
        type: 'paragraph',
        content: [
          text('Red text', { textColor: 'red' }),
          text(' '),
          text('on yellow', { backgroundColor: 'yellow' }),
          text(' '),
          text('purple on gray', {
            textColor: 'purple',
            backgroundColor: 'gray',
          }),
        ],
      },
      {
        type: 'paragraph',
        content: [
          text('A link to '),
          {
            type: 'link',
            href: 'https://docs.numerique.gouv.fr',
            content: [text('Docs, in bold', { bold: true })],
          },
          text(' and inline math '),
          { type: 'math', content: 'a^2 + b^2 = c^2' },
          text('.'),
        ],
      },
      {
        type: 'paragraph',
        content: [
          text('A link to another document: '),
          {
            type: 'interlinkingLinkInline',
            props: { docId: LEGACY_BLOCKS_ID },
          },
          text(', and to a block of it: '),
          {
            type: 'interlinkingLinkInline',
            props: { docId: LEGACY_BLOCKS_ID, blockId: 'missing-block' },
          },
          text('.'),
        ],
      },
      {
        type: 'paragraph',
        content: [
          text('A doc link in its former search state: '),
          {
            type: 'interlinkingLinkInline',
            props: { disabled: true, trigger: '@' },
          },
          text(', and a search left open: '),
          { type: 'mentionSearchInline', props: { trigger: '@' } },
        ],
      },
      {
        type: 'paragraph',
        content: [
          text('A mention of '),
          {
            type: 'userMentionInline',
            props: { userId: LEGACY_OWNER.id, fullName: LEGACY_OWNER.fullName },
          },
          text('.'),
        ],
      },
      {
        id: COMMENTED_TEXT_ID,
        type: 'paragraph',
        content: [text('This sentence is commented.')],
      },
      {
        id: COMMENTED_NODES_ID,
        type: 'paragraph',
        content: [
          text('Commented doc link '),
          {
            type: 'interlinkingLinkInline',
            props: { docId: LEGACY_BLOCKS_ID },
          },
          text(' and mention '),
          {
            type: 'userMentionInline',
            props: { userId: LEGACY_OWNER.id, fullName: LEGACY_OWNER.fullName },
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          text('Emoji 🎉, accents àéîõü, CJK 中文, and a very '),
          text('long '.repeat(40)),
          text('line.'),
        ],
      },
    ],
  ],
};

/** One block per id, so that the revisions edit them rather than replace them. */
const revisionBlock = (id: string, block: LegacyBlock) => ({
  id: `legacy-revision-${id}`,
  ...block,
});

const revisionsDocument: LegacyDocument = {
  id: LEGACY_REVISIONS_ID,
  parentId: LEGACY_ROOT_ID,
  title: 'Edited many times',
  revisions: [
    [
      revisionBlock('title', {
        type: 'heading',
        props: { level: 1 },
        content: 'First draft',
      }),
      revisionBlock('intro', {
        type: 'paragraph',
        content: 'Written once, then edited.',
      }),
      revisionBlock('removed', {
        type: 'paragraph',
        content: 'This paragraph is removed by the third revision.',
      }),
      revisionBlock('todo', { type: 'checkListItem', content: 'Review' }),
    ],
    [
      revisionBlock('title', {
        type: 'heading',
        props: { level: 1 },
        content: 'Second draft',
      }),
      revisionBlock('intro', {
        type: 'paragraph',
        content: [
          text('Written once, then '),
          text('edited', { bold: true }),
          text(' a second time.'),
        ],
      }),
      revisionBlock('removed', {
        type: 'paragraph',
        content: 'This paragraph is removed by the third revision.',
      }),
      revisionBlock('added', {
        type: 'bulletListItem',
        content: 'Added by the second revision',
      }),
      revisionBlock('todo', { type: 'checkListItem', content: 'Review' }),
    ],
    [
      revisionBlock('title', {
        type: 'heading',
        props: { level: 2 },
        content: 'Final version',
      }),
      revisionBlock('todo', {
        type: 'checkListItem',
        props: { checked: true },
        content: 'Review',
      }),
      revisionBlock('intro', {
        type: 'paragraph',
        content: [
          text('Written once, then '),
          text('edited', { bold: true, italic: true }),
          text(' three times, and moved below the checklist.'),
        ],
      }),
      revisionBlock('added', {
        type: 'bulletListItem',
        content: 'Added by the second revision',
        children: [
          revisionBlock('nested', {
            type: 'bulletListItem',
            content: 'Nested by the third revision',
          }),
        ],
      }),
      revisionBlock('table', {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [{ cells: ['Added', 'by the'] }, { cells: ['third', 'one'] }],
        },
      }),
    ],
  ],
};

const SECTIONS = 60;

const longDocument: LegacyDocument = {
  id: LEGACY_LONG_ID,
  parentId: LEGACY_ROOT_ID,
  title: 'Long document',
  revisions: [
    Array.from({ length: SECTIONS }, (_, section) => [
      {
        type: 'heading',
        props: { level: 2 },
        content: `Section ${section + 1}`,
      },
      ...Array.from({ length: 3 }, (__, paragraph) => ({
        type: 'paragraph',
        content: [
          text(`Paragraph ${paragraph + 1} of section ${section + 1}. `),
          text('Lorem ipsum dolor sit amet, ', { italic: true }),
          text(
            'consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          ),
        ],
      })),
      {
        type: 'bulletListItem',
        content: `A list item of section ${section + 1}`,
      },
    ]).flat(),
  ],
};

/** One block per id, so that the users edit the legacy blocks. */
const authorsBlock = (id: string, block: LegacyBlock) => ({
  id: `legacy-authors-${id}`,
  ...block,
});

const authorsDocument: LegacyDocument = {
  id: LEGACY_AUTHORS_ID,
  parentId: LEGACY_ROOT_ID,
  title: 'Written by several users',
  revisions: [
    [
      authorsBlock('title', {
        type: 'heading',
        props: { level: 1 },
        content: 'Written by several users',
      }),
      authorsBlock('legacy', {
        type: 'paragraph',
        content:
          'This paragraph was written before the migration, by nobody known: it is attributed to the system.',
      }),
      authorsBlock('edited', {
        type: 'paragraph',
        content: 'Alice adds a sentence at the end of this legacy paragraph.',
      }),
      authorsBlock('formatted', {
        type: 'paragraph',
        content: 'Bob makes a word of this legacy paragraph bold.',
      }),
      authorsBlock('deleted', {
        type: 'paragraph',
        content: 'Bob deletes this legacy paragraph.',
      }),
      authorsBlock('list', {
        type: 'bulletListItem',
        content: 'A legacy list item',
      }),
    ],
  ],
  edits: [
    {
      user: 'alice',
      apply: (editor) => {
        editor.updateBlock('legacy-authors-edited', {
          content: [
            text('Alice adds a sentence at the end of this legacy paragraph.'),
            text(' This sentence is written by Alice.'),
          ],
        });
        editor.insertBlocks(
          [
            authorsBlock('alice', {
              type: 'paragraph',
              content: 'A paragraph written by Alice, after the migration.',
            }),
            authorsBlock('alice-todo', {
              type: 'checkListItem',
              content: 'A task Alice adds',
            }),
          ],
          'legacy-authors-edited',
          'after',
        );
      },
    },
    {
      user: 'bob',
      apply: (editor) => {
        editor.updateBlock('legacy-authors-formatted', {
          content: [
            text('Bob makes a '),
            text('word', { bold: true }),
            text(' of this legacy paragraph bold.'),
          ],
        });
        editor.removeBlocks(['legacy-authors-deleted']);
        // a change to what another user wrote
        editor.updateBlock('legacy-authors-alice', {
          content:
            'A paragraph written by Alice, after the migration, and completed by Bob.',
        });
        editor.updateBlock('legacy-authors-alice-todo', {
          props: { checked: true },
        });
      },
    },
    {
      user: 'chloe',
      thread: {
        id: '6c0d1d6e-7a3e-4c5e-9a51-0000000000c3',
        blockId: 'legacy-authors-legacy',
        comment: 'Chloé comments on the legacy paragraph',
      },
      apply: (editor) => {
        editor.comment(
          'legacy-authors-legacy',
          '6c0d1d6e-7a3e-4c5e-9a51-0000000000c3',
        );
        editor.insertBlocks(
          [
            authorsBlock('chloe', {
              type: 'callout',
              content: [
                text('Chloé adds a callout mentioning '),
                {
                  type: 'userMentionInline',
                  props: {
                    userId: LEGACY_USERS.alice.id,
                    fullName: LEGACY_USERS.alice.fullName,
                  },
                },
              ],
            }),
            authorsBlock('chloe-table', {
              type: 'table',
              content: {
                type: 'tableContent',
                rows: [
                  { cells: ['Author', 'Part'] },
                  { cells: ['Chloé', 'This table'] },
                ],
              },
            }),
          ],
          'legacy-authors-list',
          'after',
        );
      },
    },
  ],
};

/** One block per id, so that the edits change the blocks of the others. */
const historyBlock = (id: string, block: LegacyBlock) => ({
  id: `legacy-history-${id}`,
  ...block,
});

const HOUR = 60;
const DAY = 24 * HOUR;

const goal = (id: string, content: LegacyBlock['content']) =>
  historyBlock(`goal-${id}`, { type: 'bulletListItem', content });

/**
 * Born after the migration and written over ten days by the three users, to
 * check the version history: a session grouped into one version, versions by
 * two users at once, rewrites, formatting, moves, deletions and a comment.
 */
const historyDocument: LegacyDocument = {
  id: LEGACY_HISTORY_ID,
  parentId: LEGACY_ROOT_ID,
  title: 'Version history',
  revisions: [],
  edits: [
    {
      user: 'alice',
      minutesAgo: 10 * DAY,
      apply: (editor) => {
        editor.replaceBlocks(
          editor.document.map(({ id }) => id),
          [
            historyBlock('title', {
              type: 'heading',
              props: { level: 1 },
              content: 'Project plan',
            }),
            historyBlock('intro', {
              type: 'paragraph',
              content: 'A first draft of the plan, writen by Alice.',
            }),
            historyBlock('goals', {
              type: 'heading',
              props: { level: 2 },
              content: 'Goals',
            }),
            goal('1', 'Migrate every document'),
            goal('2', 'Keep the history of the documents'),
            goal('3', 'Show who wrote what'),
            historyBlock('timeline', {
              type: 'heading',
              props: { level: 2 },
              content: 'Timeline',
            }),
            historyBlock('timeline-text', {
              type: 'paragraph',
              content: 'To be decided.',
            }),
          ],
        );
      },
    },
    {
      // the same session: grouped with the previous edit into one version
      user: 'alice',
      minutesAgo: 10 * DAY - 3,
      apply: (editor) => {
        editor.insertBlocks(
          [
            historyBlock('task-1', {
              type: 'checkListItem',
              content: 'Write the migration',
            }),
            historyBlock('task-2', {
              type: 'checkListItem',
              content: 'Test it on the legacy documents',
            }),
          ],
          'legacy-history-goal-3',
          'after',
        );
      },
    },
    {
      user: 'bob',
      minutesAgo: 9 * DAY,
      apply: (editor) => {
        editor.updateBlock('legacy-history-intro', {
          content: 'A first draft of the plan, written by Alice.',
        });
        editor.replaceBlocks(
          ['legacy-history-timeline-text'],
          [
            historyBlock('timeline-table', {
              type: 'table',
              content: {
                type: 'tableContent',
                headerRows: 1,
                rows: [
                  { cells: ['Phase', 'When'] },
                  { cells: ['Migration', 'January'] },
                  { cells: ['Version history', 'March'] },
                ],
              },
            }),
          ],
        );
      },
    },
    {
      user: 'chloe',
      minutesAgo: 8 * DAY,
      apply: (editor) => {
        editor.insertBlocks(
          [
            historyBlock('budget', {
              type: 'callout',
              props: { emoji: '💶' },
              content: 'The budget is approved.',
            }),
            historyBlock('quote', {
              type: 'quote',
              content: 'Nothing is lost, everything is versioned.',
            }),
          ],
          'legacy-history-intro',
          'after',
        );
      },
    },
    {
      user: 'alice',
      minutesAgo: 7 * DAY,
      apply: (editor) => {
        // a rewrite of the whole paragraph
        editor.updateBlock('legacy-history-intro', {
          content: [
            text('This plan describes how the documents move to the new '),
            text('collaboration server', { bold: true }),
            text(', and what the users will see of their history.'),
          ],
        });
        editor.updateBlock('legacy-history-timeline', {
          props: { level: 3 },
        });
      },
    },
    {
      // two minutes later, by another user: one version by both of them
      user: 'bob',
      minutesAgo: 7 * DAY - 2,
      apply: (editor) => {
        editor.updateBlock('legacy-history-goal-2', {
          content: [
            text('Keep the '),
            text('whole', { italic: true }),
            text(' history of the documents'),
          ],
        });
        editor.updateBlock('legacy-history-goal-3', {
          content: [text('Show who wrote what', { bold: true })],
        });
      },
    },
    {
      user: 'bob',
      minutesAgo: 5 * DAY,
      apply: (editor) => {
        editor.removeBlocks(['legacy-history-quote', 'legacy-history-goal-1']);
        // the timeline moves above the goals
        editor.removeBlocks([
          'legacy-history-timeline',
          'legacy-history-timeline-table',
        ]);
        editor.insertBlocks(
          [
            historyBlock('timeline-moved', {
              type: 'heading',
              props: { level: 2 },
              content: 'Timeline',
            }),
            historyBlock('timeline-table-moved', {
              type: 'table',
              content: {
                type: 'tableContent',
                headerRows: 1,
                rows: [
                  { cells: ['Phase', 'When'] },
                  { cells: ['Migration', 'January'] },
                  { cells: ['Version history', 'March'] },
                ],
              },
            }),
          ],
          'legacy-history-goals',
          'before',
        );
      },
    },
    {
      user: 'chloe',
      minutesAgo: 3 * DAY,
      thread: {
        id: '6c0d1d6e-7a3e-4c5e-9a51-0000000000c4',
        blockId: 'legacy-history-intro',
        comment: 'Chloé asks for the date of the migration',
      },
      apply: (editor) => {
        editor.updateBlock('legacy-history-task-1', {
          props: { checked: true },
        });
        editor.comment(
          'legacy-history-intro',
          '6c0d1d6e-7a3e-4c5e-9a51-0000000000c4',
        );
        editor.insertBlocks(
          [
            historyBlock('next', {
              type: 'heading',
              props: { level: 2 },
              content: 'Next steps',
            }),
            historyBlock('next-1', {
              type: 'numberedListItem',
              content: 'Announce the migration',
            }),
            historyBlock('next-2', {
              type: 'numberedListItem',
              content: 'Train the users',
            }),
          ],
          'legacy-history-task-2',
          'after',
        );
      },
    },
    {
      // a large deletion
      user: 'alice',
      minutesAgo: DAY,
      apply: (editor) => {
        editor.removeBlocks([
          'legacy-history-timeline-moved',
          'legacy-history-timeline-table-moved',
          'legacy-history-budget',
        ]);
      },
    },
    {
      user: 'bob',
      minutesAgo: 2 * HOUR,
      apply: (editor) => {
        editor.updateBlock('legacy-history-task-2', {
          props: { checked: true },
        });
        editor.insertBlocks(
          [
            historyBlock('conclusion', {
              type: 'paragraph',
              content: 'Every step is done, the plan is complette.',
            }),
          ],
          'legacy-history-next-2',
          'after',
        );
      },
    },
    {
      // a typo, fixed a few minutes ago
      user: 'chloe',
      minutesAgo: 20,
      apply: (editor) => {
        editor.updateBlock('legacy-history-conclusion', {
          content: 'Every step is done, the plan is complete.',
        });
      },
    },
  ],
};

export const LEGACY_DOCUMENTS: LegacyDocument[] = [
  rootDocument,
  blocksDocument,
  inlineDocument,
  revisionsDocument,
  longDocument,
  authorsDocument,
  historyDocument,
];
