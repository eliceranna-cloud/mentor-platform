import { LoginForm } from "./LoginForm";

export const metadata = { title: "로그인" };

const LINK_ERRORS = {
  link_invalid: "링크가 만료됐거나 이미 사용됐어요. 비밀번호 찾기로 새 링크를 받아주세요.",
};

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;
  return <LoginForm linkError={LINK_ERRORS[error] ?? null} />;
}
