import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Mail, BarChart3 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate login process
    setTimeout(() => {
      setIsLoading(false);
      // Redirect to lessons page
      window.location.href = "/lessons";
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-elegant border-0">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto rounded-full bg-gradient-primary p-3 w-fit">
            <BarChart3 className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Welcome to VoiceSurvey</CardTitle>
            <CardDescription className="mt-2">
              Sign in to manage your lessons
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? "Sending magic link..." : "Send Magic Link"}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              We'll send you a secure login link to your email
            </p>
          </div>

          <div className="border-t pt-6">
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">Demo credentials for testing:</p>
              <p className="text-xs font-mono bg-muted p-2 rounded">
                admin@voicesurvey.demo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}