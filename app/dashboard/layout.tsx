import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import DashboardSidebar from '@/features/dashboard/components/dashboard-sidebar'
import React from 'react'
import { getAllPlaygroundForUser } from '@/features/dashboard/actions'
import { currentUser } from '@/features/auth/actions'
import { redirect } from 'next/navigation'

export const dynamic = "force-dynamic";

export default async function DashboardLayout({children}: {children:React.ReactNode}){
    const user = await currentUser();
    if (!user) {
        redirect("/auth/sign-in");
    }

    const playgroundData = await getAllPlaygroundForUser();

    const technologyIconMap: Record<string, string>={
        REACT:"Zap",
        NEXTJS:"Lightbulb",
        EXPRESS:"Database",
        VUE:"Compass",
        HONO:"FlameIcon",
        ANGULAR:"Terminal",
    }

    const formattedPlaygroundData = playgroundData?.map((playground)=>({
        id:playground.id,
        name:playground.title,
        starred:playground.Starmark?.[0]?.isMarked || false,
        icon: technologyIconMap[playground.template] || "Code2",
    })) || [];

    return (
        <SidebarProvider>
            <DashboardSidebar initialPlaygroundData={formattedPlaygroundData}/>
            <SidebarInset className="min-w-0 flex-1 overflow-x-hidden">
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}