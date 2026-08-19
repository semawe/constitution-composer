"use client";

import { useEffect, useState } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { track } from "@/lib/analytics";

// Le compte : session, portes (le « mur » du freemium), connexion Google ou par
// lien, onboarding de l'entreprise, déconnexion.
//
// Sorti de `Composer.tsx` (tâche #1057). Le repli sans Supabase — compte simulé
// dans le navigateur — vit ici aussi : c'est le même sujet, et le laisser en
// travers du composant était une des raisons de sa taille.

export type Porte = "pdf" | "save" | "modules" | "account" | null;

export function useComposerCompte({
  supabase,
  onAvantRedirection,
  onConnexionSimulee,
}: {
  supabase: SupabaseClient | null;
  /** Le brouillon est mis à l'abri avant une redirection OAuth. */
  onAvantRedirection: () => void;
  /** Sans Supabase, la « connexion » est immédiate : on reprend le geste demandé. */
  onConnexionSimulee: (raison: Porte) => void;
}) {
  const [account, setAccount] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [needsCompany, setNeedsCompany] = useState(false);
  const [company, setCompany] = useState("");
  const [gate, setGate] = useState<Porte>(null);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!supabase) {
      try {
        // repli compte simulé lu dans localStorage après montage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (localStorage.getItem("cc_account") === "1") setAccount(true);
      } catch {}
      return;
    }
    const apply = (session: Session | null) => {
      const u = session?.user ?? null;
      setUser(u);
      setAccount(!!u);
      setNeedsCompany(!!u && !u.user_metadata?.company);
      // Miroir des infos utilisateur dans `profiles` (pour l'écran admin).
      if (u) {
        supabase
          .from("profiles")
          .upsert({
            id: u.id,
            email: u.email,
            full_name: u.user_metadata?.full_name ?? null,
            company: u.user_metadata?.company ?? null,
            updated_at: new Date().toISOString(),
          })
          .then(() => {});
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "SIGNED_IN") track("connexion");
      apply(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Connexion Google réelle (Supabase). Sans Supabase → compte simulé (repli).
  const signInGoogle = async () => {
    if (!supabase) {
      setAccount(true);
      try {
        localStorage.setItem("cc_account", "1");
      } catch {}
      const raison = gate;
      setGate(null);
      onConnexionSimulee(raison);
      return;
    }
    onAvantRedirection();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  };

  // Connexion par lien magique (sans compte Google).
  const signInOtp = async () => {
    const addr = email.trim();
    if (!addr) return;
    if (!supabase) {
      signInGoogle();
      return;
    }
    onAvantRedirection();
    await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setOtpSent(true);
  };

  // Onboarding : Google ne fournit pas l'entreprise → on la collecte une fois.
  const submitCompany = async () => {
    if (!supabase || !company.trim()) return;
    await supabase.auth.updateUser({ data: { company: company.trim() } });
    setNeedsCompany(false);
  };

  // La chrome du Composer (App.tsx) peut demander l'ouverture de la connexion
  // via un événement, sans remonter tout l'état d'auth.
  useEffect(() => {
    const open = () => setGate((g) => g ?? "account");
    window.addEventListener("cc:open-signin", open);
    return () => window.removeEventListener("cc:open-signin", open);
  }, []);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      setAccount(false);
      setNeedsCompany(false);
    } else {
      setAccount(false);
      try {
        localStorage.removeItem("cc_account");
      } catch {}
    }
  };


  return {
    account,
    user,
    gate,
    setGate,
    email,
    setEmail,
    otpSent,
    needsCompany,
    setNeedsCompany,
    company,
    setCompany,
    signInGoogle,
    signInOtp,
    submitCompany,
    signOut,
  };
}
