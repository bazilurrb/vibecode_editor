"use server"

import { currentUser } from "@/features/auth/actions"
import { db } from "@/lib/db"
import { Templates } from "@prisma/client"
import { revalidatePath } from "next/cache"

export const createPlayground = async(data:{
    title: string;
    template: Templates;
    description?: string;
})=>{ 
    const {template, title, description} = data;

    const user = await currentUser();
    if (!user || !user.id) {
        throw new Error("Unauthorized: You must be logged in to create a playground");
    }

    try{
        const playground = await db.playground.create({
            data:{
                title,
                description,
                template,
                userId: user.id
            }
        });
        revalidatePath("/dashboard");
        return playground;
    } catch(error){
        console.error(error);
        return null;
    }
}

export const getAllPlaygroundForUser = async()=>{
    const user = await currentUser();

    if (!user || !user.id) {
        return [];
    }

    try{
        const playground = await db.playground.findMany({
            where:{
                userId: user.id
            },
            include:{
                user:true,
                Starmark:{
                    where:{
                        userId: user.id
                    },
                    select:{
                        isMarked: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        return playground;
    } catch(error){
        console.error(error);
        return [];
    }
}

export const deleteProjectById = async(id:string)=>{
    const user = await currentUser();
    if (!user || !user.id) {
        throw new Error("Unauthorized");
    }

    try{
        await db.playground.deleteMany({
            where:{
                id,
                userId: user.id
            }
        })
        revalidatePath("/dashboard");
    } catch(error){
        console.error(error);
    }
}

export const editProjectById = async (id:string, data:{title:string, description:string})=>{
    const user = await currentUser();
    if (!user || !user.id) {
        throw new Error("Unauthorized");
    }

    try{
        await db.playground.updateMany({
            where:{
                id,
                userId: user.id
            },
            data: data
        })
        revalidatePath("/dashboard");
    } catch(error) {
        console.error(error);
    }
}

export const duplicateProjectById = async(id:string)=>{
    const user = await currentUser();
    if (!user || !user.id) {
        throw new Error("Unauthorized");
    }

    try{
        const originalPlayground = await db.playground.findUnique({
            where:{id}
        })

        if(!originalPlayground){
            throw new Error("Playground not found");
        }

        const duplicatePlayground = await db.playground.create({
            data:{
                title:`${originalPlayground.title} (Copy)`,
                description:originalPlayground.description,
                template:originalPlayground.template,
                userId: user.id
            }
        })

        revalidatePath("/dashboard");

        return duplicatePlayground;
    } catch(error){
        console.error(error);
        return null;
    }
}