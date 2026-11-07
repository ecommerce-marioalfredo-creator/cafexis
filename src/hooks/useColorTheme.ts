import { useSyncExternalStore } from 'react'
import { getColorTheme, setThemePreference, subscribeColorTheme } from '@/styles/colorTheme'

/** Tema actual (lo elegido y lo que se ve) y cómo cambiarlo. Ver styles/colorTheme.ts. */
export function useColorTheme() {
  const theme = useSyncExternalStore(subscribeColorTheme, getColorTheme)
  return { ...theme, setPreference: setThemePreference }
}
