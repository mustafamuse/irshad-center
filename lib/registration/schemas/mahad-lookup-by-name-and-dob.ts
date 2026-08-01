import { z } from 'zod'

import { nameSchema } from '@/lib/registration/schemas/registration-field-schemas'

export const mahadLookupByNameAndDobSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  dateOfBirth: z
    .date({
      required_error: 'Date of birth is required',
      invalid_type_error: 'Enter a valid date of birth',
    })
    .max(new Date(), 'Date of birth cannot be in the future')
    .min(new Date('1900-01-01'), 'Date of birth must be after 1900'),
})

export type MahadLookupByNameAndDobValues = z.infer<
  typeof mahadLookupByNameAndDobSchema
>

/**
 * Initial form state. `dateOfBirth` starts undefined; the resolver enforces
 * presence at submit time. Typed as `Partial<>` so we never lie about the
 * runtime shape via an `as` cast.
 */
export const MAHAD_LOOKUP_BY_NAME_DOB_DEFAULTS: Partial<MahadLookupByNameAndDobValues> =
  {
    firstName: '',
    lastName: '',
    dateOfBirth: undefined,
  }
