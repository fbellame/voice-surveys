import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  BarChart3, 
  Phone, 
  Settings, 
  Users, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: "campaigns" | "calls" | "settings";
}

export function Layout({ children, currentPage }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: "Campaigns", href: "/campaigns", icon: BarChart3, current: currentPage === "campaigns" },
    { name: "Calls & Answers", href: "/calls", icon: Phone, current: currentPage === "calls" },
    { name: "Settings", href: "/settings", icon: Settings, current: currentPage === "settings" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
        <div className="fixed left-0 top-0 h-full w-64 bg-card border-r shadow-elegant">
          <div className="flex h-16 items-center justify-between px-6">
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              VoiceSurvey
            </h1>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <SidebarContent navigation={navigation} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col bg-card border-r shadow-card">
          <div className="flex h-16 items-center px-6">
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              VoiceSurvey
            </h1>
          </div>
          <SidebarContent navigation={navigation} />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b bg-card/80 backdrop-blur px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1" />
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <Button variant="outline" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  AD
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  navigation: Array<{
    name: string;
    href: string;
    icon: any;
    current: boolean;
  }>;
}

function SidebarContent({ navigation }: SidebarContentProps) {
  return (
    <nav className="flex flex-1 flex-col px-6 py-4">
      <ul className="flex flex-1 flex-col gap-y-2">
        {navigation.map((item) => (
          <li key={item.name}>
            <a
              href={item.href}
              className={cn(
                "group flex gap-x-3 rounded-md p-3 text-sm font-medium transition-all duration-200",
                item.current
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        <div className="rounded-lg bg-gradient-card p-4 border">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm font-medium">Survey Admin</p>
              <p className="text-xs text-muted-foreground">Manage campaigns</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}