import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import appCss from "../styles.css?url";
import logoUrl from "@/assets/logo.svg";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Page not found</p>
        <Link to="/" className="mt-6 inline-block text-primary underline">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RDHQ Training Portal" },
      { name: "description", content: "Personalized training paths and progress tracking for the RDHQ team." },
      { property: "og:title", content: "RDHQ Training Portal" },
      { name: "twitter:title", content: "RDHQ Training Portal" },
      { property: "og:description", content: "Personalized training paths and progress tracking for the RDHQ team." },
      { name: "twitter:description", content: "Personalized training paths and progress tracking for the RDHQ team." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0c0961a8-e991-4c52-a911-34049f82b9e5/id-preview-e9dbbc89--a88dfa6a-27cd-4d3e-ba04-77f1c40379e6.lovable.app-1781281981490.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0c0961a8-e991-4c52-a911-34049f82b9e5/id-preview-e9dbbc89--a88dfa6a-27cd-4d3e-ba04-77f1c40379e6.lovable.app-1781281981490.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Stack+Sans+Text:wght@200..700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  const { appUser, isManager, signOut, session } = useAuth();
  if (!session) return null;
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="RDHQ logo" width={30} height={30} className="h-[30px] w-[30px]" />
          <div>
            <div className="text-sm font-semibold leading-tight">RDHQ</div>
            <div className="text-xs text-muted-foreground leading-tight">Training Portal</div>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          {appUser?.tier !== "Training Not Required" && (
            <Link to="/">
              {({ isActive }) => (
                <Button variant={isActive ? "secondary" : "ghost"} size="sm">My Courses</Button>
              )}
            </Link>
          )}
          {isManager && appUser?.tier !== "Training Not Required" && (
            <Link to="/manager">
              {({ isActive }) => (
                <Button variant={isActive ? "secondary" : "ghost"} size="sm">
                  Manager View
                </Button>
              )}
            </Link>
          )}
          <div className="ml-3 hidden text-right sm:block">
            <div className="text-sm font-medium">{appUser?.name ?? session.user.email}</div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </nav>
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Header />
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
