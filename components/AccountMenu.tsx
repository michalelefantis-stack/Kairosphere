import React, { useState, useEffect } from 'react';
import { Mail, LogOut, ChevronLeft, Moon, Sun, Globe } from 'lucide-react';
import { auth, googleProvider, appleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { useLanguage } from '../LanguageContext';

interface AccountMenuProps {
  onClose: () => void;
}

const AccountMenu: React.FC<AccountMenuProps> = ({ onClose }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLightMode, setIsLightMode] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    setIsLightMode(document.documentElement.classList.contains('light-mode'));
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('light-mode')) {
      html.classList.remove('light-mode');
      setIsLightMode(false);
      localStorage.setItem('kairos_theme', 'dark');
    } else {
      html.classList.add('light-mode');
      setIsLightMode(true);
      localStorage.setItem('kairos_theme', 'light');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setIsLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Error signing in with Google:", err);
      setError(err.message || "Failed to sign in with Google.");
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setError(null);
      setIsLoading(true);
      await signInWithPopup(auth, appleProvider);
    } catch (err: any) {
      console.error("Error signing in with Apple:", err);
      setError(err.message || "Failed to sign in with Apple.");
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut(auth);
      onClose();
    } catch (err) {
      console.error("Error signing out:", err);
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="bg-panel/95 backdrop-blur-xl border border-line rounded-2xl w-full shadow-2xl overflow-hidden pointer-events-auto">
        <div className="p-5 border-b border-line-soft flex justify-between items-center bg-transparent">
          <h2 className="text-sm font-black uppercase tracking-widest text-ink">Account</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x w-5 h-5" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
          </button>
        </div>
        
        <div className="p-7 space-y-7">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : user ? (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="w-24 h-24 rounded-full border-2 border-accent overflow-hidden bg-raised mx-auto p-1.5">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-hover flex items-center justify-center text-ink-faint text-3xl font-bold">
                      {(user.displayName || user.email || "U")[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-ink">{user.displayName || "Explorer"}</h3>
                  <p className="text-sm text-ink-dim">{user.email}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-line-soft space-y-3">
                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 bg-raised text-red-400 font-bold py-3 px-4 rounded-xl border border-line-hard hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-full border border-line-hard overflow-hidden bg-raised mx-auto mb-4 p-1.5">
                  <div className="w-full h-full rounded-full bg-hover flex items-center justify-center text-ink-faint">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-black text-ink leading-tight">Sign in to Kairosphere</h3>
                <p className="text-xs text-ink-dim leading-snug px-4 mb-2">Save your favorite cultural events, create itineraries, and sync across devices.</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs text-center">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <button 
                  onClick={handleAppleSignIn}
                  className="w-full flex items-center justify-center gap-3 bg-white text-on-accent text-sm font-bold py-3.5 px-4 rounded-xl hover:bg-hover transition-colors shadow-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.31-.88 3.5-.84 1.5.05 2.78.76 3.51 1.92-3.14 1.88-2.65 6.1.48 7.33-.76 1.74-1.63 3.3-2.57 3.76zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.36 2.4-2.04 4.45-3.74 4.25z"></path></svg>
                  Continue with Apple
                </button>
                <button 
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 bg-raised text-ink text-sm font-bold py-3.5 px-4 rounded-xl border border-line-hard hover:bg-hover transition-colors shadow-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path><path d="M1 1h22v22H1z" fill="none"></path></svg>
                  Continue with Google
                </button>
                <button 
                  onClick={() => alert("Email sign-in coming soon!")}
                  className="w-full flex items-center justify-center gap-3 bg-raised text-ink text-sm font-bold py-3.5 px-4 rounded-xl border border-line-hard hover:bg-hover transition-colors shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail w-5 h-5" aria-hidden="true"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"></path><rect x="2" y="4" width="20" height="16" rx="2"></rect></svg>
                  Continue with Email
                </button>
              </div>
              
              <div className="pt-4 border-t border-line-soft text-center">
                <p className="text-[12px] text-ink-faint">By continuing, you agree to our <a href="#" className="text-accent hover:underline">Terms of Service</a> and <a href="#" className="text-accent hover:underline">Privacy Policy</a>.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AccountMenu;
