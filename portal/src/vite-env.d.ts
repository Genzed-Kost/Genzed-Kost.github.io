/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Dimuat lewat <script> tag di index.html (CDN), bukan npm package.
declare const QRCode: new (
  element: HTMLElement,
  options: { text: string; width: number; height: number; colorDark: string; colorLight: string; correctLevel: number }
) => unknown;
declare namespace QRCode {
  const CorrectLevel: { H: number };
}
