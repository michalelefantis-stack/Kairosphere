const fs = require('fs');

const csvData = fs.readFileSync('events.csv', 'utf8');

const parseDegree = (str) => {
    let num = parseFloat(str.replace(/[^0-9.]/g, ''));
    if (str.includes('S') || str.includes('W')) num = -num;
    return num;
};

const lines = csvData.trim().split('\n');
const newItems = [];

lines.forEach(line => {
    if (!line.trim()) return;
    
    // We only need basic splitting. Since some have quotes and some don't,
    // let's do a regex that splits by comma but ignores commas inside quotes.
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    if (parts.length < 5) {
        console.log("Failed to parse:", line);
        return;
    }

    const idNum = parts[0].trim();
    const name = parts[1].replace(/^"|"$/g, '').trim();
    const location = parts[2].replace(/^"|"$/g, '').trim();
    const date = parts[3].replace(/^"|"$/g, '').trim();
    const coordStr = parts[4].replace(/^"|"$/g, '').trim();
    
    let sd = '2026-05-01';
    let ed = '2026-05-05';
    
    const coordParts = coordStr.split(',');
    const lat = parseDegree(coordParts[0]);
    const lng = parseDegree(coordParts[1]);

    let type = 'RitualType.FESTIVAL';
    if(name.toLowerCase().includes('puja') || name.toLowerCase().includes('mela') || name.toLowerCase().includes('jatra') || name.toLowerCase().includes('dawa') || name.toLowerCase().includes('ritual')) {
        type = 'RitualType.CEREMONY';
    } 
    if(name.toLowerCase().includes('pilgrimage') || name.toLowerCase().includes('kora') || name.toLowerCase().includes('kumbh')) {
        type = 'RitualType.PILGRIMAGE';
    }
    
    let descriptionStr = `${name} celebrated in ${location}.`;
    let insightStr = `An incredible cultural event occurring around ${date}.`;
    
    // escaping quotes if any
    descriptionStr = descriptionStr.replace(/'/g, "\\'");
    insightStr = insightStr.replace(/'/g, "\\'");

    const itemStr = `  {
    id: 'middle-east-2026-${idNum}',
    title: '${name.replace(/'/g, "\\'")}',
    coordinates: [${lat}, ${lng}],
    ritualType: ${type},
    startDate: '${sd}',
    endDate: '${ed}',
    verified: true,
    region: '${location.replace(/'/g, "\\'")}',
    description: '${descriptionStr}',
    insights: '${insightStr}',
    imageUrl: 'https://images.unsplash.com/photo-1544414603-51fbbdf0530d?auto=format&fit=crop&w=800&q=80',
    mediaLinks: {}
  }`;
    
    newItems.push(itemStr);
});

let tsData = fs.readFileSync('mockData.ts', 'utf8');
// Fix array boundary issues by making sure there's a comma before appending
tsData = tsData.replace(/\n];|\r?\n\];/, ',\n' + newItems.join(',\n') + '\n];');
fs.writeFileSync('mockData.ts', tsData);
console.log('Appended ' + newItems.length + ' items to mockData!');
