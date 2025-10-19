// フォームフィールドのプロパティ (簡略版)
export interface FieldProperty {
  type: string; // フィールドタイプ (TEXT, NUMBER, etc.)
  code: string; // フィールドコード
  label: string; // フィールド名 (ラベル)
  required?: boolean;
  defaultValue?: string | number | string[];
  options?: string | { [key: string]: { label: string; index: string } }; // ラジオボタン、ドロップダウンなど
}

//一覧画面か、作成画面化、編集画面かその他か特定するため
export type PageType = "APP_INDEX" | "APP_CREATE" | "APP_EDIT" | "OTHER";

export interface AppInfo {
  appId: string;
  appName: string | null;
  pageType :PageType;
  spaceId?: string;
  threadId?: string;
  creatorName?: string;
  createdAt?: string;
  modifierName?: string;
  modifiedAt?: string;
  fields?: { [fieldCode: string]: FieldProperty }; // フィールド情報
}
