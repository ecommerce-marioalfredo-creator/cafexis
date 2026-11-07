import { useRef, useState } from 'react'
import { useColorTheme } from '@/hooks/useColorTheme'
import { useDismiss } from '@/hooks/useDismiss'
import type { ThemePreference } from '@/styles/colorTheme'
import './ThemeMenu.css'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Claro', Icon: SunIcon },
  { value: 'dark', label: 'Oscuro', Icon: MoonIcon },
  { value: 'system', label: 'Sistema', Icon: SystemIcon },
]

/** Selector de tema del encabezado, en el panel y en el catálogo del cliente. */
export function ThemeMenu() {
  const { preference, resolved, setPreference } = useColorTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useDismiss(rootRef, open, setOpen)

  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2]

  return (
    <div className="theme-menu" ref={rootRef}>
      <button
        type="button"
        className="theme-menu__button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Tema: ${current.label}`}
        title="Tema"
      >
        <current.Icon />
      </button>

      {open && (
        <div className="theme-menu__panel" role="group" aria-label="Tema">
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              className="theme-menu__option"
              aria-pressed={preference === value}
              onClick={() => {
                setPreference(value)
                setOpen(false)
              }}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
          {preference === 'system' && (
            <p className="theme-menu__hint">Igual que tu dispositivo: ahora {resolved === 'dark' ? 'oscuro' : 'claro'}.</p>
          )}
        </div>
      )}
    </div>
  )
}
