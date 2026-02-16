# アプリ管理者用メモを編集

このアドオンは、kintone のアプリ管理者用メモを編集するための機能です。

- アドオンID: `editAppAdminNote`
- 命名方針: 単体形（`Note`）で統一
- 対象API:
	- GET `/k/v1/preview/app/adminNotes.json`
	- PUT `/k/v1/preview/app/adminNotes.json`
	- POST `/k/v1/preview/app/deploy.json`
	- GET `/k/v1/preview/app/deploy.json`

## 使い方

1. kintone のアプリ画面で「アプリ管理者用メモを編集」を実行します。
2. 現在のアプリ管理者用メモ内容と設定（テンプレート/再利用へ含める）を読み込みます。
3. 内容を編集して「保存」を押すと、アプリ管理者用メモを更新します。
4. 更新後、自動でアプリ設定を運用環境へ反映し、反映完了まで確認します。

## 仕様

- メモ本文は `0` 文字以上 `10,000` 文字以下です。
- 保存時は取得済みの `revision` を付与して更新します。
- 更新成功時はダイアログ上で最新 `revision` を表示します。
- 保存成功後、`deploy` API を呼び出して運用環境へ反映します。
- 反映状況確認APIをポーリングし、`SUCCESS` / `FAIL` / `CANCEL` / タイムアウトを判定します。
- 反映確認中はスピナー表示され、入力欄・保存ボタン・閉じるボタン・オーバーレイクリックを無効化します。
- 通知は次の優先順位で表示します。
	- ダイアログ表示中: アドオン独自の前面トースト表示
	- ダイアログ非表示時: `kintone.showNotification` を使用（失敗時は前面トーストへフォールバック）

## 参考

- [アプリ管理者用メモを取得する](https://cybozu.dev/ja/kintone/docs/rest-api/apps/get-app-admin-notes/)
- [アプリ管理者用メモを変更する](https://cybozu.dev/ja/kintone/docs/rest-api/apps/update-app-admin-notes/)
- [アプリの設定を運用環境へ反映する](https://cybozu.dev/ja/kintone/docs/rest-api/apps/settings/deploy-app-settings/)
- [アプリの設定の運用環境への反映状況を確認する](https://cybozu.dev/ja/kintone/docs/rest-api/apps/settings/get-app-deploy-status/)
- [画面上部にメッセージを表示する](https://cybozu.dev/ja/kintone/docs/js-api/kintone/show-notification/)
