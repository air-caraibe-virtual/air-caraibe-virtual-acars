/* Nouveautés de chaque version, montrées aux pilotes après une mise à jour.
   La plus récente en premier. Rubriques : added (ajouté), fixed (corrigé), removed (retiré). */
window.ACV_CHANGELOG = [
  {
    version: '0.1.12',
    date: '15 novembre 2026',
    removed: ["Les vols vers Saint-Barthélemy (depuis Pointe-à-Pitre et Fort-de-France) et le DHC-6 Twin Otter, qui n'existent pas chez Air Caraïbes."]
  },
  {
    version: '0.1.11',
    date: '15 novembre 2026',
    added: ["L'Airbus A330-300 assure maintenant les vols Caraïbes (Cayenne, Punta Cana, Cancún, Barbade)."],
    removed: ["L'Airbus A320neo, qui n'existe pas chez Air Caraïbes."]
  },
  {
    version: '0.1.10',
    date: '15 novembre 2026',
    removed: ["Vols retirés car ils se font avec une correspondance aux Antilles : Punta Cana ↔ Cancún, Paris-Orly ↔ Cancún, Paris-Orly ↔ Punta Cana et Saint-Martin ↔ Saint-Barthélemy.",
      "Cancún et Punta Cana restent desservis au départ de Pointe-à-Pitre et de Fort-de-France."]
  },
  {
    version: '0.1.9',
    date: '15 novembre 2026',
    fixed: ["Carte live : les options (Suivre mon avion, Radar pluie, Nuages, Vrais vols Air Caraïbes) sont maintenant sur le côté droit de la carte, et plus en dessous."]
  },
  {
    version: '0.1.8',
    date: '15 novembre 2026',
    added: ["Carte live : les vrais vols Air Caraïbes en A350, A330 et ATR (indicatif FWI) apparaissent en bleu, avec leur avion, leur immatriculation, leur altitude et leur vitesse. Case « Vrais vols Air Caraïbes » sous la carte pour les afficher ou les cacher.",
      "Nouvel onglet « Actualités Air Caraïbes », à côté de « Carte live » : les actualités du jour de la vraie compagnie. Clique sur un titre pour lire l'article."],
    fixed: ["L'onglet « Vols aléatoires » s'appelle maintenant « Réservation de vol »."]
  },
  {
    version: '0.1.7',
    date: '15 novembre 2026',
    added: ["Nouvelle destination : Cancún (MMUN), depuis Pointe-à-Pitre, Fort-de-France, Punta Cana et Paris-Orly.",
      "Nouvel avion : Airbus A350-1000, sur Paris-Orly ↔ Pointe-à-Pitre, Fort-de-France et Punta Cana.",
      "Fenêtre de mise à jour au premier plan, avec l'avancement du téléchargement.",
      "Mode bêta-testeur dans « Paramètres » : reçois les nouveautés avant leur sortie officielle.",
      "Bouton jaune « Une idée ? » en haut de l'écran pour proposer tes idées à la compagnie."],
    fixed: ["Le code compagnie devient FWI : les numéros de vol passent en FWI (par exemple FWI 824), y compris dans SimBrief."],
    removed: ["L'ancien bandeau de mise à jour en bas de l'écran, remplacé par la nouvelle fenêtre.", "L'ancien code FWE n'est plus utilisé."]
  },
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
