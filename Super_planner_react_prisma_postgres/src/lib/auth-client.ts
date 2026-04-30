import { api, type AppSession, type AppUser } from "@/lib/api";

type SessionListener = (session: AppSession | null) => void;

const listeners = new Set<SessionListener>();
let cachedSession: AppSession | null | undefined;

function emitSession(session: AppSession | null) {
  cachedSession = session;
  for (const listener of listeners) {
    listener(session);
  }
}

export type { AppSession, AppUser };

export async function getSession(): Promise<AppSession | null> {
  const session = await api.auth.getSession();
  emitSession(session);
  return session;
}

export function subscribeToSession(listener: SessionListener) {
  listeners.add(listener);
  if (cachedSession !== undefined) {
    listener(cachedSession);
  }
  return () => {
    listeners.delete(listener);
  };
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  const user = await api.auth.signIn(email, password);
  emitSession({ user });
  return user;
}

export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<AppUser> {
  const user = await api.auth.signUp(email, password, fullName);
  emitSession({ user });
  return user;
}

export async function signOut(): Promise<void> {
  await api.auth.signOut();
  emitSession(null);
}