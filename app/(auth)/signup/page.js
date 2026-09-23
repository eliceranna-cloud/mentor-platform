import { SignupFlow } from "./SignupFlow";

export const metadata = { title: "학생 회원가입" };

// ?verify=<email> jumps straight to the code step (used from the login page
// when an account exists but the email was never confirmed).
export default async function SignupPage({ searchParams }) {
  const { verify } = await searchParams;
  return <SignupFlow verifyEmail={typeof verify === "string" ? verify : null} />;
}
