const fs = require('fs');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'KairosApp/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

// Fallback search via Google Books
async function getBookCoverVariant(title, author) {
  try {
    const q = encodeURIComponent(`intitle:${title} inauthor:${author}`);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`;
    const res = await fetchJson(url);
    if (res && res.items && res.items.length > 0) {
      let vInfo = res.items[0].volumeInfo;
      if (vInfo.imageLinks) {
        // use https instead of http
        let link = vInfo.imageLinks.thumbnail || vInfo.imageLinks.smallThumbnail;
        return link.replace('http:', 'https:').replace('&edge=curl', '');
      }
    }
  } catch (e) {
    console.error("Error fetching cover for", title, e.message);
  }
  return null;
}

// Primary search via Open Library
async function getBookCover(title, author) {
  try {
    const qTitle = encodeURIComponent(title.split(' ').slice(0, 4).join('+'));
    const url = `https://openlibrary.org/search.json?title=${qTitle}&limit=3`;
    const res = await fetchJson(url);
    if (res && res.docs) {
      for (const doc of res.docs) {
        if (doc.cover_i) {
          return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }
      }
    }
  } catch (e) {
    console.error("OpenLibrary Error:", e.message);
  }
  
  // Try Google Books API if OpenLib fails
  return await getBookCoverVariant(title, author);
}

async function processFiles() {
  let content = fs.readFileSync('mockData.ts', 'utf8');
  let lines = content.split('\n');
  let updateCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const titleMatch = lines[i].match(/title:\s*"([^"]+)"/);
    if (titleMatch && lines[i].includes('title:') && !lines[i].includes('title: \'')) {
      const title = titleMatch[1];
      
      // Find author
      let author = "";
      for (let j = i + 1; j < i + 5 && j < lines.length; j++) {
        const authorMatch = lines[j].match(/author:\s*"([^"]+)"/);
        if (authorMatch) {
          author = authorMatch[1];
          break;
        }
      }

      // Find coverUrl
      for (let j = i + 1; j < i + 10 && j < lines.length; j++) {
        if (lines[j].includes('coverUrl:')) {
            const currentUrlMatch = lines[j].match(/coverUrl:\s*"([^"]+)"/);
            if (currentUrlMatch && currentUrlMatch[1].includes('amazon.com')) {
                console.log(`\nFetching cover for: ${title} by ${author}`);
                const newUrl = await getBookCover(title, author);
                if (newUrl) {
                  lines[j] = lines[j].replace(/coverUrl:\s*"[^"]+"/, `coverUrl: "${newUrl}"`);
                  console.log(` -> Replaced with: ${newUrl}`);
                  updateCount++;
                } else {
                  console.log(` -> No cover found for ${title}.`);
                }
            }
            break;
        }
      }
    }
  }
  
  if (updateCount > 0) {
    fs.writeFileSync('mockData.ts', lines.join('\n'));
    console.log(`\nUpdated ${updateCount} book covers in mockData.ts`);
  } else {
    console.log("\nNo covers needed updating or no matches found.");
  }
}

processFiles();
