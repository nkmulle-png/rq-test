import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
  head: () => ({
    meta: [
      { title: "Signing you in — RDHQ Training Portal" },
      { name: "description", content: "Completing sign-in to the RDHQ Training Portal." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AuthCallbackPage() {
  const { loading, session } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (session) return <Navigate to="/" replace />;
  if (!loading && timedOut) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
