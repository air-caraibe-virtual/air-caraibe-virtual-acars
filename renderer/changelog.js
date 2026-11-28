/* Nouveautés de chaque version, montrées aux pilotes après une mise à jour.
   La plus récente en premier. Rubriques : added (ajouté), fixed (corrigé), removed (retiré). */
window.ACV_CHANGELOG = [
  {
    version: '0.1.13',
    date: '27 novembre 2026',
    added: [
      "Carte live : les vrais avions Air Caraïbes au sol (pas encore décollés, en orange) et ceux qui viennent d'atterrir (en vert), en plus de ceux en vol. Une liste les regroupe à droite de la carte.",
      "Carte live : la liste des pilotes Xbox en vol (déclarés sur le téléphone).",
      "Réservation de vol : « Vol libre », pour choisir soi-même son départ et sa destination parmi les lignes d'Air Caraïbes. L'avion est imposé par la ligne.",
      "Missions du jour à chaque ouverture de l'ACARS, avec des XP à gagner, et une mission de la semaine.",
      "Profil : 12 succès à débloquer, avec ton total d'XP et ton niveau."
    ],
    fixed: [
      "Un vol n'est enregistré que s'il est conforme : décollage de l'aéroport de départ, atterrissage à la destination et bon avion. Sinon il est marqué « Non conforme » et ne compte ni au classement, ni pour les missions, ni pour les succès.",
      "Carte live : les nuages par satellite couvrent maintenant toute la Terre, et non plus seulement les Amériques. La carte n'affiche plus plusieurs copies du monde côte à côte.",
      "Carte live : les vrais vols Air Caraïbes s'affichent de nouveau. Ils sont demandés directement depuis ton PC, car le service refusait les demandes du serveur.",
      "Carte live : la trace de ton avion ne tire plus de traits à travers la carte quand tu changes d'aéroport ou de vol. Elle repart de zéro à chaque vol démarré."
    ]
  },
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
