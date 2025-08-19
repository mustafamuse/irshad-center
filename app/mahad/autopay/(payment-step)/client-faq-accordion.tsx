'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

interface FAQItem {
  id: string
  icon: LucideIcon
  title: string
  content: string
}

interface ClientFAQAccordionProps {
  items: FAQItem[]
}

export function ClientFAQAccordion({ items }: ClientFAQAccordionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      <Accordion type="single" collapsible className="w-full">
        {items.map((item) => (
          <AccordionItem
            value={item.id}
            key={item.id}
            className="border-b py-2 last:border-b-0"
          >
            <AccordionTrigger className="py-2 text-[15px] leading-6 hover:no-underline [&>span]:text-left">
              <span className="flex items-center gap-3">
                <item.icon
                  size={16}
                  strokeWidth={2}
                  className="shrink-0 opacity-60"
                  aria-hidden="true"
                />
                <span>{item.title}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-2 ps-7 text-left text-sm text-muted-foreground">
              {item.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.div>
  )
}
