// コンテンツスクリプト: アプリ説明欄の表示/非表示

import type { Kintone } from './types';

declare const kintone: Kintone;

(() => {
  const DIALOG_ID = 'kintone-dev-tools-toggle-app-description-dialog';
  const STORAGE_KEY = 'kintone-dev-tools-hidden-app-ids';

  // ストレージから設定を取得する
  async function getHiddenAppIds(): Promise<number[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch (error) {
      console.error('[Kintone Dev Tools] Failed to get hidden app IDs:', error);
      return [];
    }
  }

  // ストレージに設定を保存する
  async function saveHiddenAppIds(appIds: number[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appIds));
    } catch (error) {
      console.error('[Kintone Dev Tools] Failed to save hidden app IDs:', error);
      throw error;
    }
  }

  // アプリ説明欄を非表示にする
  async function hideAppDescription(): Promise<void> {
    if (!kintone?.app) {
      console.warn('[Kintone Dev Tools] kintone.app is not available.');
      return;
    }

    try {
      const state = await kintone.app.getDescriptionDisplayState();

      if (state !== 'HIDDEN') {
        await kintone.app.showDescription('CLOSED');
      }
    } catch (error) {
      console.error('[Kintone Dev Tools] Error hiding app description:', error);
    }
  }

  // アプリ説明欄を表示する
  async function showAppDescription(): Promise<void> {
    if (!kintone?.app) {
      console.warn('[Kintone Dev Tools] kintone.app is not available.');
      return;
    }

    try {
      const state = await kintone.app.getDescriptionDisplayState();

      if (state !== 'OPEN') {
        await kintone.app.showDescription('OPEN');
      }
    } catch (error) {
      console.error('[Kintone Dev Tools] Error opening app description:', error);
    }
  }

  // 設定ダイアログを表示
  async function showSettingsDialog(): Promise<void> {
    const existingDialog = document.getElementById(DIALOG_ID);
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement('div');
    dialog.id = DIALOG_ID;
    dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 2147483647; width: 450px; display: flex; flex-direction: column; gap: 15px;
      color: #333; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    const title = document.createElement('h3');
    title.textContent = 'アプリ説明欄の表示/非表示';
    title.style.textAlign = 'center';
    title.style.margin = '0 0 10px 0';
    dialog.appendChild(title);

    // 現在のアプリID表示
    let currentAppId = '';
    try {
      const appId = kintone.app.getId();
      if (appId) {
        currentAppId = appId.toString();
      }
    } catch (_e) {
      // アプリID取得失敗時は空文字列のまま
    }

    if (currentAppId) {
      const currentAppLabel = document.createElement('p');
      currentAppLabel.textContent = `現在のアプリID: ${currentAppId}`;
      currentAppLabel.style.fontSize = '0.9em';
      currentAppLabel.style.margin = '0 0 10px 0';
      currentAppLabel.style.padding = '8px';
      currentAppLabel.style.background = '#f0f8ff';
      currentAppLabel.style.border = '1px solid #b0d4f1';
      currentAppLabel.style.borderRadius = '4px';
      currentAppLabel.style.fontWeight = 'bold';
      dialog.appendChild(currentAppLabel);
    }

    // 説明
    const description = document.createElement('p');
    description.textContent =
      'アプリ説明欄を自動的に閉じたいアプリのIDをカンマ区切りで入力してください。';
    description.style.fontSize = '0.9em';
    description.style.margin = '0 0 10px 0';
    description.style.color = '#666';
    dialog.appendChild(description);

    // アプリID入力
    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'アプリID (カンマ区切り)';
    inputLabel.style.display = 'block';
    inputLabel.style.marginBottom = '5px';
    inputLabel.style.fontWeight = 'bold';

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.style.width = 'calc(100% - 12px)';
    inputField.style.padding = '8px';
    inputField.style.border = '1px solid #ccc';
    inputField.style.borderRadius = '4px';
    inputField.style.fontSize = '0.95em';
    inputField.placeholder = '例: 1, 54, 67';

    // 現在の設定を読み込む
    const previousHiddenAppIds = await getHiddenAppIds();
    if (previousHiddenAppIds.length > 0) {
      inputField.value = previousHiddenAppIds.join(', ');
    }

    dialog.appendChild(inputLabel);
    dialog.appendChild(inputField);

    // ボタンコンテナ
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '10px';

    // 閉じるボタン
    const closeButton = document.createElement('button');
    closeButton.textContent = '閉じる';
    closeButton.style.padding = '8px 15px';
    closeButton.style.background = '#ccc';
    closeButton.style.color = '#333';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '0.95em';
    closeButton.onclick = () => dialog.remove();

    // 保存ボタン
    const saveButton = document.createElement('button');
    saveButton.textContent = '保存';
    saveButton.style.padding = '8px 15px';
    saveButton.style.background = '#3498db';
    saveButton.style.color = 'white';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '4px';
    saveButton.style.cursor = 'pointer';
    saveButton.style.fontSize = '0.95em';
    saveButton.onclick = async () => {
      const inputValue = inputField.value.trim();
      let newHiddenAppIds: number[] = [];

      if (inputValue) {
        newHiddenAppIds = inputValue
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !Number.isNaN(id) && id > 0);
      }

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

        const successMsg = document.createElement('div');
        successMsg.textContent = '✓ 設定を保存しました';
        successMsg.style.cssText = `
          position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
          background: #27ae60; color: white; padding: 12px 24px;
          border-radius: 4px; z-index: 2147483648; font-size: 0.95em;
        `;
        document.body.appendChild(successMsg);
        setTimeout(() => {
          successMsg.remove();
        }, 2000);

        dialog.remove();
      } catch (error) {
        console.error('[Kintone Dev Tools] Failed to save settings:', error);
        alert('設定の保存に失敗しました。');
      }
    };

    buttonContainer.appendChild(closeButton);
    buttonContainer.appendChild(saveButton);
    dialog.appendChild(buttonContainer);

    document.body.appendChild(dialog);
  }

  // アプリ表示時に設定に応じて表示/非表示を切り替える
  async function autoToggleAppDescription(): Promise<void> {
    if (!kintone?.app) {
      return;
    }

    const appId = kintone.app.getId();
    if (appId == null) {
      return;
    }

    const hiddenAppIds = await getHiddenAppIds();
    if (hiddenAppIds.includes(appId)) {
      await hideAppDescription();
    } else {
      await showAppDescription();
    }
  }

  window.showToggleAppDescriptionSettings = showSettingsDialog;

  if (!window.__toggleAppDescriptionInitialized__) {
    window.__toggleAppDescriptionInitialized__ = true;

    if (kintone?.events) {
      kintone.events.on(
        [
          'app.record.index.show',
          'app.record.detail.show',
          'app.record.create.show',
          'app.record.edit.show',
        ],
        async () => {
          await autoToggleAppDescription();
        },
      );
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      autoToggleAppDescription();
    } else {
      document.addEventListener('DOMContentLoaded', () => autoToggleAppDescription());
    }

    return;
  }

  showSettingsDialog();
})();
