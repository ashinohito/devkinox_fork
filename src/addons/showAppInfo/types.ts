// フォームフィールドのプロパティ (簡略版)
export interface FieldProperty {
  type: string; // フィールドタイプ (TEXT, NUMBER, etc.)
  code: string; // フィールドコード
  label: string; // フィールド名 (ラベル)
  // 以下、フィールドタイプによって様々なプロパティが存在するが、ここでは代表的なものや共通的なものをオプショナルで定義
  required?: boolean;
  defaultValue?: unknown;
  options?: unknown; // ラジオボタン、ドロップダウンなど
  // CALC など一部フィールドで利用される
  expression?: string;
  // ... その他、必要に応じて追加
}

export interface AppInfo {
  appId: string | null;
  appName: string | null;
  spaceId?: string;
  threadId?: string;
  creatorName?: string;
  createdAt?: string;
  modifierName?: string;
  modifiedAt?: string;
  fields?: { [fieldCode: string]: FieldProperty }; // フィールド情報
  fieldOrder?: string[]; // 画面上の並び順（フォームレイアウト順）
  fieldOrderItems?: {
    code: string;
    role: "GROUP" | "SUBTABLE" | "FIELD";
    parentRole?: "GROUP" | "SUBTABLE";
  }[]; // レイアウト順（種別付き）
}
