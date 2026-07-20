import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  tier: string;
  title: string | null;
  department: string | null;
  manager_email: string | null;
  is_admin: boolean;
};

type AuthCtx = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  isManager: boolean;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAppUser = async (email: string | undefined) => {
    if (!email) {
      setAppUser(null);
      setIsManager(false);
      return;
    }
    const { data: me } = await supabase
      .from("app_users")
      .select("*")
      .ilike("email", email)
      .maybeSingle();
    if (me) {
      setAppUser(me as AppUser);
      // Manager view access: admin OR someone reports to me OR I'm top of tree
      // (blank manager_email, e.g. Lisa) OR I'm 'Training Not Required'.
      const isTopOfTree = !me.manager_email || me.manager_email.trim() === "";
      const isTrainingNotRequired = me.tier === "Training Not Required";
      if (me.is_admin || isTopOfTree || isTrainingNotRequired) {
        setIsManager(true);
      } else {
        const { count } = await supabase
          .from("app_users")
          .select("id", { count: "exact", head: true })
          .ilike("manager_email", email);
        setIsManager((count ?? 0) > 0);
      }
    } else {
      setAppUser(null);
      setIsManager(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // defer to avoid deadlock
      setTimeout(() => {
        loadAppUser(s?.user?.email).finally(() => setLoading(false));
      }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadAppUser(data.session?.user?.email).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    loading,
    session,
    user: session?.user ?? null,
    appUser,
    isManager,
    signInGoogle: async () => {
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
    },
    signOut: async () => {
      await supabase.auth.signOut();
      window.location.href = "/login";
    },
    refreshAppUser: async () => {
      await loadAppUser(session?.user?.email);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}