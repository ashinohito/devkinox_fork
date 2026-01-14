/**
 * フィールドの依存関係情報
 */
export interface FieldDependency {
  fieldCode: string;
  fieldLabel: string;
  fieldType: string;
  dependencies: {
    usedInLookup: LookupReference[];
    usedInCalc: CalcReference[];
    usedInPlugins: PluginReference[];
  };
}

/**
 * ルックアップでの参照情報
 */
export interface LookupReference {
  appId: string;
  appName: string;
  fieldCode: string;
  fieldLabel: string;
  /** キーフィールドとして参照されているか、コピー元として参照されているか */
  lookupType: 'key' | 'copy';
}

/**
 * 計算フィールドでの参照情報
 */
export interface CalcReference {
  fieldCode: string;
  fieldLabel: string;
  /** 計算式 */
  expression: string;
}

/**
 * プラグインでの参照情報
 */
export interface PluginReference {
  pluginId: string;
  pluginName: string;
  pluginType: string;
}

/**
 * アプリの基本情報
 */
export interface AppBasicInfo {
  appId: string;
  name: string;
  code?: string;
}

/**
 * kintone APIから取得されるフィールドプロパティ
 */
export interface FieldProperty {
  type: string;
  code: string;
  label: string;
  required?: boolean;
  lookup?: LookupConfig;
  /** 計算フィールドの式 */
  expression?: string;
  /** サブテーブルのフィールド */
  fields?: Record<string, FieldProperty>;
}

/**
 * ルックアップ設定
 */
export interface LookupConfig {
  relatedApp: {
    app: string;
    code: string;
  };
  relatedKeyField: string;
  fieldMappings: FieldMapping[];
}

/**
 * フィールドマッピング設定
 */
export interface FieldMapping {
  field: string;
  relatedField: string;
}
