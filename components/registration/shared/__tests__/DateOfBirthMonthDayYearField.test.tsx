import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { Form } from '@/components/ui/form'

import { DateOfBirthMonthDayYearField } from '../DateOfBirthMonthDayYearField'

function Harness({ onValue }: { onValue?: (v: Date | undefined) => void }) {
  const form = useForm<{ dob: Date | undefined }>({
    defaultValues: { dob: undefined },
  })
  const dob = form.watch('dob')
  // Surface the value to the test without re-rendering assertions.
  onValue?.(dob)
  return (
    <Form {...form}>
      <DateOfBirthMonthDayYearField control={form.control} fieldName="dob" />
    </Form>
  )
}

describe('DateOfBirthMonthDayYearField', () => {
  it('builds a Date when month, day, and year are all valid', async () => {
    const user = userEvent.setup()
    let latest: Date | undefined
    render(<Harness onValue={(v) => (latest = v)} />)

    await user.type(screen.getByLabelText('Month'), '03')
    await user.type(screen.getByLabelText('Day'), '05')
    await user.type(screen.getByLabelText('Year'), '2005')

    expect(latest).toBeInstanceOf(Date)
    expect(latest?.getFullYear()).toBe(2005)
    expect(latest?.getMonth()).toBe(2) // March is 2 (0-indexed)
    expect(latest?.getDate()).toBe(5)
  })

  it('yields undefined for invalid calendar dates (Feb 30)', async () => {
    const user = userEvent.setup()
    let latest: Date | undefined = new Date('2000-01-01')
    render(<Harness onValue={(v) => (latest = v)} />)

    await user.type(screen.getByLabelText('Month'), '02')
    await user.type(screen.getByLabelText('Day'), '30')
    await user.type(screen.getByLabelText('Year'), '2005')

    expect(latest).toBeUndefined()
  })

  it('sets aria-required on each input', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Month')).toHaveAttribute(
      'aria-required',
      'true'
    )
    expect(screen.getByLabelText('Day')).toHaveAttribute(
      'aria-required',
      'true'
    )
    expect(screen.getByLabelText('Year')).toHaveAttribute(
      'aria-required',
      'true'
    )
  })

  it('groups the inputs in a fieldset with an accessible legend', () => {
    render(<Harness />)
    const group = screen.getByRole('group', { name: 'Date of Birth' })
    expect(group.tagName).toBe('FIELDSET')
  })

  it('links each input to the format hint via aria-describedby', () => {
    render(<Harness />)
    const hint = screen.getByText(/Enter your date of birth as month, day/i)
    const hintId = hint.getAttribute('id')
    expect(hintId).toBeTruthy()
    for (const label of ['Month', 'Day', 'Year']) {
      expect(screen.getByLabelText(label)).toHaveAttribute(
        'aria-describedby',
        hintId
      )
    }
  })
})
