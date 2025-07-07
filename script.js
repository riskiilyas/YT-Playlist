// YouTube API Management
class SecureStorage {
    static encrypt(text, key = 'yt-playlist-app') {
        // Simple encryption untuk demo - gunakan library crypto yang lebih aman untuk production
        return btoa(text);
    }
    
    static decrypt(encryptedText, key = 'yt-playlist-app') {
        try {
            return atob(encryptedText);
        } catch (e) {
            return null;
        }
    }
    
    static setApiKey(apiKey) {
        const encrypted = this.encrypt(apiKey);
        localStorage.setItem('yt_api_key_encrypted', encrypted);
    }
    
    static getApiKey() {
        const encrypted = localStorage.getItem('yt_api_key_encrypted');
        return encrypted ? this.decrypt(encrypted) : null;
    }
    
    static removeApiKey() {
        localStorage.removeItem('yt_api_key_encrypted');
    }
}

// YouTube API Implementation
class YouTubeAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    }

    async testConnection() {
        try {
            const response = await fetch(
                `${this.baseUrl}/search?part=snippet&q=test&type=channel&maxResults=1&key=${this.apiKey}`
            );
            
            if (response.status === 403) {
                const error = await response.json();
                if (error.error.errors[0].reason === 'quotaExceeded') {
                    throw new Error('Quota API sudah habis untuk hari ini');
                }
                throw new Error('API key tidak memiliki permission yang cukup');
            }
            
            if (!response.ok) {
                throw new Error('API key tidak valid');
            }
            
            return { success: true, message: 'API key valid dan siap digunakan!' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async fetchPlaylistData(playlistId) {
        const response = await fetch(
            `${this.baseUrl}/playlists?part=snippet&id=${playlistId}&key=${this.apiKey}`
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to fetch playlist data');
        }
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            throw new Error('Playlist tidak ditemukan atau bersifat private');
        }
        
        const playlist = data.items[0].snippet;
        return {
            title: playlist.title,
            description: playlist.description || 'Tidak ada deskripsi',
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
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to fetch playlist videos');
            }
            
            const data = await response.json();
            
            const videos = data.items
                .filter(item => item.snippet.resourceId?.videoId) // Filter out deleted videos
                .map(item => ({
                    videoId: item.snippet.resourceId.videoId,
                    title: item.snippet.title,
                    description: item.snippet.description || '',
                    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
                    duration: '0:00',
                    channelTitle: item.snippet.channelTitle,
                    publishedAt: item.snippet.publishedAt
                }));

            allVideos = allVideos.concat(videos);
            nextPageToken = data.nextPageToken || '';
            
        } while (nextPageToken);

        // Fetch video durations in batches
        const videoIds = allVideos.map(v => v.videoId);
        const durations = await this.fetchVideoDurations(videoIds);
        
        allVideos.forEach(video => {
            video.duration = durations[video.videoId] || '0:00';
        });

        return allVideos;
    }

    async fetchVideoDurations(videoIds) {
        const durations = {};
        
        // Process in batches of 50 (YouTube API limit)
        for (let i = 0; i < videoIds.length; i += 50) {
            const batch = videoIds.slice(i, i + 50);
            const response = await fetch(
                `${this.baseUrl}/videos?part=contentDetails&id=${batch.join(',')}&key=${this.apiKey}`
            );
            
            if (response.ok) {
                const data = await response.json();
                data.items.forEach(item => {
                    durations[item.id] = this.parseISO8601Duration(item.contentDetails.duration);
                });
            }
        }
        
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

// Mock API for Demo Mode
class MockYouTubeAPI {
    async testConnection() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, message: 'Demo mode - API key simulation berhasil!' };
    }

    async fetchPlaylistData(playlistId) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockPlaylists = {
            'PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab': {
                title: 'Linear Algebra - Essence of Linear Algebra',
                description: 'A visual introduction to linear algebra',
                thumbnail: 'https://i.ytimg.com/vi/fNk_zzaMoSs/mqdefault.jpg',
                channelTitle: '3Blue1Brown'
            },
            'default': {
                title: 'Sample Playlist - ' + Math.random().toString(36).substr(2, 9),
                description: 'This is a demo playlist with sample content for testing purposes.',
                thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                channelTitle: 'Demo Channel'
            }
        };

        return mockPlaylists[playlistId] || mockPlaylists['default'];
    }

    async fetchPlaylistVideos(playlistId) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return Array.from({ length: Math.floor(Math.random() * 15) + 5 }, (_, i) => ({
            videoId: `demo${playlistId}_${i}`,
            title: `Demo Video ${i + 1} - ${this.generateRandomTitle()}`,
            description: `This is a demo video description for video ${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
            thumbnail: `https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg`,
            duration: this.generateRandomDuration(),
            channelTitle: 'Demo Channel',
            publishedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
        }));
    }

    generateRandomTitle() {
        const titles = [
            'Understanding Complex Concepts',
            'Advanced Tutorial Series',
            'Beginner\'s Guide to Everything',
            'Deep Dive Analysis',
            'Quick Tips and Tricks',
            'Complete Walkthrough',
            'Expert Interview',
            'Live Q&A Session',
            'Behind the Scenes',
            'Case Study Review'
        ];
        return titles[Math.floor(Math.random() * titles.length)];
    }

    generateRandomDuration() {
        const minutes = Math.floor(Math.random() * 45) + 1;
        const seconds = Math.floor(Math.random() * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Alpine.js main component
function playlistManager() {
    return {
        // API Management
        apiKey: null,
        showSetup: false,
        setupData: {
            apiKey: ''
        },
        showApiKey: false,
        testingApi: false,
        apiTestResult: null,
        
        // Settings
        showSettings: false,
        editingApiKey: false,
        newApiKey: '',
        showNewApiKey: false,
        testingNewApi: false,
        newApiTestResult: null,

        // App State
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
            this.loadApiKey();
            this.loadCollections();
            this.initDarkMode();
            this.initLucideIcons();
            this.registerServiceWorker();
            
            // Debug log
            console.log('API Key loaded:', this.apiKey ? 'Yes' : 'No');
            console.log('Show setup:', this.showSetup);
        },

        loadApiKey() {
            this.apiKey = SecureStorage.getApiKey();
            const hasSkipped = localStorage.getItem('yt_setup_skipped') === 'true';
            this.showSetup = !this.apiKey && !hasSkipped;
            
            console.log('loadApiKey - API Key:', this.apiKey);
            console.log('loadApiKey - Has Skipped:', hasSkipped);
            console.log('loadApiKey - Show Setup:', this.showSetup);
        },

        async testApiKey() {
            if (!this.setupData.apiKey || this.setupData.apiKey.length < 20) {
                this.apiTestResult = {
                    success: false,
                    message: 'API key terlalu pendek'
                };
                return;
            }
            
            this.testingApi = true;
            this.apiTestResult = null;
            
            try {
                const api = new YouTubeAPI(this.setupData.apiKey);
                this.apiTestResult = await api.testConnection();
            } catch (error) {
                this.apiTestResult = {
                    success: false,
                    message: 'Gagal menguji API key: ' + error.message
                };
            } finally {
                this.testingApi = false;
            }
        },

        saveApiKey() {
            if (!this.setupData.apiKey) {
                this.showToast('Masukkan API key terlebih dahulu!', 'error');
                return;
            }
            
            if (this.apiTestResult && !this.apiTestResult.success) {
                this.showToast('API key tidak valid, tidak dapat disimpan!', 'error');
                return;
            }
            
            SecureStorage.setApiKey(this.setupData.apiKey);
            this.apiKey = this.setupData.apiKey;
            this.showSetup = false;
            this.setupData.apiKey = '';
            this.apiTestResult = null;
            this.showToast('API key berhasil disimpan!', 'success');
            
            console.log('API key saved:', this.apiKey);
        },

        skipSetup() {
            localStorage.setItem('yt_setup_skipped', 'true');
            this.showSetup = false;
            this.showToast('Aplikasi berjalan dalam demo mode', 'info');
        },

        resetSetup() {
            localStorage.removeItem('yt_setup_skipped');
            SecureStorage.removeApiKey();
            this.apiKey = null;
            this.showSetup = true;
            this.showSettings = false;
            this.setupData.apiKey = '';
            this.apiTestResult = null;
            this.showToast('Setup telah direset', 'info');
        },

        editApiKey() {
            console.log('editApiKey called');
            this.editingApiKey = true;
            this.newApiKey = '';
            this.showNewApiKey = false;
            this.newApiTestResult = null;
            
            // Force re-render icons
            this.$nextTick(() => {
                this.initLucideIcons();
            });
        },

        async testNewApiKey() {
            if (!this.newApiKey || this.newApiKey.length < 20) {
                this.newApiTestResult = {
                    success: false,
                    message: 'API key terlalu pendek'
                };
                return;
            }
            
            this.testingNewApi = true;
            this.newApiTestResult = null;
            
            try {
                const api = new YouTubeAPI(this.newApiKey);
                this.newApiTestResult = await api.testConnection();
            } catch (error) {
                this.newApiTestResult = {
                    success: false,
                    message: 'Gagal menguji API key: ' + error.message
                };
            } finally {
                this.testingNewApi = false;
            }
        },

        async updateApiKey() {
            if (!this.newApiKey) {
                this.showToast('Masukkan API key baru!', 'error');
                return;
            }
            
            if (!this.newApiTestResult) {
                await this.testNewApiKey();
            }
            
            if (this.newApiTestResult && this.newApiTestResult.success) {
                SecureStorage.setApiKey(this.newApiKey);
                this.apiKey = this.newApiKey;
                this.editingApiKey = false;
                this.newApiKey = '';
                this.newApiTestResult = null;
                this.showToast('API key berhasil diperbarui!', 'success');
            } else {
                this.showToast('API key tidak valid: ' + (this.newApiTestResult?.message || 'Tidak diketahui'), 'error');
            }
        },

        cancelEditApiKey() {
            this.editingApiKey = false;
            this.newApiKey = '';
            this.showNewApiKey = false;
            this.newApiTestResult = null;
        },

        removeApiKey() {
            if (confirm('Apakah Anda yakin ingin menghapus API key? Aplikasi akan beralih ke demo mode.')) {
                SecureStorage.removeApiKey();
                this.apiKey = null;
                this.showSettings = false;
                this.showToast('API key berhasil dihapus, beralih ke demo mode', 'info');
            }
        },

        getApiInstance() {
            return this.apiKey ? new YouTubeAPI(this.apiKey) : new MockYouTubeAPI();
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
                const api = this.getApiInstance();
                const playlistData = await api.fetchPlaylistData(playlistId);
                const videos = await api.fetchPlaylistVideos(playlistId);

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
                this.showToast('Gagal menambahkan collection: ' + error.message, 'error');
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

        // Data Management
        exportData() {
            const data = {
                collections: this.collections,
                exportDate: new Date().toISOString(),
                version: '2.0'
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `youtube-playlist-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showToast('Data berhasil di-export!', 'success');
        },

        importData() {
            this.$refs.fileInput.click();
        },

        handleFileImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (data.collections && Array.isArray(data.collections)) {
                        if (confirm(`Import ${data.collections.length} collections? Data yang ada akan ditambahkan.`)) {
                            const existingIds = new Set(this.collections.map(c => c.id));
                            const newCollections = data.collections.filter(c => !existingIds.has(c.id));
                            
                            this.collections = [...this.collections, ...newCollections];
                            this.saveCollections();
                            this.showToast(`${newCollections.length} collection berhasil di-import!`, 'success');
                        }
                    } else {
                        this.showToast('Format file tidak valid!', 'error');
                    }
                } catch (error) {
                    this.showToast('Gagal membaca file!', 'error');
                }
            };
            reader.readAsText(file);
            
            event.target.value = '';
        },

        clearAllData() {
            if (confirm('Apakah Anda yakin ingin menghapus SEMUA data? Tindakan ini tidak dapat dibatalkan!')) {
                if (confirm('Konfirmasi sekali lagi - SEMUA collection akan dihapus!')) {
                    this.collections = [];
                    this.selectedCollection = null;
                    this.currentVideo = null;
                    this.saveCollections();
                    this.showSettings = false;
                    this.showToast('Semua data berhasil dihapus!', 'success');
                }
            }
        },

        loadCollections() {
            const saved = localStorage.getItem('ytPlaylistCollections');
            if (saved) {
                try {
                    this.collections = JSON.parse(saved);
                } catch (error) {
                    console.error('Error loading collections:', error);
                    this.collections = [];
                }
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