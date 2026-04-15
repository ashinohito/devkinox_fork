import type { AppInfo, FieldProperty, PageType } from "./types";

(() => {
  console.log(
    "[Kintone Dev Tools] createDummyData.js (content script) loaded.",
  );

  const DIALOG_INPUT_ID = "kintone-dev-tools-get-records-input-dialog";
  const DIALOG_RESULT_ID = "kintone-dev-tools-get-records-result-dialog";

  function showAlert(message: string) {
    alert(`${message}`);
    console.log("[Kintone Dev Tools] showAlert.");
  }

  async function getAppInfoFromPage(): Promise<AppInfo | null> {
    if (typeof kintone === "undefined" || !kintone || !kintone.app) {
      console.warn(
        "[Kintone Dev Tools] kintone.app object is not available at this moment.",
      );
      return null;
    }
    const appId = kintone.app.getId();
    if (appId === null || appId === undefined) {
      console.warn("[Kintone Dev Tools] App ID is null or undefined.");
      return null;
    }
    console.log("[Kintone Dev Tools] kintone.app.getId():", appId);

    try {
      // 1. アプリ詳細情報を取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appDetails = await (kintone as any).api(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (kintone as any).api.url("/k/v1/app.json", true),
        "GET",
        { id: appId },
      );
      console.log("[Kintone Dev Tools] App Details Response:", appDetails);

      // 2. アプリの閲覧画面を取得(型ガード付)
      function toPageType(value: string): PageType {
        const validValues: PageType[] = [
          "APP_INDEX",
          "APP_CREATE",
          "APP_EDIT",
          "OTHER",
        ];
        return validValues.includes(value as PageType)
          ? (value as PageType)
          : "OTHER";
      }
      const rawPageType = await kintone.getPageType(); // string
      console.log(rawPageType);
      const pageType: PageType = toPageType(rawPageType.page);

      // 3. アプリのフィールド情報を取得 (運用環境)
      let appFields: { [fieldCode: string]: FieldProperty } | undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fieldsResponse = await (kintone as any).api(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (kintone as any).api.url("/k/v1/app/form/fields.json", true),
          "GET",
          { app: appId, lang: "default" }, // lang: default でユーザーの表示言語。live: falseでプレビュー環境。指定なしで運用環境
        );
        console.log(
          "[Kintone Dev Tools] App Form Fields Response:",
          fieldsResponse,
        );
        appFields = fieldsResponse.properties;
      } catch (fieldsError) {
        console.error(
          "[Kintone Dev Tools] Failed to get app form fields:",
          fieldsError,
        );
      }

      return {
        appId: appId.toString(),
        appName: appDetails.name || "（名称未設定）",
        pageType: pageType,
        spaceId: appDetails.spaceId ? appDetails.spaceId.toString() : undefined,
        threadId: appDetails.threadId
          ? appDetails.threadId.toString()
          : undefined,
        creatorName: appDetails.creator?.name || "（不明）",
        createdAt: appDetails.createdAt || "（不明）",
        modifierName: appDetails.modifier?.name || "（不明）",
        modifiedAt: appDetails.modifiedAt || "（不明）",
        fields: appFields,
      };
    } catch (error) {
      console.error(
        "[Kintone Dev Tools] Failed to get app info via API:",
        error,
      );
      // APIエラーが発生しても、アプリIDだけでも返す
      return {
        appId: appId.toString(),
        appName: "（取得失敗）",
        pageType: "OTHER",
      };
    }
  }

  function showDialogInputApiKey(appId: string): Promise<{
    status: boolean;
    kintoneApi: string;
    awsApi: string;
  }> {
    return new Promise((resolve) => {
      const existingDialog = document.getElementById(DIALOG_INPUT_ID);
      if (existingDialog) existingDialog.remove();

      const dialog = document.createElement("div");
      dialog.id = DIALOG_INPUT_ID;
      dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 2147483647;
      width: 400px; display: flex; flex-direction: column; gap: 15px;
    `;

      // タイトル
      const title = document.createElement("h3");
      title.textContent = "APIKey入力をしてください";
      title.style.textAlign = "center";
      dialog.appendChild(title);

      const subTitle = document.createElement("p");
      subTitle.textContent =
        "注意:GitHub上のAWS CDKを使用してサーバーをデプロイした後に使用してください。";
      subTitle.style.textAlign = "center";
      dialog.appendChild(subTitle);

      // アプリIDをみせておく
      const appIdLabel = document.createElement("label");
      appIdLabel.textContent = `アプリID:${appId}`;
      dialog.appendChild(appIdLabel);

      // Kintone API
      const kintoneApiInput = document.createElement("input");
      kintoneApiInput.type = "text";
      kintoneApiInput.style.width = "100%";
      const kintoneLabel = document.createElement("label");
      kintoneLabel.textContent = "Kintone API:";
      kintoneLabel.appendChild(kintoneApiInput);
      dialog.appendChild(kintoneLabel);

      // AWS API
      const awsApiInput = document.createElement("input");
      awsApiInput.type = "text";
      awsApiInput.style.width = "100%";
      const awsLabel = document.createElement("label");
      awsLabel.textContent = "AWS API:";
      awsLabel.appendChild(awsApiInput);
      dialog.appendChild(awsLabel);

      // ボタン
      const buttonContainer = document.createElement("div");
      buttonContainer.style.display = "flex";
      buttonContainer.style.justifyContent = "flex-end";
      buttonContainer.style.gap = "10px";

      const fetchButton = document.createElement("button");
      fetchButton.textContent = "送信";
      fetchButton.onclick = () => {
        const kintoneApi = kintoneApiInput.value.trim();
        const awsApi = awsApiInput.value.trim();
        if (!kintoneApi || !awsApi) {
          alert("APIキーを入力してください");
          return;
        }
        dialog.remove();
        resolve({ status: true, kintoneApi, awsApi });
      };

      const closeButton = document.createElement("button");
      closeButton.textContent = "閉じる";
      closeButton.onclick = () => {
        dialog.remove();
        resolve({ status: false, kintoneApi: "", awsApi: "" });
      };

      buttonContainer.appendChild(closeButton);
      buttonContainer.appendChild(fetchButton);
      dialog.appendChild(buttonContainer);
      document.body.appendChild(dialog);
    });
  }

  function showSelectDammyData(): Promise<{
    isSmartDammyData: boolean;
  }> {
    return new Promise((resolve) => {
      const existingDialog = document.getElementById(DIALOG_INPUT_ID);
      if (existingDialog) existingDialog.remove();

      const dialog = document.createElement("div");
      dialog.id = DIALOG_INPUT_ID;
      dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 2147483647;
      width: 400px; display: flex; flex-direction: column; gap: 15px;
    `;

      // タイトル
      const title = document.createElement("h3");
      title.textContent = "ダミーデータを生成";
      title.style.textAlign = "center";
      dialog.appendChild(title);

      // ボタン
      const buttonContainer = document.createElement("div");
      buttonContainer.style.display = "flex";
      buttonContainer.style.justifyContent = "flex-end";
      buttonContainer.style.gap = "10px";

      const SmartDammyDataButton = document.createElement("button");
      SmartDammyDataButton.textContent = "正確なダミーデータ作成";
      SmartDammyDataButton.onclick = () => {
        dialog.remove();
        resolve({ isSmartDammyData: true });
      };

      const LabelDammyDataButton = document.createElement("button");
      LabelDammyDataButton.textContent = "Labelダミーデータ作成";
      LabelDammyDataButton.onclick = () => {
        dialog.remove();
        resolve({ isSmartDammyData: false });
      };

      buttonContainer.appendChild(LabelDammyDataButton);
      buttonContainer.appendChild(SmartDammyDataButton);
      dialog.appendChild(buttonContainer);
      document.body.appendChild(dialog);
    });
  }

  // TODO:ルックアップは入れないことにする。
  function insertLabelDammyData() {
    if (typeof kintone === "undefined" || !kintone || !kintone.app) {
      console.warn(
        "[Kintone Dev Tools] kintone.app object is not available at this moment.",
      );
    }
    let appFields: { [fieldCode: string]: FieldProperty } | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fieldsResponse = kintone.app.record.get();
      console.log("[Kintone Dev Tools] App Form Local Fields:", fieldsResponse);
      const record = fieldsResponse.record;
      for (const key in record) {
        const field = record[key];
        if (field.type === "SINGLE_LINE_TEXT" && field.value === undefined) {
          field.value = key;
        }
      }
      console.log("Result", fieldsResponse);
      kintone.app.record.set(fieldsResponse);
    } catch (fieldsError) {
      console.error(
        "[Kintone Dev Tools] Failed to get app form fields:",
        fieldsError,
      );
    }
  }

  async function main() {
    console.log(
      `[Kintone Dev Tools] Running main function in genalateDummyData.js`,
    );
    try {
      const appInfo = await getAppInfoFromPage(); //アプリ情報の取得
      if (!appInfo) {
        alert(
          "Kintoneアプリ情報を取得できませんでした。ページが正しく読み込まれているか、Kintoneのアプリページであることを確認してください。",
        );
        throw new Error(
          "[Kintone Dev Tools] Failed to get app info even in MAIN world.",
        );
      }
      console.log(appInfo.pageType);
      switch (
        appInfo.pageType // 編集画面か一覧画面か分岐させる。
      ) {
        case "APP_INDEX":
          showAlert("「一覧画面上のダミーデータ作成」機能は現在準備中です。");
          break;
        case "APP_CREATE":
        case "APP_EDIT":
          showSelectDammyData().then(({ isSmartDammyData }) => {
            if (isSmartDammyData) {
              console.log("showDialogInputApiKey");
              showAlert("「正確なダミーデータ作成」機能は開発中です。");
            } else {
              const result = confirm("ラベルダミーデータを作成しますか？");
              if (!result) return;
              insertLabelDammyData();
            }
          });
          break;
        case "OTHER":
          showAlert("「ダミーデータ作成」機能は一覧画面と編集画面の機能です。");
          break;
      }
    } catch (error: unknown) {
      console.error(
        "[Kintone Dev Tools] Error in showAppInfo.js (content script) main function:",
        error,
      );
      if (error instanceof Error) {
        alert(`エラーが発生しました: ${error.message}`);
      } else {
        alert(`予期せぬエラーが発生しました: ${String(error)}`);
      }
    }
  }

  // DOMの準備ができてから実行
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    main();
  } else {
    document.addEventListener("DOMContentLoaded", main);
  }
})();
