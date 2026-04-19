export type Category = 'Sightseeing' | 'Activity' | 'Food' | 'Transport' | 'Special';

export interface POI {
  id: string;
  title: Record<string, string>;
  description: Record<string, string>;
  category: Category;
  duration: number; // in minutes
  imageUrl: string;
  fixed?: boolean;
  time?: string;
  location?: { lat: number; lng: number };
}

export const SLIDES = [
  '/pictures/1.png',
  '/pictures/2.png',
  '/pictures/3.png',
  '/pictures/4.png',
  '/pictures/5.png',
  '/pictures/6.png',
  '/pictures/7.png',
];

export const AZORES_POIS: POI[] = [
  {
    id: 'poi-1',
    title: { en: 'Sete Cidades Crater', cs: 'Kráter Sete Cidades' },
    description: { 
      en: 'The legendary blue and green lakes of Sao Miguel. Pro Tip: Head to Miradouro da Grota do Inferno for the world-famous view. Bring a light jacket as the ridge is often windy.', 
      cs: 'Legendární modré a zelené jezera ostrova Sao Miguel. Pro tip: Vyrazte na Miradouro da Grota do Inferno pro světoznámý výhled. Vezměte si lehkou bundu, protože na hřebeni často fouká.' 
    },
    category: 'Sightseeing',
    duration: 120,
    imageUrl: 'https://images.unsplash.com/photo-1583062312644-83979878170d?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.8672, lng: -25.7924 }
  },
  {
    id: 'poi-2',
    title: { en: 'Terra Nostra Gardens', cs: 'Zahrady Terra Nostra' },
    description: { 
      en: 'Thermal iron-rich water pool surrounded by exotic botanical gardens. Pro Tip: Wear an old swimsuit as the iron content will stain it orange forever. The surrounding garden is one of the best in the world.', 
      cs: 'Termální bazén s vodou bohatou na železo obklopený exotickými zahradami. Pro tip: Vezměte si staré plavky, protože obsah železa je navždy obarví na oranžovo. Okolní zahrada je jednou z nejlepších na světě.' 
    },
    category: 'Activity',
    duration: 180,
    imageUrl: 'https://images.unsplash.com/photo-1590425046200-e79435b62b0e?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.7725, lng: -25.3311 }
  },
  {
    id: 'poi-3',
    title: { en: 'Lagoa do Fogo', cs: 'Lagoa do Fogo' },
    description: { 
      en: 'The "Lake of Fire", a high-altitude crater lake with white sand beaches. Pro Tip: Check the webcams (SpotAzores) before heading up. It is often covered in fog while the coast is sunny.', 
      cs: '„Ohnivé jezero“, vysoko položené kráterové jezero s bílými písečnými plážemi. Pro tip: Před cestou nahoru zkontrolujte webkamery (SpotAzores). Často je tam mlha, i když na pobřeží svítí slunce.' 
    },
    category: 'Sightseeing',
    duration: 150,
    imageUrl: 'https://images.unsplash.com/photo-1582967788606-a171c1080cb0?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.7656, lng: -25.4851 }
  },
  {
    id: 'poi-4',
    title: { en: 'Whale Watching', cs: 'Pozorování velryb' },
    description: { 
      en: 'Experience the ocean giants in their natural Atlantic habitat. Pro Tip: Book the morning slot for calmer seas. PDL is one of the few places in the world to see Blue Whales in early summer.', 
      cs: 'Zažijte oceánské obry v jejich přirozeném atlantském prostředí. Pro tip: Zarezervujte si ranní termín pro klidnější moře. PDL je jedním z mála míst na světě, kde můžete začátkem léta vidět plejtváky obrovské.' 
    },
    category: 'Activity',
    duration: 240,
    imageUrl: 'https://images.unsplash.com/photo-1518144591331-17a5dd71c477?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.7394, lng: -25.6681 }
  },
  {
    id: 'poi-10',
    title: { en: 'Gorreana Tea factory', cs: 'Čajová továrna Gorreana' },
    description: { 
      en: 'Europe\'s oldest and only tea plantations. Pro Tip: Walk the "Tea Path" through the fields before having a free tasting inside the factory. The views of the ocean through the green bushes are surreal.', 
      cs: 'Nejstarší a jediné čajové plantáže v Evropě. Pro tip: Před bezplatnou ochutnávkou v továrně se projděte „Čajovou stezkou“ mezi poly. Výhledy na oceán skrze zelené keře jsou neskutečné.' 
    },
    category: 'Sightseeing',
    duration: 90,
    imageUrl: 'https://images.unsplash.com/photo-1501333198491-d3a31c50113c?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.8181, lng: -25.4022 }
  },
  {
    id: 'poi-11',
    title: { en: 'Caldeira Velha Hot Springs', cs: 'Horké prameny Caldeira Velha' },
    description: { 
      en: 'Warm jungle pools with a waterfall. Pro Tip: It feels like Jurassic Park. Book tickets online in advance as it is strictly limited for conservation.', 
      cs: 'Teplé bazénky v džungli s vodopádem. Pro tip: Budete se cítit jako v Jurském parku. Lístky si kupte online předem, počet míst je přísně omezen.' 
    },
    category: 'Activity',
    duration: 120,
    imageUrl: 'https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.7834, lng: -25.4833 }
  },
  {
    id: 'poi-12',
    title: { en: 'Salto do Prego Waterfall', cs: 'Vodopád Salto do Prego' },
    description: { 
      en: 'A hidden waterfall reached via a beautiful trek. Pro Tip: Bring swimwear for a very cold, refreshing dip. The trail also passes through an abandoned village called Sanguinho.', 
      cs: 'Skrytý vodopád dostupný krásným trekem. Pro tip: Vezměte si plavky na velmi studené, osvějující tempo. Stezka také prochází opuštěnou vesnicí Sanguinho.' 
    },
    category: 'Activity',
    duration: 180,
    imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.7478, lng: -25.1764 }
  },
  {
    id: 'poi-13',
    title: { en: 'Sete Cidades Kayaking', cs: 'Kajaky na Sete Cidades' },
    description: { 
      en: 'Paddle inside the dormant volcanic caldera. Pro Tip: Rent the kayaks from the small pier between the lakes. It\'s much quieter than the viewpoints and very peaceful.', 
      cs: 'Pádlujte uvnitř spící sopečné kaldery. Pro tip: Půjčte si kajaky u malého mola mezi jezery. Je to tam mnohem klidnější než na vyhlídkách a velmi tiché.' 
    },
    category: 'Activity',
    duration: 90,
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.8651, lng: -25.7909 }
  },
  {
    id: 'poi-14',
    title: { en: 'Ananas Arruda Plantation', cs: 'Ananasová plantáž Arruda' },
    description: { 
      en: 'Iconic Azores pineapple greenhouses. Pro Tip: Try the local pineapple liqueur and jam. These pineapples take nearly 2 years to grow in traditional smokehouses.', 
      cs: 'Ikonické skleníky pro azorský ananas. Pro tip: Ochutnejte místní ananasový likér a džem. Pěstování těchto ananasů v tradičních udírnách trvá téměř 2 roky.' 
    },
    category: 'Sightseeing',
    duration: 60,
    imageUrl: 'https://images.unsplash.com/photo-1550258114-68bd295056a7?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.7556, lng: -25.6422 }
  },
  {
    id: 'poi-15',
    title: { en: 'Mosteiros Beach Sunset', cs: 'Západ slunce v Mosteiros' },
    description: { 
      en: 'Black sand beach with dramatic sea stacks. Pro Tip: Grab a local beer from the beach bar and watch the sun dip behind the rocks. It is the best sunset spot on the island.', 
      cs: 'Pláž s černým pískem a dramatickými skalními útvary v moři. Pro tip: Kupte si místní pivo v baru na pláži a sledujte, jak slunce klesá za skály. Je to nejlepší místo na západ slunce.' 
    },
    category: 'Sightseeing',
    duration: 90,
    imageUrl: 'https://images.unsplash.com/photo-1559103433-28f096230f80?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.8924, lng: -25.8202 }
  },
  {
    id: 'poi-16',
    title: { en: 'Lagoa das Furnas', cs: 'Jezero Furnas' },
    description: { 
      en: 'See the underground cooking and boiling mud. Pro Tip: Arrive at 12:30 PM to see the restaurants pulling their "Cozido" pots out of the ground. The sulfur smell is intense!', 
      cs: 'Podívejte se na vaření v podzemí a bublající bahno. Pro tip: Doražte ve 12:30, abyste viděli restaurace vytahovat hrnce „Cozido“ ze země. Síra je cítit opravdu silně!' 
    },
    category: 'Sightseeing',
    duration: 120,
    imageUrl: 'https://images.unsplash.com/photo-1583062312644-83979878170d?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.7728, lng: -25.3375 }
  },
  {
    id: 'poi-17',
    title: { en: 'Boca do Inferno Viewoint', cs: 'Vyhlídka Boca do Inferno' },
    description: { 
      en: 'The most photogenic spot in the Atlantic. Pro Tip: Park at Canaria Lake and walk the path towards the viewpoint. If it\'s foggy, wait 15 minutes, the wind changes fast.', 
      cs: 'Nejfotogeničtější místo v Atlantiku. Pro tip: Zaparkujte u jezera Canaria a jděte pěšky k vyhlídce. Pokud je mlha, počkejte 15 minut, vítr se mění rychle.' 
    },
    category: 'Sightseeing',
    duration: 60,
    imageUrl: 'https://images.unsplash.com/photo-1589146143003-886ec1083bac?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.8422, lng: -25.7618 }
  },
  {
    id: 'poi-18',
    title: { en: 'Ermida da Nossa Senhora', cs: 'Ermida da Nossa Senhora' },
    description: { 
      en: 'Hilltop chapel with symmetrical white stairs. Pro Tip: Climb to the top for a panoramic view of Vila Franca do Campo and its famous islet. Perfect for morning photography.', 
      cs: 'Kaple na vrcholu kopce se symetrickými bílými schody. Pro tip: Vystoupejte nahoru pro panoramatický výhled na Vila Franca do Campo a jeho slavný ostrůvek.' 
    },
    category: 'Sightseeing',
    duration: 45,
    imageUrl: 'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.7122, lng: -25.4333 }
  },
  {
    id: 'poi-19',
    title: { en: 'Ponta da Ferraria', cs: 'Ponta da Ferraria' },
    description: { 
      en: 'A natural ocean pool heated by a thermal vent. Pro Tip: Go exactly at low tide. If the tide is too high, the hot water is cooled too much by the ocean surge.', 
      cs: 'Přírodní bazén v oceánu vyhřívaný termálním vývěrem. Pro tip: Jděte tam přesně při odlivu. Pokud je příliv moc silný, horkou vodu příliš ochlazuje příboj.' 
    },
    category: 'Activity',
    duration: 90,
    imageUrl: 'https://images.unsplash.com/photo-1559103433-28f096230f80?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.8584, lng: -25.8544 }
  },
  {
    id: 'poi-20',
    title: { en: 'Cha Porto Formoso', cs: 'Chá Porto Formoso' },
    description: { 
      en: 'Beautiful tea shop with a terrace overlooking the ocean. Pro Tip: It\'s smaller and more intimate than Gorreana. The "Broken Orange Pekoe" is delicious.', 
      cs: 'Krásná čajovna s terasou s výhledem na oceán. Pro tip: Je menší a intimnější než Gorreana. Jejich „Broken Orange Pekoe“ je vynikající.' 
    },
    category: 'Food',
    duration: 60,
    imageUrl: 'https://images.unsplash.com/photo-1544739313-6fad02872377?auto=format&fit=crop&w=1200&q=80',
    location: { lat: 37.8202, lng: -25.4355 }
  }
];


export const FIXED_EVENTS: Record<string, POI[]> = {
  '2026-07-08': [
    {
      id: 'fix-1',
      title: { en: 'Karel & Pedro Arrival', cs: 'Přílet - Karel a Pedro' },
      description: { en: 'PDL Airport Arrival.', cs: 'Přílet na letiště v PDL.' },
      category: 'Transport',
      duration: 0,
      time: '07:30',
      imageUrl: '/pictures/5.png',
      fixed: true,
      location: { lat: 37.7428, lng: -25.6981 }
    },
    {
      id: 'fix-2',
      title: { en: 'Monika Arrival', cs: 'Přílet - Monika' },
      description: { en: 'PDL Airport Arrival.', cs: 'Přílet na letiště v PDL.' },
      category: 'Transport',
      duration: 0,
      time: '09:45',
      imageUrl: '/pictures/6.png',
      fixed: true,
      location: { lat: 37.7428, lng: -25.6981 }
    }
  ],
  '2026-07-12': [
    {
      id: 'fix-bday',
      title: { en: 'Pedro\'s Birthday Dinner', cs: 'Narozeninová večeře Pedra' },
      description: { en: 'Grand celebration at A Tasca or similar. Pro Tip: Book 3 weeks in advance!', cs: 'Velká oslava v A Tasca nebo podobně. Pro tip: Rezervujte 3 týdny předem!' },
      category: 'Special',
      duration: 180,
      time: '20:00',
      imageUrl: '/pictures/3.png',
      fixed: true,
      location: { lat: 37.7412, lng: -25.6667 }
    }
  ],
  '2026-07-17': [
    {
      id: 'fix-3',
      title: { en: 'Group Departure', cs: 'Odlet skupiny' },
      description: { en: 'Final flight home. See you again, Azores!', cs: 'Závěrečný let domů. Brzy nashledanou, Azory!' },
      category: 'Transport',
      duration: 0,
      time: '19:40',
      imageUrl: '/pictures/7.png',
      fixed: true,
      location: { lat: 37.7428, lng: -25.6981 }
    }
  ]
};

export const TEXTS: Record<string, Record<string, string>> = {
  hero_title: {
    en: 'The Azores Expedition 2026',
    cs: 'Expedice Azory 2026'
  },
  hero_subtitle: {
    en: '10 Days of Exploration | July 8 - July 17',
    cs: '10 dní průzkumu | 8. července - 17. července'
  },
  cta_button: {
    en: 'START PLANNING',
    cs: 'ZAČÍT PLÁNOVAT'
  },
  itinerary: {
    en: 'Itinerary',
    cs: 'Itinerář'
  },
  library: {
    en: 'Library',
    cs: 'Knihovna'
  },
  mission_intel: {
    en: 'Mission Intel',
    cs: 'Centrální Intel'
  }
};


