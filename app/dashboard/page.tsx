import EmptyState from '@/components/ui/empty-state'
import React from 'react'
import AddNewButton from '@/features/dashboard/components/add-new-button'
import AddRepoButton from '@/features/dashboard/components/add-repo-button'
import { deleteProjectById, duplicateProjectById, editProjectById, getAllPlaygroundForUser } from '@/features/dashboard/actions'
import ProjectTable from '@/features/dashboard/components/project-table'

const Page = async () => {
    const playgrounds = await getAllPlaygroundForUser();
  return (
    <div className='flex flex-col justify-start items-center min-h-screen mx-auto max-w-7xl px-4 py-10'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 w-full'>
            <AddNewButton />
            <AddRepoButton />
        </div>

        <div className='mt-10 flex flex-col justify-center items-center w-full'>
            {
                playgrounds && playgrounds.length ===0? (<EmptyState title='No Projects Found' description='Create a new project to get started' imageSrc='/empty-state.svg'/>) :(
                    //todo add playgrounnd table
                    <ProjectTable
                    // @ts-ignore
                    // NB: Need to Update the Types of the playground
                    projects={playgrounds || []}
                    onDeleteProject={deleteProjectById}
                    onUpdateProject={editProjectById}
                    onDuplicateProject={duplicateProjectById}
                    />
                )
            }
        </div>
    </div>
  )
}

export default Page