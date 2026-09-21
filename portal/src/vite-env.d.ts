/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Dimuat lewat <script> tag di index.html (CDN), bukan npm package.
interface QRCodeStatic {
  new (
    element: HTMLElement,
    options: { text: string; width: number; height: number; colorDark: string; colorLight: string; correctLevel: number }
  ): unknown;
  CorrectLevel: { L: number; M: number; Q: number; H: number };
}
declare const QRCode: QRCodeStatic;
