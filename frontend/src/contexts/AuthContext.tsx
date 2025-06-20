import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../config/firebase';
import LoadingSpinner from '../components/LoadingSpinner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      setUser(user);
      setLoading(false);
    });

    // Handle redirect result
    const handleRedirectResult = async () => {
      try {
        console.log('Checking for redirect result...');
        const result = await getRedirectResult(auth);
        console.log('Redirect result:', result);
        
        if (result?.user) {
          const user = result.user;
          console.log('User from redirect:', user.email);
          
          // Check the email domain after redirect sign-in
          if (user.email && user.email.endsWith('@iiitdm.ac.in')) {
            // User is from the correct domain, sign-in is successful
            console.log('Sign-in successful for IIITDM user:', user.email);
          } else {
            // Sign out the user and show error
            console.log('Invalid domain, signing out user');
            await signOut(auth);
            alert('Access Denied: Please sign in with your @iiitdm.ac.in email address.');
          }
        } else {
          console.log('No redirect result found');
        }
      } catch (error: unknown) {
        console.error('Error handling redirect result:', error);
        if (error instanceof Error && error.message.includes('Access restricted to IIITDM')) {
          alert('Access Denied: Please sign in with your @iiitdm.ac.in email address.');
        }
      }
    };

    handleRedirectResult();

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Set the hd (hosted domain) parameter to restrict to iiitdm.ac.in domain
    provider.setCustomParameters({
      hd: 'iiitdm.ac.in'
    });
    
    try {
      // Use signInWithRedirect instead of signInWithPopup to avoid COOP issues
      await signInWithRedirect(auth, provider);
    } catch (error: unknown) {
      console.error('Error signing in with Google:', error);
      
      // Check if it's our custom domain restriction error
      if (error instanceof Error && error.message.includes('Access restricted to IIITDM')) {
        alert('Access Denied: Please sign in with your @iiitdm.ac.in email address.');
      } else {
        alert('Sign-in failed. Please try again.');
      }
      
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingSpinner /> : children}
    </AuthContext.Provider>
  );
};