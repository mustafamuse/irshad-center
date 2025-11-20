import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GeometricPattern } from '@/components/ui/geometric-pattern'
import { Logo } from '@/components/ui/logo'

const sections = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'information', title: 'Information We Collect' },
  { id: 'usage', title: 'How We Use Your Information' },
  { id: 'sharing', title: 'Information Sharing' },
  { id: 'security', title: 'Data Security' },
  { id: 'rights', title: 'Your Rights' },
  { id: 'contact', title: 'Contact Information' },
  { id: 'updates', title: 'Updates to This Policy' },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] animate-gradient-slow opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 blur-3xl" />
        </div>
      </div>

      <div className="container relative px-4 py-16">
        <div className="mx-auto max-w-5xl">
          {/* Back Button */}
          <div className="mb-12 flex items-center justify-between">
            <Button
              asChild
              variant="ghost"
              className="flex items-center gap-2 hover:bg-transparent hover:text-primary"
            >
              <Link href="/mahad">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <Logo size="sm" />
          </div>

          {/* Header */}
          <div className="relative mb-16 text-center">
            <GeometricPattern className="absolute left-0 top-0 -z-10 h-64 w-64 rotate-90 opacity-10" />
            <h1 className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
              Privacy Policy
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Last updated: March 2024
            </p>
          </div>

          <div className="relative flex gap-8">
            {/* Table of Contents - Desktop */}
            <div className="sticky top-8 hidden h-fit w-64 shrink-0 lg:block">
              <div className="rounded-lg border bg-card/50 p-6 shadow-lg backdrop-blur-sm">
                <h3 className="mb-4 font-semibold">On this page</h3>
                <nav className="space-y-2">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </div>

            {/* Content */}
            <div className="relative flex-1 rounded-lg border bg-card/50 p-8 shadow-lg backdrop-blur-sm">
              <GeometricPattern className="absolute right-0 top-0 -z-10 h-full w-full opacity-[0.02]" />
              <div className="prose prose-gray dark:prose-invert mx-auto max-w-none">
                {/* Update all sections with IDs and scroll margins */}
                <section
                  id="introduction"
                  className="mb-12 scroll-mt-8 [&:not(:first-child)]:pt-8"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Introduction
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    At Irshād Mâhad ("we," "our," or "us"), we respect your
                    privacy and are committed to protecting your personal
                    information. This Privacy Policy explains how we collect,
                    use, and safeguard your information when you use our
                    services or visit our website.
                  </p>
                </section>

                <section
                  id="information"
                  className="mb-12 scroll-mt-8 border-t pt-8"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Information We Collect
                  </h2>
                  <div className="mt-6 space-y-6">
                    <div>
                      <h3 className="text-xl font-medium">
                        Personal Information
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        We collect information that you provide directly to us,
                        including:
                      </p>
                      <ul className="mt-4 list-none space-y-2 pl-0">
                        {[
                          'Name and contact information',
                          'Date of birth',
                          'Educational background',
                          'Banking information for payment processing',
                          'Emergency contact information',
                        ].map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                            <span className="text-muted-foreground">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xl font-medium">
                        Automatically Collected Information
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        When you visit our website, we may automatically
                        collect:
                      </p>
                      <ul className="mt-4 list-none space-y-2 pl-0">
                        {[
                          'Device information',
                          'IP address',
                          'Browser type',
                          'Pages visited',
                        ].map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                            <span className="text-muted-foreground">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>

                <section id="usage" className="mb-12 scroll-mt-8 border-t pt-8">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    How We Use Your Information
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    We use the collected information for:
                  </p>
                  <ul className="mt-4 list-none space-y-2 pl-0">
                    {[
                      'Processing enrollments and payments',
                      'Communicating about classes and programs',
                      'Providing educational services',
                      'Improving our services',
                      'Sending important announcements',
                      'Complying with legal obligations',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section
                  id="sharing"
                  className="mb-12 scroll-mt-8 border-t pt-8"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Information Sharing
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    We do not sell or rent your personal information. We may
                    share your information with:
                  </p>
                  <ul className="mt-4 list-none space-y-2 pl-0">
                    {[
                      'Service providers (e.g., payment processors)',
                      'Educational partners when necessary',
                      'Legal authorities when required by law',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section
                  id="security"
                  className="mb-12 scroll-mt-8 border-t pt-8"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Data Security
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    We take appropriate measures to protect your information
                    from unauthorized access, use, or disclosure.
                  </p>
                </section>

                <section
                  id="rights"
                  className="mb-12 scroll-mt-8 border-t pt-8"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Your Rights
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    You have the right to access, correct, or delete your
                    personal information. You can also object to the processing
                    of your personal information.
                  </p>
                </section>

                <section
                  id="contact"
                  className="mb-12 scroll-mt-8 border-t pt-8"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Contact Information
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    If you have questions about this Privacy Policy or our
                    practices, please contact us:
                  </p>
                  <ul className="mt-4 list-none space-y-2 pl-0">
                    {[
                      'Email: contact@rootsofknowledge.org',
                      'In person: During weekend office hours after classes',
                      'WhatsApp: Available during business hours',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section
                  id="updates"
                  className="mb-12 scroll-mt-8 border-t pt-8"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Updates to This Policy
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    We may update this Privacy Policy from time to time. We will
                    notify you of any changes by posting the new Privacy Policy
                    on this page and updating the "Last updated" date.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
