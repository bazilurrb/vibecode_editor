"use server"

import {currentUser} from "@/features/auth/actions";
import {db} from "@/lib/db";
import { revalidatePath } from "next/cache";
import { TemplateFolder } from "@/features/playground/libs/path-to-json";

export const getPlaygroundById = async (id:string)=>{
    const user = await currentUser();
    if (!user || !user.id) return null;

    try{
        const playground = await db.playground.findFirst({
            where:{
                id,
                userId: user.id
            },
            select:{
                title:true,
                description:true,
                templateFiles:{
                select:{
                    content:true,
                }
            }}
        })
        return playground
    } catch(error){
        console.error(error);
        return null;
    }
}

export const SaveUpdatedCode = async (playgroundId:string, data: TemplateFolder)=>{
    const user = await currentUser();
    if(!user?.id) return null;

    try{
        const playground = await db.playground.findUnique({
            where: { id: playgroundId },
            select: { userId: true },
        });

        if (!playground || playground.userId !== user.id) {
            console.error("Unauthorized save attempt on playground:", playgroundId);
            return null;
        }

        const updatedPlayground = await db.templateFile.upsert({
            where:{
                playgroundId
            },
            update:{
                content: JSON.stringify(data)
            },
            create:{
                playgroundId,
                content: JSON.stringify(data)
            }
        })
        return updatedPlayground;
    } catch (error){
        console.error(error);
        return null;
    }
} 