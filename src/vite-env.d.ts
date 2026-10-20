/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 'true' para mostrar la cuenta demo en /ingreso fuera de desarrollo (ver .env.example). */
  readonly VITE_SHOW_DEMO_ACCOUNT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
