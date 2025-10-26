// コンテンツスクリプト: フィールドコード変更

// todo:計算式の更新は未対応
// バリデーションエラー箇所を赤くする
// ストレージに設定保存する。

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
    
    // 設定できない文字列を変換
    const forbiddenStrings = {
      'ステータス': 'status',
      '作業者': 'worker',
      'カテゴリー': 'category',
      '__ROOT__': 'root',
      'not': 'not_field'
    };
    
    if (forbiddenStrings[sanitized as keyof typeof forbiddenStrings]) {
      sanitized = forbiddenStrings[sanitized as keyof typeof forbiddenStrings];
    }
    
    // 先頭または末尾のスペースを削除
    sanitized = sanitized.trim();
    
    // それ以外のスペースを_に置換
    sanitized = sanitized.replace(/ /g, '_');
    
    // 使用できない記号を_に置換
    const invalidChars = [
      // 括弧類（全角・半角）
      '(', ')', '「', '」', '[', ']', '【', '】', '{', '}',
      '（', '）', '［', '］', '｛', '｝',
      // 半角記号
      '@', '+', '~', '＃', '#', '%', '&', "'", '=', '|', '^', '*', ';', ':', '?',' ',
      // 全角記号
      '＠', '＋', '～', '％', '＆', '＝', '｜', '＾', '＊', '；', '：', '？','　'
    ];
    
    // 各文字を_に置換
    invalidChars.forEach(char => {
      sanitized = sanitized.replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '_');
    });
    
    // 先頭が半角数字の場合は_を先頭に付与
    if (/^[0-9]/.test(sanitized)) {
      sanitized = '_' + sanitized;
    }
    
    // 空文字列の場合はデフォルト値を設定
    if (sanitized === '') {
      sanitized = 'field_' + Date.now();
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
    
    // ネットワークエラーの場合の詳細なメッセージ
    let errorMessage = "アプリ情報の取得に失敗しました。";
    
    if (error && typeof error === 'object') {
      const errorStr = error.toString();
      if (errorStr.includes('ERR_CONNECTION_RESET') || errorStr.includes('ERR_NETWORK')) {
        errorMessage = "ネットワークエラーが発生しました。\nインターネット接続を確認し、ページを再読み込みしてから再度お試しください。";
      } else if (errorStr.includes('ERR_TIMED_OUT')) {
        errorMessage = "タイムアウトエラーが発生しました。\nしばらく時間をおいてから再度お試しください。";
      } else if (errorStr.includes('403') || errorStr.includes('401')) {
        errorMessage = "アクセス権限がありません。\nこのアプリにアクセスする権限があることを確認してください。";
      } else if (errorStr.includes('404')) {
        errorMessage = "アプリが見つかりません。\n正しいアプリページにいることを確認してください。";
      }
    }
    
    alert(errorMessage);
    return null;
  }
  }


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
    for (const [currentCode, field] of Object.entries(fields)) {
      // システムフィールドを除外
      const systemFields = [
        'レコード番号', '作成者', '作成日時', '更新者', '更新日時','作業者','ステータス','カテゴリー',
        'Record_number', 'Created_by', 'Created_datetime', 'Updated_by', 'Updated_datetime'
      ];
      
      if (systemFields.includes(field.label) || systemFields.includes(currentCode)) {
        continue;
      }
      
      const newCode = sanitizeFieldCode(field.label);
      
      // 全てのフィールドを変更対象とする
      if (newCode.length > 0) {
        changes.push({
          oldCode: currentCode,
          newCode: newCode,
          label: field.label
        });
      }
    }

      // デバッグ用：フィールドコードの確認
      console.log("[Kintone Dev Tools] Available field codes:", Object.keys(fields));
      console.log("[Kintone Dev Tools] Changes to be made:", changes);
      

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
            width: 95%;
            height: 90%;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          ">
            <h2 style="margin-top: 0; color: #333;">フィールドコード変更設定</h2>
            <p>ラベルの文字をフィールドコードに設定する機能です。<br>
            現バージョンはアプリ作成直後での使用を想定しています。</p>            
            <div style="margin: 15px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #666;">
                プレフィックス
              </label>
              <input type="text" 
                     id="prefixInput" 
                     placeholder="次期バージョンで対応予定" 
                     disabled
                     style="
                       width: 200px;
                       padding: 6px;
                       border: 1px solid #ccc;
                       border-radius: 4px;
                       background-color: #f5f5f5;
                       color: #999;
                       font-size: 14px;
                     ">
            </div>
            <table style="
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
              font-size: 14px;
              table-layout: fixed;
            ">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 30%;">ラベル</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 30%;">現在のフィールドコード</th>
                  <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 40%;">新しいフィールドコード</th>
                </tr>
              </thead>
              <tbody>
                ${changes.map((change, index) => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${change.label}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace; background-color: #f9f9f9;">${change.oldCode}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">
                      <input type="text" 
                             id="newCode_${index}" 
                             value="${change.newCode}" 
                             style="
                               width: calc(100% - 8px);
                               padding: 4px;
                               border: 1px solid #ccc;
                               border-radius: 4px;
                               font-family: monospace;
                               font-size: 14px;
                               box-sizing: border-box;
                             "
                             data-original-code="${change.oldCode}"
                             data-label="${change.label}">
                    </td>
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
        // 編集されたフィールドコードを取得
        const updatedChanges = changes.map((change, index) => {
          const input = document.getElementById(`newCode_${index}`) as HTMLInputElement;
          return {
            ...change,
            newCode: input.value.trim()
          };
        }).filter(change => change.newCode.length > 0);

        // バリデーション実行
        const validationResult = validateFieldCodes(updatedChanges, changes);
        if (!validationResult.isValid) {
          showValidationErrors(validationResult.errors);
          return;
        }

        closeDialog();
        executeFieldCodeChanges(updatedChanges);
      });

      // 背景クリックで閉じる
      dialog?.addEventListener('click', (e) => {
        if (e.target === dialog) {
          closeDialog();
        }
      });
    };

    // バリデーション関数
    function validateFieldCodes(updatedChanges: any[], allChanges: any[]) {
      const errors: string[] = [];
      const usedCodes = new Set<string>();
      const existingCodes = new Set<string>(Object.keys(appInfo.fields));

      // 使用できない文字のパターン（Kintone公式ヘルプに準拠）
      const invalidCharPattern = /[()「」[\]【】{}@+~＃#%&'=|^*;:?]/;
      const startsWithNumberPattern = /^[0-9]/;
      
      // 設定できない文字列
      const forbiddenStrings = ['ステータス', '作業者', 'カテゴリー', '__ROOT__', 'not'];

      for (const change of updatedChanges) {
        const { oldCode, newCode, label } = change;

        // 空文字チェック
        if (!newCode || newCode.trim().length === 0) {
          errors.push(`「${label}」: フィールドコードが空です`);
          continue;
        }

        // 設定できない文字列チェック
        if (forbiddenStrings.includes(newCode)) {
          errors.push(`「${label}」: フィールドコードに設定できない文字列です (${newCode})`);
        }

        // 使用できない文字チェック
        if (invalidCharPattern.test(newCode)) {
          errors.push(`「${label}」: フィールドコードに使用できない文字が含まれています (${newCode})`);
        }

        // 先頭が半角数字チェック
        if (startsWithNumberPattern.test(newCode)) {
          errors.push(`「${label}」: フィールドコードは半角数字で始めることはできません (${newCode})`);
        }

        // 重複チェック（現在のコードと同じ場合は除外）
        if (newCode !== oldCode) {
          if (usedCodes.has(newCode)) {
            errors.push(`「${label}」: フィールドコードが重複しています (${newCode})`);
          }
          if (existingCodes.has(newCode)) {
            errors.push(`「${label}」: 既存のフィールドコードと重複しています (${newCode})`);
          }
        }

        usedCodes.add(newCode);
      }

      return {
        isValid: errors.length === 0,
        errors: errors
      };
    }

    // バリデーションエラー表示関数
    function showValidationErrors(errors: string[]) {
      const errorMessage = "以下のエラーがあります：\n\n" + errors.join('\n');
      alert(errorMessage);
    }

    // ダイアログを表示
    showChangesDialog();


    // フィールドコード変更の実行
    const executeFieldCodeChanges = async (changesToExecute: any[]) => {
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
        
        // フィールドコード変更のマッピングを作成
        const fieldCodeMapping: { [oldCode: string]: string } = {};
        for (const change of changesToExecute) {
          fieldCodeMapping[change.oldCode] = change.newCode;
        }
        
        for (const change of changesToExecute) {
          console.log(`[Kintone Dev Tools] Processing change: ${change.oldCode} → ${change.newCode}`);
          
          const originalField = appInfo.fields![change.oldCode];
          if (originalField) {
            // 計算式内のフィールドコード参照を更新
            let updatedExpression = originalField.expression || "";
            if (updatedExpression) {
              // 変更されたフィールドコードを計算式内で置換
              for (const [oldCode, newCode] of Object.entries(fieldCodeMapping)) {
                const regex = new RegExp(`\\b${oldCode}\\b`, 'g');
                updatedExpression = updatedExpression.replace(regex, newCode);
              }
            }
            
            // フィールド設定を変更（codeプロパティを新しいコードに変更）
            properties[change.oldCode] = {
              type: originalField.type,
              code: change.newCode,
              label: originalField.label,
              noLabel: originalField.noLabel || false,
              required: originalField.required || false,
              minLength: originalField.minLength || "",
              maxLength: originalField.maxLength || "",
              expression: updatedExpression,
              hideExpression: originalField.hideExpression || false,
              unique: originalField.unique || false,
              defaultValue: originalField.defaultValue || ""
            };
          }
        }
        
        // 他のフィールドの計算式も更新
        for (const [fieldCode, field] of Object.entries(appInfo.fields!)) {
          if (field.expression && !properties[fieldCode]) {
            let updatedExpression = field.expression;
            let hasChanges = false;
            
            // 変更されたフィールドコードを計算式内で置換
            for (const [oldCode, newCode] of Object.entries(fieldCodeMapping)) {
              const regex = new RegExp(`\\b${oldCode}\\b`, 'g');
              if (updatedExpression.includes(oldCode)) {
                updatedExpression = updatedExpression.replace(regex, newCode);
                hasChanges = true;
              }
            }
            
            if (hasChanges) {
              properties[fieldCode] = {
                ...field,
                expression: updatedExpression
              };
            }
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
          
          alert(`${changesToExecute.length}個のフィールドコードを変更し、運用環境に反映しました。\nページを再読み込みしてください。`);
        } else {
          alert(`${changesToExecute.length}個のフィールドコードをプレビュー環境で変更しました。\n運用環境への反映は管理画面から行ってください。`);
        }
        
        // ページを再読み込み
        location.reload();
      } catch (error) {
        console.error("[Kintone Dev Tools] Failed to change field codes:", error);
        alert("フィールドコードの変更中にエラーが発生しました。");
      }
    };

    } catch (error) {
      console.error("[Kintone Dev Tools] Failed to change field codes:", error);
      
      // 詳細なエラーメッセージを表示
      let errorMessage = "フィールドコードの変更中にエラーが発生しました。";
      
      if (error && typeof error === 'object') {
        const errorStr = error.toString();
        if (errorStr.includes('ERR_CONNECTION_RESET') || errorStr.includes('ERR_NETWORK')) {
          errorMessage = "ネットワークエラーが発生しました。\nインターネット接続を確認し、ページを再読み込みしてから再度お試しください。";
        } else if (errorStr.includes('ERR_TIMED_OUT')) {
          errorMessage = "タイムアウトエラーが発生しました。\nしばらく時間をおいてから再度お試しください。";
        } else if (errorStr.includes('400')) {
          errorMessage = "リクエストが正しくありません。\nフィールドコードに使用できない文字が含まれている可能性があります。";
        } else if (errorStr.includes('403') || errorStr.includes('401')) {
          errorMessage = "アクセス権限がありません。\nこのアプリの設定を変更する権限があることを確認してください。";
        } else if (errorStr.includes('404')) {
          errorMessage = "アプリまたはフィールドが見つかりません。\n正しいアプリページにいることを確認してください。";
        }
      }
      
      alert(errorMessage);
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
