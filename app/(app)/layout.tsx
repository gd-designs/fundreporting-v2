import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getEntities } from "@/lib/entities";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/notification-bell";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const entities = await getEntities();

  return (
    <SidebarProvider>
      <AppSidebar user={user} entities={entities} />
      <SidebarInset>
        <main className="flex flex-1 flex-col">
          {user.impersonated_by && (
            <ImpersonationBanner name={user.name} email={user.email} />
          )}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 my-auto data-[orientation=vertical]:h-4" />
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
