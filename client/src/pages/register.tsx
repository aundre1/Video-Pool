import { Helmet } from "react-helmet";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export default function Register() {
  const { isAuthenticated } = useAuth();
  
  // Redirect if already logged in
  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return (
    <>
      <Helmet>
        <title>Create Account - VideoPool Pro</title>
        <meta name="description" content="Join VideoPool Pro to access premium DJ video content and elevate your performances." />
      </Helmet>
      
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-300px)]">
        <Card className="w-full max-w-md bg-dark-card border-dark-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
            <CardDescription>
              Join VideoPool Pro and get access to premium content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
