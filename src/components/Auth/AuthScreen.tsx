import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  MessageSquare,
  Lock,
  Mail,
  User,
  Shield,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Info,
  Camera,
  Upload,
  Phone
} from 'lucide-react';
import { validatePhoneNumber } from '../../utils/phone';

export const AuthScreen: React.FC = () => {
  const { login, signup, resetPassword, signInWithGoogle, firebaseProjectId } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedAvatarSeed, setSelectedAvatarSeed] = useState('Alex');
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const authFileInputRef = useRef<HTMLInputElement | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const avatarUrl = customPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedAvatarSeed}`;

  const handleAuthFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;
          ctx.drawImage(img, startX, startY, size, size, 0, 0, 256, 256);
          setCustomPhoto(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsOperationNotAllowed(false);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site or open in a new tab.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in window was closed. Please click below to try again.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setIsOperationNotAllowed(true);
        setError('Google Sign-In is not enabled yet in your Firebase console. Please enable it in Authentication > Sign-in method.');
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsOperationNotAllowed(false);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email || !password) throw new Error('Please enter both email and password.');
        await login(email, password);
      } else if (mode === 'signup') {
        if (!email || !password || !username || !displayName || !phoneNumber.trim()) {
          throw new Error('Please fill in all registration fields. Phone number is compulsory.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        const phoneCheck = validatePhoneNumber(phoneNumber);
        if (!phoneCheck.isValid) {
          throw new Error(phoneCheck.error || 'Please enter a valid phone number with country code.');
        }
        await signup(email, password, username, displayName, phoneCheck.formatted, avatarUrl);
      } else if (mode === 'forgot') {
        if (!email) throw new Error('Please enter your email to receive a password reset link.');
        await resetPassword(email);
        setSuccessMsg('Password reset link sent to your email.');
      }
    } catch (err: any) {
      const errCode = err?.code || '';
      const errMsg = err?.message || '';

      if (errCode === 'auth/operation-not-allowed' || errMsg.includes('auth/operation-not-allowed') || errMsg.includes('operation-not-allowed')) {
        setIsOperationNotAllowed(true);
        setError('Email/Password authentication is disabled by default in newly provisioned Firebase projects. Please use "Continue with Google" above, or enable Email/Password in your Firebase Console.');
      } else if (errMsg.includes('auth/invalid-credential') || errMsg.includes('auth/wrong-password') || errMsg.includes('auth/user-not-found')) {
        setError('Invalid email or password combination.');
      } else if (errMsg.includes('auth/email-already-in-use')) {
        setError('This email is already registered. Please login instead.');
      } else if (errMsg.includes('auth/weak-password')) {
        setError('Password is too weak. Please use at least 6 characters.');
      } else if (errMsg.includes('auth/invalid-email')) {
        setError('Please enter a valid email address.');
      } else {
        setError(errMsg || 'Authentication error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const consoleProvidersUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-red-950/40 relative overflow-hidden">
      {/* Decorative backdrop blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* App Logo & Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/30 mb-3 ring-4 ring-blue-500/40 bg-neutral-950 group hover:scale-105 transition-transform">
            <img
              src="/logo.png"
              alt="CHATCON Logo"
              className="w-full h-full object-cover scale-[1.05] origin-center"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1
            className="text-3xl font-extrabold tracking-wider text-white flex items-center justify-center"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <span className="text-white drop-shadow-sm">CHAT</span>
            <span className="bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 bg-clip-text text-transparent drop-shadow-sm ml-0.5">
              CON
            </span>
            <span className="ml-2.5 text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-sky-300 font-semibold border border-blue-500/30 tracking-normal align-middle">
              Live
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1.5 font-medium">
            Next-gen messaging, private rooms, groups & HD calls
          </p>
        </div>

        {/* 1-Click Google Sign In (Configured by AI Studio Firebase provisioning) */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 bg-white hover:bg-neutral-100 text-neutral-900 font-semibold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 border border-neutral-200 disabled:opacity-50 active:scale-[0.98]"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-neutral-900/30 border-t-neutral-900 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            )}
            <span className="text-sm">Continue with Google</span>
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-neutral-800" />
            <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
              or use email
            </span>
            <div className="flex-1 h-px bg-neutral-800" />
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-neutral-950/60 p-1 rounded-xl border border-neutral-800 mb-5">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setIsOperationNotAllowed(false); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); setIsOperationNotAllowed(false); setSuccessMsg(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Informative Callout for auth/operation-not-allowed */}
        {isOperationNotAllowed && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Email/Password Auth Disabled</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/90">
              Firebase projects provisioned in AI Studio enable <strong>Google Sign-In</strong> by default.
            </p>
            <div className="pt-1 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <span>Sign In with Google Instead</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <a
                href={consoleProvidersUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 text-[11px] text-amber-300 hover:underline pt-1"
              >
                <span>Enable Email/Password in Firebase Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Standard Errors */}
        {error && !isOperationNotAllowed && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <>
              {/* Avatar Selector */}
              <input
                type="file"
                ref={authFileInputRef}
                accept="image/*"
                onChange={handleAuthFileUpload}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="relative group">
                  <img
                    src={avatarUrl}
                    alt="Avatar Preview"
                    className="w-20 h-20 rounded-full border-2 border-red-500 bg-neutral-800 p-1 object-cover shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => authFileInputRef.current?.click()}
                    className="absolute -bottom-1 -left-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 p-1.5 rounded-full shadow border border-neutral-700 transition-all"
                    title="Upload Custom Photo"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPhoto(null);
                      setSelectedAvatarSeed(Math.random().toString(36).substring(7));
                    }}
                    className="absolute -bottom-1 -right-1 bg-red-500 hover:bg-red-400 text-neutral-950 p-1.5 rounded-full shadow transition-all"
                    title="Generate New Avatar"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                  <button
                    type="button"
                    onClick={() => authFileInputRef.current?.click()}
                    className="text-red-400 hover:underline font-medium"
                  >
                    Upload Photo
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPhoto(null);
                      setSelectedAvatarSeed(Math.random().toString(36).substring(7));
                    }}
                    className="text-neutral-400 hover:text-white"
                  >
                    Random Avatar
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Vance"
                    className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-semibold">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alexvance"
                    className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl pl-8 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 lowercase"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-neutral-300">
                    Phone Number <span className="text-red-400 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">
                    Compulsory
                  </span>
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 555-019-2834"
                    className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  Visible to other users for direct calls & contact sync. Include country code.
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-neutral-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); setIsOperationNotAllowed(false); setSuccessMsg(null); }}
                    className="text-[11px] text-red-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-950/70 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-neutral-700 text-red-600 focus:ring-red-500 bg-neutral-950"
              />
              <label htmlFor="remember" className="ml-2 text-[11px] text-neutral-400">
                Remember logged in session
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === 'login' ? (
              'Log In with Email'
            ) : mode === 'signup' ? (
              'Create Account with Email'
            ) : (
              'Send Password Reset Link'
            )}
          </button>
        </form>

        {mode === 'forgot' && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
