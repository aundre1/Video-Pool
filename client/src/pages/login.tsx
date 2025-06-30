import { Helmet } from "react-helmet";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export default function Login() {
  const { isAuthenticated } = useAuth();
  
  // Redirect if already logged in
  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return (
    <>
      <Helmet>
        <title>Sign In - VideoPool Pro</title>
        <meta name="description" content="Sign in to your VideoPool Pro account to access premium DJ video content." />
      </Helmet>
      
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-300px)]">
        <Card className="w-full max-w-md bg-dark-card border-dark-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
