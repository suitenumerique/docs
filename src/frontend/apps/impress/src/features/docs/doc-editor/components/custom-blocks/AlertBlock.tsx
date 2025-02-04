/* eslint-disable react-hooks/rules-of-hooks */
import { defaultProps, insertOrUpdateBlock } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { Menu } from '@mantine/core';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';

import { DocsBlockNoteEditor } from '../BlockNoteEditor';

// The types of alerts that users can choose from.
export const alertTypes = [
  {
    title: 'Warning',
    value: 'warning',
    icon: 'warning',
    color: 'warning-500',
    backgroundColor: 'warning-300',
  },
  {
    title: 'Error',
    value: 'danger',
    icon: 'error',
    color: 'danger-500',
    backgroundColor: 'danger-300',
  },
  {
    title: 'Info',
    value: 'info',
    icon: 'info',
    color: 'info-500',
    backgroundColor: 'info-300',
  },
  {
    title: 'Success',
    value: 'success',
    icon: 'check_circle',
    color: 'success-500',
    backgroundColor: 'success-100',
  },
] as const;

// The Alert block.
export const AlertBlock = createReactBlockSpec(
  {
    type: 'alert',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      type: {
        default: 'warning',
        values: ['warning', 'danger', 'info', 'success'],
      },
    },
    content: 'inline',
  },
  {
    render: (props) => {
      const { colorsTokens } = useCunninghamTheme();
      const { t } = useTranslation();
      let alertType = alertTypes.find(
        (a) => a.value === props.block.props.type,
      );

      if (!alertType) {
        alertType = alertTypes[0];
      }

      return (
        <Box
          className="alert"
          data-alert-type={props.block.props.type}
          $direction="row"
          $justify="center"
          $align="center"
          $radius="4px"
          $padding="4px"
          $background={colorsTokens()[alertType.backgroundColor]}
          $minHeight="48px"
          $css={css`
            flex-grow: 1;
          `}
        >
          <Menu withinPortal={false}>
            <Menu.Target>
              <Box
                className="alert-icon-wrapper"
                $margin={{ horizontal: '12px' }}
                $radius="16px"
                $justify="center"
                $align="center"
                $height="24px"
                $width="24px"
                contentEditable={false}
                $css="user-select: none; cursor: pointer;"
              >
                <Text
                  $isMaterialIcon
                  $theme={alertType.value}
                  $variation="500"
                  $size="20px"
                >
                  {alertType.icon}
                </Text>
              </Box>
            </Menu.Target>
            <Menu.Dropdown style={{ zIndex: 9999 }}>
              <Menu.Label>{t('Alert Type')}</Menu.Label>
              <Menu.Divider />
              {alertTypes.map((type) => (
                <Menu.Item
                  key={type.value}
                  leftSection={
                    <Text
                      $isMaterialIcon
                      $color={colorsTokens()[type.color]}
                      $size="16px"
                    >
                      {type.icon}
                    </Text>
                  }
                  onClick={() =>
                    props.editor.updateBlock(props.block, {
                      type: 'alert',
                      props: { type: type.value },
                    })
                  }
                >
                  {t(type.title)}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Box
            className="inline-content"
            $css={css`
              flex-grow: 1;
              & * {
                color: ${colorsTokens()[alertType.color]};
              }
            `}
            ref={props.contentRef}
          />
        </Box>
      );
    },
  },
);

export const insertAlert = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
) => ({
  title: t('Alert'),
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: 'alert',
    });
  },
  aliases: [
    'alert',
    'notification',
    'emphasize',
    'warning',
    'error',
    'info',
    'success',
  ],
  group: t('Others'),
  icon: (
    <Text $isMaterialIcon $size="18px">
      warning
    </Text>
  ),
  subtext: t('Add a colored alert box'),
});
