import { Page } from '@playwright/test';

export const getEditor = async ({ page }: { page: Page }) => {
  const editor = page.locator('.ProseMirror');
  await editor.click();
  return editor;
};

export const openSuggestionMenu = async ({ page }: { page: Page }) => {
  const editor = await getEditor({ page });
  await editor.click();
  await page.locator('.bn-block-outer').last().fill('/');

  return editor;
};

export const writeInEditor = async ({
  page,
  text,
}: {
  page: Page;
  text: string;
}) => {
  const editor = await getEditor({ page });
  await editor.locator('.bn-block-outer').last().fill(text);
  return editor;
};
