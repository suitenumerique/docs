// Centralized selector constants for doc-tree hooks

export const SELECTORS = {
  MODAL:
    '[role="dialog"], .c__modal, [data-modal], .c__modal__overlay, .ReactModal_Content',
  MODAL_SCROLLER: '.c__modal__scroller',
  ACTIONS_CONTAINER: '.--docs--doc-tree-item-actions',
  DOC_SUB_PAGE_ITEM: '.--docs-sub-page-item',
  ROLE_MENU: '[role="menu"]',
  ROLE_MENUITEM_OR_BUTTON:
    '[role="menuitem"], button, [tabindex]:not([tabindex="-1"])',
  FOCUSABLE:
    'button, [role="button"], a[href], input, [tabindex]:not([tabindex="-1"])',
  DATA_TESTID_DOC_SUB_PAGE_ITEM: 'doc-sub-page-item-',
  DATA_TESTID_DOC_SUB_PAGE_ITEM_PREFIX: '[data-testid^="doc-sub-page-item-"]',
} as const;
