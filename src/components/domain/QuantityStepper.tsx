import './QuantityStepper.css'

interface QuantityStepperProps {
  /** Nombre del producto, para las etiquetas de los lectores de pantalla. */
  name: string
  quantity: number
  onChange: (delta: number) => void
  className?: string
}

/**
 * Selector de cantidad del carrito del cliente, con botones del tamaño del
 * dedo (como en los kioscos de autoservicio). Con una sola unidad, el "−" se
 * vuelve una caneca: bajar de ahí quita el producto del pedido.
 */
export function QuantityStepper({ name, quantity, onChange, className }: QuantityStepperProps) {
  const removes = quantity === 1
  return (
    <div className={['qty-stepper', className].filter(Boolean).join(' ')} role="group" aria-label={`Cantidad de ${name}`}>
      <button
        type="button"
        className="qty-stepper__button"
        onClick={() => onChange(-1)}
        aria-label={removes ? `Quitar ${name} del pedido` : `Quitar una unidad de ${name}`}
      >
        {removes ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        )}
      </button>
      <span className="qty-stepper__value">{quantity}</span>
      <button
        type="button"
        className="qty-stepper__button qty-stepper__button--add"
        onClick={() => onChange(1)}
        aria-label={`Agregar una unidad de ${name}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  )
}
