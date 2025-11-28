// 型のみimport（実行時には消える）
import type { AppInfo, FieldProperty } from "./types"; // AppInfo型はまだ使うかもしれない

// コンテンツスクリプトとして直接実行される処理
(() => {
  // アロー関数に変更
  console.log("[Kintone Dev Tools] showAppInfo.js (content script) loaded.");

  // world: 'MAIN' で実行するため、kintoneオブジェクトの準備完了を待つ過度なリトライは不要になる可能性が高い
  // DOMContentLoaded を待つ程度で十分かもしれない
  // const MAX_RETRIES = 10;
  // const RETRY_INTERVAL = 200;
  // let attempts = 0;

  async function getAppInfoFromPage(): Promise<AppInfo | null> {
    if (typeof kintone === "undefined" || !kintone || !kintone.app) {
      console.warn(
        "[Kintone Dev Tools] kintone.app object is not available at this moment."
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
        { id: appId }
      );
      console.log("[Kintone Dev Tools] App Details Response:", appDetails);

      // 2. アプリのフィールド情報を取得 (運用環境)
      let appFields: { [fieldCode: string]: FieldProperty } | undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fieldsResponse = await (kintone as any).api(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (kintone as any).api.url("/k/v1/app/form/fields.json", true),
          "GET",
          { app: appId, lang: "default" } // lang: default でユーザーの表示言語。live: falseでプレビュー環境。指定なしで運用環境
        );
        console.log(
          "[Kintone Dev Tools] App Form Fields Response:",
          fieldsResponse
        );
        appFields = fieldsResponse.properties;
      } catch (fieldsError) {
        console.error(
          "[Kintone Dev Tools] Failed to get app form fields:",
          fieldsError
        );
        // フィールド情報取得に失敗しても、他の情報は返す
      }

      return {
        appId: appId.toString(),
        appName: appDetails.name || "（名称未設定）",
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
        error
      );
      // APIエラーが発生しても、アプリIDだけでも返す
      return { appId: appId.toString(), appName: "（取得失敗）" };
    }
  }

  function showDialogOnPage(info: AppInfo): void {
    console.log("[Kintone Dev Tools] showDialogOnPage called with info:", info);
    const existingDialog = document.getElementById(
      "kintone-dev-tools-app-info-dialog"
    );
    const existingOverlay = document.getElementById(
      "kintone-dev-tools-app-info-overlay"
    );
    if (existingDialog) existingDialog.remove();
    if (existingOverlay) existingOverlay.remove();
    // オーバーレイを作成
    const overlay = document.createElement("div");
    overlay.id = "kintone-dev-tools-app-info-overlay";
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.3); z-index: 2147483646;
    `;
    
    const dialog = document.createElement("div");
    dialog.id = "kintone-dev-tools-app-info-dialog";
    // eslint-disable-next-line prettier/prettier
    dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 2147483647; max-width: 80%; max-height: 80%; overflow: auto; color: #333; text-align: left;
    `;
    const content = document.createElement("div");
    // アプリ名も表示
    let htmlContent = `<p>現在のアプリID: <strong>${info.appId}</strong></p>`;
    if (info.appName) {
      htmlContent += `<p>アプリ名: <strong>${info.appName}</strong></p>`;
    }
    if (info.spaceId) {
      htmlContent += `<p>スペースID: <strong>${info.spaceId}</strong></p>`;
    }
    if (info.threadId) {
      htmlContent += `<p>スレッドID: <strong>${info.threadId}</strong></p>`;
    }
    if (info.createdAt && info.creatorName) {
      htmlContent += `<p>作成日時: <strong>${new Date(
        info.createdAt
      ).toLocaleString()}</strong> (作成者: ${info.creatorName})</p>`;
    }
    if (info.modifiedAt && info.modifierName) {
      htmlContent += `<p>更新日時: <strong>${new Date(
        info.modifiedAt
      ).toLocaleString()}</strong> (更新者: ${info.modifierName})</p>`;
    }

    // フィールド情報をテーブルで表示
    if (info.fields && Object.keys(info.fields).length > 0) {
      htmlContent += `<h3>フィールド一覧:</h3>`;
      htmlContent += `<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                          <tr style="background-color: #f0f0f0;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">フィールド名 (ラベル)</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">フィールドコード</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">タイプ</th>
                          </tr>
                        </thead>
                        <tbody>`;
      for (const fieldCode in info.fields) {
        const field = info.fields[fieldCode];
        // システムが自動生成する一部のフィールド (レコード番号、作成者など) は type が undefined になることがあるため、表示を調整
        const fieldType = field.type || "(システムフィールド)";
        htmlContent += `<tr>
                          <td style="border: 1px solid #ddd; padding: 8px;">${field.label}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${field.code}</td>
                          <td style="border: 1px solid #ddd; padding: 8px;">${fieldType}</td>
                        </tr>`;
      }
      htmlContent += `</tbody></table>`;
    } else if (info.fields) {
      // fieldsオブジェクトは存在するが空の場合 (APIエラーなど)
      htmlContent += `<p>フィールド情報はありません、または取得できませんでした。</p>`;
    }

    content.innerHTML = htmlContent;
    dialog.appendChild(content);
    
    // 区切り線を追加
    const separator = document.createElement("hr");
    separator.style.cssText = `
      margin: 20px 0;
      border: none;
      border-top: 2px solid #e0e0e0;
    `;
    dialog.appendChild(separator);
    
    // 閉じるボタンをダイアログ内の一番下に表示
    const closeButton = document.createElement("button");
    closeButton.textContent = "閉じる";
    closeButton.style.cssText = `
      display: block;
      margin: 0 auto;
      padding: 12px 24px;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;
    closeButton.onclick = () => {
      dialog.remove();
      overlay.remove();
    };
    dialog.appendChild(closeButton);
    
    // オーバーレイをクリックしたら閉じる
    overlay.onclick = () => {
      dialog.remove();
      overlay.remove();
    };
    
    // オーバーレイとダイアログを追加
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    console.log(
      "[Kintone Dev Tools] Dialog appended to body by content script."
    );
  }

  async function main() {
    console.log(`[Kintone Dev Tools] Running main function in showAppInfo.js`);
    try {
      const appInfo = await getAppInfoFromPage();
      if (appInfo) {
        console.log("[Kintone Dev Tools] Successfully got appInfo:", appInfo);
        showDialogOnPage(appInfo);
      } else {
        // kintoneオブジェクトがまだ準備できていないか、IDが取れなかった場合
        // world: 'MAIN' であれば、通常はDOMContentLoaded後には取得できるはず
        // それでもダメな場合はエラーとして扱う
        console.error(
          "[Kintone Dev Tools] Failed to get app info even in MAIN world."
        );
        alert(
          "Kintoneアプリ情報を取得できませんでした。ページが正しく読み込まれているか、Kintoneのアプリページであることを確認してください。"
        );
      }
    } catch (error: unknown) {
      console.error(
        "[Kintone Dev Tools] Error in showAppInfo.js (content script) main function:",
        error
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
