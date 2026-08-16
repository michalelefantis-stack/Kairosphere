const fs = require('fs');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'KairosApp/1.0 (michalelefantis@gmail.com)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

async function getImageUrl(title) {
  try {
    // Try Wikipedia first
    let searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)}&utf8=&format=json`;
    let searchRes = await fetchJson(searchUrl);
    if (searchRes && searchRes.query && searchRes.query.search.length > 0) {
      let pageTitle = searchRes.query.search[0].title;
      let imgUrlApi = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=800`;
      let imgRes = await fetchJson(imgUrlApi);
      if (imgRes && imgRes.query && imgRes.query.pages) {
        let pages = imgRes.query.pages;
        let pageId = Object.keys(pages)[0];
        if (pages[pageId].thumbnail && pages[pageId].thumbnail.source) {
          return pages[pageId].thumbnail.source;
        }
      }
    }

    // Try Wikimedia Commons
    let commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(title)}&gsrlimit=1&prop=imageinfo&iiprop=url&format=json`;
    let commonsRes = await fetchJson(commonsUrl);
    if (commonsRes && commonsRes.query && commonsRes.query.pages) {
      let pages = commonsRes.query.pages;
      let pageId = Object.keys(pages)[0];
      if (pages[pageId].imageinfo && pages[pageId].imageinfo.length > 0) {
        return pages[pageId].imageinfo[0].url;
      }
    }
  } catch (e) {
    console.error("Error fetching for", title, e.message);
  }
  return null;
}

async function processFiles() {
  let content = fs.readFileSync('mockData.ts', 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const titleMatch = lines[i].match(/title:\s*'([^']+)'/);
    if (titleMatch) {
      const title = titleMatch[1];
      for (let j = i + 1; j < i + 15 && j < lines.length; j++) {
        if (lines[j].includes('imageUrl:')) {
          console.log(`Fetching image for: ${title}`);
          const newUrl = await getImageUrl(title);
          if (newUrl) {
            lines[j] = lines[j].replace(/imageUrl:\s*'[^']+'/, `imageUrl: '${newUrl}'`);
            console.log(` -> Found: ${newUrl}`);
          } else {
            console.log(` -> No image found.`);
          }
          break;
        }
      }
    }
  }
  fs.writeFileSync('mockData.ts', lines.join('\n'));
}

processFiles();
