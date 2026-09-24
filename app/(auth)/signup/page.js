import { redirect } from "next/navigation";
import { SignupFlow } from "./SignupFlow";

export const metadata = { title: "학생 회원가입" };

// Older links used /signup?verify=<email> for the code step; it now has its own page.
export default async function SignupPage({ searchParams }) {
  const { verify } = await searchParams;
  if (verify) redirect("/signup/verify");
  return <SignupFlow />;
}
