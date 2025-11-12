# Teacher Hub - Guide de Déploiement

## Architecture

L'application Teacher Hub est une solution complète pour convertir des PDFs en quiz interactifs.

### Stack Technique

- **Frontend**: Next.js 14 (App Router) déployé sur Vercel
- **Backend**: Supabase (Postgres + Storage + Edge Functions)
- **AI**: OpenAI API (gpt-4o-mini + text-embedding-3-small)
- **Parsing PDF**: PDF.js (client-side) avec fallback serveur

### Flux de Données

1. **Upload PDF** → Supabase Storage (`pdf-documents` bucket)
2. **Extraction texte** → Client-side (PDF.js) ou serveur (Edge Function)
3. **Chunking** → Découpage sémantique avec embeddings (optionnel)
4. **Génération quiz** → OpenAI API (gpt-4o-mini) en batch
5. **Correction** → Déterministe (QCM/VF) + LLM judge (réponses courtes)

## Installation

### 1. Prérequis

- Node.js 18+
- Compte Supabase (free tier OK)
- Compte OpenAI (API key)
- Compte Vercel (hobby tier OK)

### 2. Configuration Supabase

#### a. Créer le projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un nouveau projet
3. Notez l'URL et les clés API

#### b. Appliquer les migrations

```bash
cd supabase

# Appliquer les migrations
supabase db push

# Ou en local
supabase migration up
```

Les migrations créent :
- Tables : `documents`, `doc_chunks`, `quizzes`, `questions`, `attempts`, `answers`
- Extension `pgvector` pour les embeddings
- Bucket Storage `pdf-documents`
- RLS policies pour la sécurité

#### c. Déployer les Edge Functions

```bash
# Déployer les 3 fonctions
supabase functions deploy process-pdf
supabase functions deploy generate-quiz
supabase functions deploy grade
```

#### d. Configurer les secrets

```bash
# Dans le dashboard Supabase ou via CLI
supabase secrets set OPENAI_API_KEY=sk-...
```

### 3. Configuration Next.js

#### a. Installer les dépendances

```bash
cd apps/teacher-hub
npm install
```

#### b. Variables d'environnement

Créez `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

#### c. Tester localement

```bash
npm run dev
```

### 4. Déploiement Vercel

#### a. Connecter le repo

1. Allez sur [vercel.com](https://vercel.com)
2. Importez le repo GitHub
3. Configurez le projet :
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/teacher-hub`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

#### b. Variables d'environnement Vercel

Ajoutez les mêmes variables que `.env.local` dans les settings Vercel.

## Utilisation

### Workflow Utilisateur

1. **Upload PDF** (`/upload`)
   - Sélectionner un fichier PDF
   - Le texte est extrait côté client (PDF.js)
   - Upload vers Supabase Storage
   - Appel Edge Function `process-pdf` pour chunking

2. **Générer Quiz** (`/documents/[id]`)
   - Cliquer sur "Generate Quiz"
   - Edge Function `generate-quiz` crée les questions via OpenAI
   - 15 questions par défaut (mix MCQ, True/False, Short Answer)

3. **Passer le Quiz** (`/quizzes/[id]`)
   - Répondre aux questions
   - Soumettre les réponses
   - Création d'un `attempt` et des `answers`

4. **Voir les Résultats** (`/attempts/[id]`)
   - Correction automatique
   - Feedback détaillé par question
   - Score et statistiques

## Coûts Estimés (Free Tier)

### Supabase (Free Tier)
- ✅ 500 MB database
- ✅ 1 GB file storage
- ✅ 2 million Edge Function invocations/mois
- ✅ 50k monthly active users

### OpenAI API
- **gpt-4o-mini**: ~$0.15 / 1M input tokens, ~$0.60 / 1M output tokens
- **text-embedding-3-small**: ~$0.02 / 1M tokens

**Estimation par quiz** (15 questions, 20 pages PDF):
- Extraction: 0€ (client-side)
- Chunking: ~$0.001 (embeddings optionnels)
- Génération: ~$0.01-0.02 (gpt-4o-mini)
- Correction: ~$0.001 (LLM judge pour réponses courtes)

**Total**: ~$0.02-0.03 par quiz

### Vercel (Hobby)
- ✅ 100 GB bandwidth/mois
- ✅ Builds illimités
- ✅ Edge Functions inclus

## Optimisations

### Réduction des coûts

1. **Client-side parsing** : Évite les coûts d'extraction serveur
2. **Batch processing** : Traiter plusieurs chunks en parallèle
3. **Cache questions** : Réutiliser si le PDF ne change pas
4. **Embeddings optionnels** : Désactiver si pas besoin de déduplication

### Performance

1. **ISR** : Mettre en cache les pages de quiz
2. **Edge Functions** : Réponse rapide (< 1s)
3. **Lazy loading** : Charger les questions à la demande

## Sécurité

- ✅ **RLS activé** : Chaque utilisateur voit uniquement ses données
- ✅ **Signed URLs** : Accès sécurisé aux PDFs
- ✅ **Validation Zod** : Input validation côté Edge
- ✅ **Rate limiting** : À implémenter (Upstash Redis free tier)

## Troubleshooting

### Erreur "OPENAI_API_KEY not configured"
→ Vérifier les secrets Supabase Edge Functions

### Erreur "Document not found"
→ Vérifier les RLS policies et l'authentification

### Extraction PDF échoue
→ Vérifier que PDF.js est chargé correctement (CDN)

### Quiz génération lente
→ Réduire `target_count` ou augmenter `batchSize`

## Prochaines Étapes

- [ ] Ajouter rate limiting
- [ ] Implémenter export CSV
- [ ] Ajouter filtres (difficulté, type)
- [ ] Dashboard analytics
- [ ] Partage de quiz (liens publics)
- [ ] Mode révision (réponses masquées)

