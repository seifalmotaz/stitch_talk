import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ProjectsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/sign-in");

  return children;
}
