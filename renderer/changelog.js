/* Nouveautés de chaque version, montrées aux pilotes après une mise à jour.
   La plus récente en premier. Rubriques : added (ajouté), fixed (corrigé), removed (retiré). */
window.ACV_CHANGELOG = [
  {
    version: '0.1.6',
    date: '14 novembre 2026',
    added: ["Accès pilote : l'ACARS demande maintenant ton code d'accès personnel, à recevoir sur Discord. Tu ne le tapes qu'une seule fois.",
      "Bouton « Se déconnecter » dans Mon profil."],
    fixed: ["Ton indicatif est maintenant donné par la compagnie avec ton code d'accès."]
  },
  {
    version: '0.1.5',
    date: '14 novembre 2026',
    added: ['Nouveau code compagnie FWE : les numéros de vol deviennent FWE (par exemple FWE 824), y compris dans SimBrief et l\'indicatif pilote.'],
    removed: ['L\'ancien code ACX n\'est plus utilisé.']
  }
];
