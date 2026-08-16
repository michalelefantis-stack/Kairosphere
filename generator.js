const fs = require('fs');

const rawData = `Noche de Rábanos (Night of Radishes),"Oaxaca, Mexico","17.076N, 96.726W",December 23
La Tamborrada (Drum Festival),"San Sebastián, Spain","43.318N, 1.981W",January 20
Nieuwjaarsduik (New Year's Dive),Netherlands (Scheveningen),"52.113N, 4.281E",January 1
Ngaben (Balinese Funeral Ritual),"Bali, Indonesia","8.340S, 115.092E",Varies (check local calendar)
Up Helly Aa (Viking Fire Festival),"Lerwick, Shetland","60.155N, 1.145W",Last Tuesday of January
Tinku (Ritual Fighting),"Potosí region, Bolivia","19.589S, 65.753W",May (specifically early May)
Feria de Sevilla,"Seville, Spain","37.389N, 5.984W",Two weeks after Easter
Banho 29 (Traditional Midnight Swim),"Lagos, Portugal","37.102N, 8.673W",August 29
Wife Carrying World Championship,"Sonkajärvi, Finland","63.669N, 27.676E",July
Kite Festival (Giant Barriletes),"Sumpango, Guatemala","14.646N, 90.733W",November 1
Tapati Rapa Nui,"Easter Island, Chile","27.112S, 109.349W",First two weeks of February
Naha Great Tug of War,"Okinawa, Japan","26.212N, 127.679E",October (Health & Sports Day)
Il Palio (Horse Race),"Siena, Italy","43.318N, 11.330E",July 2 and August 16
Lewes Bonfire Night,"Lewes, UK","50.874N, 0.012E",November 5
The Padstow 'Obby 'Oss,"Padstow, Cornwall, UK","50.541N, 4.939W",May 1 (May Day)
Tiji Festival,"Lo Manthang, Nepal","29.182N, 83.956E",May (Tibetan Lunar Calendar)
Sapporo Snow Festival,"Sapporo, Japan","43.062N, 141.354E",Early February
Grand Kadooment (Crop Over),Barbados,"13.193N, 59.543W",First Monday of August
Atherstone Ball Game,"Atherstone, UK","52.577N, 1.547W",Shrove Tuesday (Feb/March)
International Worm Charming,"Willaston, UK","53.078N, 2.476W",June
Voodoo Festival,"Ouidah, Benin","6.363N, 2.085E",January 10
La Paz Day Parade,"La Paz, Bolivia","16.489S, 68.119W",July 16
St. Patrick's Parade,"Tokyo, Japan","35.666N, 139.706E",March (around the 17th)
Ted Fest (Father Ted Tribute),"Inis Mór, Ireland","53.125N, 9.722W",Late February
Jazz Fest,"New Orleans, USA","29.981N, 90.078W",Late April / Early May
Red Dress Run,"New Orleans, USA","29.958N, 90.064W",Second Saturday of August`;

function parseRow(line) {
  const parts = [];
  let inQuotes = false;
  let currentWord = '';
  for(let i=0; i<line.length; i++) {
    if(line[i] === '"') {
      inQuotes = !inQuotes;
    } else if(line[i] === ',' && !inQuotes) {
      parts.push(currentWord.trim());
      currentWord = '';
    } else {
      currentWord += line[i];
    }
  }
  parts.push(currentWord.trim());
  return parts;
}

const events = [];
const lines = rawData.split('\n');

for(const line of lines) {
  if(!line.trim()) continue;
  const parts = parseRow(line);
  
  const name = parts[0];
  const loc = parts[1] || '';
  const coordsRaw = parts[2] || '';
  const dates = parts[3] || '';
  
  const latStr = coordsRaw.split(',')[0];
  const lngStr = coordsRaw.split(',')[1];
  
  let latVal = parseFloat(latStr.replace(/[^0-9.]/g, ''));
  if (latStr.includes('S')) latVal = -latVal;
  
  let lngVal = parseFloat(lngStr.replace(/[^0-9.]/g, ''));
  if (lngStr.includes('W')) lngVal = -lngVal;
  
  const idStr = name.split('(')[0].trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  let dateVal = '2026-05-01';
  if (dates.includes('January')) dateVal = '2026-01-15';
  else if (dates.includes('February')) dateVal = '2026-02-15';
  else if (dates.includes('March')) dateVal = '2026-03-15';
  else if (dates.includes('April')) dateVal = '2026-04-15';
  else if (dates.includes('July')) dateVal = '2026-07-15';
  else if (dates.includes('August')) dateVal = '2026-08-15';
  else if (dates.includes('September')) dateVal = '2026-09-15';
  else if (dates.includes('October')) dateVal = '2026-10-15';
  else if (dates.includes('November')) dateVal = '2026-11-15';
  else if (dates.includes('December')) dateVal = '2026-12-15';
  else if (dates.includes('June')) dateVal = '2026-06-15';
  
  const imgUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/NocheRabanos1L.JPG/800px-NocheRabanos1L.JPG';
  
  const tsCode = \`  {
    id: '\${idStr}',
    title: '\${name.replace(/'/g, "\\\\'")}',
    coordinates: [\${latVal}, \${lngVal}],
    ritualType: RitualType.FESTIVAL,
    subCategory: 'Cultural',
    startDate: '\${dateVal}',
    endDate: '\${dateVal}',
    verified: true,
    region: '\${loc.replace(/'/g, "\\\\'")}',
    description: '\${name.replace(/'/g, "\\\\'")}, a renowned cultural phenomenon celebrated in \${loc.replace(/'/g, "\\\\'")}. This traditionally takes place around \${dates.replace(/'/g, "\\\\'")}.',
    insights: 'Automated ingestion data batch from user request.',
    imageUrl: '\${imgUrl}',
    mediaLinks: {}
  }\`;
  
  events.push(tsCode);
}

fs.writeFileSync('C:/Users/milic/Downloads/kairosphere/events_output.txt', events.join(',\\n'));
