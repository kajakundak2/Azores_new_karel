import React, { useState } from 'react';
import { Star, MapPin, Clock, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { POI, TEXTS } from '../data';

interface PoiDetailModalProps {
  poi: POI;
  lang: any;
  onClose: () => void;
  onAdd?: () => void;
  activeDayIndex?: number;
  theme: 'light' | 'dark';
  currency: 'EUR' | 'CZK' | 'USD';
  rates: Record<string, number>;
}

export function PoiDetailModal({ poi, lang, onClose, onAdd, activeDayIndex, theme, currency, rates }: PoiDetailModalProps) {
  const t = (key: string) => TEXTS[key]?.[lang] || key;
  const [currentImg, setCurrentImg] = useState(0);

  const getConvertedPrice = () => {
    if (!poi.priceInEuro) return null;
    const numericPart = poi.priceInEuro.replace(/[^0-9.]/g, '');
    const amount = parseFloat(numericPart);
    if (isNaN(amount)) return poi.priceInEuro; // Fallback to original string

    const rate = rates[currency] || 1;
    const finalAmount = amount * rate;

    return new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-US', {
      style: 'currency',
      currency: currency
    }).format(finalAmount);
  };

  const convertedPrice = getConvertedPrice();


  if (!poi) return null;

  const images = (poi.images && poi.images.length > 0) ? poi.images : [poi.imageUrl];
  const gmapsLink = poi.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${poi.location?.lat},${poi.location?.lng}`;

  const nextImg = () => setCurrentImg((i) => (i + 1) % images.length);
  const prevImg = () => setCurrentImg((i) => (i - 1 + images.length) % images.length);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-6 overflow-hidden">
      {/* Backdrop - reduced opacity for map visibility */}
      <div 
        className="absolute inset-0 bg-zinc-950/60 transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className={`relative w-full max-w-2xl rounded-none md:rounded-[32px] overflow-hidden shadow-2xl flex flex-col z-10 h-full md:h-auto md:max-h-[90vh] border transition-all duration-500 ${theme === 'dark' ? 'bg-zinc-950 border-white/10' : 'bg-white border-slate-200'}`}>
        
        {/* Header: Panoramic Images */}
        <div className="relative w-full h-64 md:h-80 bg-slate-200 shrink-0 group">
           <img 
            src={images[currentImg]} 
            alt={poi.title[lang]} 
            className="w-full h-full object-cover"
          />
          
          {/* Top Controls */}
          <div className="absolute top-4 left-4 right-4 flex justify-between z-20">
            <button 
              onClick={onClose}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${theme === 'dark' ? 'bg-zinc-800/90 text-white hover:bg-zinc-700' : 'bg-white/90 text-slate-800 hover:bg-white'}`}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
               <a 
                href={gmapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${theme === 'dark' ? 'bg-zinc-800/90 text-blue-400 hover:bg-zinc-700' : 'bg-white/90 text-blue-600 hover:bg-white'}`}
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </div>

          {images.length > 1 && (
            <>
              <button 
                onClick={prevImg}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={nextImg}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Content Section */}
        <div className={`flex-1 overflow-y-auto p-6 md:p-8 flex flex-col custom-scrollbar ${theme === 'dark' ? 'bg-zinc-950' : 'bg-white'}`}>
          
          {/* Title and Stats */}
          <div className="mb-6 text-left">
            <h2 className={`text-2xl md:text-3xl font-black mb-1 uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{poi.title[lang]}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
               {poi.rating && (
                <div className="flex items-center gap-1">
                  <span className={`font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{poi.rating}</span>
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(poi.rating!) ? 'fill-current' : ''}`} />
                    ))}
                  </div>
                  <span className={`font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>({poi.reviewCount})</span>
                </div>
              )}
              <span className="text-slate-500">•</span>
              <span className="text-slate-500">{poi.category}</span>
              {convertedPrice && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className={`font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {convertedPrice}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className={`flex items-center gap-3 mb-8 pb-8 border-b overflow-x-auto no-scrollbar ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
             <a 
              href={gmapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all text-sm shrink-0 shadow-lg ${theme === 'dark' ? 'shadow-blue-900/50 hover:shadow-blue-600/40' : 'shadow-blue-200 hover:shadow-blue-300'}`}
            >
              <MapPin className="w-4 h-4" />
              {t('poi_directions')}
            </a>
            {onAdd && activeDayIndex !== undefined && (
              <button
                onClick={onAdd}
                className={`flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full transition-all text-sm shrink-0 shadow-lg ${theme === 'dark' ? 'shadow-emerald-900/50 hover:shadow-emerald-600/40' : 'shadow-emerald-200 hover:shadow-emerald-300'}`}
              >
                {t('poi_save_to_day')} {activeDayIndex + 1}
              </button>
            )}
             {poi.bookingLink && (
               <a 
                href={poi.bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-6 py-2.5 border font-black rounded-full transition-colors text-sm shrink-0 shadow-sm ${theme === 'dark' ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
              >
                <ExternalLink className="w-4 h-4" />
                {t('poi_book_online')}
              </a>
            )}
          </div>

          {/* Details List */}
          <div className="space-y-6 text-[15px]">
            {poi.address && (
              <div className={`flex items-start gap-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>
                <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <span>{poi.address}</span>
              </div>
            )}
            
            <div className={`flex items-start gap-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>
              <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <span>{Math.floor(poi.duration / 60)}h {poi.duration % 60 > 0 ? `${poi.duration % 60}m` : ''}{t('poi_duration_suffix')}</span>
            </div>

            <div className={`pt-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
              <p className={`leading-relaxed italic ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {poi.description?.[lang] || poi.description?.en || t('poi_no_description')}
              </p>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
