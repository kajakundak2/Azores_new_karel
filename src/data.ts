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
  title: { en: string; cs: string; [key: string]: string; };
  description?: { en: string; cs: string; [key: string]: string; };
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
  googlePlaceId?: string; // New: Google Place ID for matching
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
    en: 'EXPEDITIONS',
    cs: 'EXPEDICE',
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
  itinerary_label: {
    en: 'EXPEDITION LOG',
    cs: 'DENÍK EXPEDICE',
  },
  atlas_title: { en: 'EXPEDITION ATLAS', cs: 'ATLAS EXPEDICE' },
  inspiration_title: { en: 'FIELD INTEL', cs: 'TERÉNNÍ PRŮZKUM' },
  empty_logbook: {
    en: 'NO PREVIOUS MISSIONS',
    cs: 'ŽÁDNÉ PŘEDCHOZÍ MISE'
  },
  travelers: {
    en: 'Travelers',
    cs: 'Cestovatelé'
  },
  name: { en: 'Name', cs: 'Jméno' },
  chat_title: {
    en: 'Chat with Sára',
    cs: 'Chat se Sárou',
  },
  chat_placeholder: {
    en: 'Ask Sára anything...',
    cs: 'Zeptej se Sáry na cokoliv...'
  },
  drag_prompt: {
    en: 'Drag places here\nto build the day',
    cs: 'Přetáhněte místa sem\na sestavte den',
  },
  add_to_day: {
    en: 'Add to Day',
    cs: 'Přidat do dne',
  },
  travelers_count: {
    en: 'TRAVELERS: {{count}}',
    cs: 'CESTOVATELÉ: {{count}}'
  },
  days_count: {
    en: 'MISSION DURATION: {{count}} DAYS',
    cs: 'DÉLKA MISE: {{count}} DNŮ',
  },
  remove: {
    en: 'Remove',
    cs: 'Odebrat',
  },
  // Detail keys
  poi_directions: { en: 'Directions', cs: 'Navigovat' },
  poi_save_to_day: { en: 'Save to Day', cs: 'Uložit do dne' },
  poi_book_online: { en: 'Book Online', cs: 'Rezervovat online' },
  poi_no_description: { 
    en: 'Detailed intelligence pending. Sára can run a localized analysis for you.', 
    cs: 'Podrobné informace zatím chybí. Sára pro vás může provést lokalizovanou analýzu.' 
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
  packing_btn: { en: 'Checklist', cs: 'Seznam' },
  packing_ready: { en: 'Ready', cs: 'Připraveno' },
  packing_in_progress: { en: 'Prep', cs: 'Příprava' },
  packing_cat_clothing: { en: 'Clothing', cs: 'Oblečení' },
  packing_cat_electronics: { en: 'Electronics', cs: 'Elektronika' },
  packing_cat_documents: { en: 'Documents', cs: 'Dokumenty' },
  packing_cat_toiletries: { en: 'Hygienics', cs: 'Hygiena' },
  packing_cat_health: { en: 'Health', cs: 'Zdraví' },
  packing_cat_misc: { en: 'Misc', cs: 'Ostatní' },
  stays_btn: { en: 'Stays', cs: 'Ubytování' },
  age_children: { cs: 'Věk dětí', en: "Children's Ages" },
  planning_strategy: { cs: 'Strategie plánování', en: 'Planning Strategy' },
  strategy_full: { cs: 'Kompletní plán', en: 'Full Schedule' },
  strategy_suggestions: { cs: 'Jen návrhy', en: 'Suggestions Only' },
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
  units_person: { cs: 'os', en: 'person' },
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
    en: 'Scanning for local intel...',
    cs: 'Skenuji místní data...',
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
  atlas_library_title: {
    en: 'EXPEDITION ATLAS',
    cs: 'ATLAS EXPEDICE',
  },
  search_visible_only: { en: 'Visible area only', cs: 'Pouze viditelná oblast' },
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
  chat_header_title: { en: 'Sára AI Agent', cs: 'Sára AI Agent' },
  chat_ready_status: { en: 'Live & Ready', cs: 'Na příjmu' },
  chat_welcome_title: { en: 'How can I help you?', cs: 'Jak vám mohu pomoci?' },
  chat_welcome_desc: { en: 'Plan your trip, find hidden gems, or check local weather with Sára.', cs: 'Naplánujte si cestu, objevte skrytá místa nebo zkontrolujte počasí se Sárou.' },
  chat_input_placeholder: { en: 'Message Sára...', cs: 'Napište Sáře...' },
  chat_launch_expedition: { en: 'Launch Expedition', cs: 'Spustit expedici' },
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
  transport_departs: { en: 'Departs', cs: 'Odjezd' },
  transit_arrives: { en: 'Arrives', cs: 'Příjezd' },
  transit_wait: { en: 'Wait for transit', cs: 'Čekejte na spoj' },
  transit_end: { en: 'End', cs: 'Konec' },
  transit_schedule: { en: 'Schedule', cs: 'Rozvrh' },
  transit_other_times: { en: 'Other Depatures', cs: 'Další odjezdy' },
  // Intel
  intel_title: { en: 'Trip Intel', cs: 'Přehled cesty' },
  intel_overview: { en: 'Overview', cs: 'Přehled' },
  intel_schedule: { en: 'Trip Schedule', cs: 'Rozvrh cesty' },
  intel_phase: { en: 'Phase', cs: 'Fáze' },
  intel_timestamp: { en: 'Timestamp', cs: 'Čas' },
  intel_trip_start: { en: 'Trip Start', cs: 'Začátek cesty' },
  intel_trip_end: { en: 'Trip End', cs: 'Konec cesty' },
  karel_pedro_arrival: { en: 'KAREL & PEDRO ARRIVAL', cs: 'PŘÍLET KAREL & PEDRO' },
  touchdown_time: { en: '07:30 AM / TOUCHDOWN', cs: '07:30 / PŘISTÁNÍ' },
  intel_warning: { en: 'Check arrival times for local transport. Renting a car is often mission-critical for efficient logistics.', cs: 'Zkontrolujte časy příjezdů pro místní dopravu. Pronájem auta je často klíčový pro efektivní logistiku.' },
  intel_accommodations: { en: 'Accommodations', cs: 'Ubytování' },
  intel_stay_badge: { en: 'STAY', cs: 'POBYT' },
  intel_no_stays: { en: 'No stays identified.', cs: 'Žádné ubytování nebylo nalezeno.' },
  intel_open_map: { en: 'Open Full Trip Map', cs: 'Otevřít celou mapu cesty' },
  // App/TopBar
  share_trip: { en: 'Share Trip', cs: 'Sdílet cestu' },
  add_to_itinerary: { en: 'Add to Itinerary', cs: 'Přidat do itineráře' },
  total_nights: { en: 'Total Nights', cs: 'Celkem nocí' },
  total_budget: { en: 'Total Budget', cs: 'Celkový rozpočet' },
  total: { en: 'Total', cs: 'Celkem' },
  find_stay: { en: 'Find Stay', cs: 'Najít ubytování' },
  stays_list: { en: 'Stays List', cs: 'Seznam ubytování' },
  stay_search_placeholder: { en: 'Accommodation name or address...', cs: 'Název ubytování nebo adresa...' },
  save_changes: { en: 'Save Changes', cs: 'Uložit změny' },
  cancel: { en: 'Cancel', cs: 'Zrušit' },
  back_to_list: { en: 'Back to list', cs: 'Zpět na seznam' },
  stays_checkin: { en: 'Check-in', cs: 'Check-in' },
  stays_checkout: { en: 'Check-out', cs: 'Check-out' },
  price_per_night: { en: 'Price per night', cs: 'Cena za noc' },
  stays_empty: { en: 'No accommodations found. Use the search to add your first stay.', cs: 'Žádné ubytování nebylo nalezeno. Použijte hledání pro přidání prvního pobytu.' },
  // Landing
  saved_count: { en: 'Saved', cs: 'Uloženo' },
  online: { en: 'Online', cs: 'Online' },
  hello: { en: 'Hey! 👋', cs: 'Ahoj! 👋' },
  // Map
  map_offline: { en: 'Map Interface Offline', cs: 'Mapa je offline' },
  map_error: { en: 'The map encountered a glitch. Please try refreshing.', cs: 'V mapě došlo k chybě. Zkuste stránku obnovit.' },
  map_recover: { en: 'Recover', cs: 'Obnovit' },
  map_duration: { en: 'min', cs: 'min' },
  map_add_to_day: { en: 'Add to Day', cs: 'Přidat do dne' },
  map_in_day: { en: 'In Day', cs: 'V dni' },
  map_details: { en: 'Details', cs: 'Detaily' },
  map_open_google_maps: { en: 'Open in Google Maps', cs: 'Otevřít v Google Mapách' },
  map_open_maps: { en: 'Open Maps', cs: 'Otevřít Mapy' },
  map_preview: { en: 'Preview', cs: 'Náhled' },
  unknown_place: { en: 'Unknown Place', cs: 'Neznámé místo' },
  topbar_exit: { en: 'Exit', cs: 'Odejít' },
  topbar_trip_title_placeholder: { en: 'Trip Title', cs: 'Název cesty' },
  topbar_destination_placeholder: { en: 'Destination', cs: 'Destinace' },
  poi_details_error: { en: 'Could not fetch details', cs: 'Nelze načíst informace' },
  poi_entrance_fees_hint: { en: 'Check for entrance fees', cs: 'Zkontrolujte případné vstupné' },
  poi_ai_details_btn: { en: 'AI Details (Sára)', cs: 'AI Detaily (Sára)' },
  sara_added_notification: { en: 'Sára added activity to Day', cs: 'Sára přidala aktivitu do dne' },
  sara_removed_notification: { en: 'Sára removed activity from Day', cs: 'Sára odebrala aktivitu ze dne' },
  itinerary_video_loading: { en: 'Discovering...', cs: 'Objevování...' },
  // Consolidated redundant library labels
  search_results_label: { en: 'Intelligence Match', cs: 'Nalezená data' },
  transit_calculating: { en: 'Calculating route...', cs: 'Počítám trasu...' },
  transit_estimated: { en: 'estimated', cs: 'odhad' },
  transit_stops: { en: 'stops', cs: 'zastávek' },
  transit_no_route: { en: 'No route available', cs: 'Trasa nedostupná' },
  poi_free: { en: 'Free', cs: 'Zdarma' },
  timeline_per_person_est: { en: 'Per Person Est.', cs: 'Odhad na osobu' },
  syncing_sara: { en: 'Syncing with Sára', cs: 'Synchronizace se Sárou' },
  recent_trips: { en: 'Recent Trips', cs: 'Nedávné cesty' },
  sidekick_woohoo: { en: 'Woohoo! 🎉', cs: 'Jupí! 🎉' },
  dropped_pin: { en: 'Dropped Pin', cs: 'Přidaný bod' },
  // ═══════════════════════════════════════════
  // Treasure Hunt Grid Game
  // ═══════════════════════════════════════════
  game_title: { en: 'Vacation Disasters', cs: 'Prázdninové Katastrofy' },
  game_subtitle: { en: 'The Ultimate Treasure Hunt', cs: 'Ultimátní Hon na Poklad' },
  game_select_character: { en: 'Choose Your Explorer', cs: 'Vyber si průzkumníka' },
  game_select_difficulty: { en: 'Select Difficulty', cs: 'Vyber obtížnost' },
  game_easy: { en: 'Easy', cs: 'Lehká' },
  game_medium: { en: 'Medium', cs: 'Střední' },
  game_hard: { en: 'Hard', cs: 'Těžká' },
  game_easy_desc: { en: '6×6 grid · 5 disasters', cs: '6×6 mřížka · 5 katastrof' },
  game_medium_desc: { en: '8×8 grid · 10 disasters', cs: '8×8 mřížka · 10 katastrof' },
  game_hard_desc: { en: '10×10 grid · 18 disasters', cs: '10×10 mřížka · 18 katastrof' },
  game_patience: { en: 'Patience', cs: 'Trpělivost' },
  game_score: { en: 'Score', cs: 'Skóre' },
  game_flags: { en: 'Flags', cs: 'Vlajky' },
  game_time: { en: 'Time', cs: 'Čas' },
  game_start_adventure: { en: 'Start Adventure!', cs: 'Začít dobrodružství!' },
  game_disaster_hit: { en: 'Disaster!', cs: 'Katastrofa!' },
  game_gear_beach: { en: '🏄 Beach Gear Found!', cs: '🏄 Plážové vybavení nalezeno!' },
  game_gear_ocean: { en: '🤿 Diving Gear Found!', cs: '🤿 Potápěčské vybavení nalezeno!' },
  game_gear_snow: { en: '⛷️ Ski Gear Found!', cs: '⛷️ Lyžařské vybavení nalezeno!' },
  game_gear_jungle: { en: '🚙 Jeep Keys Found!', cs: '🚙 Klíče od Jeepu nalezeny!' },
  game_terrain_locked: { en: 'Find the gear to explore this terrain!', cs: 'Najdi vybavení k průzkumu tohoto terénu!' },
  game_beach_locked: { en: 'Need Beach Gear 🏄', cs: 'Potřebuješ plážové vybavení 🏄' },
  game_ocean_locked: { en: 'Need Diving Gear 🤿', cs: 'Potřebuješ potápěčské vybavení 🤿' },
  game_snow_locked: { en: 'Need Ski Gear ⛷️', cs: 'Potřebuješ lyžařské vybavení ⛷️' },
  game_jungle_locked: { en: 'Need Jeep Keys 🚙', cs: 'Potřebuješ klíče od Jeepu 🚙' },
  game_won_title: { en: 'TREASURE FOUND!', cs: 'POKLAD NALEZEN!' },
  game_over_title: { en: 'VACATION RUINED!', cs: 'DOVOLENÁ ZNIČENA!' },
  game_over_subtitle: { en: "We're exhausted. Let's just go home.", cs: 'Jsme vyčerpaní. Pojďme domů.' },
  game_play_again: { en: 'Play Again', cs: 'Hrát znovu' },
  game_save_score: { en: 'Save Score', cs: 'Uložit skóre' },
  game_leaderboard: { en: 'Leaderboard', cs: 'Žebříček' },
  game_daily: { en: 'Today', cs: 'Dnes' },
  game_alltime: { en: 'All Time', cs: 'Celkově' },
  game_enter_name: { en: 'Your explorer name...', cs: 'Jméno průzkumníka...' },
  game_perfect_bonus: { en: 'PERFECT! No disasters hit!', cs: 'PERFEKTNÍ! Žádné katastrofy!' },
  game_speed_bonus: { en: 'Speed Bonus', cs: 'Bonus za rychlost' },
  game_hearts_bonus: { en: 'Hearts Bonus', cs: 'Bonus za životy' },
  game_reveal_hint: { en: 'Left click: Reveal · Right click: Flag', cs: 'Levé tlačítko: Odkrýt · Pravé: Vlajka' },
  game_generating_disaster: { en: 'Generating disaster...', cs: 'Generuji katastrofu...' },
  game_close: { en: 'Close', cs: 'Zavřít' },
  game_biome_beach: { en: 'Beach', cs: 'Pláž' },
  game_biome_ocean: { en: 'Ocean', cs: 'Oceán' },
  game_biome_snow: { en: 'Mountains', cs: 'Hory' },
  game_biome_jungle: { en: 'Jungle', cs: 'Džungle' },
  treasure_help_find: { en: 'HELP US FIND THE TREASURE!', cs: 'POMOZ NÁM NAJÍT POKLAD!' },
  treasure_found: { en: 'TREASURE FOUND!', cs: 'POKLAD NALEZEN!' },
  treasure_enter_name: { en: 'Your explorer name...', cs: 'Jméno průzkumníka...' },
  treasure_save_score: { en: 'Save', cs: 'Uložit' },
  treasure_leaderboard: { en: 'Leaderboard', cs: 'Žebříček' },
};
