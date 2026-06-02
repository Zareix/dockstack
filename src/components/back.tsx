import { Button } from '#/components/ui/button'
import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'

export const BackButton = () => {
  return (
    <Link to="/">
      <Button variant="link" size="xs" className="-ml-3">
        <ChevronLeftIcon />
        Back
      </Button>
    </Link>
  )
}
