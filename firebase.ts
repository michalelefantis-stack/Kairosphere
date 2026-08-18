import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';

/**
 * Firebase, for authentication and nothing else.
 *
 * A Firestore handle used to be exported here. Nothing ever imported it — no
 * read, no write, no listener anywhere in the app — so it did two harmful
 * things and no useful one: it pulled the Firestore SDK into the main bundle,
 * and it left a database reachable from a client that had no business
 * touching it. See firestore.rules, which denies everything for the same
 * reason.
 */

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
