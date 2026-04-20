import { useAuth } from "@/hooks/use-auth";
import { AuthPage } from "@/components/auth-page";
import { Dashboard } from "@/components/dashboard";
import { Spinner } from "@/components/ui/spinner";
import { Toaster } from "@/components/ui/sonner";

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <>
      {!user ? <AuthPage /> : <Dashboard user={user} />}
      <Toaster />
    </>
  );
}

export default App;
