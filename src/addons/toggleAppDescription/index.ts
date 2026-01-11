import type { Kintone } from './types';

declare const kintone: Kintone;

(() => {
  const DIALOG_ID = 'kintone-dev-tools-toggle-app-description-dialog';
  const STORAGE_KEY = 'kintone-dev-tools-hidden-app-ids';

  const STYLES = {
    DIALOG_Z_INDEX: 2147483647,
    MESSAGE_Z_INDEX: 2147483648,
    COLORS: {
      PRIMARY: '#3498db',
      SUCCESS: '#27ae60',
      INFO_BG: '#f0f8ff',
      INFO_BORDER: '#b0d4f1',
      TEXT_SECONDARY: '#666',
      BORDER: '#ccc',
      BUTTON_CANCEL: '#ccc',
      BUTTON_CANCEL_TEXT: '#333',
    },
    TIMING: {
      SUCCESS_MESSAGE_DURATION: 2000,
    },
  } as const;

  const MESSAGES = {
    DIALOG_TITLE: 'アプリ説明欄の表示/非表示',
    CURRENT_APP_ID: '現在のアプリID: ',
    DESCRIPTION: '説明欄を自動的に非表示にしたいアプリIDをカンマ区切りで入力してください。',
    INPUT_LABEL: 'アプリID (カンマ区切り)',
    INPUT_PLACEHOLDER: '例: 1, 54, 67',
    BUTTON_CLOSE: '閉じる',
    BUTTON_SAVE: '保存',
    SUCCESS_SAVED: '✓ 設定を保存しました',
    ERROR_SAVE_FAILED: '設定の保存に失敗しました。',
  } as const;

  const EVENT_TYPES = [
    'app.record.index.show',
    'app.record.detail.show',
    'app.record.create.show',
    'app.record.edit.show',
  ] as const;

  async function getHiddenAppIds(): Promise<number[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[Kintone Dev Tools] Failed to get hidden app IDs:', error);
      return [];
    }
  }

  async function saveHiddenAppIds(appIds: number[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appIds));
    } catch (error) {
      console.error('[Kintone Dev Tools] Failed to save hidden app IDs:', error);
      throw error;
    }
  }

  async function setAppDescriptionState(targetState: 'OPEN' | 'CLOSED'): Promise<void> {
    if (!kintone?.app) {
      console.warn('[Kintone Dev Tools] kintone.app is not available.');
      return;
    }

    try {
      const currentState = await kintone.app.getDescriptionDisplayState();
      const expectedState = targetState === 'CLOSED' ? 'HIDDEN' : 'OPEN';

      if (currentState !== expectedState) {
        await kintone.app.showDescription(targetState);
      }
    } catch (error) {
      console.error(`[Kintone Dev Tools] Error setting app description to ${targetState}:`, error);
    }
  }

  const hideAppDescription = () => setAppDescriptionState('CLOSED');
  const showAppDescription = () => setAppDescriptionState('OPEN');

  function createStyledElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    styles: Partial<CSSStyleDeclaration>,
    textContent?: string,
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    Object.assign(element.style, styles);
    if (textContent) element.textContent = textContent;
    return element;
  }

  function createButton(
    text: string,
    backgroundColor: string,
    textColor: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = createStyledElement(
      'button',
      {
        padding: '8px 15px',
        background: backgroundColor,
        color: textColor,
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.95em',
      },
      text,
    );
    button.onclick = onClick;
    return button;
  }

  function showSuccessMessage(message: string): void {
    const successMsg = createStyledElement(
      'div',
      {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: STYLES.COLORS.SUCCESS,
        color: 'white',
        padding: '12px 24px',
        borderRadius: '4px',
        zIndex: STYLES.MESSAGE_Z_INDEX.toString(),
        fontSize: '0.95em',
      },
      message,
    );
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), STYLES.TIMING.SUCCESS_MESSAGE_DURATION);
  }

  function parseAppIds(input: string): number[] {
    return input
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id) && id > 0);
  }

  async function showSettingsDialog(): Promise<void> {
    document.getElementById(DIALOG_ID)?.remove();

    const dialog = createStyledElement('div', {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      zIndex: STYLES.DIALOG_Z_INDEX.toString(),
      width: '520px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      color: '#333',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    });
    dialog.id = DIALOG_ID;

    const title = createStyledElement(
      'h3',
      {
        textAlign: 'center',
        margin: '0 0 10px 0',
      },
      MESSAGES.DIALOG_TITLE,
    );
    dialog.appendChild(title);

    const currentAppId = kintone.app.getId()?.toString() ?? '';
    if (currentAppId) {
      const appLabel = createStyledElement(
        'p',
        {
          fontSize: '0.9em',
          margin: '0 0 10px 0',
          padding: '8px',
          background: STYLES.COLORS.INFO_BG,
          border: `1px solid ${STYLES.COLORS.INFO_BORDER}`,
          borderRadius: '4px',
          fontWeight: 'bold',
        },
        `${MESSAGES.CURRENT_APP_ID}${currentAppId}`,
      );
      dialog.appendChild(appLabel);
    }

    const description = createStyledElement(
      'p',
      {
        fontSize: '0.9em',
        margin: '0 0 10px 0',
        color: STYLES.COLORS.TEXT_SECONDARY,
      },
      MESSAGES.DESCRIPTION,
    );
    dialog.appendChild(description);

    const inputLabel = createStyledElement(
      'label',
      {
        display: 'block',
        marginBottom: '5px',
        fontWeight: 'bold',
      },
      MESSAGES.INPUT_LABEL,
    );
    dialog.appendChild(inputLabel);

    const inputField = createStyledElement('input', {
      width: 'calc(100% - 12px)',
      padding: '8px',
      border: `1px solid ${STYLES.COLORS.BORDER}`,
      borderRadius: '4px',
      fontSize: '0.95em',
    }) as HTMLInputElement;
    inputField.type = 'text';
    inputField.placeholder = MESSAGES.INPUT_PLACEHOLDER;

    const previousHiddenAppIds = await getHiddenAppIds();
    if (previousHiddenAppIds.length > 0) {
      inputField.value = previousHiddenAppIds.join(', ');
    }
    dialog.appendChild(inputField);

    const buttonContainer = createStyledElement('div', {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '10px',
    });

    const closeButton = createButton(
      MESSAGES.BUTTON_CLOSE,
      STYLES.COLORS.BUTTON_CANCEL,
      STYLES.COLORS.BUTTON_CANCEL_TEXT,
      () => dialog.remove(),
    );
    const saveButton = createButton(MESSAGES.BUTTON_SAVE, STYLES.COLORS.PRIMARY, 'white', () =>
      handleSave(inputField, currentAppId, previousHiddenAppIds, dialog),
    );

    buttonContainer.appendChild(closeButton);
    buttonContainer.appendChild(saveButton);
    dialog.appendChild(buttonContainer);
    document.body.appendChild(dialog);
  }

  async function handleSave(
    inputField: HTMLInputElement,
    currentAppId: string,
    previousHiddenAppIds: number[],
    dialog: HTMLElement,
  ): Promise<void> {
    const inputValue = inputField.value.trim();
    const newHiddenAppIds = inputValue ? parseAppIds(inputValue) : [];

    try {
      await saveHiddenAppIds(newHiddenAppIds);

      if (currentAppId) {
        const currentAppIdNum = parseInt(currentAppId, 10);
        const wasHidden = previousHiddenAppIds.includes(currentAppIdNum);
        const isNowHidden = newHiddenAppIds.includes(currentAppIdNum);

        if (wasHidden && !isNowHidden) {
          await showAppDescription();
        } else if (!wasHidden && isNowHidden) {
          await hideAppDescription();
        }
      }

      showSuccessMessage(MESSAGES.SUCCESS_SAVED);
      dialog.remove();
    } catch (error) {
      console.error('[Kintone Dev Tools] Failed to save settings:', error);
      alert(MESSAGES.ERROR_SAVE_FAILED);
    }
  }

  async function autoToggleAppDescription(): Promise<void> {
    const appId = kintone?.app?.getId();
    if (appId == null) return;

    const hiddenAppIds = await getHiddenAppIds();
    await (hiddenAppIds.includes(appId) ? hideAppDescription() : showAppDescription());
  }

  window.showToggleAppDescriptionSettings = showSettingsDialog;

  if (!window.__toggleAppDescriptionInitialized__) {
    window.__toggleAppDescriptionInitialized__ = true;

    kintone?.events?.on([...EVENT_TYPES], autoToggleAppDescription);

    if (document.readyState !== 'loading') {
      autoToggleAppDescription();
    } else {
      document.addEventListener('DOMContentLoaded', autoToggleAppDescription);
    }

    return;
  }

  showSettingsDialog();
})();
