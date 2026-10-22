# Cosa guardo?
PWA statica + job giornaliero che crea `data/dati.json`.

1. Crea un repository GitHub **pubblico** e carica tutti i file (cartella `.github` compresa).
2. Chiavi gratuite: TMDB (themoviedb.org/settings/api, chiave "API Read Access Token" o v3) e football-data.org (registrazione gratuita).
3. Repo > Settings > Secrets and variables > Actions: crea `TMDB_KEY` e `FD_KEY`.
4. Repo > Settings > Pages: Deploy from branch, `main`, cartella `/ (root)`.
5. Repo > Actions > "Aggiorna dati" > Run workflow. Si ripete da solo 2 volte al giorno.
6. Apri l'indirizzo Pages dal telefono: Condividi / menu > "Aggiungi a Home". L'icona si chiamerà "Cosa guardo?".

Prova locale: `TMDB_KEY=... FD_KEY=... node scripts/build-data.mjs` poi `npx serve`.
Se in `data/dati.json` mancano canali o programmi, guarda i messaggi `!` nel log del job.
