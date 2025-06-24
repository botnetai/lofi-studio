// State management
const state = {
    tracks: [],
    selectedTrack: null,
    artwork: null,
    video: null,
    apis: {
        goapi: {
            key: 'c3ba91c7503bb8b8d3c4e6f41292af00e910a8e1067b6d20c4a2661017c9e7da',
            endpoint: 'https://api.goapi.ai/api/v1/task'
        },
        udioapi: {
            key: '51bdc9d9-ba8f-45fa-a34c-d7d8aadc9a6a',
            endpoint: 'https://udioapi.pro/api/v2/generate'
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadSavedState();
});

// Event Listeners
function setupEventListeners() {
    // Music upload
    const musicUpload = document.getElementById('music-upload');
    const musicInput = document.getElementById('music-input');
    
    musicUpload.addEventListener('click', () => musicInput.click());
    musicInput.addEventListener('change', handleMusicUpload);
    
    // Drag and drop
    musicUpload.addEventListener('dragover', (e) => {
        e.preventDefault();
        musicUpload.classList.add('dragover');
    });
    
    musicUpload.addEventListener('dragleave', () => {
        musicUpload.classList.remove('dragover');
    });
    
    musicUpload.addEventListener('drop', (e) => {
        e.preventDefault();
        musicUpload.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    // Artwork upload
    document.getElementById('artwork-upload').addEventListener('change', handleArtworkUpload);
}

// Tab switching
function switchTab(tab) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`#${tab}-tab`).classList.add('active');
    event.target.classList.add('active');
}

// Music handling
function handleMusicUpload(event) {
    handleFiles(event.target.files);
}

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('audio/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const track = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    url: e.target.result,
                    type: 'upload',
                    duration: null
                };
                state.tracks.push(track);
                renderTrackList();
                showStatus('Track uploaded successfully', 'success');
            };
            reader.readAsDataURL(file);
        }
    });
}

// Music generation
async function generateMusic() {
    const service = document.getElementById('music-service').value;
    const prompt = document.getElementById('music-prompt').value;
    const title = document.getElementById('music-title').value;
    const tags = document.getElementById('music-tags').value;
    
    if (!prompt) {
        showStatus('Please enter a prompt', 'error');
        return;
    }
    
    const btn = event.target.closest('.generate-btn');
    btn.classList.add('loading');
    
    try {
        if (service === 'goapi') {
            await generateWithGoAPI(prompt, title, tags);
        } else {
            await generateWithUdioAPI(prompt, title, tags);
        }
    } catch (error) {
        showStatus(`Generation failed: ${error.message}`, 'error');
    } finally {
        btn.classList.remove('loading');
    }
}

async function generateWithGoAPI(prompt, title, tags) {
    const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            service: 'goapi',
            prompt,
            title,
            tags,
            apiKey: state.apis.goapi.key
        })
    });
    
    const data = await response.json();
    if (data.success) {
        showStatus('Music generation started! This may take a few minutes...', 'success');
        pollMusicStatus(data.taskId, 'goapi');
    } else {
        throw new Error(data.error || 'Generation failed');
    }
}

async function generateWithUdioAPI(prompt, title, tags) {
    const response = await fetch('/api/generate-music', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            service: 'udioapi',
            prompt,
            title,
            tags,
            apiKey: state.apis.udioapi.key
        })
    });
    
    const data = await response.json();
    if (data.success) {
        showStatus('Music generation started! This may take a few minutes...', 'success');
        pollMusicStatus(data.workId, 'udioapi');
    } else {
        throw new Error(data.error || 'Generation failed');
    }
}

async function pollMusicStatus(taskId, service) {
    const checkStatus = async () => {
        const response = await fetch(`/api/check-music-status?taskId=${taskId}&service=${service}`);
        const data = await response.json();
        
        if (data.status === 'completed') {
            data.tracks.forEach(track => {
                state.tracks.push({
                    id: Date.now() + Math.random(),
                    name: track.title || 'Generated Track',
                    url: track.url,
                    type: 'generated',
                    service: service
                });
            });
            renderTrackList();
            showStatus('Music generated successfully!', 'success');
        } else if (data.status === 'failed') {
            showStatus('Music generation failed', 'error');
        } else {
            // Still processing, check again in 5 seconds
            setTimeout(checkStatus, 5000);
        }
    };
    
    setTimeout(checkStatus, 5000);
}

// Track list rendering
function renderTrackList() {
    const trackList = document.getElementById('track-list');
    trackList.innerHTML = '';
    
    state.tracks.forEach(track => {
        const trackItem = document.createElement('div');
        trackItem.className = 'track-item';
        if (state.selectedTrack === track.id) {
            trackItem.classList.add('selected');
        }
        
        trackItem.innerHTML = `
            <div class="track-info">
                <span>${track.name}</span>
                <audio controls src="${track.url}"></audio>
            </div>
            <div class="track-controls">
                <button onclick="selectTrack('${track.id}')">Select</button>
                <button onclick="removeTrack('${track.id}')">Remove</button>
            </div>
        `;
        
        trackList.appendChild(trackItem);
    });
}

function selectTrack(trackId) {
    state.selectedTrack = trackId;
    renderTrackList();
    showStatus('Track selected', 'success');
}

function removeTrack(trackId) {
    state.tracks = state.tracks.filter(t => t.id !== trackId);
    if (state.selectedTrack === trackId) {
        state.selectedTrack = null;
    }
    renderTrackList();
}

// Artwork generation
async function generateArtwork() {
    const prompt = document.getElementById('artwork-prompt').value;
    const style = document.getElementById('artwork-style').value;
    
    if (!prompt) {
        showStatus('Please enter a prompt for the artwork', 'error');
        return;
    }
    
    const btn = event.target.closest('.generate-btn');
    btn.classList.add('loading');
    
    try {
        const response = await fetch('/api/generate-artwork', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: `${prompt}, ${style} style, album cover, square format`,
                style
            })
        });
        
        const data = await response.json();
        if (data.success) {
            state.artwork = data.imageUrl;
            displayArtwork(data.imageUrl);
            showStatus('Artwork generated successfully!', 'success');
        } else {
            throw new Error(data.error || 'Generation failed');
        }
    } catch (error) {
        showStatus(`Artwork generation failed: ${error.message}`, 'error');
    } finally {
        btn.classList.remove('loading');
    }
}

function handleArtworkUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.artwork = e.target.result;
            displayArtwork(e.target.result);
            showStatus('Artwork uploaded successfully', 'success');
        };
        reader.readAsDataURL(file);
    }
}

function displayArtwork(url) {
    const preview = document.getElementById('artwork-preview');
    preview.innerHTML = `<img src="${url}" alt="Album artwork">`;
}

// Video generation
async function generateVideo() {
    if (!state.artwork) {
        showStatus('Please generate or upload artwork first', 'error');
        return;
    }
    
    if (!state.selectedTrack) {
        showStatus('Please select a track first', 'error');
        return;
    }
    
    const animationStyle = document.getElementById('animation-style').value;
    const duration = document.getElementById('video-duration').value;
    
    const btn = event.target.closest('.generate-btn');
    btn.classList.add('loading');
    
    try {
        const response = await fetch('/api/generate-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageUrl: state.artwork,
                audioUrl: state.tracks.find(t => t.id === state.selectedTrack).url,
                animationStyle,
                duration: parseInt(duration)
            })
        });
        
        const data = await response.json();
        if (data.success) {
            state.video = data.videoUrl;
            displayVideo(data.videoUrl);
            showStatus('Video generated successfully!', 'success');
        } else {
            throw new Error(data.error || 'Generation failed');
        }
    } catch (error) {
        showStatus(`Video generation failed: ${error.message}`, 'error');
    } finally {
        btn.classList.remove('loading');
    }
}

function displayVideo(url) {
    const preview = document.getElementById('video-preview');
    preview.innerHTML = `<video src="${url}" controls loop></video>`;
}

// Publishing
async function publishToDistroKid() {
    const track = state.tracks.find(t => t.id === state.selectedTrack);
    if (!track || !state.artwork) {
        showStatus('Please select a track and generate artwork', 'error');
        return;
    }
    
    const btn = event.target.closest('.publish-btn');
    btn.classList.add('loading');
    
    try {
        const response = await fetch('/api/publish-distrokid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                trackUrl: track.url,
                artworkUrl: state.artwork,
                artistName: document.getElementById('artist-name').value,
                albumName: document.getElementById('album-name').value,
                releaseDate: document.getElementById('release-date').value,
                releaseType: document.getElementById('release-type').value,
                credits: document.getElementById('track-credits').value
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showStatus('Successfully uploaded to DistroKid!', 'success');
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    } catch (error) {
        showStatus(`DistroKid upload failed: ${error.message}`, 'error');
    } finally {
        btn.classList.remove('loading');
    }
}

async function publishToYouTube() {
    if (!state.video) {
        showStatus('Please generate a video first', 'error');
        return;
    }
    
    const btn = event.target.closest('.publish-btn');
    btn.classList.add('loading');
    
    try {
        const response = await fetch('/api/publish-youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoUrl: state.video,
                title: document.getElementById('youtube-title').value,
                description: document.getElementById('youtube-description').value,
                tags: document.getElementById('youtube-tags').value,
                category: document.getElementById('youtube-category').value,
                privacy: document.getElementById('youtube-privacy').value
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showStatus('Successfully uploaded to YouTube!', 'success');
            if (data.videoId) {
                window.open(`https://youtube.com/watch?v=${data.videoId}`, '_blank');
            }
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    } catch (error) {
        showStatus(`YouTube upload failed: ${error.message}`, 'error');
    } finally {
        btn.classList.remove('loading');
    }
}

// Status messages
function showStatus(message, type = 'info') {
    const container = document.getElementById('status-container');
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;
    
    container.appendChild(statusDiv);
    
    setTimeout(() => {
        statusDiv.style.opacity = '0';
        setTimeout(() => statusDiv.remove(), 300);
    }, 5000);
}

// State persistence
function saveState() {
    localStorage.setItem('lofiStudioState', JSON.stringify({
        tracks: state.tracks,
        selectedTrack: state.selectedTrack,
        artwork: state.artwork,
        video: state.video
    }));
}

function loadSavedState() {
    const saved = localStorage.getItem('lofiStudioState');
    if (saved) {
        const savedState = JSON.parse(saved);
        Object.assign(state, savedState);
        renderTrackList();
        if (state.artwork) displayArtwork(state.artwork);
        if (state.video) displayVideo(state.video);
    }
}

// Auto-save
setInterval(saveState, 30000);