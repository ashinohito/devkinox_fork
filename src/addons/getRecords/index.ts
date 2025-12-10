// コンテンツスクリプト: 複数のレコードを取得

(() => {
  console.log("[Kintone Dev Tools] getRecords.js (content script) loaded.");

  const DIALOG_INPUT_ID = "kintone-dev-tools-get-records-input-dialog";
  const DIALOG_RESULT_ID = "kintone-dev-tools-get-records-result-dialog";

  // 結果表示用ダイアログ (既存のものを少し調整)
  function showRecordsResultDialog(
    records: any[],
    appIdUsed: string,
    queryUsed: string,
  ): void {
    const existingDialog = document.getElementById(DIALOG_RESULT_ID);
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement("div");
    dialog.id = DIALOG_RESULT_ID;
    // eslint-disable-next-line prettier/prettier
    dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 2147483648; /* 入力ダイアログより手前に */
      max-width: 90%; /* 変更 */
      max-height: 85%; /* 変更 */
      overflow: auto; color: #333; text-align: left;
      display: flex; flex-direction: column; /* コンテンツの高さに応じてダイアログが縮むように */
    `;

    const title = document.createElement("h3");
    title.textContent = `レコード取得結果 (${records.length}件)`;
    title.style.textAlign = "center";
    title.style.marginBottom = "10px";
    dialog.appendChild(title);

    const details = document.createElement("p");
    details.innerHTML = `アプリID: <strong>${appIdUsed}</strong><br>クエリ: <small style="word-break:break-all;">${
      queryUsed || "(指定なし)"
    }</small>`;
    details.style.fontSize = "0.9em";
    details.style.marginBottom = "10px";
    details.style.padding = "5px";
    details.style.border = "1px solid #eee";
    details.style.borderRadius = "4px";

    dialog.appendChild(details);

    const pre = document.createElement("pre");
    pre.style.cssText = `
      background-color: #f5f5f5; border: 1px solid #ccc; padding: 10px; 
      border-radius: 4px; max-height: 500px; /* 変更 */
      overflow-y: auto; white-space: pre-wrap; word-wrap: break-word;
      font-size: 0.85em; /* 追加 */
      flex-grow: 1; /* タイトルやボタン以外の残りの高さを埋める */
      min-height: 100px; /* JSONが短い場合でもある程度の高さを保つ */
    `;
    pre.textContent = JSON.stringify(records, null, 2);
    dialog.appendChild(pre);

    const closeButton = document.createElement("button");
    closeButton.textContent = "閉じる";
    closeButton.style.cssText =
      "margin-top: 15px; padding: 8px 15px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; display: block; margin-left: auto; margin-right: auto;";
    closeButton.onclick = () => dialog.remove();
    dialog.appendChild(closeButton);

    document.body.appendChild(dialog);
    console.log("[Kintone Dev Tools] Records result dialog shown.");
  }

  // レコード取得と結果表示処理
  async function fetchAndDisplayRecords(appId: string, query: string) {
    console.log(
      `[Kintone Dev Tools] Attempting to fetch records for app: ${appId} with query: ${query}`,
    );
    try {
      if (!appId) {
        alert("アプリIDが入力されていません。");
        return;
      }

      const params = { app: appId, query };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (kintone as any).api(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (kintone as any).api.url("/k/v1/records.json", true),
        "GET",
        params,
      );
      console.log(
        "[Kintone Dev Tools] Records fetched successfully:",
        response.records,
      );

      if (response.records) {
        showRecordsResultDialog(response.records, appId, query);
      } else {
        alert(
          "レコードの取得に失敗しました。レスポンスにレコードが含まれていません。",
        );
      }
    } catch (error) {
      console.error("[Kintone Dev Tools] Error fetching records:", error);
      let errorMessage = "レコードの取得中にエラーが発生しました。";
      if (error instanceof Error) {
        errorMessage += `\n${error.message}`;
      }
      alert(errorMessage);
    }
  }

  // 入力用ダイアログ表示
  function showInputDialog() {
    const existingDialog = document.getElementById(DIALOG_INPUT_ID);
    if (existingDialog) existingDialog.remove(); // 既存の入力ダイアログがあれば削除
    // 結果ダイアログもあれば隠すか削除 (ここでは削除)
    const existingResultDialog = document.getElementById(DIALOG_RESULT_ID);
    if (existingResultDialog) existingResultDialog.remove();

    const dialog = document.createElement("div");
    dialog.id = DIALOG_INPUT_ID;
    // eslint-disable-next-line prettier/prettier
    dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 2147483647; /* 結果ダイアログより手前かもしれないので、同じか少し低くてもよい */
      width: 400px; display: flex; flex-direction: column; gap: 15px;
    `;

    const title = document.createElement("h3");
    title.textContent = "レコード取得条件";
    title.style.textAlign = "center";
    title.style.margin = "0 0 10px 0";
    dialog.appendChild(title);

    // アプリID入力
    const appIdLabel = document.createElement("label");
    appIdLabel.textContent = "アプリID:";
    appIdLabel.style.display = "block";
    appIdLabel.style.marginBottom = "5px";
    const appIdInput = document.createElement("input");
    appIdInput.type = "text";
    appIdInput.style.width = "calc(100% - 12px)";
    appIdInput.style.padding = "5px";
    appIdInput.style.border = "1px solid #ccc";
    appIdInput.style.borderRadius = "4px";
    try {
      const currentAppId = kintone.app.getId();
      if (currentAppId) {
        appIdInput.value = currentAppId.toString();
      }
    } catch (e) {
      console.warn(
        "[Kintone Dev Tools] Could not get current app ID for default value.",
      );
    }
    dialog.appendChild(appIdLabel);
    dialog.appendChild(appIdInput);

    // クエリ入力
    const queryLabel = document.createElement("label");
    queryLabel.textContent =
      "検索クエリ (例: limit 10 offset 0 order by レコード番号 desc)";
    queryLabel.style.display = "block";
    queryLabel.style.marginBottom = "5px";
    const queryTextarea = document.createElement("textarea");
    queryTextarea.rows = 3;
    queryTextarea.style.width = "calc(100% - 12px)";
    queryTextarea.style.padding = "5px";
    queryTextarea.style.border = "1px solid #ccc";
    queryTextarea.style.borderRadius = "4px";
    queryTextarea.placeholder = "limit 5 offset 0"; // ダミーのプレースホルダー
    dialog.appendChild(queryLabel);
    dialog.appendChild(queryTextarea);

    // ボタン類
    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.marginTop = "10px";

    const fetchButton = document.createElement("button");
    fetchButton.textContent = "取得";
    fetchButton.style.padding = "8px 15px";
    fetchButton.style.background = "#3498db";
    fetchButton.style.color = "white";
    fetchButton.style.border = "none";
    fetchButton.style.borderRadius = "4px";
    fetchButton.style.cursor = "pointer";
    fetchButton.onclick = () => {
      const appId = appIdInput.value.trim();
      const query = queryTextarea.value.trim();
      if (!appId) {
        alert("アプリIDを入力してください。");
        return;
      }
      // 入力ダイアログを閉じてから結果取得・表示
      // dialog.remove(); // 結果表示時に重ならないようにするため、ここでは閉じない方が良いかもしれない
      fetchAndDisplayRecords(appId, query);
    };

    const closeButton = document.createElement("button");
    closeButton.textContent = "閉じる";
    closeButton.style.padding = "8px 15px";
    closeButton.style.background = "#ccc";
    closeButton.style.color = "#333";
    closeButton.style.border = "none";
    closeButton.style.borderRadius = "4px";
    closeButton.style.cursor = "pointer";
    closeButton.onclick = () => dialog.remove();

    buttonContainer.appendChild(closeButton);
    buttonContainer.appendChild(fetchButton); // 順番変更: 閉じる、取得
    dialog.appendChild(buttonContainer);

    document.body.appendChild(dialog);
    console.log("[Kintone Dev Tools] Input dialog shown.");
  }

  // 初期実行: 入力ダイアログを表示
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    showInputDialog();
  } else {
    document.addEventListener("DOMContentLoaded", showInputDialog);
  }
})();
