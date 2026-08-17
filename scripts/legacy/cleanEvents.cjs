const fs = require('fs');

let data = fs.readFileSync('mockData.ts', 'utf8');

// The file exports MOCK_CULTURE_DATA which is an array.
// But some items have title: 'Discovered Cultural Event' or coordinates: [0, 0].
// Let's parse out the top level of the array. The simplest way is to split on object boundaries.

// Every item is basically { id: ..., ...mediaLinks: {} },
// We can use a smart regex or just delete blocks that have 'Discovered Cultural Event'.

let cleaned = data.replace(/\s*\{\s*id:\s*'recovered-\d+',\s*title:\s*'Discovered Cultural Event'[^}]+mediaLinks:\s*\{\}\s*\},?/g, '');
// The last item might not have a comma, so let's clean up any double commas just in case
cleaned = cleaned.replace(/,\s*,/g, ',');
cleaned = cleaned.replace(/\[\s*,/g, '[');
cleaned = cleaned.replace(/,\s*\];/g, '\\n];');

fs.writeFileSync('mockData.ts', cleaned);
console.log('Cleaned mockData.ts');
