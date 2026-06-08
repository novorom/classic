import { useState, useEffect, useRef, useCallback } from "react";

export default function PhoneSimulator({ classic, activeScriptIndex }) {
  const script = classic.scripts[activeScriptIndex];
  const subtitles = script.subtitles;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [visualEffect, setVisualEffect] = useState("default"); // default, gothic, grain, vintage
  const [synthEnabled, setSynthEnabled] = useState(true);
  
  const audioCtxRef = useRef(null);
  const oscillatorsRef = useRef([]);
  const gainNodeRef = useRef(null);
  const intervalRef = useRef(null);
  const currentTimeRef = useRef(0);

  // Total duration based on last subtitle end time
  const totalDuration = subtitles[subtitles.length - 1].end;

  // Web Audio Synth for Atmospheric Background
  const startSynth = useCallback(() => {
    if (!synthEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Base Gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 1.5);
      masterGain.connect(ctx.destination);
      gainNodeRef.current = masterGain;

      // Lowpass Filter for gothic/ambient feel
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(350, ctx.currentTime);
      filter.Q.setValueAtTime(1, ctx.currentTime);
      filter.connect(masterGain);

      const frequencies = classic.soundProfile?.length
        ? classic.soundProfile
        : [98.0, 146.83, 196.0, 246.94];

      oscillatorsRef.current = frequencies.map((freq, index) => {
        const osc = ctx.createOscillator();
        // Alternating triangle and sawtooth for rich textured pad
        osc.type = index % 2 === 0 ? "triangle" : "sawtooth";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        // Add subtle detune for chorus effect
        osc.detune.setValueAtTime((Math.random() - 0.5) * 15, ctx.currentTime);

        // Slow LFO for volume pulsing
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.2 + Math.random() * 0.3, ctx.currentTime);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.02, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency); // Modulate frequency slightly

        lfo.start();
        osc.connect(filter);
        osc.start();

        return { osc, lfo };
      });
    } catch (e) {
      console.error("Web Audio Synth failed to start:", e);
    }
  }, [classic.soundProfile, synthEnabled]);

  const stopSynth = useCallback(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      try {
        const ctx = audioCtxRef.current;
        const gain = gainNodeRef.current;
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

        setTimeout(() => {
          if (oscillatorsRef.current.length > 0) {
            oscillatorsRef.current.forEach(({ osc, lfo }) => {
              try { osc.stop(); } catch { /* ignore stop race */ }
              try { lfo.stop(); } catch { /* ignore stop race */ }
            });
            oscillatorsRef.current = [];
          }
          if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
          }
        }, 600);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      startSynth();
      const startTime = Date.now() - (currentTimeRef.current * 1000);
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= totalDuration) {
          setCurrentTime(0);
          setIsPlaying(false);
          stopSynth();
        } else {
          setCurrentTime(elapsed);
        }
      }, 50);
    } else {
      stopSynth();
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopSynth();
    };
  }, [isPlaying, startSynth, stopSynth, totalDuration]);

  // Find active subtitle
  const activeSubtitle = subtitles.find(
    (sub) => currentTime >= sub.start && currentTime <= sub.end
  );

  // Find active slide based on timeline
  const activeSlide = [...classic.slides]
    .reverse()
    .find((slide) => currentTime >= slide.time) || classic.slides[0];

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
  };

  // Heart & Comment simulator increments
  const [likes, setLikes] = useState(1284);
  const comments = 89;
  const [liked, setLiked] = useState(false);

  const handleLike = () => {
    if (liked) {
      setLikes(likes - 1);
      setLiked(false);
    } else {
      setLikes(likes + 1);
      setLiked(true);
    }
  };

  return (
    <div className="simulator-container">
      <h3 className="section-title">
        <span className="sparkle">🎬</span> Simulador de Video Corto
      </h3>

      <div className="simulator-layout">
        {/* The Phone Container */}
        <div className={`phone-wrapper ${visualEffect}`}>
          {/* Inner Screen */}
          <div className="phone-screen">
            {/* Notch */}
            <div className="phone-notch"></div>

            {/* Background Image / Slide */}
            <div 
              className="slide-background" 
              style={{ backgroundImage: `url(${activeSlide ? activeSlide.image : classic.background})` }}
            >
              {/* Dark Gradient Overlays */}
              <div className="screen-vignette"></div>
              <div className="bottom-shadow"></div>
            </div>

            {/* Vintage/Grain Overlays */}
            {visualEffect === "grain" && <div className="effect-grain-overlay"></div>}
            {visualEffect === "gothic" && <div className="effect-gothic-overlay"></div>}
            {visualEffect === "vintage" && <div className="effect-vintage-overlay"></div>}

            {/* Subtitle Display */}
            <div className="subtitle-container">
              {activeSubtitle ? (
                <div key={activeSubtitle.text} className="tiktok-subtitle">
                  {activeSubtitle.text}
                </div>
              ) : (
                <div className="subtitle-placeholder">...</div>
              )}
            </div>

            {/* Social Overlay (TikTok Style) */}
            <div className="social-overlay">
              {/* Creator Info */}
              <div className="creator-info">
                <div className="creator-username">@ClasicosRusosReels</div>
                <div className="video-description">
                  {classic.title} de {classic.author} · {classic.mood.split(",")[0]} · {classic.hashtags.split(" ").slice(0, 3).join(" ")}
                </div>
                <div className="music-tag">
                  <span className="music-icon">🎵</span> {classic.recommendedMusic}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="action-buttons">
                <div className="creator-avatar">
                  <img src={classic.portrait} alt={classic.author} />
                  <div className="plus-badge">+</div>
                </div>
                
                <button className={`action-btn ${liked ? "liked" : ""}`} onClick={handleLike}>
                  <svg viewBox="0 0 24 24" fill={liked ? "#ff2a5f" : "#ffffff"}>
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  <span>{likes}</span>
                </button>

                <div className="action-btn">
                  <svg viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                  </svg>
                  <span>{comments}</span>
                </div>

                <div className="action-btn">
                  <svg viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
                  </svg>
                  <span>Compartir</span>
                </div>

                <div className={`spinning-disc ${isPlaying ? "rotating" : ""}`}>
                  <img src={classic.portrait} alt="disco" />
                </div>
              </div>
            </div>

            {/* Micro Progress Bar on Screen Bottom */}
            <div className="screen-progress-bar" style={{ width: `${(currentTime / totalDuration) * 100}%` }}></div>
          </div>
        </div>

        {/* Player Controls Panel */}
        <div className="controls-panel card-premium">
          <div className="control-row">
            <button className="play-button" onClick={handlePlayPause}>
              {isPlaying ? (
                <>
                  <span className="btn-icon">⏸</span> Pausar
                </>
              ) : (
                <>
                  <span className="btn-icon">▶</span> Reproducir Vista Previa
                </>
              )}
            </button>
            
            <div className="time-display">
              {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </div>
          </div>

          {/* Timeline Seeker */}
          <div className="progress-container">
            <input 
              type="range" 
              min="0" 
              max={totalDuration} 
              step="0.1" 
              value={currentTime} 
              onChange={handleProgressChange}
              className="range-input"
            />
          </div>

          <hr className="divider" />

          {/* Soundtrack controls */}
          <div className="soundtrack-control">
            <label className="toggle-label">
              <input 
                type="checkbox" 
                checked={synthEnabled} 
                onChange={(e) => setSynthEnabled(e.target.checked)} 
              />
              <span className="toggle-custom"></span>
              🔊 Generar ambiente en tiempo real para la vista previa
            </label>
            <p className="help-text">
              Genera una atmósfera musical acorde a la pieza: <strong>{classic.recommendedMusic.split(" (")[0]}</strong>.
            </p>
          </div>

          <hr className="divider" />

          {/* Visual Effects Selector */}
          <div className="effects-control">
            <span className="control-label">Efecto Visual de Video:</span>
            <div className="effects-grid">
              <button 
                className={`effect-btn ${visualEffect === "default" ? "active" : ""}`}
                onClick={() => setVisualEffect("default")}
              >
                Normal
              </button>
              <button 
                className={`effect-btn gothic ${visualEffect === "gothic" ? "active" : ""}`}
                onClick={() => setVisualEffect("gothic")}
              >
                Gótico Ruso
              </button>
              <button 
                className={`effect-btn grain ${visualEffect === "grain" ? "active" : ""}`}
                onClick={() => setVisualEffect("grain")}
              >
                Cine Negro
              </button>
              <button 
                className={`effect-btn vintage ${visualEffect === "vintage" ? "active" : ""}`}
                onClick={() => setVisualEffect("vintage")}
              >
                VHS Retro
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
