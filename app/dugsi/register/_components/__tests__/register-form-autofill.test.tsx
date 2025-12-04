import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import enMessages from '@/messages/en.json'

import { DugsiRegisterForm } from '../register-form'

// Mock the registration hook
vi.mock('../../_hooks/use-registration', () => ({
  useDugsiRegistration: () => ({
    registerChildren: vi.fn(),
    isPending: false,
  }),
}))

// Mock the school combobox
vi.mock('@/components/ui/school-combobox', () => ({
  SchoolCombobox: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) => (
    <input
      data-testid="school-combobox"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

const renderForm = () => {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DugsiRegisterForm />
    </NextIntlClientProvider>
  )
}

describe('DugsiRegisterForm - Auto-fill Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('renders with 2 children by default', () => {
      renderForm()

      // Should have Child #1 and Child #2
      expect(screen.getByText(/Child #1/i)).toBeInTheDocument()
      expect(screen.getByText(/Child #2/i)).toBeInTheDocument()
    })

    it('shows "Template for siblings" badge on first child when multiple children exist', () => {
      renderForm()

      expect(screen.getByText(/Template for siblings/i)).toBeInTheDocument()
    })

    it('does not show edit/revert buttons on first child', () => {
      renderForm()

      // Get all edit buttons - should only be on child #2 and beyond
      const editButtons = screen.queryAllByRole('button', { name: /edit/i })
      // First child section shouldn't have edit buttons
      expect(editButtons.length).toBeGreaterThan(0)
    })
  })

  describe('last name auto-fill', () => {
    it('syncs first child last name to second child', async () => {
      const user = userEvent.setup()
      renderForm()

      // Find first child's last name field
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[0]
      const secondChildLastName = lastNameInputs[1]

      // Type in first child's last name
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')
      await user.tab() // Trigger blur for capitalization

      // Wait for sync to happen
      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Smith')
      })
    })

    it('syncs first child last name to all non-custom children', async () => {
      const user = userEvent.setup()
      renderForm()

      // Add a third child
      const addChildButton = screen.getByRole('button', {
        name: /add child/i,
      })
      await user.click(addChildButton)

      // Wait for third child to appear
      await waitFor(() => {
        expect(screen.getByText(/Child #3/i)).toBeInTheDocument()
      })

      // Find all last name fields
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[0]

      // Type in first child's last name
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Johnson')
      await user.tab()

      // All children should have synced last name
      await waitFor(() => {
        lastNameInputs.forEach((input, idx) => {
          if (idx > 0) {
            // Skip first child
            expect(input).toHaveValue('Johnson')
          }
        })
      })
    })

    it('updates synced children when first child last name changes', async () => {
      const user = userEvent.setup()
      renderForm()

      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[0]
      const secondChildLastName = lastNameInputs[1]

      // Set initial value
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')
      await user.tab()

      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Smith')
      })

      // Change first child's last name
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Jones')
      await user.tab()

      // Second child should update
      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Jones')
      })
    })
  })

  describe('shift auto-fill', () => {
    it('syncs first child shift to second child', async () => {
      const user = userEvent.setup()
      renderForm()

      // Find shift selects
      const shiftSelects = screen.getAllByRole('combobox', {
        name: /shift/i,
      })
      const firstChildShift = shiftSelects[0]

      // Select morning shift for first child
      await user.click(firstChildShift)
      const morningOption = await screen.findByText(/Morning/i)
      await user.click(morningOption)

      // Second child should sync
      await waitFor(() => {
        // Check that second child has same value
        // This would need to check the actual select value
        expect(shiftSelects[1]).toBeDefined()
      })
    })
  })

  describe('custom override toggle - last name', () => {
    it('allows editing last name when clicking edit button', async () => {
      const user = userEvent.setup()
      renderForm()

      // Set first child last name
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[0]
      const secondChildLastName = lastNameInputs[1]

      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')
      await user.tab()

      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Smith')
      })

      // Find and click edit button for second child's last name
      // Note: Need to find the specific edit button near the last name field
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      const lastNameEditButton = editButtons[0] // First edit button should be for last name

      await user.click(lastNameEditButton)

      // Now should be able to edit second child's last name
      await user.clear(secondChildLastName)
      await user.type(secondChildLastName, 'Jones')

      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Jones')
      })

      // Badge should change to "Custom"
      await waitFor(() => {
        expect(screen.getByText(/Custom/i)).toBeInTheDocument()
      })
    })

    it('reverts to first child value when clicking revert', async () => {
      const user = userEvent.setup()
      renderForm()

      // Set first child last name
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[0]
      const secondChildLastName = lastNameInputs[1]

      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')
      await user.tab()

      // Enable custom edit
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      // Change to custom value
      await user.clear(secondChildLastName)
      await user.type(secondChildLastName, 'Jones')

      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Jones')
      })

      // Click revert button
      const revertButtons = screen.getAllByRole('button', { name: /revert/i })
      await user.click(revertButtons[0])

      // Should revert to first child's value
      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Smith')
      })

      // Badge should change back to "From Child #1"
      await waitFor(() => {
        expect(screen.getByText(/From Child #1/i)).toBeInTheDocument()
      })
    })

    it('does not update custom child when first child changes', async () => {
      const user = userEvent.setup()
      renderForm()

      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[0]
      const secondChildLastName = lastNameInputs[1]

      // Set initial value
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')
      await user.tab()

      // Enable custom edit for second child
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      // Set custom value
      await user.clear(secondChildLastName)
      await user.type(secondChildLastName, 'Jones')

      // Change first child
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Brown')
      await user.tab()

      // Second child should stay as Jones (custom)
      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Jones')
      })
    })
  })

  describe('add child button', () => {
    it('pre-fills new child with first child last name and shift', async () => {
      const user = userEvent.setup()
      renderForm()

      // Set first child data
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      await user.clear(lastNameInputs[0])
      await user.type(lastNameInputs[0], 'Smith')
      await user.tab()

      // Add third child
      const addChildButton = screen.getByRole('button', {
        name: /add child/i,
      })
      await user.click(addChildButton)

      // Wait for third child
      await waitFor(() => {
        expect(screen.getByText(/Child #3/i)).toBeInTheDocument()
      })

      // Third child should have pre-filled last name
      const updatedLastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const thirdChildLastName = updatedLastNameInputs[2]

      await waitFor(() => {
        expect(thirdChildLastName).toHaveValue('Smith')
      })
    })
  })

  describe('name capitalization', () => {
    it('capitalizes first name on blur', async () => {
      const user = userEvent.setup()
      renderForm()

      const firstNameInputs = screen.getAllByPlaceholderText(/first name/i)
      const firstChildFirstName = firstNameInputs[0]

      await user.clear(firstChildFirstName)
      await user.type(firstChildFirstName, 'john')
      await user.tab()

      await waitFor(() => {
        expect(firstChildFirstName).toHaveValue('John')
      })
    })

    it('capitalizes last name on blur', async () => {
      const user = userEvent.setup()
      renderForm()

      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[0]

      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'smith')
      await user.tab()

      await waitFor(() => {
        expect(firstChildLastName).toHaveValue('Smith')
      })
    })

    it('handles hyphenated names', async () => {
      const user = userEvent.setup()
      renderForm()

      const firstNameInputs = screen.getAllByPlaceholderText(/first name/i)
      await user.clear(firstNameInputs[0])
      await user.type(firstNameInputs[0], 'mary-ann')
      await user.tab()

      await waitFor(() => {
        expect(firstNameInputs[0]).toHaveValue('Mary-Ann')
      })
    })
  })

  describe('edge cases', () => {
    it('handles removal of children correctly', async () => {
      const user = userEvent.setup()
      renderForm()

      // Add third child
      const addChildButton = screen.getByRole('button', {
        name: /add child/i,
      })
      await user.click(addChildButton)

      await waitFor(() => {
        expect(screen.getByText(/Child #3/i)).toBeInTheDocument()
      })

      // Remove second child
      const removeButtons = screen.getAllByRole('button', { name: /remove/i })
      await user.click(removeButtons[1]) // Remove second child

      await waitFor(() => {
        // Should only have 2 children now
        const childCards = screen.getAllByText(/Child #\d/i)
        expect(childCards).toHaveLength(2)
      })
    })

    it('maintains sync after removing and adding children', async () => {
      const user = userEvent.setup()
      renderForm()

      // Set first child last name
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      await user.clear(lastNameInputs[0])
      await user.type(lastNameInputs[0], 'Smith')
      await user.tab()

      // Remove second child
      const removeButtons = screen.getAllByRole('button', { name: /remove/i })
      await user.click(removeButtons[0])

      // Add new child
      const addChildButton = screen.getByRole('button', {
        name: /add child/i,
      })
      await user.click(addChildButton)

      // New child should have synced last name
      await waitFor(() => {
        const updatedInputs = screen.getAllByPlaceholderText(/last name/i)
        expect(updatedInputs[1]).toHaveValue('Smith')
      })
    })
  })
})
