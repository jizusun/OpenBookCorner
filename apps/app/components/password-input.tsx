import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  ref?: React.Ref<HTMLInputElement>
}

/**
 * Password input with a show/hide toggle.
 *
 * Uses `inputMode="text"` + CSS `-webkit-text-security` / `font-family` trick
 * instead of toggling `type="password" ↔ "text"`. Switching the `type`
 * attribute causes iOS Safari and some Android browsers to dismiss the soft
 * keyboard mid-input; keeping the DOM node stable avoids this entirely.
 *
 * When hidden: the input renders with `data-mask="true"` and the stylesheet in
 * __root.tsx applies `-webkit-text-security:disc` (Chrome/Safari) + a disc
 * Unicode font-family fallback for Firefox.
 */
export function PasswordInput({ className, disabled, ref, style, ...props }: PasswordInputProps) {
  const [show, setShow] = React.useState(false)
  return (
    <div className={cn('relative rounded-md', className)}>
      <input
        // Keep type="text" at all times — never toggle to "password".
        // Switching type causes mobile browsers to dismiss the soft keyboard.
        type="text"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        data-mask={!show ? 'true' : undefined}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
        ref={ref}
        disabled={disabled}
        style={style}
        {...props}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled}
        className="absolute inset-e-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md text-muted-foreground"
        onClick={() => setShow((p) => !p)}
        // Prevent the button click from blurring the input on iOS
        onMouseDown={(e) => e.preventDefault()}
      >
        {show ? <Eye size={18} /> : <EyeOff size={18} />}
        <span className="sr-only">{show ? 'Hide password' : 'Show password'}</span>
      </Button>
    </div>
  )
}
