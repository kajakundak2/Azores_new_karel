export type Category = 'Sightseeing' | 'Activity' | 'Food' | 'Transport' | 'Special' | 'City' | 'Event';

export interface TravelerProfile {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'child' | 'unspecified';
  age?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
  uiCards?: POI[];
}

export interface POI {
  id: string;
  title: Record<string, string>;
  description?: Record<string, string>;
  category: Category;
  duration: number; // in minutes
  imageUrl?: string;
  fixed?: boolean;
  time?: string;
  location?: { lat: number; lng: number };
  
  // Rich Data
  images?: string[];
  rating?: number;
  reviewCount?: number;
  bookingLink?: string;
  locationDesc?: Record<string, string>;
  priceInEuro?: string;
  cost?: number;        // Parsed cost value (Phase 4)
  startTime?: string;   // Suggested start time (Phase 4)
  address?: string; // New: Full address for Google Maps style
  googleMapsUrl?: string; // New: Direct link for export/viewing
  transportModeTo?: 'car' | 'bus' | 'walk' | 'bicycle'; // New: User preferred arrival mode
}

export interface TransitNode {
  type: 'transit';
  mode: 'car' | 'bus' | 'walk' | 'bicycle' | 'flight';
  durationMins: number;
  distanceKm?: number;
  fromPoiId?: string;
  toPoiId?: string;
}

export type TimelineItem = POI | TransitNode;

export interface Flight {
  id: string;
  direction: 'outbound' | 'inbound';
  airline: string;
  airlineLogoUrl?: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string; // ISO string 
  arrivalTime: string; // ISO string
  durationMins: number;
  stops: number;
  price?: string;
}

export interface Stay {
  id: string;
  name: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  nights: number;
  rating?: number;
  reviewCount?: number;
  price?: string;
  pricePerNight?: number; // in EUR
  currency?: string;
  imageUrl?: string;
  address?: string;
  location?: { lat: number; lng: number };
  description?: string;
  bookingUrl?: string;
  placeId?: string; // Google Places ID
}

export interface ReferenceDoc {
  id: string;
  name: string;
  content: string;
  type: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  travelers: number; // total
  adults: number;
  kids: number;
  kidsAges?: number[];
  preferences?: string; // New: High-level preferences from AI chat (e.g. "Foodie, Nature, Active")
  // A trip holds its own daily itinerary
  itinerary: Record<string, POI[]>;
  logistics: {
    flights: Flight[];
    stays: Stay[];
    packingRequirements?: string;
  };
  isActive?: boolean; // simple flag if we need locally
  libraryPois?: POI[]; // Dynamic initial library
  dayThemes?: Record<string, string>; // ISO date -> Theme string
  inspirationVideos?: { id: number; video: string; label: string; thumbnail?: string; }[]; // Dynamic reels
  chatHistory?: ChatMessage[]; // Persisted chat with Sara
  originalRequest?: string; // The user's original trip description/request
  travelerProfiles?: TravelerProfile[]; // Individual traveler details
  planningMode?: 'full' | 'suggestions_only'; // New: Choice between complete plan or just POI suggestions
  referenceDocs?: ReferenceDoc[]; // New: Documents uploaded by the user
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

export const AZORES_POIS: POI[] = [];

export const FIXED_EVENTS: Record<string, POI[]> = {};

export const TEXTS: Record<string, Record<string, string>> = {
  hero_title: {
    en: 'SarAItinerary',
    cs: 'SárAItinerář',
  },
  hero_subtitle: {
    en: 'Intelligent Travel Itineraries',
    cs: 'Chytré itineráře na cesty',
  },
  // Landing page keys
  landing_title_itinerary: {
    en: 'LANDING',
    cs: 'TRASY',
  },
  landing_subtitle: {
    en: 'INTELLIGENT EXPEDITION PLANNING',
    cs: 'CHYTRÉ PLÁNOVÁNÍ EXPEDIC',
  },
  landing_readiness: {
    en: 'READINESS',
    cs: 'PŘIPRAVENOST',
  },
  architecture: {
    en: 'ARCHITECTURE',
    cs: 'ARCHITEKTURA',
  },
  mission_logistics: {
    en: 'MISSION LOGISTICS',
    cs: 'LOGISTIKA MISE',
  },
  landing_destination_label: {
    en: 'DESTINATION',
    cs: 'CÍL CESTY',
  },
  landing_destination_placeholder: {
    en: 'Where to?',
    cs: 'Kam jedeme?',
  },
  landing_timeframe_label: {
    en: 'TIMEFRAME',
    cs: 'TERMÍN',
  },
  adults: {
    en: 'ADULTS',
    cs: 'DOSPĚLÍ',
  },
  kids: {
    en: 'CHILDREN',
    cs: 'DĚTI',
  },
  cta_button: {
    en: 'START PLANNING',
    cs: 'ZAČÍT PLÁNOVAT',
  },
  itinerary: {
    en: 'Itinerary',
    cs: 'Itinerář',
  },
  library: {
    en: 'Library',
    cs: 'Knihovna',
  },
  recent_trips: {
    en: 'Recent Trips',
    cs: 'Nedávné cesty'
  },
  empty_logbook: {
    en: 'Empty Logbook',
    cs: 'Prázdný deník'
  },
  travelers: {
    en: 'Travelers',
    cs: 'Cestovatelé'
  },
  chat_title: {
    en: 'Chat with Sára',
    cs: 'Chat se Sárou',
  },
  chat_placeholder: {
    en: 'Ask Sára anything...',
    cs: 'Zeptej se Sáry na cokoliv...'
  },
  chat_thinking: {
    en: 'Sára is thinking...',
    cs: 'Sára přemýšlí...'
  },
  drag_prompt: {
    en: 'Drag places here\nto build the day',
    cs: 'Přetáhněte místa sem\na sestavte den',
  },
  add_to_day: {
    en: 'Add to Day',
    cs: 'Přidat do dne',
  },
  remove: {
    en: 'Remove',
    cs: 'Odebrat',
  },
  packing_list: { en: 'Packing List', cs: 'Co s sebou' },
  packing_traveler: { en: 'Traveler', cs: 'Cestovatel' },
  packing_male: { en: 'Man', cs: 'Muž' },
  packing_female: { en: 'Woman', cs: 'Žena' },
  packing_child: { en: 'Child', cs: 'Dítě' },
  packing_unspecified: { en: 'Traveler', cs: 'Cestovatel' },
  packing_regenerate: { en: 'Regenerate AI', cs: 'Přegenerovat AI' },
  packing_generating: { en: 'Generating...', cs: 'Generuji...' },
  packing_add_item: { en: 'Add item...', cs: 'Přidat položku...' },
  packing_no_items: { en: 'No items yet', cs: 'Žádné položky' },
  packing_add_traveler: { en: 'Add a traveler above', cs: 'Přidejte cestovatele' },
  packing_all: { en: 'All', cs: 'Vše' },
  packing_packed: { en: 'packed', cs: 'zabaleno' },
  packing_complete: { en: 'All packed! Ready to go!', cs: 'Zabaleno! Připraveni na cestu!' },
  packing_incomplete: { en: 'Still packing...', cs: 'Ještě balíme...' },
  age_children: { cs: 'Věk dětí', en: "Children's Ages" },
  strategy_full_desc: { cs: 'Sára vytvoří kompletní rozvrh den po dni.', en: 'Sara will build a complete day-by-day schedule.' },
  strategy_suggestions_desc: { cs: 'Sára vybere nejlepší místa, ale nechá vám volnou ruku v čase.', en: 'Sara will pick the best spots, but leave the timing up to you.' },
  mystery_destination: { cs: 'Záhadné místo', en: 'Mystery Destination' },
  finalizing: { cs: 'Finalizuji...', en: 'Finalizing...' },
  create_itinerary: { cs: 'Vytvořit Itinerář', en: 'Create Itinerary' },
  start_hint: { cs: 'Zadejte detaily nebo si popovídejte se Sárou', en: 'Enter trip details or talk to Sára to start' },
  treasure_lost: { cs: 'Ztratili se při expedici. Odpovězte správně na otázky a ukažte jim správnou cestu.', en: 'They got lost during the expedition. Answer questions correctly to show them the right way.' },
  treasure_preparing: { cs: 'PŘÍPRAVA MAPY...', en: 'PREPARING MAP...' },
  treasure_start: { cs: 'ZJISTIT NÁPOVĚDU', en: 'START SEARCH' },
  treasure_next: { cs: 'Další', en: 'Next' },
  loading: { cs: 'Načítám...', en: 'Loading...' },
  link_copied: { cs: 'Odkaz zkopírován!', en: 'Link copied to clipboard!' },
  notification_planning: { cs: 'Sára zahajuje detailní plánování...', en: 'Sára is starting detailed planning...' },
  notification_searching: { cs: 'Vyhledávám místa na mapě...', en: 'Looking up places on Google Maps...' },
  notification_smart: { cs: '🔄 Spouštím chytré plánování pro celý výlet...', en: '🔄 Starting smart generation for the whole trip...' },
  notification_updated: { cs: 'Sára aktualizovala detaily cesty.', en: 'Sára updated trip details.' },
  notification_added: { cs: 'Přidáno do itineráře!', en: 'Added to itinerary!' },
  units_person: { cs: 'os', en: 'px' },
  lets_go: { cs: 'Jedeme!', en: "Let's go!" },
  so_many_things: { cs: 'Tolik věcí...', en: 'So many things...' },
  stays_manager: {
    en: 'Stays',
    cs: 'Ubytování',
  },
  add_stay: {
    en: 'Add Stay',
    cs: 'Přidat ubytování',
  },
  edit_dates: {
    en: 'Edit Dates',
    cs: 'Upravit data',
  },
  edit_travelers: {
    en: 'Edit Travelers',
    cs: 'Upravit cestovatele',
  },
  nights: {
    en: 'nights',
    cs: 'nocí',
  },
  per_night: {
    en: '/night',
    cs: '/noc',
  },
  search_places: {
    en: 'Search places...',
    cs: 'Hledat místa...',
  },
  no_stays: {
    en: 'No accommodations yet',
    cs: 'Zatím žádné ubytování',
  },
  total_cost: {
    en: 'Total Cost',
    cs: 'Celková cena',
  },
  price: {
    en: 'Price',
    cs: 'Cena',
  },
  description_label: {
    en: 'Description',
    cs: 'Popis',
  },
  directions: {
    en: 'Directions',
    cs: 'Navigace',
  },
  all_days: {
    en: 'All Days',
    cs: 'Všechny dny',
  },
  single_day: {
    en: 'Single Day',
    cs: 'Jeden den',
  },
  open_atlas: {
    en: 'Open Atlas',
    cs: 'Otevřít Atlas',
  },
  close_atlas: {
    en: 'Close Atlas',
    cs: 'Zavřít Atlas',
  },
  generating_itinerary: {
    en: 'Generating Itinerary',
    cs: 'Generuji itinerář',
  },
  gathering_spots: {
    en: 'Gathering the best spots',
    cs: 'Sbírám nejlepší místa',
  },
  sara_voice: {
    en: 'Sara Voice Assistant',
    cs: 'Hlasová asistentka Sára',
  },
  live_on_call: {
    en: 'Live on Call',
    cs: 'Na hovoru',
  },
  online_ready: {
    en: 'Online & Ready',
    cs: 'Online a připravena',
  },
  syncing_sara: {
    en: 'Syncing with Sára',
    cs: 'Synchronizace se Sárou',
  },
  trending_inspiration: {
    en: 'Trending Inspiration',
    cs: 'Trendová inspirace',
  },
  no_activities: {
    en: 'No activities planned',
    cs: 'Žádné naplánované aktivity',
  },
  drag_drop_here: {
    en: 'Drag and drop places here',
    cs: 'Přetáhněte místa sem',
  },
  total_time: {
    en: 'Total Time',
    cs: 'Celkový čas',
  },
  view_on_instagram: {
    en: 'View on Instagram →',
    cs: 'Zobrazit na Instagramu →',
  },
  discovering: {
    en: 'Discovering...',
    cs: 'Objevuji...',
  },
  added_to_itinerary: {
    en: 'Added to itinerary!',
    cs: 'Přidáno do itineráře!',
  },
  search_results: {
    en: 'Search Results',
    cs: 'Výsledky hledání',
  },
  atlas_library: {
    en: 'Atlas Library',
    cs: 'Knihovna Atlas',
  },
  search_in: {
    en: 'Search in',
    cs: 'Hledat v',
  },
  search_within_visible: {
    en: 'Search within visible area only',
    cs: 'Hledat pouze v zobrazené oblasti',
  },
  clear: {
    en: 'Clear',
    cs: 'Vymazat',
  },
  ask_destination: {
    en: 'Ask me anything about the destination — weather, tips, route suggestions, restaurants.',
    cs: 'Zeptejte se mě na cokoliv o destinaci — počasí, tipy, trasy, restaurace.',
  },
  sara_listening: {
    en: 'Sára is listening...',
    cs: 'Sára poslouchá...',
  },
  // Weather
  weather_title_historical: { en: 'Climatic Averages', cs: 'Klimatické průměry' },
  weather_title_forecast: { en: '7-Day Forecast', cs: 'Předpověď na 7 dní' },
  weather_for: { en: 'For', cs: 'Pro' },
  weather_hourly_historical: { en: 'Historical Hourly Estimate', cs: 'Historický hodinový odhad' },
  weather_hourly_forecast: { en: 'Expert Hourly Forecast', cs: 'Expertní hodinová předpověď' },
  weather_max_temp: { en: 'Max Temp', cs: 'Max teplota' },
  weather_precip: { en: 'Percip.', cs: 'Srážky' },
  weather_wind: { en: 'Wind', cs: 'Vítr' },
  weather_hourly: { en: 'Hourly Conditions', cs: 'Hodinové podmínky' },
  weather_dry: { en: 'Dry', cs: 'Sucho' },
  weather_confidence: { en: 'Plan your day with confidence', cs: 'Plánujte den s jistotou' },
  // Chat
  chat_reset: { en: 'Reset conversation', cs: 'Resetovat konverzaci' },
  chat_voice_architect: { en: 'Live Voice Architect', cs: 'Hlasový architekt' },
  chat_voice_to_text: { en: 'Voice-to-Text', cs: 'Hlas na text' },
  chat_upload_doc: { en: 'Upload Reference Document', cs: 'Nahrát referenční dokument' },
  chat_end_call: { en: 'End Call', cs: 'Ukončit hovor' },
  chat_connecting: { en: 'Connecting...', cs: 'Připojování...' },
  chat_call_sara: { en: 'Call Sára', cs: 'Zavolat Sáře' },
  // Timeline
  timeline_drag: { en: 'Drag to reorder', cs: 'Přetáhněte pro změnu pořadí' },
  timeline_remove: { en: 'Remove from itinerary', cs: 'Odebrat z itineráře' },
  timeline_view_details: { en: 'View details', cs: 'Zobrazit detaily' },
  timeline_total_time: { en: 'Total Time', cs: 'Celkový čas' },
  timeline_no_activities: { en: 'No activities planned', cs: 'Žádné aktivity nejsou naplánovány' },
  timeline_drop_here: { en: 'Drag and drop places here', cs: 'Přetáhněte místa sem' },
  // Transport
  transport_car: { en: 'Car', cs: 'Auto' },
  transport_bus: { en: 'Bus', cs: 'Autobus' },
  transport_walk: { en: 'Walk', cs: 'Chůze' },
  transport_bike: { en: 'Bike', cs: 'Kolo' },
  transport_live: { en: 'Live', cs: 'Živě' },
  transport_departs: { en: 'Departs', cs: 'Odjíždí' },
  // Intel
  intel_title: { en: 'Trip Intel', cs: 'Přehled cesty' },
  intel_overview: { en: 'Overview', cs: 'Přehled' },
  intel_schedule: { en: 'Trip Schedule', cs: 'Rozvrh cesty' },
  intel_phase: { en: 'Phase', cs: 'Fáze' },
  intel_timestamp: { en: 'Timestamp', cs: 'Čas' },
  intel_trip_start: { en: 'Trip Start', cs: 'Začátek cesty' },
  intel_trip_end: { en: 'Trip End', cs: 'Konec cesty' },
  intel_warning: { en: 'Check arrival times for local transport. Renting a car is mission-critical for Azores logistics.', cs: 'Zkontrolujte časy příjezdů pro místní dopravu. Pronájem auta je klíčový pro logistiku na Azorech.' },
  intel_accommodations: { en: 'Accommodations', cs: 'Ubytování' },
  intel_stay_badge: { en: 'STAY', cs: 'POBYT' },
  intel_no_stays: { en: 'No stays identified.', cs: 'Žádné ubytování nebylo nalezeno.' },
  intel_open_map: { en: 'Open Full Trip Map', cs: 'Otevřít celou mapu cesty' },
  // App/TopBar
  share_trip: { en: 'Share Trip', cs: 'Sdílet cestu' },
  add_to_itinerary: { en: 'Add to Itinerary', cs: 'Přidat do itineráře' },
  total_nights: { en: 'Total Nights', cs: 'Celkem nocí' },
  total_budget: { en: 'Total Budget', cs: 'Celkové náklady' },
  save_changes: { en: 'Save Changes', cs: 'Uložit změny' },
  cancel: { en: 'Cancel', cs: 'Zrušit' },
  back_to_list: { en: 'Back to list', cs: 'Zpět na seznam' },
  price_per_night: { en: 'Price / Night', cs: 'Cena / Noc' },
  total: { en: 'Total', cs: 'Celkem' },
  find_stay: { en: 'Find Stay', cs: 'Najít ubytování' },
  stays_list: { en: 'Stays List', cs: 'Seznam ubytování' },
  stay_search_placeholder: { en: 'Accommodation name or address...', cs: 'Název ubytování nebo adresa...' },
  // Landing
  readiness: { en: 'Readiness', cs: 'Připravenost' },
  target_destination: { en: 'Target Destination', cs: 'Cílová destinace' },
  trip_timeframe: { en: 'Trip Timeframe', cs: 'Časové rozmezí' },
  planning_strategy: { en: 'Planning Strategy', cs: 'Strategie plánování' },
  strategy_full: { en: 'Full Itinerary', cs: 'Kompletní plán' },
  strategy_suggestions: { en: 'Suggestions Only', cs: 'Jen inspirace' },
  status_online: { en: 'Online', cs: 'Online' },
  // Treasure Hunt
  treasure_help_find: { en: 'Help Kaja & Pedro find their way!', cs: 'Pomozte Kajovi a Petrovi najít cestu!' },
  treasure_found: { en: 'They made it!', cs: 'Zvládli to!' },
  treasure_leaderboard: { en: 'Global Leaderboard', cs: 'Globální žebříček' },
  treasure_play_again: { en: 'Play Again', cs: 'Hrát znovu' },
  treasure_enter_name: { en: 'Enter your name', cs: 'Zadejte své jméno' },
  treasure_save_score: { en: 'Save Score', cs: 'Uložit skóre' },
  // Poi & Stays
  poi_directions: { en: 'Directions', cs: 'Navigovat' },
  poi_save_to_day: { en: 'Save to Day ', cs: 'Uložit do dne ' },
  poi_book_online: { en: 'Book Online', cs: 'Rezervovat online' },
  poi_duration_suffix: { en: ' duration', cs: ' trvání' },
  poi_no_description: { en: 'No description available for this activity.', cs: 'Pro tuto aktivitu není k dispozici žádný popis.' },
  stays_title: { en: 'Manage Stays', cs: 'Spravovat ubytování' },
  stays_tab_search: { en: 'Search Hotels', cs: 'Hledat hotely' },
  stays_tab_list: { en: 'My Stays', cs: 'Moje pobyty' },
  stays_placeholder: { en: 'Search for hotels, villas, or apartments...', cs: 'Hledejte hotely, vily nebo apartmány...' },
  stays_empty: { en: 'No stays added yet.', cs: 'Zatím nebylo přidáno žádné ubytování.' },
  stays_add_btn: { en: 'Add to Trip', cs: 'Přidat do cesty' },
  stays_checkin: { en: 'Check-in', cs: 'Příjezd' },
  stays_checkout: { en: 'Check-out', cs: 'Odjezd' },
  // Memories
  memories_badge: { en: 'Our Memories', cs: 'Naše vzpomínky' },
  memories_title_1: { en: 'Captured ', cs: 'Zachyťte ' },
  memories_title_2: { en: 'Moments', cs: 'momentky' },
  memories_google_photos: { en: 'View Google Photos Album', cs: 'Zobrazit album v Google Photos' },
  memories_by: { en: 'By ', cs: 'Od ' },
  memories_ai_enabled: { en: 'AI Image Generation enabled', cs: 'AI generování obrázků aktivní' },
  memories_ai_desc: { en: 'I can generate group photos of Karel, Pedro, and Monika based on your itinerary highlights.', cs: 'Můžu vygenerovat skupinové fotky Karla, Pedra a Moniky na základě vašich zážitků.' },
  celebrate: { en: 'CELEBRATE', cs: 'OSLAVIT' },
  sidekick_woohoo: { en: 'Woohoo!', cs: 'Jupí!' },
  itinerary_label: { en: 'Itinerary', cs: 'Itinerář' },
  days_count: { en: 'Days', cs: 'Dnů' },
  inspiration_title: { en: 'Trending Inspiration', cs: 'Trendy Inspirace' },
  stays_btn: { en: 'Stays', cs: 'Ubytování' },
  packing_btn: { en: 'Packing', cs: 'Balení' },
  packing_ready: { en: '(Ready)', cs: '(Hotovo)' },
  packing_in_progress: { en: '(In Progress)', cs: '(Probíhá)' },
  atlas_title: { en: 'Atlas Library', cs: 'Knihovna Atlas' },
  places_count: { en: 'places', cs: 'míst' },
  search_places_title: { en: 'Search Places', cs: 'Hledat místa' },
  search_placeholder_dest: { en: 'Search in', cs: 'Hledat v' },
  search_visible_only: { en: 'Search within visible area only', cs: 'Hledat pouze ve viditelné oblasti' },
  search_results_title: { en: 'Search Results', cs: 'Výsledky Vyhledávání' },
  clear_search: { en: 'Clear', cs: 'Vymazat' },

  // Chat
  'chat_header_title': { en: 'Expedition Architect', cs: 'AI Architekt' },
  'chat_ready_status': { en: 'Ready to Plan', cs: 'Připraven Plánovat' },
  'chat_welcome_title': { en: 'Start your story...', cs: 'Kam se vydáme?' },
  'chat_welcome_desc': { en: 'Describe your vibe. E.g. "Foodie trip to Tokyo in December for 2 people."', cs: 'Popište svou ideální cestu. Např: "V prosinci do Tokia pro dva, milujeme jídlo."' },
  'chat_input_placeholder': { en: 'Describe your expedition...', cs: 'Napište sem...' },
  'chat_launch_expedition': { en: 'Launch Expedition', cs: 'Spustit Výpravu' },

  // Map
  'map_offline': { en: 'Map Interface Offline', cs: 'Mapa je offline' },
  'map_error': { en: 'The map encountered a glitch. Please try refreshing.', cs: 'V mapě došlo k chybě. Zkuste prosím stránku obnovit.' },
  'map_recover': { en: 'Recover', cs: 'Obnovit' },
  'map_duration': { en: 'min duration', cs: 'min trvání' },
  'map_add_to_day': { en: 'Add to Day', cs: 'Přidat do dne' },
  'map_in_day': { en: 'In Day', cs: 'V dni' },
  'map_details': { en: 'Details', cs: 'Detaily' },
  'map_open_google_maps': { en: 'Open in Google Maps', cs: 'Otevřít v Google Maps' },
  'map_open_maps': { en: 'Open in Maps', cs: 'Otevřít v Mapách' },
};
