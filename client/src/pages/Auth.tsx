import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { z } from 'zod';
import { ShieldCheck } from 'lucide-react';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters');

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, user } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [selectedCpse, setSelectedCpse] = useState('ONGC');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      setIsLoading(false);
      return;
    }

    if (isLogin) {
      try {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          if (error.message?.toLowerCase().includes('invalid login credentials')) {
            toast.error('Account not found with these credentials. Click "Register New Officer Credentials" below to create it first.');
          } else {
            toast.error(error.message || 'Invalid email or password');
          }
        } else {
          toast.success(`Welcome to NMC-AI (${selectedCpse})`);
          navigate('/dashboard');
        }
      } catch {
        toast.error('Sign in failed. Please check your credentials or network.');
      } finally {
        setIsLoading(false);
      }
    } else {
      const nameParts = officerName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || selectedCpse;

      try {
        const { error } = await signUp(email.trim(), password, firstName, lastName);
        if (error) {
          toast.error(error.message || 'Registration failed');
        } else {
          toast.success(`Account created! Welcome to NMC-AI (${selectedCpse})`);
          navigate('/dashboard');
        }
      } catch {
        toast.error('Registration failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message || 'Google sign-in failed. Please ensure Google provider is enabled in Supabase.');
        setIsLoading(false);
      }
    } catch {
      toast.error('Unable to initiate Google sign-in. Check your connection.');
      setIsLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen flex flex-col items-center justify-center bg-background p-4 select-none">
      <div className="w-full max-w-sm space-y-6">

        {/* Portal Header with NMC Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-1">
            <img
              src="/favicon.png"
              alt="NMC Logo"
              className="h-28 w-28 object-contain drop-shadow-lg"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            NMC-AI
          </h1>
          <p className="text-xs text-muted-foreground">
            National Material Catalog • Officer Portal
          </p>
        </div>

        {/* Clean Officer Authentication Card */}
        <Card className="border-border bg-card shadow-lg rounded-xl overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3.5">

              {/* Enterprise CPSE Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="cpse" className="text-xs font-medium text-foreground">
                  Enterprise CPSE Organization
                </Label>
                <Select value={selectedCpse} onValueChange={setSelectedCpse}>
                  <SelectTrigger className="h-10 text-xs bg-muted/30 border-border">
                    <SelectValue placeholder="Select Enterprise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONGC">ONGC — Oil and Natural Gas Corp</SelectItem>
                    <SelectItem value="IOCL">IOCL — Indian Oil Corporation Ltd</SelectItem>
                    <SelectItem value="HPCL">HPCL — Hindustan Petroleum Corp Ltd</SelectItem>
                    <SelectItem value="CPCL">CPCL — Chennai Petroleum Corp Ltd</SelectItem>
                    <SelectItem value="BPCL">BPCL — Bharat Petroleum Corp Ltd</SelectItem>
                    <SelectItem value="GAIL">GAIL — Gas Authority of India Ltd</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="officerName" className="text-xs font-medium text-foreground">
                    Officer Full Name
                  </Label>
                  <Input
                    id="officerName"
                    type="text"
                    placeholder="Enter full name"
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-10 text-xs bg-muted/30 border-border"
                  />
                </div>
              )}

              {/* Official Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-foreground">
                  Official Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@enterprise.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-10 text-xs bg-muted/30 border-border"
                />
              </div>

              {/* Security Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-foreground">
                    Password
                  </Label>
                  {isLogin && (
                    <span className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                      Forgot?
                    </span>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-10 text-xs bg-muted/30 border-border"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-10 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all mt-3"
                disabled={isLoading}
              >
                {isLoading
                  ? 'Verifying...'
                  : isLogin
                  ? `Sign In as ${selectedCpse} Officer`
                  : 'Register Officer Account'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border/60"></div>
              <span className="flex-shrink mx-2 text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-border/60"></div>
            </div>

            {/* Continue with Google */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-10 text-xs font-medium border-border/80 hover:bg-muted/40 hover:text-foreground text-foreground transition-all flex items-center justify-center gap-2.5"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>

            {/* Toggle Sign In / Register */}
            <div className="text-center pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setEmail('');
                  setPassword('');
                  setOfficerName('');
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isLogin
                  ? 'Register New Officer Credentials'
                  : 'Already registered? Sign in as Officer'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Minimal Footer */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Ministry of Petroleum & Natural Gas • CPSE Gateway</span>
        </div>

      </div>
    </div>
  );
}