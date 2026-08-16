
import React, { useEffect } from 'react';
import { CultureItem } from '../types';

interface JsonLdSchemaProps {
  events: CultureItem[];
}

const SITE_URL = 'https://kairosphere.app';

const JsonLdSchema: React.FC<JsonLdSchemaProps> = ({ events }) => {
  useEffect(() => {
    // Clean up any previous JSON-LD scripts we injected
    document.querySelectorAll('script[data-jsonld="kairosphere"]').forEach(el => el.remove());

    // 1. WebSite Schema
    const websiteSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Kairosphere',
      alternateName: 'KAIROSPHERE',
      url: SITE_URL,
      description: 'An interactive cultural intelligence platform mapping 340+ rituals, festivals, ceremonies, and natural phenomena across 100+ countries with real-time tracking, AI-powered analysis, and 3D globe visualization.',
      applicationCategory: 'TravelApplication',
      operatingSystem: 'Web Browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      },
      featureList: [
        'Interactive world map with cultural event pins',
        '3D globe visualization',
        'Real-time live event tracking via GDELT',
        'AI-powered cultural analysis',
        'Wikipedia integration',
        'Calendar view',
        'Travel itinerary builder'
      ],
      keywords: 'cultural events, world festivals, rituals, ceremonies, natural phenomena, travel planning, cultural intelligence'
    };

    const websiteScript = document.createElement('script');
    websiteScript.type = 'application/ld+json';
    websiteScript.setAttribute('data-jsonld', 'kairosphere');
    websiteScript.textContent = JSON.stringify(websiteSchema);
    document.head.appendChild(websiteScript);

    // 2. Organization Schema
    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Kairosphere',
      url: SITE_URL,
      description: 'Cultural intelligence platform for exploring world rituals, festivals, and natural phenomena.'
    };

    const orgScript = document.createElement('script');
    orgScript.type = 'application/ld+json';
    orgScript.setAttribute('data-jsonld', 'kairosphere');
    orgScript.textContent = JSON.stringify(orgSchema);
    document.head.appendChild(orgScript);

    // 3. ItemList of Events (top 50 for performance, search engines handle this well)
    const eventItems = events.slice(0, 50).map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Event',
        name: event.title,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        image: event.imageUrl,
        location: {
          '@type': 'Place',
          name: event.region,
          geo: {
            '@type': 'GeoCoordinates',
            latitude: event.coordinates[0],
            longitude: event.coordinates[1]
          }
        },
        organizer: {
          '@type': 'Organization',
          name: 'Kairosphere',
          url: SITE_URL
        }
      }
    }));

    const itemListSchema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Cultural Events & Natural Phenomena Worldwide',
      description: `A curated collection of ${events.length} extraordinary cultural events, festivals, rituals, ceremonies, and natural phenomena from around the world.`,
      numberOfItems: events.length,
      itemListElement: eventItems
    };

    const itemListScript = document.createElement('script');
    itemListScript.type = 'application/ld+json';
    itemListScript.setAttribute('data-jsonld', 'kairosphere');
    itemListScript.textContent = JSON.stringify(itemListSchema);
    document.head.appendChild(itemListScript);

    return () => {
      document.querySelectorAll('script[data-jsonld="kairosphere"]').forEach(el => el.remove());
    };
  }, [events]);

  return null; // This component only injects into <head>
};

export default JsonLdSchema;
