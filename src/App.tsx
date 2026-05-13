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
    updatePoi,
    movePoi,
    modifyPoi,
    reorderPois,
    addStay,
    removeStay,
    modifyStay,
    addFlight,
    removeFlight,
    addDay,
    removeDay,
    setDayTheme,
    addToLibrary,
    removeFromLibrary
  } = useItineraryState();

  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'error' | 'warning'}[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.body.className = theme === 'dark' ? 'bg-zinc-950 text-slate-100' : 'bg-[#FCFCFD] text-slate-900';
  }, [theme]);

  useEffect(() => {
    const handleLeaked = (e: any) => {
      const keyPrefix = e.detail?.keyPrefix || 'Unknown';
      const id = Date.now().toString();
      setNotifications(prev => [...prev, {
        id,
        message: `API Key Leaked (${keyPrefix}...). It has been permanently blocked. Rotated to next key.`,
        type: 'error'
      }]);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 8000);
    };

    const handleError = (e: any) => {
      const keyPrefix = e.detail?.keyPrefix || 'Unknown';
      const cooldownSec = e.detail?.cooldownSec || 3600;
      const id = Date.now().toString() + Math.random();
      setNotifications(prev => [...prev, {
        id,
        message: `API Key Error (${keyPrefix}...). Temporarily blocked for ${Math.round(cooldownSec / 60)} minutes. Rotated to next key.`,
        type: 'warning'
      }]);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 6000);
    };

    window.addEventListener('gemini-key-leaked', handleLeaked);
    window.addEventListener('gemini-key-error', handleError);

    return () => {
      window.removeEventListener('gemini-key-leaked', handleLeaked);
      window.removeEventListener('gemini-key-error', handleError);
    };
  }, []);

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
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
          {notifications.map(n => (
            <div key={n.id} className={`p-4 rounded shadow-lg text-sm max-w-sm pointer-events-auto ${
              n.type === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
            }`}>
              <div className="flex items-start justify-between">
                <span>{n.message}</span>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                  className="ml-4 opacity-80 hover:opacity-100"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
        movePoi={movePoi}
        modifyPoi={modifyPoi}
        reorderPois={reorderPois}
        addStay={addStay}
        removeStay={removeStay}
        modifyStay={modifyStay}
        addFlight={addFlight}
        removeFlight={removeFlight}
        addDay={addDay}
        removeDay={removeDay}
        setDayTheme={setDayTheme}
        addToLibrary={addToLibrary}
        removeFromLibrary={removeFromLibrary}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
      />
    </APIProvider>
  );
}
