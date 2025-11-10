import { Modal, ModalSize } from '@openfun/cunningham-react';
import { ComponentPropsWithRef, PropsWithChildren } from 'react';
import { createGlobalStyle } from 'styled-components';

interface SideModalStyleProps {
  side: 'left' | 'right';
  width: string;
  $css?: string;
}

const SideModalStyle = createGlobalStyle<SideModalStyleProps>`
  @keyframes slidein {
    from {
      transform: translateX(100%);
    }

    to {
      transform: translateX(0%);
    }
  }

  & .c__modal{
    animation: slidein 0.7s;

    width: ${({ width }) => width};
    ${({ side }) => side === 'right' && 'left: auto;'};
    
    .c__modal__scroller {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    ${({ $css }) => $css}
  }
`;

type SideModalType = Omit<ComponentPropsWithRef<typeof Modal>, 'size'>;

type SideModalProps = SideModalType & Partial<SideModalStyleProps>;

export const SideModal = ({
  children,
  side = 'right',
  width = '35vw',
  $css,
  ...modalProps
}: PropsWithChildren<SideModalProps>) => {
  return (
    <>
      <SideModalStyle width={width} side={side} $css={$css} />
      <Modal {...modalProps} size={ModalSize.FULL}>
        {children}
      </Modal>
    </>
  );
};
