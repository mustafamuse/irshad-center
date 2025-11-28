/**
 * CheckoutForm Component Tests
 *
 * Tests for the Mahad checkout form including:
 * - Rendering of graduation status and payment frequency options
 * - Price calculation based on selections
 * - Checkout flow and API interactions
 * - Error handling
 *
 * Note: Billing type (FULL_TIME, SCHOLARSHIP, PART_TIME, EXEMPT) is admin-controlled.
 * All students default to FULL_TIME at checkout - admin adjusts afterward if needed.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { CheckoutForm } from '../checkout-form'

// ============================================================================
// Mocks
// ============================================================================

const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock window.location
const mockLocationHref = vi.fn()
Object.defineProperty(window, 'location', {
  value: {
    href: '',
  },
  writable: true,
})
Object.defineProperty(window.location, 'href', {
  set: mockLocationHref,
})

// ============================================================================
// Tests
// ============================================================================

describe('CheckoutForm', () => {
  const defaultProps = {
    profileId: 'test-profile-123',
    studentName: 'John Doe',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('Rendering', () => {
    it('renders student name', () => {
      render(<CheckoutForm {...defaultProps} />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Setting up payment for')).toBeInTheDocument()
    })

    it('renders education status options', () => {
      render(<CheckoutForm {...defaultProps} />)

      expect(screen.getByText('Education Status')).toBeInTheDocument()
      // Text appears in both options and summary
      expect(screen.getAllByText('Still in School').length).toBeGreaterThan(0)
      expect(screen.getByText('$120/month base')).toBeInTheDocument()
      expect(screen.getByText('$95/month base')).toBeInTheDocument()
    })

    it('renders payment schedule options', () => {
      render(<CheckoutForm {...defaultProps} />)

      expect(screen.getByText('Payment Schedule')).toBeInTheDocument()
      // Text appears in both options and summary
      expect(screen.getAllByText('Monthly').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Bi-Monthly').length).toBeGreaterThan(0)
      expect(screen.getByText('Charged every month')).toBeInTheDocument()
      expect(screen.getByText('Save $10-$20/month')).toBeInTheDocument()
    })

    it('renders default price of $120/month', () => {
      render(<CheckoutForm {...defaultProps} />)

      expect(screen.getByText('$120.00')).toBeInTheDocument()
      expect(screen.getByText('/month')).toBeInTheDocument()
    })

    it('renders checkout button', () => {
      render(<CheckoutForm {...defaultProps} />)

      expect(
        screen.getByRole('button', { name: /Continue to Payment/i })
      ).toBeInTheDocument()
    })
  })

  describe('Price Calculations', () => {
    it('updates price when graduation status changes to GRADUATE', async () => {
      const user = userEvent.setup()
      render(<CheckoutForm {...defaultProps} />)

      // Click "Graduated" radio option
      const graduateLabel = screen.getByText('Graduated')
      await user.click(graduateLabel)

      expect(screen.getByText('$95.00')).toBeInTheDocument()
    })

    it('updates price for bi-monthly payment', async () => {
      const user = userEvent.setup()
      render(<CheckoutForm {...defaultProps} />)

      // Click "Bi-Monthly" option
      const biMonthlyLabel = screen.getByText('Bi-Monthly')
      await user.click(biMonthlyLabel)

      // $110 * 2 = $220 for bi-monthly (NON_GRADUATE default)
      expect(screen.getByText('$220.00')).toBeInTheDocument()
      expect(screen.getByText('/2 months')).toBeInTheDocument()
    })

    it('calculates graduate + bi-monthly correctly', async () => {
      const user = userEvent.setup()
      render(<CheckoutForm {...defaultProps} />)

      // Select Graduate
      await user.click(screen.getByText('Graduated'))

      // Select Bi-Monthly
      await user.click(screen.getByText('Bi-Monthly'))

      // Graduate base: $90/month * 2 = $180 for bi-monthly
      expect(screen.getByText('$180.00')).toBeInTheDocument()
      expect(screen.getByText('/2 months')).toBeInTheDocument()
    })

    it('shows equivalent monthly rate for bi-monthly payments', async () => {
      const user = userEvent.setup()
      render(<CheckoutForm {...defaultProps} />)

      // Select Bi-Monthly
      await user.click(screen.getByText('Bi-Monthly'))

      // Should show equivalent monthly rate
      expect(
        screen.getByText('Equivalent to $110.00/month')
      ).toBeInTheDocument()
    })
  })

  describe('Checkout Flow', () => {
    it('calls API with correct parameters on checkout', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://checkout.stripe.com/pay/test' }),
      })

      render(<CheckoutForm {...defaultProps} />)

      // Click checkout button (default selections)
      const checkoutButton = screen.getByRole('button', {
        name: /Continue to Payment/i,
      })
      await user.click(checkoutButton)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/mahad/create-checkout-session',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: 'test-profile-123',
            graduationStatus: 'NON_GRADUATE',
            paymentFrequency: 'MONTHLY',
            // billingType is always FULL_TIME - admin adjusts afterward
          }),
        }
      )
    })

    it('redirects to Stripe checkout URL on success', async () => {
      const user = userEvent.setup()
      const stripeUrl = 'https://checkout.stripe.com/pay/cs_test_123'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: stripeUrl }),
      })

      render(<CheckoutForm {...defaultProps} />)

      const checkoutButton = screen.getByRole('button', {
        name: /Continue to Payment/i,
      })
      await user.click(checkoutButton)

      await waitFor(() => {
        expect(mockLocationHref).toHaveBeenCalledWith(stripeUrl)
      })
    })

    it('shows loading state during checkout', async () => {
      const user = userEvent.setup()
      // Use a never-resolving promise to keep loading state
      mockFetch.mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      )

      render(<CheckoutForm {...defaultProps} />)

      const checkoutButton = screen.getByRole('button', {
        name: /Continue to Payment/i,
      })
      await user.click(checkoutButton)

      // Button should show "Setting up payment..."
      expect(screen.getByText('Setting up payment...')).toBeInTheDocument()
    })

    it('sends correct parameters for graduate + bi-monthly', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://checkout.stripe.com/pay/test' }),
      })

      render(<CheckoutForm {...defaultProps} />)

      // Make selections
      await user.click(screen.getByText('Graduated'))
      await user.click(screen.getByText('Bi-Monthly'))

      // Click checkout
      const checkoutButton = screen.getByRole('button', {
        name: /Continue to Payment/i,
      })
      await user.click(checkoutButton)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/mahad/create-checkout-session',
        expect.objectContaining({
          body: JSON.stringify({
            profileId: 'test-profile-123',
            graduationStatus: 'GRADUATE',
            paymentFrequency: 'BI_MONTHLY',
            // billingType is always FULL_TIME - admin adjusts afterward
          }),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('displays error message on API failure', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Something went wrong' }),
      })

      render(<CheckoutForm {...defaultProps} />)

      const checkoutButton = screen.getByRole('button', {
        name: /Continue to Payment/i,
      })
      await user.click(checkoutButton)

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })
    })

    it('displays generic error on network failure', async () => {
      const user = userEvent.setup()
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<CheckoutForm {...defaultProps} />)

      const checkoutButton = screen.getByRole('button', {
        name: /Continue to Payment/i,
      })
      await user.click(checkoutButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('re-enables button after error', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'API Error' }),
      })

      render(<CheckoutForm {...defaultProps} />)

      const checkoutButton = screen.getByRole('button', {
        name: /Continue to Payment/i,
      })
      await user.click(checkoutButton)

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument()
      })

      // Button should be enabled again
      expect(
        screen.getByRole('button', { name: /Continue to Payment/i })
      ).not.toBeDisabled()
    })
  })

  describe('Button Text', () => {
    it('shows correct button text with price', () => {
      render(<CheckoutForm {...defaultProps} />)

      expect(
        screen.getByRole('button', {
          name: /Continue to Payment - \$120\.00\/month/i,
        })
      ).toBeInTheDocument()
    })

    it('updates button text when price changes', async () => {
      const user = userEvent.setup()
      render(<CheckoutForm {...defaultProps} />)

      await user.click(screen.getByText('Graduated'))

      expect(
        screen.getByRole('button', {
          name: /Continue to Payment - \$95\.00\/month/i,
        })
      ).toBeInTheDocument()
    })
  })
})
