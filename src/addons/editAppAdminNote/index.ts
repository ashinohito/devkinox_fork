// コンテンツスクリプト: アプリ管理者用メモを編集

interface AdminNotesResponse {
  content: string;
  includeInTemplateAndDuplicates: boolean;
  revision: string;
}

interface UpdateAdminNotesRequest {
  app: number;
  content: string;
  includeInTemplateAndDuplicates: boolean;
  revision: string;
}

interface DeployAppSettingsRequest {
  apps: Array<{
    app: number;
    revision?: string;
  }>;
  revert?: boolean;
}

type DeployStatus = "PROCESSING" | "SUCCESS" | "FAIL" | "CANCEL";
type KintoneNotificationType = "ERROR" | "SUCCESS" | "INFO";

interface GetDeployStatusResponse {
  apps: Array<{
    app: string;
    status: DeployStatus;
  }>;
}

interface KintoneApi {
  (
    path: string,
    method: "GET",
    params: { app: number },
  ): Promise<AdminNotesResponse>;
  (
    path: string,
    method: "GET",
    params: { apps: number[] },
  ): Promise<GetDeployStatusResponse>;
  (
    path: string,
    method: "PUT",
    body: UpdateAdminNotesRequest,
  ): Promise<{ revision: string }>;
  (path: string, method: "POST", body: DeployAppSettingsRequest): Promise<void>;
  url(path: string, isPreview: boolean): string;
}

interface KintoneGlobal {
  app: {
    getId(): number | null;
  };
  api: KintoneApi;
  showNotification?: (
    type: KintoneNotificationType,
    message: string,
  ) => Promise<void>;
}

interface KintoneErrorLike {
  code?: string;
  message?: string;
  id?: string;
  error?: {
    code?: string;
    message?: string;
    id?: string;
  };
}

(() => {
  const DIALOG_ID = "kintone-dev-tools-edit-app-admin-note-dialog";
  const OVERLAY_ID = "kintone-dev-tools-edit-app-admin-note-overlay";
  const MAX_CONTENT_LENGTH = 10000;

  const STYLES = {
    COLORS: {
      PRIMARY: "#3498db",
      SUCCESS: "#27ae60",
      ERROR: "#e74c3c",
      BORDER: "#ccc",
      BACKGROUND: "#f9f9f9",
      TEXT_SECONDARY: "#666",
    },
    Z_INDEX: {
      OVERLAY: "2147483646",
      DIALOG: "2147483647",
      MESSAGE: "2147483648",
    },
  } as const;

  const MESSAGES = {
    TITLE: "アプリ管理者用メモを編集",
    APP_ID_PREFIX: "現在のアプリID: ",
    CONTENT_LABEL: "アプリ管理者用メモ",
    OPTION_LABEL: "アプリテンプレートやアプリ再利用時にメモ内容を含める",
    REVISION_PREFIX: "現在のリビジョン: ",
    BUTTON_CLOSE: "閉じる",
    BUTTON_SAVE: "保存",
    LOADING: "読み込み中...",
    VALIDATION_LENGTH: `メモは${MAX_CONTENT_LENGTH}文字以内で入力してください。`,
    ERROR_APP_ID: "アプリIDを取得できませんでした。",
    ERROR_LOAD: "アプリ管理者用メモの取得に失敗しました。",
    ERROR_SAVE: "アプリ管理者用メモの保存に失敗しました。",
    ERROR_LOAD_PERMISSION:
      "アプリ管理者用メモを取得する権限がありません。\nアプリ管理権限を確認してください。",
    ERROR_SAVE_PERMISSION:
      "アプリ管理者用メモを保存する権限がありません。\nアプリ管理権限を確認してください。",
    ERROR_SAVE_REVISION:
      "アプリ管理者用メモの保存に失敗しました。\n他の変更と競合した可能性があります。再度開き直して保存してください。",
    ERROR_DEPLOY:
      "運用環境への反映に失敗しました。アプリ設定画面から反映してください。",
    ERROR_DEPLOY_TIMEOUT:
      "運用環境への反映状況の確認がタイムアウトしました。\nアプリ設定画面で反映状況を確認してください。",
    ERROR_DEPLOY_FAILED:
      "運用環境への反映に失敗しました。\nアプリ設定画面で詳細を確認してください。",
    ERROR_NETWORK:
      "ネットワークエラーが発生しました。\n接続状態を確認してから再度お試しください。",
    INFO_SAVING_DEPLOYING: "保存して運用環境へ反映しています...",
    INFO_DEPLOYING: "反映状況を確認中です...",
    SUCCESS_SAVE:
      "✓ アプリ管理者用メモを保存し、運用環境への反映が完了しました",
  } as const;

  const DEPLOY_STATUS_POLL_INTERVAL_MS = 1500;
  const DEPLOY_STATUS_MAX_ATTEMPTS = 20;
  const SPINNER_STYLE_ID =
    "kintone-dev-tools-edit-app-admin-note-spinner-style";

  function getKintone(): KintoneGlobal | null {
    return (globalThis as { kintone?: KintoneGlobal }).kintone ?? null;
  }

  function normalizeError(error: unknown): KintoneErrorLike {
    if (!error || typeof error !== "object") {
      return {};
    }
    const err = error as KintoneErrorLike;
    if (err.code || err.message) {
      return err;
    }
    if (err.error && (err.error.code || err.error.message)) {
      return err.error;
    }
    return {};
  }

  function isPermissionError(error: unknown): boolean {
    const normalized = normalizeError(error);
    const code = normalized.code ?? "";
    const message = normalized.message ?? String(error ?? "");

    return (
      ["GAIA_NO01", "CB_NO02", "CB_AU01"].includes(code) ||
      /権限|permission|forbidden|access denied|401|403/i.test(message)
    );
  }

  function isRevisionError(error: unknown): boolean {
    const normalized = normalizeError(error);
    const code = normalized.code ?? "";
    const message = normalized.message ?? String(error ?? "");

    return (
      ["GAIA_CO02", "CB_VA01"].includes(code) ||
      /revision|リビジョン|競合|一致しない|mismatch/i.test(message)
    );
  }

  function isNetworkError(error: unknown): boolean {
    const message =
      normalizeError(error).message ??
      (error instanceof Error ? error.message : String(error ?? ""));

    return /ERR_NETWORK|ERR_CONNECTION|ERR_TIMED_OUT|NetworkError|Failed to fetch/i.test(
      message,
    );
  }

  function getErrorDetails(error: unknown): string {
    const normalized = normalizeError(error);
    const details: string[] = [];

    if (normalized.code) {
      details.push(`code: ${normalized.code}`);
    }
    if (normalized.id) {
      details.push(`id: ${normalized.id}`);
    }

    return details.join(" / ");
  }

  function getLoadErrorMessage(error: unknown): string {
    const details = getErrorDetails(error);

    if (isPermissionError(error)) {
      return details
        ? `${MESSAGES.ERROR_LOAD_PERMISSION}\n(${details})`
        : MESSAGES.ERROR_LOAD_PERMISSION;
    }
    if (isNetworkError(error)) {
      return MESSAGES.ERROR_NETWORK;
    }
    return details
      ? `${MESSAGES.ERROR_LOAD}\n(${details})`
      : MESSAGES.ERROR_LOAD;
  }

  function getSaveErrorMessage(error: unknown): string {
    const details = getErrorDetails(error);

    if (isRevisionError(error)) {
      return details
        ? `${MESSAGES.ERROR_SAVE_REVISION}\n(${details})`
        : MESSAGES.ERROR_SAVE_REVISION;
    }
    if (isPermissionError(error)) {
      return details
        ? `${MESSAGES.ERROR_SAVE_PERMISSION}\n(${details})`
        : MESSAGES.ERROR_SAVE_PERMISSION;
    }
    if (isNetworkError(error)) {
      return MESSAGES.ERROR_NETWORK;
    }
    return details
      ? `${MESSAGES.ERROR_SAVE}\n(${details})`
      : MESSAGES.ERROR_SAVE;
  }

  function getDeployErrorMessage(error: unknown): string {
    const details = getErrorDetails(error);

    if (isPermissionError(error)) {
      return details
        ? `${MESSAGES.ERROR_SAVE_PERMISSION}\n(${details})`
        : MESSAGES.ERROR_SAVE_PERMISSION;
    }
    if (isNetworkError(error)) {
      return MESSAGES.ERROR_NETWORK;
    }
    return details
      ? `${MESSAGES.ERROR_DEPLOY}\n(${details})`
      : MESSAGES.ERROR_DEPLOY;
  }

  function createStyledElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    styles: Partial<CSSStyleDeclaration>,
    textContent?: string,
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    Object.assign(element.style, styles);
    if (textContent !== undefined) {
      element.textContent = textContent;
    }
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
      },
      text,
    );
    button.onclick = onClick;
    return button;
  }

  function showFloatingMessage(
    message: string,
    type: "success" | "error",
  ): void {
    const msg = createStyledElement(
      "div",
      {
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background:
          type === "success" ? STYLES.COLORS.SUCCESS : STYLES.COLORS.ERROR,
        color: "white",
        padding: "12px 24px",
        borderRadius: "4px",
        whiteSpace: "pre-line",
        zIndex: STYLES.Z_INDEX.MESSAGE,
        fontSize: "0.95em",
      },
      message,
    );
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2500);
  }

  async function showTopMessage(
    type: "ERROR" | "SUCCESS",
    message: string,
  ): Promise<void> {
    const isDialogOpen = Boolean(document.getElementById(DIALOG_ID));

    if (isDialogOpen) {
      showFloatingMessage(message, type === "SUCCESS" ? "success" : "error");
      return;
    }

    const kintoneApi = getKintone();
    if (kintoneApi?.showNotification) {
      try {
        await kintoneApi.showNotification(type, message);
        return;
      } catch (error) {
        console.warn(
          "[Kintone Dev Tools] showNotification failed. Fallback to floating message:",
          error,
        );
      }
    }

    showFloatingMessage(message, type === "SUCCESS" ? "success" : "error");
  }

  function ensureSpinnerStyle(): void {
    if (document.getElementById(SPINNER_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = SPINNER_STYLE_ID;
    style.textContent = `
      @keyframes kintone-dev-tools-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  function removeExistingDialog(): void {
    document.getElementById(DIALOG_ID)?.remove();
    document.getElementById(OVERLAY_ID)?.remove();
  }

  async function fetchAdminNotes(appId: number): Promise<AdminNotesResponse> {
    const kintoneApi = getKintone();
    if (!kintoneApi) {
      throw new Error("kintone object is not available.");
    }
    const path = kintoneApi.api.url("/k/v1/preview/app/adminNotes.json", true);
    return kintoneApi.api(path, "GET", { app: appId });
  }

  async function updateAdminNotes(
    params: UpdateAdminNotesRequest,
  ): Promise<{ revision: string }> {
    const kintoneApi = getKintone();
    if (!kintoneApi) {
      throw new Error("kintone object is not available.");
    }
    const path = kintoneApi.api.url("/k/v1/preview/app/adminNotes.json", true);
    return kintoneApi.api(path, "PUT", params);
  }

  async function deployAppSettings(
    appId: number,
    revision: string,
  ): Promise<void> {
    const kintoneApi = getKintone();
    if (!kintoneApi) {
      throw new Error("kintone object is not available.");
    }
    const path = kintoneApi.api.url("/k/v1/preview/app/deploy.json", true);
    return kintoneApi.api(path, "POST", {
      apps: [{ app: appId, revision }],
      revert: false,
    });
  }

  async function getDeployStatus(appId: number): Promise<DeployStatus | null> {
    const kintoneApi = getKintone();
    if (!kintoneApi) {
      throw new Error("kintone object is not available.");
    }
    const path = kintoneApi.api.url("/k/v1/preview/app/deploy.json", true);
    const response = await kintoneApi.api(path, "GET", { apps: [appId] });
    const target = response.apps.find((item) => Number(item.app) === appId);
    return target?.status ?? null;
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForDeployCompletion(appId: number): Promise<void> {
    for (let attempt = 0; attempt < DEPLOY_STATUS_MAX_ATTEMPTS; attempt += 1) {
      const status = await getDeployStatus(appId);

      if (status === "SUCCESS") {
        return;
      }

      if (status === "FAIL" || status === "CANCEL") {
        throw new Error(`DEPLOY_${status}`);
      }

      await wait(DEPLOY_STATUS_POLL_INTERVAL_MS);
    }

    throw new Error("DEPLOY_TIMEOUT");
  }

  async function showDialog(): Promise<void> {
    removeExistingDialog();

    const kintoneApi = getKintone();
    if (!kintoneApi) {
      alert(
        "kintoneオブジェクトを取得できませんでした。ページを再読み込みして再度お試しください。",
      );
      return;
    }

    const appId = kintoneApi.app.getId();
    if (appId == null) {
      alert(MESSAGES.ERROR_APP_ID);
      return;
    }

    const overlay = createStyledElement("div", {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0, 0, 0, 0.3)",
      zIndex: STYLES.Z_INDEX.OVERLAY,
    });
    overlay.id = OVERLAY_ID;

    const dialog = createStyledElement("div", {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "white",
      padding: "20px",
      borderRadius: "8px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      zIndex: STYLES.Z_INDEX.DIALOG,
      width: "560px",
      maxWidth: "90%",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      color: "#333",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    });
    dialog.id = DIALOG_ID;

    const title = createStyledElement(
      "h3",
      {
        textAlign: "center",
        margin: "0 0 8px 0",
      },
      MESSAGES.TITLE,
    );
    dialog.appendChild(title);

    const appLabel = createStyledElement(
      "p",
      {
        margin: "0",
        padding: "8px",
        background: STYLES.COLORS.BACKGROUND,
        border: `1px solid ${STYLES.COLORS.BORDER}`,
        borderRadius: "4px",
        fontSize: "0.9em",
      },
      `${MESSAGES.APP_ID_PREFIX}${appId}`,
    );
    dialog.appendChild(appLabel);

    const loading = createStyledElement(
      "p",
      {
        margin: "0",
        fontSize: "0.9em",
        color: STYLES.COLORS.TEXT_SECONDARY,
      },
      MESSAGES.LOADING,
    );
    dialog.appendChild(loading);

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    overlay.onclick = removeExistingDialog;

    let adminNotes: AdminNotesResponse;
    try {
      adminNotes = await fetchAdminNotes(appId);
    } catch (error) {
      console.error(
        "[Kintone Dev Tools] Failed to fetch app admin notes:",
        error,
      );
      removeExistingDialog();
      await showTopMessage("ERROR", getLoadErrorMessage(error));
      return;
    }

    loading.remove();

    const contentLabel = createStyledElement(
      "label",
      {
        fontWeight: "bold",
        display: "block",
      },
      MESSAGES.CONTENT_LABEL,
    );
    dialog.appendChild(contentLabel);

    const textarea = createStyledElement("textarea", {
      width: "calc(100% - 20px)",
      minHeight: "240px",
      resize: "vertical",
      padding: "10px",
      border: `1px solid ${STYLES.COLORS.BORDER}`,
      borderRadius: "4px",
      fontSize: "0.95em",
      lineHeight: "1.5",
      fontFamily: "inherit",
    }) as HTMLTextAreaElement;
    textarea.value = adminNotes.content ?? "";
    dialog.appendChild(textarea);

    const helper = createStyledElement("p", {
      margin: "0",
      fontSize: "0.85em",
      color: STYLES.COLORS.TEXT_SECONDARY,
    });
    dialog.appendChild(helper);

    const updateLengthText = (): void => {
      helper.textContent = `${textarea.value.length}/${MAX_CONTENT_LENGTH}`;
      helper.style.color =
        textarea.value.length > MAX_CONTENT_LENGTH
          ? STYLES.COLORS.ERROR
          : STYLES.COLORS.TEXT_SECONDARY;
    };
    textarea.addEventListener("input", updateLengthText);
    updateLengthText();

    const checkboxWrapper = createStyledElement("label", {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "0.9em",
      cursor: "pointer",
    });
    const includeCheckbox = createStyledElement("input", {
      cursor: "pointer",
    }) as HTMLInputElement;
    includeCheckbox.type = "checkbox";
    includeCheckbox.checked = adminNotes.includeInTemplateAndDuplicates;
    checkboxWrapper.appendChild(includeCheckbox);
    checkboxWrapper.appendChild(document.createTextNode(MESSAGES.OPTION_LABEL));
    dialog.appendChild(checkboxWrapper);

    const revisionLabel = createStyledElement(
      "p",
      {
        margin: "0",
        fontSize: "0.85em",
        color: STYLES.COLORS.TEXT_SECONDARY,
      },
      `${MESSAGES.REVISION_PREFIX}${adminNotes.revision}`,
    );
    dialog.appendChild(revisionLabel);

    ensureSpinnerStyle();

    const processingContainer = createStyledElement("div", {
      display: "none",
      alignItems: "center",
      gap: "8px",
    });

    const processingSpinner = createStyledElement("span", {
      width: "14px",
      height: "14px",
      border: `2px solid ${STYLES.COLORS.PRIMARY}`,
      borderTop: "2px solid transparent",
      borderRadius: "50%",
      animation: "kintone-dev-tools-spin 0.8s linear infinite",
      flexShrink: "0",
    });

    const processingLabel = createStyledElement("p", {
      margin: "0",
      fontSize: "0.9em",
      color: STYLES.COLORS.PRIMARY,
      fontWeight: "bold",
    });

    processingContainer.appendChild(processingSpinner);
    processingContainer.appendChild(processingLabel);
    dialog.appendChild(processingContainer);

    const buttonContainer = createStyledElement("div", {
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
      marginTop: "8px",
    });

    const closeButton = createButton(
      "閉じる",
      "#ccc",
      "#333",
      removeExistingDialog,
    );

    function setProcessingState(isProcessing: boolean, message?: string): void {
      textarea.disabled = isProcessing;
      includeCheckbox.disabled = isProcessing;

      saveButton.disabled = isProcessing;
      closeButton.disabled = isProcessing;

      saveButton.style.opacity = isProcessing ? "0.7" : "1";
      closeButton.style.opacity = isProcessing ? "0.7" : "1";

      saveButton.style.cursor = isProcessing ? "not-allowed" : "pointer";
      closeButton.style.cursor = isProcessing ? "not-allowed" : "pointer";

      overlay.onclick = isProcessing ? () => {} : removeExistingDialog;

      processingContainer.style.display = isProcessing ? "flex" : "none";
      if (isProcessing && message) {
        processingLabel.textContent = message;
      }
    }

    const saveButton = createButton(
      MESSAGES.BUTTON_SAVE,
      STYLES.COLORS.PRIMARY,
      "white",
      async () => {
        if (textarea.value.length > MAX_CONTENT_LENGTH) {
          alert(MESSAGES.VALIDATION_LENGTH);
          return;
        }

        setProcessingState(true, MESSAGES.INFO_SAVING_DEPLOYING);

        try {
          const result = await updateAdminNotes({
            app: appId,
            content: textarea.value,
            includeInTemplateAndDuplicates: includeCheckbox.checked,
            revision: adminNotes.revision,
          });

          try {
            await deployAppSettings(appId, result.revision);
            setProcessingState(true, MESSAGES.INFO_DEPLOYING);
            await waitForDeployCompletion(appId);
          } catch (error) {
            console.error(
              "[Kintone Dev Tools] Failed to deploy app settings:",
              error,
            );
            const errorMessage =
              error instanceof Error && error.message === "DEPLOY_TIMEOUT"
                ? MESSAGES.ERROR_DEPLOY_TIMEOUT
                : error instanceof Error &&
                    /DEPLOY_FAIL|DEPLOY_CANCEL/.test(error.message)
                  ? MESSAGES.ERROR_DEPLOY_FAILED
                  : getDeployErrorMessage(error);
            await showTopMessage("ERROR", errorMessage);
            return;
          }

          adminNotes.revision = result.revision;
          revisionLabel.textContent = `${MESSAGES.REVISION_PREFIX}${result.revision}`;
          await showTopMessage("SUCCESS", MESSAGES.SUCCESS_SAVE);
        } catch (error) {
          console.error(
            "[Kintone Dev Tools] Failed to update app admin notes:",
            error,
          );
          await showTopMessage("ERROR", getSaveErrorMessage(error));
        } finally {
          setProcessingState(false);
        }
      },
    );

    buttonContainer.appendChild(closeButton);
    buttonContainer.appendChild(saveButton);
    dialog.appendChild(buttonContainer);
  }

  showDialog();
})();
