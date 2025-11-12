# Dépannage - Teacher Hub

## Problème : Quiz créé mais aucune question générée

### Symptômes
- Le document est créé ✅
- Les chunks sont créés ✅
- Le quiz est créé ✅
- **MAIS aucune question dans le quiz** ❌

### Causes possibles

1. **OPENAI_API_KEY non configurée**
   - Vérifiez `supabase/functions/.env`
   - Doit contenir : `OPENAI_API_KEY=sk-...` (votre vraie clé)

2. **Clé OpenAI invalide ou expirée**
   - Vérifiez que votre clé fonctionne sur https://platform.openai.com

3. **Edge Function non démarrée**
   - Vérifiez que `generate-quiz` est en cours d'exécution
   - Commande : `supabase functions serve generate-quiz --env-file supabase/functions/.env`

### Solution

1. **Configurer la clé OpenAI** :
```bash
cd /Users/faridbellameche/projects/teacher-hub
# Éditez supabase/functions/.env et remplacez :
OPENAI_API_KEY=your-openai-key-here
# Par votre vraie clé :
OPENAI_API_KEY=sk-proj-...
```

2. **Redémarrer l'Edge Function** :
```bash
# Arrêtez la fonction actuelle (Ctrl+C)
# Puis redémarrez :
supabase functions serve generate-quiz --env-file supabase/functions/.env
```

3. **Regénérer le quiz** :
   - Allez sur la page du document
   - Cliquez sur "Generate Quiz"
   - Vérifiez les messages d'erreur dans la console du navigateur

### Vérification

Vérifiez que les questions sont créées :
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT COUNT(*) FROM questions WHERE quiz_id = 'VOTRE_QUIZ_ID';"
```

### Logs

Les logs de l'Edge Function afficheront :
- Les erreurs OpenAI si la clé est invalide
- Les warnings si aucune question n'est générée
- Les détails de parsing JSON

