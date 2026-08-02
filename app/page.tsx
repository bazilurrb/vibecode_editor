import {Button} from "@/components/ui/button";
import Image from "next/image";
import SignInFormClient from "@/features/auth/components/signin-form-client";
import SignInPage from "./(auth)/auth/sign-in/page";
import { auth } from "@/auth";
import UserButton from "@/features/auth/components/user-button";

// export default async function Home() {
//   const session = await auth();

//   if (!session?.user) {
//     return (
//       <div>
//         <SignInPage />
//       </div>
//     );
//   }

//   return (
//     <div>
//       <h1>Welcome, {session.user.name}!</h1>
//       {/* your actual dashboard/home content goes here */}
//     </div>
//   );
// }

export default function Home() {
  return (
    <div>
      <h1 className="text-4xl font-bold text-rose-500">Home</h1>
      <UserButton />
    </div>
  );
}