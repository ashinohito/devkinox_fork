// kintone API の型定義（index.tsで使用）

export interface KintoneApp {
  getId(): number | null;
  showDescription(state: "OPEN" | "CLOSED"): Promise<void>;
  getDescriptionDisplayState(): Promise<"OPEN" | "CLOSED" | "HIDDEN">;
}

export interface KintoneEvents {
  on(events: string[], callback: () => void): void;
}

export interface Kintone {
  app: KintoneApp;
  events: KintoneEvents;
}

// グローバル変数の型定義
declare global {
  interface Window {
    showToggleAppDescriptionSettings?: () => Promise<void>;
    __toggleAppDescriptionInitialized__?: boolean;
  }
}
