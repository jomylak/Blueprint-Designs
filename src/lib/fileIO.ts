// Bridges file save/open between the Electron desktop app (native OS dialogs, real files)
// and the plain browser dev server (Blob download / <input type="file">). Every place in the
// app that saves or opens a file should go through here so both environments stay in sync.

export interface ElectronFileFilter {
  name: string;
  extensions: string[];
}

declare global {
  interface Window {
    electronAPI?: {
      saveFile: (
        defaultName: string,
        base64Data: string,
        filters?: ElectronFileFilter[]
      ) => Promise<{ canceled: boolean; filePath?: string }>;
      openFile: (
        filters?: ElectronFileFilter[]
      ) => Promise<{ canceled: boolean; filePath?: string; base64Data?: string }>;
    };
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
}

export function uint8ToBase64(uint8: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize) as any);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const uint8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) uint8[i] = binary.charCodeAt(i);
  return uint8;
}

// Saves bytes to disk: a native "Save As" dialog in Electron (user picks/creates the folder),
// a browser download otherwise. Returns false if the user canceled the native dialog.
export async function saveBytesToFile(
  bytes: Uint8Array,
  defaultName: string,
  mimeType: string,
  extensions: string[]
): Promise<boolean> {
  if (window.electronAPI) {
    const result = await window.electronAPI.saveFile(defaultName, uint8ToBase64(bytes), [
      { name: extensions.join("/").toUpperCase(), extensions },
    ]);
    return !result.canceled;
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export async function saveTextToFile(
  text: string,
  defaultName: string,
  mimeType: string,
  extensions: string[]
): Promise<boolean> {
  return saveBytesToFile(new TextEncoder().encode(text), defaultName, mimeType, extensions);
}

// Opens a file via the native Electron dialog and returns its raw bytes, or null if canceled.
// Only call this when isElectron() is true - in the browser, use an <input type="file"> instead.
export async function openBytesFromFile(extensions: string[]): Promise<Uint8Array | null> {
  if (!window.electronAPI) return null;
  const result = await window.electronAPI.openFile([{ name: extensions.join("/").toUpperCase(), extensions }]);
  if (result.canceled || !result.base64Data) return null;
  return base64ToUint8(result.base64Data);
}
