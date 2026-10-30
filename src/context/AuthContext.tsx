import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  deleteUser,
  onAuthStateChanged,
  updateProfile as updateAuthProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  deleteDoc,
  limit,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, PrivacySettings } from '../types';
import { validatePhoneNumber } from '../utils/phone';
import firebaseConfigData from '../../firebase-applet-config.json';

const DEFAULT_PRIVACY: PrivacySettings = {
  lastSeen: 'everyone',
  profilePhoto: 'everyone',
  about: 'everyone',
  readReceipts: true,
  onlineStatus: 'everyone'
};

const MASTER_ADMIN_EMAIL = 'sollu.samithpriyanonline@gmail.com';
export const ADMIN_MASTER_PASSWORD = 'nani2002242yyoll&';

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  blockedUserIds: string[];
  firebaseProjectId: string;
  signInWithGoogle: () => Promise<void>;
  signup: (email: string, pass: string, username: string, displayName: string, phoneNumber: string, avatarUrl?: string) => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfileDetails: (data: Partial<UserProfile>) => Promise<void>;
  savePhoneNumber: (phoneNumber: string) => Promise<{ success: boolean; error?: string }>;
  checkUsernameAvailability: (username: string) => Promise<boolean>;
  updateUsername: (username: string) => Promise<{ success: boolean; error?: string }>;
  deleteUserAccount: () => Promise<void>;
  blockUser: (targetUid: string) => Promise<void>;
  unblockUser: (targetUid: string) => Promise<void>;
  toggleContact: (targetUid: string) => Promise<void>;
  verifyAdminPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  lockAdminSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Subscribe to user doc in Firestore
        const userRef = doc(db, 'users', user.uid);
        const unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);

            const isMaster = user.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
            const sessionUnlocked = typeof window !== 'undefined' &&
              (sessionStorage.getItem('chatconnect_admin_unlocked') === 'true' || localStorage.getItem('chatconnect_admin_unlocked') === 'true');
            const hasAdminRole = data.role === 'admin' || isMaster || sessionUnlocked;
            setIsAdmin(hasAdminRole);

            // Ensure master admin record in admins collection
            if (isMaster) {
              const adminRef = doc(db, 'admins', user.uid);
              const adminSnap = await getDoc(adminRef);
              if (!adminSnap.exists()) {
                await setDoc(adminRef, { uid: user.uid, email: user.email, grantedAt: Date.now() });
              }
            }
          } else {
            // Profile doesn't exist yet (first-time signin with Google or Email)
            const cleanBase = (user.email?.split('@')[0] || `user_${user.uid.slice(0, 5)}`)
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '');
            const isMaster = user.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              username: cleanBase || `user_${user.uid.slice(0, 6)}`,
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
              about: 'Hey there! I am using Chatcon.',
              isOnline: true,
              lastSeen: Date.now(),
              createdAt: Date.now(),
              role: isMaster ? 'admin' : 'user',
              phoneNumber: user.phoneNumber || '',
              privacySettings: DEFAULT_PRIVACY,
              allowSearchByUsername: true,
              savedContactIds: []
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
            setIsAdmin(isMaster);

            if (isMaster) {
              await setDoc(doc(db, 'admins', user.uid), {
                uid: user.uid,
                email: user.email,
                grantedAt: Date.now()
              });
            }
          }
        }, (error) => {
          console.warn('Profile listener notice:', error.message);
        });

        // Track online status
        await updateDoc(userRef, {
          isOnline: true,
          lastSeen: Date.now()
        }).catch(() => {});

        // Fetch Blocked users list
        const blockedQuery = query(collection(db, 'blockedUsers'), where('userId', '==', user.uid));
        const unsubscribeBlocked = onSnapshot(blockedQuery, (snapshot) => {
          const ids = snapshot.docs.map((d) => d.data().blockedUserId as string);
          setBlockedUserIds(ids);
        }, (error) => {
          console.warn('Blocked users listener notice:', error.message);
        });

        setLoading(false);

        return () => {
          unsubscribeProfile();
          unsubscribeBlocked();
        };
      } else {
        setProfile(null);
        setIsAdmin(false);
        setBlockedUserIds([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Presence handlers (unload / visibility)
  useEffect(() => {
    if (!currentUser) return;

    const handleVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      const userRef = doc(db, 'users', currentUser.uid);
      updateDoc(userRef, {
        isOnline: isVisible,
        lastSeen: Date.now()
      }).catch(() => {});
    };

    const handleBeforeUnload = () => {
      const userRef = doc(db, 'users', currentUser.uid);
      updateDoc(userRef, {
        isOnline: false,
        lastSeen: Date.now()
      }).catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const signup = async (
    email: string,
    pass: string,
    rawUsername: string,
    displayName: string,
    rawPhoneNumber: string,
    avatarUrl?: string
  ) => {
    const cleanUsername = rawUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) throw new Error('Please provide a valid alphanumeric username');

    const phoneValidation = validatePhoneNumber(rawPhoneNumber);
    if (!phoneValidation.isValid) {
      throw new Error(phoneValidation.error || 'Please provide a valid phone number.');
    }

    // Create Firebase Auth user first
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const photo = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;
    
    await updateAuthProfile(cred.user, {
      displayName: displayName.trim(),
      photoURL: photo
    });

    const isMaster = email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    const userProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      username: cleanUsername,
      displayName: displayName.trim(),
      phoneNumber: phoneValidation.formatted,
      photoURL: photo,
      about: 'Hey there! I am using Chatcon.',
      isOnline: true,
      lastSeen: Date.now(),
      createdAt: Date.now(),
      role: isMaster ? 'admin' : 'user',
      privacySettings: DEFAULT_PRIVACY,
      allowSearchByUsername: true,
      savedContactIds: []
    };

    await setDoc(doc(db, 'users', cred.user.uid), userProfile);
    if (isMaster) {
      await setDoc(doc(db, 'admins', cred.user.uid), {
        uid: cred.user.uid,
        email,
        grantedAt: Date.now()
      });
    }
  };

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          isOnline: false,
          lastSeen: Date.now()
        });
      } catch {
        // Ignore error on signout
      }
    }
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateProfileDetails = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, data);
    if (data.displayName || data.photoURL) {
      await updateAuthProfile(currentUser, {
        displayName: data.displayName ?? currentUser.displayName,
        photoURL: data.photoURL ?? currentUser.photoURL
      });
    }

    // Sync participant details in active private chats so the other participant sees the updated name/photo/username immediately
    if (data.displayName || data.photoURL !== undefined || data.username) {
      try {
        const chatsQuery = query(
          collection(db, 'privateChats'),
          where('participants', 'array-contains', currentUser.uid)
        );
        const chatSnap = await getDocs(chatsQuery);
        if (!chatSnap.empty) {
          const batch = writeBatch(db);
          chatSnap.forEach((chatDoc) => {
            const cData = chatDoc.data();
            const currentDetails = cData.participantDetails?.[currentUser.uid] || {};
            batch.update(chatDoc.ref, {
              [`participantDetails.${currentUser.uid}`]: {
                ...currentDetails,
                displayName: data.displayName ?? profile?.displayName ?? currentUser.displayName ?? 'User',
                username: data.username ?? profile?.username ?? 'user',
                photoURL: data.photoURL !== undefined ? data.photoURL : (profile?.photoURL || '')
              }
            });
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn('Sync participantDetails notice:', err);
      }
    }
  };

  const savePhoneNumber = async (rawPhone: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Not authenticated' };
    const validation = validatePhoneNumber(rawPhone);
    if (!validation.isValid) {
      return { success: false, error: validation.error || 'Please enter a valid phone number.' };
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        phoneNumber: validation.formatted
      });
      return { success: true };
    } catch (err: any) {
      console.error('Failed to save phone number:', err);
      return { success: false, error: err.message || 'Failed to update phone number' };
    }
  };

  const checkUsernameAvailability = async (rawUsername: string): Promise<boolean> => {
    const clean = rawUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || clean.length < 3) return false;
    if (profile && profile.username.toLowerCase() === clean) return true;
    const q = query(collection(db, 'users'), where('username', '==', clean), limit(1));
    const snap = await getDocs(q);
    return snap.empty || snap.docs[0].id === currentUser?.uid;
  };

  const updateUsername = async (rawUsername: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Not authenticated' };
    const clean = rawUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean || clean.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters (letters, numbers, underscores).' };
    }
    if (clean.length > 25) {
      return { success: false, error: 'Username cannot exceed 25 characters.' };
    }
    if (profile?.username === clean) {
      return { success: true };
    }
    const isAvail = await checkUsernameAvailability(clean);
    if (!isAvail) {
      return { success: false, error: `@${clean} is already taken. Please choose another username.` };
    }
    await updateProfileDetails({ username: clean });
    return { success: true };
  };

  const deleteUserAccount = async () => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    await deleteDoc(doc(db, 'users', uid));
    await deleteUser(currentUser);
  };

  const blockUser = async (targetUid: string) => {
    if (!currentUser || targetUid === currentUser.uid) return;
    const blockId = `${currentUser.uid}_${targetUid}`;
    await setDoc(doc(db, 'blockedUsers', blockId), {
      userId: currentUser.uid,
      blockedUserId: targetUid,
      createdAt: Date.now()
    });
  };

  const unblockUser = async (targetUid: string) => {
    if (!currentUser) return;
    const blockId = `${currentUser.uid}_${targetUid}`;
    await deleteDoc(doc(db, 'blockedUsers', blockId));
  };

  const toggleContact = async (targetUid: string) => {
    if (!currentUser || targetUid === currentUser.uid) return;
    const currentContacts = profile?.savedContactIds || [];
    const updated = currentContacts.includes(targetUid)
      ? currentContacts.filter((id) => id !== targetUid)
      : [...currentContacts, targetUid];

    await updateProfileDetails({ savedContactIds: updated });
  };

  const verifyAdminPassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (password.trim() === ADMIN_MASTER_PASSWORD) {
      setIsAdmin(true);
      try {
        sessionStorage.setItem('chatconnect_admin_unlocked', 'true');
        localStorage.setItem('chatconnect_admin_unlocked', 'true');
      } catch {}

      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, { role: 'admin' });

          const adminRef = doc(db, 'admins', currentUser.uid);
          await setDoc(adminRef, {
            uid: currentUser.uid,
            email: currentUser.email || 'admin',
            grantedAt: Date.now(),
          }, { merge: true });
        } catch (err) {
          console.warn('Admin role assignment notice:', err);
        }
      }
      return { success: true };
    } else {
      return { success: false, error: 'Incorrect administrator password. Access denied.' };
    }
  };

  const lockAdminSession = () => {
    try {
      sessionStorage.removeItem('chatconnect_admin_unlocked');
      localStorage.removeItem('chatconnect_admin_unlocked');
    } catch {}

    const isMaster = currentUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
    if (!isMaster && profile?.role !== 'admin') {
      setIsAdmin(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        isAdmin,
        loading,
        blockedUserIds,
        firebaseProjectId: firebaseConfigData.projectId,
        signInWithGoogle,
        signup,
        login,
        logout,
        resetPassword,
        updateProfileDetails,
        savePhoneNumber,
        checkUsernameAvailability,
        updateUsername,
        deleteUserAccount,
        blockUser,
        unblockUser,
        toggleContact,
        verifyAdminPassword,
        lockAdminSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
