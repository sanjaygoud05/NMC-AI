import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { z } from 'zod';
import { ClipboardCheck } from 'lucide-react';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254, 'Email must be less than 254 characters')
  .email('Please enter a valid email address');
const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be less than 72 characters');
const nameSchema = z
  .string()
  .trim()
  .max(50, 'Must be less than 50 characters')
  .optional();

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');

  // Redirect if already logged in (after render, in effect)
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error('Validation Error', {
          description: error.errors[0].message,
        });
      }
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      toast.error('Login Failed', {
        description: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.'
          : error.message,
      });
    } else {
      toast.success('Welcome back!', {
        description: 'You have successfully logged in.',
      });
      navigate('/dashboard');
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
      nameSchema.parse(signupFirstName);
      nameSchema.parse(signupLastName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error('Validation Error', {
          description: error.errors[0].message,
        });
      }
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(
      signupEmail.trim(),
      signupPassword,
      signupFirstName.trim(),
      signupLastName.trim(),
    );

    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = 'This email is already registered. Please log in instead.';
      }
      toast.error('Signup Failed', {
        description: message,
      });
    } else {
      toast.success('Account Created', {
        description:
          'Your account has been created. If email confirmation is enabled, check your inbox before signing in.',
      });
      // Navigation happens automatically via the user effect once a session exists.
    }

    setIsLoading(false);
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-background bg-dot-pattern p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-up opacity-0 [animation-fill-mode:forwards]">
        <Card className="border-border bg-card">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 rounded-none bg-primary/10">
                <ClipboardCheck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">Request & Approval Tracker</CardTitle>
            <CardDescription>
              Internal workflow management system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted">
                <TabsTrigger value="login" className="data-[state=active]:bg-card">Login</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-card">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-foreground">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@company.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-foreground">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="bg-input border-border"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname" className="text-foreground">First Name</Label>
                      <Input
                        id="signup-firstname"
                        type="text"
                        placeholder="John"
                        value={signupFirstName}
                        onChange={(e) => setSignupFirstName(e.target.value)}
                        disabled={isLoading}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname" className="text-foreground">Last Name</Label>
                      <Input
                        id="signup-lastname"
                        type="text"
                        placeholder="Doe"
                        value={signupLastName}
                        onChange={(e) => setSignupLastName(e.target.value)}
                        disabled={isLoading}
                        className="bg-input border-border"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-foreground">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@company.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-foreground">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="bg-input border-border"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}