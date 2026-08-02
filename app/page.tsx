import {Button} from "@/components/ui/button";
import Image from "next/image";
import SignInFormClient from "@/features/auth/components/signin-form-client";
import SignInPage from "./(auth)/auth/sign-in/page";

export default function Home() {
  return (
    <div className="">
      <SignInPage/>
    </div>
  )
}
