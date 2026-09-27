import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload as reloadFirebaseUser,
  sendEmailVerification as sendFirebaseEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as signOutFirebaseUser
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import { ServiceError } from '../lib/errors';
import { mapAuthError } from './authErrors';
import type { AuthAdapter, AuthStateListener, AuthUser } from './authAdapter';

/**
 * Firebase Authentication adapter — the single production auth backend.
 *
 * Rules enforced here:
 * - Firebase is only touched lazily (inside methods), so importing this module
 *   never initializes an app, opens a connection or throws when the env is
 *   missing.
 * - React pages never import this file; they go through context -> service.
 * - Every SDK rejection is normalized by `mapAuthError` before leaving.
 * - Sessions persist through Firebase's own storage (browser local persistence);
 *   this file never writes credentials or tokens itself.
 */
function toAuthUser(user: FirebaseUser): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified
  };
}

function requireCurrentUser(): FirebaseUser {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new ServiceError('auth/no-current-user', 'Sign in to continue.');
  }
  return user;
}

export const firebaseAuthAdapter: AuthAdapter = {
  subscribe(listener: AuthStateListener): () => void {
    try {
      return onAuthStateChanged(
        getFirebaseAuth(),
        user => listener(user ? toAuthUser(user) : null),
        // Auth errors must never leave the UI spinning: resolve as signed out.
        () => listener(null)
      );
    } catch (error) {
      // Not configured (build without VITE_FIREBASE_*): resolve as signed out.
      void error;
      listener(null);
      return () => undefined;
    }
  },

  getCurrentUser(): AuthUser | null {
    try {
      const user = getFirebaseAuth().currentUser;
      return user ? toAuthUser(user) : null;
    } catch {
      return null;
    }
  },

  async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      return toAuthUser(credential.user);
    } catch (error) {
      throw mapAuthError(error);
    }
  },

  async signUp(email: string, password: string): Promise<AuthUser> {
    try {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      return toAuthUser(credential.user);
    } catch (error) {
      throw mapAuthError(error);
    }
  },

  async signOut(): Promise<void> {
    try {
      await signOutFirebaseUser(getFirebaseAuth());
    } catch (error) {
      throw mapAuthError(error);
    }
  },

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
    } catch (error) {
      throw mapAuthError(error);
    }
  },

  async sendEmailVerification(): Promise<void> {
    try {
      await sendFirebaseEmailVerification(requireCurrentUser());
    } catch (error) {
      throw mapAuthError(error);
    }
  },

  async reloadUser(): Promise<AuthUser> {
    try {
      const user = requireCurrentUser();
      await reloadFirebaseUser(user);
      return toAuthUser(user);
    } catch (error) {
      throw mapAuthError(error);
    }
  }
};
