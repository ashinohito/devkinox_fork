import type { Kintone } from "./types";

declare const kintone: Kintone;

(() => {
  // 以下、定数
  const DIALOG_ID = "kintone-dev-tools-toggle-app-description-dialog";
  const STORAGE_KEY = "kintone-dev-tools-hidden-app-ids";
  const HIDE_ALL_STORAGE_KEY = "kintone-dev-tools-hide-all-app-descriptions";

  const STYLES = {
    DIALOG_Z_INDEX: 2147483647,
    MESSAGE_Z_INDEX: 2147483648,
    COLORS: {
      PRIMARY: "#3498db",
      SUCCESS: "#27ae60",
      INFO_BG: "#f0f8ff",
      INFO_BORDER: "#b0d4f1",
      TEXT_SECONDARY: "#666",
      BORDER: "#ccc",
      BUTTON_CANCEL: "#ccc",
      BUTTON_CANCEL_TEXT: "#333",
    },
    TIMING: {
      SUCCESS_MESSAGE_DURATION: 2000,
    },
  } as const;

  const UI_STYLES = {
    DIALOG: {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "white",
      padding: "20px",
      borderRadius: "8px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      zIndex: STYLES.DIALOG_Z_INDEX.toString(),
      width: "520px",
      display: "flex",
      flexDirection: "column",
      gap: "15px",
      color: "#333",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    },
    TITLE: {
      textAlign: "center",
      margin: "0 0 10px 0",
    },
    APP_LABEL: {
      fontSize: "0.9em",
      margin: "0 0 10px 0",
      padding: "8px",
      background: STYLES.COLORS.INFO_BG,
      border: `1px solid ${STYLES.COLORS.INFO_BORDER}`,
      borderRadius: "4px",
      fontWeight: "bold",
    },
    DESCRIPTION: {
      fontSize: "0.9em",
      margin: "0 0 10px 0",
      color: STYLES.COLORS.TEXT_SECONDARY,
    },
    INPUT_LABEL: {
      display: "block",
      marginBottom: "5px",
      fontWeight: "bold",
    },
    INPUT_FIELD: {
      width: "calc(100% - 12px)",
      padding: "8px",
      border: `1px solid ${STYLES.COLORS.BORDER}`,
      borderRadius: "4px",
      fontSize: "0.95em",
    },
    BOTTOM_CONTAINER: {
      display: "flex",
      flexDirection: "column",
      marginTop: "10px",
      gap: "10px",
    },
    CHECKBOX_WRAPPER: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "0.9em",
      color: "#333",
      cursor: "pointer",
    },
    CHECKBOX_NOTE: {
      margin: "6px 0 0 0",
      fontSize: "0.82em",
      color: STYLES.COLORS.TEXT_SECONDARY,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      width: "100%",
    },
    CHECKBOX_AREA: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      width: "100%",
    },
    BUTTON_CONTAINER: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
      width: "100%",
    },
  } as const;

  const MESSAGES = {
    DIALOG_TITLE: "アプリ説明欄の表示/非表示",
    CURRENT_APP_ID: "現在のアプリID: ",
    DESCRIPTION:
      "説明欄を自動的に非表示にしたいアプリIDを半角数字/カンマ区切りで入力してください。",
    HIDE_ALL_CHECKBOX: "すべてのアプリで説明欄を非表示にする",
    HIDE_ALL_NOTE:
      "※ すべてのアプリで説明欄を非表示にしても、アプリIDの設定は保持されます。",
    INPUT_LABEL: "アプリID (カンマ区切り)",
    INPUT_PLACEHOLDER: "例: 1, 54, 67",
    BUTTON_CLOSE: "閉じる",
    BUTTON_SAVE: "保存",
    SUCCESS_SAVED: "✓ 設定を保存しました",
    ERROR_SAVE_FAILED: "設定の保存に失敗しました。",
  } as const;

  const EVENT_TYPES = [
    "app.record.index.show",
    "app.record.detail.show",
    "app.record.create.show",
    "app.record.edit.show",
    "app.record.graph.show",
  ] as const;

  // 以下、ヘルパー関数
  function getStorageValue<T>(
    key: string,
    fallbackValue: T,
    errorLabel: string,
  ): T {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : fallbackValue;
    } catch (error) {
      console.error(`[Kintone Dev Tools] Failed to get ${errorLabel}:`, error);
      return fallbackValue;
    }
  }

  function saveStorageValue<T>(
    key: string,
    value: T,
    errorLabel: string,
  ): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`[Kintone Dev Tools] Failed to save ${errorLabel}:`, error);
      throw error;
    }
  }

  function shouldHideDescription(
    appId: number,
    hideAllEnabled: boolean,
    hiddenAppIds: number[],
  ): boolean {
    return hideAllEnabled || hiddenAppIds.includes(appId);
  }

  function updateInputFieldState(
    inputField: HTMLInputElement,
    disabled: boolean,
  ): void {
    inputField.disabled = disabled;
    inputField.style.backgroundColor = disabled ? "#f5f5f5" : "white";
    inputField.style.cursor = disabled ? "not-allowed" : "text";
  }

  async function getHiddenAppIds(): Promise<number[]> {
    return getStorageValue<number[]>(STORAGE_KEY, [], "hidden app IDs");
  }

  async function saveHiddenAppIds(appIds: number[]): Promise<void> {
    saveStorageValue(STORAGE_KEY, appIds, "hidden app IDs");
  }

  async function getHideAllEnabled(): Promise<boolean> {
    return getStorageValue<boolean>(
      HIDE_ALL_STORAGE_KEY,
      false,
      "hide-all setting",
    );
  }

  async function saveHideAllEnabled(enabled: boolean): Promise<void> {
    saveStorageValue(HIDE_ALL_STORAGE_KEY, enabled, "hide-all setting");
  }

  async function setAppDescriptionState(
    targetState: "OPEN" | "CLOSED",
  ): Promise<void> {
    if (!kintone?.app) {
      console.warn("[Kintone Dev Tools] kintone.app is not available.");
      return;
    }

    try {
      const currentState = await kintone.app.getDescriptionDisplayState();
      const expectedState = targetState === "CLOSED" ? "HIDDEN" : "OPEN";

      if (currentState !== expectedState) {
        await kintone.app.showDescription(targetState);
      }
    } catch (error) {
      console.error(
        `[Kintone Dev Tools] Error setting app description to ${targetState}:`,
        error,
      );
    }
  }

  const hideAppDescription = () => setAppDescriptionState("CLOSED");
  const showAppDescription = () => setAppDescriptionState("OPEN");

  // 以下、UI関連関数
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
      "button",
      {
        padding: "8px 15px",
        background: backgroundColor,
        color: textColor,
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "0.95em",
        whiteSpace: "nowrap",
        minWidth: "96px",
      },
      text,
    );
    button.onclick = onClick;
    return button;
  }

  function showSuccessMessage(message: string): void {
    const successMsg = createStyledElement(
      "div",
      {
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: STYLES.COLORS.SUCCESS,
        color: "white",
        padding: "12px 24px",
        borderRadius: "4px",
        zIndex: STYLES.MESSAGE_Z_INDEX.toString(),
        fontSize: "0.95em",
      },
      message,
    );
    document.body.appendChild(successMsg);
    setTimeout(
      () => successMsg.remove(),
      STYLES.TIMING.SUCCESS_MESSAGE_DURATION,
    );
  }

  function parseAppIds(input: string): number[] {
    return input
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id) && id > 0);
  }

  async function showSettingsDialog(): Promise<void> {
    document.getElementById(DIALOG_ID)?.remove();

    const dialog = createStyledElement("div", UI_STYLES.DIALOG);
    dialog.id = DIALOG_ID;

    const title = createStyledElement(
      "h3",
      UI_STYLES.TITLE,
      MESSAGES.DIALOG_TITLE,
    );
    dialog.appendChild(title);

    const currentAppId = kintone.app.getId()?.toString() ?? "";
    if (currentAppId) {
      const appLabel = createStyledElement(
        "p",
        UI_STYLES.APP_LABEL,
        `${MESSAGES.CURRENT_APP_ID}${currentAppId}`,
      );
      dialog.appendChild(appLabel);
    }

    const description = createStyledElement(
      "p",
      UI_STYLES.DESCRIPTION,
      MESSAGES.DESCRIPTION,
    );
    dialog.appendChild(description);

    const inputLabel = createStyledElement(
      "label",
      UI_STYLES.INPUT_LABEL,
      MESSAGES.INPUT_LABEL,
    );
    dialog.appendChild(inputLabel);

    const inputField = createStyledElement(
      "input",
      UI_STYLES.INPUT_FIELD,
    ) as HTMLInputElement;
    inputField.type = "text";
    inputField.placeholder = MESSAGES.INPUT_PLACEHOLDER;

    const previousHiddenAppIds = await getHiddenAppIds();
    const previousHideAllEnabled = await getHideAllEnabled();
    if (previousHiddenAppIds.length > 0) {
      inputField.value = previousHiddenAppIds.join(", ");
    }
    updateInputFieldState(inputField, previousHideAllEnabled);
    dialog.appendChild(inputField);

    const bottomContainer = createStyledElement(
      "div",
      UI_STYLES.BOTTOM_CONTAINER,
    );

    const checkboxWrapper = createStyledElement(
      "label",
      UI_STYLES.CHECKBOX_WRAPPER,
    );

    const hideAllCheckbox = createStyledElement("input", {
      margin: "0",
      cursor: "pointer",
    }) as HTMLInputElement;
    hideAllCheckbox.type = "checkbox";
    hideAllCheckbox.checked = previousHideAllEnabled;

    const checkboxText = document.createTextNode(MESSAGES.HIDE_ALL_CHECKBOX);
    checkboxWrapper.appendChild(hideAllCheckbox);
    checkboxWrapper.appendChild(checkboxText);

    const checkboxNote = createStyledElement(
      "p",
      UI_STYLES.CHECKBOX_NOTE,
      MESSAGES.HIDE_ALL_NOTE,
    );
    checkboxNote.title = MESSAGES.HIDE_ALL_NOTE;

    const checkboxArea = createStyledElement("div", UI_STYLES.CHECKBOX_AREA);
    checkboxArea.appendChild(checkboxWrapper);
    checkboxArea.appendChild(checkboxNote);

    hideAllCheckbox.addEventListener("change", () => {
      updateInputFieldState(inputField, hideAllCheckbox.checked);
    });

    const buttonContainer = createStyledElement(
      "div",
      UI_STYLES.BUTTON_CONTAINER,
    );

    const closeButton = createButton(
      MESSAGES.BUTTON_CLOSE,
      STYLES.COLORS.BUTTON_CANCEL,
      STYLES.COLORS.BUTTON_CANCEL_TEXT,
      () => dialog.remove(),
    );
    const saveButton = createButton(
      MESSAGES.BUTTON_SAVE,
      STYLES.COLORS.PRIMARY,
      "white",
      () =>
        handleSave(
          inputField,
          hideAllCheckbox,
          currentAppId,
          previousHiddenAppIds,
          previousHideAllEnabled,
          dialog,
        ),
    );

    buttonContainer.appendChild(closeButton);
    buttonContainer.appendChild(saveButton);
    bottomContainer.appendChild(checkboxArea);
    bottomContainer.appendChild(buttonContainer);
    dialog.appendChild(bottomContainer);
    document.body.appendChild(dialog);
  }

  // 以下、保存・適用関連関数
  async function handleSave(
    inputField: HTMLInputElement,
    hideAllCheckbox: HTMLInputElement,
    currentAppId: string,
    previousHiddenAppIds: number[],
    previousHideAllEnabled: boolean,
    dialog: HTMLElement,
  ): Promise<void> {
    const inputValue = inputField.value.trim();
    const hideAllEnabled = hideAllCheckbox.checked;
    const newHiddenAppIds = inputValue ? parseAppIds(inputValue) : [];

    try {
      await saveHiddenAppIds(newHiddenAppIds);
      await saveHideAllEnabled(hideAllEnabled);

      if (currentAppId) {
        const currentAppIdNum = parseInt(currentAppId, 10);
        const wasHidden = shouldHideDescription(
          currentAppIdNum,
          previousHideAllEnabled,
          previousHiddenAppIds,
        );
        const isNowHidden = shouldHideDescription(
          currentAppIdNum,
          hideAllEnabled,
          newHiddenAppIds,
        );

        if (wasHidden && !isNowHidden) {
          await showAppDescription();
        } else if (!wasHidden && isNowHidden) {
          await hideAppDescription();
        }
      }

      showSuccessMessage(MESSAGES.SUCCESS_SAVED);
      dialog.remove();
    } catch (error) {
      console.error("[Kintone Dev Tools] Failed to save settings:", error);
      alert(MESSAGES.ERROR_SAVE_FAILED);
    }
  }

  async function autoToggleAppDescription(): Promise<void> {
    const appId = kintone?.app?.getId();
    if (appId == null) return;

    const hideAllEnabled = await getHideAllEnabled();
    const hiddenAppIds = hideAllEnabled ? [] : await getHiddenAppIds();
    await (shouldHideDescription(appId, hideAllEnabled, hiddenAppIds)
      ? hideAppDescription()
      : showAppDescription());
  }

  // 以下、初期化
  window.showToggleAppDescriptionSettings = showSettingsDialog;

  if (!window.__toggleAppDescriptionInitialized__) {
    window.__toggleAppDescriptionInitialized__ = true;

    kintone?.events?.on([...EVENT_TYPES], autoToggleAppDescription);

    return;
  }

  showSettingsDialog();
})();
