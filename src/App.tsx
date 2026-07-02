import React, { useState, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { useItineraryState } from './useItineraryState';
import { LandingPage } from './components/LandingPage';
import { TravelPortal } from './components/TravelPortal';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { TreasureHuntGame } from './components/characters/TreasureHuntGame';
import { Trip } from './data';

function TripRouteWrapper({ trips, activeTripId, activeTrip, setActiveTripId, itinerary, days, regenerateAssets, isGeneratingLibrary, ...props }: any) {
  const { tripId } = useParams<{ tripId: string }>();

  useEffect(() => {
    if (tripId && tripId !== activeTripId) {
      setActiveTripId(tripId);
    }
  }, [tripId, activeTripId, setActiveTripId]);

  if (!activeTripId || !activeTrip || activeTripId !== tripId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="text-xl animate-pulse">Loading itinerary...</div>
      </div>
    );
  }

  return (
    <TravelPortal
      trips={trips}
      activeTripId={activeTripId}
      activeTrip={activeTrip}
      itinerary={itinerary}
      days={days}
      setActiveTripId={setActiveTripId}
      regenerateAssets={regenerateAssets}
      isGeneratingLibrary={isGeneratingLibrary}
      {...props}
    />
  );
}

function LandingRouteWrapper({ trips, createTrip, setActiveTripId, deleteTrip, lang, setLang, theme, setTheme }: any) {
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTripId(null);
  }, [setActiveTripId]);

  const handleCreateTrip = async (data: Partial<Trip>) => {
    const id = await createTrip(data);
    navigate(`/trip/${id}`);
    return id;
  };

  const handleSelectTrip = (id: string) => {
    setActiveTripId(id);
    navigate(`/trip/${id}`);
  };

  return (
    <LandingPage
      trips={trips}
      onCreateTrip={handleCreateTrip}
      onSelectTrip={handleSelectTrip}
      onDeleteTrip={deleteTrip}
      lang={lang}
      onLanguageToggle={(l) => setLang(l)}
      theme={theme}
      onThemeToggle={() => setTheme((p: string) => p === 'dark' ? 'light' : 'dark')}
    />
  );
}

function MinigameRouteWrapper({ lang }: { lang: 'en' | 'cs' }) {
  const navigate = useNavigate();
  return (
    <TreasureHuntGame
      isOpen={true}
      onClose={() => navigate('/')}
      language={lang}
    />
  );
}

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
    removeFromLibrary,
    regenerateAssets,         // <-- Exported correctly from useItineraryState
    isGeneratingLibrary
  } = useItineraryState();

  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  const [notifications, setNotifications] = useState<{ id: string, message: string, type: 'error' | 'warning' }[]>([]);

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

  return (
    <APIProvider apiKey={mapsApiKey} libraries={['places', 'routes']}>
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
          {notifications.map(n => (
            <div key={n.id} className={`p-4 rounded shadow-lg text-sm max-w-sm pointer-events-auto ${n.type === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
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
      <Routes>
        <Route path="/" element={
          <LandingRouteWrapper
            trips={trips}
            createTrip={createTrip}
            setActiveTripId={setActiveTripId}
            deleteTrip={deleteTrip}
            lang={lang}
            setLang={setLang}
            theme={theme}
            setTheme={setTheme}
          />
        } />
        <Route path="/trip/:tripId" element={
          <TripRouteWrapper
            trips={trips}
            activeTripId={activeTripId}
            activeTrip={activeTrip}
            itinerary={itinerary}
            days={days}
            setActiveTripId={setActiveTripId}
            addPoi={addPoi}
            removePoi={removePoi}
            clearDay={clearDay}
            clearItinerary={clearItinerary}
            updateTrip={updateTrip}
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
            regenerateAssets={regenerateAssets} // <-- Passed down to Wrapper
            isGeneratingLibrary={isGeneratingLibrary} // <-- Passed down to Wrapper
            lang={lang}
            setLang={setLang}
            theme={theme}
            setTheme={setTheme}
          />
        } />
        <Route path="/minigame" element={<MinigameRouteWrapper lang={lang as 'en' | 'cs'} />} />
      </Routes>
    </APIProvider>
  );
}