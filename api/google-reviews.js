// Vercel Serverless API — Live Google Reviews Feed for evanpatruno.ca
// Combines live Google Places API (New) fetch with verified Google Maps reviews cache

const VERIFIED_REVIEWS = [
  {
    name: "Mélissa Hyacinthe",
    role: "Avis Google vérifié · il y a un mois",
    rating: 5,
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocJjTAettXsLKs1YfE0riyeB8mwA9R1P0XhkLpEG6arPe_s90xM=w72-h72-p-rp-mo-br100",
    text: "J’ai eu le plaisir de collaborer avec Evan pour des clients que je lui avais référés et l’expérience a été excellente ! Il a su les accompagner avec beaucoup d’attention, de disponibilité et de professionnalisme tout au long du processus. Une très belle collaboration et surtout un excellent travail."
  },
  {
    name: "Véronique Mongeau",
    role: "Avis Google vérifié · il y a un mois",
    rating: 5,
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocLa31RClPtEBup3uK6z9EJkx8toWioKRZWdUKRTExFLuTsM=w72-h72-p-rp-mo-ba12-br100",
    text: "Excellent courtier ! Evan a été disponible, honnête et efficace du début à la fin. Il a su trouver exactement ce qu'il fallait pour nous. Je recommande à 100 %."
  },
  {
    name: "Cynthia Garcia",
    role: "Avis Google vérifié · Rive-Sud",
    rating: 5,
    avatar: "https://lh3.googleusercontent.com/a-/ALV-UjV-EV0mZHiQJaVE7XkQZTCnjsAtugU0UY9mPJw6tsXgD0SWGcsp=w72-h72-p-rp-mo-br100",
    text: "Je tiens à partager mon excellente expérience avec le service offert par Evan. Dès le premier contact, j’ai été impressionnée par sa connaissance du marché, son professionnalisme, son écoute et sa disponibilité. Il a su bien comprendre mes besoins et m’accompagner à chaque étape avec des conseils clairs et judicieux."
  },
  {
    name: "Elisa Desoer",
    role: "Avis Google vérifié · Achat & Vente Condo",
    rating: 5,
    avatar: "https://lh3.googleusercontent.com/a-/ALV-UjVSoTJN-ZAItAKyKiHrIwgPHvty2WrO9cBR3u1j7xBFJnErbwo=w72-h72-p-rp-mo-br100",
    text: "Evan m’a bien accompagnée deux fois pour des achats immobiliers et aussi pour ma vente de condo. Il est très réactif, rigoureux, à l’écoute et ne met pas de pression lorsqu’il sent des hésitations de notre côté. On sent qu’il défend nos intérêts et c’est une qualité précieuse pour un courtier !"
  },
  {
    name: "V N",
    role: "Avis Google vérifié",
    rating: 5,
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocJBeevuk9sWIOXNxB3pVC01L6uKkJuf0j3e3pvsYc93DoaOA7U=w72-h72-p-rp-mo-ba12-br100",
    text: "Le meilleur ! Evan est un courtier super professionnel, toujours disponible et vraiment à l’écoute. Il rend le processus simple et sans stress, tout en donnant de bons conseils honnêtes. Tu sens qu’il veut vraiment le meilleur pour toi, pas juste conclure une vente. Je le recommande sans hésiter !"
  },
  {
    name: "Pierre-Antoine Jacques",
    role: "Avis Google vérifié · Premier achat",
    rating: 5,
    avatar: "",
    text: "Nous avons transigé avec Evan pour l'achat de notre première maison. Il s'est montré d'une grande gentillesse, d'une efficacité et d'une rapidité exemplaire pour répondre à nos questions."
  },
  {
    name: "Vincent Piette",
    role: "Avis Google vérifié · Vente résidentielle",
    rating: 5,
    avatar: "",
    text: "Excellente expérience avec Evan ! Disponible, réactif et très à l'écoute, il a su rendre la vente de ma maison simple et sereine. Son professionnalisme et ses précieux conseils m'ont beaucoup aidé."
  },
  {
    name: "Michaël P.",
    role: "Avis Google vérifié · Acheteur",
    rating: 5,
    avatar: "",
    text: "Nous avons eu la chance d'être accompagnés par Evan, un courtier exceptionnel, pendant plus de deux ans dans notre recherche de la maison idéale. Ce professionnel a travaillé sans relâche."
  },
  {
    name: "Marie-Ève Dupont",
    role: "Avis Google vérifié · Vendeuse",
    rating: 5,
    avatar: "",
    text: "La vente de ma maison fût une étape très importante et émotive. Merci Evan pour ton professionnalisme, ton écoute et tes réponses à mes mille et une questions. Travail impeccable."
  },
  {
    name: "Jordan Hebert",
    role: "Avis Google vérifié · Multi-logement",
    rating: 5,
    avatar: "",
    text: "Tu veux vendre ou acheter un building commercial ou un multi-logement, tu dois considérer faire affaire avec Evan pour son professionnalisme et l'amour qu'il met dans son travail."
  },
  {
    name: "Tania Madore",
    role: "Avis Google vérifié · Acheteuse",
    rating: 5,
    avatar: "",
    text: "Evan est toujours là pour répondre rapidement à nos questions. Toujours disponible pour venir visiter et faire des démarches même si le temps presse. Je recommande absolument."
  },
  {
    name: "Samuel Beausoleil",
    role: "Avis Google vérifié · Acheteur",
    rating: 5,
    avatar: "",
    text: "Evan prend le temps de nous informer des nouveautés sur le marché qui pourraient répondre à nos besoins. Il s'occupe de toute la logistique et répond rapidement aux interrogations."
  },
  {
    name: "Mélanie Laganière",
    role: "Avis Google vérifié · Propriétaire",
    rating: 5,
    avatar: "",
    text: "Je vous recommande Evan pour vous aider avec votre future transaction immobilière ! Il saura vous mettre à l'aise, il est professionnel, disponible et très ponctuel."
  }
];

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=43200");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  let rating = 5.0;
  let totalCount = 34;
  let reviews = [...VERIFIED_REVIEWS];

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (apiKey && placeId) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total,reviews&language=fr&key=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data && data.result) {
        if (data.result.rating) rating = data.result.rating;
        if (data.result.user_ratings_total) totalCount = data.result.user_ratings_total;
        if (Array.isArray(data.result.reviews)) {
          const existingNames = new Set(reviews.map(rv => rv.name.toLowerCase()));
          data.result.reviews
            .filter(rv => rv.rating >= 5 && rv.text)
            .forEach(rv => {
              if (!existingNames.has((rv.author_name || "").toLowerCase())) {
                reviews.unshift({
                  name: rv.author_name,
                  role: "Avis Google vérifié · " + (rv.relative_time_description || "Récent"),
                  rating: rv.rating,
                  avatar: rv.profile_photo_url || "",
                  text: rv.text
                });
              }
            });
        }
      }
    } catch (e) {
      // Fallback to verified reviews cache
    }
  }

  return res.status(200).json({
    rating: Number(rating).toFixed(1),
    totalCount,
    profileUrl: "https://g.page/r/CdypKbg57LonEAE",
    reviews
  });
};
