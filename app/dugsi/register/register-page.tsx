'use client'

import { useEffect } from 'react'

import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'

import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

import { DugsiRegisterForm } from './_components/register-form'
import { Providers } from './providers'

function DugsiRegisterContent() {
  const { setTheme } = useTheme()
  const t = useTranslations('dugsi')

  useEffect(() => {
    setTheme('light')
  }, [setTheme])

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8 md:px-6 md:py-12">
        {/* Navigation */}
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <Button
            asChild
            variant="ghost"
            className="h-9 gap-1.5 rounded-xl text-xs text-[#007078] hover:bg-[#007078]/10 sm:h-10 sm:gap-2 sm:text-sm"
          >
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="xs:inline hidden">
                {t('navigation.backToHome')}
              </span>
              <span className="xs:hidden">{t('navigation.back')}</span>
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="w-24 sm:w-32">
              <Logo />
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="mb-6 text-center sm:mb-8 md:mb-12">
          <h1 className="mb-3 text-2xl font-bold text-[#007078] sm:mb-4 sm:text-3xl md:text-4xl">
            {t('header.title')}
          </h1>
          <p className="mx-auto max-w-2xl px-2 text-base text-gray-600 sm:text-lg md:text-xl">
            {t('header.description')}
          </p>
        </div>

        {/* Registration Form */}
        <div className="mx-auto max-w-4xl">
          <DugsiRegisterForm />
        </div>

        {/* Footer Info */}
        <div className="mt-8 px-4 text-center sm:mt-12">
          <p className="text-xs text-gray-500 sm:text-sm">
            {t('footer.needHelp')}{' '}
            <a
              href={`mailto:${t('footer.email')}`}
              className="break-all font-medium text-[#007078] hover:underline"
            >
              {t('footer.email')}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export function DugsiRegisterPage() {
  return (
    <Providers>
      <DugsiRegisterContent />
    </Providers>
  )
}
