/* eslint-disable react-hooks/rules-of-hooks */
import { insertOrUpdateBlock } from '@blocknote/core';
import { BlockTypeSelectItem, createReactBlockSpec } from '@blocknote/react';
import { Button, Input, Modal, ModalSize } from '@openfun/cunningham-react';
import { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';

import { DocsBlockNoteEditor } from '../../types';
import { DatabaseSelector } from '../DatabaseSelector';

import { DatabaseGrid } from './DatabaseBlock/DatabaseGrid';

export const DatabaseBlock = createReactBlockSpec(
  {
    type: 'database',
    propSchema: {
      documentId: {
        type: 'string',
        default: '',
      },
      tableId: {
        type: 'string',
        default: '',
      },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor }) => {
      const getGristApiKey = (): string | null => {
        return localStorage.getItem('grist_api_key');
      };
      const validateGristApiKey = (): void => {
        if (gristApiKeyModal !== null) {
          localStorage.setItem('grist_api_key', gristApiKeyModal);
        }
        setOpenGristApiKeyModal(false);
      };

      const { t: translation } = useTranslation();

      const [gristApiKeyModal, setGristApiKey] = useState<string | null>(
        getGristApiKey,
      );
      const [openGristApiKeyModal, setOpenGristApiKeyModal] = useState<boolean>(
        gristApiKeyModal === null,
      );

      return (
        <Box
          style={{
            flexGrow: 1,
            flexDirection: 'row',
            width: '100%',
          }}
        >
          {block.props.documentId && block.props.tableId ? (
            <Box
              style={{
                height: '100%',
                width: '100%',
                flexDirection: 'row',
              }}
            >
              <DatabaseGrid
                documentId={block.props.documentId}
                tableId={block.props.tableId}
              />
            </Box>
          ) : (
            <DatabaseSelector
              onDatabaseSelected={({ documentId, tableId }) => {
                editor.updateBlock(block, {
                  props: { documentId: documentId.toString(), tableId },
                });
              }}
            />
          )}

          {openGristApiKeyModal && (
            <Modal
              isOpen={openGristApiKeyModal}
              closeOnClickOutside
              data-testid="doc-share-modal"
              aria-label={translation('Configure Grist API Key')}
              size={ModalSize.SMALL}
              onClose={() => setOpenGristApiKeyModal(false)}
              title={
                <Box $align="flex-start">{translation('Base de données')}</Box>
              }
            >
              <Box>
                <Text>
                  Pour synchroniser vos données avec Grist vous devez fournir
                  une clé API.
                </Text>
                <Text style={{ fontWeight: 'bold' }}>
                  Comment obtenir votre clé API :
                </Text>
                <Text>1. Connectez-vous à votre compte Grist</Text>
                <Text>
                  2. Allez dans Paramètres du compte {'>'} API {'>'} Clé API
                </Text>
                <Text>3. Créez une nouvelle clé et copiez-la</Text>
              </Box>
              <Input
                label="Grist API key"
                onChange={(event) => {
                  const value = event.target.value;
                  setGristApiKey(value);
                }}
              />
              <Button onClick={validateGristApiKey}>
                {translation('Valider la clé API')}
              </Button>
            </Modal>
          )}
        </Box>
      );
    },
  },
);

export const getDatabaseReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    title: t('Database'),
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: 'database',
      });
    },
    aliases: ['database', 'db', 'base de donnée'],
    group,
    icon: <Icon iconName="storage" $size="18px" />,
    subtext: t('Create database view synced with Grist'),
  },
];

// TODO: remove if unused
export const getDatabaseFormattingToolbarItems = (
  t: TFunction<'translation', undefined>,
): BlockTypeSelectItem => ({
  name: t('Database'),
  type: 'database',
  icon: () => <Icon iconName="storage" $size="16px" />,
  isSelected: (block) => block.type === 'database',
});
