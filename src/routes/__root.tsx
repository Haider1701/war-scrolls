import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="j-page p-10 text-center max-w-md">
        <h1 className="j-h text-6xl">404</h1>
        <p className="mt-3 text-[var(--color-muted)]">This page has been lost to the embers.</p>
        <a href="/" className="j-btn inline-block mt-6">Return to the Journal</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="j-page p-10 text-center max-w-md">
        <h1 className="j-h text-2xl">The fire flickers&hellip;</h1>
        <p className="mt-3 text-[var(--color-muted)]">{error.message}</p>
        <button onClick={reset} className="j-btn mt-6">Rekindle</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dnd Journals" },
      { name: "description", content: "A handcrafted dark-fantasy journal for your D&D character — track stats, spells, sessions, NPCs and gear." },
      { property: "og:title", content: "Dnd Journals" },
      { name: "twitter:title", content: "Dnd Journals" },
      { property: "og:description", content: "A handcrafted dark-fantasy journal for your D&D character — track stats, spells, sessions, NPCs and gear." },
      { name: "twitter:description", content: "A handcrafted dark-fantasy journal for your D&D character — track stats, spells, sessions, NPCs and gear." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dee4d4a6-cb41-4236-9da6-d5ae4484165f/id-preview-78168b69--a3d6a824-05eb-47e1-b6fc-b8c53439ea0a.lovable.app-1782747667146.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dee4d4a6-cb41-4236-9da6-d5ae4484165f/id-preview-78168b69--a3d6a824-05eb-47e1-b6fc-b8c53439ea0a.lovable.app-1782747667146.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Uncial+Antiqua&family=IM+Fell+English:ital@0;1&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
