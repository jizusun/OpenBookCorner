import { useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface SearchBarProps {
  /** Current committed query (from the route search param). */
  initial?: string
  placeholder: string
  ariaLabel: string
  /** Called on submit with the trimmed term (empty string = cleared). */
  onSearch: (term: string) => void
  'data-testid'?: string
}

/**
 * Reusable search bar: a controlled input + submit button. Used by the admin
 * list pages (Users, Books, Readers) so the markup/behaviour is identical.
 */
export function SearchBar({ initial = '', placeholder, ariaLabel, onSearch, ...rest }: SearchBarProps) {
  const [term, setTerm] = useState(initial)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(term.trim())
      }}
      className="flex gap-2"
      data-testid={rest['data-testid']}
    >
      <Input
        placeholder={placeholder}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-label={ariaLabel}
      />
      <Button type="submit" variant="outline">
        <Trans>Search</Trans>
      </Button>
    </form>
  )
}
