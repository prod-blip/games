import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, RotateCcw } from 'lucide-react';
import { TOTAL_ACRES, TOTAL_PARCELS } from './game/data';
import { ThreeScamGame } from './game/ThreeScamGame';
import './styles.css';

function TouchControls({ activeControls, setControl }) {
  const joystickRef = useRef(null);
  const [stick, setStick] = useState({ x: 0, y: 0, active: false });

  const setVectorControls = useCallback((x, y) => {
    const deadZone = 0.24;
    setControl('left', x < -deadZone);
    setControl('right', x > deadZone);
    setControl('up', y < -deadZone);
    setControl('down', y > deadZone);
  }, [setControl]);

  const releaseAll = useCallback(() => {
    setStick({ x: 0, y: 0, active: false });
    setControl('left', false);
    setControl('right', false);
    setControl('up', false);
    setControl('down', false);
  }, [setControl]);

  const updateStick = useCallback((clientX, clientY) => {
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const radius = rect.width / 2;
    const maxDistance = radius - 24;
    const rawX = clientX - (rect.left + radius);
    const rawY = clientY - (rect.top + radius);
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    setStick({ x, y, active: true });
    setVectorControls(x / maxDistance, y / maxDistance);
  }, [setVectorControls]);

  const activate = (event, name) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setControl(name, true);
  };

  const release = (event, name) => {
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setControl(name, false);
  };

  const activateTouch = (event, name) => {
    setControl(name, true);
  };

  const releaseTouch = (event, name) => {
    setControl(name, false);
  };

  return (
    <>
      <div className="touch-controls direction-controls" aria-label="Keyboard-style movement controls">
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
            onPointerLeave={(event) => release(event, name)}
            onLostPointerCapture={(event) => release(event, name)}
            onTouchStart={(event) => activateTouch(event, name)}
            onTouchEnd={(event) => releaseTouch(event, name)}
            onTouchCancel={(event) => releaseTouch(event, name)}
            onContextMenu={(event) => event.preventDefault()}
            draggable="false"
          >
            {icon}
          </button>
        ))}
      </div>

      <div
        ref={joystickRef}
        className={`joystick-control${stick.active ? ' active' : ''}`}
        aria-label="Movement joystick"
        role="application"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          updateStick(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (stick.active) {
            event.preventDefault();
            updateStick(event.clientX, event.clientY);
          }
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          releaseAll();
        }}
        onPointerCancel={releaseAll}
        onLostPointerCapture={releaseAll}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (touch) {
            updateStick(touch.clientX, touch.clientY);
          }
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (touch) {
            updateStick(touch.clientX, touch.clientY);
          }
        }}
        onTouchEnd={releaseAll}
        onTouchCancel={releaseAll}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="joystick-track">
          <div className="joystick-crosshair horizontal" />
          <div className="joystick-crosshair vertical" />
          <div
            className="joystick-ball"
            style={{ transform: `translate(calc(-50% + ${stick.x}px), calc(-50% + ${stick.y}px))` }}
          />
        </div>
      </div>
    </>
  );
}

function Game() {
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const audioRef = useRef(null);
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isCinematic = useMemo(() => {
    return queryParams.get('mode') === 'cinematic';
  }, [queryParams]);
  const cinematicScenario = useMemo(() => queryParams.get('scenario') ?? 'default', [queryParams]);
  const inputStateRef = useRef({ left: false, right: false, up: false, down: false });
  const [activeControls, setActiveControls] = useState(inputStateRef.current);
  const [started, setStarted] = useState(isCinematic);
  const [allotment, setAllotment] = useState(null);
  const [landGrabLog, setLandGrabLog] = useState([]);
  const [cinematicCaption, setCinematicCaption] = useState(
    isCinematic ? { kicker: 'Development Mission', title: 'Help CM Mohan Yadav Ji achieve the development goals of the state.' } : null
  );
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
          {
            id: `${event.region}-${event.totalAcres}-${current.length}`,
            number: current.length + 1,
            acres: event.acres,
            region: event.region,
            totalAcres: event.totalAcres
          },
          ...current
        ]);
        window.clearTimeout(window.__mpAllotmentTimer);
        window.__mpAllotmentTimer = window.setTimeout(() => setAllotment(null), 2300);
      },
      onSound: playSound,
      onCinematicCaption: setCinematicCaption,
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
      callbacks,
      mode: isCinematic ? 'cinematic' : 'play',
      scenario: cinematicScenario
    });
    gameRef.current = game;

    return () => {
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, [callbacks, cinematicScenario, isCinematic, started]);

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
      gameRef.current?.setControl(control, isActive);
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
    gameRef.current?.setControl(name, isActive);
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
        callbacks,
        mode: isCinematic ? 'cinematic' : 'play',
        scenario: cinematicScenario
      });
    }
  }, [callbacks, cinematicScenario, started, isCinematic]);

  const startGame = useCallback(() => {
    playSound('flag');
    setStarted(true);
  }, [playSound]);

  return (
    <main className={`game-page${isCinematic ? ' cinematic-mode' : ''}`}>
      <section className="game-shell" aria-label="Alleged land parcel collection game">
        <div className="world-wrap">
          <div ref={sceneRef} id="three-game" className="three-game" />
          {!started && !isCinematic && (
            <div className="start-screen">
              <div className="start-panel">
                <h1>Development Drive</h1>
                <p>
                  Drive toward public goals like roads, schools, hospitals, and jobs. But reports allege that around Ujjain,
                  development corridors became opportunities for private land gain. Can you stay on the public route, or will
                  the map pull you toward land deals?
                </p>
                <small>Based on media reports and political allegations. Claims are disputed.</small>
                <button type="button" onClick={startGame}>
                  <Play size={18} />
                  Start Drive
                </button>
              </div>
            </div>
          )}
          {started && isCinematic && cinematicCaption && !stats.complete && (
            <div className="cinematic-caption" aria-live="polite">
              {cinematicCaption.kicker && <span>{cinematicCaption.kicker}</span>}
              <strong>{cinematicCaption.title}</strong>
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
                {landGrabLog.map((entry) => (
                  <li key={entry.id}>
                    <span>{String(entry.number).padStart(2, '0')}</span>
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

        {started && !stats.complete && !isCinematic && (
          <button type="button" className="reset-float" onClick={reset} aria-label="Reset game">
            <RotateCcw size={19} />
          </button>
        )}

        {started && !stats.complete && !isCinematic && (
          <div className="lower-bar controls-only">
            <TouchControls activeControls={activeControls} setControl={setControl} />
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Game />);
