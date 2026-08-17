const fs = require('fs');
const content = `Aurora Borealis: Tromsø, Norway (69.65° N, 18.96° E) — Sept to March.
Aurora Australis: South Pole (90.00° S, 0.00° E) — March to Sept.
Catatumbo Lightning: Lake Maracaibo, Venezuela (9.75° N, 73.00° W) — Year-round (Peak: Sept/Oct).
Morning Glory Clouds: Burketown, Australia (17.74° S, 139.55° E) — Late Sept to early Nov.
Volcanic Lightning: Sakurajima, Japan (31.59° N, 130.66° E) — Unpredictable (Eruption-dependent).
The Midnight Sun: Longyearbyen, Svalbard (78.22° N, 15.63° E) — April 20 to Aug 22.
Lunar Rainbows: Victoria Falls, Zambia/Zimbabwe (17.92° S, 25.86° E) — Full Moon, April to July.
Brocken Spectre: The Brocken, Germany (51.80° N, 10.62° E) — Year-round (Misty conditions).
Matsu Blue Tears: Matsu Islands, Taiwan (26.15° N, 119.95° E) — April to August.
Olive Ridley Arribada: Odisha, India (19.38° N, 85.07° E) — February to March.
Pororoca Tidal Bore: Amazon Estuary, Brazil (0.00° N, 50.00° W) — Feb/March (Equinoxes).
Qiantang River Bore: Haining, China (30.53° N, 120.68° E) — 18th day of 8th Lunar Month (Sept).
The Severn Bore: Gloucestershire, UK (51.86° N, 2.24° W) — Spring/Autumn Equinoxes.
Corryvreckan Whirlpool: Strait of Corryvreckan, Scotland (56.16° N, 5.73° W) — New/Full Moon tides.
Staircase to the Moon: Broome, Australia (17.96° S, 122.24° E) — March to Oct (Full Moon).
Spotted Lake: British Columbia, Canada (49.08° N, 119.57° W) — June to September.
Lençóis Maranhenses: Maranhão, Brazil (2.53° S, 43.12° W) — May to September.
Frozen Methane Bubbles: Lake Abraham, Canada (52.22° N, 116.43° W) — January to February.
Turquoise Ice: Lake Baikal, Russia (53.56° N, 108.17° E) — February to March.
The Great Blue Hole: Lighthouse Reef, Belize (17.32° N, 87.54° W) — Nov to May (Dry Season).
Caño Cristales: Serranía de la Macarena, Colombia (2.26° N, 73.79° W) — July to November.
Perito Moreno Calving: Los Glaciares, Argentina (50.47° S, 73.04° W) — Nov to March (Ruptures vary).
Okavango Delta Flood: Okavango, Botswana (19.42° S, 22.90° E) — June to August.
Atacama Desert Bloom: Atacama, Chile (27.37° S, 70.33° W) — Sept to Nov (El Niño years).
Namaqualand Daisies: Northern Cape, South Africa (30.05° S, 17.60° E) — August to September.
California Superbloom: Anza-Borrego, USA (33.26° N, 116.41° W) — February to April.
Valley of Flowers: Uttarakhand, India (30.73° N, 79.62° E) — Mid-July to Mid-August.
Castelluccio Flowering: Umbria, Italy (42.83° N, 13.21° E) — Late June to early July.
Cherry Blossom Front: Kyoto, Japan (35.01° N, 135.77° E) — Late March to early April.
Bluebell Woods: Micheldever, UK (51.15° N, 1.22° W) — Late April to May.
Larch Color Change: Japanese Alps (36.27° N, 137.63° E) — October.
The Sardine Run: Port St Johns, South Africa (31.62° S, 29.43° E) — May to July.
Christmas Island Crabs: Christmas Island (10.48° S, 105.63° E) — Oct to Dec (Last Moon Quarter).
Coral Spawning: Great Barrier Reef, Australia (18.29° S, 147.70° E) — Nov/Dec (Post-Full Moon).
Grunion Run: Southern California, USA (33.71° N, 118.29° W) — March to Aug (New/Full Moon).
Horseshoe Crab Spawning: Delaware Bay, USA (39.00° N, 75.20° W) — May and June (New/Full Moon).
Manta Ray Aggregation: Hanifaru Bay, Maldives (5.17° N, 73.13° E) — May to Nov (Peak: July–Oct).
Narwhal Floe Edge: Nunavut, Canada (72.70° N, 77.96° W) — May to June.
Orca Carousel Feeding: Northern Norway (69.97° N, 21.00° E) — October to January.
Great Wildebeest Migration: Mara River, Kenya (1.57° S, 35.00° E) — July to October.
Monarch Migration: Michoacán, Mexico (19.60° N, 100.27° W) — November to March.
Kasanka Bat Migration: Kasanka, Zambia (12.57° S, 30.18° E) — Late Oct to Mid-Dec.
Amur Falcon Migration: Nagaland, India (26.24° N, 94.31° E) — October to November.
Synchronous Fireflies: Great Smoky Mtns, USA (35.65° N, 83.58° W) — Late May to Mid-June.
Purple Crow Butterfly: Maolin, Taiwan (22.88° N, 120.67° E) — November to March.
Saiga Antelope Calving: Betpak-Dala, Kazakhstan (48.00° N, 67.00° E) — May (One specific week).
Vaux's Swift Roosting: Portland, USA (45.53° N, 122.71° W) — September.
Oilbird Cave Flight: Cueva del Guácharo, Venezuela (10.17° N, 63.55° W) — Daily at dusk (Peak: April/May).
Snow Geese Migration: Missouri/NM, USA (40.08° N, 95.23° W) — Nov to Jan / Feb to March.
Lake Natron Flamingos: Lake Natron, Tanzania (2.42° S, 36.00° E) — August to October.`;

const lines = content.split('\n').filter(Boolean);

function parseLine(line) {
  const titleMatch = line.match(/^([^:]+):\s*([^(]+)\(([^)]+)\)\s*—\s*(.+)$/);
  if (!titleMatch) {
    console.log('Failed to parse:', line);
    return null;
  }
  let [_, title, regionRaw, coordsRaw, timing] = titleMatch;
  title = title.trim();
  const region = regionRaw.trim();
  
  const coordParts = coordsRaw.split(',');
  if (coordParts.length !== 2) return null;
  
  let latRaw = coordParts[0].trim();
  let lonRaw = coordParts[1].trim();
  
  let lat = parseFloat(latRaw);
  if (latRaw.includes('S')) lat = -lat;
  
  let lon = parseFloat(lonRaw);
  if (lonRaw.includes('W')) lon = -lon;
  
  const id = 'phenom-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  return {
    id,
    title,
    coordinates: [lat, lon],
    ritualType: 'RitualType.PHENOMENON',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    verified: true,
    region,
    description: `A spectacular natural phenomenon in ${region}. Timing: ${timing.replace(/'/g, "\\'")}`,
    insights: `The Global Phenological Atlas records this event globally. Location coordinates: [${lat}, ${lon}]. General timing pattern: ${timing.replace(/'/g, "\\'")}`,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Black_background.jpg/500px-Black_background.jpg',
    mediaLinks: {}
  };
}

const items = lines.map(parseLine).filter(Boolean);

let tsContent = items.map(item => `  {
    id: '${item.id}',
    title: '${item.title.replace(/'/g, "\\'")}',
    coordinates: [${item.coordinates[0]}, ${item.coordinates[1]}],
    ritualType: ${item.ritualType},
    startDate: '${item.startDate}',
    endDate: '${item.endDate}',
    verified: ${item.verified},
    region: '${item.region.replace(/'/g, "\\'")}',
    description: '${item.description}',
    insights: '${item.insights}',
    imageUrl: '${item.imageUrl}',
    mediaLinks: {}
  }`).join(',\n');

tsContent = ',\n  // --- GLOBAL PHENOLOGICAL ATLAS --- \n' + tsContent + '\n];\n';

const file = 'C:/Users/milic/Downloads/kairosphere/mockData.ts';
let code = fs.readFileSync(file, 'utf8');
// Remove the final `];` and anything after it, and append our new stuff
code = code.replace(/\n];\s*$/, tsContent);
fs.writeFileSync(file, code);
console.log('Successfully appended ' + items.length + ' items!');
