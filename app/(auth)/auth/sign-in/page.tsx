import SignInFormClient from "@/features/auth/components/signin-form-client";
import Image from "next/image"
// import logo from "../../../public/logo.svg"
import React from "react";

const SignInPage = () => {
    return( 
    <div className="space-y-6 flex flex-col items-center justify-center">
    <img src="/logo.svg" alt="logo Image" width={300} height={300} />
    <SignInFormClient />
    </div>
    )
};

export default SignInPage