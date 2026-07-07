import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './styles.css';

const games = [
  {
    title: 'E20 Road Test',
    eyebrow: 'Policy satire • 3D chase game',
    description: `Can you outrun the potholes, E20 policy or Mantri ji?

Drive through an endless road-test chaos run where E20 cans keep the car alive but also raise degradation. Dodge broken roads, survive the chaser, and see how long the bargain lasts before the garage bill catches up.`,
    image: '/e20-road-test.png',
    url: '/games/e20-road-test/',
    tags: ['Three.js', 'E20 chaos', 'Mobile controls']
  },
  {
    title: 'Development Drive',
    eyebrow: 'Political satire • 3D browser game',
    description: `Development is amazing, no? Roads come, plans come, master plans come… and somehow land also gets “allotted” at the perfect time. Pure coincidence, obviously.

Reports alleged that MP CM Mohan Yadav’s family and linked real-estate companies bought 137 plots, around 168 acres, in Ujjain after he became Chief Minister — many near road projects and land-use change zones under Ujjain Master Plan 2035.

Congress called it a land scam.
BJP called it baseless.
Public is just watching the “development drive” one plot at a time.

Play the game and see how fast public goals can turn into private land gains.`,
    image: '/mp-car-drive.png',
    url: 'https://games-ten-sage.vercel.app',
    tags: ['Three.js', 'React', 'Mobile friendly']
  }
];

function GameCard({ game }) {
  return (
    <article className="game-card">
      <a className="media-link" href={game.url} aria-label={`Open ${game.title}`}>
        <img src={game.image} alt={`${game.title} gameplay preview`} />
      </a>
      <div className="card-content">
        <p className="eyebrow">{game.eyebrow}</p>
        <h2>{game.title}</h2>
        <p className="description">{game.description}</p>
        <ul className="tags" aria-label={`${game.title} features`}>
          {game.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <a className="play-button" href={game.url}>
          Play game
        </a>
      </div>
    </article>
  );
}

function App() {
  return (
    <>
      <main className="page-shell">
        <section className="hero">
          <h1>Play like the Government plays with you!</h1>
          <p>
            Click on a game to play it in your browser. All games are free.
          </p>
        </section>

        <section className="games-grid" aria-label="Games">
          {games.map((game) => (
            <GameCard key={game.title} game={game} />
          ))}
        </section>
      </main>
      <Analytics />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
