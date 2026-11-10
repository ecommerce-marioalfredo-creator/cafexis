import { useCallback, useEffect, useState } from 'react'
import type { PublicProduct } from '@/types/domain'

export interface CartLine {
  product: PublicProduct
  quantity: number
}

interface StoredLine {
  productId: string
  quantity: number
}

const storageKey = (slug: string) => `cafexis:carrito:${slug}`

/** "1 producto", "3 productos": cuenta unidades, no líneas. */
export function itemCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'producto' : 'productos'}`
}

/**
 * Lee el carrito guardado y lo cruza con el catálogo vigente: descarta los
 * productos que ya no se venden y toma el precio actual, no el guardado.
 */
function readStoredCart(slug: string, catalog: PublicProduct[]): CartLine[] {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey(slug)) ?? '[]')
    if (!Array.isArray(stored)) return []
    return (stored as StoredLine[]).flatMap(({ productId, quantity }) => {
      const product = catalog.find((p) => p.id === productId)
      return product && Number.isInteger(quantity) && quantity > 0 ? [{ product, quantity }] : []
    })
  } catch {
    return []
  }
}

function writeStoredCart(slug: string, lines: CartLine[]) {
  try {
    if (lines.length === 0) {
      sessionStorage.removeItem(storageKey(slug))
      return
    }
    const stored: StoredLine[] = lines.map((l) => ({ productId: l.product.id, quantity: l.quantity }))
    sessionStorage.setItem(storageKey(slug), JSON.stringify(stored))
  } catch {
    /* Almacenamiento bloqueado (ej. modo privado): el carrito funciona igual, solo no sobrevive a recargar. */
  }
}

/**
 * Carrito del cliente en el catálogo público (/c/:slug).
 *
 * Se guarda en sessionStorage por negocio: entrar con Google sale de la página
 * y vuelve a ella, y sin esto el cliente perdería el pedido que estaba
 * revisando. Es de la pestaña, no del dispositivo: un pedido a medias no debe
 * aparecer días después.
 *
 * `restore` se llama cuando el catálogo del negocio termina de cargar; hasta
 * entonces el carrito está vacío y no se escribe nada (así no se borra el
 * guardado antes de leerlo).
 */
export function useCustomerCart(slug: string | undefined) {
  // El slug viaja con las líneas: al pasar de un negocio a otro no se mezclan sus carritos.
  const [cart, setCart] = useState<{ slug?: string; lines: CartLine[] }>({ lines: [] })

  useEffect(() => {
    if (cart.slug) writeStoredCart(cart.slug, cart.lines)
  }, [cart])

  const restore = useCallback(
    (catalog: PublicProduct[]) => {
      if (slug) setCart({ slug, lines: readStoredCart(slug, catalog) })
    },
    [slug],
  )

  const add = useCallback((product: PublicProduct) => {
    setCart((prev) => {
      const existing = prev.lines.find((l) => l.product.id === product.id)
      const lines = existing
        ? prev.lines.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
        : [...prev.lines, { product, quantity: 1 }]
      return { ...prev, lines }
    })
  }, [])

  const changeQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) => ({
      ...prev,
      lines: prev.lines
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    }))
  }, [])

  const clear = useCallback(() => setCart((prev) => ({ ...prev, lines: [] })), [])

  const lines = cart.slug === slug ? cart.lines : []
  const total = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0)
  const count = lines.reduce((sum, l) => sum + l.quantity, 0)
  const quantityOf = (productId: string) => lines.find((l) => l.product.id === productId)?.quantity ?? 0

  return { lines, total, count, quantityOf, add, changeQuantity, clear, restore }
}
