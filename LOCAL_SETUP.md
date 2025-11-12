# Configuration Locale - Teacher Hub

## ✅ Base de données déployée

La base de données Supabase locale est maintenant configurée avec :

### Tables créées
- ✅ `documents` - Documents PDF uploadés
- ✅ `doc_chunks` - Chunks de texte avec embeddings
- ✅ `quizzes` - Quiz générés
- ✅ `questions` - Questions des quiz
- ✅ `attempts` - Tentatives de quiz
- ✅ `answers` - Réponses des étudiants

### Extensions
- ✅ `pgvector` (v0.8.0) - Pour les embeddings vectoriels

### Storage
- ✅ Bucket `pdf-documents` (privé) - Stockage des PDFs

### Sécurité
- ✅ 16 policies RLS activées - Chaque utilisateur voit uniquement ses données

## URLs locales

- **API URL**: http://127.0.0.1:54321
- **Studio URL**: http://127.0.0.1:54323 (Supabase Dashboard)
- **DB URL**: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- **GraphQL URL**: http://127.0.0.1:54321/graphql/v1

## Clés API locales

```
anon key: REDACTED_SECRET

service_role key: REDACTED_SECRET
```

## Configuration Next.js locale

Créez `.env.local` dans `apps/teacher-hub/` :

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=REDACTED_SECRET
```

## Tester les Edge Functions localement

```bash
# Démarrer les Edge Functions en mode développement
supabase functions serve process-pdf --env-file supabase/functions/.env
supabase functions serve generate-quiz --env-file supabase/functions/.env
supabase functions serve grade --env-file supabase/functions/.env
```

Créez `supabase/functions/.env` avec :
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=REDACTED_SECRET
OPENAI_API_KEY=sk-your-key-here
```

## Commandes utiles

```bash
# Vérifier le statut
supabase status

# Voir les logs
supabase logs

# Réinitialiser la DB (applique toutes les migrations)
supabase db reset

# Ouvrir le Studio
open http://127.0.0.1:54323
```

## Prochaines étapes

1. ✅ Base de données configurée
2. ⏭️ Configurer `.env.local` pour Next.js
3. ⏭️ Installer les dépendances : `cd apps/teacher-hub && npm install`
4. ⏭️ Démarrer l'app : `npm run dev`
5. ⏭️ Tester l'upload d'un PDF

