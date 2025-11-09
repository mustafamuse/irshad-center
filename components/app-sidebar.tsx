"use client"

import * as React from "react"
import {
  ArrowUpCircleIcon,
  BarChart3,
  BookOpen,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  HelpCircleIcon,
  Home,
  LayoutDashboard,
  Receipt,
  SearchIcon,
  Settings,
  TrendingUp,
  UserCheck,
  Users,
  Users2,
  Wallet,
} from "lucide-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"

const data = {
  user: {
    name: "Admin User",
    email: "admin@irshadcenter.com",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/admin/v2",
      icon: LayoutDashboard,
    },
    {
      title: "Students",
      url: "#",
      icon: Users,
      items: [
        {
          title: "MAHAD Students",
          url: "/admin/students/mahad",
          icon: GraduationCap,
        },
        {
          title: "Dugsi Families",
          url: "/admin/dugsi",
          icon: Users2,
        },
        {
          title: "Duplicates",
          url: "/admin/duplicates",
          icon: UserCheck,
        },
      ],
    },
    {
      title: "Cohorts",
      url: "/admin/cohorts",
      icon: BookOpen,
    },
    {
      title: "Billing",
      url: "#",
      icon: CreditCard,
      items: [
        {
          title: "Overview",
          url: "/admin/billing/overview",
          icon: BarChart3,
        },
        {
          title: "Invoices",
          url: "/admin/billing/invoices",
          icon: FileText,
        },
        {
          title: "Subscriptions",
          url: "/admin/billing/subscriptions",
          icon: Receipt,
        },
        {
          title: "Profit Share",
          url: "/admin/billing/profit-share",
          icon: TrendingUp,
        },
      ],
    },
    {
      title: "Attendance",
      url: "/admin/attendance",
      icon: CalendarDays,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings,
    },
    {
      title: "Help & Support",
      url: "/admin/help",
      icon: HelpCircleIcon,
    },
    {
      title: "Search",
      url: "#",
      icon: SearchIcon,
    },
  ],
  documents: [
    {
      name: "Student Reports",
      url: "/admin/reports/students",
      icon: FileText,
    },
    {
      name: "Financial Reports",
      url: "/admin/reports/financial",
      icon: Wallet,
    },
    {
      name: "Attendance Reports",
      url: "/admin/reports/attendance",
      icon: CalendarDays,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/admin/v2">
                <Home className="h-5 w-5" />
                <span className="text-base font-semibold">Irshad Center Admin</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navMain.map((item) => (
                <React.Fragment key={item.title}>
                  {item.items ? (
                    <Collapsible asChild>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  <a href={subItem.url}>
                                    {subItem.icon && <subItem.icon className="h-4 w-4" />}
                                    <span>{subItem.title}</span>
                                  </a>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <a href={item.url}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </React.Fragment>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}