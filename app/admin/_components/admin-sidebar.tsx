'use client'

import * as React from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Home } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface NavItem {
  title: string
  url: string
  items?: NavItem[]
}

interface SidebarData {
  navMain: NavItem[]
}

const data: SidebarData = {
  navMain: [
    {
      title: 'Programs',
      url: '#',
      items: [
        {
          title: 'Dugsi',
          url: '/admin/dugsi',
        },
        {
          title: 'Mahad',
          url: '/admin/mahad',
        },
      ],
    },
    {
      title: 'People',
      url: '#',
      items: [
        {
          title: 'People Lookup',
          url: '/admin/people/lookup',
        },
        {
          title: 'Multi-role People',
          url: '/admin/people/multi-role',
        },
        {
          title: 'Teachers',
          url: '/admin/teachers',
        },
      ],
    },
    {
      title: 'Financial',
      url: '#',
      items: [
        {
          title: 'Payments',
          url: '/admin/payments',
        },
        {
          title: 'Link Subscriptions',
          url: '/admin/link-subscriptions',
        },
        {
          title: 'Profit Share',
          url: '/admin/profit-share',
        },
      ],
    },
    {
      title: 'Operations',
      url: '#',
      items: [
        {
          title: 'Attendance',
          url: '/admin/shared/attendance',
        },
      ],
    },
    {
      title: 'Public Pages',
      url: '#',
      items: [
        {
          title: 'Home',
          url: '/',
        },
        {
          title: 'Mahad',
          url: '/mahad',
          items: [
            {
              title: 'Landing',
              url: '/mahad',
            },
            {
              title: 'Register',
              url: '/mahad/register',
            },
            {
              title: 'Programs',
              url: '/mahad/programs',
            },
            {
              title: 'Scholarship',
              url: '/mahad/scholarship',
            },
            {
              title: 'Autopay',
              url: '/mahad/autopay',
            },
            {
              title: 'Payment FAQ',
              url: '/mahad/payment-faq',
            },
            {
              title: 'Privacy',
              url: '/mahad/privacy',
            },
            {
              title: 'Terms',
              url: '/mahad/terms',
            },
          ],
        },
        {
          title: 'Dugsi',
          url: '/dugsi',
          items: [
            {
              title: 'Landing',
              url: '/dugsi',
            },
            {
              title: 'Register',
              url: '/dugsi/register',
            },
          ],
        },
      ],
    },
  ],
}

export function AdminSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Home className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Admin Dashboard</span>
                  <span className="text-xs text-muted-foreground">
                    Irshad Center
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton className="cursor-default font-medium">
                  {item.title}
                </SidebarMenuButton>
                {item.items?.length ? (
                  <SidebarMenuSub>
                    {item.items.map((subItem) => {
                      const isActive = subItem.items?.length
                        ? pathname === subItem.url
                        : pathname === subItem.url ||
                          pathname.startsWith(`${subItem.url}/`)

                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isActive}>
                            <Link href={subItem.url}>{subItem.title}</Link>
                          </SidebarMenuSubButton>
                          {subItem.items?.length ? (
                            <SidebarMenuSub>
                              {subItem.items.map((nestedItem) => {
                                const isNestedActive =
                                  pathname === nestedItem.url ||
                                  pathname.startsWith(`${nestedItem.url}/`)

                                return (
                                  <SidebarMenuSubItem key={nestedItem.title}>
                                    <SidebarMenuSubButton
                                      asChild
                                      isActive={isNestedActive}
                                    >
                                      <Link href={nestedItem.url}>
                                        {nestedItem.title}
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                )
                              })}
                            </SidebarMenuSub>
                          ) : null}
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-sm text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
