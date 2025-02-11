import { Button, Input, Loader } from '@openfun/cunningham-react';
import { marked } from 'marked';
import { useState } from 'react';
import styled from 'styled-components';

import { fetchAPI } from '@/api';
import { Box, Text } from '@/components';
import { Doc } from '@/features/docs';

import { useEditorStore } from '../../stores/useEditorStore';

export const AIButtonEl = styled.button`
  background-image: url('/assets/ia_baguette.png');
  background-size: cover;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background-color: transparent;
`;

export const SuggestionButton = styled.button`
  display: flex;
  align-items: center;
  border: none;
  cursor: pointer;
  background-color: white;
  color: var(--c--theme--colors--greyscale-900);
  height: 32px;
  padding: 0 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  &:hover,
  &:focus {
    background-color: var(--c--theme--colors--greyscale-100);
  }

  span.material-icons {
    margin-right: 4px;
  }

  span.sub {
    color: var(--c--theme--colors--greyscale-600);
    margin-left: 4px;
    font-weight: 500;
  }
`;

export const AiButton = ({ doc }: { doc: Doc }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Box
        $position="absolute"
        $css={`
        right: 0;
        bottom: 0;
        padding: 1rem;
        margin: 1rem;
        z-index: 1;
        
        `}
      >
        <AIButtonEl
          aria-label="Posez une question à Albert à propos de ce document"
          onClick={() => setIsOpen(true)}
        />
      </Box>

      <AiChat doc={doc} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const AiChat = (props: { isOpen: boolean; onClose: () => void; doc: Doc }) => {
  const [prompt, setPrompt] = useState('');
  const { editor } = useEditorStore();
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);

  if (!props.isOpen) {
    return null;
  }

  const newPrompt = async (prompt: string) => {
    if (!editor) {
      return;
    }

    setIsLoading(true);
    setMessages([...messages, { role: 'user', content: prompt }]);

    const editorContentFormatted = await editor.blocksToMarkdownLossy();

    const response = await fetchAPI(`documents/${props.doc.id}/ai-proxy/`, {
      method: 'POST',
      body: JSON.stringify({
        system:
          'You are a helpful assistant. You are given a text in markdown format and you need to answer the question. Here is the text: ' +
          editorContentFormatted,
        text: prompt,
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = (await response.json()) as string;

    console.log('response', data);
    setMessages((messages) => [
      ...messages,
      { role: 'assistant', content: data },
    ]);
    setIsLoading(false);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPrompt(''); // Clear the prompt after submitting the form
    await newPrompt(prompt);
  };

  return (
    <Box
      $position="absolute"
      $css={`
        right: 0;
        bottom: 0;
        padding: 1rem;
        width: 450px;
        min-height: min(61vh, 365px);
            box-shadow: rgba(15, 15, 15, 0.04) 0px 0px 0px 1px, rgba(15, 15, 15, 0.03) 0px 3px 6px, rgba(15, 15, 15, 0.06) 0px 9px 24px;
        max-height: max(-180px + 100vh, 365px);
        overflow-y: auto;
        border-radius: 16px;
        background-color: white;
        margin: 1rem;
        z-index: 2;
      `}
      $direction="column"
    >
      <Box $direction="row" $align="center" $justify="space-between">
        <Text $theme="greyscale" $variation="1000" $weight="bold" $size="s">
          {messages.length == 0 ? '' : 'Demander à Albert'}
        </Text>
        <Button
          size="small"
          onClick={props.onClose}
          color="tertiary-text"
          icon={<span className="material-icons">close</span>}
        />
      </Box>
      {messages.length == 0 && (
        <Box $gap="1rem" $position="relative" $css="top: -24px;">
          <Box $gap="0.5rem">
            <Box
              $css={`
            background-image: url('/assets/ia_baguette_question_mark.png');
            background-size: cover;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            `}
            ></Box>
            <Text $theme="primary" $variation="800">
              Bonjour, comment puis-je vous aider ?
            </Text>
          </Box>
          <Box $gap="0.5rem">
            <Text $theme="greyscale" $variation="1000" $weight="bold" $size="s">
              Suggestions
            </Text>
            <Box>
              <SuggestionButton
                onClick={() =>
                  void newPrompt(
                    'Resume ce document sous forme textuelle uniquement',
                  )
                }
              >
                <span className="material-icons">description</span>
                Résumer <span className="sub">cette page</span>
              </SuggestionButton>
              <SuggestionButton
                onClick={() =>
                  void newPrompt('Quel est le sujet principal de ce document ?')
                }
              >
                <span className="material-icons">help_center</span>
                Poser des questions <span className="sub">sur cette page</span>
              </SuggestionButton>
            </Box>
          </Box>
        </Box>
      )}
      <Box
        $flex={1}
        $direction="column"
        $gap="1rem"
        $css={`
      overflow-y: auto;
      font-size: 14px;
          mask-image: linear-gradient(black calc(100% - 32px), transparent calc(100% - 4px));
          padding-bottom: 32px;
`}
        aria-live="polite"
      >
        {messages.map((message, index) => (
          <Message key={index} message={message} />
        ))}

        {(isLoading || false) && (
          <Box $display="flex" $direction="row" $align="center" $gap="0.5rem">
            <Loader size="small" />
            Albert réfléchit ...
          </Box>
        )}
      </Box>
      <Box>
        <form onSubmit={(e) => void submit(e)} style={{ width: '100%' }}>
          <Input
            type="text"
            label="Posez votre question"
            name="prompt"
            fullWidth={true}
            onChange={(e) => setPrompt(e.target.value)}
            value={prompt} // Ensure the input value is updated with the state
            rightIcon={<span className="material-icons">send</span>}
          />
        </form>
      </Box>
    </Box>
  );
};

const Message = ({ message }: { message: Message }) => {
  return (
    <Box>
      <Box $direction="row" $align="center" $gap="0.5rem">
        {message.role === 'user' ? (
          <Box
            aria-hidden={true}
            $css={`
            background-color:#417DC4;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            color: white;
            font-size: 10px;
            align-items: center;
            justify-content: center;
            display: flex;
            `}
          >
            VD
          </Box>
        ) : (
          <Box
            aria-hidden={true}
            $css={`
                background-image: url('/assets/ia_baguette.png');
                background-size: cover;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: none;
                cursor: pointer;
                `}
          ></Box>
        )}
        <Text $weight="bold">
          {message.role === 'user' ? 'Vous' : 'Albert'}
        </Text>
      </Box>
      <Box
        $css={`
            font-size: 12px;
            padding-left: 34px;
            color: var(--c--theme--colors--greyscale-700);

            p {
                margin: 0;
            }
            `}
        dangerouslySetInnerHTML={{
          __html: marked.parse(message.content) as string,
        }}
      ></Box>
    </Box>
  );
};
