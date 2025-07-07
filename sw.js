const CACHE_NAME = 'yt-playlist-manager-v2';
const OFFLINE_URL = '/offline.html';

const urlsToCache = [
    '/',
    '/index.html',
    '/script.js',
    '/manifest.json',
    '/offline.html',
    'https://cdn.tailwindcss.com/3.4.0',
    'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js',
    'https://unpkg.com/lucide@latest/dist/umd/lucide.js'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                return self.skipWaiting();
            })
    );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch Event - Network First, then Cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip YouTube API requests
    if (event.request.url.includes('googleapis.com')) {
        return;
    }

    // Skip Chrome extension requests
    if (event.request.url.startsWith('chrome-extension://')) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return fetch(event.request)
                    .then((response) => {
                        // Check if response is valid
                        if (response && response.status === 200 && response.type === 'basic') {
                            // Clone the response for caching
                            const responseToCache = response.clone();
                            cache.put(event.request, responseToCache);
                        }
                        return response;
                    })
                    .catch(() => {
                        // Network failed, try cache
                        return cache.match(event.request)
                            .then((response) => {
                                if (response) {
                                    return response;
                                }
                                
                                // If it's a navigation request, return offline page
                                if (event.request.mode === 'navigate') {
                                    return cache.match(OFFLINE_URL);
                                }
                                
                                // Return a generic offline response
                                return new Response('Offline - Content not available', {
                                    status: 503,
                                    statusText: 'Service Unavailable'
                                });
                            });
                    });
            })
    );
});

// Background Sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-collections') {
        event.waitUntil(syncCollections());
    }
});

async function syncCollections() {
    // Implement sync logic when back online
    console.log('Syncing collections...');
}

// Push Notifications (optional)
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: 'icons/icon-192x192.png',
        badge: 'icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Buka App',
                icon: 'icons/icon-192x192.png'
            },
            {
                action: 'close',
                title: 'Tutup',
                icon: 'icons/icon-192x192.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('YouTube Playlist Manager', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});