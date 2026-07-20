import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import ssoIllustration from "@/assets/sso-illustration.svg";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in — RDHQ Training Portal" },
      { name: "description", content: "Sign in to access your personalized training path." },
    ],
  }),
});

function LoginPage() {
  const { session, loading, signInGoogle } = useAuth();
  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (session) return <Navigate to="/" />;

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Left panel */}
      <div className="relative flex flex-col overflow-hidden bg-[#D8E4F4] p-10 md:p-14">
        <div>
          <span className="inline-block rounded-full bg-white/70 px-4 py-2 text-xs tracking-widest text-foreground/70">
            2026 TRAINING CYCLE
          </span>
        </div>

        <div className="mt-10">
          <div className="mb-3 text-3xl font-semibold text-[#1B4CA1] md:text-4xl">RDHQ</div>
          <h1 className="whitespace-pre-line font-semibold leading-[1.05] tracking-tight text-foreground" style={{ fontSize: "4.5rem" }}>
            {"Training\u00a0\nPortal"}
          </h1>
        </div>

        <div className="mt-auto flex flex-1 items-end justify-center pt-10">
          <img
            src={ssoIllustration}
            alt=""
            className="w-full max-w-xl animate-[fade-in_0.7s_ease-out_0.1s_both]"
          />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center bg-background px-8 py-12 md:px-16">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Build your{"\n"}learning path.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Sign in with your WebMD Google account to access your training path, commit to courses, and track progress.
          </p>
          <Button onClick={signInGoogle} className="mt-8 h-11 w-full text-base" size="lg">
            <GoogleIcon />
            Continue with Google
          </Button>
          <p className="mt-6 text-xs text-muted-foreground">
            By signing in you agree to RDHQ's internal acceptable use policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
      <path fill="#FFC107" d="M21.8 10.2H12v3.8h5.6c-.5 2.5-2.6 4-5.6 4-3.4 0-6.2-2.8-6.2-6.2S8.6 5.6 12 5.6c1.5 0 2.9.5 4 1.5L18.7 4.4C16.9 2.9 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.4-.2-2.1Z" />
      <path fill="#FF3D00" d="m3.2 7.3 3.1 2.3c.9-1.7 2.6-3 4.7-3 1.5 0 2.9.5 4 1.5L18.7 4.4C16.9 2.9 14.6 2 12 2 8.1 2 4.7 4.2 3.2 7.3Z" />
      <path fill="#4CAF50" d="M12 22c2.6 0 4.9-.9 6.6-2.4l-3-2.5c-1 .7-2.2 1.1-3.6 1.1-3 0-5.1-1.5-5.6-4l-3 2.3C4.7 19.8 8.1 22 12 22Z" />
      <path fill="#1976D2" d="M21.8 10.2H12v3.8h5.6c-.3 1.2-1 2.3-2 3.1l3 2.5c-.2.2 3.2-2.4 3.2-7.3 0-.7-.1-1.4-.2-2.1Z" />
    </svg>
  );
}
