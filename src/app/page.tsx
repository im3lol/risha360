'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Users,
  Search,
  MessageSquare,
  Cpu,
  BarChart3,
  Settings,
  Zap,
  ChevronDown,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OverviewTab } from '@/components/dashboard/overview-tab';
import { LeadsTab } from '@/components/dashboard/leads-tab';
import { DiscoveryTab } from '@/components/dashboard/discovery-tab';
import { OutreachTab } from '@/components/dashboard/outreach-tab';
import { AgentTab } from '@/components/dashboard/agent-tab';
import { AnalyticsTab } from '@/components/dashboard/analytics-tab';
import { SettingsTab } from '@/components/dashboard/settings-tab';
import { AuthGate } from '@/components/auth-gate';
import { supabase } from '@/lib/supabase';

const navItems = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard, badge: null },
  { value: 'leads', label: 'Leads', icon: Users, badge: null },
  { value: 'discovery', label: 'Discovery', icon: Search, badge: null },
  { value: 'outreach', label: 'Outreach', icon: MessageSquare, badge: null },
  { value: 'agents', label: 'AI Agents', icon: Cpu, badge: null },
  { value: 'analytics', label: 'Analytics', icon: BarChart3, badge: null },
];

const toolItems = [
  { value: 'settings', label: 'Settings', icon: Settings },
];

export default function Home() {
  const [activePage, setActivePage] = useState('overview');

  const renderContent = () => {
    switch (activePage) {
      case 'overview': return <OverviewTab />;
      case 'leads': return <LeadsTab />;
      case 'discovery': return <DiscoveryTab />;
      case 'outreach': return <OutreachTab />;
      case 'agents': return <AgentTab />;
      case 'analytics': return <AnalyticsTab />;
      case 'settings': return <SettingsTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <AuthGate>
      <SidebarProvider>
      <Sidebar side="left" variant="sidebar" collapsible="icon">
        {/* Sidebar Header - Logo */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="hover:bg-sidebar-accent">
                <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-white p-1 shadow-sm">
                  <img src="/reesha-logo-ar.svg" alt="Reesha" className="size-full object-contain" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-bold text-sm">Reesha Acquisition</span>
                  <span className="text-[10px] text-muted-foreground">Creator acquisition workspace</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Sidebar Content - Navigation */}
        <SidebarContent>
          {/* Main Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Main
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.value;
                  return (
                    <SidebarMenuItem key={item.value}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setActivePage(item.value)}
                        tooltip={item.label}
                        className={isActive ? 'bg-purple-700 text-white hover:bg-purple-800 hover:text-white' : ''}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.badge && (
                        <SidebarMenuBadge
                          className={isActive ? 'bg-purple-500 text-white' : 'bg-slate-200 text-slate-700'}
                        >
                          {item.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="mx-2" />

          {/* System Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              System
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {toolItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.value;
                  return (
                    <SidebarMenuItem key={item.value}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setActivePage(item.value)}
                        tooltip={item.label}
                        className={isActive ? 'bg-purple-700 text-white hover:bg-purple-800 hover:text-white' : ''}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="mx-2" />

          {/* Live Status */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Live Status
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-1 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-muted-foreground group-data-[collapsible=icon]:hidden">Workflow definitions ready</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-muted-foreground group-data-[collapsible=icon]:hidden">Supabase data layer</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-muted-foreground group-data-[collapsible=icon]:hidden">Human approval required</span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Sidebar Footer - User */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="hover:bg-sidebar-accent">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-teal-600 text-white text-sm font-bold">
                      A
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-medium text-sm">Admin</span>
                      <span className="text-[10px] text-muted-foreground">admin@risha360.sa</span>
                    </div>
                    <ChevronDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width]">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Billing</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void supabase.auth.signOut()}>
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Main Content Area */}
      <SidebarInset className="min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-slate-200/60">
          <div className="flex items-center justify-between px-4 sm:px-6 h-12">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900 capitalize">
                  {activePage === 'agents' ? 'AI Agents' : activePage}
                </h2>
                {activePage === 'leads' && (
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-0 text-[9px]">
                    Acquisition pipeline
                  </Badge>
                )}
                {activePage === 'agents' && (
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-0 text-[9px]">
                    Workflow blueprint
                  </Badge>
                )}
              </div>
            </div>
            <div />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 min-w-0 overflow-x-hidden px-4 sm:px-6 py-5">
          {renderContent()}
        </main>

        {/* Footer */}
        <footer className="border-t bg-white">
          <div className="px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-1 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-700 rounded flex items-center justify-center">
                <Zap className="h-2.5 w-2.5 text-white" />
              </div>
              <span>Reesha Creator Acquisition MVP</span>
            </div>
            <div className="flex items-center gap-4">
              <span>AI-assisted discovery</span>
              <span>&#x2022;</span>
              <span>Human-reviewed outreach</span>
              <span>&#x2022;</span>
              <span>Saudi-first creator CRM</span>
            </div>
          </div>
        </footer>
      </SidebarInset>
      </SidebarProvider>
    </AuthGate>
  );
}
