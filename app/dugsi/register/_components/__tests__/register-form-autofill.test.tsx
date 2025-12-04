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

    it('shows edit buttons after first child has data', async () => {
      const user = userEvent.setup()
      renderForm()

      // Initially no edit buttons (first child has no data)
      let editButtons = screen.queryAllByRole('button', { name: /edit/i })
      expect(editButtons.length).toBe(0)

      // Set first child last name
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      await user.clear(lastNameInputs[2])
      await user.type(lastNameInputs[2], 'Smith')

      // Now edit buttons should appear for second child
      await waitFor(() => {
        editButtons = screen.queryAllByRole('button', { name: /edit/i })
        expect(editButtons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('last name auto-fill', () => {
    it('syncs first child last name to second child', async () => {
      const user = userEvent.setup()
      renderForm()

      // Find first child's last name field
      // Index 0-1 are parent fields, 2-3 are children
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[2]
      const secondChildLastName = lastNameInputs[3]

      // Type in first child's last name
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')

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
        name: /add another child/i,
      })
      await user.click(addChildButton)

      // Wait for third child to appear
      await waitFor(() => {
        expect(screen.getByText(/Child #3/i)).toBeInTheDocument()
      })

      // Find all last name fields
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[2] // Index 2 is first child

      // Type in first child's last name
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Johnson')

      // All children should have synced last name (indices 3 and 4 are child 2 and 3)
      await waitFor(() => {
        expect(lastNameInputs[3]).toHaveValue('Johnson')
        expect(lastNameInputs[4]).toHaveValue('Johnson')
      })
    })

    it('updates synced children when first child last name changes', async () => {
      const user = userEvent.setup()
      renderForm()

      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[2]
      const secondChildLastName = lastNameInputs[3]

      // Set initial value
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')

      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Smith')
      })

      // Change first child's last name
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Jones')

      // Second child should update
      await waitFor(() => {
        expect(secondChildLastName).toHaveValue('Jones')
      })
    })
  })

  describe('shift auto-fill', () => {
    it('renders shift fields for all children', () => {
      renderForm()

      // Verify shift label appears (once per child - 2 children by default)
      const shiftLabels = screen.getAllByText(/Shift/i)
      expect(shiftLabels.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('custom override toggle - last name', () => {
    it('allows editing last name when clicking edit button', async () => {
      const user = userEvent.setup()
      renderForm()

      // Set first child last name
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[2]
      const secondChildLastName = lastNameInputs[3]

      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')

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
      const firstChildLastName = lastNameInputs[2]
      const secondChildLastName = lastNameInputs[3]

      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')

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
      const firstChildLastName = lastNameInputs[2]
      const secondChildLastName = lastNameInputs[3]

      // Set initial value
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Smith')

      // Enable custom edit for second child
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      // Set custom value
      await user.clear(secondChildLastName)
      await user.type(secondChildLastName, 'Jones')

      // Change first child
      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'Brown')

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
      await user.clear(lastNameInputs[2])
      await user.type(lastNameInputs[2], 'Smith')

      // Add third child
      const addChildButton = screen.getByRole('button', {
        name: /add another child/i,
      })
      await user.click(addChildButton)

      // Wait for third child
      await waitFor(() => {
        expect(screen.getByText(/Child #3/i)).toBeInTheDocument()
      })

      // Third child should have pre-filled last name (index 4)
      const updatedLastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const thirdChildLastName = updatedLastNameInputs[4]

      await waitFor(() => {
        expect(thirdChildLastName).toHaveValue('Smith')
      })
    })
  })

  describe('name capitalization', () => {
    it('capitalizes first name in real-time', async () => {
      const user = userEvent.setup()
      renderForm()

      // Index 2 is first child (0-1 are parents)
      const firstNameInputs = screen.getAllByPlaceholderText(/first name/i)
      const firstChildFirstName = firstNameInputs[2]

      await user.clear(firstChildFirstName)
      await user.type(firstChildFirstName, 'john')

      await waitFor(() => {
        expect(firstChildFirstName).toHaveValue('John')
      })
    })

    it('capitalizes last name in real-time', async () => {
      const user = userEvent.setup()
      renderForm()

      // Index 2 is first child (0-1 are parents)
      const lastNameInputs = screen.getAllByPlaceholderText(/last name/i)
      const firstChildLastName = lastNameInputs[2]

      await user.clear(firstChildLastName)
      await user.type(firstChildLastName, 'smith')

      await waitFor(() => {
        expect(firstChildLastName).toHaveValue('Smith')
      })
    })

    it('handles hyphenated names', async () => {
      const user = userEvent.setup()
      renderForm()

      // Index 2 is first child (0-1 are parents)
      const firstNameInputs = screen.getAllByPlaceholderText(/first name/i)
      await user.clear(firstNameInputs[2])
      await user.type(firstNameInputs[2], 'mary-ann')

      await waitFor(() => {
        expect(firstNameInputs[2]).toHaveValue('Mary-Ann')
      })
    })
  })

  describe('edge cases', () => {
    it('handles removal of children correctly', async () => {
      const user = userEvent.setup()
      renderForm()

      // Add third child
      const addChildButton = screen.getByRole('button', {
        name: /add another child/i,
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
      await user.clear(lastNameInputs[2])
      await user.type(lastNameInputs[2], 'Smith')

      // Remove second child
      const removeButtons = screen.getAllByRole('button', { name: /remove/i })
      await user.click(removeButtons[0])

      // Add new child
      const addChildButton = screen.getByRole('button', {
        name: /add another child/i,
      })
      await user.click(addChildButton)

      // New child should have synced last name (index 3)
      await waitFor(() => {
        const updatedInputs = screen.getAllByPlaceholderText(/last name/i)
        expect(updatedInputs[3]).toHaveValue('Smith')
      })
    })
  })
})
