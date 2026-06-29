import type { Metadata } from "next";
import "./globals.css";
import { getAuth, isAdmin } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Grey World Cup Predictions",
  description: "Internal World Cup prediction league",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuth();

  return (
    <html lang="en">
      <body className="min-h-screen">
        {auth && (
          <Nav
            fullName={auth.profile?.full_name ?? null}
            email={auth.email}
            isAdmin={isAdmin(auth)}
          />
        )}
        <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
