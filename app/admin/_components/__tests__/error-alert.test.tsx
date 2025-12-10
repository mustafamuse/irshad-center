import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { ErrorAlert } from '../error-alert'

describe('ErrorAlert', () => {
  it('should render error message', () => {
    render(<ErrorAlert message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should have correct styling classes', () => {
    render(<ErrorAlert message="Error" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('border-red-200', 'bg-red-50')
  })

  it('should not render when message is empty', () => {
    const { container } = render(<ErrorAlert message="" />)
    expect(container.firstChild).toBeNull()
  })

  it('should not render when message is undefined', () => {
    const { container } = render(
      <ErrorAlert message={undefined as unknown as string} />
    )
    expect(container.firstChild).toBeNull()
  })
})
