// Service Worker with proper cache invalidation for Next.js deployments
// Version: 2.0 - Fixes stale cache issue after deployment

const CACHE_VERSION = "v2-" + (self.__BUILD_ID__ || Date.now());
const CACHE_NAME = `klub-cache-${CACHE_VERSION}`;

// Cache strategies per resource type
const NETWORK_FIRST_PATTERNS = [
  /\/_next\/static\//, // ❌ NEVER cache Next.js build files - they change per deployment
  /\.html$/,           // Always get fresh HTML
  /\/api\//,           // API routes
];

const CACHE_FIRST_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,  // Images
  /\.(?:woff|woff2|ttf|eot)$/,             // Fonts
  /\/manifest\.json$/,                      // PWA manifest
];

// Install event - skip waiting to activate immediately
self.addEventListener("install", (event) => {
  console.log("[SW] Installing new service worker, version:", CACHE_VERSION);
  self.skipWaiting(); // Force immediate activation
});

// Activate event - delete old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating new service worker, version:", CACHE_VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log("[SW] Claiming all clients");
      return self.clients.claim(); // Take control of all pages immediately
    })
  );
});

// Fetch event - smart caching strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Network-first for specific patterns (HTML, API, Next.js build files)
  const isNetworkFirst = NETWORK_FIRST_PATTERNS.some((pattern) => 
    pattern.test(url.pathname)
  );

  if (isNetworkFirst) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for static assets (images, fonts)
  const isCacheFirst = CACHE_FIRST_PATTERNS.some((pattern) => 
    pattern.test(url.pathname)
  );

  if (isCacheFirst) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: network-first for everything else
  event.respondWith(networkFirst(request));
});

// Network-first strategy: Try network, fallback to cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log("[SW] Network failed, trying cache:", request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page or error response
    return new Response("Network error occurred", {
      status: 503,
      statusText: "Service Unavailable",
      headers: new Headers({
        "Content-Type": "text/plain",
      }),
    });
  }
}

// Cache-first strategy: Try cache, fallback to network
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log("[SW] Failed to fetch:", request.url);
    return new Response("Failed to fetch resource", {
      status: 404,
      statusText: "Not Found",
    });
  }
}

// Message handler for manual cache clear
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        console.log("[SW] All caches cleared");
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});