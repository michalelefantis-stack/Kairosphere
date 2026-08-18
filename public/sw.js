/**
 * Service worker.
 *
 * The one this replaces cached `/index.html` on install and then served every
 * request cache-first, forever: its cache name was a constant, so the activate
 * handler that deletes "old" caches never found one to delete. The result was
 * that a returning visitor got the index.html of whatever build they first
 * saw, which names its assets by content hash — and those files are gone after
 * the next deploy. A 404, the SPA rewrite answering with HTML, a module script
 * rejected on MIME type, and a white screen that no reload could fix.
 *
 * The rule that avoids this: never serve a cached document that points at
 * assets you might have deleted. So navigations go to the network first and
 * fall back to cache only when the network is unreachable, which is also
 * exactly the behaviour an offline reader needs.
 *
 * Hashed assets are the opposite case. Their filename *is* their content, so
 * they can be served from cache without checking, and kept forever.
 */

const VERSION = 'v3';
const SHELL = `kairosphere-shell-${VERSION}`;
const ASSETS = `kairosphere-assets-${VERSION}`;
const CONTENT = `kairosphere-content-${VERSION}`;
const MINE = [SHELL, ASSETS, CONTENT];

const OFFLINE_DOCUMENT = '/index.html';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.add(OFFLINE_DOCUMENT))
      // Take over immediately. This worker exists to replace a broken one, and
      // waiting for every tab to close would leave people stuck on it.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => !MINE.includes(name)).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

/** Content-hashed build output: the name cannot outlive the bytes. */
const isHashedAsset = url => url.pathname.startsWith('/assets/');

/** The bundled catalogue and its companions — the offline fallback copies. */
const isContent = url => url.pathname.startsWith('/data/');

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Leave other origins alone: map tiles, Wikimedia photographs and the live
  // feed have their own caching, and storing opaque cross-origin responses
  // costs quota without being inspectable.
  if (url.origin !== self.location.origin) return;

  // Documents: network first, so a deploy is picked up on the next load and a
  // stale document can never outlive the assets it names.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SHELL).then(cache => cache.put(OFFLINE_DOCUMENT, copy));
          return response;
        })
        .catch(() => caches.match(OFFLINE_DOCUMENT))
    );
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(ASSETS).then(cache => cache.put(request, copy));
        }
        return response;
      }))
    );
    return;
  }

  if (isContent(url)) {
    // Serve what we have, and refresh it in the background: the catalogue is
    // worth having instantly and worth being a few minutes out of date.
    event.respondWith(
      caches.match(request).then(hit => {
        const network = fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CONTENT).then(cache => cache.put(request, copy));
          }
          return response;
        }).catch(() => hit);
        return hit || network;
      })
    );
  }
});
