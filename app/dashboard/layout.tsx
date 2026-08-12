import { SidebarProvider } from '@/components/ui/sidebar'
import DashboardSidebar from '@/features/dashboard/components/dashboard-sidebar'
import React from 'react'
import { getAllPlaygroundForUser } from '@/features/dashboard/actions'

export default async function DashboardLayout({children}: {children:React.ReactNode}){

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
            <div className='flex min-h-screen w-full overflow-x-hidden'>
                {/* TODO: DASHBOARDSIDEBAR implement */}
                <DashboardSidebar initialPlaygroundData={formattedPlaygroundData}/>
                <main className='flex-1'>
                    {children}
                </main>
            </div>
        </SidebarProvider>
    )
}