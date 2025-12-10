/// <reference types="vite/client" />

export interface AddonDefinition {
  id: string;
  label: string;
  contentScriptFile: string;
  iconClass: string;
}

export async function loadAddons(): Promise<AddonDefinition[]> {
  console.log("[kintone Dev Tools] Starting to load addons...");
  const addonModules = import.meta.glob<{
    id: string;
    label: string;
    iconClass: string;
  }>("../addons/*/feature.ts");
  console.log("[kintone Dev Tools] Found addon modules:", addonModules);
  const addons: AddonDefinition[] = [];

  for (const path in addonModules) {
    console.log(
      `[kintone Dev Tools] Processing addon module from path: ${path}`,
    );
    try {
      const module = await addonModules[path]();
      console.log("[kintone Dev Tools] Loaded module content:", module);
      if (module?.id && module?.label && module?.iconClass) {
        addons.push({
          id: module.id,
          label: module.label,
          contentScriptFile: `addons/${module.id}.js`,
          iconClass: module.iconClass,
        });
      } else {
        console.warn(
          `[kintone Dev Tools] Invalid addon definition in ${path}. Required properties: id, label, iconClass. Module:`,
          module,
        );
      }
    } catch (error) {
      console.error(
        `[kintone Dev Tools] Error loading addon from ${path}:`,
        error,
      );
    }
  }
  console.log("[kintone Dev Tools] Loaded addons:", addons);
  return addons;
}

export async function executeScriptByFile(
  tabId: number,
  filePath: string,
): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [filePath],
      world: "MAIN",
    });
    console.log(
      `[kintone Dev Tools] Executed script file: ${filePath} in MAIN world`,
    );
  } catch (error) {
    console.error(
      `[kintone Dev Tools] Error executing script file ${filePath} in MAIN world:`,
      error,
    );
    alert(
      `スクリプトファイル (${filePath}) の実行に失敗しました。コンソールを確認してください。`,
    );
    throw error;
  }
}

export async function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
