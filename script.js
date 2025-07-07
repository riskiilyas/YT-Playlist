// YouTube API Key - Ganti dengan API key Anda
const YOUTUBE_API_KEY = 'YOUR_KEY';

// Alpine.js main component
function playlistManager() {
    return {
        collections: [],
        selectedCollection: null,
        currentVideo: null,
        showAddForm: false,
        isLoading: false,
        newCollection: {
            name: '',
            url: ''
        },
        toast: {
            show: false,
            message: '',
            type: 'success'
        },
        isDark: false,

        init() {
            this.loadCollections();
            this.initDarkMode();
            this.initLucideIcons();
            this.registerServiceWorker();
        },

        initDarkMode() {
            this.isDark = localStorage.getItem('darkMode') === 'true' || 
                         (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
            this.applyDarkMode();
        },

        toggleDarkMode() {
            this.isDark = !this.isDark;
            localStorage.setItem('darkMode', this.isDark.toString());
            this.applyDarkMode();
        },

        applyDarkMode() {
            if (this.isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        },

        initLucideIcons() {
            this.$nextTick(() => {
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        },

        async registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                try {
                    await navigator.serviceWorker.register('sw.js');
                    console.log('Service Worker registered');
                } catch (error) {
                    console.log('Service Worker registration failed:', error);
                }
            }
        },

        async addCollection() {
            if (!this.newCollection.name.trim() || !this.newCollection.url.trim()) {
                this.showToast('Mohon isi semua field!', 'error');
                return;
            }

            const playlistId = this.extractPlaylistId(this.newCollection.url);
            if (!playlistId) {
                this.showToast('Link playlist tidak valid!', 'error');
                return;
            }

            this.isLoading = true;

            try {
                const playlistData = await this.fetchPlaylistData(playlistId);
                const videos = await this.fetchPlaylistVideos(playlistId);

                const collection = {
                    id: this.generateId(),
                    name: this.newCollection.name,
                    playlistId: playlistId,
                    playlistUrl: this.newCollection.url,
                    thumbnail: playlistData.thumbnail,
                    description: playlistData.description,
                    videoCount: videos.length,
                    videos: videos,
                    createdAt: new Date().toISOString()
                };

                this.collections.push(collection);
                this.saveCollections();
                this.showAddForm = false;
                this.newCollection = { name: '', url: '' };
                this.showToast('Collection berhasil ditambahkan!', 'success');

            } catch (error) {
                console.error('Error adding collection:', error);
                this.showToast('Gagal menambahkan collection. Periksa link playlist.', 'error');
            } finally {
                this.isLoading = false;
            }
        },

        extractPlaylistId(url) {
            const regex = /[?&]list=([^#\&\?]*)/;
            const match = url.match(regex);
            return match ? match[1] : null;
        },

        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        },

        // Mock API - Ganti dengan implementasi YouTube API yang sesungguhnya
        // async fetchPlaylistData(playlistId) {
        //     // Simulasi delay API
        //     await new Promise(resolve => setTimeout(resolve, 1000));
            
        //     return {
        //         title: 'Sample Playlist',
        //         description: 'This is a sample playlist description',
        //         thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        //         channelTitle: 'Sample Channel'
        //     };
        // },

        // async fetchPlaylistVideos(playlistId) {
        //     // Simulasi delay API
        //     await new Promise(resolve => setTimeout(resolve, 500));
            
        //     // Mock data - dalam implementasi nyata, gunakan YouTube API
        //     return Array.from({ length: 10 }, (_, i) => ({
        //         videoId: `dQw4w9WgXcQ${i}`,
        //         title: `Sample Video ${i + 1} - Lorem ipsum dolor sit amet`,
        //         description: `This is a sample video description for video ${i + 1}`,
        //         thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        //         duration: '3:42',
        //         channelTitle: 'Sample Channel',
        //         publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
        //     }));
        // },

        /// Implementasi YouTube API yang sesungguhnya
        async fetchPlaylistData(playlistId) {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${YOUTUBE_API_KEY}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch playlist data');
            }
            
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                throw new Error('Playlist not found');
            }
            
            const playlist = data.items[0].snippet;
            return {
                title: playlist.title,
                description: playlist.description,
                thumbnail: playlist.thumbnails.medium.url,
                channelTitle: playlist.channelTitle
            };
        },

        async fetchPlaylistVideos(playlistId) {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch playlist videos');
            }
            
            const data = await response.json();
            
            return data.items.map(item => ({
                videoId: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail: item.snippet.thumbnails.medium.url,
                duration: '0:00', // Perlu API call tambahan untuk mendapatkan durasi
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt
            }));
        },
        

        openCollection(collection) {
            this.selectedCollection = collection;
            this.currentVideo = null;
            this.$nextTick(() => {
                this.initLucideIcons();
            });
        },

        playVideo(video) {
            this.currentVideo = video;
            this.$nextTick(() => {
                this.initLucideIcons();
            });
        },

        deleteCollection(collection) {
            if (confirm(`Apakah Anda yakin ingin menghapus collection "${collection.name}"?`)) {
                this.collections = this.collections.filter(c => c.id !== collection.id);
               this.saveCollections();
               this.selectedCollection = null;
               this.currentVideo = null;
               this.showToast('Collection berhasil dihapus!', 'success');
           }
       },

       loadCollections() {
           const saved = localStorage.getItem('ytPlaylistCollections');
           if (saved) {
               this.collections = JSON.parse(saved);
           }
       },

       saveCollections() {
           localStorage.setItem('ytPlaylistCollections', JSON.stringify(this.collections));
       },

       showToast(message, type = 'success') {
           this.toast = {
               show: true,
               message: message,
               type: type
           };

           setTimeout(() => {
               this.toast.show = false;
           }, 3000);
       },

       formatDate(dateString) {
           const date = new Date(dateString);
           return date.toLocaleDateString('id-ID', {
               year: 'numeric',
               month: 'long',
               day: 'numeric'
           });
       }
   }
}

// PWA Installation
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
   deferredPrompt = e;
   console.log('PWA install prompt available');
});

// Install PWA function
function installPWA() {
   if (deferredPrompt) {
       deferredPrompt.prompt();
       deferredPrompt.userChoice.then((result) => {
           if (result.outcome === 'accepted') {
               console.log('User accepted the install prompt');
           }
           deferredPrompt = null;
       });
   }
}

// YouTube API Implementation (Real)
class YouTubeAPI {
   constructor(apiKey) {
       this.apiKey = apiKey;
       this.baseUrl = 'https://www.googleapis.com/youtube/v3';
   }

   async fetchPlaylistData(playlistId) {
       const response = await fetch(
           `${this.baseUrl}/playlists?part=snippet&id=${playlistId}&key=${this.apiKey}`
       );
       
       if (!response.ok) {
           throw new Error('Failed to fetch playlist data');
       }
       
       const data = await response.json();
       
       if (!data.items || data.items.length === 0) {
           throw new Error('Playlist not found');
       }
       
       const playlist = data.items[0].snippet;
       return {
           title: playlist.title,
           description: playlist.description,
           thumbnail: playlist.thumbnails.medium?.url || playlist.thumbnails.default?.url,
           channelTitle: playlist.channelTitle
       };
   }

   async fetchPlaylistVideos(playlistId) {
       let allVideos = [];
       let nextPageToken = '';

       do {
           const response = await fetch(
               `${this.baseUrl}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${this.apiKey}`
           );
           
           if (!response.ok) {
               throw new Error('Failed to fetch playlist videos');
           }
           
           const data = await response.json();
           
           const videos = data.items.map(item => ({
               videoId: item.snippet.resourceId.videoId,
               title: item.snippet.title,
               description: item.snippet.description,
               thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
               duration: '0:00', // Akan diisi dengan API call terpisah
               channelTitle: item.snippet.channelTitle,
               publishedAt: item.snippet.publishedAt
           }));

           allVideos = allVideos.concat(videos);
           nextPageToken = data.nextPageToken || '';
           
       } while (nextPageToken);

       // Fetch video durations
       const videoIds = allVideos.map(v => v.videoId).join(',');
       const durations = await this.fetchVideoDurations(videoIds);
       
       allVideos.forEach(video => {
           video.duration = durations[video.videoId] || '0:00';
       });

       return allVideos;
   }

   async fetchVideoDurations(videoIds) {
       const response = await fetch(
           `${this.baseUrl}/videos?part=contentDetails&id=${videoIds}&key=${this.apiKey}`
       );
       
       if (!response.ok) {
           return {};
       }
       
       const data = await response.json();
       const durations = {};
       
       data.items.forEach(item => {
           durations[item.id] = this.parseISO8601Duration(item.contentDetails.duration);
       });
       
       return durations;
   }

   parseISO8601Duration(duration) {
       const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
       const hours = (match[1] || '').replace('H', '');
       const minutes = (match[2] || '').replace('M', '');
       const seconds = (match[3] || '').replace('S', '');
       
       const h = parseInt(hours) || 0;
       const m = parseInt(minutes) || 0;
       const s = parseInt(seconds) || 0;
       
       if (h > 0) {
           return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
       } else {
           return `${m}:${s.toString().padStart(2, '0')}`;
       }
   }
}

// Export untuk digunakan di Alpine.js jika diperlukan
window.YouTubeAPI = YouTubeAPI;