import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { isElectron } from "@/lib/fileIO";

// Standard four-color Google "G" mark, used only to label the "Continue with Google" button.
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AuthDialog = ({ open, onOpenChange }: AuthDialogProps) => {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail("");
    setPassword("");
    setMode("signin");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    if (mode === "signup") {
      toast.success("Account created! Check your email if confirmation is required, then sign in.");
      setMode("signin");
    } else {
      toast.success("Signed in!");
      onOpenChange(false);
      reset();
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) toast.error(error);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "signin" ? "Sign In" : "Create Account"}</DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Sign in to save and access your projects from the cloud."
              : "Create an account to start saving projects to the cloud."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Please wait..." : mode === "signin" ? "Sign In" : "Sign Up"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground underline w-full text-center"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </form>

        {!isElectron() && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={handleGoogleSignIn}
            >
              <GoogleIcon className="h-4 w-4" />
              <span>Continue with Google</span>
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
