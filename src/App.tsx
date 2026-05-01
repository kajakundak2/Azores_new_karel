import React, { useState, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { useItineraryState } from './useItineraryState';
import { LandingPage } from './components/LandingPage';
import { TravelPortal } from './components/TravelPortal';

export default function App() {
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  const { 
    trips, 
    activeTripId, 
    activeTrip, 
    itinerary, 
    addPoi, 
    removePoi, 
    clearDay,
    clearItinerary,
    updateTrip,
    deleteTrip,
    days,
    addReferenceDoc,
    setActiveTripId,
    createTrip,
    updatePoiTransportMode,
    updatePoi
  } = useItineraryState();

  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.body.className = theme === 'dark' ? 'bg-zinc-950 text-slate-100' : 'bg-[#FCFCFD] text-slate-900';
  }, [theme]);

  if (!activeTripId || !activeTrip) {
    return (
      <APIProvider apiKey={mapsApiKey} libraries={['places', 'routes']}>
        <LandingPage 
          trips={trips} 
          onCreateTrip={createTrip} 
          onSelectTrip={setActiveTripId} 
          onDeleteTrip={deleteTrip} 
          lang={lang} 
          onLanguageToggle={(l) => setLang(l)}
          theme={theme} 
          onThemeToggle={() => setTheme(p => p === 'dark' ? 'light' : 'dark')} 
        />
      </APIProvider>
    );
  }

  return (
    <APIProvider apiKey={mapsApiKey} libraries={['places', 'routes']}>
      <TravelPortal
        trips={trips}
        activeTripId={activeTripId}
        activeTrip={activeTrip}
        itinerary={itinerary}
        days={days}
        addPoi={addPoi}
        removePoi={removePoi}
        clearDay={clearDay}
        clearItinerary={clearItinerary}
        updateTrip={updateTrip}
        setActiveTripId={setActiveTripId}
        updatePoiTransportMode={updatePoiTransportMode}
        updatePoi={updatePoi}
        addReferenceDoc={addReferenceDoc}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
      />
    </APIProvider>
  );
}
