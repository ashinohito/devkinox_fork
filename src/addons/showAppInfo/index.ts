// 型のみimport（実行時には消える）
import type { AppInfo, FieldProperty } from "./types"; // AppInfo型はまだ使うかもしれない

// コンテンツスクリプトとして直接実行される処理
(() => {
  // アロー関数に変更
  console.log("[Kintone Dev Tools] showAppInfo.js (content script) loaded.");

  type KintoneApi = ((
    url: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    params: unknown,
  ) => Promise<unknown>) & {
    url: (path: string, isGuestSpace: boolean) => string;
  };

  // world: 'MAIN' で実行するため、kintoneオブジェクトの準備完了を待つ過度なリトライは不要になる可能性が高い
  // DOMContentLoaded を待つ程度で十分かもしれない
  // const MAX_RETRIES = 10;
  // const RETRY_INTERVAL = 200;
  // let attempts = 0;

  async function getAppInfoFromPage(): Promise<AppInfo | null> {
    if (typeof kintone === "undefined" || !kintone || !kintone.app) {
      console.warn(
        "[Kintone Dev Tools] kintone.app object is not available at this moment.",
      );
      return null;
    }
    const appId = kintone.app.getId();
    if (appId === null || appId === undefined) {
      console.warn("[Kintone Dev Tools] App ID is null or undefined.");
      return null;
    }
    console.log("[Kintone Dev Tools] kintone.app.getId():", appId);

    try {
      const api = (kintone as unknown as { api: KintoneApi }).api;

      // 1. アプリ詳細情報を取得
      const appDetails = (await api(api.url("/k/v1/app.json", true), "GET", {
        id: appId,
      })) as Record<string, unknown>;
      console.log("[Kintone Dev Tools] App Details Response:", appDetails);

      // 2. アプリのフィールド情報を取得 (運用環境)
      let appFields: { [fieldCode: string]: FieldProperty } | undefined;
      try {
        const fieldsResponse = (await api(
          api.url("/k/v1/app/form/fields.json", true),
          "GET",
          { app: appId, lang: "default" }, // lang: default でユーザーの表示言語。live: falseでプレビュー環境。指定なしで運用環境
        )) as { properties?: { [fieldCode: string]: FieldProperty } };
        console.log(
          "[Kintone Dev Tools] App Form Fields Response:",
          fieldsResponse,
        );
        const properties = fieldsResponse.properties;
        if (properties) {
          // SUBTABLE のカラムは properties[テーブルコード].fields にネストされるため、
          // 表示用にフラット化して code → FieldProperty の形に揃える
          const flat: { [fieldCode: string]: FieldProperty } = { ...properties };

          for (const key of Object.keys(properties)) {
            const prop = properties[key] as unknown as Record<string, unknown>;
            if (prop.type !== "SUBTABLE") continue;
            const nested = prop.fields;
            if (!nested || typeof nested !== "object") continue;
            for (const [innerCode, innerProp] of Object.entries(
              nested as Record<string, unknown>,
            )) {
              if (!innerProp || typeof innerProp !== "object") continue;
              // innerProp は FieldProperty 互換の形
              flat[innerCode] = innerProp as unknown as FieldProperty;
            }
          }

          appFields = flat;
        } else {
          appFields = properties;
        }
      } catch (fieldsError) {
        console.error(
          "[Kintone Dev Tools] Failed to get app form fields:",
          fieldsError,
        );
        // フィールド情報取得に失敗しても、他の情報は返す
      }

      // 3. フォームレイアウトを取得して、画面上のフィールド順を組み立てる
      let fieldOrder: string[] | undefined;
      let fieldOrderItems:
        | { code: string; role: "GROUP" | "SUBTABLE" | "FIELD"; parentRole?: "GROUP" | "SUBTABLE" }[]
        | undefined;
      try {
        const layoutResponse = (await api(
          api.url("/k/v1/app/form/layout.json", true),
          "GET",
          { app: appId },
        )) as { layout?: unknown };

        // layout を走査して、code を持つフィールドを順にフラット化（＋種別/親種別）
        const ordered: string[] = [];
        const orderedItems: {
          code: string;
          role: "GROUP" | "SUBTABLE" | "FIELD";
          parentRole?: "GROUP" | "SUBTABLE";
        }[] = [];
        const seen = new Set<string>();

        const push = (
          code: unknown,
          role: "GROUP" | "SUBTABLE" | "FIELD",
          parentRole?: "GROUP" | "SUBTABLE",
        ) => {
          if (typeof code !== "string" || !code) return;
          if (seen.has(code)) return;
          seen.add(code);
          ordered.push(code);
          orderedItems.push({ code, role, parentRole });
        };

        const walkLayout = (
          items: unknown,
          parentRole?: "GROUP" | "SUBTABLE",
        ): void => {
          if (!Array.isArray(items)) return;
          for (const item of items) {
            if (!item || typeof item !== "object") continue;
            const anyItem = item as Record<string, unknown>;
            const type = anyItem.type;

            // ROW: fields配列
            if (type === "ROW" && Array.isArray(anyItem.fields)) {
              for (const f of anyItem.fields) {
                const anyField = f as Record<string, unknown> | null;
                const code = anyField?.code;
                push(code, "FIELD", parentRole);
              }
              continue;
            }

            // GROUP: layout配列
            if (type === "GROUP" && Array.isArray(anyItem.layout)) {
              // グループ自体もフィールドとして存在するので、先に code を入れる
              push(anyItem.code, "GROUP");
              walkLayout(anyItem.layout, "GROUP");
              continue;
            }

            // SUBTABLE: テーブル本体(code) → fields配列（テーブル内フィールド）
            if (type === "SUBTABLE" && Array.isArray(anyItem.fields)) {
              push(anyItem.code, "SUBTABLE", parentRole);
              for (const f of anyItem.fields) {
                const anyField = f as Record<string, unknown> | null;
                const code = anyField?.code;
                push(code, "FIELD", "SUBTABLE");
              }
              continue;
            }
          }
        };

        walkLayout(layoutResponse?.layout);
        fieldOrder = ordered;
        fieldOrderItems = orderedItems;
      } catch (layoutError) {
        console.error(
          "[Kintone Dev Tools] Failed to get app form layout:",
          layoutError,
        );
      }

      return {
        appId: appId.toString(),
        appName:
          typeof appDetails.name === "string" && appDetails.name
            ? appDetails.name
            : "（名称未設定）",
        spaceId:
          appDetails.spaceId != null ? String(appDetails.spaceId) : undefined,
        threadId:
          appDetails.threadId != null ? String(appDetails.threadId) : undefined,
        creatorName: (() => {
          const creator = appDetails.creator as
            | Record<string, unknown>
            | undefined;
          const name = creator?.name;
          return typeof name === "string" && name ? name : "（不明）";
        })(),
        createdAt:
          typeof appDetails.createdAt === "string" && appDetails.createdAt
            ? appDetails.createdAt
            : "（不明）",
        modifierName: (() => {
          const modifier = appDetails.modifier as
            | Record<string, unknown>
            | undefined;
          const name = modifier?.name;
          return typeof name === "string" && name ? name : "（不明）";
        })(),
        modifiedAt:
          typeof appDetails.modifiedAt === "string" && appDetails.modifiedAt
            ? appDetails.modifiedAt
            : "（不明）",
        fields: appFields,
        fieldOrder,
        fieldOrderItems,
      };
    } catch (error) {
      console.error(
        "[Kintone Dev Tools] Failed to get app info via API:",
        error,
      );
      // APIエラーが発生しても、アプリIDだけでも返す
      return { appId: appId.toString(), appName: "（取得失敗）" };
    }
  }

  function showDialogOnPage(info: AppInfo): void {
    console.log("[Kintone Dev Tools] showDialogOnPage called with info:", info);
    const existingDialog = document.getElementById(
      "kintone-dev-tools-app-info-dialog",
    );
    const existingOverlay = document.getElementById(
      "kintone-dev-tools-app-info-overlay",
    );
    if (existingDialog) existingDialog.remove();
    if (existingOverlay) existingOverlay.remove();
    // オーバーレイを作成
    const overlay = document.createElement("div");
    overlay.id = "kintone-dev-tools-app-info-overlay";
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.3); z-index: 2147483646;
    `;

    const dialog = document.createElement("div");
    dialog.id = "kintone-dev-tools-app-info-dialog";
    // eslint-disable-next-line prettier/prettier
    dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 2147483647;
      width: min(980px, 94vw);
      height: min(820px, 88vh);
      overflow: auto;
      color: #333;
      text-align: left;
    `;
    const content = document.createElement("div");
    dialog.appendChild(content);

    function getOrderedItems(): {
      code: string;
      role: "GROUP" | "SUBTABLE" | "FIELD";
      parentRole?: "GROUP" | "SUBTABLE";
    }[] {
      if (info.fieldOrderItems && info.fieldOrderItems.length > 0) {
        return info.fieldOrderItems;
      }
      const orderedCodes =
        info.fieldOrder && info.fieldOrder.length > 0 ? info.fieldOrder : [];
      return orderedCodes.map((code) => ({ code, role: "FIELD" as const }));
    }

    const isDetailed = true;
    let firstRecordMap: { [fieldCode: string]: string } | null | undefined =
      undefined; // undefined: 未取得, null: 取得失敗/なし
    let firstRecordLoading = false;

    dialog.style.position = "fixed";
    // absoluteボタンの基準にするため
    dialog.style.setProperty("position", "fixed");
    dialog.style.setProperty("box-sizing", "border-box");
    dialog.style.setProperty("padding-top", "42px");

    const copyTableButton = document.createElement("button");
    copyTableButton.type = "button";
    copyTableButton.textContent = "表をコピー";
    copyTableButton.style.cssText = `
      position: absolute;
      top: 20px;
      right: 92px;
      padding: 7px 10px;
      background: #9b59b6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;
    dialog.appendChild(copyTableButton);

    const jsonButton = document.createElement("button");
    jsonButton.type = "button";
    jsonButton.textContent = "JSON";
    jsonButton.style.cssText = `
      position: absolute;
      top: 20px;
      right: 12px;
      padding: 7px 10px;
      background: #34495e;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;
    dialog.appendChild(jsonButton);

    const formatDefaultValue = (value: unknown): string => {
      if (value == null) return "—";
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    const formatRecordValue = (value: unknown): string => {
      if (value == null) return "—";
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean")
        return String(value);
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    const fetchFirstRecord = async (): Promise<void> => {
      if (firstRecordLoading) return;
      if (!info.appId) {
        firstRecordMap = null;
        return;
      }
      const appIdNum = Number(info.appId);
      if (!Number.isFinite(appIdNum)) {
        firstRecordMap = null;
        return;
      }

      firstRecordLoading = true;
      render(); // 取得中表示に更新
      try {
        const api = (kintone as unknown as { api: KintoneApi }).api;
        const recordsResponse = (await api(
          api.url("/k/v1/records.json", true),
          "GET",
          { app: appIdNum, query: "limit 1" },
        )) as { records?: unknown[] };
        const first = Array.isArray(recordsResponse.records)
          ? recordsResponse.records[0]
          : undefined;
        if (!first || typeof first !== "object") {
          firstRecordMap = null;
          return;
        }

        const firstObj = first as Record<string, unknown>;
        const recordFields =
          (firstObj.record as Record<string, unknown> | undefined) ?? firstObj;

        const map: { [fieldCode: string]: string } = {};
        const subtableAgg: { [innerCode: string]: string[] } = {};

        for (const [code, raw] of Object.entries(recordFields)) {
          if (!raw || typeof raw !== "object") continue;
          const v = (raw as Record<string, unknown>).value;

          // SUBTABLE の value は配列（行の配列）
          if (Array.isArray(v)) {
            map[code] = `${v.length}行`;

            for (const row of v) {
              if (!row || typeof row !== "object") continue;
              const rowValue = (row as Record<string, unknown>).value;
              if (!rowValue || typeof rowValue !== "object") continue;

              for (const [innerCode, innerRaw] of Object.entries(
                rowValue as Record<string, unknown>,
              )) {
                if (!innerRaw || typeof innerRaw !== "object") continue;
                const innerV = (innerRaw as Record<string, unknown>).value;
                const formatted = formatRecordValue(innerV);
                if (!subtableAgg[innerCode]) subtableAgg[innerCode] = [];
                // 空欄はそのまま空欄でよいが、区切りの都合上は残す
                subtableAgg[innerCode].push(formatted);
              }
            }
            continue;
          }

          map[code] = formatRecordValue(v);
        }

        // SUBTABLE 内の各カラム値を、カラムコードにマッピング（複数行は改行で連結）
        for (const [innerCode, values] of Object.entries(subtableAgg)) {
          // 末尾の空欄だけ大量に続くのを少し抑える（ただし途中の空欄は保持）
          let trimmed = values.slice();
          while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
            trimmed = trimmed.slice(0, -1);
          }
          map[innerCode] = trimmed.join("\n");
        }
        firstRecordMap = map;
      } catch (e) {
        console.error("[Kintone Dev Tools] Failed to fetch first record:", e);
        firstRecordMap = null;
      } finally {
        firstRecordLoading = false;
        render();
      }
    };

    const escapeTsvCell = (value: string): string =>
      value
        .split("\t")
        .join(" ")
        .split("\r\n")
        .join("\n")
        .split("\r")
        .join("\n");

    const toTsv = (rows: string[][]): string =>
      rows.map((r) => r.map(escapeTsvCell).join("\t")).join("\n");

    const showCopyFallback = (text: string) => {
      const existing = dialog.querySelector(
        "#kintone-dev-tools-app-info-copy-fallback",
      );
      if (existing) existing.remove();

      const box = document.createElement("div");
      box.id = "kintone-dev-tools-app-info-copy-fallback";
      box.style.cssText = `
        margin-top: 14px;
        padding: 12px;
        border: 1px solid #e1e1e1;
        border-radius: 8px;
        background: #fafafa;
      `;

      const title = document.createElement("div");
      title.textContent =
        "クリップボードへのコピーに失敗しました。ここから手動でコピーしてください。";
      title.style.cssText = "font-size: 12px; color: #666; margin-bottom: 8px;";
      box.appendChild(title);

      const ta = document.createElement("textarea");
      ta.value = text;
      ta.readOnly = true;
      ta.style.cssText = `
        width: 100%;
        height: 180px;
        box-sizing: border-box;
        font-size: 12px;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
      `;
      box.appendChild(ta);

      const btnRow = document.createElement("div");
      btnRow.style.cssText =
        "display:flex; gap:10px; justify-content:flex-end; margin-top: 8px;";

      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.textContent = "全選択";
      selectBtn.style.cssText =
        "padding: 8px 12px; background:#3498db; color:white; border:none; border-radius: 6px; cursor:pointer; font-size: 12px; font-weight:bold;";
      selectBtn.onclick = () => {
        ta.focus();
        ta.select();
      };
      btnRow.appendChild(selectBtn);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.textContent = "閉じる";
      closeBtn.style.cssText =
        "padding: 8px 12px; background:#ccc; color:#333; border:none; border-radius: 6px; cursor:pointer; font-size: 12px; font-weight:bold;";
      closeBtn.onclick = () => box.remove();
      btnRow.appendChild(closeBtn);

      box.appendChild(btnRow);

      // 表のすぐ下に出したいので content の末尾へ
      content.appendChild(box);

      // ユーザーがすぐコピーできるように選択状態にする
      ta.focus();
      ta.select();
    };

    const showJsonDialog = async (payload: unknown) => {
      const existing = document.getElementById(
        "kintone-dev-tools-app-info-json-dialog",
      );
      const existingOverlay = document.getElementById(
        "kintone-dev-tools-app-info-json-overlay",
      );
      if (existing) existing.remove();
      if (existingOverlay) existingOverlay.remove();

      const overlay = document.createElement("div");
      overlay.id = "kintone-dev-tools-app-info-json-overlay";
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.35); z-index: 2147483648;
      `;

      const box = document.createElement("div");
      box.id = "kintone-dev-tools-app-info-json-dialog";
      box.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 16px; border-radius: 10px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.25);
        z-index: 2147483649;
        width: min(1200px, 92vw);
        height: min(720px, 86vh);
        display: flex; flex-direction: column; gap: 10px;
        color: #333;
      `;

      const header = document.createElement("div");
      header.style.cssText =
        "display:flex; align-items:center; justify-content:space-between; gap:10px;";

      const title = document.createElement("div");
      title.textContent = "取得結果 (JSON)";
      title.style.cssText = "font-weight: bold;";
      header.appendChild(title);

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex; gap:10px;";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "コピー";
      copyBtn.style.cssText =
        "padding: 8px 12px; background:#9b59b6; color:white; border:none; border-radius: 8px; cursor:pointer; font-size: 12px; font-weight:bold;";
      actions.appendChild(copyBtn);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.textContent = "閉じる";
      closeBtn.style.cssText =
        "padding: 8px 12px; background:#ccc; color:#333; border:none; border-radius: 8px; cursor:pointer; font-size: 12px; font-weight:bold;";
      actions.appendChild(closeBtn);

      header.appendChild(actions);
      box.appendChild(header);

      const ta = document.createElement("textarea");
      ta.readOnly = true;
      ta.style.cssText = `
        flex: 1;
        width: 100%;
        resize: none;
        box-sizing: border-box;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        line-height: 1.4;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #fafafa;
      `;
      try {
        ta.value = JSON.stringify(payload, null, 2);
      } catch {
        ta.value = String(payload);
      }
      box.appendChild(ta);

      const cleanup = () => {
        box.remove();
        overlay.remove();
      };
      overlay.onclick = cleanup;
      closeBtn.onclick = cleanup;

      copyBtn.onclick = async () => {
        const ok = await copyTextToClipboard(ta.value);
        if (!ok) {
          // 失敗したらユーザーが手動コピーできるように選択
          ta.focus();
          ta.select();
        }
      };

      document.body.appendChild(overlay);
      document.body.appendChild(box);
    };

    const copyTextToClipboard = async (text: string): Promise<boolean> => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        // fallbackへ
      }
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    };

    const buildTableRows = (): string[][] => {
      const rows: string[][] = [];
      const fields = info.fields;
      if (!fields) return rows;

      const orderedItems = getOrderedItems();
      const orderedCodes = orderedItems.map((i) => i.code);
      const orderedSet = new Set(orderedCodes);
      const allCodes = Object.keys(fields);
      const remainingCodes = allCodes.filter((c) => !orderedSet.has(c));
      remainingCodes.sort((a, b) => {
        const la = fields[a]?.label ?? a;
        const lb = fields[b]?.label ?? b;
        return la.localeCompare(lb, "ja");
      });
      const items = [
        ...orderedItems,
        ...remainingCodes.map((code) => ({ code, role: "FIELD" as const })),
      ];

      rows.push([
        "フィールド名 (ラベル)",
        "フィールドコード",
        "タイプ",
        "先頭レコード値",
        "フィールド名非表示",
        "必須",
        "重複禁止",
        "最大値",
        "最小値",
        "最大文字数",
        "最小文字数",
        "登録時日時を初期値",
        "初期値",
        "計算式（CALC）",
        "桁区切り表示",
        "リンク種類",
        "CALC表示形式",
        "小数点以下桁数",
      ]);

      for (const item of items) {
        const f = fields[item.code];
        if (!f) continue;
        const fieldType = f.type || "(システムフィールド)";
        const frv = firstRecordLoading
          ? "取得中…"
          : firstRecordMap && typeof firstRecordMap === "object"
            ? (firstRecordMap[f.code] ?? "—")
            : firstRecordMap === undefined
              ? "（未取得）"
              : "—";

        const record = f as unknown as Record<string, unknown>;
        const get = (k: string): unknown => record[k];
        const yn = (v: unknown): string =>
          v === true ? "はい" : v === false ? "いいえ" : "—";
        const toStr = (v: unknown): string => {
          if (v == null) return "—";
          if (typeof v === "string") return v;
          if (typeof v === "number" || typeof v === "boolean") return String(v);
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
        };

        const calcExpression =
          fieldType === "CALC" && typeof f.expression === "string"
            ? f.expression
            : "—";
        const noLabel = yn(get("noLabel"));
        const unique = yn(get("unique"));
        const minValue = toStr(get("minValue"));
        const maxValue = toStr(get("maxValue"));
        const minLength = toStr(get("minLength"));
        const maxLength = toStr(get("maxLength"));
        const defaultNowValueRaw =
          get("defaultNowValue") ??
          (typeof get("defaultValue") === "string" &&
          ["NOW", "TODAY", "CURRENT_DATE", "CURRENT_DATETIME"].includes(
            (get("defaultValue") as string).toUpperCase(),
          )
            ? true
            : undefined);
        const defaultNowValue = yn(defaultNowValueRaw);
        const digit = yn(get("digit"));
        const linkType =
          typeof get("protocol") === "string"
            ? (get("protocol") as string)
            : typeof get("linkType") === "string"
              ? (get("linkType") as string)
              : "—";
        const calcFormat =
          fieldType === "CALC"
            ? toStr(get("format") ?? get("displayFormat"))
            : "—";
        const displayScale = toStr(get("displayScale"));
        const required = f.required ? "はい" : "—";
        const def = formatDefaultValue(f.defaultValue);

        rows.push([
          f.label ?? "",
          f.code ?? item.code,
          fieldType,
          frv,
          noLabel,
          required,
          unique,
          maxValue,
          minValue,
          maxLength,
          minLength,
          def,
          defaultNowValue,
          calcExpression,
          digit,
          linkType,
          calcFormat,
          displayScale,
        ]);
      }
      return rows;
    };

    const render = () => {
      dialog.style.width = "min(1400px, 96vw)";

      const metaItems: string[] = [];
      metaItems.push(`
        <div style="display: inline-flex; gap: 6px; align-items: baseline;">
          <span>現在のアプリID:</span>
          <strong>${info.appId}</strong>
        </div>
      `);
      if (info.appName) {
        metaItems.push(`
          <div style="display: inline-flex; gap: 6px; align-items: baseline;">
            <span>アプリ名:</span>
            <strong>${info.appName}</strong>
          </div>
        `);
      }
      if (info.spaceId) {
        metaItems.push(`
          <div style="display: inline-flex; gap: 6px; align-items: baseline;">
            <span>スペースID:</span>
            <strong>${info.spaceId}</strong>
          </div>
        `);
      }
      if (info.threadId) {
        metaItems.push(`
          <div style="display: inline-flex; gap: 6px; align-items: baseline;">
            <span>スレッドID:</span>
            <strong>${info.threadId}</strong>
          </div>
        `);
      }
      if (info.createdAt && info.creatorName) {
        metaItems.push(`
          <div style="display: inline-flex; gap: 6px; align-items: baseline;">
            <span>作成日時:</span>
            <strong>${new Date(info.createdAt).toLocaleString()}</strong>
            <span>(作成者: ${info.creatorName})</span>
          </div>
        `);
      }
      if (info.modifiedAt && info.modifierName) {
        metaItems.push(`
          <div style="display: inline-flex; gap: 6px; align-items: baseline;">
            <span>更新日時:</span>
            <strong>${new Date(info.modifiedAt).toLocaleString()}</strong>
            <span>(更新者: ${info.modifierName})</span>
          </div>
        `);
      }

      let htmlContent = `
        <div style="font-size: 13px; line-height: 1.4; margin-bottom: 6px;">
          <div style="display: grid; grid-template-columns: max-content max-content; column-gap: 16px; row-gap: 4px; align-items: start; justify-content: start;">
            ${metaItems.join("")}
          </div>
        </div>
      `;

      if (info.fields && Object.keys(info.fields).length > 0) {
        htmlContent += `<h3 style="margin-top: 12px; margin-bottom: 0px; font-weight: 800; display: flex; align-items: baseline; justify-content: space-between;">
          <span>フィールド一覧:</span>
          <span style="font-size: 11px; color: #666; font-weight: 400;">※Shift + マウススクロールで横スクロールします</span>
        </h3>`;

        const headerBg = "#1e88e5";
        const headerText = "white";
        const thead = `<tr style="background-color: ${headerBg}; color: ${headerText};">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; position: sticky; left: 0; z-index: 5; background-color: ${headerBg}; color: ${headerText}; box-shadow: 2px 0 0 rgba(0,0,0,0.04);">フィールド名 (ラベル)</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">フィールドコード</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">タイプ</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">先頭レコード値</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">フィールド名非表示</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">必須</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">重複禁止</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">最大値</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">最小値</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">最大文字数</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">最小文字数</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">初期値</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">登録時日時を初期値</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">計算式（CALC）</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">桁区切り表示</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">リンク種類</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">CALC表示形式</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: ${headerBg}; color: ${headerText};">小数点以下桁数</th>
            </tr>`;

        const colgroup = `<colgroup>
              <col style="width: 180px;" />  <!-- label -->
              <col style="width: 200px;" />  <!-- code -->
              <col style="width: 160px;" />  <!-- type -->
              <col style="width: 420px;" />  <!-- first record -->
              <col style="width: 140px;" />  <!-- noLabel -->
              <col style="width: 80px;" />   <!-- required -->
              <col style="width: 120px;" />  <!-- unique -->
              <col style="width: 120px;" />  <!-- maxValue -->
              <col style="width: 120px;" />  <!-- minValue -->
              <col style="width: 140px;" />  <!-- maxLength -->
              <col style="width: 140px;" />  <!-- minLength -->
              <col style="width: 260px;" />  <!-- defaultValue -->
              <col style="width: 170px;" />  <!-- default now -->
              <col style="width: 520px;" />  <!-- calc expr -->
              <col style="width: 140px;" />  <!-- digit -->
              <col style="width: 140px;" />  <!-- link type -->
              <col style="width: 220px;" />  <!-- calc format -->
              <col style="width: 150px;" />  <!-- displayScale -->
            </colgroup>`;

        // 列が多いので横スクロール前提だが、必要以上に広いとスカスカに見えるため控えめに
        const tableMinWidth = 2000;

        const cellPadding = "6px";
        const tableFontSize = "12px";

        htmlContent += `<div style="overflow-x: auto; max-width: 100%; margin-top: 2px; border: 1px solid #eee; border-radius: 6px;">
                          <table style="width: 100%; border-collapse: collapse; table-layout: fixed; min-width: ${tableMinWidth}px; font-size: ${tableFontSize}; line-height: 1.3;">
                            ${colgroup}
                            <thead>${thead}</thead>
                            <tbody>`;

        const renderRow = (
          field: FieldProperty,
          role: "GROUP" | "SUBTABLE" | "FIELD",
          parentRole?: "GROUP" | "SUBTABLE",
        ) => {
          const fieldType = field.type || "(システムフィールド)";

          const isGroupRow = role === "GROUP";
          const isGroupChild = parentRole === "GROUP";
          const isSubtableRow = role === "SUBTABLE";
          const isSubtableChild = parentRole === "SUBTABLE";

          // 色は「濃色(親) / 薄色(子)」で、少し淡めに調整
          const rowBg = isGroupRow
            ? "#e3f0ff" // GROUP行（少しだけ濃く）
            : isGroupChild
              ? "#f7fbff" // 薄い青をさらに薄く
              : isSubtableRow
                ? "#e6f4ea" // SUBTABLE行（薄めの緑）
                : isSubtableChild
                  ? "#f4fbf6" // 薄い緑をさらに薄く
                  : "transparent";
          const rowText = "#333";

          // sticky列も行の背景色に追従させる（透明のときだけ白）
          const stickyBg = rowBg === "transparent" ? "white" : rowBg;
          const stickyText = rowBg === "transparent" ? "#333" : rowText;

          {
            const calcExpression =
              fieldType === "CALC" && typeof field.expression === "string"
                ? field.expression
                : "—";

            const fieldRecord = field as unknown as Record<string, unknown>;
            const get = (key: string): unknown => fieldRecord[key];
            const yn = (v: unknown): string =>
              v === true ? "はい" : v === false ? "いいえ" : "—";
            const toStr = (v: unknown): string => {
              if (v == null) return "—";
              if (typeof v === "string") return v;
              if (typeof v === "number" || typeof v === "boolean")
                return String(v);
              try {
                return JSON.stringify(v);
              } catch {
                return String(v);
              }
            };

            // フィールド名を非表示にするか（noLabel）
            const noLabel = yn(get("noLabel"));

            // 重複を禁止するか（unique）
            const unique = yn(get("unique"));

            // 最小/最大（NUMBER など）
            const minValue = toStr(get("minValue"));
            const maxValue = toStr(get("maxValue"));

            // 最小/最大文字数（SINGLE_LINE_TEXT/MULTI_LINE_TEXT など）
            const minLength = toStr(get("minLength"));
            const maxLength = toStr(get("maxLength"));

            // レコード登録時の日時を初期値にするかどうか
            // 仕様上はフィールド種別ごとに表現が異なるため、よくあるキーを拾う
            const defaultNowValueRaw =
              get("defaultNowValue") ??
              (typeof get("defaultValue") === "string" &&
              ["NOW", "TODAY", "CURRENT_DATE", "CURRENT_DATETIME"].includes(
                (get("defaultValue") as string).toUpperCase(),
              )
                ? true
                : undefined);
            const defaultNowValue = yn(defaultNowValueRaw);

            // 数値の桁区切り（digit）
            const digit = yn(get("digit"));

            // リンクの種類（LINK）
            const linkType =
              typeof get("protocol") === "string"
                ? (get("protocol") as string)
                : typeof get("linkType") === "string"
                  ? (get("linkType") as string)
                  : "—";

            // 計算フィールドの表示形式（CALC）
            const calcFormat =
              fieldType === "CALC"
                ? toStr(get("format") ?? get("displayFormat"))
                : "—";

            // 小数点以下の表示桁数（displayScale）
            const displayScale = toStr(get("displayScale"));

            let firstRecordValue = "—";
            if (firstRecordLoading) {
              firstRecordValue = "取得中…";
            } else if (firstRecordMap && typeof firstRecordMap === "object") {
              firstRecordValue =
                firstRecordMap[field.code] ??
                firstRecordMap[field.label] ??
                "—";
            } else if (firstRecordMap === null) {
              firstRecordValue = "—";
            } else if (firstRecordMap === undefined) {
              firstRecordValue = "（未取得）";
            }

            htmlContent += `<tr style="background: ${rowBg}; color: ${rowText};">
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; white-space: normal; overflow-wrap: anywhere; word-break: break-word; position: sticky; left: 0; z-index: 4; background: ${stickyBg}; color: ${stickyText}; box-shadow: 2px 0 0 rgba(0,0,0,0.04);">${field.label}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; white-space: normal; overflow-wrap: anywhere; word-break: break-word;">${field.code}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; white-space: normal; overflow-wrap: anywhere; word-break: break-word;">${fieldType}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;">${firstRecordValue}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: center; white-space: nowrap;">${noLabel}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: center; white-space: nowrap;">${field.required ? "はい" : "—"}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: center; white-space: nowrap;">${unique}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: right; white-space: nowrap;">${maxValue}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: right; white-space: nowrap;">${minValue}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: right; white-space: nowrap;">${maxLength}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: right; white-space: nowrap;">${minLength}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;">${formatDefaultValue(
                                field.defaultValue,
                              )}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: center; white-space: nowrap;">${defaultNowValue}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;">${calcExpression}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: center; white-space: nowrap;">${digit}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; white-space: normal; overflow-wrap: anywhere; word-break: break-word;">${linkType}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;">${calcFormat}</td>
                              <td style="border: 1px solid #ddd; padding: ${cellPadding}; text-align: right; white-space: nowrap;">${displayScale}</td>
                            </tr>`;
            return;
          }
        };

        const allFieldCodes = Object.keys(info.fields);
        const orderedItems = getOrderedItems();
        const orderedCodes = orderedItems.map((i) => i.code);
        const orderedSet = new Set(orderedCodes);

        for (const item of orderedItems) {
          const field = info.fields[item.code];
          if (field) renderRow(field, item.role, item.parentRole);
        }

        const remainingCodes = allFieldCodes.filter((c) => !orderedSet.has(c));
        remainingCodes.sort((a, b) => {
          const la = info.fields?.[a]?.label ?? a;
          const lb = info.fields?.[b]?.label ?? b;
          return la.localeCompare(lb, "ja");
        });
        for (const code of remainingCodes) {
          const field = info.fields[code];
          if (field) renderRow(field, "FIELD");
        }

        htmlContent += `    </tbody>
                          </table>
                        </div>`;
      } else if (info.fields) {
        htmlContent += `<p>フィールド情報はありません、または取得できませんでした。</p>`;
      }

      content.innerHTML = htmlContent;
    };

    // 初回表示で先頭レコード値を取得（1回だけ）
    if (firstRecordMap === undefined && !firstRecordLoading) {
      void fetchFirstRecord().then(() => {
        render();
      });
    }

    copyTableButton.onclick = async () => {
      // 詳細表示で未取得なら、コピー前に取得を試みる（ただし待たずに現在の状態でもコピー可能）
      if (isDetailed && firstRecordMap === undefined && !firstRecordLoading) {
        void fetchFirstRecord();
      }
      const rows = buildTableRows();
      if (rows.length === 0) {
        alert("コピーできる表データがありません。");
        return;
      }
      const text = toTsv(rows);
      const ok = await copyTextToClipboard(text);
      if (!ok) {
        showCopyFallback(text);
        return;
      }

      // 成功時だけ軽いメッセージ表示（自動で消える）
      const existing = dialog.querySelector(
        '[data-devkinox="copy-toast"]',
      ) as HTMLDivElement | null;
      const toast =
        existing ??
        (() => {
          const el = document.createElement("div");
          el.dataset.devkinox = "copy-toast";
          el.style.cssText = `
            position: absolute;
            top: 18px;
            right: 180px;
            padding: 6px 10px;
            background: rgba(0, 0, 0, 0.72);
            color: white;
            border-radius: 999px;
            font-size: 12px;
            line-height: 1;
            opacity: 0;
            transition: opacity 160ms ease;
            pointer-events: none;
          `;
          dialog.appendChild(el);
          return el;
        })();

      toast.textContent = "コピーしました";
      toast.style.opacity = "1";
      window.setTimeout(() => {
        toast.style.opacity = "0";
      }, 1200);
    };

    jsonButton.onclick = async () => {
      // 詳細表示で未取得なら、JSONに含めるため先頭レコードの取得を試みる（待つ）
      if (isDetailed && firstRecordMap === undefined && !firstRecordLoading) {
        await fetchFirstRecord();
      }
      const payload = {
        app: {
          appId: info.appId,
          appName: info.appName,
          spaceId: info.spaceId,
          threadId: info.threadId,
          creatorName: info.creatorName,
          createdAt: info.createdAt,
          modifierName: info.modifierName,
          modifiedAt: info.modifiedAt,
        },
        fieldOrderItems: getOrderedItems(),
        fields: info.fields ?? null,
        firstRecordValues: firstRecordMap ?? null,
        view: {
          detailed: isDetailed,
        },
      };
      await showJsonDialog(payload);
    };

    render();

    // 区切り線を追加
    const separator = document.createElement("hr");
    separator.style.cssText = `
      margin: 20px 0;
      border: none;
      border-top: 2px solid #e0e0e0;
    `;
    dialog.appendChild(separator);

    // 閉じるボタンをダイアログ内の一番下に表示
    const closeButton = document.createElement("button");
    closeButton.textContent = "閉じる";
    closeButton.style.cssText = `
      display: block;
      margin: 0 auto;
      padding: 12px 24px;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;
    closeButton.onclick = () => {
      dialog.remove();
      overlay.remove();
    };
    dialog.appendChild(closeButton);

    // オーバーレイをクリックしたら閉じる
    overlay.onclick = () => {
      dialog.remove();
      overlay.remove();
    };

    // オーバーレイとダイアログを追加
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    console.log(
      "[Kintone Dev Tools] Dialog appended to body by content script.",
    );
  }

  async function main() {
    console.log(`[Kintone Dev Tools] Running main function in showAppInfo.js`);
    try {
      const appInfo = await getAppInfoFromPage();
      if (appInfo) {
        console.log("[Kintone Dev Tools] Successfully got appInfo:", appInfo);
        showDialogOnPage(appInfo);
      } else {
        // kintoneオブジェクトがまだ準備できていないか、IDが取れなかった場合
        // world: 'MAIN' であれば、通常はDOMContentLoaded後には取得できるはず
        // それでもダメな場合はエラーとして扱う
        console.error(
          "[Kintone Dev Tools] Failed to get app info even in MAIN world.",
        );
        alert(
          "Kintoneアプリ情報を取得できませんでした。ページが正しく読み込まれているか、Kintoneのアプリページであることを確認してください。",
        );
      }
    } catch (error: unknown) {
      console.error(
        "[Kintone Dev Tools] Error in showAppInfo.js (content script) main function:",
        error,
      );
      if (error instanceof Error) {
        alert(`エラーが発生しました: ${error.message}`);
      } else {
        alert(`予期せぬエラーが発生しました: ${String(error)}`);
      }
    }
  }

  // DOMの準備ができてから実行
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    main();
  } else {
    document.addEventListener("DOMContentLoaded", main);
  }
})();
