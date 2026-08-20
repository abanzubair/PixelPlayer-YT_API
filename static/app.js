/**
 * PixelPlay Web Player — Modern Material 3 Expressive Music Engine
 */

(function () {
  "use strict";

  // =========================================================================
  // APP STATE & CONSTANTS
  // =========================================================================
  const STORAGE_KEYS = {
    LIKED_SONGS: "pixelplay_liked_songs",
    HISTORY: "pixelplay_history",
    PLAYLISTS: "pixelplay_playlists",
    SETTINGS: "pixelplay_settings",
  };

  const state = {
    currentTrack: null,
    queue: [],
    originalQueue: [],
    queueIndex: -1,
    isPlaying: false,
    isMuted: false,
    volume: 80,
    repeatMode: "off", // "off", "all", "one"
    isShuffled: false,
    activeView: "home",
    activeGenre: "Top Hits",
    activeFilter: "songs",
    isSearching: false,
    searchQuery: "",
    isSeeking: false,
    lyrics: { lines: [], raw: "", source: "" },
    activeLyricIndex: -1,
    settings: {
      autoplay: true,
      vinylMode: true,
      visualizer: true,
      accent: "pixel-blue",
    },
    likedSongs: [],
    history: [],
    playlists: [],
  };

  let ytPlayer = null;
  let ytPlayerReady = false;
  let progressInterval = null;
  let visualizerAnimId = null;
  let searchDebounceTimer = null;

  // =========================================================================
  // DOM ELEMENT SELECTORS
  // =========================================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Navigation
    railItems: $$(".rail-item"),
    mobileNavItems: $$(".mobile-nav-item"),
    views: $$(".app-view"),
    dynamicBackdrop: $("#dynamicBackdropMesh"),

    // Top Bar & Search
    globalSearchInput: $("#globalSearchInput"),
    clearSearchBtn: $("#clearSearchBtn"),
    searchSuggestionsList: $("#searchSuggestionsList"),
    topQueueBtn: $("#topQueueBtn"),
    topQueueBadge: $("#topQueueBadge"),
    topLyricsBtn: $("#topLyricsBtn"),
    railBrandBtn: $("#railBrandBtn"),
    mobileBrandBtn: $("#mobileBrandBtn"),
    railShortcutsBtn: $("#railShortcutsBtn"),

    // Home View
    quickPicksRow: $("#quickPicksRow"),
    playAllQuickPicksBtn: $("#playAllQuickPicksBtn"),
    homeTrendingGrid: $("#homeTrendingGrid"),
    homeLoadingSkeleton: $("#homeLoadingSkeleton"),
    recentHistorySection: $("#recentHistorySection"),
    historyCardsRow: $("#historyCardsRow"),
    clearHistoryBtn: $("#clearHistoryBtn"),
    greetingChips: $$(".greeting-chip"),

    // Explore View
    genrePills: $$(".genre-pill"),
    filterTabBtns: $$(".filter-tab-btn"),
    exploreTracksGrid: $("#exploreTracksGrid"),
    exploreLoading: $("#exploreLoading"),
    exploreEmpty: $("#exploreEmpty"),
    exploreResultsCount: $("#exploreResultsCount"),

    // Liked View
    likedTracklist: $("#likedTracklist"),
    likedSongsMeta: $("#likedSongsMeta"),
    playAllLikedBtn: $("#playAllLikedBtn"),
    shuffleLikedBtn: $("#shuffleLikedBtn"),

    // Playlists View
    userPlaylistsGrid: $("#userPlaylistsGrid"),
    createPlaylistBtn: $("#createPlaylistBtn"),

    // Settings View
    accentDots: $$(".accent-dot"),
    settingAutoplay: $("#settingAutoplay"),
    settingVinylMode: $("#settingVinylMode"),
    settingVisualizer: $("#settingVisualizer"),

    // Floating Mini Player
    floatingMiniPlayer: $("#floatingMiniPlayer"),
    miniProgressFill: $("#miniProgressFill"),
    miniThumb: $("#miniThumb"),
    miniThumbPlaceholder: $("#miniThumbPlaceholder"),
    miniTitle: $("#miniTitle"),
    miniArtist: $("#miniArtist"),
    miniLikeBtn: $("#miniLikeBtn"),
    miniPlayPauseBtn: $("#miniPlayPauseBtn"),
    miniPlayIcon: $("#miniPlayIcon"),
    miniPauseIcon: $("#miniPauseIcon"),
    miniNextBtn: $("#miniNextBtn"),
    miniArtClickTarget: $("#miniArtClickTarget"),
    miniInfoClickTarget: $("#miniInfoClickTarget"),

    // Full Screen Player Modal
    fullPlayerModal: $("#fullPlayerModal"),
    fullPlayerBackdrop: $("#fullPlayerBackdrop"),
    collapsePlayerBtn: $("#collapsePlayerBtn"),
    fullHeaderContext: $("#fullHeaderContext"),
    fullAlbumArt: $("#fullAlbumArt"),
    visualizerCanvas: $("#visualizerCanvas"),
    fullSongTitle: $("#fullSongTitle"),
    fullSongArtist: $("#fullSongArtist"),
    fullSongAlbum: $("#fullSongAlbum"),
    fullHeartBtn: $("#fullHeartBtn"),
    wavySliderContainer: $("#wavySliderContainer"),
    wavySliderFill: $("#wavySliderFill"),
    wavySliderThumb: $("#wavySliderThumb"),
    fullCurrentTime: $("#fullCurrentTime"),
    fullTotalTime: $("#fullTotalTime"),
    fullShuffleBtn: $("#fullShuffleBtn"),
    fullPrevBtn: $("#fullPrevBtn"),
    fullPlayPauseFab: $("#fullPlayPauseFab"),
    fullPlayIcon: $("#fullPlayIcon"),
    fullPauseIcon: $("#fullPauseIcon"),
    fullNextBtn: $("#fullNextBtn"),
    fullRepeatBtn: $("#fullRepeatBtn"),
    fullRepeatBadge: $("#fullRepeatBadge"),
    fullOpenLyricsBtn: $("#fullOpenLyricsBtn"),
    fullOpenQueueBtn: $("#fullOpenQueueBtn"),
    fullVolumeSlider: $("#fullVolumeSlider"),

    // Side Drawer (Queue & Lyrics)
    sideDrawerModal: $("#sideDrawerModal"),
    drawerBackdrop: $("#drawerBackdrop"),
    closeDrawerBtn: $("#closeDrawerBtn"),
    tabBtnQueue: $("#tabBtnQueue"),
    tabBtnLyrics: $("#tabBtnLyrics"),
    drawerQueueContent: $("#drawerQueueContent"),
    drawerLyricsContent: $("#drawerLyricsContent"),
    queueListContainer: $("#queueListContainer"),
    queueItemCount: $("#queueItemCount"),
    clearQueueBtn: $("#clearQueueBtn"),
    lyricsScrollBox: $("#lyricsScrollBox"),
    lyricsLinesContainer: $("#lyricsLinesContainer"),
    lyricsSourceMeta: $("#lyricsSourceMeta"),

    // Shortcuts Dialog
    shortcutsDialog: $("#shortcutsDialog"),
    closeShortcutsDialogBtn: $("#closeShortcutsDialogBtn"),
    toastContainer: $("#toastContainer"),
  };

  // =========================================================================
  // LOCAL STORAGE INITIALIZATION
  // =========================================================================
  function loadPersistedState() {
    try {
      const liked = localStorage.getItem(STORAGE_KEYS.LIKED_SONGS);
      if (liked) state.likedSongs = JSON.parse(liked);

      const hist = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (hist) state.history = JSON.parse(hist);

      const pls = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (pls) state.playlists = JSON.parse(pls);

      const set = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (set) state.settings = { ...state.settings, ...JSON.parse(set) };
    } catch (e) {
      console.warn("Error reading localStorage:", e);
    }
  }

  function savePersistedState(key) {
    try {
      if (key === "liked") {
        localStorage.setItem(STORAGE_KEYS.LIKED_SONGS, JSON.stringify(state.likedSongs));
      } else if (key === "history") {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
      } else if (key === "playlists") {
        localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(state.playlists));
      } else if (key === "settings") {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
      }
    } catch (e) {
      console.warn("Error saving to localStorage:", e);
    }
  }

  // =========================================================================
  // YOUTUBE IFRAME PLAYER SETUP
  // =========================================================================
  const audioPlayer = new Audio();
  let useDirectAudio = true;

  audioPlayer.addEventListener("play", () => {
    state.isPlaying = true;
    updatePlayPauseUI(true);
    startProgressLoop();
    document.body.classList.add("is-playing");
    startVisualizer();
    updateMediaSessionPlaybackState("playing");
  });

  audioPlayer.addEventListener("pause", () => {
    if (!audioPlayer.seeking) {
      state.isPlaying = false;
      updatePlayPauseUI(false);
      stopProgressLoop();
      document.body.classList.remove("is-playing");
      stopVisualizer();
      updateMediaSessionPlaybackState("paused");
    }
  });

  audioPlayer.addEventListener("ended", () => {
    handleTrackEnded();
  });

  window.onYouTubeIframeAPIReady = function () {
    try {
      ytPlayer = new YT.Player("ytPlayer", {
        height: "1",
        width: "1",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError,
        },
      });
    } catch (e) {
      console.warn("YouTube IFrame API init error:", e);
    }
  };

  function onPlayerReady() {
    ytPlayerReady = true;
    if (ytPlayer.setVolume) ytPlayer.setVolume(state.volume);
    console.log("PixelPlay YouTube Engine Ready!");
  }

  function onPlayerStateChange(event) {
    if (useDirectAudio) return;
    if (event.data === YT.PlayerState.PLAYING) {
      state.isPlaying = true;
      updatePlayPauseUI(true);
      startProgressLoop();
      document.body.classList.add("is-playing");
      startVisualizer();
      updateMediaSessionPlaybackState("playing");
    } else if (event.data === YT.PlayerState.PAUSED) {
      state.isPlaying = false;
      updatePlayPauseUI(false);
      stopProgressLoop();
      document.body.classList.remove("is-playing");
      stopVisualizer();
      updateMediaSessionPlaybackState("paused");
    } else if (event.data === YT.PlayerState.ENDED) {
      handleTrackEnded();
    }
  }

  function onPlayerError(err) {
    console.warn("YouTube Player error, falling back to direct stream:", err);
    if (state.currentTrack) {
      playWithDirectStream(state.currentTrack);
    }
  }

  // =========================================================================
  // PLAYBACK ENGINE
  // =========================================================================
  function fallbackToYouTubeIFrame(videoId) {
    useDirectAudio = false;
    if (audioPlayer) {
      try {
        audioPlayer.pause();
        audioPlayer.removeAttribute("src");
      } catch (_) {}
    }
    if (ytPlayerReady && ytPlayer && ytPlayer.loadVideoById) {
      ytPlayer.loadVideoById(videoId);
    }
  }

  function playWithDirectStream(track) {
    fetch(`/api/stream?videoId=${encodeURIComponent(track.videoId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.url) {
          useDirectAudio = true;
          if (ytPlayerReady && ytPlayer && ytPlayer.pauseVideo) {
            try { ytPlayer.pauseVideo(); } catch (_) {}
          }
          audioPlayer.src = data.url;
          audioPlayer.volume = state.volume / 100;
          audioPlayer.play().catch((err) => {
            console.warn("Direct stream play failed, falling back to YouTube IFrame:", err);
            fallbackToYouTubeIFrame(track.videoId);
          });
        } else {
          fallbackToYouTubeIFrame(track.videoId);
        }
      })
      .catch((e) => {
        console.warn("Stream fetch failed, falling back to YouTube IFrame:", e);
        fallbackToYouTubeIFrame(track.videoId);
      });
  }

  function playTrack(track, fromQueue = false) {
    if (!track || !track.videoId) return;

    state.currentTrack = track;
    state.isPlaying = true;

    // Manage Queue
    if (!fromQueue) {
      const existingIdx = state.queue.findIndex((t) => t.videoId === track.videoId);
      if (existingIdx >= 0) {
        state.queueIndex = existingIdx;
      } else {
        state.queue.unshift(track);
        state.queueIndex = 0;
      }
    }

    // Add to Listening History
    addToHistory(track);

    // Update UI
    updateTrackMetadataUI(track);
    updateLikeButtonUI();
    renderQueueList();

    // Prefer high-speed direct Opus audio streaming from local backend
    playWithDirectStream(track);

    // Show floating mini player
    dom.floatingMiniPlayer.classList.remove("hidden");

    // Fetch lyrics and queue recommendations in background
    fetchLyrics(track.videoId);
    if (state.settings.autoplay) {
      fetchQueueRecommendations(track.videoId);
    }

    // Setup Media Session API (lockscreen / notifications)
    updateMediaSession(track);
  }

  function togglePlayPause() {
    if (!state.currentTrack) {
      if (state.queue.length > 0) {
        playTrack(state.queue[0], true);
      }
      return;
    }

    if (useDirectAudio) {
      if (state.isPlaying) {
        audioPlayer.pause();
      } else {
        audioPlayer.play().catch((e) => console.warn("Play error:", e));
      }
      return;
    }

    if (!ytPlayerReady || !ytPlayer) return;

    if (state.isPlaying) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
    }
  }

  function playNextTrack() {
    if (state.queue.length === 0) return;

    if (state.repeatMode === "one") {
      seekTo(0);
      if (useDirectAudio) audioPlayer.play();
      else if (ytPlayerReady && ytPlayer) ytPlayer.playVideo();
      return;
    }

    if (state.queueIndex < state.queue.length - 1) {
      state.queueIndex++;
      playTrack(state.queue[state.queueIndex], true);
    } else if (state.repeatMode === "all") {
      state.queueIndex = 0;
      playTrack(state.queue[0], true);
    } else if (state.settings.autoplay) {
      if (state.currentTrack) {
        fetchQueueRecommendations(state.currentTrack.videoId, true);
      }
    } else {
      showToast("End of queue reached");
    }
  }

  function playPrevTrack() {
    const currTime = useDirectAudio ? audioPlayer.currentTime : (ytPlayerReady && ytPlayer?.getCurrentTime ? ytPlayer.getCurrentTime() : 0);
    if (currTime > 3) {
      seekTo(0);
      return;
    }

    if (state.queueIndex > 0) {
      state.queueIndex--;
      playTrack(state.queue[state.queueIndex], true);
    } else {
      seekTo(0);
    }
  }

  function handleTrackEnded() {
    if (state.repeatMode === "one") {
      seekTo(0);
      if (useDirectAudio) audioPlayer.play();
      else if (ytPlayerReady && ytPlayer) ytPlayer.playVideo();
    } else {
      playNextTrack();
    }
  }

  function seekTo(seconds) {
    if (useDirectAudio) {
      audioPlayer.currentTime = seconds;
      updateProgressDisplay(seconds, audioPlayer.duration || 0);
    } else if (ytPlayerReady && ytPlayer && ytPlayer.seekTo) {
      ytPlayer.seekTo(seconds, true);
      updateProgressDisplay(seconds, ytPlayer.getDuration ? ytPlayer.getDuration() : 0);
    }
  }

  function toggleRepeat() {
    if (state.repeatMode === "off") {
      state.repeatMode = "all";
      dom.fullRepeatBtn.classList.add("active");
      dom.fullRepeatBadge.classList.add("hidden");
      showToast("Repeat Queue: ON");
    } else if (state.repeatMode === "all") {
      state.repeatMode = "one";
      dom.fullRepeatBtn.classList.add("active");
      dom.fullRepeatBadge.classList.remove("hidden");
      showToast("Repeat Track: ON");
    } else {
      state.repeatMode = "off";
      dom.fullRepeatBtn.classList.remove("active");
      dom.fullRepeatBadge.classList.add("hidden");
      showToast("Repeat: OFF");
    }
  }

  function toggleShuffle() {
    state.isShuffled = !state.isShuffled;
    if (state.isShuffled) {
      state.originalQueue = [...state.queue];
      const curr = state.queue[state.queueIndex];
      const remaining = state.queue.filter((_, i) => i !== state.queueIndex);
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      state.queue = curr ? [curr, ...remaining] : remaining;
      state.queueIndex = 0;
      dom.fullShuffleBtn.classList.add("active");
      showToast("Shuffle: ON");
    } else {
      if (state.originalQueue.length > 0) {
        state.queue = [...state.originalQueue];
        if (state.currentTrack) {
          state.queueIndex = state.queue.findIndex((t) => t.videoId === state.currentTrack.videoId);
        }
      }
      dom.fullShuffleBtn.classList.remove("active");
      showToast("Shuffle: OFF");
    }
    renderQueueList();
  }

  // =========================================================================
  // PROGRESS LOOP & LIVE TIME SYNC
  // =========================================================================
  function startProgressLoop() {
    stopProgressLoop();
    progressInterval = setInterval(() => {
      if (!state.isPlaying || state.isSeeking) return;

      const currentTime = useDirectAudio ? audioPlayer.currentTime : (ytPlayerReady && ytPlayer?.getCurrentTime ? ytPlayer.getCurrentTime() : 0);
      const duration = useDirectAudio ? (audioPlayer.duration || state.currentTrack?.duration_seconds || 0) : (ytPlayerReady && ytPlayer?.getDuration ? ytPlayer.getDuration() : (state.currentTrack?.duration_seconds || 0));

      updateProgressDisplay(currentTime, duration);
      syncLyricsWithTime(currentTime);
    }, 250);
  }

  function stopProgressLoop() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  function updateProgressDisplay(currentSec, totalSec) {
    const pct = totalSec > 0 ? (currentSec / totalSec) * 100 : 0;

    // Mini Player progress
    dom.miniProgressFill.style.width = `${pct}%`;

    // Full Player seekbar
    dom.wavySliderFill.style.width = `${pct}%`;
    dom.wavySliderThumb.style.left = `${pct}%`;

    // Timestamps
    dom.fullCurrentTime.textContent = formatTime(currentSec);
    dom.fullTotalTime.textContent = formatTime(totalSec);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  // =========================================================================
  // UI METADATA & PLAYER VIEW UPDATES
  // =========================================================================
  function updateTrackMetadataUI(track) {
    const thumbUrl = track.thumbnail || "";

    // Mini Player
    dom.miniTitle.textContent = track.title || "Unknown Title";
    dom.miniArtist.textContent = track.artist || "Unknown Artist";
    if (thumbUrl) {
      dom.miniThumb.src = thumbUrl;
      dom.miniThumb.classList.remove("hidden");
      dom.miniFallbackIcon.classList.add("hidden");
    } else {
      dom.miniThumb.classList.add("hidden");
      dom.miniFallbackIcon.classList.remove("hidden");
    }

    // Full Player
    dom.fullTrackTitle.textContent = track.title || "Unknown Title";
    dom.fullTrackArtist.textContent = track.artist || "Unknown Artist";
    dom.fullTrackAlbum.textContent = track.album ? `• ${track.album}` : "";
    if (thumbUrl) {
      dom.fullAlbumArt.src = thumbUrl;
      dom.fullAlbumArt.classList.remove("hidden");
      dom.fullVinylCoverArt.src = thumbUrl;
    }

    // Dynamic Backdrop Mesh
    if (thumbUrl) {
      dom.dynamicBackdrop.style.backgroundImage = `radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.25) 0%, rgba(14, 14, 17, 0.95) 75%), url('${thumbUrl}')`;
    }
  }

  function updatePlayPauseUI(playing) {
    if (playing) {
      dom.miniPlayIcon.classList.add("hidden");
      dom.miniPauseIcon.classList.remove("hidden");
      dom.fullPlayIcon.classList.add("hidden");
      dom.fullPauseIcon.classList.remove("hidden");
    } else {
      dom.miniPlayIcon.classList.remove("hidden");
      dom.miniPauseIcon.classList.add("hidden");
      dom.fullPlayIcon.classList.remove("hidden");
      dom.fullPauseIcon.classList.add("hidden");
    }
  }

  // =========================================================================
  // LIKED SONGS & HISTORY LOGIC
  // =========================================================================
  function isTrackLiked(videoId) {
    return state.likedSongs.some((s) => s.videoId === videoId);
  }

  function updateLikeButtonUI() {
    if (!state.currentTrack) return;
    const isLiked = state.likedSongs.some((t) => t.videoId === state.currentTrack.videoId);
    if (isLiked) {
      dom.miniLikeBtn.classList.add("liked");
      dom.fullLikeBtn.classList.add("liked");
      dom.miniLikeBtn.querySelector("svg").setAttribute("fill", "currentColor");
      dom.fullLikeBtn.querySelector("svg").setAttribute("fill", "currentColor");
    } else {
      dom.miniLikeBtn.classList.remove("liked");
      dom.fullLikeBtn.classList.remove("liked");
      dom.miniLikeBtn.querySelector("svg").setAttribute("fill", "none");
      dom.fullLikeBtn.querySelector("svg").setAttribute("fill", "none");
    }
  }

  function toggleLikeCurrentTrack() {
    if (!state.currentTrack) return;
    const idx = state.likedSongs.findIndex((t) => t.videoId === state.currentTrack.videoId);
    if (idx >= 0) {
      state.likedSongs.splice(idx, 1);
      showToast("Removed from Liked Songs");
    } else {
      state.likedSongs.unshift(state.currentTrack);
      showToast("Added to Liked Songs ❤️");
    }
    savePersistedState("likedSongs");
    updateLikeButtonUI();
    renderLikedSongsView();
  }

  function addToHistory(track) {
    if (!track || !track.videoId) return;
    state.history = state.history.filter((t) => t.videoId !== track.videoId);
    state.history.unshift(track);
    if (state.history.length > 50) state.history.pop();
    savePersistedState("history");
    renderHistorySection();
  }

  // =========================================================================
  // DATA FETCHING (API ENDPOINTS)
  // =========================================================================
  async function fetchTrendingHits(genre = "Top Hits") {
    dom.homeLoadingSkeleton.classList.remove("hidden");
    dom.homeTrendingGrid.innerHTML = "";

    try {
      // First try personalized sections from /api/home
      const homeRes = await fetch("/api/home").catch(() => null);
      if (homeRes && homeRes.ok) {
        const homeData = await homeRes.json();
        if (homeData.sections && homeData.sections.length > 0) {
          dom.homeLoadingSkeleton.classList.add("hidden");
          const firstSec = homeData.sections[0];
          const secondSec = homeData.sections[1] || firstSec;
          renderQuickPicks(firstSec.items.slice(0, 8));
          renderTracksGrid(dom.homeTrendingGrid, secondSec.items);
          return;
        }
      }

      // Fallback: /api/trending
      const res = await fetch(`/api/trending?genre=${encodeURIComponent(genre)}`);
      const data = await res.json();
      dom.homeLoadingSkeleton.classList.add("hidden");

      if (data.results && data.results.length > 0) {
        renderTracksGrid(dom.homeTrendingGrid, data.results);
        renderQuickPicks(data.results.slice(0, 8));
      }
    } catch (e) {
      console.warn("Failed to fetch trending hits:", e);
      dom.homeLoadingSkeleton.classList.add("hidden");
    }
  }

  async function performExploreSearch(query, filter = "songs") {
    if (!query.trim()) return;

    dom.exploreLoading.classList.remove("hidden");
    dom.exploreEmpty.classList.add("hidden");
    dom.exploreTracksGrid.innerHTML = "";
    dom.exploreResultsCount.textContent = "";

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}`);
      const data = await res.json();
      dom.exploreLoading.classList.add("hidden");

      if (data.results && data.results.length > 0) {
        dom.exploreResultsCount.textContent = `${data.results.length} results found`;
        renderTracksGrid(dom.exploreTracksGrid, data.results);
      } else {
        dom.exploreEmpty.classList.remove("hidden");
      }
    } catch (e) {
      console.warn("Error searching:", e);
      dom.exploreLoading.classList.add("hidden");
      dom.exploreEmpty.classList.remove("hidden");
    }
  }

  async function fetchSearchSuggestions(query) {
    if (!query.trim()) {
      dom.searchSuggestionsList.classList.add("hidden");
      dom.searchSuggestionsList.innerHTML = "";
      return;
    }

    try {
      const res = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.suggestions && data.suggestions.length > 0) {
        dom.searchSuggestionsList.innerHTML = data.suggestions
          .slice(0, 6)
          .map(
            (s) => `
            <div class="suggestion-row" data-query="${escapeHtml(s)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>${escapeHtml(s)}</span>
            </div>
          `
          )
          .join("");
        dom.searchSuggestionsList.classList.remove("hidden");
      } else {
        dom.searchSuggestionsList.classList.add("hidden");
      }
    } catch (e) {
      dom.searchSuggestionsList.classList.add("hidden");
    }
  }

  async function fetchQueueRecommendations(videoId, playImmediate = false) {
    try {
      const res = await fetch(`/api/queue?videoId=${encodeURIComponent(videoId)}`);
      const data = await res.json();
      if (data.tracks && data.tracks.length > 0) {
        const newTracks = data.tracks.filter((t) => !state.queue.some((q) => q.videoId === t.videoId));
        state.queue.push(...newTracks);
        renderQueueList();

        if (playImmediate && state.queueIndex < state.queue.length - 1) {
          state.queueIndex++;
          playTrack(state.queue[state.queueIndex], true);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch queue recommendations:", e);
    }
  }

  async function fetchLyrics(videoId) {
    dom.lyricsLinesContainer.innerHTML = '<div class="lyrics-placeholder-box">Loading lyrics...</div>';
    dom.lyricsSourceMeta.textContent = "";
    state.lyrics = { lines: [], raw: "", source: "" };

    try {
      const res = await fetch(`/api/lyrics?videoId=${encodeURIComponent(videoId)}`);
      const data = await res.json();

      if (data.lyrics && data.lyrics.trim()) {
        parseAndRenderLyrics(data.lyrics, data.source);
      } else {
        dom.lyricsLinesContainer.innerHTML = '<div class="lyrics-placeholder-box">No lyrics available for this song.</div>';
      }
    } catch (e) {
      dom.lyricsLinesContainer.innerHTML = '<div class="lyrics-placeholder-box">Unable to load lyrics.</div>';
    }
  }

  // =========================================================================
  // SYNCHRONIZED KARAOKE LYRICS PARSER
  // =========================================================================
  function parseAndRenderLyrics(rawText, source) {
    const lines = rawText.split("
");
    const parsedLines = [];
    const lrcRegex = /^\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)$/;

    lines.forEach((line) => {
      const match = line.match(lrcRegex);
      if (match) {
        const mins = parseInt(match[1], 10);
        const secs = parseFloat(match[2]);
        const time = mins * 60 + secs;
        const text = match[3].trim();
        if (text) parsedLines.push({ time, text });
      } else if (line.trim()) {
        parsedLines.push({ time: -1, text: line.trim() });
      }
    });

    state.lyrics = { lines: parsedLines, raw: rawText, source };

    if (parsedLines.length === 0) {
      dom.lyricsLinesContainer.innerHTML = '<div class="lyrics-placeholder-box">Instrumental or no lyrics.</div>';
      return;
    }

    dom.lyricsLinesContainer.innerHTML = parsedLines
      .map(
        (item, idx) => `
        <div class="lyrics-line" data-index="${idx}" data-time="${item.time}">
          ${escapeHtml(item.text)}
        </div>
      `
      )
      .join("");

    if (source) {
      dom.lyricsSourceMeta.textContent = `Source: ${source}`;
    }
  }

  function syncLyricsWithTime(currentTime) {
    if (!state.lyrics.lines || state.lyrics.lines.length === 0) return;
    if (state.lyrics.lines[0].time === -1) return; // Plain text lyrics

    let activeIdx = -1;
    for (let i = 0; i < state.lyrics.lines.length; i++) {
      if (state.lyrics.lines[i].time <= currentTime) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== state.activeLyricIndex && activeIdx >= 0) {
      state.activeLyricIndex = activeIdx;
      $$(".lyrics-line").forEach((el, idx) => {
        if (idx === activeIdx) {
          el.classList.add("active");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          el.classList.remove("active");
        }
      });
    }
  }

  // =========================================================================
  // RENDERING HELPERS
  // =========================================================================
  function renderTracksGrid(container, tracks) {
    container.innerHTML = tracks
      .map((track) => {
        const isPlaying = state.currentTrack && state.currentTrack.videoId === track.videoId;
        return `
        <div class="track-item ${isPlaying ? "playing" : ""}" data-videoid="${track.videoId}">
          <div class="track-thumb-wrapper">
            <img class="track-thumb" src="${track.thumbnail || ""}" alt="${escapeHtml(track.title)}" loading="lazy" />
            <div class="track-play-overlay">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div class="track-meta">
            <div class="track-title">${escapeHtml(track.title)}</div>
            <div class="track-artist">${escapeHtml(track.artist)}</div>
          </div>
          <div class="track-duration">${track.duration || ""}</div>
        </div>
      `;
      })
      .join("");

    // Attach Click Events
    container.querySelectorAll(".track-item").forEach((el) => {
      el.addEventListener("click", () => {
        const videoId = el.dataset.videoid;
        const track = tracks.find((t) => t.videoId === videoId);
        if (track) playTrack(track);
      });
    });
  }

  function renderQuickPicks(tracks) {
    dom.quickPicksRow.innerHTML = tracks
      .map(
        (track) => `
      <div class="quick-pick-card" data-videoid="${track.videoId}">
        <div class="quick-pick-art-wrapper">
          <img class="quick-pick-art" src="${track.thumbnail || ""}" alt="${escapeHtml(track.title)}" loading="lazy" />
          <button class="card-play-fab" title="Play">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="card-info">
          <div class="card-title">${escapeHtml(track.title)}</div>
          <div class="card-artist">${escapeHtml(track.artist)}</div>
        </div>
      </div>
    `
      )
      .join("");

    dom.quickPicksRow.querySelectorAll(".quick-pick-card").forEach((card) => {
      card.addEventListener("click", () => {
        const videoId = card.dataset.videoid;
        const track = tracks.find((t) => t.videoId === videoId);
        if (track) playTrack(track);
      });
    });
  }

  function renderQueueList() {
    dom.queueItemCount.textContent = `${state.queue.length} track${state.queue.length === 1 ? "" : "s"} in queue`;
    dom.topQueueBadge.textContent = state.queue.length;
    dom.topQueueBadge.classList.toggle("hidden", state.queue.length === 0);

    if (state.queue.length === 0) {
      dom.queueListContainer.innerHTML = '<div class="lyrics-placeholder-box">Queue is empty</div>';
      return;
    }

    dom.queueListContainer.innerHTML = state.queue
      .map((track, idx) => {
        const isCurrent = state.queueIndex === idx;
        return `
        <div class="track-item ${isCurrent ? "playing" : ""}" data-queue-idx="${idx}">
          <div class="track-thumb-wrapper">
            <img class="track-thumb" src="${track.thumbnail || ""}" alt="${escapeHtml(track.title)}" />
          </div>
          <div class="track-meta">
            <div class="track-title">${escapeHtml(track.title)}</div>
            <div class="track-artist">${escapeHtml(track.artist)}</div>
          </div>
          <button class="track-more-btn remove-queue-btn" data-idx="${idx}" title="Remove">✕</button>
        </div>
      `;
      })
      .join("");

    dom.queueListContainer.querySelectorAll(".track-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-queue-btn")) {
          e.stopPropagation();
          const idx = parseInt(e.target.dataset.idx, 10);
          state.queue.splice(idx, 1);
          if (state.queueIndex > idx) state.queueIndex--;
          renderQueueList();
          return;
        }
        const idx = parseInt(item.dataset.queueIdx, 10);
        state.queueIndex = idx;
        playTrack(state.queue[idx], true);
      });
    });
  }

  function renderLikedSongsList() {
    dom.likedSongsMeta.textContent = `${state.likedSongs.length} song${state.likedSongs.length === 1 ? "" : "s"}`;
    if (state.likedSongs.length === 0) {
      dom.likedTracklist.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❤️</div><h3>No liked songs yet</h3><p>Tap the heart icon on any playing song to add it to your favorites.</p></div>';
      return;
    }
    renderTracksGrid(dom.likedTracklist, state.likedSongs);
  }

  function renderHistorySection() {
    if (state.history.length === 0) {
      dom.recentHistorySection.classList.add("hidden");
      return;
    }
    dom.recentHistorySection.classList.remove("hidden");
    dom.historyCardsRow.innerHTML = state.history
      .slice(0, 10)
      .map(
        (track) => `
      <div class="quick-pick-card" data-videoid="${track.videoId}">
        <div class="quick-pick-art-wrapper">
          <img class="quick-pick-art" src="${track.thumbnail || ""}" alt="${escapeHtml(track.title)}" loading="lazy" />
          <button class="card-play-fab" title="Play">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="card-info">
          <div class="card-title">${escapeHtml(track.title)}</div>
          <div class="card-artist">${escapeHtml(track.artist)}</div>
        </div>
      </div>
    `
      )
      .join("");

    dom.historyCardsRow.querySelectorAll(".quick-pick-card").forEach((card) => {
      card.addEventListener("click", () => {
        const videoId = card.dataset.videoid;
        const track = state.history.find((t) => t.videoId === videoId);
        if (track) playTrack(track);
      });
    });
  }

  // =========================================================================
  // VIEW ROUTER & NAVIGATION
  // =========================================================================
  function switchView(viewName) {
    state.activeView = viewName;

    // Update Nav items
    dom.railItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === viewName));
    dom.mobileNavItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === viewName));

    // Update Views
    dom.views.forEach((v) => {
      if (v.id === `view${capitalize(viewName)}`) {
        v.classList.add("active");
      } else {
        v.classList.remove("active");
      }
    });

    if (viewName === "liked") {
      renderLikedSongsList();
    } else if (viewName === "explore" && dom.exploreTracksGrid.children.length === 0) {
      fetchExploreCategory(state.activeGenre);
    }
  }

  function fetchExploreCategory(genre) {
    state.activeGenre = genre;
    dom.genrePills.forEach((p) => p.classList.toggle("active", p.dataset.genre === genre));
    performExploreSearch(`${genre} popular songs`, state.activeFilter);
  }

  // =========================================================================
  // AUDIO VISUALIZER CANVAS ANIMATION
  // =========================================================================
  function startVisualizer() {
    if (!state.settings.visualizer) return;
    const canvas = dom.visualizerCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let step = 0;
    function renderWave() {
      if (!state.isPlaying) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--md-primary") || "#8ab4f8";

      const barCount = 36;
      const barWidth = canvas.width / barCount - 3;

      for (let i = 0; i < barCount; i++) {
        const height = Math.abs(Math.sin(step + i * 0.28)) * (canvas.height * 0.75) + 4;
        const x = i * (barWidth + 3);
        const y = canvas.height - height;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 4);
        ctx.fill();
      }

      step += 0.08;
      visualizerAnimId = requestAnimationFrame(renderWave);
    }

    stopVisualizer();
    visualizerAnimId = requestAnimationFrame(renderWave);
  }

  function stopVisualizer() {
    if (visualizerAnimId) {
      cancelAnimationFrame(visualizerAnimId);
      visualizerAnimId = null;
    }
    const canvas = dom.visualizerCanvas;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // =========================================================================
  // MEDIASESSION API (LOCKSCREEN & NOTIFICATION INTEGRATION)
  // =========================================================================
  function updateMediaSession(track) {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || "Unknown Title",
        artist: track.artist || "Unknown Artist",
        album: track.album || "PixelPlay",
        artwork: track.thumbnail
          ? [
              { src: track.thumbnail, sizes: "96x96", type: "image/jpeg" },
              { src: track.thumbnail, sizes: "256x256", type: "image/jpeg" },
              { src: track.thumbnail, sizes: "512x512", type: "image/jpeg" },
            ]
          : [],
      });

      navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("previoustrack", () => playPrevTrack());
      navigator.mediaSession.setActionHandler("nexttrack", () => playNextTrack());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) seekTo(details.seekTime);
      });
    }
  }

  function updateMediaSessionPlaybackState(stateStr) {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = stateStr;
    }
  }

  // =========================================================================
  // TOAST NOTIFICATION
  // =========================================================================
  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "pixel-toast";
    toast.textContent = msg;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px) scale(0.9)";
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  // =========================================================================
  // EVENT LISTENERS & WIRING
  // =========================================================================
  function initEventListeners() {
    // Navigation Rails & Bottom Nav
    dom.railItems.forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
    dom.mobileNavItems.forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));

    dom.railBrandBtn.addEventListener("click", () => switchView("home"));
    dom.mobileBrandBtn.addEventListener("click", () => switchView("home"));

    // Search Input & Suggestions
    dom.globalSearchInput.addEventListener("input", (e) => {
      const q = e.target.value;
      dom.clearSearchBtn.classList.toggle("active", q.length > 0);

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        fetchSearchSuggestions(q);
      }, 250);
    });

    dom.globalSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = dom.globalSearchInput.value.trim();
        if (q) {
          dom.searchSuggestionsList.classList.add("hidden");
          switchView("explore");
          performExploreSearch(q, state.activeFilter);
        }
      }
    });

    dom.clearSearchBtn.addEventListener("click", () => {
      dom.globalSearchInput.value = "";
      dom.clearSearchBtn.classList.remove("active");
      dom.searchSuggestionsList.classList.add("hidden");
    });

    dom.searchSuggestionsList.addEventListener("click", (e) => {
      const row = e.target.closest(".suggestion-row");
      if (row) {
        const q = row.dataset.query;
        dom.globalSearchInput.value = q;
        dom.searchSuggestionsList.classList.add("hidden");
        switchView("explore");
        performExploreSearch(q, state.activeFilter);
      }
    });

    // Explore Genres & Filter Buttons
    dom.genrePills.forEach((p) => {
      p.addEventListener("click", () => {
        fetchExploreCategory(p.dataset.genre);
      });
    });

    dom.filterTabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        dom.filterTabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeFilter = btn.dataset.filter;
        const q = dom.globalSearchInput.value.trim() || `${state.activeGenre} songs`;
        performExploreSearch(q, state.activeFilter);
      });
    });

    // Floating Mini Player Click Target -> Opens Full Player
    dom.miniArtClickTarget.addEventListener("click", () => dom.fullPlayerModal.classList.add("active"));
    dom.miniInfoClickTarget.addEventListener("click", () => dom.fullPlayerModal.classList.add("active"));
    dom.miniPlayPauseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePlayPause();
    });
    dom.miniNextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playNextTrack();
    });
    dom.miniLikeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLikeCurrentTrack();
    });

    // Full Screen Player Controls
    dom.collapsePlayerBtn.addEventListener("click", () => dom.fullPlayerModal.classList.remove("active"));
    dom.fullPlayPauseFab.addEventListener("click", () => togglePlayPause());
    dom.fullNextBtn.addEventListener("click", () => playNextTrack());
    dom.fullPrevBtn.addEventListener("click", () => playPrevTrack());
    dom.fullShuffleBtn.addEventListener("click", () => toggleShuffle());
    dom.fullRepeatBtn.addEventListener("click", () => toggleRepeat());
    dom.fullHeartBtn.addEventListener("click", () => toggleLikeCurrentTrack());

    // Wavy Seekbar Interaction
    dom.wavySliderContainer.addEventListener("click", (e) => {
      if (!ytPlayerReady || !ytPlayer) return;
      const rect = dom.wavySliderContainer.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur = ytPlayer.getDuration ? ytPlayer.getDuration() : 0;
      seekTo(pct * dur);
    });

    // Full Volume Slider
    dom.fullVolumeSlider.addEventListener("input", (e) => {
      const vol = parseInt(e.target.value, 10);
      state.volume = vol;
      if (ytPlayerReady && ytPlayer && ytPlayer.setVolume) {
        ytPlayer.setVolume(vol);
      }
    });

    // Side Drawer (Queue & Lyrics)
    dom.topQueueBtn.addEventListener("click", () => openDrawer("queue"));
    dom.topLyricsBtn.addEventListener("click", () => openDrawer("lyrics"));
    dom.fullOpenQueueBtn.addEventListener("click", () => openDrawer("queue"));
    dom.fullOpenLyricsBtn.addEventListener("click", () => openDrawer("lyrics"));
    dom.closeDrawerBtn.addEventListener("click", () => dom.sideDrawerModal.classList.remove("active"));
    dom.drawerBackdrop.addEventListener("click", () => dom.sideDrawerModal.classList.remove("active"));

    dom.tabBtnQueue.addEventListener("click", () => switchDrawerTab("queue"));
    dom.tabBtnLyrics.addEventListener("click", () => switchDrawerTab("lyrics"));
    dom.clearQueueBtn.addEventListener("click", () => {
      state.queue = state.currentTrack ? [state.currentTrack] : [];
      state.queueIndex = 0;
      renderQueueList();
      showToast("Queue cleared");
    });

    // Liked Songs Hero Actions
    dom.playAllLikedBtn.addEventListener("click", () => {
      if (state.likedSongs.length > 0) {
        state.queue = [...state.likedSongs];
        state.queueIndex = 0;
        playTrack(state.likedSongs[0], true);
      }
    });

    dom.shuffleLikedBtn.addEventListener("click", () => {
      if (state.likedSongs.length > 0) {
        const shuffled = [...state.likedSongs].sort(() => Math.random() - 0.5);
        state.queue = shuffled;
        state.queueIndex = 0;
        playTrack(shuffled[0], true);
      }
    });

    // Settings Accent Picker
    dom.accentDots.forEach((dot) => {
      dot.addEventListener("click", () => {
        dom.accentDots.forEach((d) => d.classList.remove("active"));
        dot.classList.add("active");
        const color = dot.style.getPropertyValue("--dot-color");
        document.documentElement.style.setProperty("--md-primary", color);
        document.documentElement.style.setProperty("--md-primary-container", `${color}28`);
        document.documentElement.style.setProperty("--md-primary-glow", `${color}55`);
        state.settings.accent = dot.dataset.accent;
        savePersistedState("settings");
      });
    });

    dom.settingAutoplay.addEventListener("change", (e) => {
      state.settings.autoplay = e.target.checked;
      savePersistedState("settings");
    });

    dom.settingVinylMode.addEventListener("change", (e) => {
      state.settings.vinylMode = e.target.checked;
      document.body.classList.toggle("vinyl-mode-active", e.target.checked);
      savePersistedState("settings");
    });

    dom.settingVisualizer.addEventListener("change", (e) => {
      state.settings.visualizer = e.target.checked;
      if (e.target.checked && state.isPlaying) startVisualizer();
      else stopVisualizer();
      savePersistedState("settings");
    });

    // Keyboard Shortcuts Dialog
    dom.railShortcutsBtn.addEventListener("click", () => dom.shortcutsDialog.classList.remove("hidden"));
    dom.closeShortcutsDialogBtn.addEventListener("click", () => dom.shortcutsDialog.classList.add("hidden"));
    dom.shortcutsDialog.addEventListener("click", (e) => {
      if (e.target === dom.shortcutsDialog) dom.shortcutsDialog.classList.add("hidden");
    });

    // Global Key Bindings
    document.addEventListener("keydown", (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      if (activeTag === "input" || activeTag === "textarea") return;

      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          togglePlayPause();
          break;
        case "KeyJ":
          e.preventDefault();
          if (ytPlayerReady && ytPlayer && ytPlayer.getCurrentTime) {
            seekTo(Math.max(0, ytPlayer.getCurrentTime() - 10));
          }
          break;
        case "KeyL":
          e.preventDefault();
          if (ytPlayerReady && ytPlayer && ytPlayer.getCurrentTime) {
            seekTo(ytPlayer.getCurrentTime() + 10);
          }
          break;
        case "KeyN":
          e.preventDefault();
          playNextTrack();
          break;
        case "KeyP":
          e.preventDefault();
          playPrevTrack();
          break;
        case "KeyM":
          e.preventDefault();
          if (ytPlayerReady && ytPlayer && ytPlayer.isMuted) {
            if (ytPlayer.isMuted()) {
              ytPlayer.unMute();
              showToast("Unmuted");
            } else {
              ytPlayer.mute();
              showToast("Muted");
            }
          }
          break;
        case "Slash":
          e.preventDefault();
          dom.globalSearchInput.focus();
          break;
        case "KeyQ":
          e.preventDefault();
          openDrawer("queue");
          break;
        case "KeyC":
          e.preventDefault();
          openDrawer("lyrics");
          break;
        case "KeyF":
          e.preventDefault();
          dom.fullPlayerModal.classList.toggle("active");
          break;
        case "Escape":
          dom.fullPlayerModal.classList.remove("active");
          dom.sideDrawerModal.classList.remove("active");
          dom.shortcutsDialog.classList.add("hidden");
          dom.searchSuggestionsList.classList.add("hidden");
          break;
      }
    });
  }

  function openDrawer(tabName) {
    dom.sideDrawerModal.classList.add("active");
    switchDrawerTab(tabName);
  }

  function switchDrawerTab(tabName) {
    if (tabName === "queue") {
      dom.tabBtnQueue.classList.add("active");
      dom.tabBtnLyrics.classList.remove("active");
      dom.drawerQueueContent.classList.add("active");
      dom.drawerLyricsContent.classList.remove("active");
      renderQueueList();
    } else {
      dom.tabBtnQueue.classList.remove("active");
      dom.tabBtnLyrics.classList.add("active");
      dom.drawerQueueContent.classList.remove("active");
      dom.drawerLyricsContent.classList.add("active");
    }
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(text) {
    if (!text) return "";
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  // =========================================================================
  // APP INITIALIZATION
  // =========================================================================
  function init() {
    loadPersistedState();
    initEventListeners();

    if (state.settings.vinylMode) {
      document.body.classList.add("vinyl-mode-active");
    }

    // Load initial trending hits on Home View
    fetchTrendingHits("Top Hits");
    renderHistorySection();
  }

  // Run on DOM Ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
