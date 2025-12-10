# Kintone 開発者向け Chrome 拡張機能 (devkin-dev-tools)

このリポジトリは、Kintone アプリケーション開発を支援するための Chrome 拡張機能です。

## 機能

- 現在表示している Kintone アプリの情報をダイアログで表示します。
  - アプリ ID
  - アプリ名

## 前提条件

- [Node.js](https://nodejs.org/) (LTS 版を推奨)
- [npm](https://www.npmjs.com/) (Node.js に同梱) または [yarn](https://yarnpkg.com/)

## 初期設定 (インストール)

1.  このリポジトリをクローンします。
    ```bash
    git clone https://github.com/your-username/devkin-dev-tools.git
    ```
    または、SSH を使用している場合:
    ```bash
    git clone git@github.com:your-username/devkin-dev-tools.git
    ```
2.  プロジェクトディレクトリに移動します。
    ```bash
    cd devkin-dev-tools
    ```
3.  依存関係をインストールします。
    ```bash
    npm install
    ```
    または
    ```bash
    yarn install
    ```

## コード品質ツール (Biome)

このプロジェクトでは、フォーマッターとリンターに [Biome](https://biomejs.dev/) を使用しています。

### Biome 拡張機能のインストール

VSCode / Cursor をご利用の場合は、Biome 拡張機能をインストールしてください。

1. 拡張機能パネルを開く (`Ctrl+Shift+X`)
2. 「Biome」を検索
3. 「Biome」（biomejs.biome）をインストール

保存時に自動フォーマットが実行されます。

### コマンド

```bash
# lint チェック
npm run lint

# lint 自動修正
npm run lint:fix

# フォーマットチェック
npm run format

# フォーマット自動修正
npm run format:fix

# lint + フォーマット 両方チェック
npm run check

# lint + フォーマット 両方自動修正
npm run check:fix
```

## ビルド方法

拡張機能を配布用にビルドします。

1.  ビルドコマンドを実行します。
    ```bash
    npm run build
    ```
    または
    ```bash
    yarn build
    ```
2.  ビルドされたファイルは `dist` ディレクトリに出力されます。

## 拡張機能の読み込み (ビルド後)

ビルドされた拡張機能は、開発モードと同様の手順で Chrome に読み込むことができます。

1.  Chrome ブラウザで拡張機能管理ページを開きます (`chrome://extensions`)。
2.  右上の「デベロッパーモード」をオンにします (まだオンになっていない場合)。
3.  「パッケージ化されていない拡張機能を読み込む」ボタンをクリックします。
4.  プロジェクト内の `dist` ディレクトリを選択します。

これで拡張機能が読み込まれ、利用できるようになります。

## ライセンス

このプロジェクトは [MIT License](./LICENSE) の下で公開されています。
