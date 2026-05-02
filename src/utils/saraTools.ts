/**
 * saraTools.ts — Single Source of Truth for Sara AI Capabilities
 * 
 * Both Chat (useItineraryAI) and Live Voice (useLiveGemini) import
 * tool declarations from here to guarantee 1:1 parity.
 */

/**
 * Returns the complete set of function declarations for both Chat and Live Voice.
 * @param destination - The current trip destination, used in tool descriptions.
 */
export function getToolDeclarations(destination: string = 'the destination') {
  return [
    // ═══════════════════════════════════════════════════
    // EXISTING TOOLS (unified naming)
    // ═══════════════════════════════════════════════════
    {
      name: 'searchGooglePlaces',
      description: `Search for a real point of interest, restaurant, trail, hotel, or location near ${destination}. Returns real places with photos, ratings, and coordinates.`,
      parameters: {
        type: 'OBJECT',
        properties: { query: { type: 'STRING', description: 'Search query for the place.' } },
        required: ['query']
      }
    },
    {
      name: 'remove_from_itinerary',
      description: 'Remove a specific activity from the itinerary. Use day number and the activity title to identify it.',
      parameters: {
        type: 'OBJECT',
        properties: {
          day: { type: 'NUMBER', description: 'Day number (1-based).' },
          activity: { type: 'STRING', description: 'Title or name of the activity to remove.' }
        },
        required: ['day', 'activity']
      }
    },
    {
      name: 'trigger_smart_itinerary_generation',
      description: 'Generate or regenerate a complete detailed day-by-day itinerary with real places, food, transport. Use when the user asks to plan everything, create the whole trip, fill in days, or regenerate specific days.',
      parameters: {
        type: 'OBJECT',
        properties: {
          intensity: { type: 'STRING', enum: ['relaxed', 'balanced', 'packed'], description: 'The pace/density of the trip.' },
          dayNumbers: { type: 'ARRAY', items: { type: 'NUMBER' }, description: 'Specific day numbers to regenerate (1-based). Leave empty for full trip.' }
        }
      }
    },
    {
      name: 'clear_day',
      description: 'Clear all non-fixed activities from a specific day.',
      parameters: {
        type: 'OBJECT',
        properties: { day: { type: 'NUMBER', description: 'The day number to clear (e.g., 1 for Day 1).' } },
        required: ['day']
      }
    },
    {
      name: 'clear_itinerary',
      description: 'Clear all non-fixed activities from the entire itinerary across all days.',
      parameters: { type: 'OBJECT', properties: {} }
    },
    {
      name: 'update_itinerary',
      description: 'Powerful AI agent for complex, bulk, or conditional itinerary changes. Use this when the user wants to: replan multiple days, swap days, add/remove activities based on conditions (e.g. "add lunch everywhere", "remove all hikes", "make day 3 more relaxed"), reorganize the whole trip, or any multi-step modification. Pass the full natural-language request.',
      parameters: {
        type: 'OBJECT',
        properties: { request: { type: 'STRING', description: 'The full natural-language modification request from the user.' } },
        required: ['request']
      }
    },
    {
      name: 'update_trip_details',
      description: 'Update high-level trip parameters: destination, dates, number of travelers, preferences, packing requirements.',
      parameters: {
        type: 'OBJECT',
        properties: {
          destination: { type: 'STRING', description: 'New trip destination.' },
          title: { type: 'STRING', description: 'New trip title.' },
          startDate: { type: 'STRING', description: 'Start date (YYYY-MM-DD).' },
          endDate: { type: 'STRING', description: 'End date (YYYY-MM-DD).' },
          adults: { type: 'NUMBER', description: 'Number of adult travelers.' },
          kids: { type: 'NUMBER', description: 'Number of children.' },
          kidsAges: { type: 'ARRAY', items: { type: 'NUMBER' }, description: 'Ages of the kids.' },
          preferences: { type: 'STRING', description: 'General travel preferences (e.g. "Foodie, Nature, Active").' },
          planningMode: { type: 'STRING', enum: ['relaxed', 'balanced', 'packed'], description: 'Trip intensity/pace.' }
        }
      }
    },

    // ═══════════════════════════════════════════════════
    // NEW ATOMIC TOOLS
    // ═══════════════════════════════════════════════════
    {
      name: 'modify_poi',
      description: 'Modify a specific field of an existing activity/POI (e.g. change time, duration, cost, category, description, or transport mode).',
      parameters: {
        type: 'OBJECT',
        properties: {
          day: { type: 'NUMBER', description: 'Day number (1-based).' },
          poiTitle: { type: 'STRING', description: 'Title of the POI to modify (partial match allowed).' },
          changes: {
            type: 'OBJECT',
            description: 'Fields to change.',
            properties: {
              time: { type: 'STRING', description: 'New time in HH:MM format.' },
              duration: { type: 'NUMBER', description: 'New duration in minutes.' },
              cost: { type: 'NUMBER', description: 'New cost in EUR.' },
              category: { type: 'STRING', enum: ['Sightseeing', 'Activity', 'Food', 'Transport', 'Special', 'City', 'Event'] },
              description: { type: 'STRING', description: 'New description text.' },
              transportModeTo: { type: 'STRING', enum: ['car', 'bus', 'walk', 'bicycle'], description: 'How to get to this activity.' }
            }
          }
        },
        required: ['day', 'poiTitle', 'changes']
      }
    },
    {
      name: 'move_poi',
      description: 'Move an activity from one day to another day.',
      parameters: {
        type: 'OBJECT',
        properties: {
          fromDay: { type: 'NUMBER', description: 'Source day number (1-based).' },
          toDay: { type: 'NUMBER', description: 'Destination day number (1-based).' },
          poiTitle: { type: 'STRING', description: 'Title of the activity to move.' }
        },
        required: ['fromDay', 'toDay', 'poiTitle']
      }
    },
    {
      name: 'reorder_day',
      description: 'Reorder activities within a day. Provide the activity titles in the desired new order.',
      parameters: {
        type: 'OBJECT',
        properties: {
          day: { type: 'NUMBER', description: 'Day number (1-based).' },
          orderedTitles: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Activity titles in the desired new order.' }
        },
        required: ['day', 'orderedTitles']
      }
    },
    {
      name: 'add_stay',
      description: 'Add an accommodation/hotel to the trip logistics.',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Hotel/accommodation name.' },
          checkInDate: { type: 'STRING', description: 'Check-in date (YYYY-MM-DD).' },
          checkOutDate: { type: 'STRING', description: 'Check-out date (YYYY-MM-DD).' },
          pricePerNight: { type: 'NUMBER', description: 'Price per night in EUR.' },
          address: { type: 'STRING', description: 'Address of the accommodation.' },
          description: { type: 'STRING', description: 'Brief description or notes.' }
        },
        required: ['name', 'checkInDate', 'checkOutDate']
      }
    },
    {
      name: 'remove_stay',
      description: 'Remove an accommodation from the trip by name.',
      parameters: {
        type: 'OBJECT',
        properties: {
          stayName: { type: 'STRING', description: 'Name of the stay to remove (partial match).' }
        },
        required: ['stayName']
      }
    },
    {
      name: 'modify_stay',
      description: 'Modify details of an existing accommodation (dates, price, etc.).',
      parameters: {
        type: 'OBJECT',
        properties: {
          stayName: { type: 'STRING', description: 'Name of the stay to modify.' },
          changes: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              checkInDate: { type: 'STRING' },
              checkOutDate: { type: 'STRING' },
              pricePerNight: { type: 'NUMBER' },
              address: { type: 'STRING' }
            }
          }
        },
        required: ['stayName', 'changes']
      }
    },
    {
      name: 'add_flight',
      description: 'Add a flight record to the trip logistics.',
      parameters: {
        type: 'OBJECT',
        properties: {
          direction: { type: 'STRING', enum: ['outbound', 'inbound'], description: 'Flight direction.' },
          airline: { type: 'STRING', description: 'Airline name.' },
          departureAirport: { type: 'STRING', description: 'Departure airport code (e.g., PRG).' },
          arrivalAirport: { type: 'STRING', description: 'Arrival airport code (e.g., PDL).' },
          departureTime: { type: 'STRING', description: 'Departure time (ISO string).' },
          arrivalTime: { type: 'STRING', description: 'Arrival time (ISO string).' },
          durationMins: { type: 'NUMBER', description: 'Flight duration in minutes.' },
          stops: { type: 'NUMBER', description: 'Number of stops (0 for direct).' },
          price: { type: 'STRING', description: 'Price (e.g., "€250").' }
        },
        required: ['direction', 'airline', 'departureAirport', 'arrivalAirport', 'departureTime', 'arrivalTime']
      }
    },
    {
      name: 'remove_flight',
      description: 'Remove a flight from the trip by direction or airline name.',
      parameters: {
        type: 'OBJECT',
        properties: {
          direction: { type: 'STRING', enum: ['outbound', 'inbound'], description: 'Which flight to remove.' },
          airline: { type: 'STRING', description: 'Airline name to match (optional, for disambiguation).' }
        },
        required: ['direction']
      }
    },
    {
      name: 'add_day',
      description: 'Extend the trip by adding one more day at the end.',
      parameters: { type: 'OBJECT', properties: {} }
    },
    {
      name: 'remove_day',
      description: 'Remove a specific day from the trip (shifts remaining days).',
      parameters: {
        type: 'OBJECT',
        properties: {
          day: { type: 'NUMBER', description: 'Day number to remove (1-based).' }
        },
        required: ['day']
      }
    },
    {
      name: 'set_day_theme',
      description: 'Set or update the theme label for a specific day (e.g., "Beach Day", "Cultural Exploration", "Island Hopping").',
      parameters: {
        type: 'OBJECT',
        properties: {
          day: { type: 'NUMBER', description: 'Day number (1-based).' },
          theme: { type: 'STRING', description: 'The theme label for the day.' }
        },
        required: ['day', 'theme']
      }
    },
    {
      name: 'add_to_library',
      description: 'Save a discovered place/POI to the trip library for potential later use.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Search query to find and save the place.' }
        },
        required: ['query']
      }
    },
    {
      name: 'remove_from_library',
      description: 'Remove a saved place from the trip library.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Title of the library item to remove.' }
        },
        required: ['title']
      }
    },
    {
      name: 'set_traveler_profiles',
      description: 'Record individual traveler details including name, gender, and age for all travelers.',
      parameters: {
        type: 'OBJECT',
        properties: {
          travelers: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                gender: { type: 'STRING', enum: ['male', 'female', 'child', 'unspecified'] },
                age: { type: 'NUMBER' }
              },
              required: ['name', 'gender']
            }
          }
        },
        required: ['travelers']
      }
    },
    {
      name: 'set_packing_requirements',
      description: 'Update packing list requirements (e.g., "hiking gear", "formal dinner outfit", "snorkeling equipment").',
      parameters: {
        type: 'OBJECT',
        properties: {
          requirements: { type: 'STRING', description: 'Comma-separated packing requirements.' }
        },
        required: ['requirements']
      }
    }
  ];
}

/**
 * Capability prompt injected into both Chat and Voice system instructions.
 * Tells Sara exactly what she can do.
 */
export const SARA_CAPABILITIES_PROMPT = `
=== YOUR CAPABILITIES ===
You have full control over every aspect of this trip. You can:

ITINERARY:
- Generate a complete itinerary (trigger_smart_itinerary_generation)
- Make complex/bulk changes like "add lunch everywhere" or "reorganize the trip" (update_itinerary)
- Modify individual activities: change time, duration, cost, category, transport mode (modify_poi)
- Move activities between days (move_poi)
- Reorder activities within a day (reorder_day)
- Remove specific activities (remove_from_itinerary)
- Clear a day or the entire itinerary (clear_day, clear_itinerary)
- Add or remove days from the trip (add_day, remove_day)
- Set day themes like "Beach Day" or "City Exploration" (set_day_theme)

LOGISTICS:
- Add, modify, or remove accommodations/hotels (add_stay, modify_stay, remove_stay)
- Add or remove flight records (add_flight, remove_flight)
- Set packing requirements (set_packing_requirements)

TRAVELERS:
- Update trip details: destination, dates, traveler count (update_trip_details)
- Record individual traveler profiles with names, ages, genders (set_traveler_profiles)

DISCOVERY:
- Search for real places with photos and ratings (searchGooglePlaces)
- Save places to the trip library for later (add_to_library, remove_from_library)

REFERENCE DOCUMENTS:
- You have access to all uploaded documents. Use their content to inform your suggestions.

RULES:
- Always call the most specific tool available (e.g., modify_poi for a single change, update_itinerary for bulk changes).
- When the user refers to "day 3", compute the correct ISO date from the trip start date.
- Always confirm what you did after executing a tool.
`;

/**
 * Shared persona/identity instructions for both Chat and Voice.
 */
export const SARA_IDENTITY_PROMPT = `You are "Sára," the intelligent travel assistant for this trip.

PERSONALITY:
- Warm, knowledgeable, enthusiastic about travel
- Proactive with suggestions but respects the user's preferences
- Suggests visually stunning spots and viral viewpoints
- Recommends local food, hidden gems, and practical tips

LANGUAGE:
- ALWAYS respond in the same language the user uses (English or Czech)
- For Chat: respond as JSON {"en": "...", "cs": "..."} (BOTH languages always)
- For Voice: respond naturally in the user's spoken language

AWARENESS:
- You know the full trip state: itinerary, stays, flights, travelers, budget, library, packing, uploaded documents
- You can see and reference everything the user has set up
- If the user uploaded documents, use that information proactively
`;
