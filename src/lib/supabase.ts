// L'adaptateur Supabase du port de service (`./service.ts`).
//
// C'est le seul fichier autorisé à importer la bibliothèque Supabase (garde :
// `service.garde.test.ts`). Il reprend à l'identique les appels que les
// composants faisaient eux-mêmes avant le port.
//
// Le choix de cet adaptateur se fait au build (`./backend.ts`) : il ne sert
// que si le build embarque Supabase, jusqu'à l'extinction du projet (tâche ERP
// 3054). La garde « pas de production sans backend » vit dans `./backend.ts`.

import {
  createClient,
  type AuthChangeEvent,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Compte, EvenementSession, Service } from "./service";
import type { SavedComposition } from "./compositions";
import { verdict } from "./declaration-sync";
import type { AppSubmission } from "./submissions";

const SELECT_VERSIONS = "id,name,payload,updated_at";
const SELECT_PROPOSITIONS =
  "id,user_id,name,kind,integration_point,description,rationale,status,admin_note,created_at,reviewed_at";

function texte(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Le compte vu par l'application, depuis l'utilisateur Supabase. */
export function versCompte(u: User | null | undefined): Compte | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: u.id,
    email: u.email ?? null,
    nom: texte(meta.full_name),
    prenom: texte(meta.given_name),
    organisation: texte(meta.company),
  };
}

function versEvenement(e: AuthChangeEvent): EvenementSession {
  if (e === "SIGNED_IN") return "connexion";
  if (e === "SIGNED_OUT") return "deconnexion";
  return "autre";
}

/** Le port de service, servi par un client Supabase donné. */
export function adaptateurSupabase(sb: SupabaseClient): Service {
  return {
    async lireSession() {
      const { data } = await sb.auth.getSession();
      return versCompte(data.session?.user);
    },

    ecouterSession(ecouteur) {
      const { data } = sb.auth.onAuthStateChange((e, session) =>
        ecouteur(versCompte(session?.user), versEvenement(e)),
      );
      return () => data.subscription.unsubscribe();
    },

    async demanderLien(email, retour) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: retour },
      });
      return { ok: !error };
    },

    async partirChezGoogle(retour) {
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: retour },
      });
      return { ok: !error };
    },

    async sortir() {
      // Si le service ne répond pas, la bibliothèque rend l'erreur et garde la
      // session : la personne croit être sortie et ne l'est pas. Sur un poste
      // partagé, c'est la sortie locale qui compte — on la force.
      const { error } = await sb.auth
        .signOut()
        .catch((e: unknown) => ({ error: e }));
      if (error) await sb.auth.signOut({ scope: "local" }).catch(() => {});
    },

    async rattacherProfil(compte) {
      // Miroir minimal dans `profiles` : rattachement du compte et notification
      // Slack à la première organisation renseignée.
      await sb.from("profiles").upsert({
        id: compte.id,
        email: compte.email,
        full_name: compte.nom,
        company: compte.organisation,
        updated_at: new Date().toISOString(),
      });
    },

    async enregistrerOrganisation(organisation) {
      const { error } = await sb.auth.updateUser({
        data: { company: organisation },
      });
      return { ok: !error };
    },

    async listerVersions() {
      const { data, error } = await sb
        .from("compositions")
        .select(SELECT_VERSIONS)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedComposition[];
    },

    async creerVersion(nom, payload) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("AUTH");
      const { data, error } = await sb
        .from("compositions")
        .insert({ user_id: user.id, name: nom, payload })
        .select(SELECT_VERSIONS)
        .single();
      if (error) throw error;
      return data as SavedComposition;
    },

    async renommerVersion(id, nom) {
      const { error } = await sb
        .from("compositions")
        .update({ name: nom, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },

    async remplacerVersion(id, payload) {
      const { error } = await sb
        .from("compositions")
        .update({ payload, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },

    async supprimerVersion(id) {
      const { error } = await sb.from("compositions").delete().eq("id", id);
      if (error) throw error;
    },

    async lireDeclaration(compte) {
      const { data, error } = await sb
        .from("declarations")
        // La révision arrive avec le document : c'est elle qui dit à la file
        // d'écriture d'où partir (voir 0009_revision_declarations.sql).
        .select("payload,revision")
        .eq("user_id", compte)
        .maybeSingle();
      if (error) throw error;
      if (!data?.payload) return null;
      return {
        payload: data.payload,
        revision: typeof data.revision === "number" ? data.revision : 0,
      };
    },

    // `save_declaration()` n'accepte qu'une révision strictement supérieure à
    // celle en base, et dit ce qu'elle a fait.
    //
    // Elle dit aussi pour quel compte la charge a été préparée (`p_user_id`,
    // voir 0010_identite_declarations.sql) : la base refuse si la session en
    // porte un autre. Une base qui n'a pas encore ce paramètre répond qu'elle ne
    // connaît pas la fonction (PGRST202) ; on écrit alors comme avant, la file
    // arrêtée au changement de compte restant la première garde.
    async ecrireDeclaration(payload, revision, compte) {
      let { data, error } = await sb.rpc("save_declaration", {
        p_payload: payload,
        p_revision: revision,
        p_user_id: compte,
      });
      if (error?.code === "PGRST202")
        ({ data, error } = await sb.rpc("save_declaration", {
          p_payload: payload,
          p_revision: revision,
        }));
      if (error) return { statut: "erreur" };
      return verdict(data);
    },

    async creerProposition(input) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("AUTH");
      const { data, error } = await sb
        .from("app_submissions")
        .insert({
          user_id: user.id,
          name: input.name,
          kind: input.kind,
          integration_point: input.integrationPoint || null,
          description: input.description,
          rationale: input.rationale || null,
        })
        .select(SELECT_PROPOSITIONS)
        .single();
      if (error) throw error;
      return data as AppSubmission;
    },

    async listerMesPropositions() {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return [];
      const { data, error } = await sb
        .from("app_submissions")
        .select(SELECT_PROPOSITIONS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AppSubmission[];
    },
  };
}

/** Le service Supabase du projet `url`, avec sa clé publique. */
export function creerServiceSupabase(url: string, cle: string): Service {
  return adaptateurSupabase(
    createClient(url, cle, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  );
}
