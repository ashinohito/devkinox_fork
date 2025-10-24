// コンテンツスクリプト: フィールドコード変更

// kintoneの型定義
declare const kintone: any;

(() => {
  console.log(
    "[Kintone Dev Tools] changeFieldCodes.js (content script) loaded."
  );

  // フィールドプロパティの型定義
  interface FieldProperty {
    type: string;
    code: string;
    label: string;
    required?: boolean;
    defaultValue?: string | number | string[];
    options?: string | { [key: string]: { label: string; index: string } };
    noLabel?: boolean;
    minLength?: string;
    maxLength?: string;
    expression?: string;
    hideExpression?: boolean;
    unique?: boolean;
  }

  interface AppInfo {
    appId: string | null;
    appName: string | null;
    fields?: { [fieldCode: string]: FieldProperty };
    previewFields?: { [fieldCode: string]: FieldProperty };
  }

  // 文字置換関数：kintoneのフィールドコード命名規則に従って置換
  function sanitizeFieldCode(label: string): string {
    let sanitized = label;
    
    // 先頭の数字を削除（先頭に数字は使用不可）
    sanitized = sanitized.replace(/^[0-9]+/, '');
    
    // 使用できない記号を_に置換
    const invalidChars = [
      // 括弧類
      '(', ')', '「', '」', '[', ']', '【', '】', '{', '}',
      // 半角記号（使用可能な記号以外）
      '@', '+', '~', '＃', '#', '%', '&', "'", '=', '|', '^', '*', ';', ':', '?',
      // スペース
      ' ', '　',
      // その他の使用できない文字
      '!', '"', '$', '(', ')', ',', '.', '/', ':', '<', '>', '?', '[', '\\', ']', '`', '{', '}', '|'
    ];
    
    // 各文字を_に置換
    invalidChars.forEach(char => {
      sanitized = sanitized.replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '_');
    });
    
    // 先頭と末尾の_を削除
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    
    // 空文字列の場合はデフォルト値を設定
    if (sanitized === '') {
      sanitized = 'field_' + Date.now();
    }
    
    // 先頭が数字の場合はプレフィックスを追加
    if (/^[0-9]/.test(sanitized)) {
      sanitized = 'field_' + sanitized;
    }
    
    return sanitized;
  }

  // アプリ情報を取得
  async function getAppInfoFromPage(): Promise<AppInfo | null> {
    if (typeof kintone === 'undefined' || !kintone.app) {
      console.warn(
        "[Kintone Dev Tools] kintone.app object is not available at this moment."
      );
      return null;
    }
    
    const appId = kintone.app.getId();
    if (appId === null || appId === undefined) {
      console.warn("[Kintone Dev Tools] App ID is not available.");
      return null;
    }
    
    console.log("[Kintone Dev Tools] kintone.app.getId():", appId);

    try {
      // アプリ詳細情報を取得
      const appDetails = await (kintone as any).api(
        (kintone as any).api.url("/k/v1/app.json", true),
        "GET",
        { id: appId }
      );
      console.log("[Kintone Dev Tools] App Details Response:", appDetails);

      // 運用環境のフィールド情報を取得
      let productionFields: { [fieldCode: string]: FieldProperty } | undefined;
      try {
        const productionFieldsResponse = await (kintone as any).api(
          (kintone as any).api.url("/k/v1/app/form/fields.json", true),
          "GET",
          { app: appId, lang: "default" }
        );
        console.log(
          "[Kintone Dev Tools] Production Fields Response:",
          productionFieldsResponse
        );
        productionFields = productionFieldsResponse.properties;
      } catch (productionFieldsError) {
        console.error(
          "[Kintone Dev Tools] Failed to get production fields:",
          productionFieldsError
        );
        return null;
      }

      // プレビュー環境のフィールド情報を取得
      let previewFields: { [fieldCode: string]: FieldProperty } | undefined;
      try {
        const previewFieldsResponse = await (kintone as any).api(
          (kintone as any).api.url("/k/v1/preview/app/form/fields.json", true),
          "GET",
          { app: appId, lang: "default" }
        );
    console.log(
          "[Kintone Dev Tools] Preview Fields Response:",
          previewFieldsResponse
        );
        previewFields = previewFieldsResponse.properties;
      } catch (previewFieldsError) {
        console.error(
          "[Kintone Dev Tools] Failed to get preview fields:",
          previewFieldsError
        );
        return null;
      }

      return {
        appId: appId.toString(),
        appName: appDetails.name,
        fields: productionFields,
        previewFields: previewFields
      };
    } catch (error) {
      console.error("[Kintone Dev Tools] Failed to get app info:", error);
      return null;
    }
  }

  // エラーダイアログを表示する関数（グローバル）
  const showErrorDialog = (error: any) => {
    const errorMessage = error?.message || error?.toString() || "不明なエラー";
    const stackTrace = error?.stack || "スタックトレースが利用できません";
    
    const errorDialogHTML = `
      <div id="errorDialog" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10001;
        display: flex;
        justify-content: center;
        align-items: center;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          padding: 20px;
          max-width: 90%;
          max-height: 90%;
          overflow: auto;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
          <h3 style="margin-top: 0; color: #dc3545;">エラーが発生しました</h3>
          <div style="margin: 15px 0;">
            <h4 style="color: #333; margin-bottom: 10px;">エラーメッセージ:</h4>
            <div style="
              background-color: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 10px;
              font-family: monospace;
              font-size: 14px;
              white-space: pre-wrap;
              word-break: break-all;
            ">${errorMessage}</div>
          </div>
          <div style="margin: 15px 0;">
            <h4 style="color: #333; margin-bottom: 10px;">スタックトレース:</h4>
            <div style="
              background-color: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 10px;
              font-family: monospace;
              font-size: 12px;
              white-space: pre-wrap;
              word-break: break-all;
              max-height: 300px;
              overflow-y: auto;
            ">${stackTrace}</div>
          </div>
          <div style="text-align: right; margin-top: 20px;">
            <button id="closeErrorBtn" style="
              background-color: #6c757d;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
            ">閉じる</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', errorDialogHTML);

    const errorDialog = document.getElementById('errorDialog');
    const closeErrorBtn = document.getElementById('closeErrorBtn');

    const closeErrorDialog = () => {
      if (errorDialog) {
        errorDialog.remove();
      }
    };

    closeErrorBtn?.addEventListener('click', closeErrorDialog);

    // 背景クリックで閉じる
    errorDialog?.addEventListener('click', (e) => {
      if (e.target === errorDialog) {
        closeErrorDialog();
      }
    });
  };

  // フィールドコード変更の実行
  async function changeFieldCodes() {
    try {
      const appInfo = await getAppInfoFromPage();
      if (!appInfo || !appInfo.fields) {
        alert("アプリ情報の取得に失敗しました。");
        return;
      }

      const fields = appInfo.fields;
      const previewFields = appInfo.previewFields;
      const changes: Array<{ oldCode: string; newCode: string; label: string }> = [];

      // 運用環境とプレビュー環境のフィールドコードを比較
      if (previewFields) {
        const productionFieldCodes = Object.keys(fields || {});
        const previewFieldCodes = Object.keys(previewFields);
        
        console.log("[Kintone Dev Tools] Production field codes:", productionFieldCodes);
        console.log("[Kintone Dev Tools] Preview field codes:", previewFieldCodes);
        
        // フィールドコードが異なる場合をチェック
        const differentFields = productionFieldCodes.filter(code => !previewFieldCodes.includes(code));
        const newFields = previewFieldCodes.filter(code => !productionFieldCodes.includes(code));
        
        if (differentFields.length > 0 || newFields.length > 0) {
          const warningMessage = `運用環境とプレビュー環境でフィールドコードが異なっています。\n\n` +
            `運用環境で変更されたフィールド: ${differentFields.length > 0 ? differentFields.join(', ') : 'なし'}\n` +
            `プレビュー環境で追加されたフィールド: ${newFields.length > 0 ? newFields.join(', ') : 'なし'}\n\n` +
            `フィールドコードの変更を中止します。\n` +
            `運用環境とプレビュー環境を同期してから再度実行してください。`;
          
          alert(warningMessage);
          return;
        }
      }

      // 各フィールドのコードをラベルベースで変更
      const usedCodes = new Set<string>();
      const existingCodes = new Set<string>(Object.keys(fields));
      const labelToCodeMap = new Map<string, string[]>();
      
      // まず、ラベルごとにフィールドコードをグループ化
      for (const [currentCode, field] of Object.entries(fields)) {
        const sanitizedLabel = sanitizeFieldCode(field.label);
        if (!labelToCodeMap.has(sanitizedLabel)) {
          labelToCodeMap.set(sanitizedLabel, []);
        }
        labelToCodeMap.get(sanitizedLabel)!.push(currentCode);
      }
      
      // 衝突がある場合のみ変更を検討
      for (const [sanitizedLabel, fieldCodes] of labelToCodeMap.entries()) {
        // 同じラベルから生成されるフィールドコードが複数ある場合のみ処理
        if (fieldCodes.length > 1) {
          console.log(`[Kintone Dev Tools] Found collision for label "${sanitizedLabel}":`, fieldCodes);
          
          // 各フィールドコードに対して新しいコードを生成
          for (const currentCode of fieldCodes) {
            const field = fields[currentCode];
            let newCode = sanitizedLabel;
            
            // 既存のフィールドコードと同じ場合は変更しない
            if (currentCode === newCode) {
              usedCodes.add(newCode);
              continue;
            }
            
            // 同じフィールドコードが既に使用されている場合は連番を付ける
            if (usedCodes.has(newCode) || existingCodes.has(newCode)) {
              // 空いている数字を探す
              let counter = 1;
              let numberedCode = `${newCode}_${counter}`;
              
              while (usedCodes.has(numberedCode) || existingCodes.has(numberedCode)) {
                counter++;
                numberedCode = `${newCode}_${counter}`;
              }
              
              newCode = numberedCode;
            }
            
            // 使用済みコードに追加
            usedCodes.add(newCode);
            
            // 現在のコードと異なる場合のみ変更対象とする
            if (currentCode !== newCode && newCode.length > 0) {
              changes.push({
                oldCode: currentCode,
                newCode: newCode,
                label: field.label
              });
            }
          }
        }
      }

      // デバッグ用：フィールドコードの確認
      console.log("[Kintone Dev Tools] Available field codes:", Object.keys(fields));
      console.log("[Kintone Dev Tools] Changes to be made:", changes);
      console.log("[Kintone Dev Tools] Used codes during generation:", Array.from(usedCodes));
      
      // 連番が付いたフィールドコードの確認
      const numberedChanges = changes.filter(change => change.newCode.includes('_'));
      if (numberedChanges.length > 0) {
        console.log("[Kintone Dev Tools] Fields with numbered codes:", numberedChanges);
      }

      if (changes.length === 0) {
        alert("変更が必要なフィールドコードはありません。");
        return;
      }

    // 変更内容を表形式で表示
    const showChangesDialog = () => {
      // ダイアログ用のHTMLを作成
      const dialogHTML = `
        <div id="fieldCodeChangesDialog" style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          justify-content: center;
          align-items: center;
        ">
          <div style="
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          ">
            <h3 style="margin-top: 0; color: #333;">フィールドコード変更の確認</h3>
            <p>以下のフィールドコードを変更しますか？</p>
            <table style="
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
              font-size: 14px;
            ">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">フィールド名</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">現在のコード</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">新しいコード</th>
                </tr>
              </thead>
              <tbody>
                ${changes.map(change => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${change.label}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace; background-color: #f9f9f9;">${change.oldCode}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace; background-color: #e8f5e8;">${change.newCode}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div style="text-align: right; margin-top: 20px;">
              <button id="cancelBtn" style="
                background-color: #6c757d;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
              ">キャンセル</button>
              <button id="confirmBtn" style="
                background-color: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
              ">変更を実行</button>
            </div>
          </div>
        </div>
      `;

      // ダイアログをDOMに追加
      document.body.insertAdjacentHTML('beforeend', dialogHTML);

      // イベントリスナーを追加
      const dialog = document.getElementById('fieldCodeChangesDialog');
      const cancelBtn = document.getElementById('cancelBtn');
      const confirmBtn = document.getElementById('confirmBtn');

      const closeDialog = () => {
        if (dialog) {
          dialog.remove();
        }
      };

      cancelBtn?.addEventListener('click', closeDialog);
      confirmBtn?.addEventListener('click', () => {
        closeDialog();
        executeFieldCodeChanges();
      });

      // 背景クリックで閉じる
      dialog?.addEventListener('click', (e) => {
        if (e.target === dialog) {
          closeDialog();
        }
      });
    };


    // フィールドコード変更の実行
    const executeFieldCodeChanges = async () => {
      try {
        // アプリの現在のリビジョンを取得
        const appDetails = await (kintone as any).api(
          (kintone as any).api.url("/k/v1/app.json", true),
          "GET",
          { id: appInfo.appId }
        );
        const currentRevision = appDetails.revision;

        // フィールド設定を変更するアプローチ
        const properties: { [key: string]: any } = {};
        
        for (const change of changes) {
          console.log(`[Kintone Dev Tools] Processing change: ${change.oldCode} → ${change.newCode}`);
          
          const originalField = appInfo.fields![change.oldCode];
          if (originalField) {
            // フィールド設定を変更（codeプロパティを新しいコードに変更）
            properties[change.oldCode] = {
              type: originalField.type,
              code: change.newCode,
              label: originalField.label,
              noLabel: originalField.noLabel || false,
              required: originalField.required || false,
              minLength: originalField.minLength || "",
              maxLength: originalField.maxLength || "",
              expression: originalField.expression || "",
              hideExpression: originalField.hideExpression || false,
              unique: originalField.unique || false,
              defaultValue: originalField.defaultValue || ""
            };
          }
        }

        // プレビュー環境でフィールド設定を一括変更
        console.log("[Kintone Dev Tools] Updating field settings in preview environment");
        console.log("[Kintone Dev Tools] Properties to update:", properties);
        
        try {
          const updateResponse = await (kintone as any).api(
            (kintone as any).api.url("/k/v1/preview/app/form/fields.json", true),
            "PUT",
            {
              app: appInfo.appId,
              revision: currentRevision,
              properties: properties
            }
          );
          
          console.log("[Kintone Dev Tools] Preview update response:", updateResponse);
          console.log(`[Kintone Dev Tools] Successfully updated ${changes.length} field(s) in preview environment`);
          
          // プレビュー環境の変更を確認
          const previewCheckResponse = await (kintone as any).api(
            (kintone as any).api.url("/k/v1/preview/app/form/fields.json", true),
            "GET",
            { app: appInfo.appId, lang: "default" }
          );
          
          console.log("[Kintone Dev Tools] Preview environment fields after update:", previewCheckResponse.properties);
          
        } catch (previewError) {
          console.error("[Kintone Dev Tools] Failed to update preview environment:", previewError);
          throw previewError;
        }
        
        // 運用環境への反映確認ダイアログを表示
        const deployConfirmMessage = `プレビュー環境でフィールドコードを変更しました。\n\n運用環境に反映しますか？\n\n注意: 運用環境への反映は元に戻せません。`;
        
        if (confirm(deployConfirmMessage)) {
          // 運用環境に反映
          await (kintone as any).api(
            (kintone as any).api.url("/k/v1/preview/app/deploy.json", true),
            "POST",
            {
              apps: [{
                app: parseInt(appInfo.appId!),
                revision: currentRevision + 1
              }],
              revert: false
            }
          );
          
          alert(`${changes.length}個のフィールドコードを変更し、運用環境に反映しました。\nページを再読み込みしてください。`);
        } else {
          alert(`${changes.length}個のフィールドコードをプレビュー環境で変更しました。\n運用環境への反映は管理画面から行ってください。`);
        }
        
        // ページを再読み込み
        location.reload();
      } catch (error) {
        console.error("[Kintone Dev Tools] Failed to change field codes:", error);
        showErrorDialog(error);
      }
    };

      // ダイアログを表示
      showChangesDialog();
    } catch (error) {
      console.error("[Kintone Dev Tools] Failed to change field codes:", error);
      showErrorDialog(error);
    }
  }

  // DOMの準備ができてから実行
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    changeFieldCodes();
  } else {
    document.addEventListener("DOMContentLoaded", changeFieldCodes);
  }
})();
