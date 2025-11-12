# Démarrer les Edge Functions Supabase Localement

## Configuration

1. **Créer le fichier `.env`** dans `supabase/functions/` :
```bash
cd supabase/functions
cat > .env << 'EOF'
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=REDACTED_SECRET
OPENAI_API_KEY=your-openai-key-here
EOF
```

2. **Remplacer `your-openai-key-here`** par votre vraie clé OpenAI (optionnel, seulement si vous voulez générer des embeddings)

## Démarrer les Edge Functions

### Option 1: Démarrer toutes les fonctions en une fois (recommandé)

Dans un terminal séparé :

```bash
cd /Users/faridbellameche/projects/teacher-hub

# Démarrer process-pdf
supabase functions serve process-pdf --env-file supabase/functions/.env

# Dans d'autres terminaux, démarrer les autres fonctions :
supabase functions serve generate-quiz --env-file supabase/functions/.env
supabase functions serve grade --env-file supabase/functions/.env
```

### Option 2: Utiliser un script (plus pratique)

Créez un fichier `start-functions.sh` :

```bash
#!/bin/bash
cd /Users/faridbellameche/projects/teacher-hub

# Démarrer chaque fonction dans un terminal séparé
osascript -e 'tell application "Terminal" to do script "cd /Users/faridbellameche/projects/teacher-hub && supabase functions serve process-pdf --env-file supabase/functions/.env"'
osascript -e 'tell application "Terminal" to do script "cd /Users/faridbellameche/projects/teacher-hub && supabase functions serve generate-quiz --env-file supabase/functions/.env"'
osascript -e 'tell application "Terminal" to do script "cd /Users/faridbellameche/projects/teacher-hub && supabase functions serve grade --env-file supabase/functions/.env"'
```

Ou utilisez `concurrently` (si installé) :

```bash
npm install -g concurrently
concurrently "supabase functions serve process-pdf --env-file supabase/functions/.env" "supabase functions serve generate-quiz --env-file supabase/functions/.env" "supabase functions serve grade --env-file supabase/functions/.env"
```

## Vérifier que les fonctions fonctionnent

Les fonctions seront disponibles sur :
- `http://127.0.0.1:54321/functions/v1/process-pdf`
- `http://127.0.0.1:54321/functions/v1/generate-quiz`
- `http://127.0.0.1:54321/functions/v1/grade`

## Notes importantes

1. **CORS** : Les fonctions ont maintenant des headers CORS configurés pour permettre les requêtes depuis `localhost:3000`
2. **Hot Reload** : Les fonctions se rechargent automatiquement quand vous modifiez le code
3. **Logs** : Les logs apparaissent dans le terminal où vous avez démarré la fonction

## Dépannage

Si vous avez des erreurs CORS :
- Vérifiez que les fonctions sont bien démarrées
- Vérifiez que `SUPABASE_URL` dans `.env` pointe vers `http://127.0.0.1:54321`
- Vérifiez que Supabase local est en cours d'exécution : `supabase status`

