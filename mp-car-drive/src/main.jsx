import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, RotateCcw } from 'lucide-react';
import { TOTAL_ACRES, TOTAL_PARCELS } from './game/data';
import { ThreeScamGame } from './game/ThreeScamGame';
import './styles.css';

function TouchControls({ activeControls, setControl }) {
  const timersRef = useRef({});

  const activate = (event, name) => {
    event.preventDefault();
    window.clearTimeout(timersRef.current[name]);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setControl(name, true);
  };

  const release = (event, name) => {
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setControl(name, false);
  };

  const nudge = (event, name) => {
    event.preventDefault();
    setControl(name, true);
    window.clearTimeout(timersRef.current[name]);
    timersRef.current[name] = window.setTimeout(() => setControl(name, false), 180);
  };

  return (
    <div className="touch-controls" aria-label="Touch movement controls">
      {[
        ['left', 'Left', '‹'],
        ['up', 'Up', '▲'],
        ['down', 'Down', '▼'],
        ['right', 'Right', '›']
      ].map(([name, label, icon]) => (
        <button
          key={name}
          type="button"
          aria-label={label}
          className={activeControls[name] ? 'active' : ''}
          onPointerDown={(event) => activate(event, name)}
          onPointerUp={(event) => release(event, name)}
          onPointerCancel={(event) => release(event, name)}
          onClick={(event) => nudge(event, name)}
          onContextMenu={(event) => event.preventDefault()}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function Game() {
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const audioRef = useRef(null);
  const inputStateRef = useRef({ left: false, right: false, up: false, down: false });
  const [activeControls, setActiveControls] = useState(inputStateRef.current);
  const [started, setStarted] = useState(false);
  const [allotment, setAllotment] = useState(null);
  const [landGrabLog, setLandGrabLog] = useState([]);
  const [stats, setStats] = useState({
    acresGrabbed: 0,
    landParcelsGrabbed: 0,
    totalParcels: TOTAL_PARCELS,
    baitAttempts: 0,
    complete: false,
    endingText: ''
  });
  const [sceneError, setSceneError] = useState('');

  const getAudioContext = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return null;
    }
    const context = audioRef.current ?? new AudioContext();
    audioRef.current = context;
    context.resume?.();
    return context;
  }, []);

  const playTone = useCallback((context, frequency, start, duration, options = {}) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? 'triangle';
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    }
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(options.volume ?? 0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }, []);

  const playSound = useCallback((name) => {
    const context = getAudioContext();
    if (!context) {
      return;
    }
    const now = context.currentTime;
    if (name === 'flag') {
      [659.25, 880].forEach((frequency, index) => playTone(context, frequency, now + index * 0.07, 0.2, { volume: 0.09 }));
    } else if (name === 'magnet') {
      playTone(context, 130, now, 0.55, { type: 'sawtooth', volume: 0.055, endFrequency: 82 });
    } else if (name === 'paper') {
      [1500, 2100, 1750].forEach((frequency, index) => playTone(context, frequency, now + index * 0.035, 0.08, { type: 'square', volume: 0.025 }));
    } else if (name === 'jump') {
      playTone(context, 280, now, 0.22, { type: 'sine', volume: 0.1, endFrequency: 720 });
    } else if (name === 'stamp') {
      playTone(context, 86, now, 0.18, { type: 'square', volume: 0.18, endFrequency: 54 });
      playTone(context, 170, now + 0.02, 0.12, { type: 'triangle', volume: 0.1 });
    } else if (name === 'celebration') {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => playTone(context, frequency, now + index * 0.075, 0.26, { volume: 0.12 }));
    } else if (name === 'ending') {
      [392, 523.25, 659.25].forEach((frequency, index) => playTone(context, frequency, now + index * 0.11, 0.34, { volume: 0.13 }));
      playTone(context, 98, now + 0.44, 0.42, { type: 'sawtooth', volume: 0.06, endFrequency: 73 });
    }
  }, [getAudioContext, playTone]);

  const callbacks = useMemo(
    () => ({
      onUpdate: (nextStats) => {
        setSceneError('');
        setStats(nextStats);
      },
      onAllotment: (event) => {
        setAllotment(event);
        setLandGrabLog((current) => [
          ...current,
          {
            id: `${event.region}-${event.totalAcres}-${current.length}`,
            acres: event.acres,
            region: event.region,
            totalAcres: event.totalAcres
          }
        ]);
        window.clearTimeout(window.__mpAllotmentTimer);
        window.__mpAllotmentTimer = window.setTimeout(() => setAllotment(null), 2300);
      },
      onSound: playSound,
      onError: (error) => setSceneError(error?.message ?? String(error))
    }),
    [playSound]
  );

  useEffect(() => {
    if (!started || !sceneRef.current) {
      return undefined;
    }

    const game = new ThreeScamGame(sceneRef.current, {
      inputState: inputStateRef.current,
      callbacks
    });
    gameRef.current = game;

    return () => {
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, [callbacks, started]);

  useEffect(() => {
    const keyMap = {
      ArrowLeft: 'left',
      a: 'left',
      A: 'left',
      ArrowRight: 'right',
      d: 'right',
      D: 'right',
      ArrowUp: 'up',
      w: 'up',
      W: 'up',
      ArrowDown: 'down',
      s: 'down',
      S: 'down'
    };
    const codeMap = {
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down'
    };

    const setKey = (event, isActive) => {
      const control = keyMap[event.key] ?? codeMap[event.code];

      if (!control) {
        return;
      }

      event.preventDefault();
      inputStateRef.current[control] = isActive;
      setActiveControls({ ...inputStateRef.current });
    };

    const onKeyDown = (event) => setKey(event, true);
    const onKeyUp = (event) => setKey(event, false);

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const setControl = useCallback((name, isActive) => {
    inputStateRef.current[name] = isActive;
    setActiveControls({ ...inputStateRef.current });
  }, []);

  const reset = useCallback(() => {
    Object.assign(inputStateRef.current, { left: false, right: false, up: false, down: false });
    setActiveControls({ ...inputStateRef.current });
    setAllotment(null);
    setLandGrabLog([]);
    setStats({
      acresGrabbed: 0,
      landParcelsGrabbed: 0,
      totalParcels: TOTAL_PARCELS,
      baitAttempts: 0,
      complete: false,
      endingText: ''
    });
    setSceneError('');
    gameRef.current?.dispose();
    gameRef.current = null;
    if (started) {
      gameRef.current = new ThreeScamGame(sceneRef.current, {
        inputState: inputStateRef.current,
        callbacks
      });
    }
  }, [callbacks, started]);

  const startGame = useCallback(() => {
    playSound('flag');
    setStarted(true);
  }, [playSound]);

  return (
    <main className="game-page">
      <section className="game-shell" aria-label="Alleged land parcel collection game">
        <div className="world-wrap">
          <div ref={sceneRef} id="three-game" className="three-game" />
          {!started && (
            <div className="start-screen">
              <div className="start-panel">
                <span>Development Mission</span>
                <h1>Help CM Mohan Yadav Ji achieve the development goals of the state.</h1>
                <button type="button" onClick={startGame}>
                  <Play size={18} />
                  Start
                </button>
              </div>
            </div>
          )}
          {sceneError && (
            <div className="error-banner">
              <strong>Scene error</strong>
              <span>{sceneError}</span>
            </div>
          )}
          {started && landGrabLog.length > 0 && (
            <aside className="land-grab-log" aria-label="Land allotted">
              <strong>Land Allotted</strong>
              <ol>
                {landGrabLog.map((entry, index) => (
                  <li key={entry.id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{entry.region}</p>
                    <b>{entry.acres} acres</b>
                  </li>
                ))}
              </ol>
            </aside>
          )}
          {allotment && !stats.complete && (
            <div className="allotment-popup" role="status" aria-live="polite">
              <strong>Congratulations!</strong>
              <span>{allotment.acres} acres in {allotment.region} allotted to CM Saab.</span>
            </div>
          )}
          {stats.complete && (
            <div className="win-banner">
              <strong>{stats.endingText}</strong>
              <button type="button" onClick={reset}>
                <RotateCcw size={18} />
                Reset
              </button>
            </div>
          )}
        </div>

        {started && !stats.complete && (
          <button type="button" className="reset-float" onClick={reset} aria-label="Reset game">
            <RotateCcw size={19} />
          </button>
        )}

        {started && !stats.complete && (
          <div className="lower-bar controls-only">
            <TouchControls activeControls={activeControls} setControl={setControl} />
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Game />);
