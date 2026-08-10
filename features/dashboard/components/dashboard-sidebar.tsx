"use client"

import React, {useState} from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from '@/components/ui/sidebar';
import Image from 'next/image';
import { Home, Plus, FolderPlus, Star, Zap, Lightbulb, LucideIcon, Database, Compass, FlameIcon, Terminal, Code2, History, Settings, LayoutDashboard} from 'lucide-react';
import Link from 'next/link';


interface PlaygroundDataProps{
    id: string;
    name: string;
    icon: string;
    starred: boolean;
}


const lucideIconMap: Record<string, LucideIcon>={
    Zap: Zap,
    Lightbulb: Lightbulb,
    Database: Database,
    Compass: Compass,
    FlameIcon: FlameIcon,
    Terminal: Terminal,
    Code2: Code2,
}

const DashboardSidebar = ({initialPlaygroundData}: {initialPlaygroundData: PlaygroundDataProps[]}) => {
    const pathname = usePathname();
    const [starredPlaygrounds, setStarredPlayground] = useState(initialPlaygroundData.filter((p)=>p.starred));
    const [recentPlaygrounds, setRecentPlayground] = useState(initialPlaygroundData);
  return (
    <Sidebar variant="inset" collapsible="icon" className='border-1 border-r'>
        <SidebarHeader>    
            <div className='flex items-center gap-2 px-4 py-3 justify-center'>
                <Image src={"/logo.svg"} alt="logo Image" width={60} height={60} />
            </div>
        </SidebarHeader>


        <SidebarContent>



            <SidebarGroup>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton render={<Link href="/" />} isActive={pathname === "/"} tooltip="Home">
                                <Home className='h-4 w-4' />
                                <span>Home</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton render={<Link href="#" />} isActive={pathname === "/dashboard"} tooltip="Home">
                                <LayoutDashboard className='h-4 w-4' />
                                <span>Dashboard</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
            <SidebarGroupLabel>
                <Star className="h-4 w-4 mr-2" />
                Starred
            </SidebarGroupLabel>

            <SidebarGroupAction title="Add starred playground">
                <Plus className="h-4 w-4" />
            </SidebarGroupAction>

            <SidebarGroupContent>
                <SidebarMenu>
                {starredPlaygrounds.length === 0 && recentPlaygrounds.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4 w-full">
                    Create your playground
                    </div>
                ) : (
                    starredPlaygrounds.map((playground) => {
                    const IconComponent = lucideIconMap[playground.icon] || Code2;

                    return (
                        <SidebarMenuItem key={playground.id}>
                        <SidebarMenuButton
                            render={<Link href={`/playground/${playground.id}`} />}
                            isActive={pathname === `/playground/${playground.id}`}
                            tooltip={playground.name}
                        >
                            <IconComponent className="h-4 w-4" />
                            <span>{playground.name}</span>
                        </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                    })
                )}
                </SidebarMenu>
            </SidebarGroupContent>
            </SidebarGroup>


            <SidebarGroup>
                <SidebarGroupLabel>
                    <History className="h-4 w-4 mr-2" />
                    Recent
                </SidebarGroupLabel>

                <SidebarGroupAction title="Create new playground">
                    <FolderPlus className="h-4 w-4" />
                </SidebarGroupAction>

                <SidebarGroupContent>
                    <SidebarMenu>
                    {starredPlaygrounds.length === 0 && recentPlaygrounds.length === 0
                        ? null
                        : recentPlaygrounds.map((playground) => {
                            const IconComponent = lucideIconMap[playground.icon] || Code2;

                            return (
                            <SidebarMenuItem key={playground.id}>
                                <SidebarMenuButton
                                render={<Link href={`/playground/${playground.id}`} />}
                                isActive={pathname === `/playground/${playground.id}`}
                                tooltip={playground.name}
                                >
                                <IconComponent className="h-4 w-4" />
                                <span>{playground.name}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            );
                        })}

                    <SidebarMenuItem>
                        <SidebarMenuButton
                        render={<Link href="/playgrounds" />}
                        tooltip="View all"
                        >
                        <span className="text-sm text-muted-foreground">
                            View all playgrounds
                        </span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
                </SidebarGroup>                    
            </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton render={<Link href="/settings" />} tooltip="Settings">
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
        <SidebarRail/>
    </Sidebar>
  )
}

export default DashboardSidebar