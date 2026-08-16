
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPin, Calendar, BookOpen, ExternalLink, ShoppingBag, ArrowLeft, Image as ImageIcon, ScrollText, Hourglass, Users, AlertTriangle, Loader2, Plane, Compass, Cloud, Sun, CloudRain, CloudLightning, Wind, Youtube, PlayCircle, Star, StarHalf, Backpack } from 'lucide-react';
import { CultureItem } from '../types';

interface InsightsViewProps {
  item: CultureItem;
  onClose: () => void;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
}

interface AnalysisData {
  historicalContext: string;
  ritualStructure: string;
  socialSignificance: string;
  contemporaryChallenges: string;
  tourOperator?: {
    name: string;
    description: string;
    websiteUrl: string;
  };
}

const MiniMapSetup: React.FC<{ coords: [number, number] }> = ({ coords }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(coords, 10);
  }, [map, coords]);
  return null;
};

const VideoEmbed: React.FC<{ vid: any }> = ({ vid }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    return (
      <div className="w-full aspect-video rounded-2xl overflow-hidden relative border border-[#222]">
        <iframe
          src={vid.embedUrl}
          title={vid.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full absolute inset-0 border-0"
        ></iframe>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsPlaying(true)}
      className="w-full aspect-video rounded-2xl overflow-hidden relative border border-[#222] group-hover:border-red-500/50 transition-colors cursor-pointer"
    >
      <img
        src={vid.thumbnail}
        alt={vid.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      />
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
        <PlayCircle className="w-12 h-12 text-white/80 group-hover:text-red-500 group-hover:scale-110 transition-all shadow-2xl rounded-full bg-black/50" />
      </div>
    </div>
  );
};

const StarRating: React.FC<{ rating: number, count?: string }> = ({ rating, count }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-1.5 mt-2 mb-3">
      <div className="flex text-yellow-500">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="w-3.5 h-3.5 fill-current" />
        ))}
        {hasHalfStar && <StarHalf className="w-3.5 h-3.5 fill-current" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="w-3.5 h-3.5 text-gray-700" />
        ))}
      </div>
      <span className="text-[10px] font-bold text-yellow-500/90">{rating.toFixed(2)}</span>
      {count && <span className="text-[9px] text-gray-500 ml-1">({count} ratings)</span>}
    </div>
  );
};

const InsightsView: React.FC<InsightsViewProps> = ({ item, onClose, isSaved, onToggleSave }) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Procedural Dynamic Analysis Synthesis (100% Free, Zero AI)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const generateAnalysis = async () => {
      // 1. Adapt layout structure to the type of event
      const type = item.ritualType?.toLowerCase() || '';
      let headings = {
        h1: 'Origins & Mythos',
        h2: 'Ritual Mechanics',
        h3: 'Social Function',
        h4: 'Contemporary Status'
      };

      if (type.includes('phenomenon')) {
        headings = { h1: 'Scientific Origins', h2: 'Observable Mechanics', h3: 'Cultural Impact', h4: 'Modern Observation' };
      } else if (type.includes('festival')) {
        headings = { h1: 'Historical Origins', h2: 'Festival Traditions', h3: 'Community Significance', h4: 'Contemporary Celebration' };
      } else if (type.includes('spiritual') || type.includes('ceremony')) {
        headings = { h1: 'Spiritual Roots', h2: 'Sacred Mechanics', h3: 'Adherent Function', h4: 'Modern Preservation' };
      }

      // 2. Fetch rich contextual Wikipedia data to fuse with local descriptions
      let wikiText = '';
      const wikiSearch = async (query: string) => {
        try {
          const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=extracts&exintro=1&explaintext=1&format=json&origin=*`;
          const res = await fetch(url);
          const data = await res.json();
          const pages = data.query?.pages;
          if (!pages) return null;
          const pageData = pages[Object.keys(pages)[0]];
          return pageData.extract ? pageData.extract : null;
        } catch { return null; }
      };

      const cleanTitle = item.title.replace(/\s*\(.*?\)\s*/g, '').trim();
      wikiText = (await wikiSearch(item.title)) || (await wikiSearch(cleanTitle)) || '';

      // 3. Synthesize full text blob and split into readable sentences
      let fullText = `${item.description || ''} ${item.insights || ''} ${wikiText}`;
      fullText = fullText.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();

      const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [];
      const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 15);

      // Pad with procedurally generated text if Wikipedia article is too sparse
      const pad1 = `The ${item.title} traces its legacy deep within the cultural landscape of ${item.region}.`;
      const pad2 = `At its core, this ${item.ritualType} acts as a vital expression of local identity and tradition.`;
      const pad3 = `Historically, the event has fundamentally shaped the social fabric and rhythms of life for the community.`;
      const pad4 = `Today, it continues to draw international interest while navigating the complexities of the modern era.`;

      // Distribute extracted sentences organically into 4 distinct phases
      const q = Math.max(1, Math.floor(cleanSentences.length / 4));

      let p1 = cleanSentences.slice(0, q).join(' ') || pad1;
      let p2 = cleanSentences.slice(q, q * 2).join(' ') || pad2;
      let p3 = cleanSentences.slice(q * 2, q * 3).join(' ') || pad3;
      let p4 = cleanSentences.slice(q * 3).join(' ') || pad4;

      // Ensure paragraphs aren't empty
      if (p1.length < 20) p1 = pad1;
      if (p2.length < 20) p2 = pad2;
      if (p3.length < 20) p3 = pad3;
      if (p4.length < 20) p4 = pad4;

      if (isMounted) {
        setAnalysis({
          h1: headings.h1, p1: p1,
          h2: headings.h2, p2: p2,
          h3: headings.h3, p3: p3,
          h4: headings.h4, p4: p4,
          tourOperator: {
            name: item.tourLink ? 'Verified Experience Partner' : `${item.region.split(',')[0].trim()} Local Guides`,
            description: item.tourLink 
              ? `Book a fully curated, expert-led journey specifically designed for the ${item.title}.` 
              : `Search the affiliate network for specialized local experts to experience the authenticity of the ${item.title}.`,
            websiteUrl: item.tourLink || `https://www.tourradar.com/search?q=${encodeURIComponent(item.region)}`
          }
        });
        setLoading(false);
      }
    };

    generateAnalysis();
    return () => { isMounted = false; };
  }, [item]);
  const [heroImage, setHeroImage] = useState(item.imageUrl);
  const [locationName, setLocationName] = useState(item.region);

  const dotIcon = L.divIcon({
    html: `<div style="width: 12px; height: 12px; background: #9fff00; border-radius: 50%; border: 2px solid #000; box-shadow: 0 0 10px rgba(159,255,0,0.8);"></div>`,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });

  // Free Weather & Video State
  const [weather, setWeather] = useState<{ temp: number, code: number, wind: number } | null>(null);
  const [videos, setVideos] = useState<{ id: string, title: string, thumbnail: string }[]>([]);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="w-5 h-5 text-yellow-500" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-5 h-5 text-gray-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="w-5 h-5 text-blue-400" />;
    if (code >= 95) return <CloudLightning className="w-5 h-5 text-purple-400" />;
    return <Cloud className="w-5 h-5 text-gray-500" />;
  };
  const getWeatherDesc = (code: number) => {
    if (code === 0) return 'Clear Sky';
    if (code >= 1 && code <= 3) return 'Partly Cloudy';
    if (code >= 51 && code <= 67) return 'Rain / Drizzle';
    if (code >= 71 && code <= 77) return 'Snowfall';
    if (code >= 95) return 'Thunderstorm';
    return 'Overcast';
  };

  // Load hero image and location cache
  useEffect(() => {
    try {
      const savedImages = localStorage.getItem('kairos_ai_images');
      if (savedImages) {
        const cache = JSON.parse(savedImages);
        if (cache[item.id]) {
          setHeroImage(cache[item.id]);
        }
      }

      const savedLocations = localStorage.getItem('kairos_locations');
      if (savedLocations) {
        const cache = JSON.parse(savedLocations);
        if (cache[item.id]) {
          setLocationName(cache[item.id]);
        }
      }
    } catch (e) {
      console.error("Error loading cached data", e);
    }
  }, [item.id, item.region]);

  // Fetch Open-Meteo Weather (100% Free, No API Key)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${item.coordinates[0]}&longitude=${item.coordinates[1]}&current=temperature_2m,weather_code,wind_speed_10m`);
        const data = await res.json();
        if (data.current) {
          setWeather({
            temp: data.current.temperature_2m,
            code: data.current.weather_code,
            wind: data.current.wind_speed_10m
          });
        }
      } catch (e) {
        console.error("Weather fetch failed", e);
      }
    };
    fetchWeather();
  }, [item.coordinates]);

  // Fetch YouTube Videos (Supports Google API Key or Free Proxy Fallback)
  useEffect(() => {
    const fetchVideos = async () => {
      setIsVideoLoading(true);
      setVideoError(null);
      try {
        const apiKey = (import.meta as any).env ? (import.meta as any).env.VITE_YOUTUBE_API_KEY : undefined;
        const query = encodeURIComponent(`${item.title} ${item.region}`);

        if (apiKey) {
          const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=2&key=${apiKey}`);
          const data = await res.json();
          if (data.items) {
            setVideos(data.items.map((v: any) => ({
              id: v.id.videoId,
              title: v.snippet.title,
              thumbnail: v.snippet.thumbnails.high.url,
              url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
              embedUrl: `https://www.youtube.com/embed/${v.id.videoId}?autoplay=1`
            })));
            return;
          }
        }

        // Strategy 2: Piped API (Highly Stable YouTube Frontend Proxy)
        try {
          const pipedRes = await fetch(`https://pipedapi.kavin.rocks/search?q=${query}&filter=all`, {
            signal: AbortSignal.timeout(5000)
          });
          if (pipedRes.ok) {
            const pipedData = await pipedRes.json();
            if (pipedData.items && pipedData.items.length > 0) {
              setVideos(pipedData.items.slice(0, 2).map((v: any) => {
                const vidId = v.url.split('?v=')[1] || v.url;
                return {
                  id: vidId,
                  title: v.title,
                  thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                  url: `https://www.youtube.com/watch?v=${vidId}`,
                  embedUrl: `https://www.youtube.com/embed/${vidId}?autoplay=1`
                };
              }));
              return;
            }
          }
        } catch (e) {
          console.warn('Piped API failed, triggering Dailymotion fallback', e);
        }

        // Strategy 3: Dailymotion Official API (100% Free, NO API KEY REQUIRED, NO CORS ISSUES)
        try {
          const dmRes = await fetch(`https://api.dailymotion.com/videos?fields=id,title,thumbnail_360_url&search=${query}&limit=2`, {
            signal: AbortSignal.timeout(5000)
          });
          if (dmRes.ok) {
            const dmData = await dmRes.json();
            if (dmData.list && dmData.list.length > 0) {
              setVideos(dmData.list.map((v: any) => ({
                id: v.id,
                title: v.title,
                thumbnail: v.thumbnail_360_url,
                url: `https://www.dailymotion.com/video/${v.id}`,
                embedUrl: `https://www.dailymotion.com/embed/video/${v.id}?autoplay=1`
              })));
              return;
            }
          }
        } catch (e) {
          console.warn('Dailymotion API failed', e);
        }

        // If all 3 free strategies fail or return no videos:
        setVideoError("Public video relays are currently overloaded or no footage exists. Please try again later.");

      } catch (e) {
        setVideoError("Video streams currently unavailable. Please try again later.");
      } finally {
        setIsVideoLoading(false);
      }
    };
    fetchVideos();
  }, [item.title, item.region]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] text-white flex flex-col animate-in overflow-hidden">
      {/* Top Header */}
      <header className="p-6 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0a0a0a]/80 backdrop-blur-xl shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 hover:text-[#9fff00] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Archive
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-gray-600 uppercase tracking-[0.5em] font-bold">In-Depth Analysis</span>
          <h1 className="text-sm font-black text-white tracking-widest uppercase truncate max-w-[200px] md:max-w-md">{item.title}</h1>
        </div>
        <div className="w-24 shrink-0"></div> {/* Spacer for balance */}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left Column: Data & Narrative */}
          <div className="lg:col-span-7 space-y-12">

            {/* Title & Hero Section */}
            <section className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9]">
                  {item.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1.5 border border-[#333] rounded-full text-[10px] uppercase tracking-widest text-gray-400 bg-[#111] leading-none">{item.ritualType}</span>
                  <span className="px-3 py-1.5 border border-[#333] rounded-full text-[10px] uppercase tracking-widest text-gray-400 bg-[#111] leading-none">{item.region}</span>
                  
                  {onToggleSave && (
                    <button
                      onClick={() => onToggleSave(item.id)}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border leading-none ${
                        isSaved 
                          ? 'bg-[#9fff00] text-black border-[#9fff00] shadow-[0_0_15px_rgba(159,255,0,0.3)]' 
                          : 'bg-[#0a0a0a] text-[#9fff00] border-[#333] hover:border-[#9fff00]/50 hover:bg-[#111]'
                      }`}
                    >
                      <Backpack className="w-3.5 h-3.5" />
                      <span>{isSaved ? 'Saved to Itinerary' : 'Save to Itinerary'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Title Photo / Hero Image */}
              <div className="w-full aspect-[21/9] rounded-3xl overflow-hidden border border-[#222] relative group shadow-2xl">
                <img
                  src={heroImage}
                  alt={item.title}
                  className="w-full h-full object-cover transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>
            </section>

            {/* AI Analysis Sections */}
            {loading ? (
              <div className="space-y-8 py-12 animate-pulse">
                <div className="h-4 bg-[#1a1a1a] rounded w-3/4"></div>
                <div className="h-4 bg-[#1a1a1a] rounded w-full"></div>
                <div className="h-4 bg-[#1a1a1a] rounded w-5/6"></div>
                <div className="flex items-center gap-3 text-[#9fff00] mt-8">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs uppercase tracking-widest">Consulting Anthropological Archives...</span>
                </div>
              </div>
            ) : analysis ? (
              <div className="space-y-16">

                {/* 1. Dynamic Section 1 */}
                <div className="space-y-4 group">
                  <div className="flex items-center gap-4 text-[#9fff00]/80 group-hover:text-[#9fff00] transition-colors">
                    <Hourglass className="w-5 h-5" />
                    <h3 className="text-sm font-black uppercase tracking-[0.3em]">{analysis.h1}</h3>
                  </div>
                  <p className="text-lg md:text-xl text-gray-300 font-serif leading-relaxed pl-9 border-l border-[#333] group-hover:border-[#9fff00]/50 transition-colors">
                    {analysis.p1}
                  </p>
                </div>

                {/* 2. Dynamic Section 2 */}
                <div className="space-y-4 group">
                  <div className="flex items-center gap-4 text-blue-400/80 group-hover:text-blue-400 transition-colors">
                    <ScrollText className="w-5 h-5" />
                    <h3 className="text-sm font-black uppercase tracking-[0.3em]">{analysis.h2}</h3>
                  </div>
                  <p className="text-lg md:text-xl text-gray-300 font-serif leading-relaxed pl-9 border-l border-[#333] group-hover:border-blue-400/50 transition-colors">
                    {analysis.p2}
                  </p>
                </div>

                {/* 3. Dynamic Section 3 */}
                <div className="space-y-4 group">
                  <div className="flex items-center gap-4 text-purple-400/80 group-hover:text-purple-400 transition-colors">
                    <Users className="w-5 h-5" />
                    <h3 className="text-sm font-black uppercase tracking-[0.3em]">{analysis.h3}</h3>
                  </div>
                  <p className="text-lg md:text-xl text-gray-300 font-serif leading-relaxed pl-9 border-l border-[#333] group-hover:border-purple-400/50 transition-colors">
                    {analysis.p3}
                  </p>
                </div>

                {/* 4. Dynamic Section 4 */}
                <div className="space-y-4 group">
                  <div className="flex items-center gap-4 text-red-400/80 group-hover:text-red-400 transition-colors">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="text-sm font-black uppercase tracking-[0.3em]">{analysis.h4}</h3>
                  </div>
                  <p className="text-lg md:text-xl text-gray-300 font-serif leading-relaxed pl-9 border-l border-[#333] group-hover:border-red-400/50 transition-colors">
                    {analysis.p4}
                  </p>
                </div>

                {/* 5. Recommended Tour Operator */}
                {analysis.tourOperator && (
                  <div className="mt-12 p-6 bg-[#0f0f0f] border border-[#222] rounded-2xl hover:border-[#9fff00]/30 transition-all group/tour relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/tour:opacity-20 transition-opacity">
                      <Compass className="w-24 h-24 text-[#9fff00]" />
                    </div>
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center gap-3">
                        <Plane className="w-5 h-5 text-[#9fff00]" />
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">Experience This Ritual</h3>
                      </div>
                      <div className="pl-8">
                        <h4 className="text-xl font-bold text-white mb-1">{analysis.tourOperator.name}</h4>
                        <p className="text-sm text-gray-400 mb-4">{analysis.tourOperator.description}</p>
                        <a
                          href={analysis.tourOperator.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#9fff00] text-white hover:text-black rounded-lg text-xs font-bold uppercase tracking-widest transition-all border border-[#333] hover:border-[#9fff00]"
                        >
                          Visit Operator Website <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : null}

            {/* Logistics & Navigation */}
            <section className="space-y-6 pt-12 border-t border-[#1a1a1a]">
              <div className="flex items-center gap-4 text-gray-600">
                <Compass className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Logistics & Routing</span>
              </div>
              <div className="p-6 bg-[#0c0c0c] border border-[#222] rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 text-[#1a1a1a] opacity-50 z-0 pointer-events-none">
                  <MapPin className="w-48 h-48" />
                </div>
                <div className="relative z-10">
                  <h4 className="text-white font-bold text-lg mb-1">Route to Coordinates</h4>
                  <p className="text-gray-400 text-sm mb-4 md:mb-0">
                    Location: <span className="text-white">{item.preciseLocation ? item.preciseLocation : `${item.coordinates[0].toFixed(4)}°, ${item.coordinates[1].toFixed(4)}°`}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 relative z-10 w-full md:w-auto">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${item.coordinates[0]},${item.coordinates[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a1a] hover:bg-blue-500 text-blue-500 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all border border-[#222] hover:border-blue-500"
                  >
                    <MapPin className="w-4 h-4" /> Google Maps
                  </a>
                  <a
                    href={`https://www.rome2rio.com/s/${encodeURIComponent(item.region)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a1a] hover:bg-[#C5A059] text-[#C5A059] hover:text-black rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all border border-[#222] hover:border-[#C5A059]"
                  >
                    <Plane className="w-4 h-4" /> Rome2Rio Transit
                  </a>
                </div>
              </div>
            </section>

            {/* Observation Gallery */}
            {item.gallery && item.gallery.length > 0 && (
              <section className="space-y-6 pt-12 border-t border-[#1a1a1a]">
                <div className="flex items-center gap-4 text-gray-600">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">Visual Documentation</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {item.gallery.map((img, idx) => (
                    <div key={idx} className="aspect-video rounded-3xl overflow-hidden border border-[#1a1a1a] group">
                      <img
                        src={img}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                        alt={`${item.title} observation ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Bibliography */}
            {item.recommendedBooks && item.recommendedBooks.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center gap-4 text-gray-600">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">Curated Bibliography</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {item.recommendedBooks.map((book, idx) => (
                    <div
                      key={idx}
                      className="group bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl p-5 md:p-6 transition-all hover:border-[#9fff00]/30 flex flex-col md:flex-row gap-5"
                    >
                      {book.coverUrl && (
                        <div className="w-full md:w-32 aspect-[2/3] shrink-0 rounded-lg overflow-hidden border border-[#222] shadow-xl relative bg-[#111]">
                          <img src={book.coverUrl} className="w-full h-full object-cover" alt={book.title} />
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                        </div>
                      )}
                      
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-xl font-bold text-gray-200 group-hover:text-white transition-colors leading-tight pr-4">{book.title}</h4>
                        </div>
                        <p className="text-xs text-[#9fff00] uppercase tracking-widest font-bold mb-1">BY {book.author}</p>
                        
                        {book.goodreadsRating && (
                          <StarRating rating={book.goodreadsRating} count={book.ratingCount} />
                        )}
                        
                        {book.description && (
                          <div className="text-sm text-gray-400 mt-2 mb-4 leading-relaxed max-h-24 overflow-y-auto custom-scrollbar pr-2">
                            {book.description}
                          </div>
                        )}

                        <div className="mt-auto pt-4 flex flex-wrap gap-3">
                          {book.bookshopLink ? (
                            <a
                              href={book.bookshopLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border border-red-500/20 hover:border-red-500"
                            >
                              <ShoppingBag className="w-3 h-3" /> Bookshop.org
                            </a>
                          ) : book.url ? (
                             <a
                              href={book.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border border-red-500/20 hover:border-red-500"
                            >
                              <ShoppingBag className="w-3 h-3" /> Bookshop.org
                            </a>
                          ) : null}
                          
                          {book.amazonLink && (
                            <a
                              href={book.amazonLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-yellow-500 hover:text-black text-gray-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border border-[#333] hover:border-yellow-500"
                            >
                              <ExternalLink className="w-3 h-3" /> Amazon
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Video Coverage (YouTube Data API / Free Proxy) */}
            <section className="space-y-6 pt-12 border-t border-[#1a1a1a]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-gray-600">
                  <Youtube className="w-5 h-5 text-red-500/80" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">Media Footage</span>
                </div>
              </div>

              {isVideoLoading ? (
                <div className="flex items-center gap-3 text-gray-500 py-12 justify-center border border-[#1a1a1a] rounded-3xl border-dashed">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs uppercase tracking-widest font-mono">Intercepting Video Streams...</span>
                </div>
              ) : videoError ? (
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <p className="text-sm">{videoError}</p>
                </div>
              ) : videos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {videos.map((vid: any, idx) => (
                    <div key={idx} className="group flex flex-col gap-3">
                      <VideoEmbed vid={vid} />
                      <h4 className="text-sm font-bold text-gray-300 group-hover:text-white line-clamp-2 leading-tight">
                        {vid.title}
                      </h4>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl text-center">
                  <p className="text-sm text-gray-500">No video footage discovered for this specific event.</p>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Mini Map & Stats */}
          <div className="lg:col-span-5 space-y-10">
            {/* Mini Map */}
            <div className="rounded-[48px] overflow-hidden border border-[#1a1a1a] h-[400px] relative shadow-2xl">
              <MapContainer
                center={item.coordinates}
                zoom={10}
                zoomControl={false}
                attributionControl={false}
                className="w-full h-full opacity-80"
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <Marker position={item.coordinates} icon={dotIcon} />
                <MiniMapSetup coords={item.coordinates} />
              </MapContainer>
              <div className="absolute bottom-6 left-6 right-6 p-4 bg-black/80 backdrop-blur-xl border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#9fff00]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{item.region}</span>
                </div>
                <span className="text-[10px] font-mono text-gray-500">{item.coordinates[0].toFixed(4)}, {item.coordinates[1].toFixed(4)}</span>
              </div>
            </div>

            {/* Stats Block */}
            <div className="bg-[#0c0c0c] rounded-[48px] border border-[#1a1a1a] p-10 space-y-8 sticky top-6">
              <div className="space-y-2">
                <span className="text-[9px] text-[#9fff00] font-black uppercase tracking-[0.5em]">Temporal Signature</span>
                <div className="flex items-center gap-4">
                  <Calendar className="w-6 h-6 text-gray-500" />
                  <div className="flex flex-col">
                    <span className="text-2xl font-black uppercase tracking-tighter">
                      {new Date(item.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Annual Window</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-[#1a1a1a] grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Location</span>
                  <p className="text-2xl font-black font-sans uppercase break-words leading-tight">{locationName}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Risk Level</span>
                  <p className="text-2xl font-black text-red-500 uppercase">Moderate</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Verification</span>
                  <p className="text-2xl font-black text-[#9fff00] uppercase">TIER 1</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Archive SEQ</span>
                  <p className="text-2xl font-black font-mono">#{item.id.split('-')[1]?.toUpperCase() || '00'}</p>
                </div>
              </div>

              {/* Open-Meteo Live Weather Widget */}
              {weather && (
                <div className="pt-8 border-t border-[#1a1a1a]">
                  <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-4 block">Current Conditions • Zero-Cost Relay</span>
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-full bg-[#111] border border-[#222] flex items-center justify-center shadow-lg">
                      {getWeatherIcon(weather.code)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-3xl font-black font-mono tracking-tighter text-white">
                        {weather.temp}°C
                      </span>
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2">
                        {getWeatherDesc(weather.code)} • <Wind className="w-3 h-3 ml-1" /> {weather.wind} km/h
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default InsightsView;
