/**
 * ConfirmDialog — non-dismissible confirmation dialog.
 *
 * CLAUDE.md Rule 10: The ConfirmDialog must not be dismissible by clicking
 * outside or pressing Escape. No onOpenChange handler. The only way to close
 * it is via the Cancel or Confirm button.
 *
 * CLAUDE.md Rule 20: Destructive variant uses variant="destructive" for
 * confirm button and variant="ghost" for cancel.
 */
'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  title: string
  description?: string
  children?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'default' | 'destructive'
  isLoading?: boolean
}

/**
 * Non-dismissible confirm dialog.
 * No onOpenChange → clicking outside and pressing Escape do nothing.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  isLoading = false,
}: Props) {
  const confirmClass =
    variant === 'destructive'
      ? 'bg-negative text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-negative/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed'
      : 'bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    // CLAUDE.md Rule 10: No onOpenChange — non-dismissible
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        // Prevent closing on Escape key
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Prevent closing on clicking outside
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {children && <div className="py-2">{children}</div>}

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2">
          {/* Cancel: ghost, left-aligned — CLAUDE.md Rule 20 */}
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          {/* Confirm: primary or destructive, right-aligned — CLAUDE.md Rule 20 */}
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={confirmClass}
          >
            {isLoading ? 'Processing…' : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
