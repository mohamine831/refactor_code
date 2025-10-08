### Consignes JS:

- Si probleme de version pnpm, utiliser `corepack enable pnpm` qui devrait automatiquement utiliser la bonne version
- Ne pas modifier les classes qui ont un commentaire: `// WARN: Should not be changed during the exercise
`
- Pour lancer les tests: `pnpm test`
  - integration only in watch mode `pnpm test:integration`
  - unit only in watch mode `pnpm test:unit`

### Refactor résumé

- Architecture

  - ProductService simplifié (SRP): uniquement orchestration des règles et effets.
  - ProductRepository ajouté: centralise les écritures DB (`update`, `decrementAvailability`, `setUnavailable`, `saveLeadTime`).
  - Helpers purs (`src/utils/helpers.ts`): logique temps/décision réutilisable (`daysToMs`, `isInSeason`, `willDelayExceedSeason`, `isExpired`).

- Logique métier (plus lisible)

  - NORMAL: décrémente si stock > 0, sinon notifie délai si `leadTime > 0`.
  - SEASONAL: vend seulement en saison; si délai dépasse la fin de saison ou hors saison → indisponible + notification; sinon notifie délai.
  - EXPIRABLE: vend si non expiré; sinon notification d’expiration + indisponible.

- Contrôleur

  - Route `/orders/:orderId/processOrder` délègue à `ps.processProduct` pour chaque produit.

- Tests & DX
  - Fix Windows: fermeture SQLite avant suppression (évite EBUSY).
  - Nouveaux tests unitaires ciblés: SEASONAL et EXPIRABLE (chemins principaux).
  - Suites unitaires et intégration vertes (pas de régression).
