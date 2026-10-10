import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface DialogProps {
  open: boolean
  /** Called when the dialog closes itself, as when the player presses Escape. */
  onClose: () => void
  labelledBy: string
  className?: string
  children: ReactNode
}

/**
 * A modal dialog on the native element, which keeps focus inside and closes
 * on Escape. An element inside marked data-autofocus takes the focus.
 */
export function Dialog({ open, onClose, labelledBy, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Start at the top, on the element marked to take focus, rather than the first control.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
      dialog.scrollTop = 0
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className={className} aria-labelledby={labelledBy} onClose={onClose}>
      {open && children}
    </dialog>
  )
}
