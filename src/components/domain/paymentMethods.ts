import type { PaymentMethod } from '@/types/domain'

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  nequi: 'Nequi',
  billetera_digital: 'Billetera digital',
  cripto: 'Cripto',
}

/** Métodos que ofrece el punto de venta (sin cobro en línea: solo se registra cómo pagó el cliente). */
export const SALE_PAYMENT_METHODS: PaymentMethod[] = ['efectivo', 'tarjeta', 'transferencia', 'nequi']

export const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
