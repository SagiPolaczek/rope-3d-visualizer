const CACHE_NAME = 'rope-3d-visualizer-v1.0.0';
const STATIC_CACHE_NAME = 'rope-3d-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'rope-3d-dynamic-v1.0.0';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/controls.css',
  './css/responsive.css',
  './js/main.js',
  './js/rope-math.js',
  './js/visualization.js',
  './js/ui-controls.js',
  './js/steps.js',
  './js/utils.js',
  './lib/three.min.js',
  './lib/math.min.js'
];

const RUNTIME_CACHE = [
  './assets/icons/favicon.ico',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

const NETWORK_FIRST = [
  'https://cdnjs.cloudflare.com/'
];

const CACHE_FIRST = [
  './lib/',
  './css/',
  './js/',
  './assets/'
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        console.log('Service Worker: Preparing dynamic cache');
        return Promise.resolve();
      })
    ]).then(() => {
      console.log('Service Worker: Installation complete');
      return self.skipWaiting();
    }).catch(error => {
      console.error('Service Worker: Installation failed', error);
    })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME &&
              cacheName.startsWith('rope-3d-')) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') {
    return;
  }
  
  if (shouldCacheFirst(url)) {
    event.respondWith(cacheFirst(event.request));
  } else if (shouldNetworkFirst(url)) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

function shouldCacheFirst(url) {
  return CACHE_FIRST.some(pattern => url.pathname.startsWith(pattern)) ||
         STATIC_ASSETS.includes(url.pathname) ||
         url.pathname === '/' ||
         url.pathname === '/index.html';
}

function shouldNetworkFirst(url) {
  return NETWORK_FIRST.some(pattern => url.href.startsWith(pattern));
}

async function cacheFirst(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('Cache first strategy failed:', error);
    
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE_NAME);
      return cache.match('./index.html');
    }
    
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('Network first falling back to cache:', request.url);
    
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const networkPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(error => {
    console.log('Network request failed:', error);
    return null;
  });
  
  if (cachedResponse) {
    networkPromise.catch(() => {});
    return cachedResponse;
  }
  
  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }
  
  if (request.destination === 'document') {
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    return staticCache.match('./index.html');
  }
  
  throw new Error('No cached response available and network request failed');
}

self.addEventListener('message', event => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({
        type: 'VERSION',
        payload: { version: CACHE_NAME }
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({
          type: 'CACHE_CLEARED',
          payload: { success: true }
        });
      }).catch(error => {
        event.ports[0].postMessage({
          type: 'CACHE_CLEARED',
          payload: { success: false, error: error.message }
        });
      });
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo().then(info => {
        event.ports[0].postMessage({
          type: 'CACHE_INFO',
          payload: info
        });
      });
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => {
      if (cacheName.startsWith('rope-3d-')) {
        return caches.delete(cacheName);
      }
    })
  );
}

async function getCacheInfo() {
  const cacheNames = await caches.keys();
  const info = {};
  
  for (const cacheName of cacheNames) {
    if (cacheName.startsWith('rope-3d-')) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      info[cacheName] = {
        size: keys.length,
        urls: keys.map(request => request.url)
      };
    }
  }
  
  return info;
}

self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      syncData().catch(error => {
        console.error('Background sync failed:', error);
      })
    );
  }
});

async function syncData() {
  console.log('Performing background sync...');
}

self.addEventListener('backgroundfetch', event => {
  if (event.tag === 'rope-data-fetch') {
    event.waitUntil(
      handleBackgroundFetch(event).catch(error => {
        console.error('Background fetch failed:', error);
      })
    );
  }
});

async function handleBackgroundFetch(event) {
  console.log('Handling background fetch:', event.tag);
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const { action, data } = event;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) {
        const client = clientList[0];
        return client.focus();
      }
      
      return clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('push', event => {
  if (!event.data) {
    return;
  }
  
  const options = {
    body: event.data.text(),
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-192.png',
    tag: 'rope-notification',
    renotify: true,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: './assets/icons/icon-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('RoPE Visualizer', options)
  );
});

self.addEventListener('error', event => {
  console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('Service Worker: Script loaded', CACHE_NAME);