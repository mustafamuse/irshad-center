import { useTranslations } from 'next-intl'

import {
  DUGSI_GRADE_OPTIONS,
  GENDER_OPTIONS,
} from '../registration/schemas/registration'

export function useTranslatedGenderOptions() {
  const t = useTranslations('dugsi.gender')

  return GENDER_OPTIONS.map((option) => ({
    value: option.value,
    label: option.value === 'MALE' ? t('boy') : t('girl'),
  }))
}

export function useTranslatedGradeOptions() {
  const t = useTranslations('dugsi.grades')

  return DUGSI_GRADE_OPTIONS.map((option) => {
    const key = option.value.toLowerCase().replace('_', '') as
      | 'kindergarten'
      | 'grade1'
      | 'grade2'
      | 'grade3'
      | 'grade4'
      | 'grade5'
      | 'grade6'
      | 'grade7'
      | 'grade8'
      | 'grade9'
      | 'grade10'
      | 'grade11'
      | 'grade12'

    return {
      value: option.value,
      label: t(key),
    }
  })
}
