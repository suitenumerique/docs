import { Button } from '@openfun/cunningham-react';
import React from 'react';
import styled from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { DatabaseSourceSelector } from '@/docs/doc-editor/components/DatabaseSourceSelector';
import { useGristCreateDocAndTable } from '@/features/grist/useGristCreateTable';

import { useDocStore } from '../../doc-management';

type DatabaseSelectorProps = {
  onDatabaseSelected: (args: { documentId: string; tableId: string }) => void;
  allowCreateSource?: boolean;
};

export const DatabaseSelector = ({
  onDatabaseSelected,
  allowCreateSource = false,
}: DatabaseSelectorProps) => {
  const { createTable } = useGristCreateDocAndTable();
  const { currentDoc } = useDocStore();

  const handleCreateNewDatabase = () => {
    if (!currentDoc) {
      console.error('No current document found to create a new database.');
      return;
    }
    createTable(currentDoc.title ?? currentDoc.id)
      .then(({ documentId, tableId }) => {
        onDatabaseSelected({ documentId, tableId });
      })
      .catch((error) => {
        console.error('Error creating new database:', error);
      });
  };

  return (
    <Wrapper>
      <Box
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgb(133, 184, 255)',
        }}
      >
        <Icon iconName="storage" color="rgb(62, 152, 255)" />
      </Box>
      <Title>Source de données</Title>
      {allowCreateSource && (
        <Description>Choisissez votre méthode de création</Description>
      )}
      <OptionsWrapper>
        {allowCreateSource && (
          <>
            <Option>
              <Box
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <OptionTitle>
                    Créer une nouvelle base de données vide
                  </OptionTitle>
                  <Description>
                    Partir d&apos;une base de données vierge
                  </Description>
                </Box>
                <Button
                  onClick={handleCreateNewDatabase}
                  icon={<Icon iconName="add" $color="white" />}
                ></Button>
              </Box>
            </Option>
            <Text style={{ fontWeight: 600, fontSize: 14 }}>ou</Text>
          </>
        )}
        <Option>
          <Box style={{ marginBottom: 10 }}>
            <OptionTitle>
              Sélectionner une base de données existante
            </OptionTitle>
            <Description>
              Connecter une base de données Grist déjà créée
            </Description>
          </Box>
          <DatabaseSourceSelector onSourceSelected={onDatabaseSelected} />
        </Option>
      </OptionsWrapper>
    </Wrapper>
  );
};

const Wrapper = styled(Box)`
  border: 2px solid rgb(160, 207, 255);
  background-color: rgb(230, 243, 255);
  border-radius: 4px;
  width: 100%;
  padding: 16px;
  align-items: center;
  gap: 10px;
`;

const Title = styled(Text)`
  font-weight: 800;
  font-size: 18px;
`;

const Description = styled(Text)`
  color: rgb(110, 110, 110);
  font-size: 14px;
`;

const OptionTitle = styled(Text)`
  font-weight: 600;
  font-size: 14px;
`;

const Option = styled(Box)`
  width: 100%;
  border: 1px solid rgb(180, 180, 180);
  border-radius: 4px;
  padding: 8px 16px;
`;

const OptionsWrapper = styled(Box)`
  width: 100%;
  gap: 5px;
  align-items: center;
`;
