// コンテンツスクリプト: DualAPIRecordUpdater - 2種類のレコード一括更新

(() => {
  console.log("[Kintone Dev Tools] DualAPIRecordUpdater loaded.");

  const LABEL = "2種類のレコード一括更新";
  const DIALOG_ID = "kintone-dev-tools-dual-api-record-updater-dialog";

  // ========================================
  // スタイル注入
  // ========================================
  function injectStyles(): void {
    if (document.getElementById("dual-api-record-updater-styles")) return;

    const styleSheet = document.createElement("style");
    styleSheet.id = "dual-api-record-updater-styles";
    styleSheet.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600&display=swap');

.webhook-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    animation: fadeIn 0.3s ease forwards;
}

@keyframes fadeIn {
    to { opacity: 1; }
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(30px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.webhook-dialog {
    font-family: 'Noto Sans JP', sans-serif;
    background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
    padding: 32px;
    border-radius: 20px;
    min-width: 420px;
    max-width: 500px;
    box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.25),
        0 0 0 1px rgba(255, 255, 255, 0.1);
    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.webhook-dialog-title {
    font-size: 20px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 24px 0;
    display: flex;
    align-items: center;
    gap: 10px;
}

.webhook-dialog-title::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 24px;
    background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    border-radius: 2px;
}

.webhook-select {
    width: 100%;
    padding: 14px 16px;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 14px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    background: white;
    color: #334155;
    cursor: pointer;
    transition: all 0.2s ease;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 18px;
}

.webhook-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.webhook-select:hover {
    border-color: #cbd5e1;
}

.webhook-btn-container {
    margin-top: 28px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.webhook-btn-cancel {
    font-family: 'Noto Sans JP', sans-serif;
    font-weight: 500;
    font-size: 14px;
    padding: 12px 24px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    background: white;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
}

.webhook-btn-cancel:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #475569;
}

.webhook-btn-execute {
    font-family: 'Noto Sans JP', sans-serif;
    font-weight: 500;
    font-size: 14px;
    padding: 12px 28px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.webhook-btn-execute:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.webhook-progress-title {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 20px 0;
}

.webhook-progress-message {
    font-size: 14px;
    color: #64748b;
    margin-bottom: 16px;
}

.webhook-progress-bar-container {
    width: 100%;
    height: 12px;
    background: #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
    position: relative;
}

.webhook-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
    background-size: 200% 100%;
    border-radius: 6px;
    transition: width 0.3s ease;
    animation: shimmer 2s infinite linear;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.webhook-progress-text {
    margin-top: 12px;
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    color: #475569;
}

.webhook-progress-percent {
    font-size: 32px;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.webhook-error-dialog {
    font-family: 'Noto Sans JP', sans-serif;
    background: linear-gradient(145deg, #ffffff 0%, #fef2f2 100%);
    padding: 32px;
    border-radius: 20px;
    min-width: 500px;
    max-width: 700px;
    max-height: 80vh;
    box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.25),
        0 0 0 1px rgba(255, 255, 255, 0.1);
    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.webhook-error-title {
    font-size: 20px;
    font-weight: 600;
    color: #dc2626;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 10px;
}

.webhook-error-title::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 24px;
    background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
    border-radius: 2px;
}

.webhook-error-content {
    background: #1e293b;
    color: #e2e8f0;
    padding: 16px;
    border-radius: 12px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    line-height: 1.6;
    overflow: auto;
    max-height: 400px;
    white-space: pre-wrap;
    word-break: break-all;
}

.webhook-error-close {
    font-family: 'Noto Sans JP', sans-serif;
    font-weight: 500;
    font-size: 14px;
    padding: 12px 28px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4);
    margin-top: 20px;
    display: block;
    margin-left: auto;
}

.webhook-error-close:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(220, 38, 38, 0.5);
}

.dual-api-info-link {
    color: #667eea;
    cursor: pointer;
    font-size: 13px;
    text-align: center;
    margin: 5px 0;
    text-decoration: underline;
    transition: color 0.2s ease;
}

.dual-api-info-link:hover {
    color: #764ba2;
}

.dual-api-info-panel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    margin-top: 10px;
    font-size: 13px;
    display: none;
}

.dual-api-info-panel.open {
    display: block;
}

.dual-api-info-section {
    margin-bottom: 10px;
}

.dual-api-info-section:last-child {
    margin-bottom: 0;
}

.dual-api-info-title {
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 2px solid;
}

.dual-api-info-title.bulk {
    border-color: #667eea;
}

.dual-api-info-title.single {
    border-color: #f5576c;
}

.dual-api-info-list {
    list-style: none;
    padding: 0;
    margin: 0;
    color: #475569;
}

.dual-api-info-list li {
    padding: 2px 0;
    padding-left: 1em;
    text-indent: -1em;
}

.dual-api-info-list li::before {
    content: "・";
}

.countdown-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(8px);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
}

.countdown-container {
    position: relative;
    width: 200px;
    height: 200px;
}

.countdown-svg {
    transform: rotate(-90deg);
    width: 200px;
    height: 200px;
}

.countdown-circle-bg {
    fill: none;
    stroke: #334155;
    stroke-width: 8;
}

.countdown-circle-progress {
    fill: none;
    stroke: url(#countdown-gradient);
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear;
}

.countdown-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
}

.countdown-seconds {
    font-size: 48px;
    font-weight: 700;
    color: white;
    line-height: 1;
}

.countdown-label {
    font-size: 14px;
    color: #94a3b8;
    margin-top: 4px;
}

.countdown-message {
    color: #e2e8f0;
    font-size: 14px;
    margin-top: 24px;
    text-align: center;
}
`;
    document.head.appendChild(styleSheet);
  }

  // ========================================
  // フィールド関連
  // ========================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function getFields(appId: number): Promise<Record<string, any>> {
    const resp = await kintone.api("/k/v1/app/form/fields.json", "GET", {
      app: appId,
    });
    return resp.properties;
  }

  async function showFieldSelectDialog(appId: number): Promise<string | null> {
    const fields = await getFields(appId);

    const editableTypes = [
      "SINGLE_LINE_TEXT",
      "MULTI_LINE_TEXT",
      "RICH_TEXT",
      "NUMBER",
      "DROP_DOWN",
      "RADIO_BUTTON",
      "CHECK_BOX",
      "MULTI_SELECT",
      "DATE",
      "TIME",
      "DATETIME",
      "LINK",
    ];
    const editableFields = Object.entries(fields)
      .filter(([, field]) => editableTypes.includes(field.type))
      .map(([code, field]) => ({ code, label: field.label, type: field.type }));

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "webhook-overlay";

      const dialog = document.createElement("div");
      dialog.className = "webhook-dialog";

      const title = document.createElement("h3");
      title.className = "webhook-dialog-title";
      title.textContent = "更新するフィールドを選択";

      const select = document.createElement("select");
      select.className = "webhook-select";

      for (const field of editableFields) {
        const option = document.createElement("option");
        option.value = field.code;
        option.textContent = `${field.label} (${field.code})`;
        select.appendChild(option);
      }

      const buttonContainer = document.createElement("div");
      buttonContainer.className = "webhook-btn-container";

      const cancelButton = document.createElement("button");
      cancelButton.className = "webhook-btn-cancel";
      cancelButton.textContent = "キャンセル";
      cancelButton.addEventListener("click", () => {
        overlay.style.animation = "fadeIn 0.2s ease reverse forwards";
        setTimeout(() => document.body.removeChild(overlay), 200);
        resolve(null);
      });

      const okButton = document.createElement("button");
      okButton.className = "webhook-btn-execute";
      okButton.textContent = "実行";
      okButton.addEventListener("click", () => {
        overlay.style.animation = "fadeIn 0.2s ease reverse forwards";
        setTimeout(() => document.body.removeChild(overlay), 200);
        resolve(select.value);
      });

      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(okButton);

      dialog.appendChild(title);
      dialog.appendChild(select);
      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
  }

  // ========================================
  // エラーダイアログ
  // ========================================
  function showErrorDialog(error: unknown) {
    const overlay = document.createElement("div");
    overlay.className = "webhook-overlay";

    const dialog = document.createElement("div");
    dialog.className = "webhook-error-dialog";

    const title = document.createElement("h3");
    title.className = "webhook-error-title";
    title.textContent = "エラーが発生しました";

    const content = document.createElement("pre");
    content.className = "webhook-error-content";
    content.textContent = JSON.stringify(error, null, 2);

    const closeButton = document.createElement("button");
    closeButton.className = "webhook-error-close";
    closeButton.textContent = "閉じる";
    closeButton.addEventListener("click", () => {
      overlay.style.animation = "fadeIn 0.2s ease reverse forwards";
      setTimeout(() => document.body.removeChild(overlay), 200);
    });

    dialog.appendChild(title);
    dialog.appendChild(content);
    dialog.appendChild(closeButton);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  // ========================================
  // プログレスダイアログ
  // ========================================
  interface ProgressDialog {
    update: (current: number, total: number, message?: string) => void;
    close: () => void;
  }

  function showProgressDialog(dialogTitle: string): ProgressDialog {
    const overlay = document.createElement("div");
    overlay.className = "webhook-overlay";

    const dialog = document.createElement("div");
    dialog.className = "webhook-dialog";

    const titleEl = document.createElement("h3");
    titleEl.className = "webhook-progress-title";
    titleEl.textContent = dialogTitle;

    const messageEl = document.createElement("div");
    messageEl.className = "webhook-progress-message";
    messageEl.textContent = "準備中...";

    const progressContainer = document.createElement("div");
    progressContainer.className = "webhook-progress-bar-container";

    const progressBar = document.createElement("div");
    progressBar.className = "webhook-progress-bar";
    progressBar.style.width = "0%";

    const percentText = document.createElement("div");
    percentText.className = "webhook-progress-text";
    percentText.innerHTML = '<span class="webhook-progress-percent">0</span>%';

    progressContainer.appendChild(progressBar);
    dialog.appendChild(titleEl);
    dialog.appendChild(messageEl);
    dialog.appendChild(progressContainer);
    dialog.appendChild(percentText);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    return {
      update: (current: number, total: number, message?: string) => {
        const percent = Math.round((current / total) * 100);
        progressBar.style.width = `${percent}%`;
        percentText.innerHTML = `<span class="webhook-progress-percent">${percent}</span>% <span style="color:#94a3b8">(${current}/${total})</span>`;
        if (message) {
          messageEl.textContent = message;
        }
      },
      close: () => {
        overlay.style.animation = "fadeIn 0.3s ease reverse forwards";
        setTimeout(() => document.body.removeChild(overlay), 300);
      },
    };
  }

  // ========================================
  // カウントダウン表示
  // ========================================
  async function showCountdown(
    seconds: number,
    message: string
  ): Promise<void> {
    const radius = 90;
    const circumference = 2 * Math.PI * radius;

    const overlay = document.createElement("div");
    overlay.className = "countdown-overlay";
    overlay.innerHTML = `
      <div class="countdown-container">
        <svg class="countdown-svg" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="countdown-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#f093fb"/>
              <stop offset="100%" style="stop-color:#f5576c"/>
            </linearGradient>
          </defs>
          <circle class="countdown-circle-bg" cx="100" cy="100" r="${radius}"/>
          <circle class="countdown-circle-progress" cx="100" cy="100" r="${radius}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="0"/>
        </svg>
        <div class="countdown-text">
          <div class="countdown-seconds">${seconds}</div>
          <div class="countdown-label">秒</div>
        </div>
      </div>
      <div class="countdown-message">${message}</div>
    `;
    document.body.appendChild(overlay);

    const progressCircle = overlay.querySelector(
      ".countdown-circle-progress"
    ) as SVGCircleElement;
    const secondsEl = overlay.querySelector(
      ".countdown-seconds"
    ) as HTMLElement;

    for (let sec = seconds; sec > 0; sec--) {
      secondsEl.textContent = sec.toString();
      const offset = circumference * (1 - sec / seconds);
      progressCircle.style.strokeDashoffset = offset.toString();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    secondsEl.textContent = "0";
    progressCircle.style.strokeDashoffset = circumference.toString();

    await new Promise((resolve) => setTimeout(resolve, 300));
    overlay.remove();
  }

  // ========================================
  // レコード取得・更新
  // ========================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function getAllRecords(appId: number): Promise<any[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records: any[] = [];
    let offset = 0;
    const limit = 500;

    const condition = kintone.app.getQueryCondition();
    const baseQuery = condition ? `${condition}` : "";

    while (true) {
      const query = baseQuery
        ? `${baseQuery} limit ${limit} offset ${offset}`
        : `limit ${limit} offset ${offset}`;

      const resp = await kintone.api("/k/v1/records.json", "GET", {
        app: appId,
        query: query,
      });
      records.push(...resp.records);
      if (resp.records.length < limit) break;
      offset += limit;
    }

    return records;
  }

  // records.json で一括更新
  async function updateAllRecordsBulk(
    appId: number,
    fieldCode: string
  ): Promise<void> {
    const progress = showProgressDialog("一括更新 (records.json)");

    try {
      progress.update(0, 100, "レコード取得中...");
      console.log(`一括更新開始 (records.json) - フィールド: ${fieldCode}`);
      const records = await getAllRecords(appId);
      console.log(`${records.length}件のレコードを一括更新します`);

      const updateRecords = records.map((record) => ({
        id: record.$id.value,
        record: {
          [fieldCode]: { value: record[fieldCode].value },
        },
      }));

      const chunkSize = 100;
      const totalChunks = Math.ceil(updateRecords.length / chunkSize);

      for (let i = 0; i < updateRecords.length; i += chunkSize) {
        const chunk = updateRecords.slice(i, i + chunkSize);
        const currentChunk = Math.floor(i / chunkSize) + 1;

        progress.update(
          i,
          updateRecords.length,
          `更新中... (${currentChunk}/${totalChunks} バッチ)`
        );

        await kintone.api("/k/v1/records.json", "PUT", {
          app: appId,
          records: chunk,
        });
        console.log(`${i + chunk.length}/${updateRecords.length} 件更新完了`);
      }

      progress.update(
        updateRecords.length,
        updateRecords.length,
        "完了しました!"
      );
      console.log("一括更新完了");

      setTimeout(() => {
        progress.close();
      }, 800);
    } catch (error) {
      progress.close();
      console.error("エラー:", error);
      showErrorDialog(error);
    }
  }

  // record.json で1件ずつ更新
  async function updateAllRecordsSingle(
    appId: number,
    fieldCode: string,
    rateLimitMode: boolean = false
  ): Promise<void> {
    const progress = showProgressDialog("個別更新 (record.json)");

    try {
      progress.update(0, 100, "レコード取得中...");
      console.log(
        `個別更新開始 (record.json) - フィールド: ${fieldCode}, 制限モード: ${rateLimitMode}`
      );
      const records = await getAllRecords(appId);
      console.log(`${records.length}件のレコードを個別更新します`);

      for (let i = 0; i < records.length; i++) {
        // 60件ごとに1分待機（制限モード時）
        if (rateLimitMode && i > 0 && i % 60 === 0) {
          console.log(`回数制限のため60秒待機開始 (${i}件処理済み)`);
          await showCountdown(
            60,
            `回数制限のため待機中... (${i}/${records.length}件処理済み)`
          );
          console.log("待機完了、処理再開");
        }

        const record = records[i];

        progress.update(
          i,
          records.length,
          `更新中... (レコードID: ${record.$id.value})`
        );

        await kintone.api("/k/v1/record.json", "PUT", {
          app: appId,
          id: record.$id.value,
          record: {
            [fieldCode]: { value: record[fieldCode].value },
          },
        });
        console.log(`${i + 1}/${records.length} 件更新完了`);
      }

      progress.update(records.length, records.length, "完了しました!");
      console.log("個別更新完了");

      setTimeout(() => {
        progress.close();
      }, 800);
    } catch (error) {
      progress.close();
      console.error("エラー:", error);
      showErrorDialog(error);
    }
  }

  // ========================================
  // メインダイアログ
  // ========================================
  function showDialog(): void {
    const existingDialog = document.getElementById(DIALOG_ID);
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement("div");
    dialog.id = DIALOG_ID;
    dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 2147483647;
      width: 400px; display: flex; flex-direction: column; gap: 15px;
    `;

    const title = document.createElement("h3");
    title.textContent = LABEL;
    title.style.textAlign = "center";
    title.style.margin = "0 0 10px 0";
    dialog.appendChild(title);

    const description = document.createElement("p");
    description.textContent =
      "選択したフィールドの値を再保存し、Webhook等をトリガーします。";
    description.style.textAlign = "center";
    description.style.color = "#666";
    description.style.fontSize = "14px";
    dialog.appendChild(description);

    // 「APIの違いを見る」リンク
    const infoLink = document.createElement("div");
    infoLink.className = "dual-api-info-link";
    infoLink.textContent = "APIの違いを見る ▼";
    dialog.appendChild(infoLink);

    // 情報パネル
    const infoPanel = document.createElement("div");
    infoPanel.className = "dual-api-info-panel";
    infoPanel.innerHTML = `
      <div class="dual-api-info-section">
        <div class="dual-api-info-title bulk">records.json（一括更新）</div>
        <ul class="dual-api-info-list">
          <li>Webhook: 発火しない</li>
          <li>通知: 送信されない</li>
          <li>処理速度: 高速（最大100件/回）</li>
        </ul>
      </div>
      <div class="dual-api-info-section">
        <div class="dual-api-info-title single">record.json（個別更新）</div>
        <ul class="dual-api-info-list">
          <li>Webhook: 発火する</li>
          <li>通知: 送信される</li>
          <li>処理速度: 低速（1件/回）</li>
        </ul>
      </div>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
        ※ 回数制限: 1分間に60回まで（61回目以降は送信されない）
      </div>
    `;
    dialog.appendChild(infoPanel);

    // リンククリックでパネルをトグル
    infoLink.onclick = () => {
      const isOpen = infoPanel.classList.toggle("open");
      infoLink.textContent = isOpen ? "APIの違いを見る ▲" : "APIの違いを見る ▼";
    };

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.flexDirection = "column";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.marginTop = "10px";

    // 一括更新ボタン (records.json)
    const bulkButton = document.createElement("button");
    bulkButton.textContent = "一括更新 (records.json)";
    bulkButton.style.cssText = `
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; border: none; border-radius: 8px; cursor: pointer;
      font-size: 14px; font-weight: 500;
      transition: all 0.3s ease;
    `;
    bulkButton.onmouseenter = () => {
      bulkButton.style.transform = "translateY(-2px)";
      bulkButton.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
    };
    bulkButton.onmouseleave = () => {
      bulkButton.style.transform = "translateY(0)";
      bulkButton.style.boxShadow = "none";
    };
    bulkButton.onclick = async () => {
      dialog.remove();
      const appId = kintone.app.getId();
      if (!appId) {
        alert("アプリIDを取得できませんでした。");
        return;
      }
      const fieldCode = await showFieldSelectDialog(appId);
      if (fieldCode) {
        await updateAllRecordsBulk(appId, fieldCode);
      }
    };
    buttonContainer.appendChild(bulkButton);

    // 個別更新ボタン (record.json)
    const singleButton = document.createElement("button");
    singleButton.textContent = "個別更新 (record.json)";
    singleButton.style.cssText = `
      padding: 12px 20px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white; border: none; border-radius: 8px; cursor: pointer;
      font-size: 14px; font-weight: 500;
      transition: all 0.3s ease;
    `;
    singleButton.onmouseenter = () => {
      singleButton.style.transform = "translateY(-2px)";
      singleButton.style.boxShadow = "0 4px 15px rgba(245, 87, 108, 0.4)";
    };
    singleButton.onmouseleave = () => {
      singleButton.style.transform = "translateY(0)";
      singleButton.style.boxShadow = "none";
    };
    buttonContainer.appendChild(singleButton);

    // 回数制限モードのチェックボックス
    const rateLimitContainer = document.createElement("label");
    rateLimitContainer.style.cssText = `
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: #64748b; cursor: pointer;
      padding: 4px 0;
    `;
    const rateLimitCheckbox = document.createElement("input");
    rateLimitCheckbox.type = "checkbox";
    rateLimitCheckbox.style.cssText = `
      width: 16px; height: 16px; cursor: pointer;
      accent-color: #f5576c;
    `;
    const rateLimitLabel = document.createTextNode(
      "回数制限モード（60件ごとに1分待機）"
    );
    rateLimitContainer.appendChild(rateLimitCheckbox);
    rateLimitContainer.appendChild(rateLimitLabel);
    buttonContainer.appendChild(rateLimitContainer);

    // 個別更新ボタンのクリックイベント
    singleButton.onclick = async () => {
      const rateLimitMode = rateLimitCheckbox.checked;
      dialog.remove();
      const appId = kintone.app.getId();
      if (!appId) {
        alert("アプリIDを取得できませんでした。");
        return;
      }
      const fieldCode = await showFieldSelectDialog(appId);
      if (fieldCode) {
        await updateAllRecordsSingle(appId, fieldCode, rateLimitMode);
      }
    };

    // 閉じるボタン
    const closeButton = document.createElement("button");
    closeButton.textContent = "閉じる";
    closeButton.style.cssText = `
      padding: 10px 20px; background: #e2e8f0; color: #475569;
      border: none; border-radius: 8px; cursor: pointer;
      font-size: 14px; margin-top: 5px;
    `;
    closeButton.onclick = () => dialog.remove();
    buttonContainer.appendChild(closeButton);

    dialog.appendChild(buttonContainer);

    document.body.appendChild(dialog);
    console.log("[Kintone Dev Tools] DualAPIRecordUpdater dialog shown.");
  }

  // ========================================
  // 初期化
  // ========================================
  injectStyles();

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    showDialog();
  } else {
    document.addEventListener("DOMContentLoaded", showDialog);
  }
})();
