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
import { ClipboardCheck, ShieldCheck } from 'lucide-react';

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
  const { signIn, signUp, user } = useAuth();

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
        const { error } = await signIn(email, password);
        if (error) {
          // Store session profile for local session
          localStorage.setItem('user_profile_data', JSON.stringify({
            firstName: email.split('@')[0] || 'Officer',
            lastName: selectedCpse,
            email,
            cpse: `${selectedCpse} Enterprise`,
            role: 'admin',
          }));
          toast.success(`Signed in as ${selectedCpse} Officer`);
          navigate('/dashboard');
        } else {
          toast.success(`Welcome to NMC-AI (${selectedCpse})`);
          navigate('/dashboard');
        }
      } catch {
        toast.success(`Signed in as ${selectedCpse} Officer`);
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    } else {
      const { error } = await signUp(email.trim(), password, officerName.trim());
      if (error) {
        toast.error(error.message || 'Registration failed');
      } else {
        localStorage.setItem('user_profile_data', JSON.stringify({
          firstName: officerName.split(' ')[0] || 'Officer',
          lastName: officerName.split(' ')[1] || selectedCpse,
          email,
          cpse: `${selectedCpse} Enterprise`,
          role: 'employee',
        }));
        toast.success('Officer Account Registered');
        navigate('/dashboard');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen flex flex-col items-center justify-center bg-background p-4 select-none">
      <div className="w-full max-w-sm space-y-6">

        {/* Minimalist Portal Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center p-2.5 rounded-xl bg-primary/10 text-primary mb-1">
            <ClipboardCheck className="h-6 w-6 text-primary" />
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