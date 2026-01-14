import type {
  FieldDependency,
  LookupReference,
  CalcReference,
  PluginReference,
  AppBasicInfo,
  FieldProperty,
} from './types';

interface KintoneAPI {
  api: {
    (url: string, method: string, params: Record<string, unknown>): Promise<unknown>;
    url: (path: string, detectGuestSpace: boolean) => string;
  };
  app: {
    getId: () => number | null;
  };
}

declare const kintone: KintoneAPI;

(() => {
  function showLoadingModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background-color: white;
      padding: 30px;
      border-radius: 10px;
      text-align: center;
      min-width: 400px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    const spinner = document.createElement('div');
    spinner.style.cssText = `
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    `;

    // アニメーション用のスタイルを追加
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    const title = document.createElement('h3');
    title.textContent = 'フィールド依存関係をチェック中...';
    title.style.cssText = 'margin: 0 0 15px 0; color: #333;';

    const progressText = document.createElement('p');
    progressText.id = 'dependency-check-progress';
    progressText.style.cssText = 'margin: 10px 0; color: #666; font-size: 14px;';
    progressText.textContent = '準備中...';

    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      width: 100%;
      height: 20px;
      background-color: #f0f0f0;
      border-radius: 10px;
      overflow: hidden;
      margin-top: 10px;
    `;

    const progressFill = document.createElement('div');
    progressFill.id = 'dependency-check-progress-fill';
    progressFill.style.cssText = `
      width: 0%;
      height: 100%;
      background-color: #3498db;
      transition: width 0.3s ease;
    `;

    progressBar.appendChild(progressFill);
    content.appendChild(spinner);
    content.appendChild(title);
    content.appendChild(progressText);
    content.appendChild(progressBar);
    modal.appendChild(content);
    document.body.appendChild(modal);

    return modal;
  }

  function updateLoadingProgress(
    modal: HTMLElement,
    current: number,
    total: number,
    message: string,
  ): void {
    const progressText = modal.querySelector('#dependency-check-progress');
    const progressFill = modal.querySelector('#dependency-check-progress-fill') as HTMLElement;

    if (progressText) {
      progressText.textContent = `${message} (${current}/${total})`;
    }

    if (progressFill) {
      const percentage = (current / total) * 100;
      progressFill.style.width = `${percentage}%`;
    }
  }

  function closeLoadingModal(modal: HTMLElement): void {
    if (modal && modal.parentNode) {
      document.body.removeChild(modal);
    }
  }

  function showAppIdRangeDialog(): Promise<{ startAppId: string; endAppId: string } | null> {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
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
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background-color: white;
        padding: 25px;
        border-radius: 8px;
        min-width: 450px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      `;

      const title = document.createElement('h3');
      title.textContent = 'チェック対象のアプリID範囲を入力';
      title.style.cssText = 'margin: 0 0 15px 0; color: #333;';

      const description = document.createElement('p');
      description.textContent = 'アプリ依存関係をチェックするアプリIDの範囲を指定してください。';
      description.style.cssText = 'margin: 0 0 15px 0; color: #666; font-size: 13px;';

      // 開始アプリID
      const startInputLabel = document.createElement('label');
      startInputLabel.textContent = '開始アプリID:';
      startInputLabel.style.cssText =
        'display: block; margin-bottom: 5px; color: #333; font-weight: bold;';

      const startInput = document.createElement('input');
      startInput.type = 'text';
      startInput.placeholder = '開始アプリID（例: 1）';
      startInput.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
        margin-bottom: 15px;
      `;

      // 終了アプリID
      const endInputLabel = document.createElement('label');
      endInputLabel.textContent = '終了アプリID:';
      endInputLabel.style.cssText =
        'display: block; margin-bottom: 5px; color: #333; font-weight: bold;';

      const endInput = document.createElement('input');
      endInput.type = 'text';
      endInput.placeholder = '終了アプリID（例: 100）';
      endInput.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
      `;

      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText =
        'margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;';

      const cancelButton = document.createElement('button');
      cancelButton.textContent = 'キャンセル';
      cancelButton.style.cssText = `
        padding: 10px 20px;
        background-color: #95a5a6;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      `;
      cancelButton.onmouseover = () => {
        cancelButton.style.backgroundColor = '#7f8c8d';
      };
      cancelButton.onmouseout = () => {
        cancelButton.style.backgroundColor = '#95a5a6';
      };
      cancelButton.onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      const okButton = document.createElement('button');
      okButton.textContent = 'チェック開始';
      okButton.style.cssText = `
        padding: 10px 20px;
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      `;
      okButton.onmouseover = () => {
        okButton.style.backgroundColor = '#2980b9';
      };
      okButton.onmouseout = () => {
        okButton.style.backgroundColor = '#3498db';
      };
      okButton.onclick = () => {
        const startAppId = startInput.value.trim();
        const endAppId = endInput.value.trim();

        if (!startAppId || !/^\d+$/.test(startAppId)) {
          alert('有効な開始アプリIDを入力してください。');
          return;
        }
        if (!endAppId || !/^\d+$/.test(endAppId)) {
          alert('有効な終了アプリIDを入力してください。');
          return;
        }
        if (Number(startAppId) > Number(endAppId)) {
          alert('開始アプリIDは終了アプリID以下にしてください。');
          return;
        }
        document.body.removeChild(modal);
        resolve({ startAppId, endAppId });
      };

      // Enterキーで確定
      const handleEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          okButton.click();
        }
      };
      startInput.addEventListener('keypress', handleEnter);
      endInput.addEventListener('keypress', handleEnter);

      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(okButton);
      content.appendChild(title);
      content.appendChild(description);
      content.appendChild(startInputLabel);
      content.appendChild(startInput);
      content.appendChild(endInputLabel);
      content.appendChild(endInput);
      content.appendChild(buttonContainer);
      modal.appendChild(content);
      document.body.appendChild(modal);

      // 入力欄にフォーカス
      setTimeout(() => startInput.focus(), 100);

      // モーダル外クリックでキャンセル
      modal.onclick = (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
          resolve(null);
        }
      };
    });
  }

  function validateKintoneEnvironment(): boolean {
    if (typeof kintone === 'undefined' || !kintone?.app) {
      alert('kintoneオブジェクトが利用できません。');
      return false;
    }
    return true;
  }

  async function checkFieldDependencies(): Promise<void> {
    if (!validateKintoneEnvironment()) {
      return;
    }

    // アプリID範囲入力ダイアログを表示
    const appIdRange = await showAppIdRangeDialog();
    if (!appIdRange) {
      return; // キャンセルされた場合
    }

    const { startAppId, endAppId } = appIdRange;

    try {
      // ローディング表示を作成
      const loadingModal = showLoadingModal();

      // 1. 指定範囲のアプリIDを直接取得（存在チェック）
      const targetApps: AppBasicInfo[] = [];
      const skippedApps: string[] = [];
      const targetAppFieldsMap = new Map<
        string,
        { app: AppBasicInfo; fields: { [key: string]: FieldProperty } }
      >();

      const startNum = Number(startAppId);
      const endNum = Number(endAppId);
      const rangeSize = endNum - startNum + 1;

      let processedCount = 0;

      // 指定範囲のアプリIDを順にチェック
      for (let appId = startNum; appId <= endNum; appId++) {
        processedCount++;
        updateLoadingProgress(
          loadingModal,
          processedCount,
          rangeSize,
          `アプリID ${appId} を確認中...`,
        );

        try {
          // アプリ情報を取得
          const appInfoResponse = (await kintone.api(
            kintone.api.url('/k/v1/app.json', true),
            'GET',
            { id: appId },
          )) as { appId: string; name: string; code?: string };

          // フィールド情報を取得
          const fieldsResponse = (await kintone.api(
            kintone.api.url('/k/v1/app/form/fields.json', true),
            'GET',
            { app: appId },
          )) as { properties: { [key: string]: FieldProperty } };

          const app: AppBasicInfo = {
            appId: appInfoResponse.appId,
            name: appInfoResponse.name,
            code: appInfoResponse.code,
          };

          targetApps.push(app);
          targetAppFieldsMap.set(String(appId), {
            app: app,
            fields: fieldsResponse.properties || {},
          });
        } catch (error) {
          const errorCode = (error as { code?: string })?.code;
          if (errorCode === 'GAIA_AP01') {
            // アプリが存在しない場合はスキップ
            continue;
          } else if (errorCode === 'GAIA_IL23') {
            skippedApps.push(`アプリID ${appId} - ゲストスペース内`);
          } else {
            skippedApps.push(`アプリID ${appId} - アクセス権限なし`);
          }
        }
      }

      if (targetApps.length === 0) {
        closeLoadingModal(loadingModal);
        alert(`アプリID ${startAppId}〜${endAppId} の範囲に有効なアプリが見つかりませんでした。`);
        return;
      }

      // 2. 全アプリの一覧を取得（ルックアップ参照チェック用）
      const allApps: AppBasicInfo[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const appsResponse = (await kintone.api(kintone.api.url('/k/v1/apps.json', true), 'GET', {
          limit: limit,
          offset: offset,
        })) as { apps: AppBasicInfo[] };

        const apps = appsResponse.apps || [];
        allApps.push(...apps);

        if (apps.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      // 3. 各対象アプリの依存関係マップを初期化
      const appDependencies: Map<
        string,
        {
          app: AppBasicInfo;
          dependencyMap: Map<string, FieldDependency>;
        }
      > = new Map();

      for (const [appId, { app, fields }] of targetAppFieldsMap.entries()) {
        const dependencyMap = new Map<string, FieldDependency>();
        for (const [fieldCode, fieldProp] of Object.entries(fields)) {
          dependencyMap.set(fieldCode, {
            fieldCode: fieldCode,
            fieldLabel: fieldProp.label,
            fieldType: fieldProp.type,
            dependencies: {
              usedInLookup: [],
              usedInCalc: [],
              usedInPlugins: [],
            },
          });
        }
        appDependencies.set(appId, { app, dependencyMap });
      }

      const totalChecks = rangeSize + allApps.length;

      // 4. 全アプリのフィールドを1回ずつ取得して、対象アプリへの参照をチェック
      for (const otherApp of allApps) {
        processedCount++;
        updateLoadingProgress(
          loadingModal,
          processedCount,
          totalChecks,
          `アプリ "${otherApp.name}" (ID: ${otherApp.appId}) をチェック中...`,
        );

        // 対象アプリ自身はスキップ
        if (targetAppFieldsMap.has(otherApp.appId)) continue;

        try {
          const otherAppFields = (await kintone.api(
            kintone.api.url('/k/v1/app/form/fields.json', true),
            'GET',
            { app: otherApp.appId },
          )) as { properties: { [key: string]: FieldProperty } };

          const otherFields = otherAppFields.properties || {};

          // 他のアプリから対象アプリへのルックアップ参照をチェック
          for (const [otherFieldCode, otherFieldProp] of Object.entries(otherFields)) {
            const lookupTargetAppId = otherFieldProp.lookup?.relatedApp?.app;
            if (
              lookupTargetAppId &&
              otherFieldProp.lookup &&
              appDependencies.has(lookupTargetAppId)
            ) {
              const { dependencyMap } = appDependencies.get(lookupTargetAppId)!;

              // キーフィールドとして参照されているか
              const keyField = otherFieldProp.lookup.relatedKeyField;
              if (keyField && dependencyMap.has(keyField)) {
                dependencyMap.get(keyField)!.dependencies.usedInLookup.push({
                  appId: otherApp.appId,
                  appName: otherApp.name,
                  fieldCode: otherFieldCode,
                  fieldLabel: otherFieldProp.label,
                  lookupType: 'key',
                });
              }

              // コピー元フィールドとして参照されているか
              const mappings = otherFieldProp.lookup.fieldMappings || [];
              for (const mapping of mappings) {
                const relatedField = mapping.relatedField;
                if (relatedField && dependencyMap.has(relatedField)) {
                  dependencyMap.get(relatedField)!.dependencies.usedInLookup.push({
                    appId: otherApp.appId,
                    appName: otherApp.name,
                    fieldCode: otherFieldCode,
                    fieldLabel: otherFieldProp.label,
                    lookupType: 'copy',
                  });
                }
              }
            }
          }
        } catch {
          // 他のアプリの取得エラーは無視
        }
      }

      // 5. 各対象アプリの計算フィールドとプラグインをチェック
      for (const [appId, { app, dependencyMap }] of appDependencies.entries()) {
        const { fields } = targetAppFieldsMap.get(appId)!;

        // 計算フィールドでの使用をチェック（同一アプリ内）
        for (const [calcFieldCode, calcFieldProp] of Object.entries(fields)) {
          if (calcFieldProp.type === 'CALC' && calcFieldProp.expression) {
            for (const [fieldCode, dependency] of dependencyMap.entries()) {
              if (calcFieldProp.expression.includes(fieldCode)) {
                dependency.dependencies.usedInCalc.push({
                  fieldCode: calcFieldCode,
                  fieldLabel: calcFieldProp.label,
                  expression: calcFieldProp.expression,
                });
              }
            }
          }
        }

        // プラグインでの使用をチェック
        try {
          const pluginsResponse = (await kintone.api(
            kintone.api.url('/k/v1/app/plugins.json', true),
            'GET',
            { app: appId },
          )) as {
            plugins: Record<
              string,
              { name?: string; type?: string; config?: Record<string, unknown> }
            >;
          };

          const plugins = pluginsResponse.plugins || {};
          for (const [pluginId, pluginData] of Object.entries(plugins)) {
            const configStr = JSON.stringify(pluginData.config || {});
            for (const [fieldCode, dependency] of dependencyMap.entries()) {
              if (configStr.includes(fieldCode)) {
                dependency.dependencies.usedInPlugins.push({
                  pluginId: pluginId,
                  pluginName: pluginData.name || '不明なプラグイン',
                  pluginType: pluginData.type || '不明',
                });
              }
            }
          }
        } catch {
          // プラグインの取得に失敗しても処理を続行
        }
      }

      // 6. 結果を整形
      const finalAppDependencies: Map<
        string,
        {
          app: AppBasicInfo;
          dependencies: FieldDependency[];
        }
      > = new Map();

      for (const [appId, { app, dependencyMap }] of appDependencies.entries()) {
        const dependencies: FieldDependency[] = [];
        for (const dependency of dependencyMap.values()) {
          const hasAnyDependency =
            dependency.dependencies.usedInLookup.length > 0 ||
            dependency.dependencies.usedInCalc.length > 0 ||
            dependency.dependencies.usedInPlugins.length > 0;

          if (hasAnyDependency) {
            dependencies.push(dependency);
          }
        }

        finalAppDependencies.set(appId, {
          app: app,
          dependencies: dependencies,
        });
      }

      // ローディングを閉じる
      closeLoadingModal(loadingModal);

      // 結果を表示
      displayAppDependencies(finalAppDependencies, skippedApps, { startAppId, endAppId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      alert(`依存関係のチェック中にエラーが発生しました: ${errorMessage}`);
    }
  }

  function displayAppDependencies(
    appDependencies: Map<string, { app: AppBasicInfo; dependencies: FieldDependency[] }>,
    skippedApps: string[],
    range: { startAppId: string; endAppId: string },
  ): void {
    // モーダルウィンドウを作成
    const modal = document.createElement('div');
    modal.style.cssText = `
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
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 90%;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    const title = document.createElement('h2');
    title.textContent = 'アプリ依存関係チェック結果';
    title.style.cssText = `
      margin-top: 0;
      margin-bottom: 10px;
      color: #333;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    `;
    content.appendChild(title);

    // チェック対象範囲の情報を表示
    const rangeInfoBox = document.createElement('div');
    rangeInfoBox.style.cssText = `
      background-color: #e3f2fd;
      border: 1px solid #2196f3;
      border-radius: 5px;
      padding: 12px;
      margin-bottom: 15px;
    `;
    const rangeInfoText = document.createElement('p');
    rangeInfoText.innerHTML = `<strong>📋 チェック範囲:</strong> アプリID ${range.startAppId}〜${range.endAppId} <span style="color: #666;">(${appDependencies.size}件のアプリを分析)</span>`;
    rangeInfoText.style.cssText = 'margin: 0; color: #1565c0; font-size: 14px;';
    rangeInfoBox.appendChild(rangeInfoText);
    content.appendChild(rangeInfoBox);

    // スキップされたアプリの情報を表示
    if (skippedApps.length > 0) {
      const warningBox = document.createElement('div');
      warningBox.style.cssText = `
        background-color: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 5px;
        padding: 12px;
        margin-bottom: 15px;
      `;
      const warningTitle = document.createElement('p');
      warningTitle.innerHTML = `<strong>⚠️ 注意:</strong> 以下のアプリはチェックできませんでした:`;
      warningTitle.style.cssText = 'margin: 0 0 8px 0; color: #856404; font-size: 13px;';
      warningBox.appendChild(warningTitle);

      const skippedList = document.createElement('ul');
      skippedList.style.cssText = 'margin: 0; padding-left: 20px; color: #856404; font-size: 12px;';
      for (const appInfo of skippedApps) {
        const item = document.createElement('li');
        item.textContent = appInfo;
        skippedList.appendChild(item);
      }
      warningBox.appendChild(skippedList);
      content.appendChild(warningBox);
    }

    let totalDependencies = 0;
    for (const { dependencies } of appDependencies.values()) {
      totalDependencies += dependencies.length;
    }

    if (totalDependencies === 0) {
      const noDepMessage = document.createElement('p');
      noDepMessage.textContent = '指定範囲のアプリに依存関係は見つかりませんでした。';
      noDepMessage.style.cssText = 'color: #666; font-size: 14px;';
      content.appendChild(noDepMessage);
    } else {
      // アプリごとに表示
      for (const [appId, { app, dependencies }] of appDependencies.entries()) {
        if (dependencies.length === 0) continue;

        const appSection = document.createElement('div');
        appSection.style.cssText = `
          margin-bottom: 30px;
          padding: 20px;
          border: 2px solid #3498db;
          border-radius: 8px;
          background-color: #f8f9fa;
        `;

        const appHeader = document.createElement('h3');
        appHeader.textContent = `${app.name} (ID: ${app.appId})`;
        appHeader.style.cssText = `
          margin-top: 0;
          margin-bottom: 15px;
          color: #2c3e50;
          font-size: 18px;
          padding-bottom: 10px;
          border-bottom: 1px solid #bdc3c7;
        `;
        appSection.appendChild(appHeader);

        const depCount = document.createElement('p');
        depCount.textContent = `依存関係のあるフィールド: ${dependencies.length}件`;
        depCount.style.cssText =
          'margin: 0 0 15px 0; color: #e74c3c; font-weight: bold; font-size: 14px;';
        appSection.appendChild(depCount);

        for (const dep of dependencies) {
          const fieldSection = document.createElement('div');
          fieldSection.style.cssText = `
          margin-bottom: 25px;
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 5px;
          background-color: #f9f9f9;
        `;

          const fieldHeader = document.createElement('h3');
          fieldHeader.textContent = `${dep.fieldLabel} (${dep.fieldCode})`;
          fieldHeader.style.cssText = `
          margin-top: 0;
          margin-bottom: 10px;
          color: #2c3e50;
          font-size: 16px;
        `;
          fieldSection.appendChild(fieldHeader);

          const typeLabel = document.createElement('p');
          typeLabel.textContent = `タイプ: ${dep.fieldType}`;
          typeLabel.style.cssText = `
          margin: 5px 0;
          color: #7f8c8d;
          font-size: 13px;
        `;
          fieldSection.appendChild(typeLabel);

          // ルックアップ参照
          if (dep.dependencies.usedInLookup.length > 0) {
            const lookupHeader = document.createElement('h4');
            lookupHeader.textContent = '📋 ルックアップで参照されています:';
            lookupHeader.style.cssText = `
            margin-top: 15px;
            margin-bottom: 8px;
            color: #e74c3c;
            font-size: 14px;
          `;
            fieldSection.appendChild(lookupHeader);

            const lookupList = document.createElement('ul');
            lookupList.style.cssText = 'margin: 5px 0; padding-left: 20px;';
            for (const lookup of dep.dependencies.usedInLookup) {
              const item = document.createElement('li');
              item.textContent = `${lookup.appName} (アプリID: ${lookup.appId}) - フィールド: ${
                lookup.fieldLabel
              } (${lookup.fieldCode}) [${
                lookup.lookupType === 'key' ? 'キーフィールド' : 'コピー元'
              }]`;
              item.style.cssText = 'margin: 5px 0; font-size: 13px;';
              lookupList.appendChild(item);
            }
            fieldSection.appendChild(lookupList);
          }

          // 計算フィールド参照
          if (dep.dependencies.usedInCalc.length > 0) {
            const calcHeader = document.createElement('h4');
            calcHeader.textContent = '🔢 計算フィールドで使用されています:';
            calcHeader.style.cssText = `
            margin-top: 15px;
            margin-bottom: 8px;
            color: #f39c12;
            font-size: 14px;
          `;
            fieldSection.appendChild(calcHeader);

            const calcList = document.createElement('ul');
            calcList.style.cssText = 'margin: 5px 0; padding-left: 20px;';
            for (const calc of dep.dependencies.usedInCalc) {
              const item = document.createElement('li');
              item.style.cssText = 'margin: 5px 0; font-size: 13px;';
              item.innerHTML = `${calc.fieldLabel} (${calc.fieldCode})<br><span style="color: #95a5a6; font-size: 12px;">計算式: ${calc.expression}</span>`;
              calcList.appendChild(item);
            }
            fieldSection.appendChild(calcList);
          }

          // プラグイン参照
          if (dep.dependencies.usedInPlugins.length > 0) {
            const pluginHeader = document.createElement('h4');
            pluginHeader.textContent = '🔌 プラグインで使用されています:';
            pluginHeader.style.cssText = `
            margin-top: 15px;
            margin-bottom: 8px;
            color: #9b59b6;
            font-size: 14px;
          `;
            fieldSection.appendChild(pluginHeader);

            const pluginList = document.createElement('ul');
            pluginList.style.cssText = 'margin: 5px 0; padding-left: 20px;';
            for (const plugin of dep.dependencies.usedInPlugins) {
              const item = document.createElement('li');
              item.textContent = `${plugin.pluginName} (ID: ${plugin.pluginId})`;
              item.style.cssText = 'margin: 5px 0; font-size: 13px;';
              pluginList.appendChild(item);
            }
            fieldSection.appendChild(pluginList);
          }

          appSection.appendChild(fieldSection);
        }

        content.appendChild(appSection);
      }
    }

    // 閉じるボタン
    const closeButton = document.createElement('button');
    closeButton.textContent = '閉じる';
    closeButton.style.cssText = `
      margin-top: 20px;
      padding: 10px 20px;
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    `;
    closeButton.onmouseover = () => {
      closeButton.style.backgroundColor = '#2980b9';
    };
    closeButton.onmouseout = () => {
      closeButton.style.backgroundColor = '#3498db';
    };
    closeButton.onclick = () => {
      document.body.removeChild(modal);
    };
    content.appendChild(closeButton);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // モーダル外クリックで閉じる
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  // 実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkFieldDependencies);
  } else {
    checkFieldDependencies();
  }
})();
