#!/usr/bin/env node
/**
 * Compila y sincroniza las apps móviles (Fase 7).
 *
 *   npm run mobile:clientes            compila la web en modo "clientes" y la copia a Android/iOS
 *   npm run mobile:equipo              igual, para "Cafexis Equipo"
 *   npm run mobile:clientes -- open android   abre el proyecto en Android Studio
 *   npm run mobile:equipo -- open ios         abre el proyecto en Xcode (solo macOS)
 *   npm run mobile:clientes -- add android    crea el proyecto nativo (ya están creados en mobile/)
 *
 * Cada app usa su propio modo de Vite (src/platform/appTarget.ts) y su
 * propio proyecto nativo en mobile/<app>/ (capacitor.config.ts).
 */
import { spawnSync } from 'node:child_process'

const [target, command = 'sync', ...rest] = process.argv.slice(2)
if (target !== 'clientes' && target !== 'equipo') {
  console.error('Uso: node scripts/mobile.mjs <clientes|equipo> [sync|add|open|run] [android|ios]')
  process.exit(1)
}

const env = { ...process.env, CAFEXIS_APP: target }
const run = (cmd, args) => {
  console.log(`\n> ${cmd} ${args.join(' ')}`)
  const result = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// open/run usan lo ya sincronizado; sync y add necesitan la web compilada.
if (command === 'sync' || command === 'add') {
  run('npx', ['tsc', '-b'])
  run('npx', ['vite', 'build', '--mode', target, '--outDir', `dist-${target}`, '--emptyOutDir'])
}
run('npx', ['cap', command, ...rest])
