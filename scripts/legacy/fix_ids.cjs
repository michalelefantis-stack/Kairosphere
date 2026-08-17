const fs = require('fs');
let t = fs.readFileSync('mockData.ts', 'utf8');
let i = 200;
t = t.replace(/(mediaLinks:\s*\{.*?\}.*?\n\s+)ritualType:/g, (match, prefix) => {
    return prefix + `},\n  {\n    id: 'recovered-${i++}',\n    title: 'Discovered Cultural Event',\n    coordinates: [0, 0],\n    ritualType:`;
});
fs.writeFileSync('mockData.ts', t);
