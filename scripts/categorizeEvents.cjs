const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../mockData.ts');
let content = fs.readFileSync(dataPath, 'utf-8');

const keywords = {
  'Phenomenon': {
    'Atmospheric': ['aurora', 'light', 'sky', 'weather', 'storm', 'firefall', 'lightning', 'cloud'],
    'Botanical': ['bloom', 'flower', 'blossom', 'cherry', 'plant', 'tree', 'flora', 'petals'],
    'Fauna': ['migration', 'animal', 'crab', 'monarch', 'wildebeest', 'bird', 'whale', 'bat', 'salmon', 'turtle'],
    'Cosmic': ['eclipse', 'sun', 'moon', 'star', 'solstice', 'equinox', 'meteor', 'equator'],
    'Geological': ['volcano', 'geyser', 'earth', 'salt', 'cave', 'lava', 'magma', 'glowworm']
  },
  'Festival': {
    'Fire': ['fire', 'burn', 'flame', 'torch', 'bonfire', 'pyre', 'spark'],
    'Water': ['water', 'river', 'sea', 'ocean', 'wash', 'bath', 'boat', 'ice', 'snow', 'splash'],
    'Harvest': ['harvest', 'crop', 'agriculture', 'wine', 'food', 'fruit', 'grape', 'yield', 'wheat', 'rice'],
    'Light': ['light', 'lantern', 'illuminate', 'candle', 'lamp', 'glow', 'beacon'],
    'Cultural': ['culture', 'tradition', 'community', 'art', 'heritage', 'color', 'paint', 'mud', 'carnival', 'parade']
  },
  'Ceremony': {
    'Ancestor': ['ancestor', 'dead', 'spirit', 'ghost', 'grave', 'burial', 'bone', 'funeral', 'skull', 'death', 'deceased'],
    'Healing': ['heal', 'medicine', 'cleanse', 'purify', 'health', 'wash'],
    'Initiation': ['initiation', 'coming of age', 'adulthood', 'boy', 'girl', 'rite of passage', 'jump', 'manhood'],
    'Seasonal': ['season', 'spring', 'summer', 'winter', 'autumn', 'new year', 'solstice']
  },
  'Spiritual': {
    'Trance/Shamanic': ['trance', 'shaman', 'spirit possession', 'voodoo', 'medium', 'possession', 'piercing', 'flesh'],
    'Prayer/Offering': ['prayer', 'offering', 'monk', 'priest', 'blessing', 'temple', 'incense', 'deity'],
    'Meditation': ['meditation', 'chant', 'silence', 'peace', 'yoga']
  },
  'Pilgrimage': {
    'Mountain': ['mountain', 'peak', 'climb', 'hike', 'summit', 'andes', 'himalaya'],
    'River/Lake': ['river', 'lake', 'waterfall', 'source', 'ganges', 'bath'],
    'Shrine/Temple': ['shrine', 'temple', 'church', 'mosque', 'holy city', 'mecca', 'basilica']
  },
  'Performance': {
    'Dance': ['dance', 'dancer', 'choreography', 'step', 'whirling', 'dervish'],
    'Music': ['music', 'song', 'drum', 'sing', 'instrument', 'choir', 'chant', 'rhythm'],
    'Theatrical': ['theatre', 'theater', 'mask', 'costume', 'drama', 'play', 'opera', 'puppet'],
    'Storytelling': ['story', 'myth', 'legend', 'tale', 'narrative', 'epic']
  }
};

const fallbacks = {
  'Phenomenon': 'Natural',
  'Festival': 'Cultural',
  'Ceremony': 'Ritual',
  'Spiritual': 'Devotional',
  'Pilgrimage': 'Sacred Journey',
  'Performance': 'Cultural Art'
};

// Remove any existing subCategory lines to allow reruns
content = content.replace(/\s*subCategory:\s*'.*',/g, '');

let match;
// regex finds the ritualType and the curly brace block
const eventRegex = /(id: '.*?'.*?ritualType:\s*RitualType\.([A-Z]+),)/gs;
let newContent = content;
let replacedCount = 0;

const parts = [];
let lastIndex = 0;

while ((match = eventRegex.exec(content)) !== null) {
  const [fullMatch, upToRitualType, typeEnum] = match;
  const startIndex = match.index;
  const matchLength = fullMatch.length;
  
  // Find where this object ends
  let braceCount = 1;
  let endIndex = startIndex + matchLength;
  while (endIndex < content.length && braceCount > 0) {
    if (content[endIndex] === '{') braceCount++;
    if (content[endIndex] === '}') braceCount--;
    endIndex++;
  }
  
  const objectText = content.substring(startIndex, endIndex);
  const typeKey = typeEnum.charAt(0) + typeEnum.slice(1).toLowerCase(); // FESTIVAL -> Festival
  
  let assignedCat = fallbacks[typeKey] || 'General';
  let maxScore = 0;
  
  const textToAnalyze = objectText.toLowerCase();
  
  if (keywords[typeKey]) {
    for (const [subCat, words] of Object.entries(keywords[typeKey])) {
      let score = 0;
      for (const word of words) {
        // word boundaries to prevent substring matching like 'ice' in 'voice'
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = textToAnalyze.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        assignedCat = subCat;
      }
    }
  }

  // Inject subCategory string right after ritualType
  const insertionIndex = match.index + fullMatch.length;
  
  parts.push(content.substring(lastIndex, insertionIndex));
  parts.push(`\n    subCategory: '${assignedCat}',`);
  lastIndex = insertionIndex;
  
  replacedCount++;
}

parts.push(content.substring(lastIndex));
const finalContent = parts.join('');

fs.writeFileSync(dataPath, finalContent, 'utf-8');
console.log(`Successfully categorized ${replacedCount} events!`);
