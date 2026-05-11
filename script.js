const storage = {
  get(key, fallback = "") {
    try {
      const value = window.localStorage.getItem(key);
      if (value === null) return fallback;
      if (typeof fallback === "number") {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? fallback : parsed;
      }
      return value;
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (error) {
      return;
    }
  }
};

function readStoredJson(key, fallback) {
  try {
    const value = JSON.parse(storage.get(key, JSON.stringify(fallback)));
    return value && typeof value === "object" ? value : fallback;
  } catch (error) {
    return fallback;
  }
}

const localGameMeta = {
  snake: {
    category: "Arcade",
    title: "Offline Snake",
    description:
      "Guide the snake, collect food, and avoid your own trail in a fast monochrome local clone.",
    best: "Classic arcade chasing",
    controls: "Swipe, WASD, arrows, or on-screen pad"
  },
  merge: {
    category: "Puzzle",
    title: "Merge",
    description:
      "Slide and combine matching tiles while the board slowly fills with pressure.",
    best: "Quick puzzle sessions",
    controls: "Swipe, arrows, or on-screen pad"
  },
  tap: {
    category: "Reflex",
    title: "Tap Rush",
    description:
      "A bright target jumps around the grid while the timer counts down.",
    best: "Short speed runs",
    controls: "Tap or click the bright cell"
  },
  word: {
    category: "Word",
    title: "Word Warp",
    description:
      "Unscramble themed words and keep your streak alive.",
    best: "Quick language breaks",
    controls: "Type your guess and submit"
  },
  memory: {
    category: "Match",
    title: "Orb Memory",
    description:
      "Flip cards, lock in the pairs, and clear the board in fewer moves.",
    best: "Relaxed pattern play",
    controls: "Tap or click cards"
  },
  slots: {
    category: "Casino",
    title: "Neon Slots",
    description:
      "Spin three animated reels, chase clean matches, and stack fake-chip profit in the local bank.",
    best: "Quick flashy sessions",
    controls: "Press spin and watch the reels"
  },
  blackjack: {
    category: "Casino",
    title: "Blackjack Lite",
    description:
      "Beat the dealer in a clean blackjack table with colored cards and local chip betting.",
    best: "Longer strategy rounds",
    controls: "Deal, hit, or stand"
  },
  roulette: {
    category: "Casino",
    title: "Roulette Rush",
    description:
      "Pick a color, spin the wheel, and build a streak with smooth local chip betting.",
    best: "Fast risk-and-reward rounds",
    controls: "Choose a color and spin"
  },
  poker: {
    category: "Casino",
    title: "Video Poker",
    description:
      "Deal five cards, hold what matters, and draw into cleaner hands with local chip bets.",
    best: "Longer casino sessions",
    controls: "Deal, hold cards, then draw"
  },
  dice: {
    category: "Casino",
    title: "Dice Duel",
    description:
      "Bet on low, high, or lucky seven and ride out a slick local dice roll animation.",
    best: "Quick betting rounds",
    controls: "Pick a lane and roll"
  }
};

const standardCardSuits = [
  { key: "spade", symbolHtml: "&spades;", colorClass: "is-black" },
  { key: "heart", symbolHtml: "&hearts;", colorClass: "is-red" },
  { key: "club", symbolHtml: "&clubs;", colorClass: "is-black" },
  { key: "diamond", symbolHtml: "&diams;", colorClass: "is-red" }
];
const standardCardRanks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const casinoBetDefaults = {
  slots: 25,
  blackjack: 50,
  roulette: 25,
  poker: 50,
  dice: 25
};

function shuffleArray(list) {
  const next = [...list];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function createStandardDeck() {
  return shuffleArray(
    standardCardSuits.flatMap((suit) =>
      standardCardRanks.map((rank) => ({
        rank,
        suitKey: suit.key,
        symbolHtml: suit.symbolHtml,
        colorClass: suit.colorClass,
        hidden: false
      }))
    )
  );
}

function formatCasinoAmount(amount) {
  const value = Math.round(Number(amount) || 0);
  const sign = value < 0 ? "-$" : "$";
  return `${sign}${Math.abs(value).toLocaleString()}`;
}

function renderStandardCard(card, options = {}) {
  if (card.hidden) {
    return `
      <article class="playing-card is-hidden">
        <span>Dealer</span>
        <strong>?</strong>
        <span>Hidden</span>
      </article>
    `;
  }

  const clickableClass = options.clickable ? " is-clickable" : "";
  const heldClass = options.held ? " is-held" : "";
  const buttonAttrs = options.clickable
    ? ` role="button" tabindex="0" aria-pressed="${options.held ? "true" : "false"}"`
    : "";

  return `
    <article class="playing-card ${card.colorClass}${heldClass}${clickableClass}"${buttonAttrs}>
      <span class="card-corner">${card.rank}${card.symbolHtml}</span>
      <strong>${card.rank}</strong>
      <span class="card-corner card-corner-bottom">${card.symbolHtml}${card.rank}</span>
    </article>
  `;
}

const casinoWallet = (() => {
  const refillAmount = 1000;
  const groups = [...document.querySelectorAll("[data-casino-controls]")];
  let bank = Math.max(0, storage.get("vel-casino-bank", 2000));
  let bets = {
    ...casinoBetDefaults,
    ...readStoredJson("vel-casino-bets", casinoBetDefaults)
  };

  function persist() {
    storage.set("vel-casino-bank", bank);
    storage.set("vel-casino-bets", JSON.stringify(bets));
  }

  function sanitizeBet(gameId, value) {
    const fallback = casinoBetDefaults[gameId] || 25;
    const numeric = Math.max(10, Math.round(Number(value) || fallback));
    if (bank <= 0) return numeric;
    return Math.min(numeric, bank);
  }

  function getBet(gameId) {
    bets[gameId] = sanitizeBet(gameId, bets[gameId]);
    return bets[gameId];
  }

  function render() {
    groups.forEach((group) => {
      const gameId = group.dataset.casinoControls;
      const bankElement = group.querySelector("[data-casino-bank]");
      const betElement = group.querySelector("[data-casino-bet]");
      const bet = getBet(gameId);

      if (bankElement) {
        bankElement.textContent = formatCasinoAmount(bank);
      }

      if (betElement) {
        betElement.textContent = formatCasinoAmount(bet);
      }

      group.querySelectorAll("[data-chip-value]").forEach((button) => {
        button.classList.toggle("is-active", Number(button.dataset.chipValue) === bet);
      });
    });

    document.dispatchEvent(new CustomEvent("casino-wallet-change"));
  }

  function setBet(gameId, value) {
    bets[gameId] = sanitizeBet(gameId, value);
    persist();
    render();
    return bets[gameId];
  }

  function canCover(gameId) {
    return bank >= getBet(gameId);
  }

  function charge(gameId) {
    const bet = getBet(gameId);
    if (bank < bet) {
      render();
      return 0;
    }
    bank -= bet;
    persist();
    render();
    return bet;
  }

  function add(amount) {
    const next = Math.max(0, Math.round(Number(amount) || 0));
    if (!next) return bank;
    bank += next;
    persist();
    render();
    return bank;
  }

  function refill() {
    bank += refillAmount;
    persist();
    render();
    return bank;
  }

  document.addEventListener("click", (event) => {
    const chip = event.target.closest(".casino-chip");
    if (!chip) return;
    const group = chip.closest("[data-casino-controls]");
    if (!group) return;
    const gameId = group.dataset.casinoControls;
    if (chip.hasAttribute("data-casino-refill")) {
      refill();
      return;
    }
    if (chip.dataset.chipValue) {
      setBet(gameId, Number(chip.dataset.chipValue));
    }
  });

  persist();
  render();

  return {
    add,
    canCover,
    charge,
    format: formatCasinoAmount,
    getBank() {
      return bank;
    },
    getBet,
    refill,
    render,
    setBet
  };
})();

const generatedBadgeCache = new Map();

function getBadgeInitials(title) {
  return String(title || "Game")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "GM";
}

function hashText(value) {
  return [...String(value || "velos")].reduce(
    (total, char) => ((total << 5) - total + char.charCodeAt(0)) | 0,
    0
  );
}

function createGameBadgeSrc(title, category = "Game") {
  const key = `${title}::${category}`;
  if (generatedBadgeCache.has(key)) {
    return generatedBadgeCache.get(key);
  }

  const initials = getBadgeInitials(title);
  const hash = Math.abs(hashText(key));
  const motifs = [
    '<circle cx="18" cy="20" r="10" fill="rgba(255,255,255,0.08)" /><path d="M24 68L72 20" stroke="rgba(255,255,255,0.18)" stroke-width="4" stroke-linecap="round" />',
    '<rect x="14" y="14" width="26" height="26" rx="10" fill="rgba(255,255,255,0.08)" /><rect x="54" y="54" width="18" height="18" rx="7" fill="rgba(255,255,255,0.14)" />',
    '<path d="M16 72C32 38 50 28 78 16" stroke="rgba(255,255,255,0.18)" stroke-width="5" stroke-linecap="round" /><circle cx="28" cy="28" r="8" fill="rgba(255,255,255,0.1)" />',
    '<rect x="12" y="20" width="72" height="10" rx="5" fill="rgba(255,255,255,0.08)" /><rect x="12" y="66" width="50" height="8" rx="4" fill="rgba(255,255,255,0.14)" />'
  ];
  const motif = motifs[hash % motifs.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none">
      <rect width="96" height="96" rx="24" fill="#0A0A0A"/>
      <rect x="1" y="1" width="94" height="94" rx="23" stroke="rgba(255,255,255,0.12)"/>
      ${motif}
      <text x="48" y="56" text-anchor="middle" fill="#FFFFFF" font-size="29" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="1">${initials}</text>
      <text x="48" y="76" text-anchor="middle" fill="rgba(255,255,255,0.46)" font-size="8.2" font-weight="700" font-family="Segoe UI, Arial, sans-serif" letter-spacing="1.8">${String(category).slice(0, 9).toUpperCase()}</text>
    </svg>
  `.trim();

  const src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  generatedBadgeCache.set(key, src);
  return src;
}

const gameSourceLabels = {
  all: "All",
  local: "Local",
  gamepix: "GamePix",
  poki: "Poki",
  google: "Google",
  crazygames: "CrazyGames",
  other: "More Sites"
};

function getGameSourceLabel(source) {
  return gameSourceLabels[source] || gameSourceLabels.other;
}

function titleFromSlug(slug) {
  return String(slug || "game")
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (/^\d/.test(part) || part.length <= 2) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function inferGameSource(game) {
  const urls = [game.url, ...(game.mirrors || [])].join(" ");
  if (game.source) return game.source;
  if (/gamepix\.com/i.test(urls)) return "gamepix";
  if (/poki\.com/i.test(urls)) return "poki";
  if (/google\.com/i.test(urls)) return "google";
  if (/crazygames\.com/i.test(urls)) return "crazygames";
  return "other";
}

const webApps = {
  browser: {
    title: "Web Browser",
    tag: "URL Launcher",
    description: "Search the web or open a URL inside the vel.os web window.",
    url: "about:blank",
    embedBlocked: false,
    note: "Type a search like 'space games' or a full URL. This is a normal browser frame, not a bypass proxy."
  },

  googlesnake: {
    title: "Google Snake",
    tag: "Game Site",
    description: "Google's real Snake arcade page opened through vel.os.",
    url: "https://www.google.com/fbx?fbx=snake_arcade&fbxga=1&hl=en&origin=www.google.com",
    embedBlocked: true,
    note: "Google Snake blocks iframe loading, so use this as a fallback/external-style entry."
  },

  rocketgoal: {
    title: "RocketGoal",
    tag: "Game Site",
    description: "Live RocketGoal site opened inside vel.os.",
    url: "https://rocketgoal.io/",
    embedBlocked: false,
    note: "RocketGoal should load inside vel.os unless the site or network blocks iframe access."
  },

  dune: {
    title: "Goon dash",
    tag: "Game Site",
    description: "The ball-flying dune game opened inside vel.os.",
    url: "https://www.gamepix.com/play/dune",
    embedBlocked: false,
    note: "Guys at school yk who this is dont snitch and dont get caught (-.-. .- .-.. .-.. .- -.)"
  },

  fourcolors: {
    title: "4 Colors Multiplayer",
    tag: "Game Site",
    description: "Live GamePix page for 4 Colors Multiplayer inside vel.os.",
    url: "https://www.gamepix.com/play/4-colors-multiplayer",
    embedBlocked: false,
    note: "4 Colors should load inside vel.os unless the site or network blocks iframe access."
  },

  snowrider: {
    title: "Snow Rider 3D",
    tag: "Game Site",
    description: "Snow Rider 3D opened inside vel.os.",
    url: "https://snowrider3dworld.com/",
    embedBlocked: false,
    note: "This version has a decent chance to stay inside vel.os."
  },

  slither: {
    title: "Slither.io",
    tag: "Game Site",
    description: "Slither opened through vel.os using the official site.",
    url: "http://slither.io/",
    embedBlocked: false,
    note: "The official Slither site uses HTTP, so it may get blocked later if vel.os is hosted on HTTPS."
  },

  snakegame: {
    title: "Snake Game",
    tag: "Game Site",
    description: "A standalone snake game page opened inside vel.os.",
    url: "https://www.gamepix.com/play/snake-game",
    embedBlocked: false,
    note: "Good fallback if Google Snake refuses to load inside iframe."
  },

  snake2048: {
    title: "Snake 2048",
    tag: "Game Site",
    description: "Snake mixed with 2048 in one arcade-style page.",
    url: "https://www.gamepix.com/play/snake-2048-io",
    embedBlocked: false,
    note: "Arcade number-snake game from GamePix."
  },

  game2048: {
    title: "2048",
    tag: "Game Site",
    description: "Classic 2048 sliding puzzle inside vel.os.",
    url: "https://www.gamepix.com/play/2048",
    embedBlocked: false,
    note: "Simple puzzle game that fits the launcher well."
  },

  tetris: {
    title: "Tetris",
    tag: "Game Site",
    description: "Falling block puzzle game inside vel.os.",
    url: "https://www.gamepix.com/play/tetris",
    embedBlocked: false,
    note: "Classic block-stacking puzzle page."
  },

  pacman: {
    title: "Pac-Man",
    tag: "Game Site",
    description: "Maze arcade game opened inside vel.os.",
    url: "https://www.gamepix.com/play/pac-man",
    embedBlocked: false,
    note: "Classic arcade option for the catalog."
  },

  minesweeper: {
    title: "Minesweeper",
    tag: "Game Site",
    description: "Classic minesweeper puzzle page.",
    url: "https://www.gamepix.com/play/minesweeper",
    embedBlocked: false,
    note: "Simple puzzle game that should fit inside your current web window."
  },

  sudoku: {
    title: "Sudoku",
    tag: "Game Site",
    description: "Sudoku puzzle game inside vel.os.",
    url: "https://www.gamepix.com/play/sudoku",
    embedBlocked: false,
    note: "Good slower-paced puzzle option."
  },

  chess: {
    title: "Chess",
    tag: "Game Site",
    description: "Chess page opened inside vel.os.",
    url: "https://www.gamepix.com/play/chess",
    embedBlocked: false,
    note: "Board game option for the web catalog."
  },

  checkers: {
    title: "Checkers",
    tag: "Game Site",
    description: "Checkers page opened inside vel.os.",
    url: "https://www.gamepix.com/play/checkers-legend",
    embedBlocked: false,
    note: "Simple board game entry."
  },

  basketrandom: {
    title: "Basket Random",
    tag: "Game Site",
    description: "Chaotic basketball game inside vel.os.",
    url: "https://www.crazygames.com/game/basket-random",
    embedBlocked: true,
    note: "CrazyGames pages may block iframe loading, so keep this as a likely fallback."
  },

  volleyrandom: {
    title: "Volley Random",
    tag: "Game Site",
    description: "Random physics volleyball game.",
    url: "https://www.crazygames.com/game/volley-random",
    embedBlocked: true,
    note: "May need fallback handling if iframe loading is blocked."
  },

  shellshockers: {
    title: "Shell Shockers",
    tag: "Game Site",
    description: "Egg FPS game loaded through vel.os.",
    url: "https://www.crazygames.com/game/shellshockersio",
    embedBlocked: true,
    note: "Likely to block iframe embedding, so this is a fallback-style entry."
  },

  cuttherope: {
    title: "Cut the Rope",
    tag: "Game Site",
    description: "Physics puzzle game with Om Nom.",
    url: "https://www.crazygames.com/game/cut-the-rope-ebx",
    embedBlocked: true,
    note: "Set as blocked fallback because some platform pages refuse iframe embedding."
  },

  subway: {
    title: "Subway Surfers",
    tag: "Game Site",
    description: "Runner game inside vel.os.",
    url: "https://poki.com/en/g/subway-surfers",
    embedBlocked: true,
    note: "Poki often blocks iframe loading, so this should be treated as a likely fallback."
  },

  temple: {
    title: "Temple Run 2",
    tag: "Game Site",
    description: "Temple Run 2 through vel.os.",
    url: "https://poki.com/en/g/temple-run-2",
    embedBlocked: true,
    note: "Good catalog entry, but Poki pages often block iframe use."
  },

  motox3m: {
    title: "Moto X3M",
    tag: "Game Site",
    description: "Bike stunt game opened through vel.os.",
    url: "https://poki.com/en/g/moto-x3m",
    embedBlocked: true,
    note: "Poki pages often need fallback handling."
  },

  drivemad: {
    title: "Drive Mad",
    tag: "Game Site",
    description: "Physics driving game through vel.os.",
    url: "https://poki.com/en/g/drive-mad",
    embedBlocked: true,
    note: "Likely needs fallback handling if iframe loading fails."
  },

  retrobowl: {
    title: "Retro Bowl",
    tag: "Game Site",
    description: "Retro football game opened through vel.os.",
    url: "https://poki.com/en/g/retro-bowl",
    embedBlocked: true,
    note: "Useful catalog entry, but Poki may block embedding."
  },

  tunnelrush: {
    title: "Tunnel Rush",
    tag: "Game Site",
    description: "Fast tunnel reflex game.",
    url: "https://www.crazygames.com/game/tunnel-rush",
    embedBlocked: true,
    note: "Likely to require fallback if iframe access is blocked."
  },

  stickmanhook: {
    title: "Stickman Hook",
    tag: "Game Site",
    description: "Swing through levels in Stickman Hook.",
    url: "https://poki.com/en/g/stickman-hook",
    embedBlocked: true,
    note: "Poki page, so iframe loading may fail."
  },

  youtube: {
    title: "YouTube",
    tag: "Media Provider",
    description: "Search YouTube with the backend API and play videos in vel.os.",
    url: "about:blank",
    mode: "mediaProvider",
    provider: "youtube",
    embedBlocked: false,
    note: "YouTube search runs through /api/youtube/search so the API key stays on the server."
  },

  spotify: {
    title: "Spotify",
    tag: "Media Provider",
    description: "Search Spotify metadata and open official Spotify embeds.",
    url: "about:blank",
    mode: "mediaProvider",
    provider: "spotify",
    embedBlocked: false,
    note: "Spotify search runs through /api/spotify/search using server-side client credentials."
  },

  tiktok: {
    title: "TikTok",
    tag: "Media Provider",
    description: "Connect TikTok to display authorized profile videos.",
    url: "about:blank",
    mode: "mediaProvider",
    provider: "tiktok",
    embedBlocked: false,
    note: "TikTok uses official Login Kit and Display API endpoints only."
  },

  tubi: {
    title: "Tubi",
    tag: "Watch Site",
    description: "Tubi cannot be embedded as a full website inside vel.os.",
    url: "about:blank",
    mode: "insideOnlyBlocked",
    embedBlocked: true,
    note: "Tubi blocks iframe loading for the main app. To keep the project inside-only, use local videos or official embeddable trailers instead."
  },

  pluto: {
    title: "Pluto TV",
    tag: "Watch Site",
    description: "Pluto TV cannot be embedded as a full website inside vel.os.",
    url: "about:blank",
    mode: "insideOnlyBlocked",
    embedBlocked: true,
    note: "Pluto TV blocks iframe loading for the main app. To keep the project inside-only, use local videos or official embeddable clips instead."
  }
};

["youtube", "spotify", "tiktok", "tubi", "pluto"].forEach((id) => {
  delete webApps[id];
});

const gameCatalog = [
  {
    id: "googlesnake",
    title: "Snake Classic",
    category: "Arcade",
    badgeSrc: "./assets/images/apps/google-snake.svg",
    url: "https://www.gamepix.com/play/snake-game",
    mirrors: [
      "https://www.google.com/fbx?fbx=snake_arcade&fbxga=1&hl=en&origin=www.google.com"
    ],
    note: "Primary source is an inline-friendly Snake page. The Google mirror is included, but Google may still refuse iframe loading."
  },
  {
    id: "rocketgoal",
    title: "RocketGoal",
    category: "Sports",
    badgeSrc: "./assets/images/apps/rocketgoal.png",
    url: "https://rocketgoal.io/",
    note: "Live RocketGoal site loaded inside the vel.os game window."
  },
  {
    id: "dune",
    title: "Dune",
    category: "Arcade",
    badgeSrc: "./assets/images/apps/dune.jpg",
    url: "https://www.gamepix.com/play/dune",
    note: "Inline-friendly dune flyer page."
  },
  {
    id: "fourcolors",
    title: "4 Colors",
    category: "Cards",
    badgeSrc: "./assets/images/apps/four-colors.jpg",
    url: "https://www.gamepix.com/play/4-colors-multiplayer",
    note: "Card battler with a direct GamePix source."
  },
  {
    id: "snowrider",
    title: "Snow Rider",
    category: "Runner",
    badgeSrc: "./assets/images/apps/snow-rider.svg",
    url: "https://snowrider3d.io/",
    mirrors: ["https://snowrider-3d.io/"],
    note: "Snow Rider 3D with two direct site mirrors."
  },
  {
    id: "slither",
    title: "Slither.io",
    category: "IO",
    badgeSrc: "./assets/images/apps/slither.svg",
    url: "https://www.crazygames.com/embed/slitherio",
    mirrors: ["http://slither.io/"],
    note: "CrazyGames embed first, official site as a mirror."
  },
  {
    id: "subway",
    title: "Subway Surfers",
    category: "Runner",
    badgeText: "SS",
    url: "https://subwaysurfersgame.io/",
    mirrors: ["https://subwaysurfersgame.net/"],
    note: "Direct runner mirror because the original portal pages are usually iframe-blocked."
  },
  {
    id: "temple",
    title: "Temple Run 2",
    category: "Runner",
    badgeText: "TR",
    url: "https://templerun2.io/",
    note: "Direct Temple Run 2 mirror with better embed odds than the usual portals."
  },
  {
    id: "drivemad",
    title: "Drive Mad",
    category: "Physics",
    badgeText: "DM",
    url: "https://drivemad.net/",
    mirrors: ["https://drivemad.me/", "https://drivemad.org/"],
    note: "Drive Mad with multiple direct mirrors."
  },
  {
    id: "retrobowl",
    title: "Retro Bowl",
    category: "Sports",
    badgeText: "RB",
    url: "https://retrobowl.me/",
    mirrors: ["https://retrobowl-game.io/", "https://retrobowl.app/"],
    note: "Retro Bowl with direct mirrors."
  },
  {
    id: "stickmanhook",
    title: "Stickman Hook",
    category: "Arcade",
    badgeText: "SH",
    url: "https://stickmanhook.io/",
    mirrors: ["https://stickmanhookgame.com/"],
    note: "Stickman Hook with direct mirrors."
  }
];

function addCatalogGame(game) {
  const urls = [game.url, ...(game.mirrors || [])].filter(Boolean);
  const existingUrl = gameCatalog.some((item) => {
    const itemUrls = [item.url, ...(item.mirrors || [])].filter(Boolean);
    return itemUrls.some((url) => urls.includes(url));
  });

  if (gameCatalog.some((item) => item.id === game.id) || existingUrl) {
    return false;
  }

  gameCatalog.push({
    source: inferGameSource(game),
    badgeText: getBadgeInitials(game.title),
    mirrors: [],
    ...game
  });
  return true;
}

const gameSourceOverrides = {
  motox3m: {
    url: "https://gameforge.com/en-US/littlegames/moto-x3m/",
    mirrors: ["https://www.gamepix.com/play/moto-x3m"],
    note: "Moto X3M with a dedicated LittleGames source and GamePix fallback."
  },
  basketrandom: {
    url: "https://www.randombasketball.com/",
    mirrors: ["https://basket-random.io/", "https://www.gamepix.com/play/basket-random"],
    note: "Basket Random with direct dedicated mirrors beyond GamePix."
  },
  tunnelrush: {
    url: "https://tunnelrush.org/",
    mirrors: ["https://www.gamepix.com/play/tunnel-rush"],
    note: "Tunnel Rush with a dedicated runner site and GamePix fallback."
  },
  game2048: {
    url: "https://2048.game/",
    mirrors: ["https://www.2048global.com/", "https://www.gamepix.com/play/2048"],
    note: "2048 with dedicated puzzle mirrors plus the GamePix backup."
  },
  freecell: {
    url: "https://freecell.xyz/",
    mirrors: ["https://freecell.com/", "https://freakcell.com/", "https://www.gamepix.com/play/freecell-solitaire"],
    note: "FreeCell with multiple dedicated card-game sites to try."
  },
  uno: {
    url: "https://uno-online.io/",
    mirrors: ["https://uno-online.net/", "https://uno-online.com/", "https://www.gamepix.com/play/uno-online"],
    note: "UNO with dedicated browser-card mirrors and the GamePix version as backup."
  },
  slope: {
    url: "https://slopegame.lol/",
    mirrors: ["https://slope3.com/", "https://slope-play.com/", "https://www.gamepix.com/play/slope"],
    note: "Slope with dedicated runner mirrors beyond the GamePix page."
  }
};

[
  ["snakegame", "Snake Game", "Arcade", "SN", "snake-game"],
  ["snake2048", "Snake 2048", "Puzzle", "S2", "snake-2048-io"],
  ["game2048", "2048", "Puzzle", "20", "2048"],
  ["tetris", "Super Tetris", "Puzzle", "TT", "super-tetris"],
  ["tetrisclassic", "Brick Classic", "Puzzle", "BC", "brick-game-classic"],
  ["pacman", "Pac Game", "Arcade", "PM", "pac-game"],
  ["minesweeper", "Minesweeper", "Puzzle", "MS", "minesweeper"],
  ["sudoku", "Sudoku", "Puzzle", "SD", "sudoku"],
  ["mastersudoku", "Master Sudoku", "Puzzle", "SU", "master-sudoku"],
  ["chess", "Chess", "Board", "CH", "chess"],
  ["masterchess", "Master Chess", "Board", "MC", "master-chess-multiplayer"],
  ["checkers", "Checkers", "Board", "CK", "checkers-legend"],
  ["mastercheckers", "Master Checkers", "Board", "MK", "master-checkers-multiplayer"],
  ["motox3m", "Moto X3M", "Racing", "MX", "moto-x3m"],
  ["basketrandom", "Basket Random", "Sports", "BR", "basket-random"],
  ["volleyrandom", "Volley Random", "Sports", "VR", "volley-random"],
  ["tunnelrush", "Tunnel Rush", "Reflex", "TU", "tunnel-rush"],
  ["mahjong", "Mahjong", "Board", "MH", "mahjong"],
  ["mahjongbig", "Mahjong Big", "Board", "MB", "mahjong-big"],
  ["mahjongconnect", "Mahjong Connect", "Board", "MJ", "mahjong-connect"],
  ["mahjongcollision", "Mahjong Collision", "Board", "MM", "mahjong-collision"],
  ["solitaire", "Solitaire", "Cards", "SO", "solitaire"],
  ["classicsolitaire", "Classic Solitaire", "Cards", "CS", "classic-solitaire"],
  ["spidersolitaire", "Spider Solitaire", "Cards", "SP", "spider-solitaire"],
  ["freecell", "FreeCell", "Cards", "FC", "freecell-solitaire"],
  ["bubbleshooter", "Bubble Shooter", "Puzzle", "BS", "bubble-shooter"],
  ["bubblewoods", "Bubble Woods", "Puzzle", "BW", "bubble-woods"],
  ["ludo", "Ludo Hero", "Board", "LU", "ludo-hero"],
  ["tictactoe", "Tic Tac Toe", "Board", "XO", "tic-tac-toe"],
  ["domino", "Domino Blocks", "Board", "DO", "domino-block-multiplayer"],
  ["archery", "Archery Tour", "Sports", "AR", "archery-world-tour"],
  ["backgammon", "Backgammon", "Board", "BG", "backgammon"],
  ["classicbackgammon", "Classic Backgammon", "Board", "CB", "classic-backgammon"],
  ["pool8", "Pool 8 Ball", "Sports", "P8", "pool-8-ball"],
  ["billiardblitz", "Billiard Blitz", "Sports", "BB", "billiard-blitz-challenge"],
  ["wordsearch", "Word Search", "Word", "WS", "word-search"],
  ["wordconnect", "Word Connect", "Word", "WC", "word-connect"],
  ["nonogram", "Nonogram", "Puzzle", "NG", "nonogram-jigsaw"],
  ["parkingpanic", "Parking Panic", "Puzzle", "PP", "parking-panic"],
  ["parkingfury", "Parking Fury", "Driving", "PF", "parking-fury"],
  ["tinycars", "Tiny Cars", "Driving", "TC", "tiny-cars"],
  ["miniputt", "Mini Putt", "Sports", "MP", "mini-putt-gem-forest"],
  ["minigolf", "Mini Golf", "Sports", "MG", "minigolf-master"],
  ["omnomrun", "Om Nom Run", "Runner", "OR", "om-nom-run"],
  ["stackjump", "Stack Jump", "Arcade", "SJ", "stack-jump"],
  ["ramp", "Ramp", "Arcade", "RA", "ramp"],
  ["uno", "Uno Online", "Cards", "UO", "uno-online"],
  ["slope", "Slope", "Runner", "SL", "slope"],
  ["doodlejump", "Doodle Jump", "Arcade", "DJ", "doodle-jump"],
  ["jewelblocks", "Jewel Blocks", "Puzzle", "JB", "jewel-blocks"],
  ["fruitslice", "Fruit Slice", "Arcade", "FS", "fruit-slice"],
  ["basketballstars", "Basketball Stars", "Sports", "BA", "basketball-stars"],
  ["jigsaw", "Jigsaw Deluxe", "Puzzle", "JG", "jigsaw-puzzle-deluxe"],
  ["fancydiver", "Fancy Diver", "Puzzle", "FD", "fancy-diver"],
  ["zumbamania", "Zumba Mania", "Puzzle", "ZM", "zumba-mania"],
  ["littlegiant", "Little Giant", "Arcade", "LG", "the-little-giant"],
  ["colorroll", "Color Roll", "Puzzle", "CR", "color-roll-3d"],
  ["towercrash", "Tower Crash", "Arcade", "TW", "tower-crash-3d"]
].forEach(([id, title, category, badgeText, slug]) => {
  const gamepixUrl = `https://www.gamepix.com/play/${slug}`;
  const override = gameSourceOverrides[id];
  gameCatalog.push({
    id,
    title,
    category,
    badgeText,
    url: override?.url || gamepixUrl,
    source: override?.source || "gamepix",
    mirrors: override
      ? [...new Set([...(override.mirrors || []), gamepixUrl].filter((url) => url && url !== override.url))]
      : [],
    note: override?.note || `${title} loaded from a direct GamePix page.`
  });
});

[
  "body-drop-3d",
  "tentrix",
  "turbo-dismounting",
  "bloxd-io",
  "basketball-stars",
  "slope-racing-3d",
  "car-crash-test",
  "survival-456-but-its-impostor",
  "funny-shooter-2",
  "dogeminer-2",
  "hoop-world",
  "10x10",
  "agame-stunt-car",
  "kobadoo-flags",
  "fortzone-battle-royale",
  "ships-3d",
  "ultimate-flying-car",
  "moto-x3m-spooky-land",
  "copa-toon",
  "red-stickman-fighting-stick",
  "shell-shockers",
  "mr-racer-car-racing-game",
  "territorial-io",
  "gulper-io",
  "battle-for-the-galaxy",
  "little-big-snake",
  "madalin-cars-multiplayer",
  "racing-ball-3d",
  "crazy-shooters",
  "rocket-bot-royale",
  "flip-trickster-parkour-simulator",
  "demolition-derby-life",
  "stickman-street-fighting",
  "cat-clicker",
  "ultimate-offroad-cars-2",
  "sploop-io",
  "my-parking-lot",
  "mega-lamba-ramp",
  "warfare-1942-online-shooter",
  "strike-galaxy-attack",
  "1942-pacific-front",
  "1941-frozen-front",
  "brutal-battle-royale-2",
  "ballistic",
  "dinosaur-evolution",
  "kour-io",
  "spinning-oia-oia-cat-bricker",
  "moon-city-stunt",
  "taming-io",
  "dynamons-6",
  "spider-evolution-runner-game",
  "bodybuilder-karate-fighting",
  "zoo-boom",
  "madness-cars-destroy",
  "war-the-knights",
  "4-colors-multiplayer",
  "yummy-tales",
  "kogama-the-elevator",
  "crazy-shooters-2",
  "color-pixel-art-classic",
  "kogama-roller-coaster-world",
  "wild-west-gun-game",
  "horse-simulator-3d",
  "brutal-zombies",
  "kopanito-all-stars-soccer",
  "kogama-adopt-a-cat-or-dog-to-your-family",
  "3d-bowling",
  "stickman-archero-fight",
  "rummikub",
  "rovercraft",
  "bonk-io",
  "bomber-friends",
  "8-ball-billiards-classic",
  "real-extreme-car-driving-drift",
  "2048-x2-merge-blocks",
  "helicopter-and-tank-battle-desert-storm-multiplayer",
  "kogama-adopt-me",
  "merge-battle-tactics",
  "100-doors-escape-from-prison",
  "flying-motorbike-real-simulator",
  "worms-zone",
  "bubble-trouble",
  "kogama-escape-from-prison",
  "gem-valley",
  "explainable-minesweeper",
  "pixel-gun-apocalypse-3",
  "tank-forces-survival",
  "ben-10-world-rescue",
  "superstar-family-dress-up-game",
  "car-eats-car-volcanic-adventure",
  "war-brokers",
  "getaway",
  "skibidi-strike",
  "dino-merge-and-fight",
  "kogama-d-day",
  "mountain-tank",
  "pixely-color-by-number",
  "blockle",
  "smash-karts",
  "boat-drive",
  "moto-x3m",
  "top-10-soccer-managers",
  "battle-simulator-sandbox",
  "ninja-parkour-multiplayer",
  "mini-car"
].forEach((slug) => {
  const title = titleFromSlug(slug);
  addCatalogGame({
    id: `gamepix-${slug}`,
    title,
    category: "GamePix",
    source: "gamepix",
    url: `https://www.gamepix.com/play/${slug}`,
    note: `${title} from the official GamePix game catalog. If a network blocks GamePix, vel.os cannot bypass that.`
  });
});

[
  "count-war",
  "stickers-merge",
  "going-up-rooftop",
  "sushi-situation",
  "leaf-vacuum-simulator",
  "rail-in-the-air",
  "keyboard-warrior",
  "wheel-master",
  "soccer-skills-2-world-cup",
  "ogus",
  "dino-fighter",
  "cleanup-crew",
  "zombit",
  "pixel-perfect",
  "drift-hunters",
  "satisbox-builder",
  "duck-merge",
  "draft-wars",
  "crazy-merge",
  "zombie-merge",
  "guns-guns-guns",
  "tricky-witch",
  "carnado-bike-stunt",
  "kpop-concert-dress-up",
  "jelly-sokoban",
  "punchy-guy",
  "bunny-miner",
  "decor-life",
  "alchemix-match-3",
  "push-titans",
  "snacky-snake",
  "card-hog",
  "tower-emoji-defense",
  "real-city-bikes",
  "knockout-penguins",
  "bubble-tower",
  "merge-ink",
  "janes-fashion-studio",
  "jelly-fruit-merge",
  "sort-the-court",
  "freaky-clown-town-mystery",
  "fashion-tour-simulator",
  "skill-knight",
  "sprunki",
  "wreck-the-robot",
  "lips-diy-master",
  "magic-battleground",
  "free-skate",
  "tictoc-catwalk-fashion",
  "tuning-car-racing",
  "cozyville-find-hidden-objects",
  "alien-raid-monster-evolution",
  "sword-road",
  "metamon",
  "blast-buddies",
  "flat-baseball",
  "crazy-race",
  "astro-rancher",
  "67-game",
  "diva-makeup-studio",
  "cat-simulator",
  "bot-crash-combat-arena",
  "fashion-legends",
  "diy-desk-designer",
  "you-monster",
  "snow-riders",
  "ludo-king",
  "chef-bacon",
  "idle-spinner-factory-builder",
  "adventure-miner",
  "mine-and-dig",
  "mr-squarely",
  "apocalypse-merge",
  "tank-stars",
  "deadrise-io",
  "4th-and-goal-2026",
  "first-and-ten",
  "speed-stars",
  "neon-challenge-legends",
  "pizza-planet",
  "gas-station",
  "collect-n-evolve",
  "grass-knight",
  "slime-dunk",
  "carrom-multiplayer",
  "the-superhero-league-2",
  "moley-miner",
  "bombhopper-io",
  "draw-the-road",
  "mad-skills-rallycross",
  "mirror-image",
  "turnament",
  "pixel-pop",
  "papa-louie-3",
  "bos-bedroom",
  "racing-rampage",
  "snek-left",
  "bubble-heroes",
  "whip-flip",
  "funny-rescue-sumo",
  "yummy-ice-cream-factory",
  "papa-louie-2",
  "jackfrost",
  "ice-beak",
  "graveyard-shift"
].forEach((slug) => {
  const title = titleFromSlug(slug);
  addCatalogGame({
    id: `poki-${slug}`,
    title,
    category: "Poki",
    source: "poki",
    url: `https://poki.com/en/g/${slug}`,
    embedBlocked: true,
    note: `${title} is from Poki's official catalog, but Poki blocks third-party iframe loading with browser security rules. Use the GamePix, CrazyGames, or More Sites tabs for games that can stay inside vel.os.`
  });
});

[
  {
    id: "google-snake-official",
    title: "Google Snake",
    category: "Google",
    badgeSrc: "./assets/images/apps/google-snake.svg",
    url: "https://www.google.com/fbx?fbx=snake_arcade&fbxga=1&hl=en&origin=www.google.com"
  },
  {
    id: "google-pacman-doodle",
    title: "Google Pac-Man",
    category: "Google",
    url: "https://www.google.com/logos/2010/pacman10-i.html"
  },
  {
    id: "google-halloween-2016",
    title: "Magic Cat Academy",
    category: "Google",
    url: "https://www.google.com/logos/2016/halloween16/halloween16.html"
  },
  {
    id: "google-cricket-2017",
    title: "Google Cricket",
    category: "Google",
    url: "https://www.google.com/logos/2017/cricket17/cricket17.html"
  },
  {
    id: "google-basketball-2012",
    title: "Google Basketball",
    category: "Google",
    url: "https://www.google.com/logos/2012/basketball-2012-hp.html"
  },
  {
    id: "google-hurdles-2012",
    title: "Google Hurdles",
    category: "Google",
    url: "https://www.google.com/logos/2012/hurdles-2012-hp.html"
  },
  {
    id: "google-canoe-2012",
    title: "Google Slalom Canoe",
    category: "Google",
    url: "https://www.google.com/logos/2012/slalom_canoe-2012-hp.html"
  },
  {
    id: "google-baseball-2019",
    title: "Google Baseball",
    category: "Google",
    url: "https://www.google.com/logos/2019/july4th19/r6/july4th19.html"
  },
  {
    id: "google-champion-island",
    title: "Champion Island",
    category: "Google",
    url: "https://www.google.com/logos/2020/kitsune/rc6/kitsune20.html"
  }
].forEach((game) => {
  addCatalogGame({
    source: "google",
    embedBlocked: true,
    note: `${game.title} is an official Google game, but Google blocks third-party iframe loading with browser security rules. Use the GamePix, CrazyGames, or More Sites tabs for in-app play.`,
    ...game
  });
});

[
  ["crazygames-slither", "Slither.io", "IO", "https://www.crazygames.com/embed/slitherio"],
  ["crazygames-tunnel-rush", "Tunnel Rush", "Reflex", "https://www.crazygames.com/embed/tunnel-rush"],
  ["crazygames-basket-random", "Basket Random", "Sports", "https://www.crazygames.com/embed/basket-random"],
  ["crazygames-shell-shockers", "Shell Shockers", "Shooter", "https://www.crazygames.com/embed/shellshockersio"],
  ["crazygames-smash-karts", "Smash Karts", "Racing", "https://www.crazygames.com/embed/smash-karts"],
  ["crazygames-moto-x3m", "Moto X3M", "Racing", "https://www.crazygames.com/embed/moto-x3m"],
  ["crazygames-bloxd", "Bloxd.io", "Sandbox", "https://www.crazygames.com/embed/bloxdhop-io"],
  ["crazygames-8-ball", "8 Ball Billiards", "Sports", "https://www.crazygames.com/embed/8-ball-billiards-classic"],
  ["crazygames-words-of-wonders", "Words of Wonders", "Word", "https://www.crazygames.com/embed/words-of-wonders"],
  ["crazygames-house-of-hazards", "House of Hazards", "Party", "https://www.crazygames.com/embed/house-of-hazards"]
].forEach(([id, title, category, url]) => {
  addCatalogGame({
    id,
    title,
    category,
    source: "crazygames",
    url,
    note: `${title} using a CrazyGames embed URL. If the embed is unavailable, try another source tab.`
  });
});

gameCatalog.forEach((game) => {
  game.source = inferGameSource(game);
});

gameCatalog.forEach((game) => {
  webApps[game.id] = {
    title: game.title,
    tag: `${game.category} Game`,
    description: `${game.title} opened inside vel.os.`,
    url: game.url,
    mirrors: game.mirrors || [],
    embedBlocked: Boolean(game.embedBlocked),
    note: game.note,
    badgeText: game.badgeText || game.title.slice(0, 2).toUpperCase(),
    badgeSrc: game.badgeSrc || createGameBadgeSrc(game.title, game.category),
    category: game.category,
    source: game.source
  };
});

const utilityApps = {
  browser: {
    title: "Web Browser",
    label: "Web",
    badgeSrc: "./assets/images/apps/web-browser.svg",
    action: "web"
  },
  music: {
    title: "Velofy",
    label: "Velofy",
    badgeText: "VF",
    action: "panel",
    panel: "music"
  },
  ai: {
    title: "Vel AI",
    label: "Vel AI",
    badgeText: "AI",
    action: "panel",
    panel: "ai"
  },
  youtube: {
    title: "YouTube",
    label: "YouTube",
    badgeText: "YT",
    action: "panel",
    panel: "youtube"
  },
  velhub: {
    title: "Vel Hub",
    label: "Movies",
    badgeText: "VH",
    action: "panel",
    panel: "velhub"
  },
  lobbies: {
    title: "Notebook",
    label: "Notebook",
    badgeText: "NB",
    action: "panel",
    panel: "lobbies"
  },
  soundboard: {
    title: "Soundboard",
    label: "Sounds",
    badgeText: "SB",
    action: "panel",
    panel: "soundboard"
  },
  dev: {
    title: "Dev Panel",
    label: "Dev",
    badgeText: "DV",
    action: "panel",
    panel: "dev"
  },
  settings: {
    title: "Settings",
    label: "Settings",
    badgeText: "ST",
    action: "panel",
    panel: "settings"
  },
  network: {
    title: "Network",
    label: "Network",
    badgeText: "NW",
    action: "panel",
    panel: "network"
  },
  calculator: {
    title: "Calculator",
    label: "Calc",
    badgeText: "67",
    action: "panel",
    panel: "calculator"
  },
  localArcade: {
    title: "Local Arcade",
    label: "Arcade",
    badgeText: "LG",
    action: "game",
    gameId: "snake"
  }
};

const MEDIA_YOUTUBE_PAGE_SIZE = 12;

const wallpaperOptions = {
  vel: {
    label: "Ink Eye",
    path: "./assets/images/wallpaper/vel.png"
  },
  snow: {
    label: "Snow Lake",
    path: "./assets/images/wallpaper/IMG_2063.png"
  },
  moon: {
    label: "Moon Tree",
    path: "./assets/images/wallpaper/IMG_2064.png"
  }
};

const themePacks = {
  noir: {
    title: "Noir Core",
    cost: 0,
    wallpaper: "vel",
    taskbar: "glass",
    icon: "mono",
    boot: "classic"
  },
  frost: {
    title: "Frost Byte",
    cost: 120,
    wallpaper: "snow",
    taskbar: "frost",
    icon: "frost",
    boot: "flash"
  },
  violet: {
    title: "Moon Bloom",
    cost: 160,
    wallpaper: "moon",
    taskbar: "violet",
    icon: "soft",
    boot: "dream"
  },
  terminal: {
    title: "Terminal Ghost",
    cost: 220,
    wallpaper: "vel",
    taskbar: "terminal",
    icon: "terminal",
    boot: "scan"
  }
};

const velofyTracks = [
  {
    title: "Rock N Roll",
    artist: "Ken Carson",
    src: "./assets/audio/playlist/rock-n-roll.mp3",
    lyricsAliases: ["Rock N roll kencarson"]
  },
  {
    title: "Overseas",
    artist: "Ken Carson",
    src: "./assets/audio/playlist/overseas.mp3",
    lyricsAliases: ["overseas kencarson"]
  },
  {
    title: "Fighting My Demons",
    artist: "Ken Carson",
    src: "./assets/audio/playlist/fighting-my-demons.mp3",
    lyricsAliases: ["Fighting my demons kencarson"]
  },
  {
    title: "Yale",
    artist: "Ken Car$on",
    src: "./assets/audio/playlist/ken-carson-yale.mp3",
    lyricsAliases: ["yale kencarson"]
  },
  {
    title: "SS",
    artist: "Ken Carson",
    src: "./assets/audio/playlist/ss.mp3",
    lyricsAliases: ["ss kencarson"]
  },
  {
    title: "Sweater Weather",
    artist: "The Neighbourhood",
    src: "./assets/audio/playlist/sweater-weather.mp3",
    lyricsAliases: ["sweather weather"]
  },
  {
    title: "Call Me Maybe",
    artist: "Carly Rae Jepsen",
    src: "./assets/audio/playlist/call-me-maybe.mp3",
    lyricsAliases: ["call me maybe"]
  },
  {
    title: "California Gurls",
    artist: "Katy Perry ft. Snoop Dogg",
    src: "./assets/audio/playlist/california-gurls.mp3",
    lyricsAliases: ["california girls"]
  },
  {
    title: "goosebumps",
    artist: "Travis Scott ft. Kendrick Lamar",
    src: "./assets/audio/playlist/travis-scott-goosebumps.mp3"
  },
  {
    title: "FE!N",
    artist: "Travis Scott ft. Playboi Carti",
    src: "./assets/audio/playlist/travis-scott-fein.mp3"
  },
  {
    title: "SICKO MODE",
    artist: "Travis Scott ft. Drake",
    src: "./assets/audio/playlist/travis-scott-sicko-mode.mp3"
  },
  {
    title: "No Pole",
    artist: "Don Toliver",
    src: "./assets/audio/playlist/don-toliver-no-pole.mp3"
  },
  {
    title: "Money So Big",
    artist: "Yeat",
    src: "./assets/audio/playlist/yeat-money-so-big.mp3"
  },
  {
    title: "20 Min",
    artist: "Lil Uzi Vert",
    src: "./assets/audio/playlist/lil-uzi-vert-20-min.mp3"
  },
  {
    title: "Starboy",
    artist: "The Weeknd ft. Daft Punk",
    src: "./assets/audio/playlist/the-weeknd-starboy.mp3"
  },
  {
    title: "Blinding Lights",
    artist: "The Weeknd",
    src: "./assets/audio/playlist/the-weeknd-blinding-lights.mp3"
  },
  {
    title: "Congratulations",
    artist: "Post Malone ft. Quavo",
    src: "./assets/audio/playlist/post-malone-congratulations.mp3"
  },
  {
    title: "See You Again",
    artist: "Tyler, The Creator ft. Kali Uchis",
    src: "./assets/audio/playlist/tyler-the-creator-see-you-again.mp3"
  },
  {
    title: "Bad Habit",
    artist: "Steve Lacy",
    src: "./assets/audio/playlist/steve-lacy-bad-habit.mp3"
  },
  {
    title: "Umbrella",
    artist: "Rihanna ft. JAY-Z",
    src: "./assets/audio/playlist/rihanna-umbrella.mp3"
  },
  {
    title: "Passionfruit",
    artist: "Drake",
    src: "./assets/audio/playlist/drake-passionfruit.mp3"
  },
  {
    title: "HUMBLE.",
    artist: "Kendrick Lamar",
    src: "./assets/audio/playlist/kendrick-lamar-humble.mp3"
  },
  {
    title: "Kill Bill",
    artist: "SZA",
    src: "./assets/audio/playlist/sza-kill-bill.mp3"
  },
  {
    title: "Too Many Nights",
    artist: "Metro Boomin, Don Toliver & Future",
    src: "./assets/audio/playlist/metro-boomin-too-many-nights.mp3"
  },
  {
    title: "Doot Doot (6 7)",
    artist: "Skrilla",
    src: "./assets/audio/playlist/skrilla-doot-doot-6-7.mp3"
  }
];

const mediaYouTubeCatalog = [
  {
    id: "M7lc1UVf-VE",
    title: "YouTube Player Demo",
    channel: "YouTube Developers",
    thumbnail: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
    tags: ["youtube", "demo", "player"]
  },
  {
    id: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    channel: "Rick Astley",
    thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    tags: ["music", "classic", "pop"]
  },
  {
    id: "jfKfPfyJRdk",
    title: "Lofi Radio",
    channel: "Lofi Girl",
    thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
    tags: ["music", "study", "lofi"]
  },
  {
    id: "9bZkp7q19f0",
    title: "Gangnam Style",
    channel: "PSY",
    thumbnail: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
    tags: ["music", "dance", "viral"]
  },
  {
    id: "kJQP7kiw5Fk",
    title: "Despacito",
    channel: "Luis Fonsi",
    thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    tags: ["music", "latin", "popular"]
  },
  {
    id: "ScMzIvxBSi4",
    title: "Big Buck Bunny",
    channel: "Blender Foundation",
    thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg",
    tags: ["animation", "movie", "family"]
  }
];

const mediaShortsCatalog = [
  {
    title: "Flower Loop",
    channel: "MDN Video",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    poster: "linear-gradient(135deg, #111, #6f6f6f)",
    tags: ["shorts", "nature", "loop", "tiktok"]
  },
  {
    title: "Bunny Sprint",
    channel: "W3C Media",
    src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    poster: "linear-gradient(135deg, #050505, #888)",
    tags: ["shorts", "animation", "bunny", "movie"]
  },
  {
    title: "Sintel Cut",
    channel: "W3C Media",
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    poster: "linear-gradient(135deg, #0d0d0d, #577083)",
    tags: ["shorts", "cinematic", "trailer"]
  },
  {
    title: "Big Buck Bite",
    channel: "W3Schools",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    poster: "linear-gradient(135deg, #161616, #a5a5a5)",
    tags: ["shorts", "cartoon", "quick"]
  },
  {
    title: "Five Second Hit",
    channel: "SampleLib",
    src: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
    poster: "linear-gradient(135deg, #090909, #4e5b67)",
    tags: ["shorts", "sample", "fast"]
  }
];

const veltokClipPool = [
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Heelflip_Skate.webm",
    thumbnail: "linear-gradient(135deg, #050505, #4b4b4b)",
    source: "Wikimedia Commons: Heelflip Skate"
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/f/f5/Scootering_video.webm",
    thumbnail: "linear-gradient(135deg, #111, #35424f)",
    source: "Wikimedia Commons: Scootering video"
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/8/8f/Boxing_in_Mitchells_Plain.webm",
    thumbnail: "linear-gradient(135deg, #0b0b0b, #777)",
    source: "Wikimedia Commons: Boxing in Mitchells Plain"
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/5/5a/B-boy_performing_airchair_spin_in_slow_motion.webm",
    thumbnail: "linear-gradient(135deg, #050505, #2f4f68)",
    source: "Wikimedia Commons: B-boy airchair"
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/f/fe/Hula_hoop_fire_dance_video_Turkey_2015.webm",
    thumbnail: "linear-gradient(135deg, #101010, #7b6652)",
    source: "Wikimedia Commons: Hula hoop fire dance"
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/4/48/Kick-up.webm",
    thumbnail: "linear-gradient(135deg, #050505, #6b6b6b)",
    source: "Wikimedia Commons: Kick-up"
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/2/21/Most_unique_munna.webm",
    thumbnail: "linear-gradient(135deg, #151515, #40515f)",
    source: "Wikimedia Commons: Most unique munna"
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/1/17/2000_Powermove.webm",
    thumbnail: "linear-gradient(135deg, #080808, #535353)",
    source: "Wikimedia Commons: 2000 Powermove"
  },
  {
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    thumbnail: "linear-gradient(135deg, #080808, #8f8f8f)",
    source: "W3C Media: Sintel trailer"
  },
  {
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "linear-gradient(135deg, #050505, #46556b)",
    source: "MDN sample video"
  }
];

const veltokPromptSets = [
  {
    titles: ["Heelflip was way too clean", "Skate clip cooked the whole feed", "Tiny trick, massive replay value", "Board control went crazy", "This heelflip deserved slow-mo", "Skate edit with perfect timing"],
    creators: ["@skatevault", "@streetclipz", "@kickpush", "@boardroom"],
    tags: ["skate", "trick", "street", "fyp"]
  },
  {
    titles: ["Scooter line through the park", "Bro hit the smoothest rollaway", "Scooter POV had no business being clean", "Park line looked like a game clip", "Concrete park speedrun", "This trick chain kept going"],
    creators: ["@scootcore", "@parkline", "@wheelmode", "@concreteclips"],
    tags: ["scooter", "park", "action", "fyp"]
  },
  {
    titles: ["Boxing footwork looking sharp", "Bag work sounded like thunder", "Sparring drill had boss-fight energy", "Coach said keep your hands up", "Clean boxing training clip", "This combo was all timing"],
    creators: ["@glovework", "@fightcamp", "@boxingdaily", "@ringclips"],
    tags: ["boxing", "training", "sports", "safe"]
  },
  {
    titles: ["B-boy freeze made everyone stop", "Airchair spin was actually wild", "Dance battle energy unlocked", "Breakdance move hit different", "This floorwork needs a replay", "Crew went silent after this"],
    creators: ["@bboyclips", "@cyphermode", "@floorwork", "@dancevault"],
    tags: ["dance", "bboy", "breakdance", "viral"]
  },
  {
    titles: ["Fire hoop clip looked unreal", "This night performance glowed", "Festival energy went cinematic", "Fire dance but make it FYP", "The lighting carried this edit", "This belongs in a movie intro"],
    creators: ["@fireloop", "@nightshow", "@festivalcuts", "@glowedit"],
    tags: ["dance", "fire", "night", "edit"]
  },
  {
    titles: ["Kick-up timing was perfect", "Soccer control check passed", "One touch and the clip was saved", "Freestyle move with clean balance", "Ball control had NPCs watching", "Simple move, clean execution"],
    creators: ["@freestyleball", "@touchclips", "@skillcheck", "@streetball"],
    tags: ["soccer", "freestyle", "skill", "sports"]
  },
  {
    titles: ["Street dance went full main character", "This move was pure brainrot energy", "Dance clip with chaotic timing", "Bro danced like the beat owed money", "Comment section would cook this", "NPC dance unlocked"],
    creators: ["@streetdance", "@npcfactory", "@brainrotcuts", "@dancechaos"],
    tags: ["dance", "brainrot", "funny", "fyp"]
  },
  {
    titles: ["Power move landed too clean", "Breakdance combo had boss music", "Spin cycle but make it dance", "This move needs a health bar", "Floor combo was not normal", "B-boy clip with final boss energy"],
    creators: ["@powermove", "@spinclipz", "@bossdance", "@bboydaily"],
    tags: ["dance", "powermove", "action", "edit"]
  },
  {
    titles: ["Cinematic clip felt like a cutscene", "This looked like the start of a game", "Movie trailer energy on the feed", "The lighting carried the whole thing", "Action edit with no context", "Scene looked expensive for no reason"],
    creators: ["@cutscene", "@moviefeed", "@cinematic", "@editvault"],
    tags: ["cinematic", "movie", "edit", "action"]
  },
  {
    titles: ["Chill clip after the chaos", "Nature video somehow reset my brain", "One peaceful scroll before brainrot", "Flower loop hit different at night", "Soft reset for the feed", "This calm clip saved the doomscroll"],
    creators: ["@chillcore", "@softscroll", "@calmfeed", "@nightloop"],
    tags: ["chill", "nature", "loop", "vibe"]
  }
];

const veltokFeedSeed = Array.from({ length: 80 }, (_, index) => {
  const set = veltokPromptSets[index % veltokPromptSets.length];
  return {
    title: set.titles[Math.floor(index / veltokPromptSets.length) % set.titles.length],
    creator: set.creators[index % set.creators.length],
    tags: [...set.tags, index % 3 === 0 ? "brainrot" : "scroll"]
  };
});

const mediaTikTokCatalog = veltokFeedSeed.map((item, index) => {
  const clip = veltokClipPool[index % veltokClipPool.length];
  return {
    ...item,
    src: clip.src,
    thumbnail: clip.thumbnail
  };
});

const mediaTubiCatalog = [
  {
    title: "Sci-Fi Signal",
    genre: "Science Fiction",
    url: "https://tubitv.com/",
    accent: "#d9d9d9",
    tags: ["future", "space", "movie"]
  },
  {
    title: "Shadow Arcade",
    genre: "Action",
    url: "https://tubitv.com/",
    accent: "#9a9a9a",
    tags: ["action", "games", "movie"]
  },
  {
    title: "After Hours",
    genre: "Thriller",
    url: "https://tubitv.com/",
    accent: "#707070",
    tags: ["night", "thriller", "drama"]
  },
  {
    title: "Retro Channel",
    genre: "Comedy",
    url: "https://tubitv.com/",
    accent: "#cfcfcf",
    tags: ["classic", "funny", "show"]
  }
];

const mediaPlutoCatalog = [
  {
    title: "Pluto Action",
    category: "Live Channel",
    url: "https://pluto.tv/",
    accent: "#e7e7e7",
    tags: ["live", "action", "channel"]
  },
  {
    title: "Movie Favorites",
    category: "Movies",
    url: "https://pluto.tv/",
    accent: "#b8b8b8",
    tags: ["movies", "free", "featured"]
  },
  {
    title: "Classic TV",
    category: "Live TV",
    url: "https://pluto.tv/",
    accent: "#8e8e8e",
    tags: ["series", "tv", "live"]
  },
  {
    title: "News Now",
    category: "News",
    url: "https://pluto.tv/",
    accent: "#f4f4f4",
    tags: ["news", "live", "updates"]
  }
];

const drawers = {
  launcher: document.getElementById("launcherDrawer"),
  ai: document.getElementById("aiDrawer"),
  media: document.getElementById("mediaDrawer"),
  youtube: document.getElementById("youtubeDrawer"),
  velhub: document.getElementById("velHubDrawer"),
  web: document.getElementById("webDrawer"),
  music: document.getElementById("musicDrawer"),
  game: document.getElementById("gameDrawer"),
  network: document.getElementById("networkDrawer"),
  lobbies: document.getElementById("lobbiesDrawer"),
  soundboard: document.getElementById("soundboardDrawer"),
  dev: document.getElementById("devDrawer"),
  calculator: document.getElementById("calculatorDrawer"),
  settings: document.getElementById("settingsDrawer")
};

const clockDay = document.getElementById("clockDay");
const clockTime = document.getElementById("clockTime");
const clockDate = document.getElementById("clockDate");
const heroClock = document.querySelector(".hero-clock");
const bootScreen = document.getElementById("bootScreen");
const welcomeGate = document.getElementById("welcomeGate");
const welcomeGateTitle = document.getElementById("welcomeGateTitle");
const welcomeNameForm = document.getElementById("welcomeNameForm");
const welcomeNameInput = document.getElementById("welcomeNameInput");
const welcomePinForm = document.getElementById("welcomePinForm");
const welcomePinInput = document.getElementById("welcomePinInput");
const welcomeStatus = document.getElementById("welcomeStatus");
const desktopShortcuts = document.getElementById("desktopShortcuts");
const launcherGameSearch = document.getElementById("launcherGameSearch");
const launcherOfflineToggle = document.getElementById("launcherOfflineToggle");
const appStoreTabs = document.getElementById("appStoreTabs");
const appStoreButtons = [...document.querySelectorAll("[data-store-category]")];
const gameSourceTabs = document.getElementById("gameSourceTabs");
const gameSourceButtons = [...document.querySelectorAll("[data-game-source]")];
const launcherGameGrid = document.getElementById("launcherGameGrid");
const launcherSectionLabel = document.getElementById("launcherSectionLabel");
const launcherSectionNote = document.getElementById("launcherSectionNote");
const catalogCount = document.getElementById("catalogCount");
const recentAppsTray = document.getElementById("recentAppsTray");
const taskbarTime = document.getElementById("taskbarTime");
const taskbarDate = document.getElementById("taskbarDate");
const nowPlayingChip = document.getElementById("nowPlayingChip");
const nowPlayingText = document.getElementById("nowPlayingText");
const taskbarNowPlaying = document.getElementById("taskbarNowPlaying");
const taskbarNowPlayingText = document.getElementById("taskbarNowPlayingText");
const taskbarPrevButton = document.getElementById("taskbarPrevButton");
const taskbarPlayButton = document.getElementById("taskbarPlayButton");
const taskbarNextButton = document.getElementById("taskbarNextButton");
const lyricsWidget = document.getElementById("lyricsWidget");
const lyricsWidgetHead = document.getElementById("lyricsWidgetHead");
const lyricsImportButton = document.getElementById("lyricsImportButton");
const lyricsImportInput = document.getElementById("lyricsImportInput");
const lyricsCollapseButton = document.getElementById("lyricsCollapseButton");
const lyricsHideButton = document.getElementById("lyricsHideButton");
const lyricsShowButton = document.getElementById("lyricsShowButton");
const lyricsTrackTitle = document.getElementById("lyricsTrackTitle");
const lyricsTrackArtist = document.getElementById("lyricsTrackArtist");
const lyricsWidgetNote = document.getElementById("lyricsWidgetNote");
const lyricsSyncEarlierButton = document.getElementById("lyricsSyncEarlierButton");
const lyricsSyncResetButton = document.getElementById("lyricsSyncResetButton");
const lyricsSyncLaterButton = document.getElementById("lyricsSyncLaterButton");
const lyricsSyncReadout = document.getElementById("lyricsSyncReadout");
const lyricsContent = document.getElementById("lyricsContent");

const openLauncherButton = document.getElementById("openLauncherButton");
const openLocalGamesButton = document.getElementById("openLocalGamesButton");
const openMediaButton = document.getElementById("openMediaButton");
const openMusicButton = document.getElementById("openMusicButton");
const openSettingsButton = document.getElementById("openSettingsButton");
const openNetworkButton = document.getElementById("openNetworkButton");
const startButton = document.getElementById("startButton");
const closePanelButtons = [...document.querySelectorAll("[data-close-panel]")];
const panelOpenButtons = [...document.querySelectorAll("[data-open-panel]")];
const gameLaunchButtons = [...document.querySelectorAll("[data-launch-game]")];
const webButtons = [...document.querySelectorAll("[data-open-web]")];
const switchButtons = [...document.querySelectorAll("[data-game-switch]")];
const taskbarButtons = [
  startButton,
  openLauncherButton,
  openLocalGamesButton,
  openMediaButton,
  openMusicButton,
  openSettingsButton,
  openNetworkButton,
  ...[...document.querySelectorAll(".taskbar-app[data-open-web]")]
].filter(Boolean);

const webTag = document.getElementById("webTag");
const webTitle = document.getElementById("webTitle");
const webDescription = document.getElementById("webDescription");
const webUrlForm = document.getElementById("webUrlForm");
const webUrlInput = document.getElementById("webUrlInput");
const webNote = document.getElementById("webNote");
const webWarning = document.getElementById("webWarning");
const webWarningText = document.getElementById("webWarningText");
const webFrame = document.getElementById("webFrame");
const webFrameHelper = document.getElementById("webFrameHelper");
const webHelperMirrorButton = document.getElementById("webHelperMirrorButton");
const webHelperLocalButton = document.getElementById("webHelperLocalButton");
const webReloadButton = document.getElementById("webReloadButton");
const webMirrorButton = document.getElementById("webMirrorButton");
const aiMessagesEl = document.getElementById("aiMessages");
const aiChatForm = document.getElementById("aiChatForm");
const aiInput = document.getElementById("aiInput");
const aiStatus = document.getElementById("aiStatus");
const aiClearButton = document.getElementById("aiClearButton");
const aiPromptButtons = [...document.querySelectorAll("[data-ai-prompt]")];
const youtubeDrawer = document.getElementById("youtubeDrawer");
const youtubePanel = youtubeDrawer?.querySelector(".youtube-panel");
const youtubeLaunch = document.getElementById("youtubeLaunch");
const youtubeAddressForm = document.getElementById("youtubeAddressForm");
const youtubeAddressInput = document.getElementById("youtubeAddressInput");
const youtubeSearchForm = document.getElementById("youtubeSearchForm");
const youtubeSearchInput = document.getElementById("youtubeSearchInput");
const youtubeResultsGrid = document.getElementById("youtubeResultsGrid");
const youtubeResultsTitle = document.getElementById("youtubeResultsTitle");
const youtubeStatus = document.getElementById("youtubeStatus");
const youtubeLoadMore = document.getElementById("youtubeLoadMore");
const youtubeSaveAllButton = document.getElementById("youtubeSaveAllButton");
const youtubeClearHistoryButton = document.getElementById("youtubeClearHistoryButton");
const youtubeGlobalForm = document.getElementById("youtubeGlobalForm");
const youtubeGlobalMode = document.getElementById("youtubeGlobalMode");
const youtubeGlobalModeButtons = [...document.querySelectorAll("[data-youtube-global-type]")];
const youtubeGlobalInput = document.getElementById("youtubeGlobalInput");
const youtubeGlobalStatus = document.getElementById("youtubeGlobalStatus");
const youtubeFrameWrap = document.getElementById("youtubeFrameWrap");
const youtubePlayerChannel = document.getElementById("youtubePlayerChannel");
const youtubePlayerTitle = document.getElementById("youtubePlayerTitle");
const youtubePlayerDescription = document.getElementById("youtubePlayerDescription");
const youtubeUserChip = document.getElementById("youtubeUserChip");
const youtubeOpenTabButton = document.getElementById("youtubeOpenTabButton");
const youtubeFullscreenButton = document.getElementById("youtubeFullscreenButton");
const youtubeToggleResultsButton = document.getElementById("youtubeToggleResultsButton");
const velHubDrawer = document.getElementById("velHubDrawer");
const velHubLaunch = document.getElementById("velHubLaunch");
const velHubWindowButton = document.getElementById("velHubWindowButton");
const velHubRefreshButton = document.getElementById("velHubRefreshButton");
const velHubHeroCount = document.getElementById("velHubHeroCount");
const velHubModernGrid = document.getElementById("velHubModernGrid");
const velHubPlayer = document.getElementById("velHubPlayer");
const velHubFrameWrap = document.getElementById("velHubFrameWrap");
const velHubPlayerSource = document.getElementById("velHubPlayerSource");
const velHubPlayerTitle = document.getElementById("velHubPlayerTitle");
const velHubPlayerDescription = document.getElementById("velHubPlayerDescription");
const velHubFullscreenButton = document.getElementById("velHubFullscreenButton");
const velHubOpenTabButton = document.getElementById("velHubOpenTabButton");
const velHubClosePlayerButton = document.getElementById("velHubClosePlayerButton");
const velHubSearchForm = document.getElementById("velHubSearchForm");
const velHubSearchInput = document.getElementById("velHubSearchInput");
const velHubStatus = document.getElementById("velHubStatus");
const velHubCategoryRow = document.getElementById("velHubCategoryRow");
const velHubCategoryButtons = [...document.querySelectorAll("[data-velhub-category]")];
const velHubGrid = document.getElementById("velHubGrid");
const velHubLoadMoreButton = document.getElementById("velHubLoadMoreButton");
const mediaTools = document.getElementById("mediaTools");
const mediaEmbedForm = document.getElementById("mediaEmbedForm");
const mediaEmbedInput = document.getElementById("mediaEmbedInput");

const mediaSearchForm = document.getElementById("mediaSearchForm");
const mediaSearchInput = document.getElementById("mediaSearchInput");
const mediaProviderButtons = [...document.querySelectorAll("[data-media-provider]")];
const mediaGrid = document.getElementById("mediaGrid");
const mediaLoading = document.getElementById("mediaLoading");
const mediaLoadMore = document.getElementById("mediaLoadMore");
const mediaPlayer = document.getElementById("mediaPlayer");
const mediaPlayerProvider = document.getElementById("mediaPlayerProvider");
const mediaPlayerTitle = document.getElementById("mediaPlayerTitle");
const mediaPlayerMeta = document.getElementById("mediaPlayerMeta");
const mediaPlayerFrame = document.getElementById("mediaPlayerFrame");
const mediaPlayerClose = document.getElementById("mediaPlayerClose");
const mediaResultsTitle = document.getElementById("mediaResultsTitle");
const mediaResultsCopy = document.getElementById("mediaResultsCopy");

const gameScreens = [...document.querySelectorAll(".game-screen")];
const activeCategory = document.getElementById("activeCategory");
const activeTitle = document.getElementById("activeTitle");
const activeDescription = document.getElementById("activeDescription");
const activeBest = document.getElementById("activeBest");
const activeControls = document.getElementById("activeControls");

const audioElement = document.getElementById("velofyAudio");
const velofyArtwork = document.getElementById("velofyArtwork");
const velofyTitle = document.getElementById("velofyTitle");
const velofyArtist = document.getElementById("velofyArtist");
const velofyState = document.getElementById("velofyState");
const velofyProgress = document.getElementById("velofyProgress");
const velofyElapsed = document.getElementById("velofyElapsed");
const velofyDuration = document.getElementById("velofyDuration");
const velofyPrev = document.getElementById("velofyPrev");
const velofyPlay = document.getElementById("velofyPlay");
const velofyNext = document.getElementById("velofyNext");
const velofySearch = document.getElementById("velofySearch");
const velofyPlaylistSelect = document.getElementById("velofyPlaylistSelect");
const velofyNewPlaylistButton = document.getElementById("velofyNewPlaylistButton");
const velofyShuffleButton = document.getElementById("velofyShuffleButton");
const velofyPlaylist = document.getElementById("velofyPlaylist");
const velofyPlaylistNote = document.getElementById("velofyPlaylistNote");
const velofyImportButton = document.getElementById("velofyImportButton");
const velofyImportInput = document.getElementById("velofyImportInput");
const velofySpotifyPlayer = document.getElementById("velofySpotifyPlayer");
const velofySpotifySearch = document.getElementById("velofySpotifySearch");
const velofySpotifySearchButton = document.getElementById("velofySpotifySearchButton");
const velofySpotifyResults = document.getElementById("velofySpotifyResults");

const settingsWallpaperButtons = [...document.querySelectorAll("[data-wallpaper-option]")];
const settingsFontButtons = [...document.querySelectorAll("[data-font-option]")];
const settingsDensityButtons = [...document.querySelectorAll("[data-density-option]")];
const settingsZoomButtons = [...document.querySelectorAll("[data-zoom-option]")];
const settingsTaskbarButtons = [...document.querySelectorAll("[data-taskbar-position]")];
const themePackButtons = [...document.querySelectorAll("[data-theme-pack]")];
const themeCreditBalance = document.getElementById("themeCreditBalance");
const customThemeName = document.getElementById("customThemeName");
const customThemePick = document.getElementById("customThemePick");
const customThemeCreate = document.getElementById("customThemeCreate");
const customThemeApply = document.getElementById("customThemeApply");
const customThemeInput = document.getElementById("customThemeInput");
const customThemeStatus = document.getElementById("customThemeStatus");
const homeEditButton = document.getElementById("homeEditButton");
const homeEditToolbar = document.getElementById("homeEditToolbar");
const homeEditDone = document.getElementById("homeEditDone");
const homeEditReset = document.getElementById("homeEditReset");
const homeTaskbarButtons = [...document.querySelectorAll("[data-home-taskbar]")];
const resetWindowsButton = document.querySelector("[data-reset-windows]");
const desktopNetworkStatus = document.getElementById("desktopNetworkStatus");
const networkVpnButton = document.getElementById("networkVpnButton");
const proxyNoteInput = document.getElementById("proxyNoteInput");
const proxyNoteSave = document.getElementById("proxyNoteSave");
const proxyNoteReadout = document.getElementById("proxyNoteReadout");
const velChat = document.getElementById("velChat");
const velChatToggle = document.getElementById("velChatToggle");
const velChatPanel = document.getElementById("velChatPanel");
const velChatHide = document.getElementById("velChatHide");
const velChatClearLog = document.getElementById("velChatClearLog");
const velChatPinForm = document.getElementById("velChatPinForm");
const velChatPinInput = document.getElementById("velChatPinInput");
const velChatLoginForm = document.getElementById("velChatLoginForm");
const velChatName = document.getElementById("velChatName");
const velChatUserBar = document.getElementById("velChatUserBar");
const velChatUserName = document.getElementById("velChatUserName");
const velChatLogout = document.getElementById("velChatLogout");
const velChatUserPill = document.getElementById("velChatUserPill");
const velChatLoginNeeded = document.getElementById("velChatLoginNeeded");
const chatSettingsCard = document.getElementById("chatSettingsCard");
const velChatMessages = document.getElementById("velChatMessages");
const velChatTyping = document.getElementById("velChatTyping");
const velChatForm = document.getElementById("velChatForm");
const velChatInput = document.getElementById("velChatInput");
const velChatAttachButton = document.getElementById("velChatAttachButton");
const velChatAttachmentInput = document.getElementById("velChatAttachmentInput");
const velChatAttachmentName = document.getElementById("velChatAttachmentName");
const velChatStatus = document.getElementById("velChatStatus");
const velChatUnread = document.getElementById("velChatUnread");
const calculatorForm = document.getElementById("calculatorForm");
const calculatorExpression = document.getElementById("calculatorExpression");
const calculatorResult = document.getElementById("calculatorResult");
const calculatorKeys = document.getElementById("calculatorKeys");
const secretVault = document.getElementById("secretVault");
const secretVaultGrid = document.getElementById("secretVaultGrid");
const secretVaultRefresh = document.getElementById("secretVaultRefresh");
const lobbyModeTabs = document.getElementById("lobbyModeTabs");
const lobbyPills = document.getElementById("lobbyPills");
const lobbyJoinForm = document.getElementById("lobbyJoinForm");
const lobbyNameInput = document.getElementById("lobbyNameInput");
const lobbyStatus = document.getElementById("lobbyStatus");
const lobbyNotesView = document.getElementById("lobbyNotesView");
const lobbySketchView = document.getElementById("lobbySketchView");
const lobbyNoteTitle = document.getElementById("lobbyNoteTitle");
const lobbyNoteText = document.getElementById("lobbyNoteText");
const lobbyNoteSave = document.getElementById("lobbyNoteSave");
const lobbyNoteClear = document.getElementById("lobbyNoteClear");
const lobbyNoteMeta = document.getElementById("lobbyNoteMeta");
const lobbyRefreshButton = document.getElementById("lobbyRefreshButton");
const lobbySketchTitle = document.getElementById("lobbySketchTitle");
const lobbyInviteToggle = document.getElementById("lobbyInviteToggle");
const lobbyInvitePanel = document.getElementById("lobbyInvitePanel");
const lobbyUserList = document.getElementById("lobbyUserList");
const lobbyInviteInbox = document.getElementById("lobbyInviteInbox");
const lobbyCollaborators = document.getElementById("lobbyCollaborators");
const lobbyPromptForm = document.getElementById("lobbyPromptForm");
const lobbyPromptInput = document.getElementById("lobbyPromptInput");
const lobbySketchCanvas = document.getElementById("lobbySketchCanvas");
const lobbyBrushColor = document.getElementById("lobbyBrushColor");
const lobbyBrushSize = document.getElementById("lobbyBrushSize");
const lobbyCanvasClear = document.getElementById("lobbyCanvasClear");
const lobbySketchSubmitForm = document.getElementById("lobbySketchSubmitForm");
const lobbySketchCaption = document.getElementById("lobbySketchCaption");
const lobbySketchGallery = document.getElementById("lobbySketchGallery");
const lobbySketchClear = document.getElementById("lobbySketchClear");
const soundboardGrid = document.getElementById("soundboardGrid");
const soundboardVolume = document.getElementById("soundboardVolume");
const soundboardStop = document.getElementById("soundboardStop");
const soundboardImport = document.getElementById("soundboardImport");
const soundboardFileInput = document.getElementById("soundboardFileInput");
const soundboardStatus = document.getElementById("soundboardStatus");
const devAuthCard = document.getElementById("devAuthCard");
const devAuthForm = document.getElementById("devAuthForm");
const devCodeInput = document.getElementById("devCodeInput");
const devDeviceReadout = document.getElementById("devDeviceReadout");
const devCopyDeviceButton = document.getElementById("devCopyDeviceButton");
const devDashboard = document.getElementById("devDashboard");
const devOnlineList = document.getElementById("devOnlineList");
const devBanList = document.getElementById("devBanList");
const devStatus = document.getElementById("devStatus");
const devRefreshButton = document.getElementById("devRefreshButton");
const devLockButton = document.getElementById("devLockButton");
const ownerLockOverlay = document.getElementById("ownerLockOverlay");
const ownerLockTitle = document.getElementById("ownerLockTitle");
const ownerLockMessage = document.getElementById("ownerLockMessage");
const ownerLockDismiss = document.getElementById("ownerLockDismiss");
const screenShareRequest = document.getElementById("screenShareRequest");
const screenShareAccept = document.getElementById("screenShareAccept");
const screenShareDismiss = document.getElementById("screenShareDismiss");
const screenViewer = document.getElementById("screenViewer");
const screenViewerTitle = document.getElementById("screenViewerTitle");
const screenViewerStatus = document.getElementById("screenViewerStatus");
const screenViewerVideo = document.getElementById("screenViewerVideo");
const screenViewerClose = document.getElementById("screenViewerClose");

let activeLocalGame = "snake";
let activeWeb = "rocketgoal";
let activePanel = "";
let currentTrackIndex = 0;
let currentWallpaperKey = storage.get("vel-wallpaper", "vel");
let currentFontKey = storage.get("vel-font", "system");
let currentDensityKey = storage.get("vel-density", "roomy");
let currentZoomKey = storage.get("vel-zoom", "normal");
let currentThemePackKey = storage.get("vel-theme-pack", "noir");
let currentTaskbarPosition = storage.get("vel-taskbar-position", "bottom");
let currentWebUrl = "https://rocketgoal.io/";
let currentWebMirrorIndex = 0;
let feedVideoObserver = null;
let youtubePlayer = null;
let youtubeApiReadyPromise = null;
let youtubeAppPlayerHintTimer = null;
let youtubeLaunchTimer = null;
let mediaSearchDebounceTimer = null;
let launcherGameQuery = "";
let launcherStoreCategory = storage.get("vel-launcher-store-category", "games");
if (!["games", "local", "tools", "music", "movies", "youtube"].includes(launcherStoreCategory)) {
  launcherStoreCategory = "games";
}
let launcherOfflineOnly = storage.get("vel-launcher-offline-only", isLikelyIpad() ? "1" : "0") === "1";
let launcherGameSource = storage.get("vel-launcher-game-source", "all");
if (!gameSourceLabels[launcherGameSource]) {
  launcherGameSource = "all";
}
let networkNote = storage.get("vel-network-note", "");
const AI_HISTORY_KEY = "vel-ai-history";
const AI_HISTORY_LIMIT = 24;
const VEL_CHAT_USER_KEY = "vel-chat-user";
const VEL_CHAT_COLLAPSED_KEY = "vel-chat-collapsed";
const VEL_CHAT_LAST_SEEN_KEY = "vel-chat-last-seen-id";
const VEL_CHAT_PIN_SESSION_KEY = "vel-chat-pin-ok";
const VEL_CHAT_POLL_MS = 3000;
const VEL_CHAT_TYPING_POLL_MS = 1300;
const VEL_CHAT_TYPING_IDLE_MS = 2600;
const VEL_CHAT_TYPING_THROTTLE_MS = 900;
const VEL_DEVICE_ID_KEY = "vel-device-id";
const VEL_TASKBAR_POSITION_KEY = "vel-taskbar-position";
const VEL_CUSTOM_THEME_KEY = "vel-custom-theme";
const VEL_HOME_CLOCK_POSITION_KEY = "vel-home-clock-position";
const DEV_ACCESS_CHECK_MS = 4000;
const DEV_PRESENCE_POLL_MS = 4000;
let velDeviceId = getOrCreateVelDeviceId();
const VEL_CHAT_ATTACHMENT_LIMIT = 1700000;
const YOUTUBE_HISTORY_KEY = "vel-youtube-watch-history";
const YOUTUBE_FAVORITES_KEY = "vel-youtube-favorites";
const YOUTUBE_INTEREST_KEY = "vel-youtube-interest-topics";
const YOUTUBE_SEARCH_CACHE_KEY = "vel-youtube-search-cache-v1";
const YOUTUBE_API_COOLDOWN_KEY = "vel-youtube-api-cooldown-until";
const YOUTUBE_HISTORY_LIMIT = 80;
const YOUTUBE_FAVORITES_LIMIT = 240;
const YOUTUBE_INTEREST_LIMIT = 28;
const YOUTUBE_HOME_TOPIC_LIMIT = 3;
const YOUTUBE_SEARCH_CACHE_LIMIT = 70;
const YOUTUBE_SEARCH_CACHE_TTL = 1000 * 60 * 60 * 12;
const YOUTUBE_API_COOLDOWN_MS = 1000 * 60 * 60 * 8;
const YOUTUBE_MOVIE_DEFAULT_QUERY = "free full movie official full length";
const YOUTUBE_GENERIC_QUERIES = new Set([
  "popular videos today",
  "music videos",
  "gaming videos",
  "trending music",
  "sports highlights",
  "learning videos",
  "news today",
  YOUTUBE_MOVIE_DEFAULT_QUERY
]);
const YOUTUBE_INTEREST_TERMS = [
  "fortnite",
  "roblox",
  "minecraft",
  "valorant",
  "call of duty",
  "gta",
  "basketball",
  "football",
  "soccer",
  "ufc",
  "anime",
  "music",
  "ken carson",
  "travis scott",
  "kendrick lamar",
  "yeat",
  "sza",
  "the weeknd"
];
const YOUTUBE_TOPIC_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "you",
  "this",
  "that",
  "video",
  "videos",
  "official",
  "highlights",
  "today",
  "full",
  "new",
  "best",
  "live",
  "shorts",
  "clips",
  "watch",
  "youtube"
]);
let youtubeAppState = {
  query: storage.get("vel-youtube-query", "popular videos today"),
  results: [],
  nextPageToken: "",
  currentVideo: null,
  loading: false,
  error: "",
  didInitialLoad: false,
  mode: "home",
  homeTopics: [],
  fullscreen: false,
  videoFullscreen: false,
  resultsHidden: storage.get("vel-youtube-results-hidden", "0") === "1",
  embedHost: storage.get("vel-youtube-embed-host", "privacy"),
  hintDismissed: false
};
let youtubeWatchHistory = readStoredJson(YOUTUBE_HISTORY_KEY, []);
youtubeWatchHistory = Array.isArray(youtubeWatchHistory)
  ? youtubeWatchHistory.filter((item) => item?.id).slice(0, YOUTUBE_HISTORY_LIMIT)
  : [];
let youtubeFavorites = readStoredJson(YOUTUBE_FAVORITES_KEY, []);
youtubeFavorites = Array.isArray(youtubeFavorites)
  ? youtubeFavorites.filter((item) => item?.id).slice(0, YOUTUBE_FAVORITES_LIMIT)
  : [];
let youtubeInterestTopics = readStoredJson(YOUTUBE_INTEREST_KEY, []);
youtubeInterestTopics = Array.isArray(youtubeInterestTopics)
  ? youtubeInterestTopics
    .filter((item) => item?.topic)
    .slice(0, YOUTUBE_INTEREST_LIMIT)
  : [];
let youtubeSearchCache = readStoredJson(YOUTUBE_SEARCH_CACHE_KEY, {});
youtubeSearchCache = youtubeSearchCache && typeof youtubeSearchCache === "object" && !Array.isArray(youtubeSearchCache)
  ? youtubeSearchCache
  : {};
let youtubeGlobalMessage = "";
let youtubeGlobalImportType = "video";
let youtubeGlobalIds = new Set();
let youtubeGlobalSavingIds = new Set();
let aiMessages = readStoredJson(AI_HISTORY_KEY, []);
aiMessages = Array.isArray(aiMessages)
  ? aiMessages
    .filter((item) => ["user", "assistant"].includes(item?.role) && item.content)
    .slice(-AI_HISTORY_LIMIT)
  : [];
let aiLoading = false;
let velChatUser = readStoredJson(VEL_CHAT_USER_KEY, null);
let velChatItems = [];
let velChatTypingUsers = [];
let velChatRenderSignature = "";
let velChatLoading = false;
let velChatPollTimer = null;
let velChatTypingPollTimer = null;
let velChatTypingStopTimer = null;
let velChatLastTypingSentAt = 0;
let velChatIsTyping = false;
let velChatCollapsed = storage.get(VEL_CHAT_COLLAPSED_KEY, "1") === "1";
let velChatLastSeenId = storage.get(VEL_CHAT_LAST_SEEN_KEY, "");
let velChatUnlocked = false;
let velChatPin = "";
let velChatAttachment = null;
const storedDevLockedApps = readStoredJson("vel-dev-locked-apps", []);
let devLockedApps = new Set(Array.isArray(storedDevLockedApps) ? storedDevLockedApps : []);
let lastDevScreenRequestAt = Number.parseInt(storage.get("vel-dev-screen-request-at", "0"), 10) || 0;
let customThemeDraft = null;
let homeEditMode = false;
let welcomeTypeTimer = null;
let welcomeGateStep = "name";
let secretVaultUnlocked = false;
let secretVaultLoading = false;
let secretVaultVideos = [];
const LOBBY_POLL_MS = 2500;
let lobbyPollTimer = null;
let devAdminCode = "";
let devPollTimer = null;
let devPresenceTimer = null;
let devAccessTimer = null;
let devLoading = false;
let ownerLockMode = "";
let pendingScreenShare = null;
let activeScreenShareStream = null;
let screenSharePeer = null;
let screenSharePollTimer = null;
let screenShareLastSignalId = 0;
let screenShareRemoteReady = false;
let screenShareQueuedIce = [];
let soundboardAudioContext = null;
let soundboardActiveNodes = [];
let soundboardActiveMedia = [];
let soundboardRealSounds = [];
let soundboardImportedSounds = [];
let soundboardLoading = false;
let soundboardLoaded = false;
let lobbyState = {
  mode: storage.get("vel-lobby-mode", "notes") === "sketch" ? "sketch" : "notes",
  lobby: storage.get("vel-lobby-name", "Main"),
  lobbyData: null,
  lobbies: [],
  users: [],
  invites: [],
  inviteOpen: false,
  loading: false,
  drawing: false,
  lastPoint: null,
  currentStroke: null,
  canvasSignature: ""
};
let velofySearchQuery = "";
let velofyPlaylistMode = storage.get("velofy-playlist-mode", "all");
let velofyShuffleEnabled = storage.get("velofy-shuffle", "0") === "1";
let velofyCustomPlaylists = readStoredJson("velofy-custom-playlists", []);
velofyCustomPlaylists = Array.isArray(velofyCustomPlaylists) ? velofyCustomPlaylists : [];
let velofyRecentTrackRefs = readStoredJson("velofy-recent-tracks", []);
velofyRecentTrackRefs = Array.isArray(velofyRecentTrackRefs) ? velofyRecentTrackRefs : [];
let velofySpotifySearchQuery = storage.get("velofy-spotify-query", "Ken Carson");
let velofySpotifySearchResults = [];
let velofySpotifyLoading = false;
let velofySpotifyError = "";
let savedSpotifyTracks = readStoredJson("velofy-spotify-tracks", []);
let currentVelofyMode = "local";
let currentSpotifyTrackId = "";
let currentSpotifyTrack = null;
let velCredits = Number.parseInt(storage.get("vel-theme-credits", "80"), 10) || 80;
let unlockedThemePacks = readStoredJson("vel-theme-unlocks", ["noir"]);
unlockedThemePacks = Array.isArray(unlockedThemePacks) ? [...new Set(["noir", ...unlockedThemePacks])] : ["noir"];
let installedApps = readStoredJson("vel-installed-apps", [
  "panel:youtube",
  "panel:velhub",
  "panel:lobbies",
  "panel:soundboard",
  "panel:dev",
  "panel:music",
  "panel:calculator",
  "panel:settings"
]);
installedApps = Array.isArray(installedApps)
  ? [...new Set(installedApps.filter((item) => typeof item === "string"))]
  : ["panel:youtube", "panel:velhub", "panel:lobbies", "panel:soundboard", "panel:dev", "panel:music", "panel:calculator", "panel:settings"];
installedApps = installedApps.filter((item) => item !== "panel:ai");
storage.set("vel-installed-apps", JSON.stringify(installedApps.slice(0, 40)));
if (storage.get("vel-installed-apps-v2", "0") !== "1" && !installedApps.includes("panel:velhub")) {
  installedApps = ["panel:velhub", ...installedApps].slice(0, 40);
  storage.set("vel-installed-apps", JSON.stringify(installedApps.slice(0, 40)));
  storage.set("vel-installed-apps-v2", "1");
}
if (storage.get("vel-installed-apps-v3", "0") !== "1" && !installedApps.includes("panel:calculator")) {
  installedApps = ["panel:calculator", ...installedApps].slice(0, 40);
  storage.set("vel-installed-apps", JSON.stringify(installedApps.slice(0, 40)));
  storage.set("vel-installed-apps-v3", "1");
}
if (storage.get("vel-installed-apps-v4", "0") !== "1" && !installedApps.includes("panel:lobbies")) {
  installedApps = ["panel:lobbies", ...installedApps].slice(0, 40);
  storage.set("vel-installed-apps", JSON.stringify(installedApps.slice(0, 40)));
  storage.set("vel-installed-apps-v4", "1");
}
if (storage.get("vel-installed-apps-v5", "0") !== "1" && !installedApps.includes("panel:soundboard")) {
  installedApps = ["panel:soundboard", ...installedApps].slice(0, 40);
  storage.set("vel-installed-apps", JSON.stringify(installedApps.slice(0, 40)));
  storage.set("vel-installed-apps-v5", "1");
}
if (storage.get("vel-installed-apps-v6", "0") !== "1" && !installedApps.includes("panel:dev")) {
  installedApps = ["panel:dev", ...installedApps].slice(0, 40);
  storage.set("vel-installed-apps", JSON.stringify(installedApps.slice(0, 40)));
  storage.set("vel-installed-apps-v6", "1");
}
let recentApps = readStoredJson("vel-recent-apps", []);
recentApps = Array.isArray(recentApps) ? recentApps.filter((item) => !(item?.type === "panel" && item?.id === "ai")) : [];
storage.set("vel-recent-apps", JSON.stringify(recentApps.slice(0, 7)));
let windowPositions = readStoredJson("vel-window-positions", {});
let lyricsLibrary = readStoredJson("vel-lyrics-library", {});
let lyricsSyncOffsets = readStoredJson("vel-lyrics-sync-offsets", {});
let lyricsWidgetCollapsed = storage.get("vel-lyrics-collapsed", "0") === "1";
let lyricsWidgetHidden = storage.get("vel-lyrics-hidden", "1") === "1";
let bundledLyricsLibrary = {};
let currentLyricsState = {
  key: "",
  lines: [],
  mode: "empty",
  source: "none",
  activeIndex: -1,
  syncOffset: 0
};
let mediaState = {
  provider: storage.get("vel-media-tab", "all"),
  query: storage.get("vel-media-last-query", ""),
  youtubeResults: [],
  youtubeNextPageToken: "",
  youtubeError: "",
  spotifyResults: { tracks: [], artists: [], albums: [], playlists: [] },
  spotifyType: storage.get("vel-spotify-type", "track"),
  spotifyError: "",
  tiktokProfile: null,
  tiktokVideos: [],
  tiktokError: "",
  tiktokAuthRequired: true,
  loading: false
};

const VEL_HUB_PAGE_SIZE = 84;
const VEL_HUB_CATEGORY_QUERIES = {
  popular: "",
  action: "subject:(action)",
  comedy: "subject:(comedy)",
  scifi: "(subject:(science fiction) OR subject:(sci-fi) OR title:(science fiction))",
  horror: "subject:(horror)",
  animation: "(subject:(animation) OR subject:(cartoons) OR subject:(animated))",
  documentary: "(subject:(documentary) OR subject:(educational))",
  family: "(subject:(family) OR subject:(children) OR subject:(kids))"
};
const VEL_HUB_BLOCKED_TERMS = [
  "sex",
  "nudity",
  "nude",
  "erotic",
  "adult",
  "stag",
  "exploitation",
  "burlesque"
];
const velHubModernPicks = [
  { title: "Hoppers", year: "2026", vibe: "Pixar adventure", accent: "#d9f5ff" },
  { title: "The LEGO Batman Movie", year: "2017", vibe: "LEGO superhero comedy", accent: "#ffe36b" },
  { title: "The Bad Guys", year: "2022", vibe: "Animated heist comedy", accent: "#f4f4f4" },
  { title: "The Bad Guys 2", year: "2025", vibe: "Animated crew sequel", accent: "#d7d7d7" },
  { title: "The Grinch", year: "2018", vibe: "Holiday animation", accent: "#e8f5df" },
  { title: "How the Grinch Stole Christmas", year: "2000", vibe: "Holiday comedy", accent: "#cfe8c8" },
  { title: "The Super Mario Bros. Movie", year: "2023", vibe: "Game-world adventure", accent: "#f7d7d7" },
  { title: "A Minecraft Movie", year: "2025", vibe: "Blocky adventure comedy", accent: "#bff5b8" },
  { title: "Spider-Man: Across the Spider-Verse", year: "2023", vibe: "Animated superhero", accent: "#d9d3ff" },
  { title: "Sonic the Hedgehog 3", year: "2024", vibe: "Fast action comedy", accent: "#d3e5ff" },
  { title: "Inside Out 2", year: "2024", vibe: "Animated comedy", accent: "#ffe1f0" },
  { title: "Despicable Me 4", year: "2024", vibe: "Minion chaos", accent: "#fff2c2" },
  { title: "Five Nights at Freddy's", year: "2023", vibe: "Game horror", accent: "#d9c4a3" },
  { title: "Kung Fu Panda 4", year: "2024", vibe: "Animated action comedy", accent: "#ffd6a8" },
  { title: "Puss in Boots: The Last Wish", year: "2022", vibe: "Fantasy adventure", accent: "#ffe0b0" },
  { title: "Minions: The Rise of Gru", year: "2022", vibe: "Minion origin chaos", accent: "#fff38a" },
  { title: "Elemental", year: "2023", vibe: "Pixar romance adventure", accent: "#ffb6a9" },
  { title: "Turning Red", year: "2022", vibe: "Pixar coming-of-age", accent: "#ffc3d9" },
  { title: "Luca", year: "2021", vibe: "Summer sea adventure", accent: "#bdefff" },
  { title: "Coco", year: "2017", vibe: "Music family adventure", accent: "#ffd0f0" },
  { title: "Zootopia", year: "2016", vibe: "Animated mystery comedy", accent: "#d5e7ff" },
  { title: "Moana", year: "2016", vibe: "Ocean adventure", accent: "#bdefff" },
  { title: "Moana 2", year: "2024", vibe: "Ocean sequel adventure", accent: "#c5f7ff" },
  { title: "Toy Story 4", year: "2019", vibe: "Toy adventure", accent: "#cbd8ff" },
  { title: "Frozen II", year: "2019", vibe: "Disney fantasy musical", accent: "#d9efff" },
  { title: "Lilo & Stitch", year: "2025", vibe: "Alien family comedy", accent: "#c7dbff" },
  { title: "How to Train Your Dragon", year: "2025", vibe: "Dragon fantasy adventure", accent: "#c8f1ff" },
  { title: "Wonka", year: "2023", vibe: "Chocolate musical fantasy", accent: "#e9c9ff" },
  { title: "Barbie", year: "2023", vibe: "Pink comedy adventure", accent: "#ffd1ea" },
  { title: "Migration", year: "2023", vibe: "Family bird adventure", accent: "#d7edff" },
  { title: "Trolls Band Together", year: "2023", vibe: "Music comedy", accent: "#ffc9fa" },
  { title: "Teenage Mutant Ninja Turtles: Mutant Mayhem", year: "2023", vibe: "Animated action comedy", accent: "#ccffc2" },
  { title: "PAW Patrol: The Mighty Movie", year: "2023", vibe: "Family superhero rescue", accent: "#d3e5ff" }
];
let velHubState = {
  category: storage.get("velhub-category", "popular"),
  query: storage.get("velhub-query", ""),
  page: 1,
  movies: [],
  total: 0,
  loading: false,
  error: "",
  currentMovie: null,
  launchTimer: null,
  cinema: storage.get("velhub-cinema", "1") !== "0"
};
if (!VEL_HUB_CATEGORY_QUERIES[velHubState.category]) {
  velHubState.category = "popular";
}

function setDrawerState(name, isOpen) {
  const drawer = drawers[name];
  if (!drawer) return;
  drawer.setAttribute("aria-hidden", String(!isOpen));
}

function isDrawerOpen(name) {
  return drawers[name]?.getAttribute("aria-hidden") === "false";
}

function saveRecentApps() {
  storage.set("vel-recent-apps", JSON.stringify(recentApps.slice(0, 7)));
}

function getRecentAppMeta(entry) {
  if (entry.type === "web" && webApps[entry.id]) {
    const app = webApps[entry.id];
    return {
      title: app.title,
      label: app.title,
      badgeSrc: app.badgeSrc || "",
      badgeText: app.badgeText || app.title.slice(0, 2).toUpperCase()
    };
  }

  if (entry.type === "game" && localGameMeta[entry.id]) {
    return {
      title: localGameMeta[entry.id].title,
      label: localGameMeta[entry.id].title,
      badgeText: localGameMeta[entry.id].title.slice(0, 2).toUpperCase(),
      badgeSrc: createGameBadgeSrc(localGameMeta[entry.id].title, localGameMeta[entry.id].category)
    };
  }

  if (entry.type === "panel" && utilityApps[entry.id]) {
    return utilityApps[entry.id];
  }

  return null;
}

function renderBadge(meta, className = "taskbar-icon") {
  if (meta?.badgeSrc) {
    return `<img class="${className}" src="${escapeHtml(meta.badgeSrc)}" alt="${escapeHtml(meta.title || meta.label || "App")}" />`;
  }

  return `<span class="${className} taskbar-icon-text">${escapeHtml(meta?.badgeText || "AP")}</span>`;
}

function saveInstalledApps() {
  storage.set("vel-installed-apps", JSON.stringify(installedApps.slice(0, 40)));
}

const DESKTOP_SHORTCUT_ORDER_KEY = "vel-desktop-shortcut-order";
const DESKTOP_SHORTCUT_POSITIONS_KEY = "vel-desktop-shortcut-positions";

function getDesktopShortcutPositions() {
  const positions = readStoredJson(DESKTOP_SHORTCUT_POSITIONS_KEY, {});
  return positions && typeof positions === "object" && !Array.isArray(positions) ? positions : {};
}

function saveDesktopShortcutPositions(positions = {}) {
  storage.set(DESKTOP_SHORTCUT_POSITIONS_KEY, JSON.stringify(positions));
}

function applyDesktopShortcutPositions() {
  if (!desktopShortcuts) return;
  const positions = getDesktopShortcutPositions();
  desktopShortcuts.querySelectorAll("button[data-desktop-shortcut]").forEach((button) => {
    const ref = button.dataset.desktopShortcut || "";
    const position = positions[ref] || { x: 0, y: 0 };
    button.style.setProperty("--shortcut-x", `${Number(position.x) || 0}px`);
    button.style.setProperty("--shortcut-y", `${Number(position.y) || 0}px`);
  });
}

function getDefaultDesktopShortcutRefs() {
  return [...new Set(["panel:launcher", ...installedApps])].filter((ref) => getAppMetaFromRef(ref));
}

function getDesktopShortcutOrder() {
  const savedOrder = readStoredJson(DESKTOP_SHORTCUT_ORDER_KEY, []);
  const defaults = getDefaultDesktopShortcutRefs();
  const ordered = Array.isArray(savedOrder)
    ? savedOrder.filter((ref) => defaults.includes(ref))
    : [];
  return [...ordered, ...defaults.filter((ref) => !ordered.includes(ref))].slice(0, 12);
}

function saveDesktopShortcutOrder(order = []) {
  const defaults = getDefaultDesktopShortcutRefs();
  const nextOrder = [...new Set(order)]
    .filter((ref) => defaults.includes(ref))
    .slice(0, 40);
  storage.set(DESKTOP_SHORTCUT_ORDER_KEY, JSON.stringify(nextOrder));
}

function syncInstalledAppsFromDesktopOrder(order = []) {
  const desktopInstalledRefs = order.filter((ref) => ref !== "panel:launcher" && installedApps.includes(ref));
  installedApps = [
    ...desktopInstalledRefs,
    ...installedApps.filter((ref) => !desktopInstalledRefs.includes(ref))
  ].slice(0, 40);
  saveInstalledApps();
}

function getAppMetaFromRef(ref) {
  const [type, id] = String(ref || "").split(":");
  if (type === "panel" && id === "launcher") {
    return {
      title: "App Store",
      label: "Store",
      badgeText: "AS",
      action: "panel",
      panel: "launcher"
    };
  }

  if (type === "panel" && utilityApps[id]) return utilityApps[id];

  if (type === "web") {
    const app = id === "browser" ? utilityApps.browser : webApps[id];
    if (!app) return null;
    return {
      title: app.title,
      label: app.label || app.title,
      badgeSrc: app.badgeSrc || "",
      badgeText: app.badgeText || app.title.slice(0, 2).toUpperCase()
    };
  }

  if (type === "game" && localGameMeta[id]) {
    const game = localGameMeta[id];
    return {
      title: game.title,
      label: game.title,
      badgeSrc: createGameBadgeSrc(game.title, game.category),
      badgeText: game.title.slice(0, 2).toUpperCase()
    };
  }

  return null;
}

function openAppRef(ref) {
  const [type, id] = String(ref || "").split(":");
  if (type === "panel") {
    if (id === "youtube") {
      openYouTubeApp();
      return;
    }
    if (id === "velhub") {
      openVelHubApp();
      return;
    }
    openPanel(id);
    return;
  }
  if (type === "web") openWebApp(id);
  if (type === "game") openGame(id);
}

function isAppInstalled(ref) {
  return installedApps.includes(ref);
}

function installApp(ref) {
  if (!getAppMetaFromRef(ref)) return;
  if (!isAppInstalled(ref)) {
    installedApps = [...installedApps, ref].slice(0, 40);
    saveInstalledApps();
    awardVelCredits(6);
  }
  renderDesktopShortcuts();
  renderLauncherCatalog();
}

function removeInstalledApp(ref) {
  installedApps = installedApps.filter((item) => item !== ref);
  saveInstalledApps();
  renderDesktopShortcuts();
  renderLauncherCatalog();
}

function renderDesktopShortcuts() {
  if (!desktopShortcuts) return;
  const shortcutRefs = getDesktopShortcutOrder()
    .map((ref) => ({ ref, meta: getAppMetaFromRef(ref) }))
    .filter((item) => item.meta)
    .slice(0, 12);
  saveDesktopShortcutOrder(shortcutRefs.map((item) => item.ref));

  desktopShortcuts.innerHTML = shortcutRefs.map(({ ref, meta }) => `
    <button class="desktop-shortcut" type="button" draggable="true" data-desktop-shortcut="${escapeHtml(ref)}" data-app-open-ref="${escapeHtml(ref)}" aria-label="Open ${escapeHtml(meta.title)}. Drag in Homescreen Change mode to move.">
      ${renderBadge(meta, `desktop-shortcut-badge${ref === "panel:youtube" ? " youtube-badge" : ""}`)}
      <strong>${escapeHtml(meta.title)}</strong>
    </button>
  `).join("");
  applyDesktopShortcutPositions();
}

let desktopShortcutDragRef = "";
let desktopShortcutSuppressClick = false;
let desktopShortcutPointerRef = "";
let desktopShortcutPointerMoved = false;
let desktopShortcutPointerButton = null;
let desktopShortcutStartX = 0;
let desktopShortcutStartY = 0;
let desktopShortcutOriginX = 0;
let desktopShortcutOriginY = 0;

function clearDesktopShortcutDragState() {
  desktopShortcuts?.querySelectorAll(".desktop-shortcut").forEach((button) => {
    button.classList.remove("is-dragging", "is-drop-target");
    button.setAttribute("aria-grabbed", "false");
  });
}

function reorderDesktopShortcut(sourceRef = "", targetRef = "") {
  if (!sourceRef || !targetRef || sourceRef === targetRef) return;
  const order = getDesktopShortcutOrder();
  const sourceIndex = order.indexOf(sourceRef);
  const targetIndex = order.indexOf(targetRef);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const [moved] = order.splice(sourceIndex, 1);
  order.splice(targetIndex, 0, moved);
  saveDesktopShortcutOrder(order);
  syncInstalledAppsFromDesktopOrder(order);
  renderDesktopShortcuts();
}

function renderStoreCard({ ref, meta, title, subtitle, openLabel = "Open" }) {
  const installed = isAppInstalled(ref);
  const installButton = installed
    ? `<button class="store-action" type="button" data-remove-ref="${escapeHtml(ref)}">Remove</button>`
    : `<button class="store-action store-action-primary" type="button" data-install-ref="${escapeHtml(ref)}">Download</button>`;
  const openButton = `<button class="store-action${installed ? " store-action-primary" : ""}" type="button" data-app-open-ref="${escapeHtml(ref)}">${escapeHtml(openLabel)}</button>`;
  return `
    <article class="app-icon app-store-card${installed ? " is-installed" : ""}">
      <span class="store-status">${installed ? "Installed" : "Get"}</span>
      ${renderBadge(meta, "app-badge")}
      <span class="icon-title">${escapeHtml(title || meta.title)}</span>
      <span class="icon-meta">${escapeHtml(subtitle || meta.label || "vel.os app")}</span>
      <div class="app-card-actions">
        ${installed ? `${openButton}${installButton}` : `${installButton}${openButton}`}
      </div>
    </article>
  `;
}

function recordRecentApp(entry) {
  const isNewRecent = !recentApps.some((item) => item.type === entry.type && item.id === entry.id);
  recentApps = [
    entry,
    ...recentApps.filter((item) => !(item.type === entry.type && item.id === entry.id))
  ].slice(0, 7);
  if (isNewRecent) awardVelCredits(entry.type === "game" ? 8 : 5);
  saveRecentApps();
  renderRecentApps();
  syncTaskbarState();
}

function renderRecentApps() {
  if (!recentAppsTray) return;

  const buttons = recentApps
    .map((entry) => {
      const meta = getRecentAppMeta(entry);
      if (!meta) return "";
      return `
        <button class="taskbar-app" type="button" data-recent-type="${escapeHtml(entry.type)}" data-recent-id="${escapeHtml(entry.id)}" aria-label="Open ${escapeHtml(meta.title)}">
          ${renderBadge(meta)}
          <span class="taskbar-label">${escapeHtml(meta.label || meta.title)}</span>
        </button>
      `;
    })
    .filter(Boolean)
    .join("");

  recentAppsTray.innerHTML = buttons || '<p class="recent-apps-empty">Play something and it will show up here.</p>';
}

function syncTaskbarState() {
  taskbarButtons.forEach((button) => button.classList.remove("is-active"));
  recentAppsTray?.querySelectorAll(".taskbar-app").forEach((button) => {
    button.classList.remove("is-active");
  });

  if (activePanel === "launcher" || activePanel === "game") {
    if (activePanel === "launcher") {
      startButton?.classList.add("is-active");
    }
    if (activePanel === "game") {
      openLocalGamesButton?.classList.add("is-active");
    }
  }

  if (activePanel === "music") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="music"]')?.classList.add("is-active");
  }

  if (activePanel === "ai") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="ai"]')?.classList.add("is-active");
  }

  if (activePanel === "youtube") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="youtube"]')?.classList.add("is-active");
  }

  if (activePanel === "velhub") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="velhub"]')?.classList.add("is-active");
  }

  if (activePanel === "lobbies") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="lobbies"]')?.classList.add("is-active");
  }

  if (activePanel === "soundboard") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="soundboard"]')?.classList.add("is-active");
  }

  if (activePanel === "dev") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="dev"]')?.classList.add("is-active");
  }

  if (activePanel === "settings") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="settings"]')?.classList.add("is-active");
  }

  if (activePanel === "calculator") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="calculator"]')?.classList.add("is-active");
  }

  if (activePanel === "network") {
    openNetworkButton?.classList.add("is-active");
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="network"]')?.classList.add("is-active");
  }

  if (activePanel === "web") {
    recentAppsTray?.querySelector(`[data-recent-type="web"][data-recent-id="${activeWeb}"]`)?.classList.add("is-active");
  }

  if (activePanel === "game") {
    recentAppsTray?.querySelector(`[data-recent-type="game"][data-recent-id="${activeLocalGame}"]`)?.classList.add("is-active");
  }
}

function pauseDynamicGames(nextGame) {
  if (nextGame !== "snake") {
    snake.pause("Snake paused.");
  }
  if (nextGame !== "tap") {
    tapRush.stop(false, "Tap Rush paused.");
  }
  if (nextGame !== "slots") {
    neonSlots.stop();
  }
  if (nextGame !== "roulette") {
    rouletteRush.stop();
  }
  if (nextGame !== "dice") {
    diceDuel.stop();
  }
}

function unloadWebFrame() {
  if (!webFrame) return;
  webFrame.removeAttribute("srcdoc");
  webFrame.src = "about:blank";
}

function stopMediaPanelPlayback() {
  pauseAllFeedMedia();
  youtubePlayer?.destroy?.();
  youtubePlayer = null;
  if (mediaPlayerFrame) mediaPlayerFrame.innerHTML = "";
  if (mediaPlayer) mediaPlayer.hidden = true;
}

function suspendPanelPlayback(name) {
  if (name === "music") return;

  if (name === "game") {
    pauseDynamicGames("");
    return;
  }

  if (name === "web") {
    unloadWebFrame();
    return;
  }

  if (name === "media") {
    stopMediaPanelPlayback();
    return;
  }

  if (name === "youtube") {
    pauseYouTubeAppPlayback();
    setYouTubeFullscreen(false);
    setYouTubeVideoFullscreen(false);
  }

  if (name === "velhub") {
    stopVelHubPlayback();
  }

  if (name === "lobbies") {
    window.clearTimeout(lobbyPollTimer);
  }

  if (name === "soundboard") {
    stopSoundboardSounds();
  }

  if (name === "dev") {
    window.clearTimeout(devPollTimer);
  }

  if (name === "calculator") {
    closeSecretVault();
  }

}

function openPanel(name) {
  if (isDevAppLocked(name)) {
    showDevAppLocked(name);
    return false;
  }
  pauseAllFeedMedia();

  Object.keys(drawers).forEach((key) => {
    if (key !== name && isDrawerOpen(key)) {
      suspendPanelPlayback(key);
    }
  });

  Object.keys(drawers).forEach((key) => {
    setDrawerState(key, key === name);
  });
  activePanel = name;

  if (name !== "game") {
    pauseDynamicGames("");
  }

  syncTaskbarState();

  if (name === "music") {
    recordRecentApp({ type: "panel", id: "music" });
  }

  if (name === "ai") {
    recordRecentApp({ type: "panel", id: "ai" });
    window.requestAnimationFrame(() => aiInput?.focus({ preventScroll: true }));
  }

  if (name === "youtube") {
    recordRecentApp({ type: "panel", id: "youtube" });
  }

  if (name === "velhub") {
    recordRecentApp({ type: "panel", id: "velhub" });
  }

  if (name === "lobbies") {
    recordRecentApp({ type: "panel", id: "lobbies" });
    loadLobbyState();
    window.requestAnimationFrame(() => {
      resizeLobbyCanvas();
    });
  }

  if (name === "soundboard") {
    recordRecentApp({ type: "panel", id: "soundboard" });
    renderSoundboard();
    loadSoundboardFiles();
  }

  if (name === "dev") {
    recordRecentApp({ type: "panel", id: "dev" });
    openDevPanel();
  }

  if (name === "settings") {
    recordRecentApp({ type: "panel", id: "settings" });
  }

  if (name === "network") {
    recordRecentApp({ type: "panel", id: "network" });
    renderNetworkState();
  }

  if (name === "calculator") {
    recordRecentApp({ type: "panel", id: "calculator" });
    window.requestAnimationFrame(() => calculatorExpression?.focus({ preventScroll: true }));
  }

  if (name === "game" && activeLocalGame === "snake") {
    window.requestAnimationFrame(() => {
      snake.refresh();
    });
  }

  reportDevPresence();
  return true;
}

function closeAllPanels() {
  Object.keys(drawers).forEach((key) => {
    if (isDrawerOpen(key)) {
      suspendPanelPlayback(key);
    }
  });
  Object.keys(drawers).forEach((key) => setDrawerState(key, false));
  activePanel = "";
  pauseAllFeedMedia();
  syncTaskbarState();
  reportDevPresence();
}

function closePanel(name) {
  suspendPanelPlayback(name);
  setDrawerState(name, false);
  if (activePanel === name) {
    activePanel = "";
  }
  syncTaskbarState();
  reportDevPresence();
}

function togglePanel(name) {
  if (isDrawerOpen(name)) {
    closePanel(name);
    return;
  }
  openPanel(name);
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function setNodeText(node, value) {
  if (node) node.textContent = value;
}

function updateClock() {
  try {
    const now = new Date();
    setNodeText(
      clockDay,
      new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now)
    );
    setNodeText(clockTime, formatTime(now));
    setNodeText(
      clockDate,
      new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric"
      }).format(now)
    );

    setNodeText(taskbarTime, formatTime(now));
    setNodeText(
      taskbarDate,
      new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(now)
    );
  } catch (error) {
    setNodeText(clockDay, "Today");
    setNodeText(clockTime, "--:--");
    setNodeText(clockDate, "Date unavailable");
    setNodeText(taskbarTime, "--:--");
    setNodeText(taskbarDate, "---");
  }
}

function renderNetworkState() {
  const label = networkNote ? `Direct: ${networkNote}` : "Direct Mode";
  setNodeText(desktopNetworkStatus, label);
  if (proxyNoteReadout) {
    proxyNoteReadout.textContent = networkNote
      ? `Saved note: ${networkNote}. Traffic still loads in direct mode.`
      : "No network note saved yet.";
  }
  if (proxyNoteInput) {
    proxyNoteInput.value = networkNote;
  }
}

function saveAiMessages() {
  storage.set(AI_HISTORY_KEY, JSON.stringify(aiMessages.slice(-AI_HISTORY_LIMIT)));
}

function renderAiMessages() {
  if (!aiMessagesEl) return;
  if (!aiMessages.length) {
    aiMessagesEl.innerHTML = `
      <article class="ai-message is-assistant">
        <strong>Vel AI</strong>
        <p>No messages yet.</p>
      </article>
    `;
  } else {
    aiMessagesEl.innerHTML = aiMessages.map((message) => `
      <article class="ai-message ${message.role === "user" ? "is-user" : "is-assistant"}">
        <strong>${message.role === "user" ? "You" : "Vel AI"}</strong>
        <p>${escapeHtml(message.content)}</p>
      </article>
    `).join("");
  }
  aiMessagesEl.scrollTop = aiMessagesEl.scrollHeight;
  if (aiStatus) {
    aiStatus.textContent = aiLoading ? "Thinking" : `${aiMessages.filter((item) => item.role === "user").length} prompts`;
  }
  if (aiChatForm) {
    aiChatForm.classList.toggle("is-loading", aiLoading);
  }
  if (aiInput) {
    aiInput.disabled = aiLoading;
  }
  aiChatForm?.querySelector("button[type='submit']")?.toggleAttribute("disabled", aiLoading);
}

function setAiError(message) {
  aiMessages = [
    ...aiMessages,
    {
      role: "assistant",
      content: message || "Vel AI could not reply right now."
    }
  ].slice(-AI_HISTORY_LIMIT);
  saveAiMessages();
  renderAiMessages();
}

async function sendAiMessage(text) {
  const message = text.trim();
  if (!message || aiLoading) return;

  aiMessages = [
    ...aiMessages,
    { role: "user", content: message }
  ].slice(-AI_HISTORY_LIMIT);
  saveAiMessages();
  aiLoading = true;
  renderAiMessages();

  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: aiMessages.slice(-12) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Vel AI is not available right now.");
    }
    aiMessages = [
      ...aiMessages,
      { role: "assistant", content: data.reply || "I could not generate a reply." }
    ].slice(-AI_HISTORY_LIMIT);
    saveAiMessages();
  } catch (error) {
    setAiError(error.message);
  } finally {
    aiLoading = false;
    if (aiInput) aiInput.value = "";
    renderAiMessages();
  }
}

function clearAiChat() {
  aiMessages = [];
  saveAiMessages();
  renderAiMessages();
  aiInput?.focus({ preventScroll: true });
}

function cleanVelChatName(value = "") {
  return String(value || "")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

function getOrCreateVelDeviceId() {
  const existing = storage.get(VEL_DEVICE_ID_KEY, "").replace(/[^\w.-]/g, "").slice(0, 96);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() || `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  storage.set(VEL_DEVICE_ID_KEY, next);
  return next;
}

function getVelDeviceName() {
  const ua = navigator.userAgent || "";
  const isIpad = /iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isIphone = /iPhone/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /CriOS|Chrome/i.test(ua);
  const isFirefox = /FxiOS|Firefox/i.test(ua);
  const browser = isFirefox ? "Firefox" : isChrome ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "Browser";
  if (isIpad) return `iPad ${browser}`;
  if (isIphone) return `iPhone ${browser}`;
  if (isAndroid) return `Android ${browser}`;
  return `${navigator.platform || "Device"} ${browser}`;
}

function createVelChatUser(name) {
  return {
    id: window.crypto?.randomUUID?.() || `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    username: cleanVelChatName(name) || "Guest"
  };
}

function normalizeVelChatUser(user) {
  if (!user || typeof user !== "object") return null;
  const username = cleanVelChatName(user.username);
  const id = String(user.id || "").replace(/[^\w.-]/g, "").slice(0, 64);
  if (!username || !id) return null;
  return { id, username };
}

function syncVelIdentity() {
  const user = normalizeVelChatUser(velChatUser);
  if (youtubeUserChip) {
    youtubeUserChip.textContent = user ? `@${user.username}` : "Guest";
  }
  document.body.dataset.velUser = user?.username || "";
}

function saveVelChatUser(user) {
  velChatUser = normalizeVelChatUser(user);
  if (velChatUser) {
    storage.set(VEL_CHAT_USER_KEY, JSON.stringify(velChatUser));
  } else {
    try {
      window.localStorage.removeItem(VEL_CHAT_USER_KEY);
    } catch (error) {
      return;
    }
  }
  syncVelIdentity();
}

function formatVelChatTime(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  } catch (error) {
    return "";
  }
}

function setVelChatStatus(message, tone = "") {
  if (!velChatStatus) return;
  velChatStatus.textContent = message;
  velChatStatus.dataset.tone = tone;
}

function getSessionChatPin() {
  try {
    window.sessionStorage.removeItem(VEL_CHAT_PIN_SESSION_KEY);
  } catch (error) {
    return velChatPin || "";
  }
  return velChatPin || "";
}

function clearLegacyStoredChatPin() {
  try {
    window.sessionStorage.removeItem(VEL_CHAT_PIN_SESSION_KEY);
  } catch (error) {
    return;
  }
}

function setSessionChatPin(value) {
  velChatPin = String(value || "").trim();
  clearLegacyStoredChatPin();
}

function getVelChatHeaders(extra = {}) {
  const pin = velChatPin || getSessionChatPin();
  return {
    ...extra,
    ...(pin ? { "x-vel-chat-pin": pin } : {})
  };
}

function setVelChatLocked(isLocked, message = "") {
  velChatUnlocked = !isLocked;
  velChat?.classList.toggle("is-locked", isLocked);
  if (velChatPinForm) velChatPinForm.hidden = true;
  if (!isLocked && velChatPinInput) velChatPinInput.value = "";
  if (isLocked) {
    velChatTypingUsers = [];
    renderVelChatTyping();
    window.clearTimeout(velChatTypingPollTimer);
    window.clearTimeout(velChatTypingStopTimer);
  }
  if (velChatMessages) velChatMessages.hidden = isLocked;
  if (velChatForm) velChatForm.hidden = isLocked;
  if (velChatAttachmentName) velChatAttachmentName.hidden = isLocked || !velChatAttachment;
  if (message) setVelChatStatus(message, isLocked ? "warn" : "live");
  if (isLocked && !message) setVelChatStatus("Finish startup login to unlock chat.", "warn");
  renderVelChatAuth();
}

function clearVelChatPin(message = "PIN required to view chat.") {
  setSessionChatPin("");
  if (velChatPinInput) velChatPinInput.value = "";
  setVelChatLocked(true, message);
  window.clearTimeout(velChatPollTimer);
  const bootDone = !bootScreen || bootScreen.classList.contains("is-hidden");
  if (bootDone && !document.body.classList.contains("is-booting") && welcomeGate?.hidden) {
    showWelcomeGate(velChatUser ? "pin" : "name");
  }
}

function getFirstUrl(value = "") {
  const match = String(value || "").match(/https?:\/\/[^\s<>"']+/i);
  return match?.[0]?.replace(/[),.!?]+$/, "") || "";
}

function getMediaTypeFromUrl(value = "") {
  const cleanUrl = String(value || "").split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp)$/.test(cleanUrl)) return "image";
  if (/\.(mp4|webm|ogg|mov)$/.test(cleanUrl)) return "video";
  return "link";
}

function isYouTubeLink(value = "") {
  try {
    const url = new URL(value);
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname);
  } catch (error) {
    return false;
  }
}

function renderChatTextWithLinks(text = "") {
  const parts = String(text || "").split(/(https?:\/\/[^\s<>"']+)/gi);
  return parts.map((part) => {
    if (!/^https?:\/\//i.test(part)) return escapeHtml(part);
    const cleanUrl = part.replace(/[),.!?]+$/, "");
    const trailing = part.slice(cleanUrl.length);
    const label = isYouTubeLink(cleanUrl) ? "Open YouTube link" : cleanUrl;
    return `<a href="${escapeHtml(cleanUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>${escapeHtml(trailing)}`;
  }).join("");
}

function renderVelChatAttachment(attachment) {
  if (!attachment?.url) return "";
  const name = escapeHtml(attachment.name || "Attachment");
  const url = escapeHtml(attachment.url);
  if (attachment.type === "image") {
    return `<a class="vel-chat-media-link" href="${url}" target="_blank" rel="noopener noreferrer"><img class="vel-chat-media" src="${url}" alt="${name}" loading="lazy" /></a>`;
  }
  if (attachment.type === "video") {
    return `<video class="vel-chat-media" src="${url}" controls playsinline preload="metadata" aria-label="${name}"></video>`;
  }
  return `<a class="vel-chat-link-card" href="${url}" target="_blank" rel="noopener noreferrer"><span>${isYouTubeLink(attachment.url) ? "YouTube" : "Link"}</span><strong>${name}</strong></a>`;
}

function setVelChatAttachment(attachment = null) {
  velChatAttachment = attachment;
  if (!velChatAttachmentName) return;
  if (!attachment) {
    velChatAttachmentName.hidden = true;
    velChatAttachmentName.textContent = "";
    return;
  }
  velChatAttachmentName.hidden = false;
  velChatAttachmentName.textContent = `Attached: ${attachment.name}`;
}

function makeAttachmentFromText(text = "") {
  const url = getFirstUrl(text);
  if (!url) return null;
  const type = getMediaTypeFromUrl(url);
  if (type === "link" && !isYouTubeLink(url)) return null;
  return {
    type,
    url,
    name: isYouTubeLink(url) ? "YouTube link" : type === "image" ? "Image link" : "Video link",
    size: 0
  };
}

function readVelChatAttachment(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    if (!/^image\/|^video\//i.test(file.type)) {
      reject(new Error("Only pictures and videos can be attached."));
      return;
    }
    if (file.size > VEL_CHAT_ATTACHMENT_LIMIT) {
      reject(new Error("That file is too large for chat. Put big videos in assets/secret-videos for the vault."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        type: file.type.startsWith("image/") ? "image" : "video",
        url: String(reader.result || ""),
        name: file.name || "Attachment",
        size: file.size
      });
    };
    reader.onerror = () => reject(new Error("Could not read that attachment."));
    reader.readAsDataURL(file);
  });
}

function setVelChatCollapsed(collapsed) {
  velChatCollapsed = Boolean(collapsed);
  storage.set(VEL_CHAT_COLLAPSED_KEY, velChatCollapsed ? "1" : "0");
  velChat?.classList.toggle("is-collapsed", velChatCollapsed);
  velChatToggle?.setAttribute("aria-expanded", velChatCollapsed ? "false" : "true");
  if (!velChatCollapsed) {
    markVelChatSeen();
    window.requestAnimationFrame(() => {
      stickVelChatToBottom();
      if (velChatUnlocked && velChatUser) {
        velChatInput?.focus({ preventScroll: true });
      }
    });
  } else {
    renderVelChatUnread();
  }
}

function renderVelChatAuth() {
  velChatUser = normalizeVelChatUser(velChatUser);
  if (velChatUserBar) velChatUserBar.hidden = !velChatUser;
  if (velChatUserName) velChatUserName.textContent = velChatUser?.username || "Guest";
  if (velChatUserPill) {
    velChatUserPill.hidden = !velChatUnlocked || Boolean(velChatUser);
    velChatUserPill.textContent = "Login";
    velChatUserPill.classList.toggle("is-logged-in", false);
  }
  if (velChatLoginNeeded) {
    velChatLoginNeeded.hidden = !velChatUnlocked || Boolean(velChatUser);
  }
  if (velChatName && velChatUser) {
    velChatName.value = velChatUser.username;
  }
  if (velChatInput) {
    velChatInput.disabled = !velChatUnlocked || !velChatUser || velChatLoading;
    velChatInput.placeholder = velChatUser
      ? "Message everyone on vel.os..."
      : velChatUnlocked ? "Login in Settings to chat..." : "Enter PIN first...";
  }
  velChatAttachButton?.toggleAttribute("disabled", !velChatUnlocked || !velChatUser || velChatLoading);
  velChatForm?.querySelector("button[type='submit']")?.toggleAttribute("disabled", !velChatUnlocked || !velChatUser || velChatLoading);
}

function openChatSettings() {
  openPanel("settings");
  window.requestAnimationFrame(() => {
    chatSettingsCard?.scrollIntoView({ behavior: "smooth", block: "center" });
    chatSettingsCard?.classList.add("is-highlighted");
    window.setTimeout(() => chatSettingsCard?.classList.remove("is-highlighted"), 1400);
    velChatName?.focus({ preventScroll: true });
  });
}

function getVelChatUnreadCount() {
  if (!velChatCollapsed || !velChatItems.length) return 0;
  const lastSeenIndex = velChatItems.findIndex((message) => message.id === velChatLastSeenId);
  const unseen = lastSeenIndex === -1
    ? velChatItems
    : velChatItems.slice(lastSeenIndex + 1);
  return unseen.filter((message) => message.userId !== velChatUser?.id).length;
}

function renderVelChatUnread() {
  if (!velChatUnread) return;
  const count = getVelChatUnreadCount();
  velChatUnread.hidden = count <= 0;
  velChatUnread.textContent = count > 99 ? "99+" : String(count);
}

function renderVelChatTyping() {
  if (!velChatTyping) return;
  const names = velChatTypingUsers
    .filter((user) => user?.userId && user.userId !== velChatUser?.id)
    .map((user) => cleanVelChatName(user.username))
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index)
    .slice(0, 4);
  if (!names.length) {
    velChatTyping.hidden = true;
    velChatTyping.innerHTML = "";
    return;
  }
  const label = names.length === 1
    ? `${names[0]} is typing`
    : `${names.slice(0, -1).join(", ")} + ${names[names.length - 1]} are typing`;
  velChatTyping.hidden = false;
  velChatTyping.innerHTML = `
    <span></span>
    <strong>${escapeHtml(label)}</strong>
    <em aria-hidden="true"><i></i><i></i><i></i></em>
  `;
}

function markVelChatSeen() {
  const last = velChatItems[velChatItems.length - 1];
  if (!last) return;
  velChatLastSeenId = last.id;
  storage.set(VEL_CHAT_LAST_SEEN_KEY, velChatLastSeenId);
  renderVelChatUnread();
}

function getVelChatRenderSignature() {
  return velChatItems
    .map((message) => `${message.id}:${message.createdAt}:${message.attachment?.url?.length || 0}`)
    .join("|");
}

function isVelChatNearBottom(buffer = 80) {
  if (!velChatMessages) return true;
  return velChatMessages.scrollTop + velChatMessages.clientHeight >= velChatMessages.scrollHeight - buffer;
}

function stickVelChatToBottom() {
  if (!velChatMessages) return;
  velChatMessages.scrollTop = velChatMessages.scrollHeight;
}

function watchVelChatMediaLoads(shouldStick) {
  if (!velChatMessages) return;
  const mediaItems = [...velChatMessages.querySelectorAll("img.vel-chat-media, video.vel-chat-media")];
  const handleMediaReady = () => {
    if (shouldStick || isVelChatNearBottom(140)) {
      window.requestAnimationFrame(stickVelChatToBottom);
    }
  };
  mediaItems.forEach((item) => {
    item.addEventListener("load", handleMediaReady, { once: true });
    item.addEventListener("loadedmetadata", handleMediaReady, { once: true });
    if (item.tagName === "IMG" && item.complete) {
      handleMediaReady();
    }
  });
}

function renderVelChatMessages(forceStick = false) {
  if (!velChatMessages) return;
  const shouldStickToBottom = forceStick || isVelChatNearBottom();
  const previousScrollTop = velChatMessages.scrollTop;
  const nextSignature = getVelChatRenderSignature();
  if (nextSignature === velChatRenderSignature && !forceStick && velChatMessages.childElementCount) {
    if (!velChatCollapsed) {
      markVelChatSeen();
    } else {
      renderVelChatUnread();
    }
    return;
  }
  velChatRenderSignature = nextSignature;
  if (!velChatItems.length) {
    velChatMessages.innerHTML = `<p class="vel-chat-empty">No messages yet. Login and be the first one in the lobby.</p>`;
  } else {
    velChatMessages.innerHTML = velChatItems.map((message) => {
      const isOwn = message.userId === velChatUser?.id;
      return `
        <article class="vel-chat-message ${isOwn ? "is-own" : ""}">
          <div class="vel-chat-message-meta">
            <strong>${escapeHtml(message.username || "Guest")}</strong>
            <span>${escapeHtml(formatVelChatTime(message.createdAt))}</span>
            <button class="vel-chat-delete" type="button" data-chat-delete="${escapeHtml(message.id)}" aria-label="Delete message from ${escapeHtml(message.username || "Guest")}">Delete</button>
          </div>
          ${message.text ? `<p class="vel-chat-message-bubble">${renderChatTextWithLinks(message.text || "")}</p>` : ""}
          ${renderVelChatAttachment(message.attachment)}
        </article>
      `;
    }).join("");
  }
  if (shouldStickToBottom) {
    stickVelChatToBottom();
  } else {
    velChatMessages.scrollTop = previousScrollTop;
  }
  watchVelChatMediaLoads(shouldStickToBottom);
  if (!velChatCollapsed) {
    markVelChatSeen();
  } else {
    renderVelChatUnread();
  }
}

function normalizeVelChatItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((message) => ({
      id: String(message?.id || "").slice(0, 48),
      userId: String(message?.userId || "").slice(0, 64),
      username: cleanVelChatName(message?.username) || "Guest",
      text: String(message?.text || "").trim().slice(0, 360),
      attachment: message?.attachment && typeof message.attachment === "object"
        ? {
          type: ["image", "video", "link"].includes(message.attachment.type) ? message.attachment.type : "link",
          url: String(message.attachment.url || ""),
          name: String(message.attachment.name || "Attachment").slice(0, 90),
          size: Number(message.attachment.size) || 0
        }
        : null,
      createdAt: Number(message?.createdAt) || Date.now()
    }))
    .filter((message) => message.id && (message.text || message.attachment?.url))
    .slice(-180);
}

async function fetchVelChatMessages(showLoading = false) {
  if (!velChatUnlocked) {
    setVelChatLocked(true);
    return;
  }
  if (velChatLoading && showLoading) return;
  if (showLoading) {
    velChatLoading = true;
    renderVelChatAuth();
    setVelChatStatus("Connecting chat...");
  }

  try {
    const response = await fetch("/api/chat/messages", {
      cache: "no-store",
      headers: getVelChatHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearVelChatPin(data.message || "Wrong PIN. Try again.");
      return;
    }
    if (!response.ok) {
      throw new Error(data.message || "Global Chat could not load.");
    }
    velChatItems = normalizeVelChatItems(data.messages);
    renderVelChatMessages(showLoading);
    setVelChatStatus(data.persistent
      ? "Live site-wide chat connected."
      : "Chat is temporary until Redis storage is connected.",
    data.persistent ? "live" : "warn");
  } catch (error) {
    setVelChatStatus(error.message || "Chat offline. Retrying...", "error");
  } finally {
    velChatLoading = false;
    renderVelChatAuth();
    scheduleVelChatPoll();
  }
}

function scheduleVelChatPoll() {
  if (!velChat) return;
  window.clearTimeout(velChatPollTimer);
  velChatPollTimer = window.setTimeout(() => fetchVelChatMessages(false), VEL_CHAT_POLL_MS);
}

function normalizeVelChatTyping(items) {
  return (Array.isArray(items) ? items : [])
    .map((user) => ({
      userId: String(user?.userId || "").slice(0, 64),
      username: cleanVelChatName(user?.username),
      deviceId: String(user?.deviceId || "").slice(0, 96),
      updatedAt: Number(user?.updatedAt) || Date.now()
    }))
    .filter((user) => user.userId && user.username);
}

function scheduleVelChatTypingPoll() {
  window.clearTimeout(velChatTypingPollTimer);
  if (!velChatUnlocked) return;
  velChatTypingPollTimer = window.setTimeout(fetchVelChatTyping, VEL_CHAT_TYPING_POLL_MS);
}

async function fetchVelChatTyping() {
  if (!velChatUnlocked) return;
  try {
    const response = await fetch("/api/chat/typing", {
      cache: "no-store",
      headers: getVelChatHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearVelChatPin(data.message || "Wrong PIN. Try again.");
      return;
    }
    if (response.ok) {
      velChatTypingUsers = normalizeVelChatTyping(data.typing);
      renderVelChatTyping();
    }
  } catch (error) {
    return;
  } finally {
    scheduleVelChatTypingPoll();
  }
}

async function sendVelChatTyping(isTyping) {
  if (!velChatUnlocked || !velChatUser) return;
  const now = Date.now();
  if (isTyping && velChatIsTyping && now - velChatLastTypingSentAt < VEL_CHAT_TYPING_THROTTLE_MS) return;
  velChatIsTyping = Boolean(isTyping);
  velChatLastTypingSentAt = now;
  try {
    const response = await fetch("/api/chat/typing", {
      method: "POST",
      headers: getVelChatHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        userId: velChatUser.id,
        username: velChatUser.username,
        deviceId: velDeviceId,
        typing: Boolean(isTyping)
      }),
      keepalive: true
    });
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      velChatTypingUsers = normalizeVelChatTyping(data.typing);
      renderVelChatTyping();
    }
  } catch (error) {
    return;
  }
}

function handleVelChatTypingInput() {
  const isTyping = Boolean(velChatInput?.value.trim());
  window.clearTimeout(velChatTypingStopTimer);
  sendVelChatTyping(isTyping);
  if (isTyping) {
    velChatTypingStopTimer = window.setTimeout(() => {
      sendVelChatTyping(false);
    }, VEL_CHAT_TYPING_IDLE_MS);
  }
  reportDevPresence();
}

async function sendVelChatMessage(text) {
  const message = String(text || "").trim();
  if ((!message && !velChatAttachment) || !velChatUnlocked || !velChatUser || velChatLoading) return;
  velChatLoading = true;
  renderVelChatAuth();
  setVelChatStatus("Sending...");

  try {
    const response = await fetch("/api/chat/messages", {
      method: "POST",
      headers: getVelChatHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        userId: velChatUser.id,
        username: velChatUser.username,
        text: message,
        attachment: velChatAttachment || makeAttachmentFromText(message)
      })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearVelChatPin(data.message || "Wrong PIN. Try again.");
      return;
    }
    if (!response.ok) {
      throw new Error(data.message || "Message could not send.");
    }
    velChatItems = normalizeVelChatItems(data.messages);
    if (velChatInput) velChatInput.value = "";
    sendVelChatTyping(false);
    if (velChatAttachmentInput) velChatAttachmentInput.value = "";
    setVelChatAttachment(null);
    renderVelChatMessages(true);
    setVelChatStatus(data.persistent
      ? "Sent to everyone on vel.os."
      : "Sent in temporary chat. Connect Redis for permanent global messages.",
    data.persistent ? "live" : "warn");
  } catch (error) {
    setVelChatStatus(error.message || "Message failed.", "error");
  } finally {
    velChatLoading = false;
    renderVelChatAuth();
    scheduleVelChatPoll();
    velChatInput?.focus({ preventScroll: true });
  }
}

async function deleteVelChatMessages(payload = {}, successMessage = "Chat updated.") {
  if (!velChatUnlocked || velChatLoading) return;
  velChatLoading = true;
  renderVelChatAuth();
  setVelChatStatus("Updating chat...");

  try {
    const response = await fetch("/api/chat/messages", {
      method: "DELETE",
      headers: getVelChatHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearVelChatPin(data.message || "Wrong PIN. Try again.");
      return;
    }
    if (!response.ok) {
      throw new Error(data.message || "Chat could not update.");
    }
    velChatItems = normalizeVelChatItems(data.messages);
    renderVelChatMessages(true);
    setVelChatStatus(successMessage, data.persistent ? "live" : "warn");
  } catch (error) {
    setVelChatStatus(error.message || "Could not update chat.", "error");
  } finally {
    velChatLoading = false;
    renderVelChatAuth();
    scheduleVelChatPoll();
  }
}

function deleteVelChatMessage(messageId = "") {
  const id = String(messageId || "").trim();
  if (!id) return;
  deleteVelChatMessages({ messageId: id }, "Message deleted.");
}

function clearVelChatLog() {
  if (!velChatUnlocked) {
    setVelChatStatus("Enter the startup PIN before clearing chat.", "warn");
    return;
  }
  const shouldClear = window.confirm("Delete the entire Global Chat log for everyone?");
  if (!shouldClear) return;
  deleteVelChatMessages({ action: "clear" }, "Global Chat log cleared.");
}

function initVelChat() {
  velChatUser = normalizeVelChatUser(velChatUser);
  syncVelIdentity();
  if (velChatName && velChatUser) {
    velChatName.value = velChatUser.username;
  }
  velChatPin = getSessionChatPin();
  velChatUnlocked = Boolean(velChatPin);
  setVelChatCollapsed(velChatCollapsed);
  setVelChatLocked(!velChatUnlocked);
  renderVelChatAuth();
  renderVelChatMessages();
  renderVelChatTyping();
  if (velChatUnlocked) {
    fetchVelChatMessages(true);
    fetchVelChatTyping();
  }
}

async function unlockVelChat(pinValue) {
  const nextPin = String(pinValue || "").trim();
  if (!nextPin) {
    setVelChatStatus("Enter the chat PIN.", "warn");
    return false;
  }
  setSessionChatPin(nextPin);
  setVelChatLocked(false, "Unlocking chat...");
  await fetchVelChatMessages(true);
  if (velChatUnlocked) {
    setVelChatStatus("Chat unlocked.", "live");
    reportDevPresence();
    fetchVelChatTyping();
    velChatInput?.focus({ preventScroll: true });
    return true;
  }
  return false;
}

function sanitizeCalculatorExpression(value = "") {
  return String(value || "")
    .replace(/[×x]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[^\d+\-*/().\s]/g, "")
    .slice(0, 80);
}

function calculateExpression(value = "") {
  const expression = sanitizeCalculatorExpression(value);
  if (!expression.trim()) return "";
  if (!/^[\d+\-*/().\s]+$/.test(expression)) {
    throw new Error("Only numbers and math symbols are allowed.");
  }
  const result = Function(`"use strict"; return (${expression});`)();
  if (!Number.isFinite(Number(result))) throw new Error("That does not calculate cleanly.");
  return Number(result);
}

function formatVaultSize(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value > 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function renderSecretVault() {
  if (!secretVaultGrid) return;
  if (secretVaultLoading) {
    secretVaultGrid.innerHTML = '<p class="catalog-empty">Loading vault videos...</p>';
    return;
  }
  if (!secretVaultVideos.length) {
    secretVaultGrid.innerHTML = '<p class="catalog-empty">No videos yet. Add MP4, WEBM, OGG, or MOV files to assets/secret-videos, then publish.</p>';
    return;
  }
  secretVaultGrid.innerHTML = secretVaultVideos.map((video) => `
    <article class="secret-video-card">
      <video src="${escapeHtml(video.url)}" controls playsinline preload="metadata"></video>
      <strong>${escapeHtml(video.name || video.fileName || "Vault Video")}</strong>
      <span>${escapeHtml(formatVaultSize(video.size))}</span>
    </article>
  `).join("");
}

function closeSecretVault() {
  secretVaultUnlocked = false;
  secretVaultLoading = false;
  secretVaultVideos = [];
  secretVault?.querySelectorAll("video").forEach((video) => {
    video.pause();
    video.removeAttribute("src");
    video.load();
  });
  if (secretVault) secretVault.hidden = true;
  if (secretVaultGrid) {
    secretVaultGrid.innerHTML = '<p class="catalog-empty">Enter the code to load vault videos.</p>';
  }
  if (calculatorExpression) calculatorExpression.value = "";
  if (calculatorResult) calculatorResult.textContent = "0";
}

async function loadSecretVaultVideos() {
  if (!secretVaultGrid) return;
  secretVaultLoading = true;
  renderSecretVault();
  try {
    const response = await fetch("/api/secret/videos", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Vault videos could not load.");
    secretVaultVideos = Array.isArray(data.videos) ? data.videos : [];
  } catch (error) {
    secretVaultGrid.innerHTML = `<p class="catalog-empty">${escapeHtml(error.message || "Vault videos could not load.")}</p>`;
    return;
  } finally {
    secretVaultLoading = false;
  }
  renderSecretVault();
}

function unlockSecretVault() {
  secretVaultUnlocked = true;
  if (secretVault) secretVault.hidden = false;
  loadSecretVaultVideos();
}

function submitCalculator() {
  if (!calculatorExpression || !calculatorResult) return;
  const expression = calculatorExpression.value;
  const normalized = sanitizeCalculatorExpression(expression).replace(/\s+/g, "");
  try {
    const result = calculateExpression(expression);
    calculatorResult.textContent = String(result);
    if (normalized === "67+7") {
      calculatorExpression.value = "";
      calculatorResult.textContent = "Vault unlocked";
      unlockSecretVault();
    }
  } catch (error) {
    calculatorResult.textContent = error.message || "Error";
  }
}

const soundboardGeneratedSounds = [
  { id: "airhorn", title: "Airhorn", detail: "Big two-tone blast", accent: "#f7d45a" },
  { id: "boom", title: "Boom", detail: "Deep impact hit", accent: "#ff6b6b" },
  { id: "laser", title: "Laser", detail: "Arcade zap", accent: "#71e8ff" },
  { id: "coin", title: "Coin", detail: "Tiny win pickup", accent: "#ffd36b" },
  { id: "pop", title: "Pop", detail: "Clean bubble tap", accent: "#c8f7ff" },
  { id: "bell", title: "Bell", detail: "Bright chime", accent: "#f4f4f4" },
  { id: "error", title: "Error", detail: "Retro no-no beep", accent: "#ff4f8b" },
  { id: "whoosh", title: "Whoosh", detail: "Fast sweep", accent: "#bdb7ff" },
  { id: "drum", title: "Drum Fill", detail: "Quick tom run", accent: "#ffb36b" },
  { id: "victory", title: "Victory", detail: "Tiny level clear", accent: "#a8ffbf" },
  { id: "sad", title: "Sad Trombone", detail: "Womp slide", accent: "#7fa0ff" },
  { id: "glitch", title: "Glitch", detail: "Broken computer chirps", accent: "#d9d9d9" }
];

function formatSoundboardSize(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value > 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function getSoundboardAccent(index = 0) {
  const accents = ["#f7d45a", "#ff6b6b", "#71e8ff", "#c8f7ff", "#bdb7ff", "#a8ffbf", "#ff4f8b"];
  return accents[index % accents.length];
}

function normalizeSoundboardFile(item = {}, index = 0, source = "project") {
  const title = String(item.title || item.name || item.fileName || `Sound ${index + 1}`)
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48) || `Sound ${index + 1}`;
  const url = String(item.url || "").trim();
  if (!url) return null;
  return {
    id: `${source}:${item.id || item.fileName || title}:${index}`,
    title,
    detail: source === "import" ? `Imported - ${formatSoundboardSize(item.size)}` : `Real file - ${formatSoundboardSize(item.size)}`,
    url,
    type: item.type || "audio/mpeg",
    accent: getSoundboardAccent(index),
    source
  };
}

function getAllSoundboardRealSounds() {
  return [...soundboardImportedSounds, ...soundboardRealSounds];
}

function getSoundboardContext() {
  if (!soundboardAudioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    soundboardAudioContext = new AudioCtor();
  }
  if (soundboardAudioContext.state === "suspended") {
    soundboardAudioContext.resume().catch(() => {});
  }
  return soundboardAudioContext;
}

function getSoundboardVolume() {
  const value = Number(soundboardVolume?.value || 72);
  return Math.max(0, Math.min(1, value / 100));
}

function setSoundboardStatus(message = "Pick a pad to play a sound.") {
  if (soundboardStatus) soundboardStatus.textContent = message;
}

async function loadSoundboardFiles() {
  if (soundboardLoading || soundboardLoaded) return;
  soundboardLoading = true;
  setSoundboardStatus("Loading real sound files...");
  try {
    const response = await fetch("/api/soundboard", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Soundboard files could not load.");
    soundboardRealSounds = (Array.isArray(data.sounds) ? data.sounds : [])
      .map((item, index) => normalizeSoundboardFile(item, index, "project"))
      .filter(Boolean);
    soundboardLoaded = true;
    setSoundboardStatus(soundboardRealSounds.length
      ? `${soundboardRealSounds.length} real sound${soundboardRealSounds.length === 1 ? "" : "s"} loaded.`
      : "No real sound files yet. Add MP3/WAV/M4A files to assets/soundboard or import them here.");
  } catch (error) {
    setSoundboardStatus(error.message || "Real sound files could not load.");
  } finally {
    soundboardLoading = false;
    renderSoundboard();
  }
}

function trackSoundboardNode(node) {
  if (!node) return;
  soundboardActiveNodes.push(node);
  window.setTimeout(() => {
    soundboardActiveNodes = soundboardActiveNodes.filter((item) => item !== node);
  }, 2400);
}

function playSoundTone(freq = 440, duration = 0.18, options = {}) {
  const ctx = getSoundboardContext();
  if (!ctx) {
    setSoundboardStatus("Audio is not supported in this browser.");
    return;
  }
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(freq, now);
  if (options.to) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, options.to), now + duration);
  }
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, (options.gain || 0.42) * getSoundboardVolume()), now + (options.attack || 0.012));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.04);
  trackSoundboardNode(oscillator);
}

function playSoundNoise(duration = 0.2, options = {}) {
  const ctx = getSoundboardContext();
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    const fade = 1 - index / data.length;
    data[index] = (Math.random() * 2 - 1) * fade;
  }
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = options.filter || "bandpass";
  filter.frequency.value = options.frequency || 900;
  filter.Q.value = options.q || 1.2;
  gain.gain.value = (options.gain || 0.22) * getSoundboardVolume();
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  trackSoundboardNode(source);
}

function pulseSoundPad(id = "") {
  const button = [...(soundboardGrid?.querySelectorAll("[data-sound-id]") || [])]
    .find((item) => item.dataset.soundId === id);
  if (!button) return;
  button.classList.add("is-playing");
  window.setTimeout(() => button.classList.remove("is-playing"), 360);
}

function playSoundboardSound(id = "") {
  const sound = soundboardGeneratedSounds.find((item) => item.id === id);
  if (!sound) return;
  pulseSoundPad(id);
  setSoundboardStatus(`Playing ${sound.title}.`);

  if (id === "airhorn") {
    playSoundTone(466, 0.22, { type: "square", to: 523, gain: 0.28 });
    window.setTimeout(() => playSoundTone(392, 0.24, { type: "square", to: 466, gain: 0.26 }), 170);
  } else if (id === "boom") {
    playSoundTone(92, 0.42, { type: "sine", to: 38, gain: 0.62 });
    playSoundNoise(0.28, { filter: "lowpass", frequency: 180, gain: 0.24 });
  } else if (id === "laser") {
    playSoundTone(1200, 0.28, { type: "sawtooth", to: 170, gain: 0.24 });
  } else if (id === "coin") {
    playSoundTone(988, 0.09, { type: "triangle", gain: 0.26 });
    window.setTimeout(() => playSoundTone(1568, 0.12, { type: "triangle", gain: 0.24 }), 70);
  } else if (id === "pop") {
    playSoundTone(180, 0.08, { type: "sine", to: 540, gain: 0.22 });
  } else if (id === "bell") {
    playSoundTone(1046, 0.42, { type: "sine", gain: 0.2 });
    playSoundTone(1568, 0.34, { type: "sine", gain: 0.12 });
  } else if (id === "error") {
    playSoundTone(210, 0.12, { type: "square", gain: 0.22 });
    window.setTimeout(() => playSoundTone(150, 0.18, { type: "square", gain: 0.22 }), 115);
  } else if (id === "whoosh") {
    playSoundNoise(0.38, { filter: "highpass", frequency: 760, gain: 0.28 });
    playSoundTone(620, 0.28, { type: "sine", to: 120, gain: 0.1 });
  } else if (id === "drum") {
    [160, 130, 105, 82].forEach((freq, index) => {
      window.setTimeout(() => playSoundTone(freq, 0.12, { type: "sine", to: freq * 0.55, gain: 0.34 }), index * 88);
    });
  } else if (id === "victory") {
    [523, 659, 784, 1046].forEach((freq, index) => {
      window.setTimeout(() => playSoundTone(freq, 0.16, { type: "triangle", gain: 0.24 }), index * 115);
    });
  } else if (id === "sad") {
    playSoundTone(330, 0.32, { type: "sawtooth", to: 294, gain: 0.2 });
    window.setTimeout(() => playSoundTone(277, 0.44, { type: "sawtooth", to: 196, gain: 0.2 }), 260);
  } else if (id === "glitch") {
    [680, 240, 920, 180, 740].forEach((freq, index) => {
      window.setTimeout(() => playSoundTone(freq, 0.045, { type: "square", gain: 0.18 }), index * 48);
    });
  }
}

function playSoundboardFile(id = "") {
  const sound = getAllSoundboardRealSounds().find((item) => item.id === id);
  if (!sound?.url) return;
  const audio = new Audio(sound.url);
  audio.preload = "auto";
  audio.volume = getSoundboardVolume();
  soundboardActiveMedia.push(audio);
  audio.addEventListener("ended", () => {
    soundboardActiveMedia = soundboardActiveMedia.filter((item) => item !== audio);
  }, { once: true });
  audio.play().catch(() => {
    setSoundboardStatus("Tap again if the browser blocked autoplay.");
  });
  pulseSoundPad(id);
  setSoundboardStatus(`Playing real sound: ${sound.title}.`);
}

function importSoundboardFiles(fileList) {
  const files = [...(fileList || [])].filter((file) => file.type.startsWith("audio/"));
  if (!files.length) {
    setSoundboardStatus("Pick MP3, WAV, M4A, OGG, or other audio files.");
    return;
  }

  soundboardImportedSounds.forEach((sound) => {
    if (sound.source === "import" && sound.url?.startsWith("blob:")) {
      URL.revokeObjectURL(sound.url);
    }
  });
  soundboardImportedSounds = files
    .map((file, index) => normalizeSoundboardFile({
      id: `${file.name}-${file.lastModified}`,
      title: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
      size: file.size
    }, index, "import"))
    .filter(Boolean);
  renderSoundboard();
  setSoundboardStatus(`${soundboardImportedSounds.length} real imported sound${soundboardImportedSounds.length === 1 ? "" : "s"} ready.`);
}

function stopSoundboardSounds() {
  soundboardActiveNodes.forEach((node) => {
    try {
      node.stop?.();
      node.disconnect?.();
    } catch (error) {
      return;
    }
  });
  soundboardActiveNodes = [];
  soundboardActiveMedia.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  soundboardActiveMedia = [];
  setSoundboardStatus("Stopped all soundboard sounds.");
}

function renderSoundboard() {
  if (!soundboardGrid) return;
  const realSounds = getAllSoundboardRealSounds();
  const realPads = realSounds.map((sound) => `
    <button class="sound-pad is-real" type="button" data-sound-file-id="${escapeHtml(sound.id)}" style="--sound-accent: ${escapeHtml(sound.accent)}" aria-label="Play ${escapeHtml(sound.title)}">
      <em>REAL</em>
      <strong>${escapeHtml(sound.title)}</strong>
      <span>${escapeHtml(sound.detail)}</span>
    </button>
  `).join("");
  const generatedPads = soundboardGeneratedSounds.map((sound) => `
    <button class="sound-pad" type="button" data-sound-id="${escapeHtml(sound.id)}" style="--sound-accent: ${escapeHtml(sound.accent)}" aria-label="Play ${escapeHtml(sound.title)}">
      <strong>${escapeHtml(sound.title)}</strong>
      <span>${escapeHtml(sound.detail)}</span>
    </button>
  `).join("");
  const emptyReal = realSounds.length ? "" : `
    <article class="soundboard-empty-card">
      <strong>No real sounds added yet.</strong>
      <span>Drop MP3/WAV/M4A files into assets/soundboard for permanent pads, or press Import Sounds for this session.</span>
    </article>
  `;
  soundboardGrid.innerHTML = `${realPads}${emptyReal}${generatedPads}`;
}

function setDevStatus(message = "", tone = "") {
  if (!devStatus) return;
  devStatus.textContent = message;
  devStatus.dataset.tone = tone;
}

function getActiveDevAppInfo() {
  const activity = getDevActivityLabel();
  if (!activePanel) {
    return { app: "desktop", appTitle: "Desktop", panel: "desktop", activity };
  }
  if (activePanel === "web") {
    const app = webApps[activeWeb] || utilityApps.browser;
    return {
      app: activeWeb || "browser",
      appTitle: app?.title || "Web Browser",
      panel: "web",
      activity
    };
  }
  if (activePanel === "game") {
    const game = localGameMeta[activeLocalGame];
    return {
      app: activeLocalGame || "game",
      appTitle: game?.title || "Local Game",
      panel: "game",
      activity
    };
  }
  const app = utilityApps[activePanel] || { title: activePanel };
  return {
    app: activePanel,
    appTitle: app.title || activePanel,
    panel: activePanel,
    activity
  };
}

function getDevActivityLabel() {
  if (document.activeElement === velChatInput && velChatInput?.value.trim()) {
    return "Typing in Global Chat";
  }
  if (!activePanel) return "On desktop";
  if (activePanel === "youtube") {
    if (youtubeAppState.currentVideo?.title) return `Watching YouTube: ${youtubeAppState.currentVideo.title}`;
    if (youtubeAppState.query) return `Browsing YouTube: ${youtubeAppState.query}`;
    return "Browsing YouTube";
  }
  if (activePanel === "music") {
    const localTrack = playlist[currentTrackIndex];
    if (currentSpotifyTrack?.title) return `Velofy Spotify: ${currentSpotifyTrack.title}`;
    if (localTrack?.title) return `Velofy: ${localTrack.title}`;
    return "Using Velofy";
  }
  if (activePanel === "game") {
    return `Playing ${localGameMeta[activeLocalGame]?.title || "a local game"}`;
  }
  if (activePanel === "web") {
    return `Using web app: ${webApps[activeWeb]?.title || currentWebUrl || "Browser"}`;
  }
  if (activePanel === "velhub") {
    return velHubState.currentItem?.title ? `Watching Vel Hub: ${velHubState.currentItem.title}` : "Browsing Vel Hub";
  }
  if (activePanel === "lobbies") return `Notebook: ${lobbyState.mode === "sketch" ? "Sketching" : "Writing notes"}`;
  if (activePanel === "soundboard") return "Using Soundboard";
  if (activePanel === "ai") return aiLoading ? "Asking Vel AI" : "Using Vel AI";
  if (activePanel === "calculator") return secretVaultUnlocked ? "In secret vault" : "Using Calculator";
  if (activePanel === "settings") return "Changing settings";
  if (activePanel === "network") return "Checking Network";
  return `Using ${utilityApps[activePanel]?.title || activePanel}`;
}

function formatDevBanUntil(value = 0) {
  if (!value) return "Permanent";
  const remaining = Number(value) - Date.now();
  if (remaining <= 0) return "Expired";
  if (remaining < 60000) return `${Math.ceil(remaining / 1000)} sec`;
  const minutes = Math.ceil(remaining / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.ceil(hours / 24)} day`;
}

function persistDevLockedApps() {
  storage.set("vel-dev-locked-apps", JSON.stringify([...devLockedApps].slice(0, 40)));
}

function updateDevLockedApps(apps = []) {
  devLockedApps = new Set((Array.isArray(apps) ? apps : []).map((item) => String(item || "").trim()).filter(Boolean));
  persistDevLockedApps();
}

function isDevAppLocked(name = "") {
  const key = String(name || "").trim();
  if (!key || key === "dev") return false;
  return devLockedApps.has(key);
}

function showOwnerLockOverlay(title = "Locked by owner", message = "This area is temporarily locked.", options = {}) {
  if (!ownerLockOverlay) return;
  ownerLockMode = options.mode || "app";
  if (ownerLockTitle) ownerLockTitle.textContent = title;
  if (ownerLockMessage) ownerLockMessage.textContent = message;
  if (ownerLockDismiss) {
    ownerLockDismiss.hidden = ownerLockMode === "site";
    ownerLockDismiss.textContent = ownerLockMode === "site" ? "Locked" : "Back";
  }
  ownerLockOverlay.hidden = false;
  document.body.classList.add("is-owner-locked");
  if (ownerLockMode === "site") {
    document.body.classList.add("is-access-blocked");
  }
}

function hideOwnerLockOverlay(options = {}) {
  if (ownerLockMode === "site" && !options.force) return;
  ownerLockMode = "";
  if (ownerLockOverlay) ownerLockOverlay.hidden = true;
  document.body.classList.remove("is-owner-locked");
  if (options.clearAccess) document.body.classList.remove("is-access-blocked");
}

function showDevAppLocked(name = "app") {
  const title = utilityApps[name]?.title || webApps[name]?.title || localGameMeta[name]?.title || name;
  showOwnerLockOverlay("App locked", `${title} is locked by owner.`, { mode: "app" });
}

function getDevBanDurationOptions() {
  return `
    <option value="5m">5m</option>
    <option value="10m">10m</option>
    <option value="30m">30m</option>
    <option value="1h">1h</option>
    <option value="12h">12h</option>
    <option value="24h">24h</option>
    <option value="3d">3d</option>
    <option value="7d">7d</option>
    <option value="30d">30d</option>
    <option value="permanent">Forever</option>
  `;
}

function getDevAppLockOptions(activeApp = "") {
  const options = [
    ["youtube", "YouTube"],
    ["music", "Velofy"],
    ["game", "Local Games"],
    ["web", "Web"],
    ["velhub", "Vel Hub"],
    ["lobbies", "Notebook"],
    ["soundboard", "Soundboard"],
    ["calculator", "Calculator"],
    ["settings", "Settings"],
    ["network", "Network"]
  ];
  const normalizedActive = String(activeApp || "").trim();
  if (normalizedActive && !options.some(([id]) => id === normalizedActive)) {
    options.unshift([normalizedActive, `Current: ${normalizedActive}`]);
  }
  return options.map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`).join("");
}

function renderDevPanel(users = [], meta = {}) {
  if (!devOnlineList) return;
  const bans = Array.isArray(meta.bans) ? meta.bans : [];
  const bannedKeys = new Set(bans.flatMap((ban) => [ban.deviceId && `device:${ban.deviceId}`, ban.userId && `user:${ban.userId}`].filter(Boolean)));
  if (!users.length) {
    devOnlineList.innerHTML = '<p class="catalog-empty">No users online yet.</p>';
  } else {
    devOnlineList.innerHTML = users.map((user) => `
      <article class="dev-user-row">
        <div class="dev-user-main">
          <span class="dev-user-dot" aria-hidden="true"></span>
          <div class="dev-user-copy">
            <strong>${escapeHtml(user.username || "Guest")}</strong>
            <span>${escapeHtml(user.appTitle || "Desktop")}</span>
            <b class="dev-activity">${escapeHtml(user.activity || "Live on vel.os")}</b>
            <small>${escapeHtml(user.deviceName || "Unknown device")}</small>
            <small>${escapeHtml(user.deviceId ? `Device ${user.deviceId.slice(0, 8)}` : "No device ID")}</small>
            ${user.siteLocked ? '<small class="dev-lock-note">Site locked by owner</small>' : ""}
            ${Array.isArray(user.lockedApps) && user.lockedApps.length ? `<small class="dev-lock-note">Locked apps: ${escapeHtml(user.lockedApps.join(", "))}</small>` : ""}
          </div>
          <em>${escapeHtml(formatLobbyTime(user.lastSeen))}</em>
        </div>
        <div class="dev-user-controls">
          ${user.deviceId === velDeviceId ? `
            <span class="dev-self-badge">This is you</span>
            <span class="dev-action-note">Admin controls show on other devices.</span>
          ` : `
            <button type="button" data-dev-kick="${escapeHtml(user.userId || "")}" data-dev-device="${escapeHtml(user.deviceId || "")}">Kick off site</button>
            <select aria-label="Ban duration" data-dev-duration="${escapeHtml(user.userId || "")}">
              ${getDevBanDurationOptions()}
            </select>
            <input type="number" min="1" max="525600" placeholder="Custom min" aria-label="Custom ban minutes" data-dev-custom-minutes="${escapeHtml(user.userId || "")}" />
            ${user.isBanned || bannedKeys.has(`device:${user.deviceId}`) || bannedKeys.has(`user:${user.userId}`)
              ? `<button type="button" data-dev-revoke="${escapeHtml(user.userId || "")}" data-dev-device="${escapeHtml(user.deviceId || "")}">Revoke</button>`
              : `<button type="button" data-dev-ban="${escapeHtml(user.userId || "")}" data-dev-device="${escapeHtml(user.deviceId || "")}">Ban device</button>`}
            <button type="button" data-dev-lock-site="${escapeHtml(user.userId || "")}" data-dev-device="${escapeHtml(user.deviceId || "")}">${user.siteLocked ? "Unlock site" : "Lock site"}</button>
            <select aria-label="App lock target" data-dev-app-target="${escapeHtml(user.userId || "")}">
              ${getDevAppLockOptions(user.panel || user.app)}
            </select>
            <button type="button" data-dev-lock-app="${escapeHtml(user.userId || "")}" data-dev-device="${escapeHtml(user.deviceId || "")}">Lock app</button>
            <button type="button" data-dev-unlock-app="${escapeHtml(user.userId || "")}" data-dev-device="${escapeHtml(user.deviceId || "")}">Unlock app</button>
            <input type="number" min="1" max="5000" placeholder="VC" aria-label="Vel Credits amount" data-dev-vc-amount="${escapeHtml(user.userId || "")}" />
            <button type="button" data-dev-grant-vc="${escapeHtml(user.userId || "")}" data-dev-device="${escapeHtml(user.deviceId || "")}">Give VC</button>
            <button type="button" data-dev-screen-request="${escapeHtml(user.userId || "")}" data-dev-device="${escapeHtml(user.deviceId || "")}">Watch screen</button>
          `}
        </div>
      </article>
    `).join("");
  }
  renderDevBans(bans);
  const storageLabel = meta.persistent ? "global storage" : "temporary memory";
  setDevStatus(`${users.length} online - ${storageLabel}.`, meta.persistent ? "live" : "warn");
}

function renderDevBans(bans = []) {
  if (!devBanList) return;
  const activeBans = bans.filter((ban) => ban?.deviceId || ban?.userId);
  devBanList.innerHTML = `
    <p class="section-label">Ban List${activeBans.length ? ` (${activeBans.length})` : ""}</p>
    ${activeBans.length ? activeBans.map((ban) => `
      <article class="dev-ban-row">
        <div>
          <strong>${escapeHtml(ban.username || "Unknown")}</strong>
          <span>${escapeHtml(ban.durationLabel || formatDevBanUntil(ban.expiresAt))} - ${escapeHtml(formatDevBanUntil(ban.expiresAt))}</span>
          <small>${escapeHtml(ban.deviceId ? `Device ${ban.deviceId.slice(0, 12)}` : `User ${ban.userId || "unknown"}`)}</small>
        </div>
        <button type="button" data-dev-revoke-ban="${escapeHtml(ban.userId || "")}" data-dev-device="${escapeHtml(ban.deviceId || "")}">Revoke</button>
      </article>
    `).join("") : '<p class="catalog-empty">No active bans.</p>'}
  `;
}

function setDevUnlocked(unlocked) {
  if (devAuthCard) devAuthCard.hidden = unlocked;
  if (devDashboard) devDashboard.hidden = !unlocked;
  if (!unlocked && devOnlineList) {
    devOnlineList.innerHTML = '<p class="catalog-empty">Unlock Dev Panel to view sessions.</p>';
  }
}

async function fetchDevPresence() {
  if (!devAdminCode || devLoading) return;
  devLoading = true;
  setDevStatus("Loading online users...");
  try {
    const response = await fetch("/api/dev/presence", {
      cache: "no-store",
      headers: {
        "x-vel-admin-code": devAdminCode,
        "x-vel-device-id": velDeviceId
      }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      devAdminCode = "";
      setDevUnlocked(false);
      setDevStatus(data.message || "Admin code required.", "error");
      devCodeInput?.focus({ preventScroll: true });
      return;
    }
    if (!response.ok) throw new Error(data.message || "Dev Panel could not load.");
    setDevUnlocked(true);
    renderDevPanel(Array.isArray(data.users) ? data.users : [], data);
  } catch (error) {
    setDevStatus(error.message || "Dev Panel offline.", "error");
  } finally {
    devLoading = false;
    scheduleDevPoll();
  }
}

function scheduleDevPoll() {
  window.clearTimeout(devPollTimer);
  if (!isDrawerOpen("dev") || !devAdminCode) return;
  devPollTimer = window.setTimeout(fetchDevPresence, DEV_PRESENCE_POLL_MS);
}

function openDevPanel() {
  if (devDeviceReadout) {
    devDeviceReadout.textContent = `This device ID: ${velDeviceId}`;
  }
  if (devAdminCode) {
    setDevUnlocked(true);
    fetchDevPresence();
    return;
  }
  setDevUnlocked(false);
  setDevStatus("Dev Panel locked.");
  window.requestAnimationFrame(() => devCodeInput?.focus({ preventScroll: true }));
}

function lockDevPanel() {
  devAdminCode = "";
  window.clearTimeout(devPollTimer);
  setDevUnlocked(false);
  setDevStatus("Dev Panel locked.");
  if (devCodeInput) devCodeInput.value = "";
  devCodeInput?.focus({ preventScroll: true });
}

async function unlockDevPanel(value = "") {
  const code = String(value || "").trim();
  if (!code) {
    setDevStatus("Enter the admin code.", "warn");
    devCodeInput?.focus({ preventScroll: true });
    return;
  }
  devAdminCode = code;
  if (devCodeInput) devCodeInput.value = "";
  await fetchDevPresence();
}

function getDevIdentityPayload() {
  const user = getLobbyUserPayload();
  return {
    ...user,
    deviceId: velDeviceId,
    deviceName: getVelDeviceName()
  };
}

function clearDevAccessTimer() {
  window.clearTimeout(devAccessTimer);
  devAccessTimer = null;
}

function scheduleDevAccessCheck() {
  clearDevAccessTimer();
  devAccessTimer = window.setTimeout(() => checkDevAccess({ silent: true }), DEV_ACCESS_CHECK_MS);
}

function showDeviceBan(data = {}) {
  clearDevAccessTimer();
  setSessionChatPin("");
  closeAllPanels();
  setVelChatLocked(true, data.message || "This device is banned.");
  if (welcomeGate) welcomeGate.hidden = false;
  document.body.classList.add("is-onboarding", "is-access-blocked");
  if (welcomeNameForm) welcomeNameForm.hidden = true;
  if (welcomePinForm) welcomePinForm.hidden = true;
  typeWelcomeText("Access blocked.");
  const until = data.until ? ` Time left: ${formatDevBanUntil(data.until)}.` : " Permanent ban.";
  setWelcomeStatus(`${data.message || "This device cannot access vel.os."}${until}`, "error");
  scheduleDevAccessCheck();
}

function showDeviceSiteLock(data = {}) {
  clearDevAccessTimer();
  showOwnerLockOverlay("Locked by owner", data.message || "This site is locked by owner.", { mode: "site" });
  scheduleDevAccessCheck();
}

function clearDeviceBanScreen() {
  const wasBlocked = document.body.classList.contains("is-access-blocked");
  const wasOwnerLock = ownerLockMode === "site";
  hideOwnerLockOverlay({ force: true, clearAccess: true });
  if (!wasBlocked || wasOwnerLock) return;
  setWelcomeStatus("Access restored. Enter the PIN again.", "live");
  showWelcomeGate("pin");
}

function handleDevAccessData(data = {}) {
  updateDevLockedApps(data.lockedApps || []);
  if (data.vcGrant?.amount) {
    awardVelCredits(Number(data.vcGrant.amount) || 0);
  }
  if (data.screenRequestAt && Number(data.screenRequestAt) > lastDevScreenRequestAt) {
    lastDevScreenRequestAt = Number(data.screenRequestAt);
    storage.set("vel-dev-screen-request-at", String(lastDevScreenRequestAt));
    showScreenShareRequest({
      sessionId: data.screenSessionId || "",
      requestedAt: lastDevScreenRequestAt
    });
  }
  if (data.status === "banned") {
    showDeviceBan(data);
    return false;
  }
  if (data.status === "locked") {
    showDeviceSiteLock(data);
    return false;
  }
  if (data.status === "kicked") {
    clearVelChatPin(data.message || "Admin kicked this device back to the PIN screen.");
    closeAllPanels();
    showWelcomeGate("pin");
    return false;
  }
  if (data.status === "ok") {
    clearDeviceBanScreen();
  }
  return true;
}

async function checkDevAccess(options = {}) {
  try {
    const response = await fetch("/api/dev/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "check",
        ...getDevIdentityPayload()
      })
    });
    const data = await response.json().catch(() => ({}));
    const allowed = response.ok ? handleDevAccessData(data) : true;
    if (allowed && !options.once) scheduleDevAccessCheck();
    return allowed;
  } catch (error) {
    if (!options.silent) setDevStatus("Access check offline.", "warn");
    if (!options.once) scheduleDevAccessCheck();
    return true;
  }
}

async function sendDevControl(command, payload = {}) {
  if (!devAdminCode) {
    setDevStatus("Unlock Dev Panel first.", "warn");
    return;
  }
  const labels = {
    kick: "Kicking",
    ban: "Banning",
    "revoke-ban": "Revoking",
    "lock-site": "Locking site",
    "unlock-site": "Unlocking site",
    "lock-app": "Locking app",
    "unlock-app": "Unlocking app",
    "grant-vc": "Granting VC",
    "screen-request": "Requesting screen share"
  };
  setDevStatus(`${labels[command] || "Updating"}...`);
  try {
    const response = await fetch("/api/dev/presence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vel-admin-code": devAdminCode,
        "x-vel-device-id": velDeviceId
      },
      body: JSON.stringify({
        action: "control",
        command,
        ...payload
      })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      devAdminCode = "";
      setDevUnlocked(false);
      setDevStatus(data.message || "Admin code required.", "error");
      return;
    }
    if (!response.ok) throw new Error(data.message || "Dev control failed.");
    renderDevPanel(Array.isArray(data.users) ? data.users : [], data);
    const doneLabels = {
      kick: "Device kicked.",
      ban: "Device banned.",
      "revoke-ban": "Ban revoked.",
      "lock-site": "Site locked.",
      "unlock-site": "Site unlocked.",
      "lock-app": "App locked.",
      "unlock-app": "App unlocked.",
      "grant-vc": "VC grant sent.",
      "screen-request": "Screen request sent."
    };
    setDevStatus(doneLabels[command] || "Dev control updated.", data.persistent ? "live" : "warn");
  } catch (error) {
    setDevStatus(error.message || "Dev control failed.", "error");
  }
}

function reportDevPresence() {
  if (!velChatPin || !normalizeVelChatUser(velChatUser)) return;
  if (document.visibilityState === "hidden") return;
  const active = getActiveDevAppInfo();
  fetch("/api/dev/presence", {
    method: "POST",
    headers: getVelChatHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      ...getDevIdentityPayload(),
      ...active,
      path: window.location.pathname || "/"
    }),
    keepalive: true
  })
    .then(async (response) => {
      if (response.ok) return;
      const data = await response.json().catch(() => ({}));
      handleDevAccessData(data);
    })
    .catch(() => {});
}

function sendDevPresenceLeave() {
  if (!velChatPin || !normalizeVelChatUser(velChatUser)) return;
  const payload = {
    action: "leave",
    pin: velChatPin,
    ...getDevIdentityPayload()
  };
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/dev/presence", new Blob([body], { type: "application/json" }));
    return;
  }
  fetch("/api/dev/presence", {
    method: "POST",
    headers: getVelChatHeaders({ "Content-Type": "application/json" }),
    body,
    keepalive: true
  }).catch(() => {});
}

function createScreenSessionId() {
  return `screen-${velDeviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getScreenHeaders(admin = false) {
  return admin
    ? {
      "Content-Type": "application/json",
      "x-vel-admin-code": devAdminCode,
      "x-vel-device-id": velDeviceId
    }
    : getVelChatHeaders({ "Content-Type": "application/json" });
}

async function screenApi(payload = {}, options = {}) {
  const response = await fetch("/api/dev/screen", {
    method: "POST",
    headers: getScreenHeaders(Boolean(options.admin)),
    body: JSON.stringify({
      ...payload,
      ...(options.admin ? { adminDeviceId: velDeviceId } : { pin: velChatPin })
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Screen sharing failed.");
  return data;
}

function setScreenViewerStatus(message = "") {
  if (screenViewerStatus) screenViewerStatus.textContent = message;
}

function stopScreenShare(options = {}) {
  const sessionId = options.sessionId || screenViewer?.dataset.sessionId || pendingScreenShare?.sessionId || "";
  const role = options.role || screenViewer?.dataset.role || (activeScreenShareStream ? "target" : "");
  const admin = role === "admin";
  window.clearInterval(screenSharePollTimer);
  screenSharePollTimer = null;
  if (sessionId && role && !options.silent) {
    screenApi({ action: "signal", sessionId, role, type: "stopped", payload: { reason: options.reason || "ended" } }, { admin }).catch(() => {});
  }
  if (screenSharePeer) {
    screenSharePeer.onicecandidate = null;
    screenSharePeer.ontrack = null;
    screenSharePeer.close();
  }
  screenSharePeer = null;
  screenShareRemoteReady = false;
  screenShareQueuedIce = [];
  screenShareLastSignalId = 0;
  if (activeScreenShareStream) {
    activeScreenShareStream.getTracks().forEach((track) => track.stop());
  }
  activeScreenShareStream = null;
  pendingScreenShare = null;
  if (screenShareRequest) screenShareRequest.hidden = true;
  if (screenViewer) {
    screenViewer.hidden = true;
    delete screenViewer.dataset.sessionId;
    delete screenViewer.dataset.role;
  }
  if (screenViewerVideo) screenViewerVideo.srcObject = null;
}

async function sendScreenSignal(sessionId, role, type, payload = null, admin = false) {
  if (!sessionId || !role || !type) return;
  await screenApi({
    action: "signal",
    sessionId,
    role,
    type,
    payload
  }, { admin });
}

async function addQueuedScreenIce() {
  if (!screenSharePeer || !screenShareRemoteReady) return;
  const queue = [...screenShareQueuedIce];
  screenShareQueuedIce = [];
  for (const candidate of queue) {
    try {
      await screenSharePeer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      screenShareQueuedIce.push(candidate);
    }
  }
}

async function handleScreenSignal(message, role, sessionId, admin) {
  if (!message?.type || !screenSharePeer) return;
  screenShareLastSignalId = Math.max(screenShareLastSignalId, Number(message.id) || 0);
  if (message.type === "offer" && role === "target") {
    await screenSharePeer.setRemoteDescription(new RTCSessionDescription(message.payload));
    screenShareRemoteReady = true;
    await addQueuedScreenIce();
    const answer = await screenSharePeer.createAnswer();
    await screenSharePeer.setLocalDescription(answer);
    await sendScreenSignal(sessionId, "target", "answer", screenSharePeer.localDescription, false);
    return;
  }
  if (message.type === "answer" && role === "admin") {
    await screenSharePeer.setRemoteDescription(new RTCSessionDescription(message.payload));
    screenShareRemoteReady = true;
    await addQueuedScreenIce();
    setScreenViewerStatus("Screen connected.");
    return;
  }
  if (message.type === "ice" && message.payload) {
    if (!screenShareRemoteReady) {
      screenShareQueuedIce.push(message.payload);
      return;
    }
    try {
      await screenSharePeer.addIceCandidate(new RTCIceCandidate(message.payload));
    } catch (error) {
      screenShareQueuedIce.push(message.payload);
    }
    return;
  }
  if (message.type === "accepted" && role === "admin") {
    setScreenViewerStatus("Approved. Connecting...");
    return;
  }
  if (message.type === "stopped") {
    setScreenViewerStatus("Screen sharing stopped.");
    if (role === "target") stopScreenShare({ silent: true });
  }
}

async function pollScreenSession(sessionId, role, admin = false) {
  if (!sessionId || !screenSharePeer) return;
  try {
    const data = await screenApi({
      action: "poll",
      sessionId,
      role,
      after: screenShareLastSignalId
    }, { admin });
    for (const message of data.messages || []) {
      await handleScreenSignal(message, role, sessionId, admin);
    }
    if (role === "admin" && data.status === "requested") {
      setScreenViewerStatus("Waiting for approval...");
    }
  } catch (error) {
    if (role === "admin") setScreenViewerStatus(error.message || "Screen connection waiting...");
  }
}

function startScreenPolling(sessionId, role, admin = false) {
  window.clearInterval(screenSharePollTimer);
  screenSharePollTimer = window.setInterval(() => {
    pollScreenSession(sessionId, role, admin);
  }, 900);
  pollScreenSession(sessionId, role, admin);
}

async function startAdminScreenViewer(target = {}) {
  if (!devAdminCode) {
    setDevStatus("Unlock Dev Panel first.", "warn");
    return;
  }
  if (!("RTCPeerConnection" in window)) {
    setDevStatus("This browser cannot watch screen shares.", "error");
    return;
  }
  stopScreenShare({ silent: true });
  const sessionId = createScreenSessionId();
  const targetName = target.username || "this device";
  try {
    await screenApi({
      action: "reset",
      sessionId,
      targetUserId: target.userId || "",
      targetDeviceId: target.deviceId || "",
      targetName
    }, { admin: true });
    if (screenViewer) {
      screenViewer.hidden = false;
      screenViewer.dataset.sessionId = sessionId;
      screenViewer.dataset.role = "admin";
    }
    if (screenViewerTitle) screenViewerTitle.textContent = `Watching ${targetName}`;
    setScreenViewerStatus("Waiting for approval...");
    screenSharePeer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    screenSharePeer.onicecandidate = (event) => {
      if (event.candidate) {
        sendScreenSignal(sessionId, "admin", "ice", event.candidate.toJSON(), true).catch(() => {});
      }
    };
    screenSharePeer.ontrack = (event) => {
      if (screenViewerVideo && event.streams?.[0]) {
        screenViewerVideo.srcObject = event.streams[0];
        screenViewerVideo.play?.().catch(() => {});
      }
      setScreenViewerStatus("Screen connected.");
    };
    screenSharePeer.onconnectionstatechange = () => {
      const state = screenSharePeer?.connectionState || "";
      if (state === "connected") setScreenViewerStatus("Screen connected.");
      if (state === "failed" || state === "disconnected") setScreenViewerStatus("Connection dropped.");
    };
    const offer = await screenSharePeer.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: false });
    await screenSharePeer.setLocalDescription(offer);
    await sendScreenSignal(sessionId, "admin", "offer", screenSharePeer.localDescription, true);
    startScreenPolling(sessionId, "admin", true);
    await sendDevControl("screen-request", {
      targetUserId: target.userId || "",
      targetDeviceId: target.deviceId || "",
      sessionId
    });
  } catch (error) {
    stopScreenShare({ silent: true });
    setDevStatus(error.message || "Could not start screen watch.", "error");
  }
}

function showScreenShareRequest(details = {}) {
  pendingScreenShare = {
    sessionId: details.sessionId || "",
    requestedAt: details.requestedAt || Date.now()
  };
  if (!screenShareRequest) return;
  screenShareRequest.hidden = false;
}

async function acceptScreenShareRequest() {
  if (!pendingScreenShare?.sessionId) {
    if (screenShareRequest) screenShareRequest.hidden = true;
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia || !("RTCPeerConnection" in window)) {
    window.alert("This device does not support browser screen sharing.");
    return;
  }
  const sessionId = pendingScreenShare.sessionId;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });
    stopScreenShare({ silent: true });
    activeScreenShareStream = stream;
    if (screenShareRequest) screenShareRequest.hidden = true;
    screenSharePeer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => stopScreenShare({ sessionId, role: "target", reason: "stopped-sharing" }));
      screenSharePeer.addTrack(track, stream);
    });
    screenSharePeer.onicecandidate = (event) => {
      if (event.candidate) {
        sendScreenSignal(sessionId, "target", "ice", event.candidate.toJSON(), false).catch(() => {});
      }
    };
    await sendScreenSignal(sessionId, "target", "accepted", { deviceId: velDeviceId }, false);
    startScreenPolling(sessionId, "target", false);
  } catch (error) {
    if (String(error?.name || "").toLowerCase() !== "notallowederror") {
      window.alert(error.message || "Could not share the screen.");
    }
  }
}

function dismissScreenShareRequest() {
  const sessionId = pendingScreenShare?.sessionId || "";
  if (sessionId) {
    sendScreenSignal(sessionId, "target", "stopped", { reason: "dismissed" }, false).catch(() => {});
  }
  pendingScreenShare = null;
  if (screenShareRequest) screenShareRequest.hidden = true;
}

function cleanLobbyName(value = "") {
  return String(value || "")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28) || "Main";
}

function formatLobbyTime(value = 0) {
  if (!value) return "Not saved yet";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  } catch (error) {
    return "Recently";
  }
}

function setLobbyStatus(message = "", tone = "") {
  if (!lobbyStatus) return;
  lobbyStatus.textContent = message;
  lobbyStatus.dataset.tone = tone;
}

function getLobbyUserPayload() {
  const user = normalizeVelChatUser(velChatUser);
  return {
    userId: user?.id || "guest",
    username: user?.username || "Guest"
  };
}

function getLobbyCollaborators() {
  const user = getLobbyUserPayload();
  const collaborators = Array.isArray(lobbyState.lobbyData?.sketch?.collaborators)
    ? lobbyState.lobbyData.sketch.collaborators
    : [];
  return [...collaborators, user]
    .filter((person) => person?.userId && person?.username)
    .filter((person, index, people) => people.findIndex((item) => item.userId === person.userId) === index)
    .slice(0, 8);
}

function formatLobbyPeople(people = [], fallback = "Solo sketch") {
  const names = people
    .map((person) => person?.username)
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index);
  if (!names.length) return fallback;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} + ${names[names.length - 1]}`;
}

function renderLobbyCollaborators() {
  if (!lobbyCollaborators) return;
  const collaborators = getLobbyCollaborators();
  lobbyCollaborators.innerHTML = `
    <div>
      <strong>${escapeHtml(collaborators.length > 1 ? "Collab sketch" : "Solo sketch")}</strong>
      <span>${escapeHtml(formatLobbyPeople(collaborators))}</span>
    </div>
    <span>${collaborators.length} artist${collaborators.length === 1 ? "" : "s"}</span>
  `;
}

function renderLobbyInviteInbox() {
  if (!lobbyInviteInbox) return;
  const invites = Array.isArray(lobbyState.invites) ? lobbyState.invites : [];
  const cards = invites.map((invite) => `
    <article class="lobby-invite-card">
      <div>
        <strong>${escapeHtml(invite.fromUsername || "Someone")}</strong>
        <span>Invite to ${escapeHtml(invite.lobby || "Notebook")} - ${escapeHtml(invite.prompt || "Sketch together")}</span>
      </div>
      <div class="lobby-invite-actions">
        <button type="button" data-lobby-invite-accept="${escapeHtml(invite.id)}">Accept</button>
        <button type="button" data-lobby-invite-decline="${escapeHtml(invite.id)}">Decline</button>
      </div>
    </article>
  `).join("");
  lobbyInviteInbox.innerHTML = `
    <p class="section-label">Invite Bin${invites.length ? ` (${invites.length})` : ""}</p>
    ${cards || '<p class="tiny-note">No sketch invites yet. When someone invites you, it lands here.</p>'}
  `;
}

function renderLobbyUserList() {
  if (!lobbyUserList) return;
  const current = getLobbyUserPayload();
  const users = (Array.isArray(lobbyState.users) ? lobbyState.users : [])
    .filter((user) => user?.userId && user.userId !== current.userId);
  if (!users.length) {
    lobbyUserList.innerHTML = '<p class="tiny-note">No one else online.</p>';
    return;
  }
  lobbyUserList.innerHTML = users.map((user) => `
    <article class="lobby-user-card">
      <div>
        <strong>${escapeHtml(user.username || "Guest")}</strong>
        <span>${escapeHtml(user.lobby ? `In ${user.lobby}` : "Online")}</span>
      </div>
      <button type="button" data-lobby-invite-user="${escapeHtml(user.userId)}">Invite</button>
    </article>
  `).join("");
}

function setLobbyInvitePanel(open) {
  lobbyState.inviteOpen = Boolean(open);
  if (lobbyInvitePanel) lobbyInvitePanel.hidden = !lobbyState.inviteOpen;
  if (lobbyInviteToggle) {
    lobbyInviteToggle.setAttribute("aria-expanded", String(lobbyState.inviteOpen));
    lobbyInviteToggle.textContent = lobbyState.inviteOpen ? "Hide Invite" : "Invite";
  }
  if (lobbyState.inviteOpen) renderLobbyUserList();
}

function scheduleLobbyPoll() {
  window.clearTimeout(lobbyPollTimer);
  if (!isDrawerOpen("lobbies") || !velChatPin) return;
  lobbyPollTimer = window.setTimeout(() => loadLobbyState({ silent: true }), LOBBY_POLL_MS);
}

function setLobbyMode(mode = "notes") {
  lobbyState.mode = mode === "sketch" ? "sketch" : "notes";
  storage.set("vel-lobby-mode", lobbyState.mode);
  lobbyModeTabs?.querySelectorAll("[data-lobby-mode]").forEach((button) => {
    const active = button.dataset.lobbyMode === lobbyState.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (lobbyNotesView) lobbyNotesView.hidden = lobbyState.mode !== "notes";
  if (lobbySketchView) lobbySketchView.hidden = lobbyState.mode !== "sketch";
  if (lobbyState.mode === "sketch") {
    window.requestAnimationFrame(resizeLobbyCanvas);
  }
}

function renderLobbyPills() {
  if (!lobbyPills) return;
  const names = [...new Set(["Main", "Games", "Memes", cleanLobbyName(lobbyState.lobby), ...lobbyState.lobbies.map((item) => cleanLobbyName(item.name))])].slice(0, 10);
  lobbyPills.innerHTML = names.map((name) => `
    <button class="${name.toLowerCase() === cleanLobbyName(lobbyState.lobby).toLowerCase() ? "is-active" : ""}" type="button" data-lobby-name="${escapeHtml(name)}">${escapeHtml(name)}</button>
  `).join("");
}

function renderLobbyState() {
  setLobbyMode(lobbyState.mode);
  renderLobbyPills();
  const lobby = lobbyState.lobbyData;
  const lobbyName = cleanLobbyName(lobby?.name || lobbyState.lobby);
  if (lobbyNameInput) lobbyNameInput.value = lobbyName;
  if (lobbyNoteTitle) lobbyNoteTitle.textContent = `${lobbyName} Notes`;
  if (lobbyNoteText && document.activeElement !== lobbyNoteText) {
    lobbyNoteText.value = lobby?.note?.content || "";
  }
  if (lobbyNoteMeta) {
    lobbyNoteMeta.textContent = lobby?.note?.updatedAt
      ? `Last saved by ${lobby.note.updatedBy || "Guest"} on ${formatLobbyTime(lobby.note.updatedAt)}.`
      : "Notes save for everyone in this room.";
  }
  if (lobbySketchTitle) {
    lobbySketchTitle.textContent = lobby?.sketch?.prompt || "Draw the prompt";
  }
  if (lobbyPromptInput && document.activeElement !== lobbyPromptInput) {
    lobbyPromptInput.value = lobby?.sketch?.prompt || "";
  }
  renderLobbyInviteInbox();
  renderLobbyUserList();
  renderLobbyCollaborators();
  renderSharedLobbyCanvas();
  renderLobbyGallery();
}

async function loadLobbyState(options = {}) {
  if (!lobbyPills || lobbyState.loading || !velChatPin) {
    renderLobbyState();
    if (!velChatPin) setLobbyStatus("Enter the startup PIN to sync Notebook.", "warn");
    return;
  }
  lobbyState.loading = true;
  if (!options.silent) setLobbyStatus("Loading Notebook...");
  try {
    const user = getLobbyUserPayload();
    const params = new URLSearchParams({
      lobby: cleanLobbyName(lobbyState.lobby),
      userId: user.userId,
      username: user.username
    });
    const response = await fetch(`/api/lobbies?${params.toString()}`, {
      cache: "no-store",
      headers: getVelChatHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearVelChatPin(data.message || "Wrong PIN. Try again.");
      return;
    }
    if (!response.ok) throw new Error(data.message || "Notebook could not load.");
    lobbyState.lobbyData = data.lobby || null;
    lobbyState.lobbies = Array.isArray(data.lobbies) ? data.lobbies : [];
    lobbyState.users = Array.isArray(data.users) ? data.users : [];
    lobbyState.invites = Array.isArray(data.invites) ? data.invites : [];
    if (!options.silent) {
      setLobbyStatus(data.persistent ? "Notebook synced globally." : "Notebook is temporary until Redis is connected.", data.persistent ? "live" : "warn");
    }
  } catch (error) {
    setLobbyStatus(error.message || "Notebook offline.", "error");
  } finally {
    lobbyState.loading = false;
    renderLobbyState();
    scheduleLobbyPoll();
  }
}

async function postLobbyAction(payload = {}, message = "Lobby saved.", options = {}) {
  if (!velChatPin) {
    setLobbyStatus("Enter the startup PIN to use Notebook.", "warn");
    showWelcomeGate(velChatUser ? "pin" : "name");
    return null;
  }
  if (!options.silent) setLobbyStatus("Updating Notebook...");
  const body = {
    lobby: cleanLobbyName(lobbyState.lobby),
    ...getLobbyUserPayload(),
    ...payload
  };
  try {
    const response = await fetch("/api/lobbies", {
      method: "POST",
      headers: getVelChatHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearVelChatPin(data.message || "Wrong PIN. Try again.");
      return null;
    }
    if (!response.ok) throw new Error(data.message || "Notebook could not save.");
    lobbyState.lobbyData = data.lobby || null;
    lobbyState.lobbies = Array.isArray(data.lobbies) ? data.lobbies : [];
    lobbyState.users = Array.isArray(data.users) ? data.users : [];
    lobbyState.invites = Array.isArray(data.invites) ? data.invites : [];
    if (!options.silent) setLobbyStatus(message, data.persistent ? "live" : "warn");
    if (!options.skipRender) renderLobbyState();
    return data;
  } catch (error) {
    setLobbyStatus(error.message || "Notebook update failed.", "error");
    return null;
  }
}

function joinLobby(name = "") {
  lobbyState.lobby = cleanLobbyName(name);
  storage.set("vel-lobby-name", lobbyState.lobby);
  loadLobbyState();
}

function saveLobbyNote() {
  postLobbyAction({
    action: "note",
    content: lobbyNoteText?.value || ""
  }, "Note saved for this lobby.");
}

function clearLobbyNote() {
  if (!window.confirm(`Clear the note in ${cleanLobbyName(lobbyState.lobby)}?`)) return;
  postLobbyAction({ action: "clear-note" }, "Lobby note cleared.");
}

function setLobbyPrompt(prompt = "") {
  postLobbyAction({
    action: "prompt",
    prompt
  }, "New prompt set. Gallery reset.");
}

function clearLobbySketchGallery() {
  if (!window.confirm(`Clear the Sketch Phone gallery in ${cleanLobbyName(lobbyState.lobby)}?`)) return;
  postLobbyAction({ action: "clear-sketch" }, "Sketch gallery cleared.");
}

function sendLobbyInvite(targetUserId = "") {
  const id = String(targetUserId || "").trim();
  if (!id) return;
  postLobbyAction({
    action: "invite",
    targetUserId: id
  }, "Invite sent to their bin.");
}

function respondLobbyInvite(inviteId = "", accepted = false) {
  const id = String(inviteId || "").trim();
  if (!id) return;
  postLobbyAction({
    action: "invite-response",
    inviteId: id,
    accepted: Boolean(accepted)
  }, accepted ? "Invite accepted. You joined their sketch." : "Invite declined.").then((data) => {
    if (!data) return;
    if (accepted && data.lobby?.name) {
      lobbyState.lobby = cleanLobbyName(data.lobby.name);
      storage.set("vel-lobby-name", lobbyState.lobby);
      setLobbyMode("sketch");
    }
    renderLobbyState();
  });
}

function deleteLobbySketch(entryId = "") {
  const id = String(entryId || "").trim();
  if (!id) return;
  if (!window.confirm("Delete this sketch from the Notebook gallery?")) return;
  postLobbyAction({
    action: "delete-entry",
    entryId: id
  }, "Sketch deleted.");
}

function ensureLobbyCanvasPaper() {
  if (!lobbySketchCanvas) return;
  const ctx = lobbySketchCanvas.getContext("2d");
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  if (pixel[3] === 0) {
    ctx.fillStyle = "#f6f6f6";
    ctx.fillRect(0, 0, lobbySketchCanvas.width, lobbySketchCanvas.height);
  }
}

function paintLobbyCanvasBlank() {
  if (!lobbySketchCanvas) return;
  const ctx = lobbySketchCanvas.getContext("2d");
  ctx.fillStyle = "#f6f6f6";
  ctx.fillRect(0, 0, lobbySketchCanvas.width, lobbySketchCanvas.height);
}

function clearLobbyCanvas() {
  paintLobbyCanvasBlank();
  lobbyState.canvasSignature = "";
}

function resizeLobbyCanvas() {
  if (!lobbySketchCanvas) return;
  ensureLobbyCanvasPaper();
}

function getLobbyStrokeSignature() {
  const sketch = lobbyState.lobbyData?.sketch || {};
  const strokes = Array.isArray(sketch.strokes) ? sketch.strokes : [];
  const lastStroke = strokes[strokes.length - 1];
  return `${sketch.canvasUpdatedAt || 0}:${strokes.length}:${lastStroke?.id || ""}`;
}

function getLobbyCanvasPoint(event) {
  const rect = lobbySketchCanvas.getBoundingClientRect();
  const scaleX = lobbySketchCanvas.width / rect.width;
  const scaleY = lobbySketchCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function drawLobbyLineWithStyle(from, to, style = {}) {
  if (!lobbySketchCanvas || !from || !to) return;
  const ctx = lobbySketchCanvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = style.color || "#050505";
  ctx.lineWidth = Number(style.size || 8);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawLobbyLine(from, to) {
  drawLobbyLineWithStyle(from, to, {
    color: lobbyBrushColor?.value || "#050505",
    size: Number(lobbyBrushSize?.value || 8)
  });
}

function renderSharedLobbyCanvas(force = false) {
  if (!lobbySketchCanvas || lobbyState.drawing) return;
  const signature = getLobbyStrokeSignature();
  if (!force && signature === lobbyState.canvasSignature) return;
  paintLobbyCanvasBlank();
  const strokes = Array.isArray(lobbyState.lobbyData?.sketch?.strokes)
    ? lobbyState.lobbyData.sketch.strokes
    : [];
  strokes.forEach((stroke) => {
    const points = Array.isArray(stroke.points) ? stroke.points : [];
    for (let index = 1; index < points.length; index += 1) {
      drawLobbyLineWithStyle(points[index - 1], points[index], {
        color: stroke.color || "#050505",
        size: Number(stroke.size || 8)
      });
    }
  });
  lobbyState.canvasSignature = signature;
}

function startLobbyDrawing(event) {
  if (!lobbySketchCanvas) return;
  event.preventDefault();
  ensureLobbyCanvasPaper();
  lobbyState.drawing = true;
  lobbyState.lastPoint = getLobbyCanvasPoint(event);
  lobbyState.currentStroke = {
    color: lobbyBrushColor?.value || "#050505",
    size: Number(lobbyBrushSize?.value || 8),
    points: [lobbyState.lastPoint]
  };
  lobbySketchCanvas.setPointerCapture?.(event.pointerId);
}

function moveLobbyDrawing(event) {
  if (!lobbyState.drawing) return;
  event.preventDefault();
  const nextPoint = getLobbyCanvasPoint(event);
  drawLobbyLine(lobbyState.lastPoint, nextPoint);
  if (lobbyState.currentStroke?.points && lobbyState.currentStroke.points.length < 180) {
    lobbyState.currentStroke.points.push(nextPoint);
  }
  lobbyState.lastPoint = nextPoint;
}

function stopLobbyDrawing(event) {
  if (!lobbyState.drawing) return;
  event.preventDefault();
  const stroke = lobbyState.currentStroke;
  lobbyState.drawing = false;
  lobbyState.lastPoint = null;
  lobbyState.currentStroke = null;
  if (stroke?.points?.length > 1) {
    postLobbyAction({
      action: "stroke",
      stroke
    }, "Shared stroke synced.", { silent: true });
  }
}

function clearSharedLobbyCanvas() {
  clearLobbyCanvas();
  postLobbyAction({
    action: "clear-canvas"
  }, "Shared canvas cleared.");
}

function submitLobbySketch() {
  if (!lobbySketchCanvas) return;
  ensureLobbyCanvasPaper();
  const image = lobbySketchCanvas.toDataURL("image/jpeg", 0.72);
  postLobbyAction({
    action: "entry",
    image,
    caption: lobbySketchCaption?.value || ""
  }, "Sketch posted to the lobby.").then((data) => {
    if (!data) return;
    if (lobbySketchCaption) lobbySketchCaption.value = "";
    clearLobbyCanvas();
  });
}

function renderLobbyGallery() {
  if (!lobbySketchGallery) return;
  const entries = Array.isArray(lobbyState.lobbyData?.sketch?.entries)
    ? lobbyState.lobbyData.sketch.entries
    : [];
  if (!entries.length) {
    lobbySketchGallery.innerHTML = '<p class="catalog-empty">No sketches yet. Draw one and post it.</p>';
    return;
  }
  lobbySketchGallery.innerHTML = entries.map((entry) => `
    <article class="lobby-sketch-card">
      <img src="${escapeHtml(entry.image)}" alt="Sketch by ${escapeHtml(entry.username || "Guest")}" loading="lazy" />
      <div class="lobby-sketch-card-head">
        <strong>${escapeHtml(formatLobbyPeople(entry.authors, entry.username || "Guest"))}</strong>
        <button class="lobby-sketch-delete" type="button" data-lobby-delete-entry="${escapeHtml(entry.id)}" aria-label="Delete sketch">Delete</button>
      </div>
      ${entry.caption ? `<p>${escapeHtml(entry.caption)}</p>` : ""}
      <span>${escapeHtml(formatLobbyTime(entry.createdAt))}</span>
    </article>
  `).join("");
}

function formatYouTubeDate(value = "") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  } catch (error) {
    return "";
  }
}

function getYouTubeWatchUrl(video = youtubeAppState.currentVideo) {
  return video?.id
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`
    : "https://www.youtube.com";
}

function getYouTubeEmbedHost() {
  return youtubeAppState.embedHost === "standard"
    ? "www.youtube.com"
    : "www.youtube-nocookie.com";
}

function getYouTubeEmbedModeLabel() {
  return youtubeAppState.embedHost === "standard" ? "standard" : "privacy";
}

function getNextYouTubeEmbedModeLabel() {
  return youtubeAppState.embedHost === "standard" ? "privacy" : "standard";
}

function getYouTubeEmbedUrl(videoId) {
  const params = new URLSearchParams({
    autoplay: "1",
    controls: "1",
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1"
  });
  if (location.origin && /^https?:/i.test(location.origin)) {
    params.set("origin", location.origin);
  }
  return `https://${getYouTubeEmbedHost()}/embed/${encodeURIComponent(videoId)}?${params}`;
}

function pauseYouTubeAppPlayback() {
  const iframe = youtubeFrameWrap?.querySelector("iframe");
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(JSON.stringify({
      event: "command",
      func: "pauseVideo",
      args: []
    }), "*");
  } catch (error) {
    return;
  }
}

function clearYouTubePlayerHintTimer() {
  if (!youtubeAppPlayerHintTimer) return;
  window.clearTimeout(youtubeAppPlayerHintTimer);
  youtubeAppPlayerHintTimer = null;
}

function showYouTubePlayerHint(delay = 3200) {
  clearYouTubePlayerHintTimer();
  if (youtubeAppState.hintDismissed) return;
  youtubeAppPlayerHintTimer = window.setTimeout(() => {
    if (youtubeAppState.hintDismissed) return;
    youtubeFrameWrap?.querySelector("[data-youtube-player-hint]")?.classList.add("is-visible");
  }, delay);
}

function dismissYouTubePlayerHint() {
  youtubeAppState.hintDismissed = true;
  clearYouTubePlayerHintTimer();
  youtubeFrameWrap?.querySelector("[data-youtube-player-hint]")?.classList.remove("is-visible");
}

function showYouTubeLaunch() {
  if (!youtubeLaunch) return;
  window.clearTimeout(youtubeLaunchTimer);
  youtubeLaunch.classList.remove("is-hiding");
  youtubeLaunch.hidden = false;
  youtubeLaunch.setAttribute("aria-hidden", "false");
  youtubeLaunchTimer = window.setTimeout(() => {
    youtubeLaunch.classList.add("is-hiding");
    window.setTimeout(() => {
      youtubeLaunch.hidden = true;
      youtubeLaunch.setAttribute("aria-hidden", "true");
      youtubeLaunch.classList.remove("is-hiding");
    }, 420);
  }, 1450);
}

function toggleYouTubeEmbedHost() {
  youtubeAppState.embedHost = youtubeAppState.embedHost === "standard" ? "privacy" : "standard";
  storage.set("vel-youtube-embed-host", youtubeAppState.embedHost);
  youtubeAppState.hintDismissed = false;
  renderYouTubePlayer();
}

function cleanProviderMessage(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isQuotaMessage(value = "") {
  return /quota|exceeded|rate limit|daily limit/i.test(String(value || ""));
}

function getYouTubeFetchError(error) {
  const message = cleanProviderMessage(error?.message || "");
  if (location.protocol === "file:") {
    return "YouTube search needs the vel.os server. Run npm start and open http://localhost:3000 instead of opening index.html directly.";
  }
  if (/failed to fetch|load failed|networkerror/i.test(message)) {
    return "YouTube search API did not respond. Make sure /api/youtube/search exists and YOUTUBE_API_KEY is set in your hosting environment.";
  }
  if (isQuotaMessage(message)) {
    return "YouTube API quota is used up right now. Search/home lists will come back when Google resets the API quota, but videos already in history can still play.";
  }
  return message || "YouTube search could not load.";
}

function getYouTubeSearchCacheKey(query, pageToken = "", options = {}) {
  return [
    normalizeYouTubeTopic(query) || String(query || "").trim().toLowerCase(),
    pageToken || "first",
    options.duration || "any"
  ].join("::");
}

function getCachedYouTubeSearch(query, pageToken = "", options = {}, allowStale = false) {
  const key = getYouTubeSearchCacheKey(query, pageToken, options);
  const cached = youtubeSearchCache[key];
  if (!cached?.data?.items) return null;
  const age = Date.now() - (cached.savedAt || 0);
  if (!allowStale && age > YOUTUBE_SEARCH_CACHE_TTL) return null;
  return {
    ...cached.data,
    fromCache: true
  };
}

function saveCachedYouTubeSearch(query, pageToken = "", options = {}, data = {}) {
  const key = getYouTubeSearchCacheKey(query, pageToken, options);
  youtubeSearchCache[key] = {
    savedAt: Date.now(),
    data: {
      items: Array.isArray(data.items) ? data.items : [],
      nextPageToken: data.nextPageToken || ""
    }
  };

  const entries = Object.entries(youtubeSearchCache)
    .sort((a, b) => (b[1]?.savedAt || 0) - (a[1]?.savedAt || 0))
    .slice(0, YOUTUBE_SEARCH_CACHE_LIMIT);
  youtubeSearchCache = Object.fromEntries(entries);
  storage.set(YOUTUBE_SEARCH_CACHE_KEY, JSON.stringify(youtubeSearchCache));
}

function setYouTubeApiCooldown(reason = "") {
  if (!isQuotaMessage(reason)) return;
  storage.set(YOUTUBE_API_COOLDOWN_KEY, String(Date.now() + YOUTUBE_API_COOLDOWN_MS));
}

function getYouTubeApiCooldownMessage() {
  const cooldownUntil = storage.get(YOUTUBE_API_COOLDOWN_KEY, 0);
  if (!cooldownUntil || Date.now() > cooldownUntil) return "";
  return "YouTube API quota is cooling down right now, so vel.os is avoiding extra API calls for a bit.";
}

function normalizeYouTubeTopic(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !YOUTUBE_TOPIC_STOP_WORDS.has(word))
    .slice(0, 3)
    .join(" ")
    .trim();
}

function titleCaseYouTubeTopic(topic = "") {
  return topic.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function inferYouTubeTopic(video = {}) {
  const queryTopic = normalizeYouTubeTopic(youtubeAppState.query);
  if (youtubeAppState.mode === "search" && queryTopic && !YOUTUBE_GENERIC_QUERIES.has(queryTopic)) return queryTopic;

  const text = `${video.topic || ""} ${video.title || ""} ${video.description || ""} ${video.channel || ""}`.toLowerCase();
  const knownTopic = YOUTUBE_INTEREST_TERMS.find((term) => text.includes(term));
  if (knownTopic) return knownTopic;

  return normalizeYouTubeTopic(video.title || video.channel || "youtube");
}

function persistYouTubeHistory() {
  storage.set(YOUTUBE_HISTORY_KEY, JSON.stringify(youtubeWatchHistory));
}

function persistYouTubeFavorites() {
  storage.set(YOUTUBE_FAVORITES_KEY, JSON.stringify(youtubeFavorites.slice(0, YOUTUBE_FAVORITES_LIMIT)));
}

function persistYouTubeInterests() {
  storage.set(YOUTUBE_INTEREST_KEY, JSON.stringify(youtubeInterestTopics.slice(0, YOUTUBE_INTEREST_LIMIT)));
}

function getYouTubeListItem(video = {}, extra = {}) {
  return {
    id: video.id,
    title: video.title || "YouTube Video",
    channel: video.channel || "YouTube",
    thumbnail: video.thumbnail || "",
    publishedAt: video.publishedAt || "",
    description: video.description || "",
    topic: normalizeYouTubeTopic(video.topic || video.recommendationTopic) || inferYouTubeTopic(video),
    ...extra
  };
}

function isYouTubeFavorite(videoId) {
  return Boolean(videoId && youtubeFavorites.some((item) => item.id === videoId));
}

function isYouTubeGlobalFavorite(videoId) {
  return Boolean(videoId && (youtubeAppState.mode === "global" || youtubeGlobalIds.has(videoId)));
}

function addYouTubeFavorite(video) {
  if (!video?.id || isYouTubeFavorite(video.id)) return false;
  const favorite = getYouTubeListItem(video, { savedAt: Date.now() });
  youtubeFavorites = [
    favorite,
    ...youtubeFavorites.filter((item) => item.id !== favorite.id)
  ].slice(0, YOUTUBE_FAVORITES_LIMIT);
  persistYouTubeFavorites();
  recordYouTubeInterest(favorite.topic || favorite.title || favorite.channel, 2, "favorite");
  return true;
}

function saveYouTubeFavorite(video) {
  const added = addYouTubeFavorite(video);
  if (added) {
    renderYouTubeResults();
  }
  renderYouTubeStatus();
  return added;
}

function removeYouTubeFavorite(videoId) {
  const id = String(videoId || "");
  if (!id || !isYouTubeFavorite(id)) return false;
  youtubeFavorites = youtubeFavorites.filter((item) => item.id !== id);
  persistYouTubeFavorites();
  if (youtubeAppState.mode === "favorites") {
    youtubeAppState.results = [...youtubeFavorites];
  }
  renderYouTubeResults();
  renderYouTubeStatus();
  return true;
}

function toggleYouTubeFavorite(video) {
  const id = video?.id;
  if (!id) return false;
  return isYouTubeFavorite(id)
    ? removeYouTubeFavorite(id)
    : saveYouTubeFavorite(video);
}

async function saveYouTubeVideoToGlobal(video, options = {}) {
  const id = video?.id || extractYouTubeId(options.value || "");
  if (!id || youtubeGlobalSavingIds.has(id) || isYouTubeGlobalFavorite(id)) return false;

  const known = findKnownYouTubeVideo(id) || video || {};
  const url = options.value || `https://www.youtube.com/watch?v=${id}`;
  youtubeGlobalSavingIds.add(id);
  youtubeGlobalMessage = "Saving video to Global Favs...";
  renderYouTubeStatus();
  renderYouTubeResults();

  try {
    const response = await fetch("/api/youtube/global", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        url,
        title: known.title || "Shared YouTube Video",
        channel: known.channel || "Global Favs",
        thumbnail: known.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        publishedAt: known.publishedAt || "",
        description: known.description || "Saved by someone on vel.os.",
        importType: "video"
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.message || data.error || "Could not save that YouTube link.";
      throw new Error(`${detail} (${response.status})`);
    }

    const items = Array.isArray(data.items) ? data.items : [data.item].filter(Boolean);
    items.forEach((item) => {
      if (item?.id) youtubeGlobalIds.add(item.id);
    });
    youtubeGlobalIds.add(id);
    youtubeGlobalMessage = ["kv", "redis"].includes(data.storage)
      ? "Saved to Global Favs forever."
      : "Saved to Global Favs.";

    if (options.switchToGlobal) {
      if (youtubeGlobalInput) youtubeGlobalInput.value = "";
      youtubeAppState.results = items.length ? items : [data.item, ...youtubeAppState.results].filter(Boolean);
      youtubeAppState.mode = "global";
    } else if (youtubeAppState.mode === "global" && items.length) {
      youtubeAppState.results = items;
    }
    return true;
  } catch (error) {
    youtubeGlobalMessage = error.message || "Could not save that YouTube link.";
    return false;
  } finally {
    youtubeGlobalSavingIds.delete(id);
    renderYouTubeStatus();
    renderYouTubeResults();
  }
}

async function removeYouTubeVideoFromGlobal(videoId) {
  const id = String(videoId || "");
  if (!id || youtubeGlobalSavingIds.has(id)) return false;

  youtubeGlobalSavingIds.add(id);
  youtubeGlobalMessage = "Removing video from Global Favs...";
  renderYouTubeStatus();
  renderYouTubeResults();

  try {
    const response = await fetch("/api/youtube/global", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.message || data.error || "Could not remove that global favorite.";
      throw new Error(`${detail} (${response.status})`);
    }

    youtubeGlobalIds.delete(id);
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length || youtubeAppState.mode === "global") {
      youtubeGlobalIds = new Set(items.map((item) => item?.id).filter(Boolean));
    }
    if (youtubeAppState.mode === "global") {
      youtubeAppState.results = items;
    }
    youtubeGlobalMessage = "Removed from Global Favs.";
    return true;
  } catch (error) {
    youtubeGlobalMessage = error.message || "Could not remove that global favorite.";
    return false;
  } finally {
    youtubeGlobalSavingIds.delete(id);
    renderYouTubeStatus();
    renderYouTubeResults();
  }
}

async function toggleYouTubeGlobalFavorite(video, options = {}) {
  const id = video?.id || extractYouTubeId(options.value || "");
  if (!id || youtubeGlobalSavingIds.has(id)) return false;
  if (isYouTubeGlobalFavorite(id)) {
    return removeYouTubeVideoFromGlobal(id);
  }
  return saveYouTubeVideoToGlobal(video, options);
}

function getYouTubeDisplayResults() {
  if (youtubeAppState.mode === "history") return youtubeWatchHistory;
  if (youtubeAppState.mode === "favorites") return youtubeFavorites;
  return youtubeAppState.results;
}

function findKnownYouTubeVideo(id) {
  return [
    youtubeAppState.currentVideo,
    ...youtubeAppState.results,
    ...youtubeWatchHistory,
    ...youtubeFavorites
  ].filter(Boolean).find((item) => item.id === id);
}

function updateYouTubeGlobalImportUi() {
  const mode = youtubeGlobalImportType || "video";
  youtubeGlobalModeButtons.forEach((button) => {
    const active = button.dataset.youtubeGlobalType === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (!youtubeGlobalInput) return;
  youtubeGlobalInput.placeholder = mode === "channel"
    ? "Paste a channel link, like youtube.com/@CboysTV/videos"
    : "Paste a YouTube video link for everyone";
  youtubeGlobalInput.setAttribute(
    "aria-label",
    mode === "channel"
      ? "Paste a YouTube channel link to import recent long-form uploads"
      : "Paste a YouTube link for global favorites"
  );
}

function saveAllVisibleYouTubeVideos() {
  if (youtubeAppState.mode !== "home") return;
  const videos = getYouTubeDisplayResults().filter((video) => video?.id);
  let addedCount = 0;
  videos.forEach((video) => {
    if (addYouTubeFavorite(video)) addedCount += 1;
  });
  renderYouTubeResults();
  renderYouTubeStatus();
  if (youtubeStatus && addedCount) {
    youtubeStatus.textContent = `${addedCount} saved`;
  }
}

function recordYouTubeInterest(value, weight = 1, source = "youtube") {
  const topic = normalizeYouTubeTopic(value);
  if (!topic || YOUTUBE_GENERIC_QUERIES.has(topic)) return;
  const existing = youtubeInterestTopics.find((item) => item.topic === topic);
  if (existing) {
    existing.count = Math.min(99, (existing.count || 0) + weight);
    existing.updatedAt = Date.now();
    existing.source = source;
  } else {
    youtubeInterestTopics.unshift({
      topic,
      count: weight,
      updatedAt: Date.now(),
      source
    });
  }
  youtubeInterestTopics = youtubeInterestTopics
    .sort((a, b) => ((b.count || 0) - (a.count || 0)) || ((b.updatedAt || 0) - (a.updatedAt || 0)))
    .slice(0, YOUTUBE_INTEREST_LIMIT);
  persistYouTubeInterests();
}

function getYouTubeInterestTopics(limit = YOUTUBE_HOME_TOPIC_LIMIT) {
  const seen = new Set();
  return youtubeInterestTopics
    .filter((item) => item?.topic)
    .sort((a, b) => ((b.count || 0) - (a.count || 0)) || ((b.updatedAt || 0) - (a.updatedAt || 0)))
    .map((item) => item.topic)
    .filter((topic) => {
      if (!topic || seen.has(topic)) return false;
      seen.add(topic);
      return true;
    })
    .slice(0, limit);
}

function recordYouTubeWatch(video) {
  if (!video?.id) return;
  const topic = normalizeYouTubeTopic(video.topic || video.recommendationTopic) || inferYouTubeTopic(video);
  const historyItem = {
    id: video.id,
    title: video.title || "YouTube Video",
    channel: video.channel || "YouTube",
    thumbnail: video.thumbnail || "",
    publishedAt: video.publishedAt || "",
    description: video.description || "",
    topic,
    watchedAt: Date.now()
  };
  youtubeWatchHistory = [
    historyItem,
    ...youtubeWatchHistory.filter((item) => item.id !== historyItem.id)
  ].slice(0, YOUTUBE_HISTORY_LIMIT);
  persistYouTubeHistory();
  recordYouTubeInterest(topic || video.title || video.channel, 3, "watch");
}

function getYouTubeHomeTopics() {
  const counts = new Map();
  [...youtubeWatchHistory, ...youtubeFavorites].forEach((item, index) => {
    const topic = normalizeYouTubeTopic(item.topic) || inferYouTubeTopic(item);
    if (!topic) return;
    const current = counts.get(topic) || { topic, count: 0, newest: 0 };
    current.count += 1;
    current.newest = Math.max(current.newest, item.watchedAt || item.savedAt || Date.now() - index);
    counts.set(topic, current);
  });
  return [...counts.values()]
    .sort((a, b) => (b.count - a.count) || (b.newest - a.newest))
    .slice(0, YOUTUBE_HOME_TOPIC_LIMIT)
    .map((item) => item.topic);
}

function mergeYouTubeTopicBuckets(buckets) {
  const seen = new Set();
  const merged = [];
  const maxLength = Math.max(0, ...buckets.map((bucket) => bucket.items.length));
  for (let index = 0; index < maxLength; index += 1) {
    buckets.forEach((bucket) => {
      const video = bucket.items[index];
      if (!video?.id || seen.has(video.id)) return;
      seen.add(video.id);
      merged.push({ ...video, topic: bucket.topic });
    });
  }
  return merged;
}

function getLocalYouTubeFallbackResults(query = "") {
  const words = normalizeYouTubeTopic(query)
    .split(/\s+/)
    .filter(Boolean);
  const sources = [
    ...youtubeWatchHistory,
    ...youtubeFavorites,
    youtubeAppState.currentVideo,
    ...youtubeAppState.results
  ].filter(Boolean);
  const seen = new Set();

  return sources
    .map((video, index) => {
      const haystack = `${video.title || ""} ${video.channel || ""} ${video.topic || ""} ${video.description || ""}`.toLowerCase();
      const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { video, index, score };
    })
    .filter(({ video, score }) => {
      if (!video?.id || seen.has(video.id)) return false;
      if (words.length && score <= 0) return false;
      seen.add(video.id);
      return true;
    })
    .sort((a, b) => (b.score - a.score) || ((b.video.watchedAt || 0) - (a.video.watchedAt || 0)) || (a.index - b.index))
    .map(({ video }) => ({
      id: video.id,
      title: video.title || "YouTube Video",
      channel: video.channel || "YouTube",
      thumbnail: video.thumbnail || "",
      publishedAt: video.publishedAt || "",
      description: video.description || "",
      topic: video.topic || inferYouTubeTopic(video),
      watchedAt: video.watchedAt || ""
    }))
    .slice(0, 30);
}

async function fetchYouTubeSearchItems(query, pageToken = "", options = {}) {
  const cached = getCachedYouTubeSearch(query, pageToken, options);
  if (cached) return cached;

  const cooldownMessage = getYouTubeApiCooldownMessage();
  if (cooldownMessage) {
    const stale = getCachedYouTubeSearch(query, pageToken, options, true);
    if (stale) return stale;
    throw new Error(cooldownMessage);
  }

  const params = new URLSearchParams({ q: query });
  if (pageToken) params.set("pageToken", pageToken);
  if (options.duration) params.set("duration", options.duration);
  if (options.embeddable) params.set("embeddable", options.embeddable);
  if (options.syndicated) params.set("syndicated", options.syndicated);
  if (options.videoType) params.set("videoType", options.videoType);
  if (options.order) params.set("order", options.order);
  const response = await fetch(`/api/youtube/search?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = cleanProviderMessage(data.message || "YouTube search failed.");
    setYouTubeApiCooldown(message);
    const stale = getCachedYouTubeSearch(query, pageToken, options, true);
    if (stale) return stale;
    throw new Error(message);
  }
  const result = {
    items: Array.isArray(data.items) ? data.items : [],
    nextPageToken: data.nextPageToken || ""
  };
  saveCachedYouTubeSearch(query, pageToken, options, result);
  return result;
}

function showYouTubeHistory() {
  youtubeAppState.mode = "history";
  youtubeAppState.query = "History";
  youtubeAppState.homeTopics = [];
  youtubeAppState.results = [...youtubeWatchHistory];
  youtubeAppState.nextPageToken = "";
  youtubeAppState.error = "";
  youtubeAppState.loading = false;
  youtubeAppState.currentVideo = null;
  youtubeAppState.didInitialLoad = true;
  if (youtubeSearchInput) youtubeSearchInput.value = "";
  renderYouTubePlayer();
  renderYouTubeResults();
}

function showYouTubeFavorites() {
  youtubeAppState.mode = "favorites";
  youtubeAppState.query = "Favorites";
  youtubeAppState.homeTopics = [];
  youtubeAppState.results = [...youtubeFavorites];
  youtubeAppState.nextPageToken = "";
  youtubeAppState.error = "";
  youtubeAppState.loading = false;
  youtubeAppState.currentVideo = null;
  youtubeAppState.didInitialLoad = true;
  if (youtubeSearchInput) youtubeSearchInput.value = "";
  renderYouTubePlayer();
  renderYouTubeResults();
}

async function showYouTubeMovies({ append = false, query = "" } = {}) {
  const movieQuery = String(query || (append ? youtubeAppState.query : youtubeSearchInput?.value) || YOUTUBE_MOVIE_DEFAULT_QUERY).trim() || YOUTUBE_MOVIE_DEFAULT_QUERY;
  youtubeAppState.mode = "movies";
  youtubeAppState.query = movieQuery;
  youtubeAppState.homeTopics = [];
  youtubeAppState.error = "";
  youtubeAppState.loading = true;
  if (!append) {
    youtubeAppState.results = [];
    youtubeAppState.nextPageToken = "";
    youtubeAppState.currentVideo = null;
    renderYouTubePlayer();
  }
  if (youtubeSearchInput) {
    youtubeSearchInput.value = movieQuery === YOUTUBE_MOVIE_DEFAULT_QUERY ? "" : movieQuery;
    youtubeSearchInput.placeholder = "Search YouTube movies";
  }
  renderYouTubeResults();

  try {
    const data = await fetchYouTubeSearchItems(
      movieQuery,
      append ? youtubeAppState.nextPageToken : "",
      {
        duration: "long",
        embeddable: "true",
        syndicated: "true",
        order: "relevance"
      }
    );
    const nextItems = data.items.map((item) => ({
      ...item,
      topic: "movies",
      recommendationTopic: "movies"
    }));
    youtubeAppState.results = append
      ? [...youtubeAppState.results, ...nextItems]
      : nextItems;
    youtubeAppState.nextPageToken = data.nextPageToken || "";
  } catch (error) {
    const fallback = getLocalYouTubeFallbackResults(movieQuery).filter((video) => {
      const text = `${video.title || ""} ${video.description || ""} ${video.topic || ""}`.toLowerCase();
      return text.includes("movie") || text.includes("film") || text.includes("full");
    });
    if (!append && fallback.length) {
      youtubeAppState.results = fallback;
      youtubeAppState.nextPageToken = "";
      youtubeAppState.error = "";
    } else {
      youtubeAppState.error = getYouTubeFetchError(error);
    }
  } finally {
    youtubeAppState.loading = false;
    youtubeAppState.didInitialLoad = true;
    renderYouTubeResults();
  }
}

async function showYouTubeGlobal() {
  youtubeAppState.mode = "global";
  youtubeAppState.query = "Global Favs";
  youtubeAppState.homeTopics = [];
  youtubeAppState.results = [];
  youtubeAppState.nextPageToken = "";
  youtubeAppState.error = "";
  youtubeAppState.loading = true;
  youtubeAppState.currentVideo = null;
  youtubeAppState.didInitialLoad = true;
  if (youtubeSearchInput) youtubeSearchInput.value = "";
  renderYouTubePlayer();
  renderYouTubeResults();

  try {
    const response = await fetch("/api/youtube/global");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Global favorites could not load.");
    youtubeAppState.results = Array.isArray(data.items) ? data.items : [];
    youtubeGlobalIds = new Set(youtubeAppState.results.map((item) => item?.id).filter(Boolean));
    youtubeGlobalMessage = data.message || (data.persistent
      ? "Permanent Global Favs storage is connected."
      : "Permanent Global Favs storage is not connected yet.");
  } catch (error) {
    youtubeAppState.error = error.message || "Global favorites could not load.";
  } finally {
    youtubeAppState.loading = false;
    renderYouTubeResults();
  }
}

async function addGlobalYouTubeFavorite(value) {
  const importType = youtubeGlobalImportType || "video";
  if (importType === "channel") {
    await addGlobalYouTubeChannel(value);
    return;
  }

  const id = extractYouTubeId(value);
  if (!id) {
    youtubeGlobalMessage = "Paste a real YouTube video, Shorts, youtu.be link, or video ID.";
    renderYouTubeStatus();
    youtubeGlobalInput?.focus({ preventScroll: true });
    return;
  }

  await saveYouTubeVideoToGlobal(findKnownYouTubeVideo(id) || { id }, {
    value,
    switchToGlobal: true
  });
}

async function addGlobalYouTubeChannel(value) {
  const channelUrl = String(value || "").trim();
  if (!channelUrl) {
    youtubeGlobalMessage = "Paste a YouTube channel link like youtube.com/@CboysTV/videos.";
    renderYouTubeStatus();
    youtubeGlobalInput?.focus({ preventScroll: true });
    return;
  }

  youtubeGlobalMessage = "Importing recent channel uploads...";
  youtubeAppState.error = "";
  renderYouTubeStatus();

  try {
    const response = await fetch("/api/youtube/global", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: channelUrl,
        importType: "channel"
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.message || data.error || "Could not import that YouTube channel.";
      throw new Error(`${detail} (${response.status})`);
    }
    if (youtubeGlobalInput) youtubeGlobalInput.value = "";
    const importedCount = Number(data.importedCount || 0);
    youtubeGlobalMessage = importedCount
      ? `Imported ${importedCount} recent channel uploads to Global Favs forever.`
      : "No channel uploads were imported.";
    youtubeAppState.results = Array.isArray(data.items) ? data.items : youtubeAppState.results;
    youtubeGlobalIds = new Set(youtubeAppState.results.map((item) => item?.id).filter(Boolean));
    youtubeAppState.mode = "global";
    renderYouTubeResults();
  } catch (error) {
    youtubeGlobalMessage = error.message || "Could not import that YouTube channel.";
    renderYouTubeStatus();
  }
}

async function loadYouTubeHome() {
  youtubeAppState.mode = "home";
  youtubeAppState.currentVideo = null;
  youtubeAppState.error = "";
  youtubeAppState.nextPageToken = "";
  youtubeAppState.homeTopics = getYouTubeHomeTopics();
  if ((youtubeWatchHistory.length || youtubeFavorites.length) && !youtubeAppState.homeTopics.length) {
    youtubeAppState.homeTopics = ["music"];
  }
  youtubeAppState.query = youtubeAppState.homeTopics.length
    ? youtubeAppState.homeTopics.map(titleCaseYouTubeTopic).join(" + ")
    : "For You";
  if (youtubeSearchInput) youtubeSearchInput.value = "";

  if (!youtubeWatchHistory.length && !youtubeFavorites.length) {
    youtubeAppState.results = [];
    youtubeAppState.loading = false;
    youtubeAppState.didInitialLoad = true;
    renderYouTubePlayer();
    renderYouTubeResults();
    return;
  }

  youtubeAppState.results = [];
  youtubeAppState.loading = true;
  renderYouTubePlayer();
  renderYouTubeResults();

  try {
    const buckets = await Promise.all(youtubeAppState.homeTopics.map(async (topic) => {
      try {
        const data = await fetchYouTubeSearchItems(topic);
        return { topic, items: data.items };
      } catch (error) {
        return { topic, items: [], error };
      }
    }));
    const merged = mergeYouTubeTopicBuckets(buckets).slice(0, 30);
    const failedAll = buckets.every((bucket) => bucket.error);
    if (failedAll) throw buckets.find((bucket) => bucket.error)?.error || new Error("YouTube home failed.");
    const savedFallback = [...youtubeWatchHistory, ...youtubeFavorites].slice(0, 30);
    youtubeAppState.results = merged.length ? merged : savedFallback;
    youtubeAppState.error = youtubeAppState.results.length ? "" : "Your Home feed is ready, but YouTube did not return videos for this history yet.";
  } catch (error) {
    const fallback = [...youtubeWatchHistory, ...youtubeFavorites].slice(0, 30);
    youtubeAppState.results = fallback;
    youtubeAppState.error = fallback.length ? "" : getYouTubeFetchError(error);
  } finally {
    youtubeAppState.loading = false;
    youtubeAppState.didInitialLoad = true;
    renderYouTubeResults();
  }
}

function clearYouTubeHistory() {
  youtubeWatchHistory = [];
  youtubeInterestTopics = [];
  persistYouTubeHistory();
  persistYouTubeInterests();
  if (youtubeAppState.mode === "history") {
    showYouTubeHistory();
    return;
  }
  loadYouTubeHome();
}

function renderYouTubeStatus() {
  const isWatching = Boolean(youtubeAppState.currentVideo);
  youtubeDrawer?.classList.toggle("is-youtube-watching", isWatching);
  youtubeDrawer?.classList.toggle("is-youtube-browsing", !isWatching);
  youtubeDrawer?.classList.toggle("is-youtube-home", youtubeAppState.mode === "home");
  youtubeDrawer?.classList.toggle("is-youtube-history", youtubeAppState.mode === "history");
  youtubeDrawer?.classList.toggle("is-youtube-favorites", youtubeAppState.mode === "favorites");
  youtubeDrawer?.classList.toggle("is-youtube-global", youtubeAppState.mode === "global");
  youtubeDrawer?.classList.toggle("is-youtube-movies", youtubeAppState.mode === "movies");
  const shouldHideResults = isWatching && youtubeAppState.resultsHidden;
  youtubeDrawer?.classList.toggle("is-youtube-results-hidden", shouldHideResults);
  if (youtubeToggleResultsButton) {
    youtubeToggleResultsButton.hidden = !isWatching;
    youtubeToggleResultsButton.textContent = shouldHideResults ? "Show List" : "Hide List";
    youtubeToggleResultsButton.setAttribute("aria-pressed", String(shouldHideResults));
  }
  if (youtubeStatus) {
    const globalStatus = youtubeGlobalSavingIds.size
      ? "Saving Global"
      : /^Saved to Global/i.test(youtubeGlobalMessage)
        ? "Saved Global"
        : /^Could not|missing|invalid/i.test(youtubeGlobalMessage)
          ? "Global Error"
          : "";
    youtubeStatus.textContent = globalStatus && youtubeAppState.mode !== "global"
      ? globalStatus
      : youtubeAppState.loading
      ? "Loading"
      : youtubeAppState.error
        ? "Error"
        : youtubeAppState.mode === "history"
          ? `${youtubeWatchHistory.length} watched`
          : youtubeAppState.mode === "favorites"
            ? `${youtubeFavorites.length} saved`
          : youtubeAppState.mode === "global"
            ? `${youtubeAppState.results.length || 0} global`
            : youtubeAppState.mode === "movies"
              ? `${youtubeAppState.results.length || 0} movies`
            : youtubeAppState.mode === "home" && !youtubeWatchHistory.length && !youtubeFavorites.length
            ? "No history"
            : `${youtubeAppState.results.length || 0} videos`;
  }
  if (youtubeResultsTitle) {
    youtubeResultsTitle.textContent = youtubeAppState.mode === "home"
      ? "For You"
      : youtubeAppState.mode === "history"
        ? "History"
        : youtubeAppState.mode === "favorites"
          ? "Favorites"
          : youtubeAppState.mode === "global"
            ? "Global Favs"
            : youtubeAppState.mode === "movies"
              ? "Movies"
          : youtubeAppState.query || "YouTube";
  }
  if (youtubeGlobalForm) {
    youtubeGlobalForm.hidden = youtubeAppState.mode !== "global";
  }
  if (youtubeGlobalStatus) {
    youtubeGlobalStatus.textContent = youtubeGlobalMessage || "Shared links show up for everyone using vel.os.";
  }
  if (youtubeSaveAllButton) {
    const homeResults = youtubeAppState.mode === "home" ? youtubeAppState.results.filter((video) => video?.id) : [];
    const allSaved = Boolean(homeResults.length) && homeResults.every((video) => isYouTubeFavorite(video.id));
    youtubeSaveAllButton.hidden = youtubeAppState.mode !== "home" || !homeResults.length || youtubeAppState.loading;
    youtubeSaveAllButton.disabled = allSaved;
    youtubeSaveAllButton.textContent = allSaved ? "Saved All" : "Save All";
  }
  if (youtubeClearHistoryButton) {
    youtubeClearHistoryButton.hidden = youtubeAppState.mode !== "history" || !youtubeWatchHistory.length;
  }
  if (youtubeLoadMore) {
    youtubeLoadMore.hidden = !["search", "movies"].includes(youtubeAppState.mode) || !youtubeAppState.nextPageToken || youtubeAppState.loading;
  }
  if (youtubeAddressInput) {
    youtubeAddressInput.value = getYouTubeWatchUrl();
  }
  updateYouTubeActiveNav();
}

function updateYouTubeActiveNav() {
  if (!youtubeDrawer) return;
  const buttons = [...youtubeDrawer.querySelectorAll(".youtube-chip-row button, .youtube-sidebar button")];
  let activeSelector = "";
  if (youtubeAppState.mode === "home") activeSelector = "[data-youtube-home]";
  if (youtubeAppState.mode === "history") activeSelector = "[data-youtube-history]";
  if (youtubeAppState.mode === "favorites") activeSelector = "[data-youtube-favorites]";
  if (youtubeAppState.mode === "global") activeSelector = "[data-youtube-global]";
  if (youtubeAppState.mode === "movies") activeSelector = "[data-youtube-movies]";
  buttons.forEach((button) => {
    const isTopic = youtubeAppState.mode === "search"
      && button.dataset.youtubeTopic
      && button.dataset.youtubeTopic.toLowerCase() === String(youtubeAppState.query || "").toLowerCase();
    const isActive = isTopic || Boolean(activeSelector && button.matches(activeSelector));
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function toggleYouTubeResultsPanel() {
  youtubeAppState.resultsHidden = !youtubeAppState.resultsHidden;
  storage.set("vel-youtube-results-hidden", youtubeAppState.resultsHidden ? "1" : "0");
  renderYouTubeStatus();
}

function renderYouTubePlayer() {
  const video = youtubeAppState.currentVideo;
  if (!youtubeFrameWrap || !youtubePlayerTitle || !youtubePlayerChannel || !youtubePlayerDescription) return;
  clearYouTubePlayerHintTimer();

  if (!video) {
    youtubeFrameWrap.innerHTML = `
      <div class="youtube-empty-player">
        <strong>velTube</strong>
        <span>Pick a video from the home feed or search above.</span>
      </div>
    `;
    youtubePlayerTitle.textContent = "Browse first. Play when you choose.";
    youtubePlayerChannel.textContent = "Official YouTube Embed";
    youtubePlayerDescription.textContent = "The home feed loads metadata first so the app feels more like YouTube and does not autoplay.";
    renderYouTubeStatus();
    return;
  }

  youtubeFrameWrap.innerHTML = `
    <iframe
      title="${escapeHtml(video.title)}"
      src="${escapeHtml(getYouTubeEmbedUrl(video.id))}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>
    <button class="youtube-video-fullscreen" type="button" data-youtube-video-fullscreen aria-label="Fullscreen video">
      <span></span>
      Fullscreen
    </button>
    <div class="youtube-player-hint" data-youtube-player-hint>
      <button class="youtube-player-hint-close" type="button" data-youtube-dismiss-hint aria-label="Close YouTube player notice">x</button>
      <div class="youtube-player-hint-copy">
        <strong>If this stays black</strong>
        <span>Mode: ${escapeHtml(getYouTubeEmbedModeLabel())}. vel.os is using official YouTube embeds. Try the other mode, copy the link, or open it in a normal tab.</span>
      </div>
      <div class="youtube-player-hint-actions">
        <button type="button" data-youtube-retry-embed>Try ${escapeHtml(getNextYouTubeEmbedModeLabel())}</button>
        <button type="button" data-youtube-copy-current>Copy Link</button>
        <button type="button" data-youtube-open-current>Open Tab</button>
      </div>
    </div>
  `;
  youtubePlayerTitle.textContent = video.title;
  youtubePlayerChannel.textContent = `${video.channel || "YouTube"}${video.publishedAt ? ` - ${formatYouTubeDate(video.publishedAt)}` : ""}`;
  youtubePlayerDescription.textContent = video.description || `Playing through the official ${getYouTubeEmbedModeLabel()} YouTube embedded player.`;
  showYouTubePlayerHint();
  renderYouTubeStatus();
}

function renderYouTubeResults() {
  if (!youtubeResultsGrid) return;
  const displayResults = getYouTubeDisplayResults();

  if (youtubeAppState.loading && !displayResults.length) {
    youtubeResultsGrid.innerHTML = Array.from({ length: 15 }, (_, index) => `
      <article class="youtube-video-card is-loading" aria-hidden="true">
        <div class="youtube-video-thumb"></div>
        <div><strong>${index === 0 ? "Loading YouTube" : "Loading video"}</strong><span>${youtubeAppState.mode === "home" ? "Building your For You feed..." : "Building your feed..."}</span></div>
      </article>
    `).join("");
    renderYouTubeStatus();
    return;
  }

  if (youtubeAppState.error) {
    youtubeResultsGrid.innerHTML = `
      <article class="youtube-video-card youtube-state-card">
        <div class="youtube-video-thumb"></div>
        <div>
          <strong>YouTube could not load</strong>
          <span>${escapeHtml(youtubeAppState.error)}</span>
        </div>
      </article>
    `;
    renderYouTubeStatus();
    return;
  }

  if (!displayResults.length) {
    const emptyCopy = youtubeAppState.mode === "home"
      ? {
        title: "No history yet",
        body: "Watch a video to get started. After that, Home learns what to show next."
      }
      : youtubeAppState.mode === "history"
        ? {
          title: "History is empty",
          body: "Videos you watch inside vel.os YouTube will show up here."
        }
        : youtubeAppState.mode === "favorites"
          ? {
            title: "No favorites yet",
            body: "Tap Save on any video, or use Save All from your For You page."
          }
          : youtubeAppState.mode === "global"
            ? {
              title: "No global favorites yet",
              body: "Paste a YouTube link above and everyone on vel.os can open it."
            }
          : youtubeAppState.mode === "movies"
            ? {
              title: "No YouTube movies found",
              body: "Try searching a movie title plus official full movie, or load a different movie search."
            }
          : {
            title: "No videos yet",
            body: "Search something to load YouTube results."
          };
    youtubeResultsGrid.innerHTML = `
      <article class="youtube-video-card youtube-state-card">
        <div class="youtube-video-thumb"></div>
        <div><strong>${emptyCopy.title}</strong><span>${emptyCopy.body}</span></div>
      </article>
    `;
    renderYouTubeStatus();
    return;
  }

  youtubeResultsGrid.innerHTML = displayResults.map((video) => {
    const isSaved = isYouTubeFavorite(video.id);
    const isGlobalSaved = isYouTubeGlobalFavorite(video.id);
    const isGlobalSaving = youtubeGlobalSavingIds.has(video.id);
    const dateLabel = youtubeAppState.mode === "history"
      ? `Watched ${formatYouTubeDate(video.watchedAt)}`
      : youtubeAppState.mode === "favorites"
        ? `Saved ${formatYouTubeDate(video.savedAt)}`
        : youtubeAppState.mode === "global"
          ? `Added ${formatYouTubeDate(video.addedAt)}`
        : formatYouTubeDate(video.publishedAt);
    return `
      <article class="youtube-video-card${youtubeAppState.currentVideo?.id === video.id ? " is-active" : ""}">
        <button class="youtube-video-main" type="button" data-youtube-app-video="${escapeHtml(video.id)}" aria-label="Play ${escapeHtml(video.title || "YouTube video")}">
          ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" />` : '<div class="youtube-video-thumb"></div>'}
          <span>
            <strong>${escapeHtml(video.title)}</strong>
            <span>${escapeHtml(video.channel || "YouTube")}</span>
            <span>${escapeHtml(dateLabel)}</span>
          </span>
        </button>
        <div class="youtube-video-actions">
          <button
            class="youtube-video-save${isSaved ? " is-saved" : ""}"
            type="button"
            data-youtube-save-video="${escapeHtml(video.id)}"
            aria-pressed="${isSaved}"
            aria-label="${isSaved ? `Remove ${escapeHtml(video.title || "video")} from favorites` : `Save ${escapeHtml(video.title || "video")} to favorites`}"
          >${isSaved ? "Unsave" : "Favs"}</button>
          <button
            class="youtube-video-global${isGlobalSaved ? " is-saved" : ""}${isGlobalSaving ? " is-saving" : ""}"
            type="button"
            data-youtube-global-video="${escapeHtml(video.id)}"
            aria-pressed="${isGlobalSaved}"
            aria-label="${isGlobalSaved ? `Remove ${escapeHtml(video.title || "video")} from Global Favs` : `Save ${escapeHtml(video.title || "video")} to Global Favs`}"
            ${isGlobalSaving ? "disabled" : ""}
          >${isGlobalSaving ? "Saving" : isGlobalSaved ? "Unsave" : "Global"}</button>
        </div>
      </article>
    `;
  }).join("");
  renderYouTubeStatus();
}

function selectYouTubeAppVideo(video) {
  if (!video) return;
  youtubeAppState.currentVideo = video;
  youtubeAppState.hintDismissed = false;
  storage.set("vel-youtube-last-video", video.id);
  recordYouTubeWatch(video);
  renderYouTubePlayer();
  renderYouTubeResults();
}

async function searchYouTubeApp({ append = false } = {}) {
  const typedQuery = (youtubeSearchInput?.value || "").trim();
  const fallbackQuery = ["home", "history", "favorites", "global"].includes(youtubeAppState.mode)
    ? "music videos"
    : youtubeAppState.query || "music videos";
  const query = typedQuery || fallbackQuery;
  youtubeAppState.mode = "search";
  youtubeAppState.query = query;
  youtubeAppState.homeTopics = [];
  storage.set("vel-youtube-query", query);
  recordYouTubeInterest(query, 1, "youtube-search");
  if (youtubeSearchInput) youtubeSearchInput.value = query;
  youtubeAppState.loading = true;
  youtubeAppState.error = "";
  if (!append) {
    youtubeAppState.results = [];
    youtubeAppState.nextPageToken = "";
    youtubeAppState.currentVideo = null;
    renderYouTubePlayer();
  }
  renderYouTubeResults();

  try {
    const data = await fetchYouTubeSearchItems(query, append ? youtubeAppState.nextPageToken : "");
    const nextItems = data.items;
    youtubeAppState.results = append
      ? [...youtubeAppState.results, ...nextItems]
      : nextItems;
    youtubeAppState.nextPageToken = data.nextPageToken || "";
  } catch (error) {
    const fallback = getLocalYouTubeFallbackResults(query);
    if (!append && fallback.length) {
      youtubeAppState.results = fallback;
      youtubeAppState.nextPageToken = "";
      youtubeAppState.error = "";
    } else {
      youtubeAppState.error = getYouTubeFetchError(error);
    }
  } finally {
    youtubeAppState.loading = false;
    youtubeAppState.didInitialLoad = true;
    renderYouTubeResults();
  }
}

function openYouTubeApp() {
  const wasOpen = isDrawerOpen("youtube");
  if (openPanel("youtube") === false) return;
  if (!wasOpen) {
    showYouTubeLaunch();
  }
  if (youtubeSearchInput) youtubeSearchInput.placeholder = "Search YouTube";
  loadYouTubeHome();
}

/*
 * Dedicated Shorts app removed from vel.os.
 * Keeping the old implementation disabled here for reference while regular YouTube stays active.
function getShortsWatchUrl(video = shortsState.results[shortsState.activeIndex]) {
  return video?.id
    ? `https://www.youtube.com/shorts/${encodeURIComponent(video.id)}`
    : "https://www.youtube.com/shorts";
}

function getShortsSearchText(topic) {
  const cleaned = String(topic || SHORTS_DEFAULT_QUERY).trim() || SHORTS_DEFAULT_QUERY;
  return /\bshorts?\b/i.test(cleaned) ? cleaned : `${cleaned} shorts`;
}

function getShortsForYouTopics() {
  const seen = new Set();
  const topics = [
    ...getYouTubeInterestTopics(6),
    ...getYouTubeHomeTopics(),
    SHORTS_DEFAULT_QUERY,
    "gaming edits",
    "funny clips",
    "music shorts"
  ];

  return topics
    .map((topic) => normalizeYouTubeTopic(topic) || topic)
    .filter((topic) => {
      if (!topic || seen.has(topic)) return false;
      seen.add(topic);
      return true;
    })
    .slice(0, SHORTS_FOR_YOU_TOPIC_LIMIT);
}

function getShortsForYouSignature() {
  return [
    youtubeWatchHistory[0]?.watchedAt || 0,
    youtubeInterestTopics.map((item) => `${item.topic}:${item.count || 0}:${item.updatedAt || 0}`).join("|")
  ].join("::");
}

function getShortsSeedVideos(topics = []) {
  const topicText = topics.join(" ");
  const seedSources = [
    ...youtubeWatchHistory,
    youtubeAppState.currentVideo,
    ...youtubeAppState.results
  ].filter(Boolean);
  const seen = new Set();

  return seedSources
    .map((video) => {
      const topic = normalizeYouTubeTopic(video.topic || video.recommendationTopic || topicText) || inferYouTubeTopic(video);
      return {
        id: video.id,
        title: video.title || "YouTube Video",
        channel: video.channel || "YouTube",
        thumbnail: video.thumbnail || "",
        publishedAt: video.publishedAt || "",
        description: video.description || "",
        recommendationTopic: topic,
        topic
      };
    })
    .filter((video) => {
      if (!video.id || seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    })
    .slice(0, 60);
}

function getShortsFallbackVideos(topics = []) {
  const topicWords = topics
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const ranked = mediaTikTokCatalog
    .map((item, index) => {
      const haystack = `${item.title || ""} ${item.creator || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
      const score = topicWords.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { item, index, score };
    })
    .sort((a, b) => (b.score - a.score) || (a.index - b.index));

  return ranked.slice(0, SHORTS_FALLBACK_LIMIT).map(({ item, index }) => ({
    id: `local-short-${index}`,
    title: item.title || "Short Clip",
    channel: item.creator || "vel.os Shorts",
    thumbnail: "",
    poster: item.thumbnail || "linear-gradient(135deg, #050505, #555)",
    src: item.src,
    localShort: true,
    publishedAt: "",
    description: "Starter short-form clip shown when YouTube API results are unavailable.",
    recommendationTopic: topics[0] || "shorts",
    topic: topics[0] || "shorts"
  }));
}

function getShortsEmbedUrl(videoId) {
  const params = new URLSearchParams({
    autoplay: "1",
    controls: "1",
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1"
  });
  if (location.origin && /^https?:/i.test(location.origin)) {
    params.set("origin", location.origin);
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`;
}

function pauseShortsPlayback() {
  if (shortsAutoPlayTimer) {
    window.clearTimeout(shortsAutoPlayTimer);
    shortsAutoPlayTimer = null;
  }
  shortsFeed?.querySelectorAll("iframe").forEach((iframe) => {
    if (!iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(JSON.stringify({
        event: "command",
        func: "pauseVideo",
        args: []
      }), "*");
    } catch (error) {
      return;
    }
  });
}

function scheduleShortsAutoPlay(index, delay = 180) {
  const nextIndex = Number(index);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= shortsState.results.length) return;
  if (nextIndex === shortsState.activeIndex) return;
  if (shortsAutoPlayTimer) window.clearTimeout(shortsAutoPlayTimer);
  shortsAutoPlayTimer = window.setTimeout(() => {
    shortsAutoPlayTimer = null;
    activateShortsIndex(nextIndex);
  }, delay);
}

function setupShortsAutoPlay() {
  if (!shortsFeed || !shortsState.results.length) return;
  if (shortsFeedObserver) {
    shortsFeedObserver.disconnect();
    shortsFeedObserver = null;
  }

  const cards = [...shortsFeed.querySelectorAll("[data-shorts-index]")];
  if (!cards.length) return;

  if ("IntersectionObserver" in window) {
    shortsFeedObserver = new IntersectionObserver((entries) => {
      const bestEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!bestEntry || bestEntry.intersectionRatio < 0.58) return;
      scheduleShortsAutoPlay(Number(bestEntry.target.dataset.shortsIndex));
    }, {
      root: shortsFeed,
      threshold: [0.58, 0.72, 0.88]
    });
    cards.forEach((card) => shortsFeedObserver.observe(card));
    return;
  }

  let fallbackTimer = null;
  shortsFeed.addEventListener("scroll", () => {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(() => {
      const feedRect = shortsFeed.getBoundingClientRect();
      const feedCenter = feedRect.top + (feedRect.height / 2);
      const closest = cards
        .map((card) => ({
          card,
          distance: Math.abs((card.getBoundingClientRect().top + (card.getBoundingClientRect().height / 2)) - feedCenter)
        }))
        .sort((a, b) => a.distance - b.distance)[0]?.card;
      if (closest) scheduleShortsAutoPlay(Number(closest.dataset.shortsIndex), 80);
    }, 120);
  }, { passive: true });
}

function setShortsStatus() {
  if (shortsStatus) {
    const label = shortsState.mode === "forYou" ? "For You" : "Search";
    shortsStatus.textContent = shortsState.loading
      ? "Loading"
      : shortsState.error
        ? "Error"
        : shortsState.notice
          ? `${label} - Starter feed`
          : `${label} - ${shortsState.results.length || 0} shorts`;
  }
  if (shortsLoadMore) {
    shortsLoadMore.hidden = !shortsState.nextPageToken || shortsState.loading || Boolean(shortsState.error);
  }
  if (shortsHomeButton) {
    shortsHomeButton.disabled = shortsState.loading && shortsState.mode === "forYou";
  }
  if (shortsSearchInput && document.activeElement !== shortsSearchInput) {
    shortsSearchInput.value = shortsState.mode === "forYou" ? "" : shortsState.query;
  }
}

function renderShortsCover(video, index) {
  const posterStyle = video.poster ? ` style="background: ${escapeHtml(video.poster)};"` : "";
  return `
    <button class="shorts-cover" type="button" data-shorts-play="${index}" aria-label="Play ${escapeHtml(video.title || "Short")}"${posterStyle}>
      ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" />` : ""}
      <span class="shorts-play-dot">Play</span>
    </button>
  `;
}

function renderShortsIframe(video) {
  if (video.src) {
    return `
      <video
        class="shorts-local-video"
        src="${escapeHtml(video.src)}"
        autoplay
        muted
        loop
        playsinline
        controls
      ></video>
    `;
  }

  return `
    <iframe
      title="${escapeHtml(video.title || "YouTube Short")}"
      src="${escapeHtml(getShortsEmbedUrl(video.id))}"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>
  `;
}

function setShortsCardMedia(index, active) {
  const video = shortsState.results[index];
  const card = shortsFeed?.querySelector(`[data-shorts-index="${index}"]`);
  const slot = card?.querySelector("[data-shorts-slot]");
  if (!video || !card || !slot) return;
  card.classList.toggle("is-active-short", active);
  slot.innerHTML = active ? renderShortsIframe(video) : renderShortsCover(video, index);
}

function activateShortsIndex(index, { scroll = false } = {}) {
  const nextIndex = Number(index);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= shortsState.results.length) return;
  if (nextIndex === shortsState.activeIndex && shortsFeed?.querySelector(".is-active-short iframe")) return;
  pauseShortsPlayback();
  if (shortsState.activeIndex >= 0) {
    setShortsCardMedia(shortsState.activeIndex, false);
  }
  shortsState.activeIndex = nextIndex;
  setShortsCardMedia(shortsState.activeIndex, true);
  if (!shortsState.results[nextIndex]?.localShort) {
    recordYouTubeWatch({
      ...shortsState.results[nextIndex],
      topic: shortsState.results[nextIndex]?.topic || shortsState.results[nextIndex]?.recommendationTopic
    });
  }
  if (scroll) {
    shortsFeed?.querySelector(`[data-shorts-index="${shortsState.activeIndex}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function renderShortsAppFeed() {
  if (!shortsFeed) return;
  if (shortsFeedObserver) {
    shortsFeedObserver.disconnect();
    shortsFeedObserver = null;
  }

  setShortsStatus();

  if (shortsState.loading && !shortsState.results.length) {
    shortsFeed.innerHTML = Array.from({ length: 4 }, (_, index) => `
      <article class="shorts-feed-card is-loading" aria-hidden="true">
        <div class="shorts-phone">
          <div class="shorts-cover"></div>
          <div class="feed-overlay">
            <strong>${index === 0 ? "Loading Shorts" : "Loading video"}</strong>
            <span>Building a vertical feed...</span>
          </div>
        </div>
      </article>
    `).join("");
    return;
  }

  if (shortsState.error) {
    shortsFeed.innerHTML = `
      <article class="shorts-state-card">
        <strong>Shorts could not load</strong>
        <p>${escapeHtml(getYouTubeFetchError({ message: shortsState.error }))}</p>
        <button class="ghost-button is-solid" type="button" data-shorts-retry>Retry</button>
      </article>
    `;
    return;
  }

  if (!shortsState.results.length) {
    shortsFeed.innerHTML = `
      <article class="shorts-state-card">
        <strong>No shorts yet</strong>
        <p>Search something like gaming, music, edits, sports, or funny clips.</p>
      </article>
    `;
    return;
  }

  if (shortsState.activeIndex >= shortsState.results.length) {
    shortsState.activeIndex = -1;
  }
  shortsFeed.innerHTML = shortsState.results.map((video, index) => {
    const isActive = index === shortsState.activeIndex;
    return `
      <article class="shorts-feed-card${isActive ? " is-active-short" : ""}" data-shorts-index="${index}">
        <div class="shorts-phone">
          <div class="shorts-media-slot" data-shorts-slot>
            ${isActive ? renderShortsIframe(video) : renderShortsCover(video, index)}
          </div>
          <div class="shorts-scroll-grip" aria-hidden="true"><span>Swipe</span></div>
          <div class="feed-overlay">
            <strong>${escapeHtml(video.channel || "YouTube")}</strong>
            <span>${escapeHtml(video.title || "YouTube Short")}</span>
            <small>${escapeHtml(formatYouTubeDate(video.publishedAt) || "Short video")}</small>
          </div>
          <div class="feed-actions" aria-hidden="true">
            <span>Like</span>
            <span>Share</span>
            <span>Save</span>
          </div>
        </div>
      </article>
    `;
  }).join("");
  if (shortsState.notice) {
    shortsFeed.insertAdjacentHTML("afterbegin", `
      <article class="shorts-state-card shorts-notice-card">
        <strong>Starter feed active</strong>
        <p>${escapeHtml(shortsState.notice)}</p>
      </article>
    `);
  }
  setupShortsAutoPlay();
}

async function loadShortsForYou({ append = false } = {}) {
  if (shortsState.loading) return;
  const topics = append && shortsState.feedTopics.length
    ? shortsState.feedTopics
    : getShortsForYouTopics();
  const signature = getShortsForYouSignature();
  shortsState.mode = "forYou";
  shortsState.query = "For You";
  shortsState.feedTopics = topics;
  shortsState.loading = true;
  shortsState.error = "";
  shortsState.notice = "";

  if (!append) {
    pauseShortsPlayback();
    shortsState.results = getShortsSeedVideos(topics);
    shortsState.activeIndex = -1;
    shortsState.feedPageTokens = {};
    shortsState.nextPageToken = "";
    shortsState.interestSignature = signature;
  }

  renderShortsAppFeed();

  try {
    const buckets = await Promise.all(topics.map(async (topic) => {
      const pageToken = append ? shortsState.feedPageTokens[topic] || "" : "";
      if (append && !pageToken) return { topic, items: [], nextPageToken: "" };
      const data = await fetchYouTubeSearchItems(getShortsSearchText(topic), pageToken, {
        duration: "short"
      });
      return {
        topic,
        items: data.items.map((item) => ({ ...item, recommendationTopic: topic })),
        nextPageToken: data.nextPageToken || ""
      };
    }));
    const failedAll = buckets.every((bucket) => bucket.error);
    if (failedAll) throw buckets.find((bucket) => bucket.error)?.error || new Error("Shorts feed failed.");
    buckets.forEach((bucket) => {
      shortsState.feedPageTokens[bucket.topic] = bucket.nextPageToken || "";
    });
    const seen = new Set(shortsState.results.map((item) => item.id));
    const nextItems = mergeYouTubeTopicBuckets(buckets)
      .filter((item) => item?.id && !seen.has(item.id))
      .slice(0, 96);
    shortsState.results = append
      ? [...shortsState.results, ...nextItems]
      : nextItems;
    shortsState.nextPageToken = Object.values(shortsState.feedPageTokens).some(Boolean) ? "for-you" : "";
    if (!shortsState.results.length) {
      shortsState.results = getShortsFallbackVideos(topics);
      shortsState.notice = "YouTube did not return Shorts for this feed, so vel.os is showing its starter short-form feed.";
    }
  } catch (error) {
    const message = getYouTubeFetchError(error).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!shortsState.results.length) {
      shortsState.results = getShortsFallbackVideos(topics);
    }
    shortsState.error = "";
    shortsState.notice = `YouTube API is unavailable right now (${message}). Showing the vel.os starter feed until real results work again.`;
    shortsState.nextPageToken = "";
  } finally {
    shortsState.loading = false;
    shortsState.didInitialLoad = true;
    renderShortsAppFeed();
  }
}

async function searchShorts({ append = false } = {}) {
  const typedQuery = (shortsSearchInput?.value || "").trim();
  const query = typedQuery || shortsState.query || SHORTS_DEFAULT_QUERY;
  shortsState.mode = "search";
  shortsState.query = query;
  shortsState.feedTopics = [query];
  shortsState.feedPageTokens = {};
  storage.set("vel-shorts-query", query);
  recordYouTubeInterest(query, 2, "shorts-search");
  shortsState.loading = true;
  shortsState.error = "";
  shortsState.notice = "";
  if (!append) {
    pauseShortsPlayback();
    shortsState.results = [];
    shortsState.nextPageToken = "";
    shortsState.activeIndex = -1;
  }
  renderShortsAppFeed();

  try {
    const data = await fetchYouTubeSearchItems(getShortsSearchText(query), append ? shortsState.nextPageToken : "", {
      duration: "short"
    });
    const seen = new Set(shortsState.results.map((item) => item.id));
    const nextItems = data.items.filter((item) => item?.id && !seen.has(item.id));
    shortsState.results = append
      ? [...shortsState.results, ...nextItems]
      : nextItems;
    shortsState.nextPageToken = data.nextPageToken || "";
    if (!shortsState.results.length) {
      shortsState.results = getShortsFallbackVideos([query]);
      shortsState.notice = "YouTube returned no Shorts for that search, so vel.os is showing starter clips instead.";
    }
  } catch (error) {
    const message = getYouTubeFetchError(error).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!append || !shortsState.results.length) {
      shortsState.results = getShortsFallbackVideos([query]);
    }
    shortsState.error = "";
    shortsState.notice = `YouTube search is unavailable right now (${message}). Showing starter clips for this search.`;
    shortsState.nextPageToken = "";
  } finally {
    shortsState.loading = false;
    shortsState.didInitialLoad = true;
    renderShortsAppFeed();
  }
}

function openShortsApp() {
  openPanel("shorts");
}
*/

function handleYouTubeAddress(value) {
  const trimmed = value.trim();
  const youtubeId = extractYouTubeId(trimmed);
  if (youtubeId) {
    const existing = youtubeAppState.results.find((video) => video.id === youtubeId);
    selectYouTubeAppVideo(existing || {
      id: youtubeId,
      title: "YouTube Video",
      channel: "Official YouTube player",
      thumbnail: "",
      publishedAt: "",
      description: ""
    });
    return;
  }

  if (!trimmed || /youtube\.com\/?$/i.test(trimmed) || trimmed === "youtube.com") {
    loadYouTubeHome();
    return;
  }

  const searchMatch = trimmed.match(/[?&]search_query=([^&]+)/);
  if (searchMatch?.[1]) {
    const query = decodeURIComponent(searchMatch[1].replace(/\+/g, " "));
    if (youtubeSearchInput) youtubeSearchInput.value = query;
    searchYouTubeApp();
    return;
  }

  window.open(normalizeUrl(trimmed), "_blank", "noopener,noreferrer");
}

function setYouTubeFullscreen(active) {
  youtubeAppState.fullscreen = Boolean(active);
  youtubeDrawer?.classList.toggle("is-youtube-fullscreen", youtubeAppState.fullscreen);
  if (youtubeFullscreenButton) {
    youtubeFullscreenButton.textContent = youtubeAppState.fullscreen ? "Exit Fullscreen" : "Fullscreen";
  }
}

function setYouTubeVideoFullscreen(active) {
  youtubeAppState.videoFullscreen = Boolean(active);
  youtubeDrawer?.classList.toggle("is-video-fullscreen", youtubeAppState.videoFullscreen);
  const button = youtubeFrameWrap?.querySelector("[data-youtube-video-fullscreen]");
  if (button) {
    button.setAttribute("aria-label", youtubeAppState.videoFullscreen ? "Exit video fullscreen" : "Fullscreen video");
    button.innerHTML = `<span></span>${youtubeAppState.videoFullscreen ? "Exit" : "Fullscreen"}`;
  }
}

async function toggleYouTubeFullscreen() {
  const next = !youtubeAppState.fullscreen;
  setYouTubeFullscreen(next);
  try {
    if (next && youtubePanel?.requestFullscreen && !document.fullscreenElement) {
      await youtubePanel.requestFullscreen();
    } else if (!next && document.fullscreenElement === youtubePanel) {
      await document.exitFullscreen();
    }
  } catch (error) {
    return;
  }
}

async function toggleYouTubeVideoFullscreen() {
  const next = !youtubeAppState.videoFullscreen;
  const target = youtubeFrameWrap;

  try {
    if (next && target) {
      const requestFullscreen = target.requestFullscreen
        || target.webkitRequestFullscreen
        || target.msRequestFullscreen;
      if (requestFullscreen && !document.fullscreenElement && !document.webkitFullscreenElement) {
        await requestFullscreen.call(target);
      }
      setYouTubeVideoFullscreen(true);
      return;
    }

    const exitFullscreen = document.exitFullscreen
      || document.webkitExitFullscreen
      || document.msExitFullscreen;
    if (!next && exitFullscreen && (document.fullscreenElement || document.webkitFullscreenElement)) {
      await exitFullscreen.call(document);
    }
    setYouTubeVideoFullscreen(false);
  } catch (error) {
    setYouTubeVideoFullscreen(next);
  }
}

function persistThemeUnlocks() {
  storage.set("vel-theme-unlocks", JSON.stringify(unlockedThemePacks));
}

function renderThemeStore() {
  if (themeCreditBalance) {
    themeCreditBalance.textContent = `${velCredits} VC`;
  }
  themePackButtons.forEach((button) => {
    const key = button.dataset.themePack;
    const pack = themePacks[key];
    const unlocked = unlockedThemePacks.includes(key);
    const active = key === currentThemePackKey;
    button.classList.toggle("is-active", active);
    button.classList.toggle("is-locked", !unlocked);
    button.setAttribute("aria-pressed", String(active));
    const price = button.querySelector("em");
    if (price && pack) {
      price.textContent = active
        ? "Active"
        : unlocked
          ? "Owned"
          : `${pack.cost} VC`;
    }
  });
}

function awardVelCredits(amount = 4) {
  velCredits = Math.min(9999, velCredits + amount);
  storage.set("vel-theme-credits", String(velCredits));
  renderThemeStore();
}

function setCustomThemeStatus(message = "", tone = "") {
  if (!customThemeStatus) return;
  customThemeStatus.textContent = message;
  customThemeStatus.dataset.tone = tone;
}

function applyCustomWallpaper(theme = readStoredJson(VEL_CUSTOM_THEME_KEY, null)) {
  if (!theme?.image) return false;
  currentWallpaperKey = "custom";
  currentThemePackKey = "custom";
  document.documentElement.style.setProperty("--wallpaper-image", `url("${theme.image}")`);
  document.body.dataset.themePack = "custom";
  document.body.dataset.taskbarStyle = "glass";
  document.body.dataset.iconPack = "mono";
  document.body.dataset.bootStyle = "classic";
  velofyArtwork.src = theme.image;
  velofyArtwork.alt = `${theme.name || "Custom"} wallpaper`;
  storage.set("vel-wallpaper", "custom");
  storage.set("vel-theme-pack", "custom");
  settingsWallpaperButtons.forEach((button) => button.classList.remove("is-active"));
  setCustomThemeStatus(`${theme.name || "Custom theme"} active.`, "live");
  return true;
}

function getCurrentWallpaperInfo() {
  if (currentWallpaperKey === "custom") {
    const theme = readStoredJson(VEL_CUSTOM_THEME_KEY, null);
    if (theme?.image) {
      return {
        label: theme.name || "Custom Theme",
        path: theme.image
      };
    }
  }
  return wallpaperOptions[currentWallpaperKey] || wallpaperOptions.vel;
}

function createCustomTheme() {
  if (!customThemeDraft?.image) {
    setCustomThemeStatus("Pick an image first.", "warn");
    return;
  }
  if (velCredits < 500) {
    setCustomThemeStatus(`Need ${500 - velCredits} more VC.`, "warn");
    return;
  }
  velCredits -= 500;
  storage.set("vel-theme-credits", String(velCredits));
  const theme = {
    name: cleanVelChatName(customThemeName?.value || "") || "Custom Theme",
    image: customThemeDraft.image,
    createdAt: Date.now()
  };
  storage.set(VEL_CUSTOM_THEME_KEY, JSON.stringify(theme));
  applyCustomWallpaper(theme);
  renderThemeStore();
}

function readCustomThemeFile(file) {
  if (!file) return;
  if (!/^image\//i.test(file.type)) {
    setCustomThemeStatus("Pick an image file.", "warn");
    return;
  }
  if (file.size > 2_800_000) {
    setCustomThemeStatus("Image is too large. Pick a smaller wallpaper.", "warn");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    customThemeDraft = { image: String(reader.result || "") };
    setCustomThemeStatus(`${file.name} selected. Create costs 500 VC.`, "live");
  };
  reader.onerror = () => setCustomThemeStatus("Could not read that image.", "error");
  reader.readAsDataURL(file);
}

function applyWallpaper(key) {
  if (key === "custom" && applyCustomWallpaper()) return;
  const nextKey = wallpaperOptions[key] ? key : "vel";
  const choice = wallpaperOptions[nextKey];
  currentWallpaperKey = nextKey;

  document.documentElement.style.setProperty(
    "--wallpaper-image",
    `url("${choice.path}")`
  );
  velofyArtwork.src = choice.path;
  velofyArtwork.alt = `${choice.label} wallpaper`;

  settingsWallpaperButtons.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.wallpaperOption === nextKey
    );
  });

  storage.set("vel-wallpaper", nextKey);
}

function applyThemePack(key, shouldApplyWallpaper = true) {
  const nextKey = themePacks[key] ? key : "noir";
  const pack = themePacks[nextKey];
  currentThemePackKey = nextKey;
  document.body.dataset.themePack = nextKey;
  document.body.dataset.taskbarStyle = pack.taskbar;
  document.body.dataset.iconPack = pack.icon;
  document.body.dataset.bootStyle = pack.boot;
  if (shouldApplyWallpaper) {
    applyWallpaper(pack.wallpaper);
  }
  storage.set("vel-theme-pack", nextKey);
  renderThemeStore();
}

function unlockOrApplyThemePack(key) {
  const pack = themePacks[key];
  if (!pack) return;
  const unlocked = unlockedThemePacks.includes(key);
  if (!unlocked) {
    if (velCredits < pack.cost) {
      if (themeCreditBalance) {
        themeCreditBalance.textContent = `Need ${pack.cost - velCredits} VC`;
        window.setTimeout(renderThemeStore, 1100);
      }
      return;
    }
    velCredits -= pack.cost;
    unlockedThemePacks = [...new Set([...unlockedThemePacks, key])];
    storage.set("vel-theme-credits", String(velCredits));
    persistThemeUnlocks();
  }
  applyThemePack(key);
}

function applyFont(key) {
  const nextKey = ["system", "serif", "rounded"].includes(key)
    ? key
    : "system";
  currentFontKey = nextKey;

  document.body.dataset.font = nextKey;
  settingsFontButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.fontOption === nextKey);
  });

  storage.set("vel-font", nextKey);
}

function updateNowPlayingUi() {
  if (currentVelofyMode === "spotify") {
    const spotifyTrack = getCurrentSpotifyTrack();
    const text = spotifyTrack
      ? `${spotifyTrack.title} - ${spotifyTrack.subtitle}`
      : "Spotify - Velofy";
    nowPlayingChip.hidden = false;
    taskbarNowPlaying.hidden = false;
    nowPlayingText.textContent = text;
    taskbarNowPlayingText.textContent = spotifyTrack?.title || "Spotify";
    document.body.classList.add("is-music-playing");
    velofyState.textContent = "Spotify Embed";
    velofyPlay.textContent = "Open";
    if (taskbarPlayButton) taskbarPlayButton.textContent = "Open";
    return;
  }

  const track = velofyTracks[currentTrackIndex];
  const isPlaying = !audioElement.paused;
  const text = `${track.title} - ${track.artist}`;

  nowPlayingChip.hidden = !isPlaying;
  taskbarNowPlaying.hidden = !isPlaying;
  nowPlayingText.textContent = text;
  taskbarNowPlayingText.textContent = track.title;
  document.body.classList.toggle("is-music-playing", isPlaying);
  velofyState.textContent = isPlaying ? "Playing" : "Paused";
  velofyPlay.textContent = isPlaying ? "Pause" : "Play";
  if (taskbarPlayButton) {
    taskbarPlayButton.textContent = isPlaying ? "Pause" : "Play";
  }
}

function normalizeLyricsKey(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function getTrackLyricsKeys(track) {
  if (!track) return [];
  const srcName = String(track.src || "").split("/").pop() || "";
  const aliasKeys = Array.isArray(track.lyricsAliases)
    ? track.lyricsAliases.map((alias) => normalizeLyricsKey(alias))
    : [];
  return [...new Set([
    ...aliasKeys,
    normalizeLyricsKey(track.title),
    normalizeLyricsKey(`${track.artist} ${track.title}`),
    normalizeLyricsKey(srcName)
  ].filter(Boolean))];
}

function parseLyricsText(text = "") {
  const raw = String(text).replace(/^\uFEFF/, "").replace(/\r/g, "");
  const timestampPattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const timedLines = [];
  const plainLines = [];
  let gapBefore = false;

  raw.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      gapBefore = plainLines.length > 0 || timedLines.length > 0;
      return;
    }

    const matches = [...line.matchAll(timestampPattern)];
    const textOnly = line.replace(timestampPattern, "").trim();
    if (matches.length && textOnly) {
      matches.forEach((match) => {
        const minutes = Number.parseInt(match[1], 10) || 0;
        const seconds = Number.parseInt(match[2], 10) || 0;
        const fractionRaw = match[3] || "";
        const fraction = fractionRaw
          ? (Number.parseInt(fractionRaw, 10) || 0) / (fractionRaw.length === 3 ? 1000 : 100)
          : 0;

        timedLines.push({
          text: textOnly,
          time: Math.max(0, (minutes * 60) + seconds + fraction),
          gapBefore
        });
      });
      gapBefore = false;
      return;
    }

    plainLines.push({
      text: trimmed,
      gapBefore
    });
    gapBefore = false;
  });

  if (timedLines.length) {
    return {
      raw,
      mode: "timed",
      lines: timedLines.sort((left, right) => left.time - right.time)
    };
  }

  return {
    raw,
    mode: plainLines.length ? "plain" : "empty",
    lines: plainLines
  };
}

function normalizeLyricsEntry(entry) {
  if (!entry) return null;

  if (typeof entry === "string") {
    return parseLyricsText(entry);
  }

  if (typeof entry.raw === "string" && !Array.isArray(entry.lines)) {
    return parseLyricsText(entry.raw);
  }

  if (!Array.isArray(entry.lines)) {
    return null;
  }

  const mode = entry.mode === "timed" ? "timed" : "plain";
  const lines = entry.lines
    .map((line) => {
      const text = String(line?.text || "").trim();
      if (!text) return null;

      return {
        text,
        time: Number.isFinite(Number(line?.time))
          ? Math.max(0, Number(line.time))
          : 0,
        gapBefore: Boolean(line?.gapBefore)
      };
    })
    .filter(Boolean);

  return {
    raw: typeof entry.raw === "string" ? entry.raw : lines.map((line) => line.text).join("\n"),
    mode: lines.length ? mode : "empty",
    lines
  };
}

function buildBundledLyricsLibrary(sourceLibrary = {}) {
  return Object.entries(sourceLibrary).reduce((library, [key, value]) => {
    const normalizedKey = normalizeLyricsKey(key);
    const parsed = normalizeLyricsEntry(value);
    if (normalizedKey && parsed?.lines?.length) {
      library[normalizedKey] = parsed;
    }
    return library;
  }, {});
}

function getLyricsSyncStorageKey(track) {
  if (!track) return "";
  const srcName = String(track.src || "").split("/").pop() || "";
  return normalizeLyricsKey(srcName)
    || normalizeLyricsKey(`${track.artist} ${track.title}`)
    || normalizeLyricsKey(track.title);
}

function formatLyricsSyncOffset(offset = 0) {
  const value = Math.abs(Math.round((Number(offset) || 0) * 100) / 100).toFixed(2);
  const sign = (Number(offset) || 0) >= 0 ? "+" : "-";
  return `${sign}${value}s`;
}

function getLyricsSyncOffset(track) {
  const key = getLyricsSyncStorageKey(track);
  const value = Number(lyricsSyncOffsets[key]);
  return Number.isFinite(value) ? value : 0;
}

function setLyricsSyncOffset(track, offset) {
  const key = getLyricsSyncStorageKey(track);
  if (!key) return 0;

  const nextOffset = Math.max(-18, Math.min(18, Math.round((Number(offset) || 0) * 100) / 100));
  if (Math.abs(nextOffset) < 0.01) {
    delete lyricsSyncOffsets[key];
  } else {
    lyricsSyncOffsets[key] = nextOffset;
  }

  storage.set("vel-lyrics-sync-offsets", JSON.stringify(lyricsSyncOffsets));
  return nextOffset;
}

function getLyricsEntryForTrack(track) {
  const keys = getTrackLyricsKeys(track);
  for (const key of keys) {
    const importedEntry = normalizeLyricsEntry(lyricsLibrary[key]);
    if (importedEntry?.lines?.length) {
      return { key, entry: importedEntry, source: "imported" };
    }

    if (bundledLyricsLibrary[key]?.lines?.length) {
      return { key, entry: bundledLyricsLibrary[key], source: "bundled" };
    }
  }
  return null;
}

function buildTimedLyricsTimeline(lines, duration = 0) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;

  return lines.map((line, index) => {
    const nextStart = lines[index + 1]?.time;
    const fallbackEnd = safeDuration || (line.time + 4);

    return {
      text: line.text,
      gapBefore: Boolean(line.gapBefore),
      start: Math.max(0, line.time),
      end: nextStart
        ? Math.max(line.time + 0.2, nextStart - 0.05)
        : Math.max(line.time + 2.4, fallbackEnd)
    };
  });
}

function buildAutoTimedLyricsTimeline(lines, duration = 0) {
  if (!lines.length) return [];

  const weightedDuration = lines.reduce((total, line) => {
    const wordCount = line.text.split(/\s+/).filter(Boolean).length;
    return total + Math.max(1.9, (wordCount * 0.72) + (line.gapBefore ? 0.95 : 0));
  }, 0);

  const safeDuration = Number.isFinite(duration) && duration > 1
    ? duration
    : Math.max(26, weightedDuration + 2.6);
  const averageSlot = safeDuration / Math.max(lines.length, 1);
  const leadIn = Math.min(9.5, Math.max(0.85, averageSlot * 1.2));
  const leadOut = Math.min(6, Math.max(0.9, averageSlot * 0.85));
  const usableDuration = Math.max(lines.length * 1.65, safeDuration - leadIn - leadOut);
  const weights = lines.map((line) => {
    const textLength = line.text.replace(/\s+/g, " ").length;
    const wordCount = line.text.split(/\s+/).filter(Boolean).length;
    const shortHookBoost = textLength <= 16 ? 0.9 : 0;
    const drawnOutBoost = /(whoa|woah|ooh|oh|yeah|uh|ah|la|na|ayy|hey|baby)/i.test(line.text)
      ? 0.55
      : 0;
    const punctuationBoost = /[!?.,]/.test(line.text) ? 0.15 : 0;
    return Math.max(
      2,
      Math.min(
        8.8,
        (textLength / 17)
          + (wordCount * 0.5)
          + shortHookBoost
          + drawnOutBoost
          + punctuationBoost
          + (line.gapBefore ? 1.1 : 0)
      )
    );
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;

  let cursor = leadIn;
  return lines.map((line, index) => {
    const slot = usableDuration * (weights[index] / totalWeight);
    const start = cursor;
    cursor += slot;

    return {
      text: line.text,
      gapBefore: Boolean(line.gapBefore),
      start,
      end: index === lines.length - 1 ? safeDuration : cursor
    };
  });
}

function buildLyricsState(track) {
  const resolved = getLyricsEntryForTrack(track);
  if (!resolved) {
    return {
      key: "",
      lines: [],
      mode: "empty",
      source: "none",
      activeIndex: -1,
      syncOffset: 0
    };
  }

  const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
  const lines = resolved.entry.mode === "timed"
    ? buildTimedLyricsTimeline(resolved.entry.lines, duration)
    : buildAutoTimedLyricsTimeline(resolved.entry.lines, duration);
  const syncOffset = getLyricsSyncOffset(track);

  return {
    key: resolved.key,
    lines,
    mode: resolved.entry.mode,
    source: resolved.source,
    activeIndex: -1,
    syncOffset
  };
}

function getActiveLyricsIndex(currentTime = 0) {
  if (!currentLyricsState.lines.length) return -1;
  const adjustedTime = (currentTime || 0) - (currentLyricsState.syncOffset || 0);
  if (adjustedTime < 0) return -1;

  for (let index = currentLyricsState.lines.length - 1; index >= 0; index -= 1) {
    if (adjustedTime >= currentLyricsState.lines[index].start) {
      return index;
    }
  }

  return -1;
}

function syncLyricsPlayback(force = false) {
  if (!lyricsContent || !currentLyricsState.lines.length) return;

  const nextIndex = getActiveLyricsIndex(audioElement.currentTime || 0);
  if (!force && nextIndex === currentLyricsState.activeIndex) return;

  currentLyricsState.activeIndex = nextIndex;
  lyricsContent.querySelectorAll(".lyrics-line").forEach((lineElement) => {
    const lineIndex = Number(lineElement.dataset.lyricIndex);
    const isActive = lineIndex === nextIndex;
    const isPast = nextIndex >= 0 && lineIndex < nextIndex;

    lineElement.classList.toggle("is-active", isActive);
    lineElement.classList.toggle("is-past", isPast);
    lineElement.setAttribute("aria-current", isActive ? "true" : "false");
  });

  const activeLine = nextIndex >= 0
    ? lyricsContent.querySelector(`[data-lyric-index="${nextIndex}"]`)
    : null;

  if (activeLine) {
    activeLine.scrollIntoView({
      block: "nearest",
      behavior: force ? "auto" : "smooth"
    });
  }
}

function makeLyricsNote(message = "") {
  if (!currentLyricsState.lines.length) {
    return message || "Drop a .txt or .lrc lyric file here";
  }

  const sourceLabel = currentLyricsState.source === "imported"
    ? "loaded lyrics"
    : "built-in lyrics";
  const syncLabel = currentLyricsState.mode === "timed"
    ? "timestamp sync"
    : "auto sync from song timing";
  const offsetLabel = `sync ${formatLyricsSyncOffset(currentLyricsState.syncOffset || 0)}`;

  return message
    ? `${message} - ${sourceLabel}, ${syncLabel}, ${offsetLabel}`
    : `${sourceLabel}, ${syncLabel}, ${offsetLabel}`;
}

function updateLyricsSyncReadout() {
  if (!lyricsSyncReadout) return;
  lyricsSyncReadout.textContent = `Sync ${formatLyricsSyncOffset(currentLyricsState.syncOffset || 0)}`;
}

function nudgeLyricsSync(delta) {
  const track = velofyTracks[currentTrackIndex];
  if (!track) return;
  const nextOffset = setLyricsSyncOffset(track, getLyricsSyncOffset(track) + delta);
  renderLyricsWidget(`Sync adjusted ${formatLyricsSyncOffset(nextOffset)}`);
}

function resetLyricsSync() {
  const track = velofyTracks[currentTrackIndex];
  if (!track) return;
  setLyricsSyncOffset(track, 0);
  renderLyricsWidget("Sync reset");
}

function syncLyricsFromLine(lineIndex) {
  const track = velofyTracks[currentTrackIndex];
  const line = currentLyricsState.lines[lineIndex];
  if (!track || !line) return;

  const nextOffset = setLyricsSyncOffset(track, (audioElement.currentTime || 0) - line.start);
  renderLyricsWidget(`Synced to line ${lineIndex + 1} at ${formatLyricsSyncOffset(nextOffset)}`);
}

function setLyricsWidgetCollapsed(collapsed) {
  lyricsWidgetCollapsed = Boolean(collapsed);
  storage.set("vel-lyrics-collapsed", lyricsWidgetCollapsed ? "1" : "0");
  lyricsWidget?.classList.toggle("is-collapsed", lyricsWidgetCollapsed);
  if (lyricsCollapseButton) {
    lyricsCollapseButton.textContent = lyricsWidgetCollapsed ? "Open" : "Min";
  }
}

function setLyricsWidgetHidden(hidden) {
  lyricsWidgetHidden = Boolean(hidden);
  storage.set("vel-lyrics-hidden", lyricsWidgetHidden ? "1" : "0");
  lyricsWidget?.classList.toggle("is-hidden", lyricsWidgetHidden);
  if (lyricsShowButton) {
    lyricsShowButton.hidden = !lyricsWidgetHidden;
  }
}

function renderLyricsWidget(message = "") {
  if (!lyricsWidget || !lyricsTrackTitle || !lyricsTrackArtist || !lyricsWidgetNote || !lyricsContent) {
    return;
  }

  const track = velofyTracks[currentTrackIndex];
  if (!track) return;

  lyricsTrackTitle.textContent = track.title;
  lyricsTrackArtist.textContent = track.artist;

  currentLyricsState = buildLyricsState(track);
  lyricsWidget.classList.toggle("is-empty", !currentLyricsState.lines.length);
  lyricsWidgetNote.textContent = makeLyricsNote(message);
  updateLyricsSyncReadout();
  lyricsContent.innerHTML = "";

  if (!currentLyricsState.lines.length) {
    lyricsContent.textContent = "No lyrics loaded for this track yet.";
    setLyricsWidgetCollapsed(lyricsWidgetCollapsed);
    setLyricsWidgetHidden(lyricsWidgetHidden);
    return;
  }

  const fragment = document.createDocumentFragment();
  currentLyricsState.lines.forEach((line, index) => {
    const lineElement = document.createElement("p");
    lineElement.className = `lyrics-line${line.gapBefore ? " has-gap" : ""}`;
    lineElement.dataset.lyricIndex = String(index);
    lineElement.textContent = line.text;
    lineElement.title = "Click this line to sync it to the current playback moment.";
    fragment.appendChild(lineElement);
  });
  lyricsContent.appendChild(fragment);
  syncLyricsPlayback(true);
  setLyricsWidgetCollapsed(lyricsWidgetCollapsed);
  setLyricsWidgetHidden(lyricsWidgetHidden);
}

bundledLyricsLibrary = buildBundledLyricsLibrary(window.__VELOFY_BUNDLED_LYRICS__ || {});

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizeSearchText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesSearchQuery(parts, query) {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  return normalizeSearchText(parts.filter(Boolean).join(" ")).includes(needle);
}

function normalizeVelofySpotifyTrack(item) {
  if (!item?.id) return null;
  return {
    id: item.id,
    type: item.type || "track",
    title: item.title || "Spotify Track",
    subtitle: item.subtitle || "Spotify",
    image: item.image || "",
    externalUrl: item.externalUrl || `https://open.spotify.com/track/${item.id}`
  };
}

function getCurrentSpotifyTrack() {
  return currentSpotifyTrack
    || savedSpotifyTracks.find((track) => track.id === currentSpotifyTrackId)
    || velofySpotifySearchResults.find((track) => track.id === currentSpotifyTrackId)
    || null;
}

function persistSavedSpotifyTracks() {
  storage.set("velofy-spotify-tracks", JSON.stringify(savedSpotifyTracks));
}

function saveVelofySpotifyTrack(item) {
  const track = normalizeVelofySpotifyTrack(item);
  if (!track) return null;
  savedSpotifyTracks = [
    track,
    ...savedSpotifyTracks.filter((saved) => saved.id !== track.id)
  ].slice(0, 250);
  persistSavedSpotifyTracks();
  renderPlaylist();
  return track;
}

function showLocalVelofyPlayer() {
  currentVelofyMode = "local";
  currentSpotifyTrackId = "";
  currentSpotifyTrack = null;
  if (velofySpotifyPlayer) {
    velofySpotifyPlayer.hidden = true;
    velofySpotifyPlayer.innerHTML = "";
  }
  velofyProgress.disabled = false;
}

function openVelofySpotifyTrack(item, { save = false } = {}) {
  const track = save ? saveVelofySpotifyTrack(item) : normalizeVelofySpotifyTrack(item);
  if (!track) return;
  currentVelofyMode = "spotify";
  currentSpotifyTrackId = track.id;
  currentSpotifyTrack = track;

  audioElement.pause();
  velofyTitle.textContent = track.title;
  velofyArtist.textContent = track.subtitle;
  velofyState.textContent = "Spotify Embed";
  velofyPlay.textContent = "Open";
  velofyElapsed.textContent = "Spotify";
  velofyDuration.textContent = "Embed";
  velofyProgress.value = "0";
  velofyProgress.disabled = true;
  if (track.image) {
    velofyArtwork.src = track.image;
    velofyArtwork.alt = `${track.title} artwork`;
    setVelofyArtworkBackground(track.image);
  }
  if (velofySpotifyPlayer) {
    velofySpotifyPlayer.hidden = false;
    velofySpotifyPlayer.innerHTML = `
      <iframe
        title="${escapeHtml(track.title)} on Spotify"
        src="https://open.spotify.com/embed/track/${encodeURIComponent(track.id)}"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy">
      </iframe>
    `;
  }
  recordVelofyRecent(getVelofySpotifyRef(track.id));
  updateNowPlayingUi();
  renderPlaylist();
}

function renderVelofySpotifyResults() {
  if (!velofySpotifyResults) return;

  if (velofySpotifyLoading) {
    velofySpotifyResults.innerHTML = Array.from({ length: 4 }, () => `
      <article class="spotify-result-card is-loading">
        <div class="spotify-result-art"></div>
        <div><strong>Searching Spotify</strong><span>Loading tracks...</span></div>
      </article>
    `).join("");
    return;
  }

  if (velofySpotifyError) {
    velofySpotifyResults.innerHTML = `
      <article class="spotify-result-card">
        <div class="spotify-result-art"></div>
        <div><strong>Spotify could not load</strong><span>${escapeHtml(velofySpotifyError)}</span></div>
      </article>
    `;
    return;
  }

  if (!velofySpotifySearchResults.length) {
    velofySpotifyResults.innerHTML = `
      <article class="spotify-result-card">
        <div class="spotify-result-art">SP</div>
        <div><strong>Search Spotify</strong><span>Find tracks and save them into Velofy.</span></div>
      </article>
    `;
    return;
  }

  velofySpotifyResults.innerHTML = velofySpotifySearchResults.map((track) => {
    const isSaved = savedSpotifyTracks.some((saved) => saved.id === track.id);
    return `
      <article class="spotify-result-card">
        ${track.image ? `<img class="spotify-result-art" src="${escapeHtml(track.image)}" alt="" loading="lazy" />` : '<div class="spotify-result-art">SP</div>'}
        <div>
          <strong>${escapeHtml(track.title)}</strong>
          <span>${escapeHtml(track.subtitle || "Spotify")}</span>
        </div>
        <div class="spotify-result-actions">
          <button type="button" data-velofy-spotify-play="${escapeHtml(track.id)}">Play</button>
          <button type="button" data-velofy-spotify-save="${escapeHtml(track.id)}">${isSaved ? "Saved" : "Save"}</button>
        </div>
      </article>
    `;
  }).join("");
}

async function searchVelofySpotify() {
  const query = (velofySpotifySearch?.value || velofySpotifySearchQuery || "").trim();
  if (!query) {
    velofySpotifySearchResults = [];
    velofySpotifyError = "";
    renderVelofySpotifyResults();
    return;
  }

  velofySpotifySearchQuery = query;
  storage.set("velofy-spotify-query", query);
  velofySpotifyLoading = true;
  velofySpotifyError = "";
  renderVelofySpotifyResults();

  try {
    const params = new URLSearchParams({ q: query, type: "track" });
    const response = await fetch(`/api/spotify/search?${params}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Spotify search failed.");
    }
    velofySpotifySearchResults = (data.tracks || []).map(normalizeVelofySpotifyTrack).filter(Boolean);
  } catch (error) {
    velofySpotifyError = error.message || "Spotify search could not load.";
    velofySpotifySearchResults = [];
  } finally {
    velofySpotifyLoading = false;
    renderVelofySpotifyResults();
  }
}

function isLikelyIpad() {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /iPad/i.test(userAgent)
    || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function persistVelofyPlaylists() {
  storage.set("velofy-custom-playlists", JSON.stringify(velofyCustomPlaylists.slice(0, 24)));
}

function persistVelofyRecentTracks() {
  storage.set("velofy-recent-tracks", JSON.stringify(velofyRecentTrackRefs.slice(0, 40)));
}

function getVelofyLocalRef(index) {
  return `local:${index}`;
}

function getVelofySpotifyRef(id) {
  return `spotify:${id}`;
}

function getVelofyTrackByRef(ref = "") {
  if (ref.startsWith("local:")) {
    const index = Number.parseInt(ref.slice(6), 10);
    const track = velofyTracks[index];
    return track ? { ref, type: "local", index, title: track.title, subtitle: track.artist, track } : null;
  }
  if (ref.startsWith("spotify:")) {
    const id = ref.slice(8);
    const track = savedSpotifyTracks.find((item) => item.id === id);
    return track ? { ref, type: "spotify", id, title: track.title, subtitle: `${track.subtitle || "Spotify"} - Spotify`, track } : null;
  }
  return null;
}

function getVelofyAllRefs() {
  return [
    ...velofyTracks.map((track, index) => getVelofyLocalRef(index)),
    ...savedSpotifyTracks.map((track) => getVelofySpotifyRef(track.id))
  ];
}

function getActiveVelofyPlaylist() {
  if (!velofyPlaylistMode.startsWith("custom:")) return null;
  const id = velofyPlaylistMode.slice(7);
  return velofyCustomPlaylists.find((playlist) => playlist.id === id) || null;
}

function getVelofyDisplayRefs() {
  if (velofyPlaylistMode === "recent") return velofyRecentTrackRefs;
  const custom = getActiveVelofyPlaylist();
  if (custom) return custom.refs || [];
  return getVelofyAllRefs();
}

function renderVelofyPlaylistSelect() {
  if (!velofyPlaylistSelect) return;
  const options = [
    '<option value="all">All Songs</option>',
    '<option value="recent">Recently Played</option>',
    ...velofyCustomPlaylists.map((playlist) => `<option value="custom:${escapeHtml(playlist.id)}">${escapeHtml(playlist.name)}</option>`)
  ];
  velofyPlaylistSelect.innerHTML = options.join("");
  if (![...velofyPlaylistSelect.options].some((option) => option.value === velofyPlaylistMode)) {
    velofyPlaylistMode = "all";
  }
  velofyPlaylistSelect.value = velofyPlaylistMode;
  if (velofyShuffleButton) {
    velofyShuffleButton.classList.toggle("is-active", velofyShuffleEnabled);
    velofyShuffleButton.setAttribute("aria-pressed", String(velofyShuffleEnabled));
  }
}

function getTargetVelofyPlaylist() {
  let playlist = getActiveVelofyPlaylist() || velofyCustomPlaylists[0];
  if (!playlist) {
    playlist = { id: `mix-${Date.now()}`, name: "My Mix", refs: [] };
    velofyCustomPlaylists.unshift(playlist);
    persistVelofyPlaylists();
    renderVelofyPlaylistSelect();
  }
  return playlist;
}

function addVelofyRefToPlaylist(ref) {
  const item = getVelofyTrackByRef(ref);
  if (!item) return;
  const playlist = getTargetVelofyPlaylist();
  playlist.refs = [...new Set([...(playlist.refs || []), ref])].slice(0, 200);
  persistVelofyPlaylists();
  renderVelofyPlaylistSelect();
  renderPlaylist();
  if (velofyPlaylistNote) velofyPlaylistNote.textContent = `Saved "${item.title}" to ${playlist.name}.`;
}

function recordVelofyRecent(ref, shouldAward = true) {
  if (!getVelofyTrackByRef(ref)) return;
  const isNewRecent = !velofyRecentTrackRefs.includes(ref);
  velofyRecentTrackRefs = [
    ref,
    ...velofyRecentTrackRefs.filter((item) => item !== ref)
  ].slice(0, 40);
  persistVelofyRecentTracks();
  if (shouldAward && isNewRecent) awardVelCredits(2);
}

function playVelofyRef(ref, shouldPlay = true) {
  const item = getVelofyTrackByRef(ref);
  if (!item) return;
  if (item.type === "spotify") {
    openVelofySpotifyTrack(item.track);
    return;
  }
  loadTrack(item.index, shouldPlay);
}

function getCurrentVelofyRef() {
  return currentVelofyMode === "spotify"
    ? getVelofySpotifyRef(currentSpotifyTrackId)
    : getVelofyLocalRef(currentTrackIndex);
}

function createVelofyPlaylist() {
  const name = window.prompt("Name the new Velofy playlist:", "New Mix");
  const cleanName = String(name || "").trim().slice(0, 32);
  if (!cleanName) return;
  const playlist = {
    id: `mix-${Date.now()}`,
    name: cleanName,
    refs: []
  };
  velofyCustomPlaylists.unshift(playlist);
  velofyPlaylistMode = `custom:${playlist.id}`;
  storage.set("velofy-playlist-mode", velofyPlaylistMode);
  persistVelofyPlaylists();
  renderVelofyPlaylistSelect();
  renderPlaylist();
}

function setVelofyArtworkBackground(url) {
  const safeUrl = url || getCurrentWallpaperInfo().path;
  drawers.music?.querySelector(".music-player-card")?.style.setProperty("--velofy-artwork-image", `url("${safeUrl}")`);
}

function loadTrack(index, shouldPlay = false) {
  showLocalVelofyPlayer();
  currentTrackIndex = (index + velofyTracks.length) % velofyTracks.length;
  const track = velofyTracks[currentTrackIndex];
  const wallpaper = getCurrentWallpaperInfo();
  velofyArtwork.src = wallpaper.path;
  velofyArtwork.alt = `${wallpaper.label} wallpaper`;
  setVelofyArtworkBackground(wallpaper.path);
  audioElement.src = track.src;
  velofyTitle.textContent = track.title;
  velofyArtist.textContent = track.artist;
  velofyPlaylist
    .querySelectorAll(".track-button")
    .forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.trackIndex) === currentTrackIndex);
    });

  if (shouldPlay) {
    audioElement
      .play()
      .then(updateNowPlayingUi)
      .catch(() => updateNowPlayingUi());
  } else {
    audioElement.load();
    updateNowPlayingUi();
  }
  recordVelofyRecent(getVelofyLocalRef(currentTrackIndex), shouldPlay);
  renderLyricsWidget();
}

function renderPlaylist() {
  velofyPlaylist.innerHTML = "";
  renderVelofyPlaylistSelect();

  const activeCustom = getActiveVelofyPlaylist();
  const targetPlaylist = activeCustom || velofyCustomPlaylists[0] || null;
  const visibleItems = getVelofyDisplayRefs()
    .map(getVelofyTrackByRef)
    .filter(Boolean)
    .filter((item) => matchesSearchQuery([item.title, item.subtitle, item.type], velofySearchQuery));

  if (!visibleItems.length) {
    const emptyCopy = velofyPlaylistMode === "recent"
      ? "Play a few songs and they will show up here."
      : activeCustom
        ? "Use All Songs, then press + to add tracks to this playlist."
        : "No songs found.";
    velofyPlaylist.innerHTML = `<p class="playlist-empty">${emptyCopy}</p>`;
    if (velofyPlaylistNote) {
      velofyPlaylistNote.textContent = activeCustom
        ? `${activeCustom.name} has ${activeCustom.refs?.length || 0} saved track${(activeCustom.refs?.length || 0) === 1 ? "" : "s"}.`
        : "Local MP3s play with full Velofy controls. Save tracks into custom playlists with the + button.";
    }
    return;
  }

  const label = document.createElement("p");
  label.className = "playlist-group-label";
  label.textContent = velofyPlaylistMode === "recent"
    ? "Recently Played"
    : activeCustom
      ? activeCustom.name
      : "All Songs";
  velofyPlaylist.appendChild(label);

  visibleItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "track-row";
    const active = currentVelofyMode === item.type
      && (item.type === "local" ? item.index === currentTrackIndex : item.id === currentSpotifyTrackId);
    const alreadyInTarget = Boolean(targetPlaylist?.refs?.includes(item.ref));
    row.innerHTML = `
      <button
        type="button"
        class="track-button${item.type === "spotify" ? " spotify-track-button" : ""}${active ? " is-active" : ""}"
        ${item.type === "local" ? `data-track-index="${item.index}"` : `data-spotify-track-id="${escapeHtml(item.id)}"`}
      >
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.subtitle || (item.type === "spotify" ? "Spotify" : "Local MP3"))}</span>
      </button>
      <button
        class="track-add-button${alreadyInTarget ? " is-added" : ""}"
        type="button"
        data-velofy-add-ref="${escapeHtml(item.ref)}"
        aria-label="Add ${escapeHtml(item.title)} to a Velofy playlist"
      >${alreadyInTarget ? "In" : "+"}</button>
    `;
    velofyPlaylist.appendChild(row);
  });

  if (velofyPlaylistNote) {
    velofyPlaylistNote.textContent = activeCustom
      ? `${activeCustom.name} - shuffle, play, or add more from All Songs.`
      : "Local MP3s play with full Velofy controls. Save tracks into custom playlists with the + button.";
  }
}

function playVelofyOffset(delta) {
  const playableRefs = getVelofyDisplayRefs().filter((ref) => getVelofyTrackByRef(ref));
  if (velofyShuffleEnabled && playableRefs.length > 1) {
    const currentRef = getCurrentVelofyRef();
    const pool = playableRefs.filter((ref) => ref !== currentRef);
    playVelofyRef(pool[Math.floor(Math.random() * pool.length)], true);
    return;
  }

  if (playableRefs.length) {
    const currentRef = getCurrentVelofyRef();
    const currentIndexInList = Math.max(0, playableRefs.indexOf(currentRef));
    const nextRef = playableRefs[(currentIndexInList + delta + playableRefs.length) % playableRefs.length];
    playVelofyRef(nextRef, !audioElement.paused || currentVelofyMode === "spotify");
    return;
  }
  loadTrack(currentTrackIndex + delta, !audioElement.paused);
}

function openCurrentSpotifyExternal() {
  const track = getCurrentSpotifyTrack();
  if (track?.externalUrl) {
    window.open(track.externalUrl, "_blank", "noopener,noreferrer");
  }
}

function renderLauncherCatalog() {
  if (!launcherGameGrid) return;

  const categoryMeta = {
    games: ["Featured Games", "Big web catalog with source filters and quick-open recent apps."],
    local: ["Local Arcade", "Offline games that run directly inside vel.os."],
    tools: ["System Tools", "Utilities, settings, network status, and browser tools."],
    music: ["Music", "Velofy and music tools in one clean section."],
    movies: ["Movies", "Install Vel Hub for a huge in-app cinema catalog."],
    youtube: ["YouTube", "YouTube search, player, favorites, and Global Favs."]
  };
  const [sectionLabel, sectionNote] = categoryMeta[launcherStoreCategory] || categoryMeta.games;
  if (launcherSectionLabel) launcherSectionLabel.textContent = sectionLabel;
  if (launcherSectionNote) launcherSectionNote.textContent = sectionNote;
  appStoreButtons.forEach((button) => {
    const active = button.dataset.storeCategory === launcherStoreCategory;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  if (launcherStoreCategory !== "games") {
    if (gameSourceTabs) gameSourceTabs.hidden = true;
    if (launcherOfflineToggle) launcherOfflineToggle.hidden = true;
    const utilitySections = {
      tools: ["browser", "lobbies", "soundboard", "dev", "calculator", "settings", "network"],
      music: ["music"],
      movies: ["velhub"],
      youtube: ["youtube"]
    };
    const localItems = launcherStoreCategory === "local"
      ? Object.keys(localGameMeta)
        .map((gameId) => ({ id: gameId, ...localGameMeta[gameId], local: true }))
        .filter((game) => matchesSearchQuery([game.title, game.category, "offline local"], launcherGameQuery))
      : [];
    const utilityItems = (utilitySections[launcherStoreCategory] || [])
      .map((id) => ({ id, ...utilityApps[id] }))
      .filter((app) => app.title && matchesSearchQuery([app.title, app.label, launcherStoreCategory], launcherGameQuery));
    const localCards = localItems.map((game) => renderStoreCard({
      ref: `game:${game.id}`,
      meta: {
          title: game.title,
          badgeSrc: createGameBadgeSrc(game.title, game.category),
          badgeText: game.title.slice(0, 2).toUpperCase()
      },
      title: game.title,
      subtitle: `Local - ${game.category}`,
      openLabel: "Play"
    }));
    const utilityCards = utilityItems.map((app) => {
      const ref = app.action === "web"
        ? "web:browser"
        : app.action === "game"
          ? `game:${app.gameId || "snake"}`
          : `panel:${app.panel || app.id}`;
      const meta = app.action === "web" ? utilityApps.browser : app;
      return renderStoreCard({
        ref,
        meta,
        title: app.title,
        subtitle: `${app.label || app.title} - vel.os`,
        openLabel: app.action === "game" ? "Play" : "Open"
      });
    });
    launcherGameGrid.innerHTML = [...utilityCards, ...localCards].join("");
    if (!launcherGameGrid.innerHTML) {
      launcherGameGrid.innerHTML = '<p class="catalog-empty">No apps found.</p>';
    }
    if (catalogCount) {
      const total = launcherStoreCategory === "local" ? Object.keys(localGameMeta).length : utilityItems.length;
      const visible = localItems.length + utilityItems.length;
      catalogCount.textContent = launcherGameQuery ? `${visible} / ${total} apps` : `${total} apps`;
    }
    return;
  }

  if (gameSourceTabs) gameSourceTabs.hidden = false;
  if (launcherOfflineToggle) launcherOfflineToggle.hidden = false;

  const localGameIds = Object.keys(localGameMeta);
  const wantsLocal = launcherGameSource === "all" || launcherGameSource === "local";
  const wantsWeb = launcherGameSource === "all" || launcherGameSource !== "local";
  const localItems = wantsLocal
    ? localGameIds
      .map((gameId) => ({ id: gameId, ...localGameMeta[gameId], local: true }))
      .filter((game) => matchesSearchQuery([game.title, game.category, "offline local"], launcherGameQuery))
    : [];
  const webItems = launcherOfflineOnly || !wantsWeb
    ? []
    : gameCatalog.filter((game) => {
      const sourceMatches = launcherGameSource === "all" || game.source === launcherGameSource;
      return sourceMatches && matchesSearchQuery(
        [game.title, game.category, getGameSourceLabel(game.source)],
        launcherGameQuery
      );
    });

  const localCards = localItems.map((game) => renderStoreCard({
    ref: `game:${game.id}`,
    meta: {
          title: game.title,
          badgeSrc: createGameBadgeSrc(game.title, game.category),
          badgeText: game.title.slice(0, 2).toUpperCase()
    },
    title: game.title,
    subtitle: `Local - ${game.category}`,
    openLabel: "Play"
  }));

  const webCards = webItems.map((game) => {
    const app = webApps[game.id];
    return renderStoreCard({
      ref: `web:${game.id}`,
      meta: app,
      title: game.title,
      subtitle: `${getGameSourceLabel(game.source)} - ${game.category}`,
      openLabel: "Play"
    });
  });

  launcherGameGrid.innerHTML = [...localCards, ...webCards].join("");
  if (!launcherGameGrid.innerHTML) {
    launcherGameGrid.innerHTML = '<p class="catalog-empty">No games found.</p>';
  }

  if (catalogCount) {
    const totalLocal = wantsLocal ? localGameIds.length : 0;
    const totalWeb = launcherOfflineOnly || !wantsWeb
      ? 0
      : gameCatalog.filter((game) => launcherGameSource === "all" || game.source === launcherGameSource).length;
    const totalCount = totalLocal + totalWeb;
    const visibleCount = localItems.length + webItems.length;
    const suffix = launcherGameSource === "all"
      ? launcherOfflineOnly ? "offline games" : "games"
      : `${getGameSourceLabel(launcherGameSource)} games`;
    catalogCount.textContent = launcherGameQuery
      ? `${visibleCount} / ${totalCount} ${suffix}`
      : `${totalCount} ${suffix}`;
  }

  if (launcherOfflineToggle) {
    launcherOfflineToggle.classList.toggle("is-active", launcherOfflineOnly);
    launcherOfflineToggle.setAttribute("aria-pressed", String(launcherOfflineOnly));
  }

  gameSourceButtons.forEach((button) => {
    const isActive = button.dataset.gameSource === launcherGameSource;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function applyDensity(key) {
  currentDensityKey = key === "compact" ? "compact" : "roomy";
  document.body.dataset.density = currentDensityKey;
  settingsDensityButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.densityOption === currentDensityKey);
  });
  storage.set("vel-density", currentDensityKey);
}

function applyZoom(key) {
  const nextKey = ["normal", "out", "mini", "ipad"].includes(key) ? key : "normal";
  currentZoomKey = nextKey;
  document.body.dataset.zoom = currentZoomKey;
  settingsZoomButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.zoomOption === currentZoomKey);
  });
  storage.set("vel-zoom", currentZoomKey);
}

function applyTaskbarPosition(position = "bottom") {
  const nextPosition = ["bottom", "left", "right"].includes(position) ? position : "bottom";
  currentTaskbarPosition = nextPosition;
  document.body.dataset.taskbarPosition = nextPosition;
  storage.set(VEL_TASKBAR_POSITION_KEY, nextPosition);
  settingsTaskbarButtons.forEach((button) => {
    const active = button.dataset.taskbarPosition === nextPosition;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  homeTaskbarButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.homeTaskbar === nextPosition);
  });
}

function applyHomeClockPosition() {
  if (!heroClock) return;
  const position = readStoredJson(VEL_HOME_CLOCK_POSITION_KEY, { x: 0, y: 0 });
  heroClock.style.setProperty("--home-clock-x", `${Number(position?.x) || 0}px`);
  heroClock.style.setProperty("--home-clock-y", `${Number(position?.y) || 0}px`);
}

function saveHomeClockPosition(x = 0, y = 0) {
  storage.set(VEL_HOME_CLOCK_POSITION_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y) }));
}

function setHomeEditMode(active) {
  homeEditMode = Boolean(active);
  document.body.classList.toggle("is-home-editing", homeEditMode);
  if (homeEditToolbar) homeEditToolbar.hidden = !homeEditMode;
  if (homeEditMode) {
    closePanel("settings");
    setWelcomeStatus("Homescreen edit mode on. Drag the clock and app icons.", "live");
  }
}

function resetHomeLayout() {
  saveHomeClockPosition(0, 0);
  applyHomeClockPosition();
  saveDesktopShortcutOrder(getDefaultDesktopShortcutRefs());
  saveDesktopShortcutPositions({});
  applyTaskbarPosition("bottom");
  renderDesktopShortcuts();
}

function initHomeClockDrag() {
  if (!heroClock) return;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  const move = (event) => {
    if (!dragging) return;
    const nextX = clampNumber(originX + (event.clientX - startX), -30, window.innerWidth - 120);
    const nextY = clampNumber(originY + (event.clientY - startY), -30, window.innerHeight - 160);
    heroClock.style.setProperty("--home-clock-x", `${nextX}px`);
    heroClock.style.setProperty("--home-clock-y", `${nextY}px`);
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    heroClock.classList.remove("is-dragging");
    saveHomeClockPosition(
      Number.parseFloat(heroClock.style.getPropertyValue("--home-clock-x")) || 0,
      Number.parseFloat(heroClock.style.getPropertyValue("--home-clock-y")) || 0
    );
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };

  heroClock.addEventListener("pointerdown", (event) => {
    if (!homeEditMode || event.target.closest("button, input")) return;
    dragging = true;
    heroClock.classList.add("is-dragging");
    startX = event.clientX;
    startY = event.clientY;
    originX = Number.parseFloat(heroClock.style.getPropertyValue("--home-clock-x")) || 0;
    originY = Number.parseFloat(heroClock.style.getPropertyValue("--home-clock-y")) || 0;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  });
}

function applyWindowPosition(name) {
  const panel = drawers[name]?.querySelector(".drawer-panel");
  if (!panel) return;

  const position = windowPositions[name] || { x: 0, y: 0 };
  panel.style.setProperty("--drag-x", `${position.x || 0}px`);
  panel.style.setProperty("--drag-y", `${position.y || 0}px`);
}

function getTaskbarReserve() {
  const taskbar = document.querySelector(".taskbar");
  return (taskbar?.getBoundingClientRect().height || 56) + 10;
}

function clampNumber(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function saveWindowPosition(name, x, y) {
  windowPositions[name] = { x, y };
  storage.set("vel-window-positions", JSON.stringify(windowPositions));
}

function resetWindowPositions() {
  windowPositions = {};
  storage.set("vel-window-positions", JSON.stringify(windowPositions));
  Object.keys(drawers).forEach((name) => applyWindowPosition(name));
  applyLyricsWidgetPosition();
  setLyricsWidgetCollapsed(false);
  setLyricsWidgetHidden(false);
}

function initDraggableDrawers() {
  Object.entries(drawers).forEach(([name, drawer]) => {
    const panel = drawer?.querySelector(".drawer-panel");
    const head = panel?.querySelector(".drawer-head");
    if (!panel || !head) return;

    applyWindowPosition(name);

    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let dragging = false;
    let dragBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const move = (event) => {
      if (!dragging) return;
      const nextX = clampNumber(originX + (event.clientX - startX), dragBounds.minX, dragBounds.maxX);
      const nextY = clampNumber(originY + (event.clientY - startY), dragBounds.minY, dragBounds.maxY);
      panel.style.setProperty("--drag-x", `${nextX}px`);
      panel.style.setProperty("--drag-y", `${nextY}px`);
    };

    const stop = () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("is-dragging");
      const x = Number.parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
      const y = Number.parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;
      saveWindowPosition(name, x, y);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    head.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, input, a")) return;
      dragging = true;
      panel.classList.add("is-dragging");
      startX = event.clientX;
      startY = event.clientY;
      originX = Number.parseFloat(panel.style.getPropertyValue("--drag-x")) || 0;
      originY = Number.parseFloat(panel.style.getPropertyValue("--drag-y")) || 0;
      const rect = panel.getBoundingClientRect();
      const baseLeft = rect.left - originX;
      const baseRight = rect.right - originX;
      const baseTop = rect.top - originY;
      const baseBottom = rect.bottom - originY;
      const edgePadding = 8;
      dragBounds = {
        minX: edgePadding - baseLeft,
        maxX: window.innerWidth - edgePadding - baseRight,
        minY: edgePadding - baseTop,
        maxY: window.innerHeight - getTaskbarReserve() - baseBottom
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    });

    head.addEventListener("dblclick", () => {
      panel.style.setProperty("--drag-x", "0px");
      panel.style.setProperty("--drag-y", "0px");
      saveWindowPosition(name, 0, 0);
    });
  });
}

function canScrollVertically(node) {
  return Boolean(node && node.scrollHeight > node.clientHeight + 2);
}

function initAssistedScrollSurface(surface, scroller) {
  if (!surface || !scroller || surface.dataset.scrollAssistReady === "1") return;
  surface.dataset.scrollAssistReady = "1";

  const ignoreSelector = "input, textarea, select, iframe, video, audio, canvas, .drawer-head, [data-no-scroll-assist]";
  let dragScrolling = false;
  let suppressClick = false;
  let startY = 0;
  let startScrollTop = 0;

  surface.addEventListener("wheel", (event) => {
    if (!canScrollVertically(scroller)) return;
    if (event.target.closest(ignoreSelector)) return;
    if (scroller.contains(event.target)) return;
    scroller.scrollTop += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  const move = (event) => {
    if (!dragScrolling) return;
    const deltaY = event.clientY - startY;
    if (Math.abs(deltaY) < 5) return;
    suppressClick = true;
    scroller.scrollTop = startScrollTop - deltaY;
    event.preventDefault();
  };

  const stop = () => {
    dragScrolling = false;
    if (suppressClick) {
      window.setTimeout(() => {
        suppressClick = false;
      }, 120);
    }
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };

  surface.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    if (!canScrollVertically(scroller)) return;
    if (event.target.closest(ignoreSelector)) return;
    dragScrolling = true;
    suppressClick = false;
    startY = event.clientY;
    startScrollTop = scroller.scrollTop;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  });

  surface.addEventListener("click", (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  if (!("PointerEvent" in window)) {
    surface.addEventListener("touchstart", (event) => {
      if (!canScrollVertically(scroller)) return;
      if (event.target.closest(ignoreSelector)) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      dragScrolling = true;
      suppressClick = false;
      startY = touch.clientY;
      startScrollTop = scroller.scrollTop;
    }, { passive: true });

    surface.addEventListener("touchmove", (event) => {
      if (!dragScrolling) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaY) < 5) return;
      suppressClick = true;
      scroller.scrollTop = startScrollTop - deltaY;
      event.preventDefault();
    }, { passive: false });

    surface.addEventListener("touchend", stop, { passive: true });
    surface.addEventListener("touchcancel", stop, { passive: true });
  }
}

function initScrollAssist() {
  initAssistedScrollSurface(drawers.launcher?.querySelector(".drawer-panel"), launcherGameGrid);
  initAssistedScrollSurface(youtubePanel, youtubeResultsGrid);
  initAssistedScrollSurface(drawers.music?.querySelector(".drawer-panel"), velofyPlaylist);
  initAssistedScrollSurface(drawers.ai?.querySelector(".drawer-panel"), aiMessagesEl);
  initAssistedScrollSurface(drawers.settings?.querySelector(".drawer-panel"), drawers.settings?.querySelector(".settings-layout"));
  initAssistedScrollSurface(drawers.web?.querySelector(".drawer-panel"), webFrameHelper);
}

function applyLyricsWidgetPosition() {
  if (!lyricsWidget) return;
  const position = windowPositions.lyricsWidget || { x: 0, y: 0 };
  lyricsWidget.style.setProperty("--drag-x", `${position.x || 0}px`);
  lyricsWidget.style.setProperty("--drag-y", `${position.y || 0}px`);
}

function initDraggableLyricsWidget() {
  if (!lyricsWidget || !lyricsWidgetHead) return;

  applyLyricsWidgetPosition();
  setLyricsWidgetCollapsed(lyricsWidgetCollapsed);
  setLyricsWidgetHidden(lyricsWidgetHidden);

  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let dragging = false;
  let dragBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  const move = (event) => {
    if (!dragging) return;
    const nextX = clampNumber(originX + (event.clientX - startX), dragBounds.minX, dragBounds.maxX);
    const nextY = clampNumber(originY + (event.clientY - startY), dragBounds.minY, dragBounds.maxY);
    lyricsWidget.style.setProperty("--drag-x", `${nextX}px`);
    lyricsWidget.style.setProperty("--drag-y", `${nextY}px`);
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    lyricsWidget.classList.remove("is-dragging");
    const x = Number.parseFloat(lyricsWidget.style.getPropertyValue("--drag-x")) || 0;
    const y = Number.parseFloat(lyricsWidget.style.getPropertyValue("--drag-y")) || 0;
    saveWindowPosition("lyricsWidget", x, y);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };

  lyricsWidgetHead.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, input")) return;
    dragging = true;
    lyricsWidget.classList.add("is-dragging");
    startX = event.clientX;
    startY = event.clientY;
    originX = Number.parseFloat(lyricsWidget.style.getPropertyValue("--drag-x")) || 0;
    originY = Number.parseFloat(lyricsWidget.style.getPropertyValue("--drag-y")) || 0;
    const rect = lyricsWidget.getBoundingClientRect();
    const baseLeft = rect.left - originX;
    const baseRight = rect.right - originX;
    const baseTop = rect.top - originY;
    const baseBottom = rect.bottom - originY;
    const edgePadding = 8;
    dragBounds = {
      minX: edgePadding - baseLeft,
      maxX: window.innerWidth - edgePadding - baseRight,
      minY: edgePadding - baseTop,
      maxY: window.innerHeight - getTaskbarReserve() - baseBottom
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  });

  lyricsWidgetHead.addEventListener("dblclick", () => {
    lyricsWidget.style.setProperty("--drag-x", "0px");
    lyricsWidget.style.setProperty("--drag-y", "0px");
    saveWindowPosition("lyricsWidget", 0, 0);
  });
}

function setWelcomeStatus(message = "", tone = "") {
  if (!welcomeStatus) return;
  welcomeStatus.textContent = message;
  welcomeStatus.dataset.tone = tone;
}

function typeWelcomeText(text = "") {
  if (!welcomeGateTitle) return;
  window.clearInterval(welcomeTypeTimer);
  welcomeGateTitle.textContent = "";
  let index = 0;
  welcomeTypeTimer = window.setInterval(() => {
    index += 1;
    welcomeGateTitle.textContent = text.slice(0, index);
    if (index >= text.length) {
      window.clearInterval(welcomeTypeTimer);
      welcomeTypeTimer = null;
    }
  }, 32);
}

function needsWelcomeGate() {
  return Boolean(welcomeGate) && (!normalizeVelChatUser(velChatUser) || !velChatPin);
}

function completeWelcomeGate() {
  window.clearInterval(welcomeTypeTimer);
  welcomeTypeTimer = null;
  welcomeGateStep = "name";
  if (welcomeGate) welcomeGate.hidden = true;
  document.body.classList.remove("is-onboarding");
  setWelcomeStatus("");
}

function showWelcomeGate(step = "") {
  if (!welcomeGate) return;
  velChatUser = normalizeVelChatUser(velChatUser);
  const hasUser = Boolean(velChatUser);
  welcomeGateStep = step || (hasUser ? "pin" : "name");
  welcomeGate.hidden = false;
  document.body.classList.add("is-onboarding");
  setWelcomeStatus("");
  if (welcomeNameForm) welcomeNameForm.hidden = welcomeGateStep !== "name";
  if (welcomePinForm) welcomePinForm.hidden = welcomeGateStep !== "pin";
  if (welcomeGateStep === "name") {
    typeWelcomeText("Welcome user, what should we call you?");
    if (welcomeNameInput) welcomeNameInput.value = hasUser ? velChatUser.username : "";
    window.setTimeout(() => welcomeNameInput?.focus({ preventScroll: true }), 420);
    return;
  }
  typeWelcomeText(hasUser ? velChatUser.username : "Enter PIN to unlock vel.os.");
  if (welcomePinInput) welcomePinInput.value = "";
  window.setTimeout(() => welcomePinInput?.focus({ preventScroll: true }), 420);
}

function maybeShowWelcomeGate() {
  if (needsWelcomeGate()) {
    showWelcomeGate();
    return true;
  }
  completeWelcomeGate();
  return false;
}

async function submitWelcomeName() {
  const username = cleanVelChatName(welcomeNameInput?.value || "");
  if (!username) {
    setWelcomeStatus("Type a name first.", "error");
    welcomeNameInput?.focus({ preventScroll: true });
    return;
  }
  const existing = normalizeVelChatUser(velChatUser);
  saveVelChatUser(existing ? { ...existing, username } : createVelChatUser(username));
  renderVelChatAuth();
  if (velChatPin) {
    completeWelcomeGate();
    return;
  }
  showWelcomeGate("pin");
}

async function submitWelcomePin() {
  const pin = String(welcomePinInput?.value || "").trim();
  if (!pin) {
    setWelcomeStatus("Enter the PIN to continue.", "error");
    welcomePinInput?.focus({ preventScroll: true });
    return;
  }
  setWelcomeStatus("Checking PIN...");
  welcomePinForm?.querySelector("button")?.toggleAttribute("disabled", true);
  const unlocked = await unlockVelChat(pin);
  welcomePinForm?.querySelector("button")?.toggleAttribute("disabled", false);
  if (!unlocked) {
    if (welcomePinInput) welcomePinInput.value = "";
    setWelcomeStatus("Wrong PIN. Try again.", "error");
    welcomePinInput?.focus({ preventScroll: true });
    return;
  }
  const allowed = await checkDevAccess({ once: true });
  if (!allowed) return;
  setWelcomeStatus(`Welcome, ${velChatUser?.username || "user"}.`);
  window.setTimeout(completeWelcomeGate, 420);
}

function showBootScreen() {
  clearLegacyStoredChatPin();
  if (bootScreen) bootScreen.classList.add("is-hidden");
  document.body.classList.remove("is-booting");
  maybeShowWelcomeGate();
}

function setActiveLocalGame(gameId, displayMeta = null) {
  const meta = displayMeta ?? localGameMeta[gameId];
  if (!meta || !localGameMeta[gameId]) return;

  activeLocalGame = gameId;
  pauseDynamicGames(gameId);

  activeCategory.textContent = meta.category;
  activeTitle.textContent = meta.title;
  activeDescription.textContent = meta.description;
  activeBest.textContent = meta.best;
  activeControls.textContent = meta.controls;

  switchButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.gameSwitch === gameId);
  });

  gameScreens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === gameId);
  });

  if (gameId === "snake") {
    window.requestAnimationFrame(() => {
      snake.refresh();
    });
  }
}

function openGame(gameId, displayMeta = null) {
  if (isDevAppLocked("game") || isDevAppLocked(gameId)) {
    showDevAppLocked(localGameMeta[gameId]?.title || "game");
    return;
  }
  setActiveLocalGame(gameId, displayMeta);
  recordRecentApp({ type: "game", id: gameId });
  openPanel("game");
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "about:blank";
  if (trimmed === "about:blank") return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.includes(".") || /\s/.test(trimmed)) {
    return `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`;
  }
  return `https://${trimmed}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArchiveField(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return value || "";
}

function sanitizeArchiveSearch(value) {
  return String(value || "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function hasBlockedVelHubTerms(movie) {
  const haystack = [
    movie.title,
    movie.description,
    movie.subject,
    movie.creator
  ].join(" ").toLowerCase();
  return VEL_HUB_BLOCKED_TERMS.some((term) => haystack.includes(term));
}

function getVelHubApiUrl(page = 1) {
  const baseQuery = [
    "collection:(feature_films)",
    "mediatype:(movies)",
    "NOT subject:(adult)",
    "NOT subject:(exploitation)",
    "NOT title:(sex)",
    "NOT title:(nudity)"
  ];
  const categoryQuery = VEL_HUB_CATEGORY_QUERIES[velHubState.category];
  if (categoryQuery) baseQuery.push(categoryQuery);
  const search = sanitizeArchiveSearch(velHubState.query);
  if (search) baseQuery.push(`(${search})`);

  const params = new URLSearchParams();
  params.set("q", baseQuery.join(" AND "));
  ["identifier", "title", "description", "creator", "date", "subject", "downloads", "publicdate"].forEach((field) => {
    params.append("fl[]", field);
  });
  params.append("sort[]", search ? "downloads desc" : "downloads desc");
  params.set("rows", String(VEL_HUB_PAGE_SIZE));
  params.set("page", String(page));
  params.set("output", "json");
  return `https://archive.org/advancedsearch.php?${params.toString()}`;
}

function normalizeVelHubMovie(doc) {
  const identifier = doc?.identifier || "";
  const title = stripHtml(normalizeArchiveField(doc?.title)) || identifier;
  const description = stripHtml(normalizeArchiveField(doc?.description));
  const subject = stripHtml(normalizeArchiveField(doc?.subject));
  const creator = stripHtml(normalizeArchiveField(doc?.creator));
  const yearMatch = String(doc?.date || doc?.publicdate || "").match(/\d{4}/);
  return {
    id: identifier,
    title,
    description: description || "Free archive film with official embedded playback.",
    subject,
    creator,
    year: yearMatch ? yearMatch[0] : "Archive",
    downloads: Number(doc?.downloads || 0),
    poster: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    embedUrl: `https://archive.org/embed/${encodeURIComponent(identifier)}`,
    sourceUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`
  };
}

function setVelHubCinema(enabled) {
  velHubState.cinema = Boolean(enabled);
  velHubDrawer?.classList.toggle("is-velhub-cinema", velHubState.cinema);
  if (velHubWindowButton) {
    velHubWindowButton.textContent = velHubState.cinema ? "Window" : "Cinema";
  }
  storage.set("velhub-cinema", velHubState.cinema ? "1" : "0");
}

function renderVelHubModernPicks() {
  if (!velHubModernGrid) return;
  velHubModernGrid.innerHTML = velHubModernPicks.map((movie, index) => `
    <article class="velhub-modern-card" style="--modern-accent:${escapeHtml(movie.accent)}; --delay:${index * 45}ms">
      <div class="velhub-modern-poster">
        <span>${escapeHtml(movie.title.slice(0, 2).toUpperCase())}</span>
      </div>
      <div>
        <strong>${escapeHtml(movie.title)}</strong>
        <p>${escapeHtml(movie.year)} - ${escapeHtml(movie.vibe)}</p>
      </div>
      <div class="velhub-modern-actions">
        <button type="button" data-velhub-modern-trailer="${escapeHtml(movie.title)}">Trailer</button>
        <button type="button" data-velhub-modern-watch="${escapeHtml(movie.title)}">Watch Options</button>
      </div>
    </article>
  `).join("");
}

function renderVelHubSkeleton(count = 12) {
  if (!velHubGrid) return;
  velHubGrid.innerHTML = Array.from({ length: count }, () => `
    <article class="velhub-card is-loading">
      <span class="velhub-poster"></span>
      <strong></strong>
      <p></p>
    </article>
  `).join("");
}

function renderVelHub() {
  if (velHubSearchInput && document.activeElement !== velHubSearchInput) {
    velHubSearchInput.value = velHubState.query;
  }

  velHubCategoryButtons.forEach((button) => {
    const active = button.dataset.velhubCategory === velHubState.category;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  if (velHubHeroCount) {
    velHubHeroCount.textContent = String(velHubState.movies.length);
  }

  if (velHubStatus) {
    velHubStatus.textContent = velHubState.loading
      ? "Loading"
      : velHubState.error
        ? "Error"
        : `${velHubState.movies.length}${velHubState.total ? ` / ${velHubState.total}` : ""}`;
  }

  if (velHubLoadMoreButton) {
    velHubLoadMoreButton.hidden = velHubState.loading || !velHubState.movies.length || velHubState.movies.length >= velHubState.total;
  }

  if (!velHubGrid) return;
  if (velHubState.loading && !velHubState.movies.length) {
    renderVelHubSkeleton();
    return;
  }

  if (velHubState.error) {
    velHubGrid.innerHTML = `
      <article class="velhub-empty">
        <strong>Vel Hub could not load movies.</strong>
        <p>${escapeHtml(velHubState.error)}</p>
        <button class="ghost-button is-solid" type="button" data-velhub-retry>Retry</button>
      </article>
    `;
    return;
  }

  if (!velHubState.movies.length) {
    velHubGrid.innerHTML = `
      <article class="velhub-empty">
        <strong>No movies found.</strong>
        <p>Try another search or switch categories.</p>
      </article>
    `;
    return;
  }

  velHubGrid.innerHTML = velHubState.movies.map((movie, index) => `
    <button class="velhub-card" type="button" data-velhub-movie="${escapeHtml(movie.id)}" style="--delay:${Math.min(index, 24) * 24}ms">
      <span class="velhub-poster">
        <img src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title)} poster" loading="lazy" />
        <em>Play</em>
      </span>
      <strong>${escapeHtml(movie.title)}</strong>
      <p>${escapeHtml([movie.year, movie.subject || movie.creator || "Archive Film"].filter(Boolean).join(" - "))}</p>
    </button>
  `).join("");
}

async function loadVelHubMovies({ append = false } = {}) {
  if (velHubState.loading) return;
  velHubState.loading = true;
  velHubState.error = "";
  if (!append) {
    velHubState.page = 1;
    velHubState.movies = [];
  }
  renderVelHub();

  try {
    const response = await fetch(getVelHubApiUrl(velHubState.page));
    if (!response.ok) throw new Error(`Archive search failed (${response.status})`);
    const data = await response.json();
    const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
    const nextMovies = docs
      .map(normalizeVelHubMovie)
      .filter((movie) => movie.id && !hasBlockedVelHubTerms(movie));
    const knownIds = new Set(velHubState.movies.map((movie) => movie.id));
    velHubState.movies = [
      ...velHubState.movies,
      ...nextMovies.filter((movie) => !knownIds.has(movie.id))
    ];
    velHubState.total = Number(data?.response?.numFound || velHubState.movies.length);
    velHubState.page += 1;
    storage.set("velhub-query", velHubState.query);
    storage.set("velhub-category", velHubState.category);
  } catch (error) {
    velHubState.error = error?.message || "Movie data is unavailable right now.";
  } finally {
    velHubState.loading = false;
    renderVelHub();
  }
}

function showVelHubLaunch() {
  if (!velHubLaunch) return;
  window.clearTimeout(velHubState.launchTimer);
  velHubLaunch.classList.remove("is-hiding");
  velHubLaunch.hidden = false;
  velHubLaunch.setAttribute("aria-hidden", "false");
  velHubState.launchTimer = window.setTimeout(() => {
    velHubLaunch.classList.add("is-hiding");
    window.setTimeout(() => {
      velHubLaunch.hidden = true;
      velHubLaunch.setAttribute("aria-hidden", "true");
    }, 520);
  }, 1650);
}

function openVelHubApp() {
  if (openPanel("velhub") === false) return;
  setVelHubCinema(true);
  showVelHubLaunch();
  if (!velHubState.movies.length && !velHubState.loading) {
    loadVelHubMovies();
  } else {
    renderVelHub();
  }
}

function openVelHubTrailerSearch(title) {
  openYouTubeApp();
  if (youtubeSearchInput) {
    youtubeSearchInput.value = `${title} official trailer`;
  }
  searchYouTubeApp();
}

function openVelHubWatchOptions(title) {
  openCustomWebUrl(`${title} official streaming watch options`);
}

function closeVelHubPlayer() {
  if (velHubFrameWrap) velHubFrameWrap.innerHTML = "";
  if (velHubPlayer) velHubPlayer.hidden = true;
  velHubState.currentMovie = null;
}

function stopVelHubPlayback() {
  closeVelHubPlayer();
}

function openVelHubMovie(movie) {
  if (!movie || !velHubFrameWrap) return;
  velHubState.currentMovie = movie;
  velHubFrameWrap.innerHTML = `
    <iframe
      src="${escapeHtml(movie.embedUrl)}"
      title="${escapeHtml(movie.title)}"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      loading="lazy"
    ></iframe>
  `;
  if (velHubPlayer) velHubPlayer.hidden = false;
  if (velHubPlayerSource) velHubPlayerSource.textContent = `${movie.year} - Internet Archive`;
  if (velHubPlayerTitle) velHubPlayerTitle.textContent = movie.title;
  if (velHubPlayerDescription) {
    velHubPlayerDescription.textContent = movie.description.slice(0, 420);
  }
  velHubPlayer?.scrollIntoView({ behavior: "smooth", block: "start" });
  recordRecentApp({ type: "panel", id: "velhub" });
}

function makeBlockedFrame(app, url) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #050505;
        color: #f5f5f5;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      main {
        width: min(560px, calc(100% - 32px));
        padding: 28px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.05);
        text-align: center;
      }
      h1 {
        margin: 0 0 10px;
        font-size: clamp(28px, 6vw, 46px);
      }
      p {
        margin: 0;
        color: #b7b7b7;
        line-height: 1.6;
      }
      a {
        display: none;
        margin-top: 22px;
        padding: 12px 18px;
        border-radius: 999px;
        background: #fff;
        color: #050505;
        font-weight: 700;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${app.title}</h1>
      <p>${app.note}</p>
    </main>
  </body>
</html>`;
}

function makeVideoPromptFrame(app) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #050505;
        color: #f5f5f5;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      main {
        width: min(620px, calc(100% - 32px));
        padding: 28px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.05);
        text-align: center;
      }
      h1 {
        margin: 0 0 10px;
        font-size: clamp(28px, 6vw, 46px);
      }
      p {
        margin: 0;
        color: #b7b7b7;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${app.title}</h1>
      <p>${app.note}</p>
      <p>Paste a specific ${app.title} video link above, then press Embed Video.</p>
    </main>
  </body>
</html>`;
}

function extractYouTubeId(value) {
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(normalizeUrl(trimmed));
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    if (url.searchParams.get("v")) {
      return url.searchParams.get("v");
    }
    const embedMatch = url.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    return embedMatch?.[1] || "";
  } catch (error) {
    return "";
  }
}

function extractTikTokId(value) {
  const trimmed = value.trim();
  if (/^\d{8,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/video\/(\d+)/);
  return match?.[1] || "";
}

function buildVideoEmbedUrl(provider, value) {
  if (provider === "youtube") {
    const id = extractYouTubeId(value);
    return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : "";
  }

  if (provider === "tiktok") {
    const id = extractTikTokId(value);
    return id ? `https://www.tiktok.com/player/v1/${id}?controls=1&music_info=1&description=1` : "";
  }

  return "";
}

function getMediaQuery() {
  return mediaState.query.trim().toLowerCase();
}

function providerLabel(provider) {
  const labels = {
    all: "All",
    youtube: "YouTube",
    spotify: "Spotify",
    tiktok: "TikTok"
  };
  return labels[provider] || "All";
}

function mediaMatches(item, fields) {
  const query = getMediaQuery();
  if (!query) return true;
  return fields.some((field) => String(item[field] || "").toLowerCase().includes(query))
    || (item.tags || []).some((tag) => tag.toLowerCase().includes(query));
}

function renderSkeletonCards(count = 6) {
  return Array.from({ length: count }, (_, index) => `
    <article class="media-card is-skeleton" aria-label="Loading result ${index + 1}">
      <div class="media-card-thumb"></div>
      <div class="media-card-body">
        <span class="media-provider-line"></span>
        <span class="media-title-line"></span>
        <span class="media-meta-line"></span>
      </div>
    </article>
  `).join("");
}

function renderEmptyCard(title, message) {
  return `
    <article class="media-card media-empty-card">
      <div class="media-card-body">
        <p class="section-label">Nothing Found</p>
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(message)}</p>
      </div>
    </article>
  `;
}

function getStoredList(key) {
  try {
    return JSON.parse(storage.get(key, "[]"));
  } catch (error) {
    return [];
  }
}

function setStoredList(key, list) {
  storage.set(key, JSON.stringify(list.slice(0, 12)));
}

function saveMediaSearch(provider, query) {
  if (!query) return;
  const key = `vel-${provider}-recent-searches`;
  setStoredList(key, [query, ...getStoredList(key).filter((item) => item !== query)]);
}

function saveMediaHistory(item) {
  setStoredList("vel-media-history", [
    { ...item, savedAt: Date.now() },
    ...getStoredList("vel-media-history").filter((entry) => entry.id !== item.id || entry.provider !== item.provider)
  ]);
}

async function searchYouTube({ append = false } = {}) {
  const query = mediaState.query.trim() || "music";
  const params = new URLSearchParams({ q: query });
  if (append && mediaState.youtubeNextPageToken) {
    params.set("pageToken", mediaState.youtubeNextPageToken);
  }

  mediaState.loading = true;
  mediaState.youtubeError = "";
  renderMediaHub();

  try {
    const response = await fetch(`/api/youtube/search?${params}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "YouTube search failed.");
    }
    const nextResults = data.items || [];
    mediaState.youtubeResults = append
      ? [...mediaState.youtubeResults, ...nextResults]
      : nextResults;
    mediaState.youtubeNextPageToken = data.nextPageToken || "";
    saveMediaSearch("youtube", query);
  } catch (error) {
    mediaState.youtubeError = error.message || "YouTube search could not load.";
  } finally {
    mediaState.loading = false;
    renderMediaHub();
  }
}

function renderYouTubeCards() {
  if (mediaState.loading && !mediaState.youtubeResults.length) {
    return renderSkeletonCards(6);
  }

  if (mediaState.youtubeError) {
    return `
      <article class="media-card media-config-card">
        <div class="media-card-thumb media-logo-thumb youtube-thumb">YT</div>
        <div class="media-card-body">
          <p class="section-label">YouTube Error</p>
          <h4>Search did not load.</h4>
          <p>${escapeHtml(mediaState.youtubeError)}</p>
          <button class="media-card-action" type="button" data-media-retry="youtube">Retry YouTube</button>
        </div>
      </article>
    `;
  }

  if (!mediaState.youtubeResults.length) return "";

  return mediaState.youtubeResults.map((video) => `
    <article class="media-card" data-media-kind="youtube" data-youtube-id="${escapeHtml(video.id)}" role="button" tabindex="0" aria-label="Play ${escapeHtml(video.title)} on YouTube">
      <div class="media-card-thumb">
        <img src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" />
        <span class="media-play-pill">Play</span>
      </div>
      <div class="media-card-body">
        <p class="section-label">YouTube</p>
        <h4>${escapeHtml(video.title)}</h4>
        <p>${escapeHtml(video.channel)}</p>
      </div>
    </article>
  `).join("");
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiReadyPromise) return youtubeApiReadyPromise;

  youtubeApiReadyPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return youtubeApiReadyPromise;
}

async function openYouTubePlayer(video) {
  mediaPlayer.hidden = false;
  mediaPlayerProvider.textContent = "YouTube";
  mediaPlayerTitle.textContent = video.title;
  mediaPlayerMeta.textContent = video.channel || "Official YouTube player";
  mediaPlayerFrame.innerHTML = '<div id="youtubeApiPlayer" class="media-api-player"></div>';
  saveMediaHistory({ provider: "youtube", id: video.id, title: video.title, subtitle: video.channel });
  mediaPlayer.scrollIntoView({ behavior: "smooth", block: "nearest" });

  await loadYouTubeIframeApi();
  youtubePlayer?.destroy?.();
  youtubePlayer = new YT.Player("youtubeApiPlayer", {
    videoId: video.id,
    playerVars: {
      rel: 0,
      modestbranding: 1,
      playsinline: 1
    }
  });
  mediaPlayerClose?.focus({ preventScroll: true });
}

async function searchSpotify() {
  const query = mediaState.query.trim() || "lofi";
  const params = new URLSearchParams({
    q: query,
    type: mediaState.spotifyType === "all" ? "track,artist,album,playlist" : mediaState.spotifyType
  });

  mediaState.loading = true;
  mediaState.spotifyError = "";
  renderMediaHub();

  try {
    const response = await fetch(`/api/spotify/search?${params}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Spotify search failed.");
    }
    mediaState.spotifyResults = data;
    saveMediaSearch("spotify", query);
  } catch (error) {
    mediaState.spotifyError = error.message || "Spotify search could not load.";
    mediaState.spotifyResults = { tracks: [], artists: [], albums: [], playlists: [] };
  } finally {
    mediaState.loading = false;
    renderMediaHub();
  }
}

function getSpotifyItems() {
  if (mediaState.spotifyType === "track") return mediaState.spotifyResults.tracks || [];
  if (mediaState.spotifyType === "artist") return mediaState.spotifyResults.artists || [];
  if (mediaState.spotifyType === "album") return mediaState.spotifyResults.albums || [];
  if (mediaState.spotifyType === "playlist") return mediaState.spotifyResults.playlists || [];
  return [
    ...(mediaState.spotifyResults.tracks || []),
    ...(mediaState.spotifyResults.artists || []),
    ...(mediaState.spotifyResults.albums || []),
    ...(mediaState.spotifyResults.playlists || [])
  ];
}

function renderSpotifyCards() {
  if (mediaState.loading && !getSpotifyItems().length) {
    return renderSkeletonCards(6);
  }

  if (mediaState.spotifyError) {
    return `
      <article class="media-card media-config-card">
        <div class="media-card-thumb media-logo-thumb">SP</div>
        <div class="media-card-body">
          <p class="section-label">Spotify Error</p>
          <h4>Search did not load.</h4>
          <p>${escapeHtml(mediaState.spotifyError)}</p>
          <button class="media-card-action" type="button" data-media-retry="spotify">Retry Spotify</button>
        </div>
      </article>
    `;
  }

  const tabs = `
    <div class="media-filter-row" role="tablist" aria-label="Spotify result type">
      ${[
        ["track", "Tracks"],
        ["artist", "Artists"],
        ["album", "Albums"],
        ["playlist", "Playlists"]
      ].map(([type, label]) => `
        <button class="switch-chip ${mediaState.spotifyType === type ? "is-active" : ""}" type="button" data-spotify-type="${type}">
          ${label}
        </button>
      `).join("")}
    </div>
  `;

  const items = getSpotifyItems();
  if (!items.length) {
    return tabs + renderEmptyCard("No Spotify results", "Search for a track, artist, album, or playlist.");
  }

  return tabs + items.map((item) => `
    <article class="media-card" data-media-kind="spotify" data-spotify-id="${escapeHtml(item.id)}" data-spotify-type="${escapeHtml(item.type)}" role="button" tabindex="0" aria-label="${item.playable ? "Play" : "View"} ${escapeHtml(item.title)} on Spotify">
      <div class="media-card-thumb media-poster-thumb" style="--poster-accent: #1db954">
        ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" />` : "<span>Spotify</span>"}
        ${item.playable ? '<span class="media-play-pill">Play</span>' : ""}
      </div>
      <div class="media-card-body">
        <p class="section-label">Spotify ${escapeHtml(item.type)}</p>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.subtitle || "Spotify")}</p>
      </div>
    </article>
  `).join("");
}

function openSpotifyPlayer(item) {
  if (!item.playable) {
    openMediaPlayer({
      provider: "Spotify",
      title: item.title,
      meta: "Artist pages are metadata-only here. Tracks, albums, and playlists support embeds.",
      src: "about:blank"
    });
    mediaPlayerFrame.innerHTML = renderEmptyCard("Spotify artist selected", "Choose a track, album, or playlist to open an official Spotify embed.");
    return;
  }

  const embedType = item.type === "track" ? "track" : item.type === "album" ? "album" : "playlist";
  saveMediaHistory({ provider: "spotify", id: item.id, title: item.title, subtitle: item.subtitle });
  openMediaPlayer({
    provider: "Spotify",
    title: item.title,
    meta: `${item.type} - Spotify Embed. Premium is only required for future Web Playback SDK control.`,
    src: `https://open.spotify.com/embed/${embedType}/${item.id}`
  });
}

function renderFeedVideo(item, index) {
  const soundtrack = item.audioSrc || velofyTracks[index % velofyTracks.length]?.src || "";
  return `
    <video
      class="feed-video"
      src="${escapeHtml(item.src)}"
      preload="${index === 0 ? "auto" : "metadata"}"
      controls
      loop
      playsinline
      data-feed-video>
    </video>
    ${soundtrack ? `
      <audio
        class="feed-audio"
        src="${escapeHtml(soundtrack)}"
        preload="${index === 0 ? "auto" : "metadata"}"
        loop
        data-feed-audio>
      </audio>
    ` : ""}
  `;
}

function renderFeedTags(tags = []) {
  return tags
    .slice(0, 4)
    .map((tag) => `#${escapeHtml(tag.replace(/\s+/g, ""))}`)
    .join(" ");
}

function formatFeedCount(index, offset = 0) {
  const count = 1400 + (((index + 3) * 1879 + offset * 7331) % 196000);
  return count >= 100000
    ? `${Math.round(count / 1000)}K`
    : `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
}

function getFilteredTikToks() {
  return mediaTikTokCatalog.filter((item) => mediaMatches(item, ["title", "creator"]));
}

function getFilteredShorts() {
  return mediaShortsCatalog.filter((item) => mediaMatches(item, ["title", "channel"]));
}

function renderShortsCards() {
  const cards = getFilteredShorts();
  return cards.map((item, index) => `
    <article class="media-card" data-media-kind="shorts" data-video-index="${index}" tabindex="0">
      <div class="media-card-thumb media-shorts-thumb" style="--card-accent: ${escapeHtml(item.poster)}">
        <span class="media-play-pill">Scroll</span>
      </div>
      <div class="media-card-body">
        <p class="section-label">Shorts</p>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.channel)} - vertical feed</p>
      </div>
    </article>
  `).join("");
}

function renderShortsFeed() {
  const cards = getFilteredShorts();
  if (!cards.length) return "";

  return `
    <section class="tiktok-feed shorts-feed" aria-label="Scrollable Shorts feed">
      ${cards.map((item, index) => `
        <article class="tiktok-feed-card shorts-feed-card">
          <div class="tiktok-phone shorts-phone">
            ${renderFeedVideo(item, index)}
            <div class="feed-overlay">
              <strong>${escapeHtml(item.channel)}</strong>
              <span>${escapeHtml(item.title)}</span>
              <small>${renderFeedTags(item.tags)}</small>
            </div>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

async function loadTikTokData() {
  mediaState.loading = true;
  mediaState.tiktokError = "";
  mediaState.tiktokAuthRequired = false;
  renderMediaHub();

  try {
    const [profileResponse, videosResponse] = await Promise.all([
      fetch("/api/tiktok/profile"),
      fetch("/api/tiktok/videos")
    ]);
    const profile = await profileResponse.json();
    const videos = await videosResponse.json();

    if (profileResponse.status === 401 || videosResponse.status === 401) {
      mediaState.tiktokAuthRequired = true;
      mediaState.tiktokProfile = null;
      mediaState.tiktokVideos = [];
      return;
    }

    if (!profileResponse.ok) throw new Error(profile.message || "TikTok profile could not load.");
    if (!videosResponse.ok) throw new Error(videos.message || "TikTok videos could not load.");

    mediaState.tiktokProfile = profile;
    mediaState.tiktokVideos = videos.videos || [];
  } catch (error) {
    mediaState.tiktokError = error.message || "TikTok could not load.";
  } finally {
    mediaState.loading = false;
    renderMediaHub();
  }
}

function renderTikTokConnectCard() {
  return `
    <article class="media-card media-config-card">
      <div class="media-card-thumb media-logo-thumb">
        <img class="media-provider-logo" src="./assets/images/apps/tiktok.svg" alt="" loading="lazy" />
        <span>TikTok</span>
      </div>
      <div class="media-card-body">
        <p class="section-label">TikTok Login Kit</p>
        <h4>Connect TikTok to show profile videos.</h4>
        <p>TikTok does not provide an official global For You feed API. This uses authorized profile/videos only.</p>
        <button class="media-card-action" type="button" data-tiktok-connect>Connect TikTok</button>
      </div>
    </article>
  `;
}

function renderTikTokCards() {
  if (mediaState.loading && !mediaState.tiktokVideos.length) return renderSkeletonCards(4);
  if (mediaState.tiktokAuthRequired) return renderTikTokConnectCard();
  if (mediaState.tiktokError) {
    return `
      <article class="media-card media-config-card">
        <div class="media-card-thumb media-logo-thumb">
          <img class="media-provider-logo" src="./assets/images/apps/tiktok.svg" alt="" loading="lazy" />
          <span>TikTok</span>
        </div>
        <div class="media-card-body">
          <p class="section-label">TikTok Error</p>
          <h4>TikTok could not load.</h4>
          <p>${escapeHtml(mediaState.tiktokError)}</p>
          <button class="media-card-action" type="button" data-media-retry="tiktok">Retry TikTok</button>
          <button class="media-card-action" type="button" data-tiktok-connect>Reconnect TikTok</button>
        </div>
      </article>
    `;
  }

  const profile = mediaState.tiktokProfile;
  const query = getMediaQuery();
  const videos = query
    ? mediaState.tiktokVideos.filter((video) =>
        [video.title, video.video_description, video.share_url]
          .some((field) => String(field || "").toLowerCase().includes(query))
      )
    : mediaState.tiktokVideos;
  const profileCard = profile ? `
    <article class="media-card media-config-card">
      <div class="media-card-thumb media-logo-thumb">
        ${profile.avatar_url ? `<img class="media-provider-logo" src="${escapeHtml(profile.avatar_url)}" alt="" loading="lazy" />` : '<img class="media-provider-logo" src="./assets/images/apps/tiktok.svg" alt="" loading="lazy" />'}
        <span>TikTok</span>
      </div>
      <div class="media-card-body">
        <p class="section-label">Connected Profile</p>
        <h4>${escapeHtml(profile.display_name || profile.username || "TikTok Creator")}</h4>
        <p>${escapeHtml(profile.bio_description || "Authorized TikTok Display API profile.")}</p>
      </div>
    </article>
  ` : "";

  if (!videos.length) {
    return profileCard + renderEmptyCard("No TikTok videos", "This connected account has no public recent videos available through Display API.");
  }

  return profileCard + videos.map((video) => `
    <article class="media-card" data-media-kind="tiktok" data-tiktok-video-id="${escapeHtml(video.id)}" role="button" tabindex="0" aria-label="View ${escapeHtml(video.title || video.video_description || "TikTok video")}">
      <div class="media-card-thumb">
        ${video.cover_image_url ? `<img src="${escapeHtml(video.cover_image_url)}" alt="" loading="lazy" />` : '<img src="./assets/images/apps/tiktok.svg" alt="" loading="lazy" />'}
        <span class="media-play-pill">View</span>
      </div>
      <div class="media-card-body">
        <p class="section-label">TikTok</p>
        <h4>${escapeHtml(video.title || video.video_description || "TikTok video")}</h4>
        <p>${video.duration ? `${escapeHtml(video.duration)}s` : "Official Display API video"}</p>
      </div>
    </article>
  `).join("");
}

function renderTikTokFeed() {
  return renderTikTokCards();
}

function renderTubiCards() {
  const cards = mediaTubiCatalog.filter((item) => mediaMatches(item, ["title", "genre"]));
  return cards.map((item, index) => `
    <article class="media-card is-tubi">
      <div class="media-card-thumb media-poster-thumb" style="--poster-accent: ${escapeHtml(item.accent)}">
        <img class="media-provider-logo" src="./assets/images/apps/tubi.png" alt="" loading="lazy" />
        <span>Tubi</span>
      </div>
      <div class="media-card-body">
        <p class="section-label">Tubi</p>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.genre)} - Starter catalog item ${index + 1}</p>
        <p>${escapeHtml(item.genre)} · Starter catalog item ${index + 1}</p>
        <a class="media-card-action" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Watch on Tubi</a>
      </div>
    </article>
  `).join("");
}

function renderPlutoCards() {
  const cards = mediaPlutoCatalog.filter((item) => mediaMatches(item, ["title", "category"]));
  return cards.map((item, index) => `
    <article class="media-card is-pluto">
      <div class="media-card-thumb media-poster-thumb" style="--poster-accent: ${escapeHtml(item.accent)}">
        <img class="media-provider-logo" src="./assets/images/apps/pluto.jpg" alt="" loading="lazy" />
        <span>Pluto</span>
      </div>
      <div class="media-card-body">
        <p class="section-label">Pluto TV</p>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.category)} - Starter channel ${index + 1}</p>
        <p>${escapeHtml(item.category)} · Starter channel ${index + 1}</p>
        <a class="media-card-action" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Watch on Pluto TV</a>
      </div>
    </article>
  `).join("");
}

function openMediaPlayer({ provider, title, meta, src }) {
  mediaPlayer.hidden = false;
  mediaPlayerProvider.textContent = provider;
  mediaPlayerTitle.textContent = title;
  mediaPlayerMeta.textContent = meta;
  mediaPlayerFrame.innerHTML = `
    <iframe
      title="${escapeHtml(title)}"
      src="${escapeHtml(src)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  `;
  mediaPlayer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  mediaPlayerClose?.focus({ preventScroll: true });
}

function renderTikTokEmbed() {
  openMediaProvider("tiktok");
}

function openTikTokPlayer(video) {
  saveMediaHistory({
    provider: "tiktok",
    id: video.id,
    title: video.title || video.video_description || "TikTok video",
    subtitle: video.share_url || ""
  });

  mediaPlayer.hidden = false;
  mediaPlayerProvider.textContent = "TikTok";
  mediaPlayerTitle.textContent = video.title || video.video_description || "TikTok video";
  mediaPlayerMeta.textContent = "Official TikTok Display API video";

  if (video.embed_link) {
    mediaPlayerFrame.innerHTML = `
      <iframe
        title="${escapeHtml(video.title || "TikTok video")}"
        src="${escapeHtml(video.embed_link)}"
        allow="encrypted-media; fullscreen; picture-in-picture; web-share"
        allowfullscreen>
      </iframe>
    `;
  } else if (video.id) {
    mediaPlayerFrame.innerHTML = `
      <iframe
        title="${escapeHtml(video.title || "TikTok video")}"
        src="${escapeHtml(buildVideoEmbedUrl("tiktok", video.id))}"
        allow="encrypted-media; fullscreen; picture-in-picture; web-share"
        allowfullscreen>
      </iframe>
    `;
  } else {
    mediaPlayerFrame.innerHTML = `
      <article class="media-card media-empty-card">
        <div class="media-card-body">
          <p class="section-label">TikTok</p>
          <h4>Embed unavailable for this post.</h4>
          <p>Use the canonical TikTok link when TikTok does not provide an embed link.</p>
          ${video.share_url ? `<a class="media-card-action" href="${escapeHtml(video.share_url)}" target="_blank" rel="noopener">Open TikTok Link</a>` : ""}
        </div>
      </article>
    `;
  }

  mediaPlayer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  mediaPlayerClose?.focus({ preventScroll: true });
}

function getFeedAudio(video) {
  return video.closest(".tiktok-phone")?.querySelector("[data-feed-audio]") || null;
}

function playFeedMedia(video) {
  const audio = getFeedAudio(video);
  video.muted = false;
  video.volume = 1;
  video.play().catch(() => {
    video.muted = true;
    video.play().catch(() => {});
  });

  if (!audio) return;
  audio.muted = false;
  audio.volume = 0.9;
  audio.play().catch(() => {});
}

function pauseFeedMedia(video) {
  const audio = getFeedAudio(video);
  video.pause();
  audio?.pause();
}

function pauseAllFeedMedia() {
  document.querySelectorAll("[data-feed-video]").forEach((video) => {
    if (video instanceof HTMLVideoElement) {
      pauseFeedMedia(video);
    }
  });
}

function hydrateFeedVideos() {
  const videos = [...document.querySelectorAll("[data-feed-video]")];
  if (feedVideoObserver) {
    feedVideoObserver.disconnect();
    feedVideoObserver = null;
  }

  if (!videos.length) return;

  if (!("IntersectionObserver" in window)) {
    playFeedMedia(videos[0]);
    return;
  }

  feedVideoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) return;

        if (entry.isIntersecting && entry.intersectionRatio > 0.62) {
          playFeedMedia(video);
        } else {
          pauseFeedMedia(video);
        }
      });
    },
    { threshold: [0, 0.35, 0.62, 0.9] }
  );

  videos.forEach((video) => feedVideoObserver.observe(video));
}

function renderMediaHub() {
  if (!mediaGrid) return;

  mediaProviderButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mediaProvider === mediaState.provider);
  });

  const provider = mediaState.provider;
  const sections = [];

  if (provider === "all" || provider === "youtube") {
    sections.push(renderYouTubeCards());
  }
  if (provider === "all" || provider === "spotify") {
    sections.push(renderSpotifyCards());
  }
  if (provider === "all" || provider === "tiktok") {
    sections.push(renderTikTokCards());
  }

  const html = sections.filter(Boolean).join("");
  mediaGrid.innerHTML = html || renderEmptyCard(
    "No matching media",
    "Try a different search or switch to All."
  );

  mediaLoading.hidden = !mediaState.loading;
  mediaResultsTitle.textContent = `${providerLabel(provider)} Results`;
  if (provider === "spotify") {
    mediaResultsCopy.textContent =
      "Spotify metadata comes from the Web API. Playback uses official Spotify embeds; Web Playback SDK can be added later for Premium users.";
  } else if (provider === "tiktok") {
    mediaResultsCopy.textContent =
      "TikTok uses official Login Kit and Display API. TikTok does not provide an official global For You feed API.";
  } else {
    mediaResultsCopy.textContent =
      provider === "youtube"
        ? "YouTube metadata comes from /api/youtube/search and playback uses the YouTube IFrame Player API."
        : "Search real YouTube and Spotify results, or connect TikTok to show authorized profile videos.";
  }

  mediaLoadMore.hidden =
    (provider !== "youtube" && provider !== "all") ||
    !mediaState.youtubeNextPageToken ||
    mediaState.loading;

  window.requestAnimationFrame(hydrateFeedVideos);
}

function handleMediaSearch(value) {
  const query = value.trim();
  const youtubeId = extractYouTubeId(query);
  const tiktokId = extractTikTokId(query);
  storage.set("vel-media-last-query", query);

  if (youtubeId) {
    openYouTubePlayer({ id: youtubeId, title: "YouTube Video", channel: "Official YouTube player" });
    return;
  }

  if (tiktokId && (mediaState.provider === "tiktok" || mediaState.provider === "all")) {
    openTikTokPlayer({
      id: tiktokId,
      title: "TikTok post",
      embed_link: buildVideoEmbedUrl("tiktok", tiktokId),
      share_url: query
    });
    return;
  }

  mediaState.query = query;
  mediaState.youtubeNextPageToken = "";
  mediaState.youtubeResults = [];

  if (mediaState.provider === "youtube" || mediaState.provider === "all") {
    searchYouTube();
  }
  if (mediaState.provider === "spotify" || mediaState.provider === "all") {
    searchSpotify();
  }
  if (mediaState.provider === "tiktok") {
    loadTikTokData();
  }
  if (!["youtube", "spotify", "all", "tiktok"].includes(mediaState.provider)) {
    renderMediaHub();
  }
}

function openMediaProvider(provider) {
  mediaState.provider = provider;
  storage.set("vel-media-tab", provider);
  mediaState.youtubeNextPageToken = "";
  if (provider === "youtube" || provider === "all") searchYouTube();
  if (provider === "spotify" || provider === "all") searchSpotify();
  if (provider === "tiktok") loadTikTokData();
  renderMediaHub();
  openPanel("media");
}

function selectMediaCard(card) {
  if (!card) return;

  if (card.dataset.mediaRetry === "youtube") {
    searchYouTube();
    return;
  }

  if (card.dataset.mediaRetry === "spotify") {
    searchSpotify();
    return;
  }

  if (card.dataset.mediaRetry === "tiktok") {
    loadTikTokData();
    return;
  }

  if (card.dataset.spotifyType) {
    mediaState.spotifyType = card.dataset.spotifyType;
    storage.set("vel-spotify-type", mediaState.spotifyType);
    searchSpotify();
    return;
  }

  if (card.dataset.tiktokConnect !== undefined) {
    window.location.href = "/api/tiktok/auth/start";
    return;
  }

  const directTikTokButton = card.matches?.("button[data-media-kind='tiktok']")
    ? card
    : null;
  if (directTikTokButton) {
    openMediaProvider("tiktok");
    return;
  }

  if (card.dataset.mediaKind === "youtube") {
    const video = mediaState.youtubeResults.find(
      (item) => item.id === card.dataset.youtubeId
    );
    if (!video) return;
    openYouTubePlayer(video);
    return;
  }

  if (card.dataset.mediaKind === "spotify") {
    const item = getSpotifyItems().find((entry) => entry.id === card.dataset.spotifyId && entry.type === card.dataset.spotifyType);
    if (item) openSpotifyPlayer(item);
    return;
  }

  if (card.dataset.mediaKind === "tiktok") {
    const video = mediaState.tiktokVideos.find((item) => item.id === card.dataset.tiktokVideoId);
    if (video) openTikTokPlayer(video);
  }
}

function getAppSources(app) {
  return [app.url, ...(app.mirrors || [])].filter(Boolean);
}

function setWebWindow(app, url, mirrorIndex = 0) {
  currentWebUrl = url;
  currentWebMirrorIndex = mirrorIndex;
  webTag.textContent = app.tag;
  webTitle.textContent = app.title;
  webDescription.textContent = app.description;
  webUrlInput.value = url === "about:blank" ? "" : url;
  const sources = getAppSources(app);
  const sourceLabel = sources.length > 1 ? ` Source ${mirrorIndex + 1}/${sources.length}.` : "";
  webNote.textContent = `${app.note}${sourceLabel}`;
  if (mediaTools) {
    mediaTools.hidden = app.mode !== "videoEmbed";
  }
  if (app.mode === "videoEmbed" && mediaEmbedInput) {
    mediaEmbedInput.value = "";
    mediaEmbedInput.placeholder = `Paste a ${app.title} video link or ID`;
  }
  const knownBlocked = app.embedBlocked && mirrorIndex === 0;
  webWarning.hidden = !knownBlocked;
  webWarningText.textContent = knownBlocked
    ? app.note
    : "The site should load here inside vel.os. Some websites still block iframe apps.";
  if (webMirrorButton) {
    webMirrorButton.hidden = sources.length < 2;
  }
  if (webFrameHelper) {
    const isGameApp = Boolean(app.category || /game/i.test(app.tag || ""));
    const isTouchDevice = window.matchMedia?.("(pointer: coarse)")?.matches
      || navigator.maxTouchPoints > 0;
    webFrameHelper.hidden = !(isGameApp && isTouchDevice);
  }
  if (webHelperMirrorButton) {
    webHelperMirrorButton.hidden = sources.length < 2;
  }
  if (app.mode === "videoEmbed") {
    webFrame.removeAttribute("src");
    webFrame.srcdoc = makeVideoPromptFrame(app);
  } else if (knownBlocked) {
    webFrame.removeAttribute("src");
    webFrame.srcdoc = makeBlockedFrame(app, url);
  } else {
    webFrame.removeAttribute("srcdoc");
    webFrame.src = url;
  }
}

function openWebApp(appId) {
  const app = webApps[appId];
  if (!app) return;
  if (isDevAppLocked("web") || isDevAppLocked(appId)) {
    showDevAppLocked(app.title || "web");
    return;
  }

  activeWeb = appId;
  recordRecentApp({ type: "web", id: appId });
  setWebWindow(app, app.url, 0);
  openPanel("web");
}

function openNextMirror() {
  const app = webApps[activeWeb];
  if (!app) return;
  const sources = getAppSources(app);
  if (sources.length < 2) return;

  const nextIndex = (currentWebMirrorIndex + 1) % sources.length;
  setWebWindow(app, sources[nextIndex], nextIndex);
}

function openCustomWebUrl(value) {
  if (isDevAppLocked("web")) {
    showDevAppLocked("web");
    return;
  }
  const url = normalizeUrl(value);
  activeWeb = "browser";
  recordRecentApp({ type: "web", id: "browser" });
  const isSearch = url.includes("bing.com/search");
  setWebWindow(
    {
      title: isSearch ? "Search" : "Web Browser",
      tag: isSearch ? "Search" : "URL Launcher",
      description: isSearch
        ? `Search results for "${value.trim()}".`
        : "Custom URL opened inside vel.os.",
      embedBlocked: false,
      mirrors: [],
      note: "This is a normal browser frame. If a site blocks embedding or your network blocks it, vel.os cannot override that."
    },
    url,
    0
  );
  openPanel("web");
}

openLauncherButton?.addEventListener("click", () => {
  togglePanel("launcher");
});

startButton?.addEventListener("click", () => {
  togglePanel("launcher");
});

desktopShortcuts?.addEventListener("click", (event) => {
  if (homeEditMode || desktopShortcutSuppressClick) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const button = event.target.closest("button[data-app-open-ref]");
  if (!button) return;
  openAppRef(button.dataset.appOpenRef);
});

desktopShortcuts?.addEventListener("dragstart", (event) => {
  const button = event.target.closest("button[data-desktop-shortcut]");
  if (!button) return;
  desktopShortcutDragRef = button.dataset.desktopShortcut || "";
  button.classList.add("is-dragging");
  button.setAttribute("aria-grabbed", "true");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", desktopShortcutDragRef);
});

desktopShortcuts?.addEventListener("dragover", (event) => {
  const button = event.target.closest("button[data-desktop-shortcut]");
  if (!button || !desktopShortcutDragRef || button.dataset.desktopShortcut === desktopShortcutDragRef) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  desktopShortcuts.querySelectorAll(".desktop-shortcut.is-drop-target").forEach((item) => {
    if (item !== button) item.classList.remove("is-drop-target");
  });
  button.classList.add("is-drop-target");
});

desktopShortcuts?.addEventListener("dragleave", (event) => {
  const button = event.target.closest("button[data-desktop-shortcut]");
  if (!button || button.contains(event.relatedTarget)) return;
  button.classList.remove("is-drop-target");
});

desktopShortcuts?.addEventListener("drop", (event) => {
  const button = event.target.closest("button[data-desktop-shortcut]");
  if (!button) return;
  event.preventDefault();
  const sourceRef = event.dataTransfer.getData("text/plain") || desktopShortcutDragRef;
  const targetRef = button.dataset.desktopShortcut || "";
  reorderDesktopShortcut(sourceRef, targetRef);
  desktopShortcutSuppressClick = true;
  window.setTimeout(() => {
    desktopShortcutSuppressClick = false;
  }, 180);
  desktopShortcutDragRef = "";
  clearDesktopShortcutDragState();
});

desktopShortcuts?.addEventListener("dragend", () => {
  desktopShortcutDragRef = "";
  clearDesktopShortcutDragState();
});

desktopShortcuts?.addEventListener("pointerdown", (event) => {
  if (!homeEditMode) return;
  const button = event.target.closest("button[data-desktop-shortcut]");
  if (!button) return;
  event.preventDefault();
  desktopShortcutPointerRef = button.dataset.desktopShortcut || "";
  desktopShortcutPointerButton = button;
  desktopShortcutPointerMoved = false;
  desktopShortcutStartX = event.clientX;
  desktopShortcutStartY = event.clientY;
  desktopShortcutOriginX = Number.parseFloat(button.style.getPropertyValue("--shortcut-x")) || 0;
  desktopShortcutOriginY = Number.parseFloat(button.style.getPropertyValue("--shortcut-y")) || 0;
  button.classList.add("is-dragging");
  button.setPointerCapture?.(event.pointerId);
});

desktopShortcuts?.addEventListener("pointermove", (event) => {
  if (!homeEditMode || !desktopShortcutPointerRef || !desktopShortcutPointerButton) return;
  const deltaX = event.clientX - desktopShortcutStartX;
  const deltaY = event.clientY - desktopShortcutStartY;
  if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) return;
  desktopShortcutPointerMoved = true;
  const nextX = clampNumber(desktopShortcutOriginX + deltaX, -180, window.innerWidth - 130);
  const nextY = clampNumber(desktopShortcutOriginY + deltaY, -260, window.innerHeight - 140);
  desktopShortcutPointerButton.style.setProperty("--shortcut-x", `${nextX}px`);
  desktopShortcutPointerButton.style.setProperty("--shortcut-y", `${nextY}px`);
  event.preventDefault();
});

desktopShortcuts?.addEventListener("pointerup", (event) => {
  if (!homeEditMode || !desktopShortcutPointerRef || !desktopShortcutPointerButton) return;
  const sourceRef = desktopShortcutPointerRef;
  if (desktopShortcutPointerMoved) {
    const positions = getDesktopShortcutPositions();
    positions[sourceRef] = {
      x: Number.parseFloat(desktopShortcutPointerButton.style.getPropertyValue("--shortcut-x")) || 0,
      y: Number.parseFloat(desktopShortcutPointerButton.style.getPropertyValue("--shortcut-y")) || 0
    };
    saveDesktopShortcutPositions(positions);
    desktopShortcutSuppressClick = true;
    window.setTimeout(() => {
      desktopShortcutSuppressClick = false;
    }, 180);
  }
  desktopShortcutPointerRef = "";
  desktopShortcutPointerButton = null;
  desktopShortcutPointerMoved = false;
  clearDesktopShortcutDragState();
});

openMusicButton?.addEventListener("click", () => {
  togglePanel("music");
});

openNetworkButton?.addEventListener("click", () => {
  togglePanel("network");
});

openLocalGamesButton?.addEventListener("click", () => {
  if (isDrawerOpen("game")) {
    closePanel("game");
    return;
  }
  openGame(activeLocalGame);
});

panelOpenButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.openPanel === "youtube") {
      if (isDrawerOpen("youtube")) {
        closePanel("youtube");
      } else {
        openYouTubeApp();
      }
      return;
    }
    if (button.dataset.openPanel === "velhub") {
      if (isDrawerOpen("velhub")) {
        closePanel("velhub");
      } else {
        openVelHubApp();
      }
      return;
    }
    togglePanel(button.dataset.openPanel);
  });
});

closePanelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    closePanel(button.dataset.closePanel);
  });
});

aiChatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendAiMessage(aiInput?.value || "");
});

aiClearButton?.addEventListener("click", () => {
  clearAiChat();
});

aiPromptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (aiInput) aiInput.value = button.dataset.aiPrompt || "";
    sendAiMessage(button.dataset.aiPrompt || "");
  });
});

velChat?.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});

velChat?.addEventListener("click", (event) => {
  event.stopPropagation();
});

velChatToggle?.addEventListener("click", () => {
  setVelChatCollapsed(false);
});

velChatHide?.addEventListener("click", () => {
  setVelChatCollapsed(true);
});

velChatClearLog?.addEventListener("click", () => {
  clearVelChatLog();
});

welcomeNameForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitWelcomeName();
});

welcomePinForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitWelcomePin();
});

velChatPinForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  unlockVelChat(velChatPinInput?.value || "");
});

velChatUserPill?.addEventListener("click", () => {
  openChatSettings();
});

velChatLoginNeeded?.addEventListener("click", () => {
  openChatSettings();
});

velChatLoginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = createVelChatUser(velChatName?.value || "");
  saveVelChatUser(user);
  renderVelChatAuth();
  if (isDrawerOpen("settings")) {
    closePanel("settings");
  }
  setVelChatCollapsed(false);
  setVelChatStatus(`Logged in as ${user.username}.`, "live");
  velChatInput?.focus({ preventScroll: true });
});

velChatLogout?.addEventListener("click", () => {
  saveVelChatUser(null);
  renderVelChatAuth();
  if (velChatName) velChatName.value = "";
  velChatName?.focus({ preventScroll: true });
});

velChatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendVelChatMessage(velChatInput?.value || "");
});

velChatInput?.addEventListener("input", () => {
  handleVelChatTypingInput();
});

velChatInput?.addEventListener("blur", () => {
  window.clearTimeout(velChatTypingStopTimer);
  sendVelChatTyping(false);
});

velChatMessages?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-chat-delete]");
  if (!deleteButton) return;
  event.preventDefault();
  deleteVelChatMessage(deleteButton.dataset.chatDelete || "");
});

velChatAttachButton?.addEventListener("click", () => {
  velChatAttachmentInput?.click();
});

velChatAttachmentInput?.addEventListener("change", async () => {
  const file = velChatAttachmentInput.files?.[0];
  if (!file) {
    setVelChatAttachment(null);
    return;
  }
  try {
    const attachment = await readVelChatAttachment(file);
    setVelChatAttachment(attachment);
    setVelChatStatus(`${file.type.startsWith("image/") ? "Picture" : "Video"} ready to send.`, "live");
  } catch (error) {
    if (velChatAttachmentInput) velChatAttachmentInput.value = "";
    setVelChatAttachment(null);
    setVelChatStatus(error.message || "Attachment failed.", "error");
  }
});

calculatorForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitCalculator();
});

calculatorKeys?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !calculatorExpression) return;
  if (button.hasAttribute("data-calc-clear")) {
    calculatorExpression.value = "";
    if (calculatorResult) calculatorResult.textContent = "0";
    calculatorExpression.focus({ preventScroll: true });
    return;
  }
  calculatorExpression.value += button.dataset.calcKey || "";
  calculatorExpression.focus({ preventScroll: true });
});

secretVaultRefresh?.addEventListener("click", () => {
  if (!secretVaultUnlocked) return;
  loadSecretVaultVideos();
});

lobbyModeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-lobby-mode]");
  if (!button) return;
  setLobbyMode(button.dataset.lobbyMode);
});

lobbyPills?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-lobby-name]");
  if (!button) return;
  joinLobby(button.dataset.lobbyName || "Main");
});

lobbyJoinForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  joinLobby(lobbyNameInput?.value || "Main");
});

lobbyRefreshButton?.addEventListener("click", () => {
  loadLobbyState();
});

lobbyNoteSave?.addEventListener("click", () => {
  saveLobbyNote();
});

lobbyNoteClear?.addEventListener("click", () => {
  clearLobbyNote();
});

lobbyPromptForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  setLobbyPrompt(lobbyPromptInput?.value || "");
});

lobbySketchClear?.addEventListener("click", () => {
  clearLobbySketchGallery();
});

lobbyInviteToggle?.addEventListener("click", () => {
  setLobbyInvitePanel(!lobbyState.inviteOpen);
});

lobbyUserList?.addEventListener("click", (event) => {
  const inviteButton = event.target.closest("[data-lobby-invite-user]");
  if (!inviteButton) return;
  sendLobbyInvite(inviteButton.dataset.lobbyInviteUser || "");
});

lobbyInviteInbox?.addEventListener("click", (event) => {
  const acceptButton = event.target.closest("[data-lobby-invite-accept]");
  if (acceptButton) {
    respondLobbyInvite(acceptButton.dataset.lobbyInviteAccept || "", true);
    return;
  }

  const declineButton = event.target.closest("[data-lobby-invite-decline]");
  if (declineButton) {
    respondLobbyInvite(declineButton.dataset.lobbyInviteDecline || "", false);
  }
});

lobbyCanvasClear?.addEventListener("click", () => {
  clearSharedLobbyCanvas();
});

lobbySketchSubmitForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitLobbySketch();
});

lobbySketchGallery?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-lobby-delete-entry]");
  if (!deleteButton) return;
  deleteLobbySketch(deleteButton.dataset.lobbyDeleteEntry || "");
});

soundboardGrid?.addEventListener("click", (event) => {
  const fileButton = event.target.closest("[data-sound-file-id]");
  if (fileButton) {
    playSoundboardFile(fileButton.dataset.soundFileId || "");
    return;
  }

  const button = event.target.closest("[data-sound-id]");
  if (!button) return;
  playSoundboardSound(button.dataset.soundId || "");
});

soundboardStop?.addEventListener("click", () => {
  stopSoundboardSounds();
});

soundboardImport?.addEventListener("click", () => {
  soundboardFileInput?.click();
});

soundboardFileInput?.addEventListener("change", () => {
  importSoundboardFiles(soundboardFileInput.files);
  if (soundboardFileInput) soundboardFileInput.value = "";
});

soundboardVolume?.addEventListener("input", () => {
  setSoundboardStatus(`Volume ${soundboardVolume.value}%.`);
});

devAuthForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  unlockDevPanel(devCodeInput?.value || "");
});

devRefreshButton?.addEventListener("click", () => {
  fetchDevPresence();
});

devLockButton?.addEventListener("click", () => {
  lockDevPanel();
});

devCopyDeviceButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard?.writeText(velDeviceId);
    setDevStatus("Device ID copied.", "live");
  } catch (error) {
    setDevStatus(`Device ID: ${velDeviceId}`, "warn");
  }
});

devOnlineList?.addEventListener("click", (event) => {
  const kickButton = event.target.closest("[data-dev-kick]");
  if (kickButton) {
    const username = kickButton.closest(".dev-user-row")?.querySelector("strong")?.textContent || "this user";
    if (window.confirm(`Kick ${username} back to the PIN screen?`)) {
      sendDevControl("kick", {
        targetUserId: kickButton.dataset.devKick || "",
        targetDeviceId: kickButton.dataset.devDevice || ""
      });
    }
    return;
  }

  const banButton = event.target.closest("[data-dev-ban]");
  if (banButton) {
    const username = banButton.closest(".dev-user-row")?.querySelector("strong")?.textContent || "this user";
    const row = banButton.closest(".dev-user-row");
    const durationSelect = row?.querySelector("[data-dev-duration]");
    const customMinutesInput = row?.querySelector("[data-dev-custom-minutes]");
    const duration = durationSelect?.value || "permanent";
    const customMinutes = Number.parseInt(customMinutesInput?.value || "", 10);
    if (window.confirm(`Ban ${username} for ${duration === "permanent" ? "forever" : duration}?`)) {
      sendDevControl("ban", {
        targetUserId: banButton.dataset.devBan || "",
        targetDeviceId: banButton.dataset.devDevice || "",
        duration,
        durationMs: Number.isFinite(customMinutes) && customMinutes > 0 ? customMinutes * 60000 : 0,
        durationLabel: Number.isFinite(customMinutes) && customMinutes > 0 ? `${customMinutes} minutes` : ""
      });
    }
    return;
  }

  const siteLockButton = event.target.closest("[data-dev-lock-site]");
  if (siteLockButton) {
    const username = siteLockButton.closest(".dev-user-row")?.querySelector("strong")?.textContent || "this user";
    const unlock = siteLockButton.textContent.toLowerCase().includes("unlock");
    if (window.confirm(`${unlock ? "Unlock" : "Lock"} the whole site for ${username}?`)) {
      sendDevControl(unlock ? "unlock-site" : "lock-site", {
        targetUserId: siteLockButton.dataset.devLockSite || "",
        targetDeviceId: siteLockButton.dataset.devDevice || ""
      });
    }
    return;
  }

  const lockAppButton = event.target.closest("[data-dev-lock-app]");
  if (lockAppButton) {
    const row = lockAppButton.closest(".dev-user-row");
    const app = row?.querySelector("[data-dev-app-target]")?.value || "";
    sendDevControl("lock-app", {
      targetUserId: lockAppButton.dataset.devLockApp || "",
      targetDeviceId: lockAppButton.dataset.devDevice || "",
      app
    });
    return;
  }

  const unlockAppButton = event.target.closest("[data-dev-unlock-app]");
  if (unlockAppButton) {
    const row = unlockAppButton.closest(".dev-user-row");
    const app = row?.querySelector("[data-dev-app-target]")?.value || "";
    sendDevControl("unlock-app", {
      targetUserId: unlockAppButton.dataset.devUnlockApp || "",
      targetDeviceId: unlockAppButton.dataset.devDevice || "",
      app
    });
    return;
  }

  const grantButton = event.target.closest("[data-dev-grant-vc]");
  if (grantButton) {
    const row = grantButton.closest(".dev-user-row");
    const amount = Number.parseInt(row?.querySelector("[data-dev-vc-amount]")?.value || "0", 10) || 0;
    if (amount <= 0) {
      setDevStatus("Type a VC amount first.", "warn");
      return;
    }
    sendDevControl("grant-vc", {
      targetUserId: grantButton.dataset.devGrantVc || "",
      targetDeviceId: grantButton.dataset.devDevice || "",
      amount
    });
    return;
  }

  const screenButton = event.target.closest("[data-dev-screen-request]");
  if (screenButton) {
    const username = screenButton.closest(".dev-user-row")?.querySelector("strong")?.textContent || "this user";
    if (window.confirm(`Ask ${username} to share their screen? They must approve it on their device.`)) {
      startAdminScreenViewer({
        username,
        userId: screenButton.dataset.devScreenRequest || "",
        deviceId: screenButton.dataset.devDevice || ""
      });
    }
    return;
  }

  const revokeButton = event.target.closest("[data-dev-revoke]");
  if (revokeButton) {
    sendDevControl("revoke-ban", {
      targetUserId: revokeButton.dataset.devRevoke || "",
      targetDeviceId: revokeButton.dataset.devDevice || ""
    });
  }
});

devBanList?.addEventListener("click", (event) => {
  const revokeButton = event.target.closest("[data-dev-revoke-ban]");
  if (!revokeButton) return;
  sendDevControl("revoke-ban", {
    targetUserId: revokeButton.dataset.devRevokeBan || "",
    targetDeviceId: revokeButton.dataset.devDevice || ""
  });
});

lobbySketchCanvas?.addEventListener("pointerdown", startLobbyDrawing);
lobbySketchCanvas?.addEventListener("pointermove", moveLobbyDrawing);
lobbySketchCanvas?.addEventListener("pointerup", stopLobbyDrawing);
lobbySketchCanvas?.addEventListener("pointercancel", stopLobbyDrawing);
lobbySketchCanvas?.addEventListener("pointerleave", stopLobbyDrawing);
window.addEventListener("resize", resizeLobbyCanvas);

launcherGameSearch?.addEventListener("input", () => {
  launcherGameQuery = launcherGameSearch.value;
  renderLauncherCatalog();
});

appStoreTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-store-category]");
  if (!button) return;
  launcherStoreCategory = button.dataset.storeCategory;
  if (!["games", "local", "tools", "music", "movies", "youtube"].includes(launcherStoreCategory)) {
    launcherStoreCategory = "games";
  }
  storage.set("vel-launcher-store-category", launcherStoreCategory);
  renderLauncherCatalog();
});

launcherOfflineToggle?.addEventListener("click", () => {
  launcherOfflineOnly = !launcherOfflineOnly;
  if (launcherOfflineOnly) {
    launcherGameSource = "local";
  } else if (launcherGameSource === "local") {
    launcherGameSource = "all";
  }
  storage.set("vel-launcher-offline-only", launcherOfflineOnly ? "1" : "0");
  storage.set("vel-launcher-game-source", launcherGameSource);
  renderLauncherCatalog();
});

gameSourceTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-game-source]");
  if (!button) return;

  launcherGameSource = button.dataset.gameSource;
  if (!gameSourceLabels[launcherGameSource]) {
    launcherGameSource = "all";
  }

  if (launcherGameSource === "local" && !launcherOfflineOnly) {
    launcherOfflineOnly = true;
    storage.set("vel-launcher-offline-only", "1");
  } else if (launcherGameSource !== "local" && launcherOfflineOnly) {
    launcherOfflineOnly = false;
    storage.set("vel-launcher-offline-only", "0");
  }

  storage.set("vel-launcher-game-source", launcherGameSource);
  renderLauncherCatalog();
});

youtubeSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (youtubeAppState.mode === "movies") {
    showYouTubeMovies({ query: youtubeSearchInput?.value || "" });
    return;
  }
  searchYouTubeApp();
});

youtubeGlobalForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  addGlobalYouTubeFavorite(youtubeGlobalInput?.value || "");
});

youtubeGlobalMode?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-youtube-global-type]");
  if (!button) return;
  youtubeGlobalImportType = button.dataset.youtubeGlobalType === "channel" ? "channel" : "video";
  updateYouTubeGlobalImportUi();
  youtubeGlobalInput?.focus({ preventScroll: true });
});

youtubeAddressForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  handleYouTubeAddress(youtubeAddressInput?.value || "youtube.com");
});

youtubeResultsGrid?.addEventListener("click", (event) => {
  const saveButton = event.target.closest("[data-youtube-save-video]");
  if (saveButton) {
    event.preventDefault();
    event.stopPropagation();
    const video = getYouTubeDisplayResults().find((item) => item.id === saveButton.dataset.youtubeSaveVideo);
    toggleYouTubeFavorite(video);
    return;
  }

  const globalSaveButton = event.target.closest("[data-youtube-global-video]");
  if (globalSaveButton) {
    event.preventDefault();
    event.stopPropagation();
    const videoId = globalSaveButton.dataset.youtubeGlobalVideo;
    const video = getYouTubeDisplayResults().find((item) => item.id === videoId) || findKnownYouTubeVideo(videoId);
    toggleYouTubeGlobalFavorite(video || { id: videoId });
    return;
  }

  const button = event.target.closest("[data-youtube-app-video]");
  if (!button) return;
  const video = getYouTubeDisplayResults().find((item) => item.id === button.dataset.youtubeAppVideo);
  selectYouTubeAppVideo(video);
});

youtubeFrameWrap?.addEventListener("click", (event) => {
  const dismissButton = event.target.closest("[data-youtube-dismiss-hint]");
  if (dismissButton) {
    dismissYouTubePlayerHint();
    return;
  }

  const fullscreenButton = event.target.closest("[data-youtube-video-fullscreen]");
  if (fullscreenButton) {
    toggleYouTubeVideoFullscreen();
    return;
  }
  const retryButton = event.target.closest("[data-youtube-retry-embed]");
  if (retryButton) {
    toggleYouTubeEmbedHost();
    return;
  }
  const openButton = event.target.closest("[data-youtube-open-current]");
  if (openButton) {
    window.open(getYouTubeWatchUrl(), "_blank", "noopener,noreferrer");
    return;
  }

  const copyButton = event.target.closest("[data-youtube-copy-current]");
  if (copyButton) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(getYouTubeWatchUrl()).catch(() => {});
    }
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy Link";
    }, 1100);
  }
});

youtubeLoadMore?.addEventListener("click", () => {
  if (youtubeAppState.mode === "movies") {
    showYouTubeMovies({ append: true });
    return;
  }
  searchYouTubeApp({ append: true });
});

youtubeClearHistoryButton?.addEventListener("click", () => {
  clearYouTubeHistory();
});

youtubeSaveAllButton?.addEventListener("click", () => {
  saveAllVisibleYouTubeVideos();
});

youtubeOpenTabButton?.addEventListener("click", () => {
  window.open(getYouTubeWatchUrl(), "_blank", "noopener,noreferrer");
});

youtubeFullscreenButton?.addEventListener("click", () => {
  toggleYouTubeFullscreen();
});

youtubeToggleResultsButton?.addEventListener("click", () => {
  toggleYouTubeResultsPanel();
});

youtubeDrawer?.addEventListener("click", (event) => {
  const homeButton = event.target.closest("[data-youtube-home]");
  if (homeButton) {
    if (youtubeSearchInput) youtubeSearchInput.placeholder = "Search YouTube";
    loadYouTubeHome();
    return;
  }

  const moviesButton = event.target.closest("[data-youtube-movies]");
  if (moviesButton) {
    showYouTubeMovies();
    return;
  }

  const historyButton = event.target.closest("[data-youtube-history]");
  if (historyButton) {
    if (youtubeSearchInput) youtubeSearchInput.placeholder = "Search YouTube";
    showYouTubeHistory();
    return;
  }

  const favoritesButton = event.target.closest("[data-youtube-favorites]");
  if (favoritesButton) {
    if (youtubeSearchInput) youtubeSearchInput.placeholder = "Search YouTube";
    showYouTubeFavorites();
    return;
  }

  const globalButton = event.target.closest("[data-youtube-global]");
  if (globalButton) {
    if (youtubeSearchInput) youtubeSearchInput.placeholder = "Search YouTube";
    showYouTubeGlobal();
    return;
  }

  const topicButton = event.target.closest("[data-youtube-topic]");
  if (!topicButton) return;
  if (youtubeSearchInput) youtubeSearchInput.placeholder = "Search YouTube";
  if (youtubeSearchInput) youtubeSearchInput.value = topicButton.dataset.youtubeTopic;
  searchYouTubeApp();
});

function syncYouTubeFullscreenState() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  if (youtubeAppState.fullscreen && fullscreenElement !== youtubePanel) {
    setYouTubeFullscreen(false);
  }
  if (youtubeAppState.videoFullscreen && fullscreenElement !== youtubeFrameWrap) {
    setYouTubeVideoFullscreen(false);
  }
}

document.addEventListener("fullscreenchange", syncYouTubeFullscreenState);
document.addEventListener("webkitfullscreenchange", syncYouTubeFullscreenState);

gameLaunchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openGame(button.dataset.launchGame);
  });
});

webButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openWebApp(button.dataset.openWeb);
  });
});

launcherGameGrid?.addEventListener("click", (event) => {
  const installButton = event.target.closest("button[data-install-ref]");
  if (installButton) {
    installApp(installButton.dataset.installRef);
    return;
  }

  const removeButton = event.target.closest("button[data-remove-ref]");
  if (removeButton) {
    removeInstalledApp(removeButton.dataset.removeRef);
    return;
  }

  const openRefButton = event.target.closest("button[data-app-open-ref]");
  if (openRefButton) {
    openAppRef(openRefButton.dataset.appOpenRef);
    return;
  }

  const localButton = event.target.closest("button[data-launch-game]");
  if (localButton) {
    openGame(localButton.dataset.launchGame);
    return;
  }

  const panelButton = event.target.closest("button[data-open-panel]");
  if (panelButton) {
    if (panelButton.dataset.openPanel === "youtube") {
      openYouTubeApp();
    } else if (panelButton.dataset.openPanel === "velhub") {
      openVelHubApp();
    } else {
      openPanel(panelButton.dataset.openPanel);
    }
    return;
  }

  const button = event.target.closest("button[data-open-web]");
  if (!button) return;
  openWebApp(button.dataset.openWeb);
});

recentAppsTray?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-recent-type]");
  if (!button) return;

  const type = button.dataset.recentType;
  const id = button.dataset.recentId;
  if (type === "web") openWebApp(id);
  if (type === "game") openGame(id);
  if (type === "panel" && id === "youtube") {
    openYouTubeApp();
    return;
  }
  if (type === "panel" && id === "velhub") {
    openVelHubApp();
    return;
  }
  if (type === "panel" && utilityApps[id]?.panel) openPanel(utilityApps[id].panel);
});

webUrlForm.addEventListener("submit", (event) => {
  event.preventDefault();
  openCustomWebUrl(webUrlInput.value);
});

mediaEmbedForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const app = webApps[activeWeb];
  if (app?.mode !== "videoEmbed") return;

  const embedUrl = buildVideoEmbedUrl(app.provider, mediaEmbedInput.value);
  if (!embedUrl) {
    webFrame.srcdoc = makeBlockedFrame(
      {
        title: "Could not embed",
        note: `Paste a valid ${app.title} video link or ID. The full ${app.title} homepage cannot be embedded here.`
      },
      "about:blank"
    );
    return;
  }

  currentWebUrl = embedUrl;
  webUrlInput.value = embedUrl;
  webFrame.removeAttribute("srcdoc");
  webFrame.src = embedUrl;
});

mediaSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  handleMediaSearch(mediaSearchInput.value);
});

mediaSearchInput?.addEventListener("input", () => {
  window.clearTimeout(mediaSearchDebounceTimer);
  if (mediaState.provider !== "spotify") return;
  mediaSearchDebounceTimer = window.setTimeout(() => {
    handleMediaSearch(mediaSearchInput.value);
  }, 420);
});

mediaProviderButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openMediaProvider(button.dataset.mediaProvider);
  });
});

mediaGrid?.addEventListener("click", (event) => {
  if (event.target.closest("a")) return;
  const directMediaButton = event.target.closest("button[data-media-kind], button[data-spotify-type], button[data-tiktok-connect], button[data-media-retry]");
  if (directMediaButton) {
    selectMediaCard(directMediaButton);
    return;
  }
  selectMediaCard(event.target.closest(".media-card"));
});

mediaGrid?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".media-card");
  if (!card) return;
  event.preventDefault();
  selectMediaCard(card);
});

mediaLoadMore?.addEventListener("click", () => {
  searchYouTube({ append: true });
});

velHubSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  velHubState.query = velHubSearchInput?.value || "";
  loadVelHubMovies();
});

velHubCategoryRow?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-velhub-category]");
  if (!button) return;
  velHubState.category = button.dataset.velhubCategory || "popular";
  if (!VEL_HUB_CATEGORY_QUERIES[velHubState.category]) velHubState.category = "popular";
  loadVelHubMovies();
});

velHubGrid?.addEventListener("click", (event) => {
  const retryButton = event.target.closest("[data-velhub-retry]");
  if (retryButton) {
    loadVelHubMovies();
    return;
  }
  const movieButton = event.target.closest("[data-velhub-movie]");
  if (!movieButton) return;
  const movie = velHubState.movies.find((item) => item.id === movieButton.dataset.velhubMovie);
  openVelHubMovie(movie);
});

velHubModernGrid?.addEventListener("click", (event) => {
  const trailerButton = event.target.closest("[data-velhub-modern-trailer]");
  if (trailerButton) {
    openVelHubTrailerSearch(trailerButton.dataset.velhubModernTrailer);
    return;
  }

  const watchButton = event.target.closest("[data-velhub-modern-watch]");
  if (watchButton) {
    openVelHubWatchOptions(watchButton.dataset.velhubModernWatch);
  }
});

velHubLoadMoreButton?.addEventListener("click", () => {
  loadVelHubMovies({ append: true });
});

velHubWindowButton?.addEventListener("click", () => {
  setVelHubCinema(!velHubState.cinema);
});

velHubRefreshButton?.addEventListener("click", () => {
  loadVelHubMovies();
});

velHubClosePlayerButton?.addEventListener("click", () => {
  closeVelHubPlayer();
});

velHubOpenTabButton?.addEventListener("click", () => {
  if (velHubState.currentMovie?.sourceUrl) {
    window.open(velHubState.currentMovie.sourceUrl, "_blank", "noopener,noreferrer");
  }
});

velHubFullscreenButton?.addEventListener("click", async () => {
  const target = velHubFrameWrap || velHubPlayer;
  if (!target) return;
  const requestFullscreen = target.requestFullscreen
    || target.webkitRequestFullscreen
    || target.msRequestFullscreen;
  try {
    if (requestFullscreen && !document.fullscreenElement && !document.webkitFullscreenElement) {
      await requestFullscreen.call(target);
    }
  } catch (error) {
    // Some iPad browsers limit fullscreen from custom elements. The iframe still plays normally.
  }
});

mediaPlayerClose?.addEventListener("click", () => {
  mediaPlayer.hidden = true;
  youtubePlayer?.destroy?.();
  youtubePlayer = null;
  mediaPlayerFrame.innerHTML = "";
});

settingsWallpaperButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyWallpaper(button.dataset.wallpaperOption);
  });
});

themePackButtons.forEach((button) => {
  button.addEventListener("click", () => {
    unlockOrApplyThemePack(button.dataset.themePack);
  });
});

settingsFontButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyFont(button.dataset.fontOption);
  });
});

settingsDensityButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyDensity(button.dataset.densityOption);
  });
});

settingsZoomButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyZoom(button.dataset.zoomOption);
  });
});

settingsTaskbarButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTaskbarPosition(button.dataset.taskbarPosition);
  });
});

customThemePick?.addEventListener("click", () => {
  customThemeInput?.click();
});

customThemeInput?.addEventListener("change", () => {
  readCustomThemeFile(customThemeInput.files?.[0]);
  if (customThemeInput) customThemeInput.value = "";
});

customThemeCreate?.addEventListener("click", () => {
  createCustomTheme();
});

customThemeApply?.addEventListener("click", () => {
  if (!applyCustomWallpaper()) {
    setCustomThemeStatus("Create a custom theme first.", "warn");
  }
  renderThemeStore();
});

ownerLockDismiss?.addEventListener("click", () => {
  hideOwnerLockOverlay({ force: true });
});

screenShareAccept?.addEventListener("click", () => {
  acceptScreenShareRequest();
});

screenShareDismiss?.addEventListener("click", () => {
  dismissScreenShareRequest();
});

screenViewerClose?.addEventListener("click", () => {
  stopScreenShare({ reason: "owner-stopped" });
});

homeEditButton?.addEventListener("click", () => {
  setHomeEditMode(true);
});

homeEditDone?.addEventListener("click", () => {
  setHomeEditMode(false);
});

homeEditReset?.addEventListener("click", () => {
  resetHomeLayout();
});

homeTaskbarButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTaskbarPosition(button.dataset.homeTaskbar);
  });
});

resetWindowsButton?.addEventListener("click", () => {
  resetWindowPositions();
});

networkVpnButton?.addEventListener("click", () => {
  networkVpnButton.textContent = "Use Device Settings";
  window.setTimeout(() => {
    networkVpnButton.textContent = "Direct Mode Active";
  }, 1600);
});

proxyNoteSave?.addEventListener("click", () => {
  networkNote = proxyNoteInput?.value.trim() || "";
  storage.set("vel-network-note", networkNote);
  renderNetworkState();
});

proxyNoteInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  proxyNoteSave?.click();
});

webReloadButton?.addEventListener("click", () => {
  const app = webApps[activeWeb];
  if (app?.mode === "videoEmbed" && currentWebUrl === "about:blank") {
    webFrame.srcdoc = makeVideoPromptFrame(app);
    return;
  }
  if (app?.embedBlocked && currentWebMirrorIndex === 0) {
    webFrame.srcdoc = makeBlockedFrame(app, currentWebUrl);
    return;
  }
  webFrame.src = currentWebUrl;
});

webMirrorButton?.addEventListener("click", () => {
  openNextMirror();
});

switchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveLocalGame(button.dataset.gameSwitch);
    recordRecentApp({ type: "game", id: button.dataset.gameSwitch });
  });
});

document.addEventListener("keydown", (event) => {
  if (event.target?.closest?.(".vel-chat")) {
    if (event.key === "Escape") {
      event.preventDefault();
      setVelChatCollapsed(true);
    }
    return;
  }

  if (event.key === "Escape") {
    closeAllPanels();
    return;
  }

  if (event.target instanceof HTMLInputElement) return;
  if (!isDrawerOpen("game")) return;

  const directions = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right"
  };
  const direction = directions[event.code] || directions[event.key];

  if (event.code === "Space" && activeLocalGame === "snake") {
    event.preventDefault();
    snake.toggle();
    return;
  }

  if (event.key?.toLowerCase?.() === "r" && activeLocalGame === "snake") {
    event.preventDefault();
    snake.reset();
    return;
  }

  if (!direction) return;

  if (activeLocalGame === "merge") {
    event.preventDefault();
    merge.move(direction);
  }

  if (activeLocalGame === "snake") {
    event.preventDefault();
    snake.setDirection(direction, { autoStart: true });
  }
});

function bindSwipe(element, callback) {
  if (!element) return;

  let startX = 0;
  let startY = 0;
  let trackingTouch = false;
  const supportsPointer = "PointerEvent" in window;

  const finishSwipe = (clientX, clientY) => {
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;
    const threshold = 24;

    if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      callback(deltaX > 0 ? "right" : "left");
    } else {
      callback(deltaY > 0 ? "down" : "up");
    }
  };

  if (supportsPointer) {
    element.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      startX = event.clientX;
      startY = event.clientY;
      element.setPointerCapture?.(event.pointerId);
    });

    element.addEventListener("pointerup", (event) => {
      event.preventDefault();
      finishSwipe(event.clientX, event.clientY);
      element.releasePointerCapture?.(event.pointerId);
    });

    element.addEventListener("pointercancel", (event) => {
      element.releasePointerCapture?.(event.pointerId);
    });
  } else {
    element.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      trackingTouch = true;
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: false });

    element.addEventListener("touchmove", (event) => {
      if (!trackingTouch) return;
      event.preventDefault();
    }, { passive: false });

    element.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      if (!trackingTouch || !touch) return;
      event.preventDefault();
      trackingTouch = false;
      finishSwipe(touch.clientX, touch.clientY);
    }, { passive: false });
  }
}

webHelperMirrorButton?.addEventListener("click", () => {
  openNextMirror();
});

webHelperLocalButton?.addEventListener("click", () => {
  openGame(activeLocalGame || "snake");
});

lyricsHideButton?.addEventListener("click", () => {
  setLyricsWidgetHidden(true);
});

lyricsShowButton?.addEventListener("click", () => {
  setLyricsWidgetHidden(false);
});

velofyPrev.addEventListener("click", () => {
  playVelofyOffset(-1);
});
velofyNext.addEventListener("click", () => {
  playVelofyOffset(1);
});
velofyPlay.addEventListener("click", () => {
  if (currentVelofyMode === "spotify") {
    openCurrentSpotifyExternal();
    return;
  }
  if (audioElement.paused) {
    audioElement.play().catch(() => {});
  } else {
    audioElement.pause();
  }
});
taskbarPrevButton?.addEventListener("click", () => {
  playVelofyOffset(-1);
});
taskbarNextButton?.addEventListener("click", () => {
  playVelofyOffset(1);
});
taskbarPlayButton?.addEventListener("click", () => {
  if (currentVelofyMode === "spotify") {
    openCurrentSpotifyExternal();
    return;
  }
  if (audioElement.paused) {
    audioElement.play().catch(() => {});
  } else {
    audioElement.pause();
  }
});

audioElement.addEventListener("play", updateNowPlayingUi);
audioElement.addEventListener("pause", updateNowPlayingUi);
audioElement.addEventListener("ended", () => loadTrack(currentTrackIndex + 1, true));
audioElement.addEventListener("loadedmetadata", () => {
  velofyProgress.max = String(Math.floor(audioElement.duration || 0));
  velofyDuration.textContent = formatSeconds(audioElement.duration || 0);
  renderLyricsWidget();
  syncLyricsPlayback(true);
});
audioElement.addEventListener("timeupdate", () => {
  velofyProgress.value = String(Math.floor(audioElement.currentTime || 0));
  velofyElapsed.textContent = formatSeconds(audioElement.currentTime || 0);
  syncLyricsPlayback();
});
velofyProgress.addEventListener("input", () => {
  audioElement.currentTime = Number(velofyProgress.value);
  velofyElapsed.textContent = formatSeconds(audioElement.currentTime || 0);
  syncLyricsPlayback(true);
});
velofyPlaylist.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-velofy-add-ref]");
  if (addButton) {
    addVelofyRefToPlaylist(addButton.dataset.velofyAddRef);
    return;
  }

  const button = event.target.closest("button[data-track-index]");
  if (button) {
    loadTrack(Number(button.dataset.trackIndex), true);
    return;
  }
  const spotifyButton = event.target.closest("button[data-spotify-track-id]");
  if (!spotifyButton) return;
  const track = savedSpotifyTracks.find((item) => item.id === spotifyButton.dataset.spotifyTrackId);
  openVelofySpotifyTrack(track);
});
velofySearch?.addEventListener("input", () => {
  velofySearchQuery = velofySearch.value;
  renderPlaylist();
});

velofyPlaylistSelect?.addEventListener("change", () => {
  velofyPlaylistMode = velofyPlaylistSelect.value || "all";
  storage.set("velofy-playlist-mode", velofyPlaylistMode);
  renderPlaylist();
});

velofyNewPlaylistButton?.addEventListener("click", () => {
  createVelofyPlaylist();
});

velofyShuffleButton?.addEventListener("click", () => {
  velofyShuffleEnabled = !velofyShuffleEnabled;
  storage.set("velofy-shuffle", velofyShuffleEnabled ? "1" : "0");
  renderVelofyPlaylistSelect();
});

velofySpotifySearchButton?.addEventListener("click", () => {
  searchVelofySpotify();
});

velofySpotifySearch?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  searchVelofySpotify();
});

velofySpotifyResults?.addEventListener("click", (event) => {
  const playButton = event.target.closest("[data-velofy-spotify-play]");
  const saveButton = event.target.closest("[data-velofy-spotify-save]");
  const id = playButton?.dataset.velofySpotifyPlay || saveButton?.dataset.velofySpotifySave;
  if (!id) return;
  const track = velofySpotifySearchResults.find((item) => item.id === id)
    || savedSpotifyTracks.find((item) => item.id === id);
  if (saveButton) {
    saveVelofySpotifyTrack(track);
    renderVelofySpotifyResults();
    return;
  }
  openVelofySpotifyTrack(track);
});

velofyImportButton?.addEventListener("click", () => {
  velofyImportInput?.click();
});
velofyImportInput?.addEventListener("change", () => {
  const files = [...(velofyImportInput.files || [])].filter((file) => file.type.startsWith("audio/"));
  if (!files.length) return;

  const imported = files.map((file) => ({
    title: file.name.replace(/\.[^.]+$/, ""),
    artist: "Imported Track",
    src: URL.createObjectURL(file)
  }));

  velofyTracks.push(...imported);
  renderPlaylist();
  if (audioElement.paused && imported.length) {
    loadTrack(velofyTracks.length - imported.length, false);
  } else {
    updateNowPlayingUi();
  }
  velofyState.textContent = `${imported.length} track${imported.length === 1 ? "" : "s"} imported`;
  velofyImportInput.value = "";
});

async function importLyricsFiles(fileList) {
  const files = [...(fileList || [])].filter((file) => /\.(txt|lrc)$/i.test(file.name));
  if (!files.length) {
    renderLyricsWidget("Pick a .txt or .lrc file for the current song.");
    return;
  }

  const nextLibrary = { ...lyricsLibrary };
  const currentTrack = velofyTracks[currentTrackIndex];

  for (const file of files) {
    const parsed = parseLyricsText(await file.text());
    if (!parsed?.lines?.length) continue;
    nextLibrary[normalizeLyricsKey(file.name)] = parsed;
    if (files.length === 1 && currentTrack) {
      getTrackLyricsKeys(currentTrack).forEach((key) => {
        nextLibrary[key] = parsed;
      });
    }
  }

  lyricsLibrary = nextLibrary;
  storage.set("vel-lyrics-library", JSON.stringify(lyricsLibrary));
  renderLyricsWidget(`${files.length} lyric file${files.length === 1 ? "" : "s"} loaded.`);
}

lyricsImportButton?.addEventListener("click", () => {
  lyricsImportInput?.click();
});

lyricsImportInput?.addEventListener("change", async () => {
  await importLyricsFiles(lyricsImportInput.files);
  lyricsImportInput.value = "";
});

lyricsCollapseButton?.addEventListener("click", () => {
  setLyricsWidgetCollapsed(!lyricsWidgetCollapsed);
});

lyricsSyncEarlierButton?.addEventListener("click", () => {
  nudgeLyricsSync(-0.25);
});

lyricsSyncResetButton?.addEventListener("click", () => {
  resetLyricsSync();
});

lyricsSyncLaterButton?.addEventListener("click", () => {
  nudgeLyricsSync(0.25);
});

lyricsContent?.addEventListener("click", (event) => {
  const lineElement = event.target.closest(".lyrics-line");
  if (!lineElement) return;
  syncLyricsFromLine(Number(lineElement.dataset.lyricIndex));
});

["dragenter", "dragover"].forEach((eventName) => {
  lyricsWidget?.addEventListener(eventName, (event) => {
    event.preventDefault();
    lyricsWidget.classList.add("is-drop-target");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  lyricsWidget?.addEventListener(eventName, (event) => {
    event.preventDefault();
    lyricsWidget.classList.remove("is-drop-target");
  });
});

lyricsWidget?.addEventListener("drop", async (event) => {
  await importLyricsFiles(event.dataTransfer?.files);
});

const merge = (() => {
  const boardElement = document.getElementById("mergeBoard");
  const scoreElement = document.getElementById("mergeScore");
  const bestElement = document.getElementById("mergeBest");
  const statusElement = document.getElementById("mergeStatus");
  const resetButton = document.getElementById("mergeReset");
  const pad = document.querySelector('.mobile-pad[data-pad="merge"]');

  let board = Array(16).fill(0);
  let score = 0;
  let best = storage.get("vel-merge-best", 0);

  function emptyIndices() {
    return board
      .map((value, index) => ({ value, index }))
      .filter((item) => item.value === 0)
      .map((item) => item.index);
  }

  function addRandomTile() {
    const choices = emptyIndices();
    if (!choices.length) return;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    board[pick] = Math.random() < 0.9 ? 2 : 4;
  }

  function updateBest() {
    if (score > best) {
      best = score;
      storage.set("vel-merge-best", best);
    }
    bestElement.textContent = String(best);
  }

  function render() {
    boardElement.innerHTML = "";
    board.forEach((value) => {
      const cell = document.createElement("div");
      cell.className = `merge-cell${value === 0 ? " empty" : ""}`;
      if (value > 0) {
        cell.dataset.value = String(value);
        cell.textContent = String(value);
      } else {
        cell.textContent = "0";
      }
      boardElement.appendChild(cell);
    });
    scoreElement.textContent = String(score);
    updateBest();
  }

  function slideLine(line) {
    const filtered = line.filter(Boolean);
    const merged = [];
    let moved = false;

    for (let index = 0; index < filtered.length; index += 1) {
      if (filtered[index] === filtered[index + 1]) {
        const value = filtered[index] * 2;
        merged.push(value);
        score += value;
        index += 1;
        moved = true;
      } else {
        merged.push(filtered[index]);
      }
    }

    while (merged.length < 4) {
      merged.push(0);
    }

    if (!moved) {
      moved = merged.some((value, index) => value !== line[index]);
    }

    return { line: merged, moved };
  }

  function applyDirection(direction) {
    const nextBoard = [...board];
    let moved = false;

    for (let outer = 0; outer < 4; outer += 1) {
      let indices = [];

      if (direction === "left" || direction === "right") {
        indices = [0, 1, 2, 3].map((inner) => outer * 4 + inner);
      } else {
        indices = [0, 1, 2, 3].map((inner) => inner * 4 + outer);
      }

      if (direction === "right" || direction === "down") {
        indices.reverse();
      }

      const values = indices.map((index) => board[index]);
      const result = slideLine(values);
      if (result.moved) moved = true;
      result.line.forEach((value, index) => {
        nextBoard[indices[index]] = value;
      });
    }

    if (moved) {
      board = nextBoard;
      addRandomTile();
      render();
      statusElement.textContent = isGameOver()
        ? "No more moves. Start a new board and go again."
        : "Clean move. Keep merging toward 2048.";
    }
  }

  function isGameOver() {
    if (emptyIndices().length > 0) return false;

    return !board.some((value, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const right = col < 3 ? board[index + 1] : null;
      const down = row < 3 ? board[index + 4] : null;
      return value === right || value === down;
    });
  }

  function move(direction) {
    if (isGameOver()) {
      statusElement.textContent = "No more moves. Start a new board and go again.";
      return;
    }
    applyDirection(direction);
  }

  function reset() {
    board = Array(16).fill(0);
    score = 0;
    addRandomTile();
    addRandomTile();
    render();
    statusElement.textContent = "Fresh board loaded. Merge matching tiles to build momentum.";
  }

  resetButton.addEventListener("click", reset);
  pad?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-dir]");
    if (!button) return;
    move(button.dataset.dir);
  });
  bindSwipe(document.getElementById("mergeSwipeZone"), move);

  return { reset, move };
})();

const memory = (() => {
  const gridElement = document.getElementById("memoryGrid");
  const movesElement = document.getElementById("memoryMoves");
  const pairsElement = document.getElementById("memoryPairs");
  const statusElement = document.getElementById("memoryStatus");
  const resetButton = document.getElementById("memoryReset");

  const symbols = ["Nova", "Orbit", "Pulse", "Luna", "Ray", "Comet"];

  let deck = [];
  let revealed = [];
  let matched = 0;
  let moves = 0;
  let lockBoard = false;

  function shuffle(items) {
    const clone = [...items];
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    }
    return clone;
  }

  function updateCopy() {
    movesElement.textContent = String(moves);
    pairsElement.textContent = `${matched} / 6`;
  }

  function render() {
    gridElement.innerHTML = "";
    deck.forEach((card, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `memory-card${card.revealed ? " is-revealed" : ""}${card.matched ? " is-matched" : ""}`;
      button.dataset.index = String(index);
      button.innerHTML = `
        <span class="memory-card-inner">
          <span class="memory-face memory-front"></span>
          <span class="memory-face memory-back">
            <strong>${card.label}</strong>
          </span>
        </span>
      `;
      gridElement.appendChild(button);
    });
  }

  function reset() {
    const pairs = symbols.flatMap((label) => [
      { label, revealed: false, matched: false },
      { label, revealed: false, matched: false }
    ]);
    deck = shuffle(pairs);
    revealed = [];
    matched = 0;
    moves = 0;
    lockBoard = false;
    updateCopy();
    render();
    statusElement.textContent = "Grid shuffled. Flip cards and lock in the pairs.";
  }

  function checkRound() {
    if (revealed.length < 2) return;

    const [firstIndex, secondIndex] = revealed;
    const first = deck[firstIndex];
    const second = deck[secondIndex];

    moves += 1;
    updateCopy();

    if (first.label === second.label) {
      deck[firstIndex].matched = true;
      deck[secondIndex].matched = true;
      matched += 1;
      revealed = [];
      render();
      updateCopy();
      statusElement.textContent =
        matched === symbols.length
          ? `Board cleared in ${moves} moves. Shuffle for another round.`
          : "Pair found. Keep going.";
      return;
    }

    lockBoard = true;
    statusElement.textContent = "No match. Watch the board and try again.";

    window.setTimeout(() => {
      deck[firstIndex].revealed = false;
      deck[secondIndex].revealed = false;
      revealed = [];
      lockBoard = false;
      render();
    }, 720);
  }

  gridElement.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button || lockBoard) return;

    const index = Number(button.dataset.index);
    const card = deck[index];
    if (card.revealed || card.matched) return;

    deck[index].revealed = true;
    revealed.push(index);
    render();
    checkRound();
  });

  resetButton.addEventListener("click", reset);

  return { reset };
})();

const snake = (() => {
  const canvas = document.getElementById("snakeCanvas");
  const context = canvas.getContext("2d");
  const scoreElement = document.getElementById("snakeScore");
  const bestElement = document.getElementById("snakeBest");
  const statusElement = document.getElementById("snakeStatus");
  const startPauseButton = document.getElementById("snakeStartPause");
  const resetButton = document.getElementById("snakeReset");
  const pad = document.querySelector('.mobile-pad[data-pad="snake"]');

  const gridSize = 18;
  let snakeBody = [];
  let direction = "right";
  let nextDirection = "right";
  let food = { x: 10, y: 10 };
  let score = 0;
  let best = storage.get("vel-snake-best", 0);
  let intervalId = null;
  let running = false;
  let gameOver = false;

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function updateCopy() {
    scoreElement.textContent = String(score);
    bestElement.textContent = String(best);
    startPauseButton.textContent = running ? "Pause" : "Start";
  }

  function randomFood() {
    let nextFood = null;
    do {
      nextFood = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize)
      };
    } while (snakeBody.some((segment) => segment.x === nextFood.x && segment.y === nextFood.y));
    food = nextFood;
  }

  function resetState() {
    snakeBody = [
      { x: 6, y: 9 },
      { x: 5, y: 9 },
      { x: 4, y: 9 }
    ];
    direction = "right";
    nextDirection = "right";
    score = 0;
    gameOver = false;
    randomFood();
    updateCopy();
  }

  function fillRoundedRect(x, y, width, height, radius) {
    if (typeof context.roundRect === "function") {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      context.fill();
      return;
    }
    context.fillRect(x, y, width, height);
  }

  function drawGrid(size) {
    context.strokeStyle = "rgba(255, 255, 255, 0.05)";
    context.lineWidth = 1;
    for (let index = 0; index <= gridSize; index += 1) {
      context.beginPath();
      context.moveTo(index * size, 0);
      context.lineTo(index * size, gridSize * size);
      context.stroke();

      context.beginPath();
      context.moveTo(0, index * size);
      context.lineTo(gridSize * size, index * size);
      context.stroke();
    }
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const size = rect.width / gridSize;

    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = "#050505";
    context.fillRect(0, 0, rect.width, rect.height);
    drawGrid(size);

    snakeBody.forEach((segment, index) => {
      context.fillStyle = index === 0 ? "#ffffff" : "#d8d8d8";
      fillRoundedRect(segment.x * size + 2, segment.y * size + 2, size - 4, size - 4, 8);
    });

    context.beginPath();
    context.fillStyle = "#ffffff";
    context.arc(food.x * size + size / 2, food.y * size + size / 2, size * 0.24, 0, Math.PI * 2);
    context.fill();
  }

  function endGame() {
    running = false;
    gameOver = true;
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    if (score > best) {
      best = score;
      storage.set("vel-snake-best", best);
    }
    updateCopy();
    statusElement.textContent = `Crash. Final score ${score}. Reset or start a fresh run.`;
    draw();
  }

  function tick() {
    direction = nextDirection;
    const head = { ...snakeBody[0] };

    if (direction === "up") head.y -= 1;
    if (direction === "down") head.y += 1;
    if (direction === "left") head.x -= 1;
    if (direction === "right") head.x += 1;

    if (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= gridSize ||
      head.y >= gridSize ||
      snakeBody.some((segment) => segment.x === head.x && segment.y === head.y)
    ) {
      endGame();
      return;
    }

    snakeBody.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 1;
      if (score > best) {
        best = score;
        storage.set("vel-snake-best", best);
      }
      randomFood();
      statusElement.textContent = "Food collected. Keep the trail clean.";
    } else {
      snakeBody.pop();
    }

    updateCopy();
    draw();
  }

  function start() {
    if (running) {
      pause("Snake paused.");
      return;
    }
    if (gameOver) {
      resetState();
      draw();
    }
    running = true;
    updateCopy();
    statusElement.textContent = "Run live. Collect food and avoid your tail.";
    intervalId = window.setInterval(tick, 125);
  }

  function pause(message = "Snake paused.") {
    if (!running) return;
    running = false;
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    updateCopy();
    statusElement.textContent = message;
  }

  function reset() {
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    running = false;
    resetState();
    statusElement.textContent = "Board reset. Press start when you are ready.";
    draw();
  }

  function setDirection(next, options = {}) {
    const opposites = {
      up: "down",
      down: "up",
      left: "right",
      right: "left"
    };
    if (opposites[direction] === next) return;
    nextDirection = next;
    try {
      canvas.focus({ preventScroll: true });
    } catch {
      canvas.focus();
    }
    if (options.autoStart && !running) {
      start();
    }
  }

  startPauseButton.addEventListener("click", start);
  resetButton.addEventListener("click", reset);
  pad?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-dir]");
    if (!button) return;
    setDirection(button.dataset.dir, { autoStart: true });
  });
  bindSwipe(document.getElementById("snakeSwipeZone"), (directionName) => {
    setDirection(directionName, { autoStart: true });
  });
  window.addEventListener("resize", resizeCanvas);

  resetState();
  window.setTimeout(resizeCanvas, 0);

  return { start, reset, pause, refresh: resizeCanvas, setDirection, toggle: start };
})();

const wordWarp = (() => {
  const categoryElement = document.getElementById("wordCategory");
  const scrambleElement = document.getElementById("wordScramble");
  const hintElement = document.getElementById("wordHint");
  const statusElement = document.getElementById("wordStatus");
  const streakElement = document.getElementById("wordStreak");
  const solvedElement = document.getElementById("wordSolved");
  const form = document.getElementById("wordForm");
  const input = document.getElementById("wordInput");
  const shuffleButton = document.getElementById("wordShuffle");
  const nextButton = document.getElementById("wordNext");

  const words = [
    { word: "galaxy", category: "Theme: space", hint: "A huge island of stars." },
    { word: "meteor", category: "Theme: sky", hint: "A fast rock streaking through the atmosphere." },
    { word: "rocket", category: "Theme: launch", hint: "It blasts upward on a bright plume." },
    { word: "planet", category: "Theme: orbit", hint: "A world circling a star." },
    { word: "puzzle", category: "Theme: game", hint: "A challenge solved with logic." },
    { word: "arcade", category: "Theme: play", hint: "A place full of games." },
    { word: "comet", category: "Theme: sky", hint: "A bright traveler with a tail." },
    { word: "signal", category: "Theme: tech", hint: "A message or pattern sent out." }
  ];

  let currentWord = words[0];
  let streak = 0;
  let solved = 0;

  function shuffleLetters(word) {
    const letters = word.toUpperCase().split("");
    let shuffled = [...letters];

    do {
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
    } while (shuffled.join("") === letters.join(""));

    return shuffled.join(" ");
  }

  function updateCopy() {
    categoryElement.textContent = currentWord.category;
    scrambleElement.textContent = shuffleLetters(currentWord.word);
    hintElement.textContent = `Hint: ${currentWord.hint}`;
    streakElement.textContent = String(streak);
    solvedElement.textContent = String(solved);
    input.value = "";
  }

  function pickNewWord() {
    const options = words.filter((item) => item.word !== currentWord.word);
    currentWord = options[Math.floor(Math.random() * options.length)];
    updateCopy();
    statusElement.textContent = "New word loaded. Keep the streak moving.";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const guess = input.value.trim().toLowerCase();

    if (!guess) {
      statusElement.textContent = "Type a guess before you submit.";
      return;
    }

    if (guess === currentWord.word) {
      streak += 1;
      solved += 1;
      updateCopy();
      statusElement.textContent = `Correct. ${currentWord.word.toUpperCase()} locked in.`;
      window.setTimeout(pickNewWord, 750);
      return;
    }

    streak = 0;
    streakElement.textContent = String(streak);
    statusElement.textContent = "Not quite. Try again or reshuffle the letters.";
  });

  shuffleButton.addEventListener("click", () => {
    scrambleElement.textContent = shuffleLetters(currentWord.word);
    statusElement.textContent = "Letters reshuffled. Fresh angle, same word.";
  });

  nextButton.addEventListener("click", pickNewWord);

  updateCopy();

  return { pickNewWord };
})();

const tapRush = (() => {
  const gridElement = document.getElementById("tapGrid");
  const scoreElement = document.getElementById("tapScore");
  const timeElement = document.getElementById("tapTime");
  const bestElement = document.getElementById("tapBest");
  const statusElement = document.getElementById("tapStatus");
  const startButton = document.getElementById("tapStart");

  const cellCount = 12;
  let score = 0;
  let timeLeft = 20;
  let best = storage.get("vel-tap-best", 0);
  let activeIndex = -1;
  let running = false;
  let moveTimer = null;
  let clockTimer = null;
  let speed = 680;

  function renderGrid() {
    gridElement.innerHTML = "";
    for (let index = 0; index < cellCount; index += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tap-cell${index === activeIndex ? " is-target" : ""}`;
      button.dataset.index = String(index);
      gridElement.appendChild(button);
    }
    scoreElement.textContent = String(score);
    timeElement.textContent = String(timeLeft);
    bestElement.textContent = String(best);
  }

  function activateRandomCell() {
    let nextIndex = 0;
    do {
      nextIndex = Math.floor(Math.random() * cellCount);
    } while (nextIndex === activeIndex && cellCount > 1);
    activeIndex = nextIndex;
    renderGrid();
  }

  function clearTimers() {
    if (moveTimer) {
      window.clearInterval(moveTimer);
      moveTimer = null;
    }
    if (clockTimer) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
  }

  function stop(updateBestScore = true, message = "Sprint over. Press start for another run.") {
    if (!running && !moveTimer && !clockTimer) {
      statusElement.textContent = message;
      activeIndex = -1;
      renderGrid();
      return;
    }

    running = false;
    clearTimers();
    if (updateBestScore && score > best) {
      best = score;
      storage.set("vel-tap-best", best);
    }
    activeIndex = -1;
    renderGrid();
    statusElement.textContent = message;
  }

  function start() {
    running = true;
    score = 0;
    timeLeft = 20;
    speed = 680;
    statusElement.textContent = "Sprint live. Hit the bright target before it jumps.";
    activateRandomCell();

    clearTimers();
    moveTimer = window.setInterval(() => {
      activateRandomCell();
    }, speed);

    clockTimer = window.setInterval(() => {
      timeLeft -= 1;
      timeElement.textContent = String(timeLeft);
      if (timeLeft <= 0) {
        stop(true, `Time. Final score ${score}. Press start to sprint again.`);
      }
    }, 1000);
  }

  gridElement.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;

    const index = Number(button.dataset.index);
    if (!running) return;

    if (index === activeIndex) {
      score += 1;
      if (score > best) {
        best = score;
        storage.set("vel-tap-best", best);
      }
      if (score % 5 === 0 && speed > 320) {
        speed -= 50;
        clearTimers();
        moveTimer = window.setInterval(activateRandomCell, speed);
        clockTimer = window.setInterval(() => {
          timeLeft -= 1;
          timeElement.textContent = String(timeLeft);
          if (timeLeft <= 0) {
            stop(true, `Time. Final score ${score}. Press start to sprint again.`);
          }
        }, 1000);
      }
      activateRandomCell();
      renderGrid();
      statusElement.textContent = "Clean hit. Keep the pace up.";
      return;
    }

    button.classList.add("is-miss");
    window.setTimeout(() => button.classList.remove("is-miss"), 180);
    statusElement.textContent = "Miss. Chase the bright cell.";
  });

  startButton.addEventListener("click", start);

  renderGrid();

  return { start, stop };
})();

const neonSlots = (() => {
  const reelElements = [
    document.getElementById("slotsReel0"),
    document.getElementById("slotsReel1"),
    document.getElementById("slotsReel2")
  ];
  const spinButton = document.getElementById("slotsSpin");
  const resetButton = document.getElementById("slotsReset");
  const scoreElement = document.getElementById("slotsScore");
  const bestElement = document.getElementById("slotsBest");
  const streakElement = document.getElementById("slotsStreak");
  const statusElement = document.getElementById("slotsStatus");

  const symbols = ["7", "BAR", "STAR", "ORB", "DICE", "CROWN"];
  let score = 0;
  let best = storage.get("vel-slots-best", 0);
  let streak = 0;
  let spinning = false;
  let spinTimers = [];

  function randomSymbol() {
    return symbols[Math.floor(Math.random() * symbols.length)];
  }

  function setReel(index, symbol) {
    const reel = reelElements[index];
    if (!reel) return;
    reel.innerHTML = `<span class="slot-symbol">${escapeHtml(symbol)}</span>`;
  }

  function render() {
    scoreElement.textContent = String(score);
    bestElement.textContent = String(best);
    streakElement.textContent = String(streak);
    spinButton.disabled = spinning;
  }

  function clearSpinTimers() {
    spinTimers.forEach((timer) => window.clearInterval(timer));
    spinTimers = [];
  }

  function evaluate(results) {
    const counts = results.reduce((map, symbol) => {
      map[symbol] = (map[symbol] || 0) + 1;
      return map;
    }, {});
    const values = Object.values(counts).sort((a, b) => b - a);

    let win = 0;
    if (values[0] === 3) {
      win = results[0] === "7" ? 120 : 60;
      streak += 1;
      statusElement.textContent = `${results.join(" / ")} landed clean. Triple hit for ${win} points.`;
    } else if (values[0] === 2) {
      win = 20;
      streak += 1;
      statusElement.textContent = `${results.join(" / ")} landed a pair. Smooth pickup for ${win} points.`;
    } else {
      streak = 0;
      statusElement.textContent = `${results.join(" / ")} missed. Spin again and build the streak back up.`;
    }

    score += win;
    if (win > best) {
      best = win;
      storage.set("vel-slots-best", best);
    }
    render();
  }

  function spin() {
    if (spinning) return;
    spinning = true;
    render();
    statusElement.textContent = "Reels live. Let the machine settle.";

    const results = reelElements.map(() => randomSymbol());
    clearSpinTimers();

    reelElements.forEach((reel, index) => {
      reel.classList.add("is-spinning");
      const timer = window.setInterval(() => {
        setReel(index, randomSymbol());
      }, 90 + index * 12);
      spinTimers.push(timer);

      window.setTimeout(() => {
        window.clearInterval(timer);
        reel.classList.remove("is-spinning");
        setReel(index, results[index]);

        if (index === reelElements.length - 1) {
          spinning = false;
          spinTimers = [];
          evaluate(results);
        }
      }, 860 + index * 320);
    });
  }

  function reset() {
    clearSpinTimers();
    spinning = false;
    score = 0;
    streak = 0;
    reelElements.forEach((_, index) => setReel(index, "7"));
    statusElement.textContent = "Machine reset. Spin for a fresh run.";
    render();
  }

  function render() {
    scoreElement.textContent = casinoWallet.format(score);
    bestElement.textContent = casinoWallet.format(best);
    streakElement.textContent = String(streak);
    spinButton.disabled = spinning || !casinoWallet.canCover("slots");
  }

  function evaluate(results, stake) {
    const counts = results.reduce((map, symbol) => {
      map[symbol] = (map[symbol] || 0) + 1;
      return map;
    }, {});
    const values = Object.values(counts).sort((a, b) => b - a);

    let payout = 0;
    if (values[0] === 3) {
      payout = results[0] === "7" ? stake * 8 : stake * 4;
      streak += 1;
      statusElement.textContent = `${results.join(" / ")} lined up clean. Triple hit paid ${casinoWallet.format(payout)}.`;
    } else if (values[0] === 2) {
      payout = stake * 2;
      streak += 1;
      statusElement.textContent = `${results.join(" / ")} landed a pair. Smooth return for ${casinoWallet.format(payout)}.`;
    } else {
      streak = 0;
      statusElement.textContent = `${results.join(" / ")} missed. You dropped ${casinoWallet.format(stake)} on that spin.`;
    }

    if (payout > 0) {
      casinoWallet.add(payout);
    }

    const net = payout - stake;
    score += net;
    if (net > best) {
      best = net;
      storage.set("vel-slots-best", best);
    }
    render();
  }

  function spin() {
    if (spinning) return;
    const stake = casinoWallet.charge("slots");
    if (!stake) {
      statusElement.textContent = "Not enough chips for that slots bet. Hit refill or drop the wager.";
      render();
      return;
    }
    spinning = true;
    render();
    statusElement.textContent = `Reels live on ${casinoWallet.format(stake)}. Let the machine settle.`;

    const results = reelElements.map(() => randomSymbol());
    clearSpinTimers();

    reelElements.forEach((reel, index) => {
      reel.classList.add("is-spinning");
      const timer = window.setInterval(() => {
        setReel(index, randomSymbol());
      }, 90 + index * 12);
      spinTimers.push(timer);

      window.setTimeout(() => {
        window.clearInterval(timer);
        reel.classList.remove("is-spinning");
        setReel(index, results[index]);

        if (index === reelElements.length - 1) {
          spinning = false;
          spinTimers = [];
          evaluate(results, stake);
        }
      }, 860 + index * 320);
    });
  }

  function reset() {
    clearSpinTimers();
    spinning = false;
    score = 0;
    streak = 0;
    reelElements.forEach((_, index) => setReel(index, "7"));
    statusElement.textContent = "Machine reset. Spin for a fresh run.";
    render();
  }

  spinButton.addEventListener("click", spin);
  resetButton.addEventListener("click", reset);
  document.addEventListener("casino-wallet-change", render);
  reset();

  return {
    reset,
    stop() {
      clearSpinTimers();
      spinning = false;
      reelElements.forEach((reel) => reel?.classList.remove("is-spinning"));
      render();
    }
  };
})();

const blackjackLite = (() => {
  const dealerHandElement = document.getElementById("blackjackDealerHand");
  const playerHandElement = document.getElementById("blackjackPlayerHand");
  const dealerTotalElement = document.getElementById("blackjackDealerTotal");
  const playerTotalElement = document.getElementById("blackjackPlayerTotal");
  const winsElement = document.getElementById("blackjackWins");
  const lossesElement = document.getElementById("blackjackLosses");
  const streakElement = document.getElementById("blackjackStreak");
  const statusElement = document.getElementById("blackjackStatus");
  const dealButton = document.getElementById("blackjackDeal");
  const hitButton = document.getElementById("blackjackHit");
  const standButton = document.getElementById("blackjackStand");

  const suits = ["♠", "♥", "♣", "♦"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  let dealer = [];
  let player = [];
  let wins = storage.get("vel-blackjack-wins", 0);
  let losses = storage.get("vel-blackjack-losses", 0);
  let streak = storage.get("vel-blackjack-streak", 0);
  let inRound = false;
  let deck = [];
  let currentStake = 0;

  function drawCard(hidden = false) {
    return {
      rank: ranks[Math.floor(Math.random() * ranks.length)],
      suit: suits[Math.floor(Math.random() * suits.length)],
      hidden
    };
  }

  function cardValue(card) {
    if (card.rank === "A") return 11;
    if (["J", "Q", "K"].includes(card.rank)) return 10;
    return Number(card.rank);
  }

  function totalOf(hand, revealHidden = false) {
    const visible = hand.filter((card) => revealHidden || !card.hidden);
    let total = visible.reduce((sum, card) => sum + cardValue(card), 0);
    let aces = visible.filter((card) => card.rank === "A").length;
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  function renderCard(card) {
    if (card.hidden) {
      return `
        <article class="playing-card is-hidden">
          <span>Dealer</span>
          <strong>?</strong>
          <span>Hidden</span>
        </article>
      `;
    }

    return `
      <article class="playing-card">
        <span>${escapeHtml(card.suit)}</span>
        <strong>${escapeHtml(card.rank)}</strong>
        <span>${escapeHtml(card.suit)}</span>
      </article>
    `;
  }

  function render() {
    dealerHandElement.innerHTML = dealer.map(renderCard).join("");
    playerHandElement.innerHTML = player.map(renderCard).join("");
    dealerTotalElement.textContent = String(totalOf(dealer, false));
    playerTotalElement.textContent = String(totalOf(player, true));
    winsElement.textContent = String(wins);
    lossesElement.textContent = String(losses);
    streakElement.textContent = String(streak);
    hitButton.disabled = !inRound;
    standButton.disabled = !inRound;
  }

  function settleRound(message, playerWon) {
    inRound = false;
    dealer.forEach((card) => {
      card.hidden = false;
    });

    if (playerWon === true) {
      wins += 1;
      streak += 1;
      storage.set("vel-blackjack-wins", wins);
      storage.set("vel-blackjack-streak", streak);
    } else if (playerWon === false) {
      losses += 1;
      streak = 0;
      storage.set("vel-blackjack-losses", losses);
      storage.set("vel-blackjack-streak", streak);
    }

    statusElement.textContent = message;
    render();
  }

  function deal() {
    dealer = [drawCard(true), drawCard(false)];
    player = [drawCard(false), drawCard(false)];
    inRound = true;
    statusElement.textContent = "Fresh hand dealt. Hit or stand.";
    render();

    const playerTotal = totalOf(player, true);
    if (playerTotal === 21) {
      dealer[0].hidden = false;
      settleRound("Blackjack. Clean opening win.", true);
    }
  }

  function hit() {
    if (!inRound) return;
    player.push(drawCard(false));
    render();

    const playerTotal = totalOf(player, true);
    if (playerTotal > 21) {
      settleRound(`Bust at ${playerTotal}. Dealer takes the round.`, false);
    }
  }

  function stand() {
    if (!inRound) return;
    dealer.forEach((card) => {
      card.hidden = false;
    });

    while (totalOf(dealer, true) < 17) {
      dealer.push(drawCard(false));
    }

    const dealerTotal = totalOf(dealer, true);
    const playerTotal = totalOf(player, true);

    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      settleRound(`You win ${playerTotal} to ${dealerTotal}.`, true);
      return;
    }

    if (dealerTotal === playerTotal) {
      settleRound(`Push at ${playerTotal}. No loss, no streak change.`, null);
      return;
    }

    settleRound(`Dealer wins ${dealerTotal} to ${playerTotal}.`, false);
  }

  function drawCard(hidden = false) {
    if (!deck.length) {
      deck = createStandardDeck();
    }
    const card = deck.pop();
    return { ...card, hidden };
  }

  function render() {
    dealerHandElement.innerHTML = dealer.map((card) => renderStandardCard(card)).join("");
    playerHandElement.innerHTML = player.map((card) => renderStandardCard(card)).join("");
    dealerTotalElement.textContent = String(totalOf(dealer, false));
    playerTotalElement.textContent = String(totalOf(player, true));
    winsElement.textContent = String(wins);
    lossesElement.textContent = String(losses);
    streakElement.textContent = String(streak);
    dealButton.disabled = inRound || !casinoWallet.canCover("blackjack");
    hitButton.disabled = !inRound;
    standButton.disabled = !inRound;
  }

  function settleRound(message, outcome = "loss", payout = 0) {
    inRound = false;
    dealer.forEach((card) => {
      card.hidden = false;
    });

    if (outcome === "win") {
      wins += 1;
      streak += 1;
      storage.set("vel-blackjack-wins", wins);
      storage.set("vel-blackjack-streak", streak);
      if (payout > 0) {
        casinoWallet.add(payout);
      }
    } else if (outcome === "loss") {
      losses += 1;
      streak = 0;
      storage.set("vel-blackjack-losses", losses);
      storage.set("vel-blackjack-streak", streak);
    } else if (outcome === "push") {
      casinoWallet.add(currentStake);
    }

    currentStake = 0;
    statusElement.textContent = message;
    render();
  }

  function deal() {
    if (inRound) return;
    const stake = casinoWallet.charge("blackjack");
    if (!stake) {
      statusElement.textContent = "Not enough chips for that blackjack hand. Refill or lower the bet.";
      render();
      return;
    }
    currentStake = stake;
    deck = createStandardDeck();
    dealer = [drawCard(true), drawCard(false)];
    player = [drawCard(false), drawCard(false)];
    inRound = true;
    statusElement.textContent = `Fresh hand dealt for ${casinoWallet.format(stake)}. Hit or stand.`;
    render();

    const playerTotal = totalOf(player, true);
    if (playerTotal === 21) {
      const dealerTotal = totalOf(dealer, true);
      if (dealerTotal === 21) {
        settleRound("Both opened on 21. Push and your chips come back.", "push");
      } else {
        settleRound(
          `Blackjack. Clean opening win paid ${casinoWallet.format(Math.round(stake * 2.5))}.`,
          "win",
          Math.round(stake * 2.5)
        );
      }
    }
  }

  function hit() {
    if (!inRound) return;
    player.push(drawCard(false));
    render();

    const playerTotal = totalOf(player, true);
    if (playerTotal > 21) {
      settleRound(`Bust at ${playerTotal}. Dealer takes the ${casinoWallet.format(currentStake)} hand.`, "loss");
    }
  }

  function stand() {
    if (!inRound) return;
    dealer.forEach((card) => {
      card.hidden = false;
    });

    while (totalOf(dealer, true) < 17) {
      dealer.push(drawCard(false));
    }

    const dealerTotal = totalOf(dealer, true);
    const playerTotal = totalOf(player, true);

    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      settleRound(
        `You win ${playerTotal} to ${dealerTotal}. Payout ${casinoWallet.format(currentStake * 2)}.`,
        "win",
        currentStake * 2
      );
      return;
    }

    if (dealerTotal === playerTotal) {
      settleRound(`Push at ${playerTotal}. Your ${casinoWallet.format(currentStake)} comes right back.`, "push");
      return;
    }

    settleRound(`Dealer wins ${dealerTotal} to ${playerTotal}.`, "loss");
  }

  dealButton.addEventListener("click", deal);
  hitButton.addEventListener("click", hit);
  standButton.addEventListener("click", stand);
  document.addEventListener("casino-wallet-change", render);
  render();
  statusElement.textContent = "Deal a hand and try to beat the dealer without going over 21.";

  return { deal };
})();

const rouletteRush = (() => {
  const wheelElement = document.getElementById("rouletteWheel");
  const picksElement = document.getElementById("roulettePicks");
  const resultElement = document.getElementById("rouletteResult");
  const scoreElement = document.getElementById("rouletteScore");
  const bestElement = document.getElementById("rouletteBest");
  const streakElement = document.getElementById("rouletteStreak");
  const statusElement = document.getElementById("rouletteStatus");
  const spinButton = document.getElementById("rouletteSpin");
  const resetButton = document.getElementById("rouletteReset");

  const segments = [
    { number: 0, color: "green" },
    { number: 1, color: "red" },
    { number: 2, color: "black" },
    { number: 3, color: "red" },
    { number: 4, color: "black" },
    { number: 5, color: "red" },
    { number: 6, color: "black" },
    { number: 7, color: "red" },
    { number: 8, color: "black" },
    { number: 9, color: "red" },
    { number: 10, color: "black" },
    { number: 11, color: "red" }
  ];

  let selected = "red";
  let score = 0;
  let streak = 0;
  let best = storage.get("vel-roulette-best", 0);
  let spinCount = 0;
  let spinning = false;
  let settleTimer = null;
  let currentStake = 0;

  function render() {
    scoreElement.textContent = String(score);
    streakElement.textContent = String(streak);
    bestElement.textContent = String(best);
    spinButton.disabled = spinning;
    picksElement.querySelectorAll("[data-roulette-pick]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.roulettePick === selected);
    });
  }

  function settle(segment) {
    spinning = false;
    const won = segment.color === selected;
    if (won) {
      const reward = selected === "green" ? 35 : 10;
      score += reward;
      streak += 1;
      if (streak > best) {
        best = streak;
        storage.set("vel-roulette-best", best);
      }
      statusElement.textContent = `${segment.color.toUpperCase()} ${segment.number} hit. +${reward} points.`;
    } else {
      streak = 0;
      statusElement.textContent = `${segment.color.toUpperCase()} ${segment.number} hit. Streak reset.`;
    }

    resultElement.textContent = `Last spin: ${segment.color.toUpperCase()} ${segment.number}`;
    render();
  }

  function spin() {
    if (spinning) return;
    spinning = true;
    render();

    const segmentIndex = Math.floor(Math.random() * segments.length);
    const segmentSize = 360 / segments.length;
    const centerAngle = segmentIndex * segmentSize + segmentSize / 2;
    spinCount += 1;
    const rotation = spinCount * 1440 - centerAngle;
    wheelElement.style.transform = `rotate(${rotation}deg)`;
    statusElement.textContent = `Wheel spinning on ${selected.toUpperCase()}.`;

    if (settleTimer) window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      settle(segments[segmentIndex]);
    }, 3220);
  }

  function reset() {
    if (settleTimer) {
      window.clearTimeout(settleTimer);
      settleTimer = null;
    }
    spinning = false;
    score = 0;
    streak = 0;
    selected = "red";
    spinCount = 0;
    wheelElement.style.transform = "rotate(0deg)";
    resultElement.textContent = "Last spin: none";
    statusElement.textContent = "Pick a color, spin the wheel, and keep the streak alive.";
    render();
  }

  function render() {
    scoreElement.textContent = casinoWallet.format(score);
    streakElement.textContent = String(streak);
    bestElement.textContent = String(best);
    spinButton.disabled = spinning || !casinoWallet.canCover("roulette");
    picksElement.querySelectorAll("[data-roulette-pick]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.roulettePick === selected);
    });
  }

  function settle(segment) {
    spinning = false;
    const won = segment.color === selected;
    if (won) {
      const payout = selected === "green" ? currentStake * 12 : currentStake * 2;
      const net = payout - currentStake;
      casinoWallet.add(payout);
      score += net;
      streak += 1;
      if (streak > best) {
        best = streak;
        storage.set("vel-roulette-best", best);
      }
      statusElement.textContent = `${segment.color.toUpperCase()} ${segment.number} hit. Paid ${casinoWallet.format(payout)}.`;
    } else {
      score -= currentStake;
      streak = 0;
      statusElement.textContent = `${segment.color.toUpperCase()} ${segment.number} hit. You dropped ${casinoWallet.format(currentStake)}.`;
    }

    resultElement.textContent = `Last spin: ${segment.color.toUpperCase()} ${segment.number}`;
    currentStake = 0;
    render();
  }

  function spin() {
    if (spinning) return;
    const stake = casinoWallet.charge("roulette");
    if (!stake) {
      statusElement.textContent = "Not enough chips for that roulette spin. Refill or cut the bet.";
      render();
      return;
    }
    currentStake = stake;
    spinning = true;
    render();

    const segmentIndex = Math.floor(Math.random() * segments.length);
    const segmentSize = 360 / segments.length;
    const centerAngle = segmentIndex * segmentSize + segmentSize / 2;
    spinCount += 1;
    const rotation = spinCount * 1440 - centerAngle;
    wheelElement.style.transform = `rotate(${rotation}deg)`;
    statusElement.textContent = `Wheel spinning on ${selected.toUpperCase()} for ${casinoWallet.format(stake)}.`;

    if (settleTimer) window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      settle(segments[segmentIndex]);
    }, 3220);
  }

  function reset() {
    if (settleTimer) {
      window.clearTimeout(settleTimer);
      settleTimer = null;
    }
    spinning = false;
    score = 0;
    streak = 0;
    currentStake = 0;
    selected = "red";
    spinCount = 0;
    wheelElement.style.transform = "rotate(0deg)";
    resultElement.textContent = "Last spin: none";
    statusElement.textContent = "Pick a color, spin the wheel, and keep the streak alive.";
    render();
  }

  picksElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-roulette-pick]");
    if (!button || spinning) return;
    selected = button.dataset.roulettePick;
    render();
  });

  spinButton.addEventListener("click", spin);
  resetButton.addEventListener("click", reset);
  document.addEventListener("casino-wallet-change", render);
  reset();

  return {
    reset,
    stop() {
      if (settleTimer) {
        window.clearTimeout(settleTimer);
        settleTimer = null;
      }
      spinning = false;
      render();
    }
  };
})();

const videoPoker = (() => {
  const handElement = document.getElementById("pokerHand");
  const winsElement = document.getElementById("pokerWins");
  const bestElement = document.getElementById("pokerBest");
  const profitElement = document.getElementById("pokerProfit");
  const statusElement = document.getElementById("pokerStatus");
  const dealButton = document.getElementById("pokerDeal");
  const drawButton = document.getElementById("pokerDraw");
  const resetButton = document.getElementById("pokerReset");

  let deck = [];
  let hand = [];
  let held = new Set();
  let drawPhase = false;
  let wins = storage.get("vel-poker-wins", 0);
  let bestLabel = storage.get("vel-poker-best", "None");
  let bestRank = storage.get("vel-poker-best-rank", 0);
  let profit = 0;
  let currentStake = 0;

  function rankValue(rank) {
    const map = {
      A: 14,
      K: 13,
      Q: 12,
      J: 11
    };
    return map[rank] || Number(rank);
  }

  function isStraight(values) {
    const sorted = [...new Set(values)].sort((a, b) => a - b);
    if (sorted.length !== 5) return false;
    const wheel = [2, 3, 4, 5, 14];
    if (sorted.every((value, index) => value === wheel[index])) {
      return true;
    }
    return sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
  }

  function evaluateHand(cards) {
    const values = cards.map((card) => rankValue(card.rank));
    const counts = Object.values(
      cards.reduce((map, card) => {
        map[card.rank] = (map[card.rank] || 0) + 1;
        return map;
      }, {})
    ).sort((a, b) => b - a);
    const flush = cards.every((card) => card.suitKey === cards[0].suitKey);
    const straight = isStraight(values);
    const sorted = [...values].sort((a, b) => a - b);
    const royal = straight && flush && [10, 11, 12, 13, 14].every((value, index) => value === sorted[index]);

    if (royal) return { label: "Royal Flush", rank: 9, payout: 50 };
    if (straight && flush) return { label: "Straight Flush", rank: 8, payout: 20 };
    if (counts[0] === 4) return { label: "Four of a Kind", rank: 7, payout: 12 };
    if (counts[0] === 3 && counts[1] === 2) return { label: "Full House", rank: 6, payout: 9 };
    if (flush) return { label: "Flush", rank: 5, payout: 7 };
    if (straight) return { label: "Straight", rank: 4, payout: 5 };
    if (counts[0] === 3) return { label: "Three of a Kind", rank: 3, payout: 4 };
    if (counts[0] === 2 && counts[1] === 2) return { label: "Two Pair", rank: 2, payout: 3 };
    if (counts[0] === 2) return { label: "Pair", rank: 1, payout: 2 };
    return { label: "No Win", rank: 0, payout: 0 };
  }

  function render() {
    winsElement.textContent = String(wins);
    bestElement.textContent = bestLabel;
    profitElement.textContent = casinoWallet.format(profit);
    dealButton.disabled = drawPhase || !casinoWallet.canCover("poker");
    drawButton.disabled = !drawPhase;

    handElement.innerHTML = hand.length
      ? hand
          .map((card, index) => {
            const isHeld = held.has(index);
            return `
              <div data-poker-card="${index}">
                ${renderStandardCard(card, { clickable: drawPhase, held: isHeld })}
                <span class="poker-hold-label${isHeld ? " is-held" : ""}">${isHeld ? "Held" : "Tap to hold"}</span>
              </div>
            `;
          })
          .join("")
      : '<p class="empty-note">Deal a hand to start the table.</p>';
  }

  function finishRound() {
    const result = evaluateHand(hand);
    const payout = Math.round(currentStake * result.payout);
    const net = payout - currentStake;

    if (payout > 0) {
      casinoWallet.add(payout);
      wins += 1;
      storage.set("vel-poker-wins", wins);
      if (result.rank > bestRank) {
        bestRank = result.rank;
        bestLabel = result.label;
        storage.set("vel-poker-best", bestLabel);
        storage.set("vel-poker-best-rank", bestRank);
      }
      statusElement.textContent = `${result.label} paid ${casinoWallet.format(payout)}.`;
    } else {
      statusElement.textContent = `No win this hand. You burned ${casinoWallet.format(currentStake)}.`;
    }

    profit += net;
    currentStake = 0;
    drawPhase = false;
    held.clear();
    render();
  }

  function deal() {
    if (drawPhase) return;
    const stake = casinoWallet.charge("poker");
    if (!stake) {
      statusElement.textContent = "Not enough chips to deal poker right now. Refill or lower the bet.";
      render();
      return;
    }

    currentStake = stake;
    deck = createStandardDeck();
    hand = Array.from({ length: 5 }, () => deck.pop());
    held.clear();
    drawPhase = true;
    statusElement.textContent = `Hand dealt for ${casinoWallet.format(stake)}. Hold what you want, then draw.`;
    render();
  }

  function draw() {
    if (!drawPhase) return;
    hand = hand.map((card, index) => (held.has(index) ? card : deck.pop()));
    finishRound();
  }

  function toggleHold(index) {
    if (!drawPhase || !hand[index]) return;
    if (held.has(index)) {
      held.delete(index);
    } else {
      held.add(index);
    }
    render();
  }

  function reset() {
    hand = [];
    held.clear();
    drawPhase = false;
    currentStake = 0;
    profit = 0;
    wins = 0;
    bestLabel = "None";
    bestRank = 0;
    statusElement.textContent = "Deal five cards, tap cards to hold them, then draw once.";
    render();
  }

  handElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-poker-card]");
    if (!button) return;
    toggleHold(Number(button.dataset.pokerCard));
  });

  handElement.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const button = event.target.closest("[data-poker-card]");
    if (!button) return;
    event.preventDefault();
    toggleHold(Number(button.dataset.pokerCard));
  });

  dealButton.addEventListener("click", deal);
  drawButton.addEventListener("click", draw);
  resetButton.addEventListener("click", reset);
  document.addEventListener("casino-wallet-change", render);
  reset();

  return { reset };
})();

const diceDuel = (() => {
  const faceElements = [
    document.getElementById("diceFace0"),
    document.getElementById("diceFace1")
  ];
  const picksElement = document.getElementById("dicePicks");
  const winsElement = document.getElementById("diceWins");
  const streakElement = document.getElementById("diceStreak");
  const profitElement = document.getElementById("diceProfit");
  const resultElement = document.getElementById("diceResult");
  const statusElement = document.getElementById("diceStatus");
  const rollButton = document.getElementById("diceRoll");
  const resetButton = document.getElementById("diceReset");

  let selected = "low";
  let wins = 0;
  let streak = 0;
  let profit = 0;
  let rolling = false;
  let settleTimer = null;
  let rollTimers = [];
  let currentStake = 0;

  function setFace(index, value) {
    const face = faceElements[index];
    if (!face) return;
    face.textContent = String(value);
    face.dataset.value = String(value);
  }

  function clearTimers() {
    rollTimers.forEach((timer) => window.clearInterval(timer));
    rollTimers = [];
    if (settleTimer) {
      window.clearTimeout(settleTimer);
      settleTimer = null;
    }
  }

  function render() {
    winsElement.textContent = String(wins);
    streakElement.textContent = String(streak);
    profitElement.textContent = casinoWallet.format(profit);
    rollButton.disabled = rolling || !casinoWallet.canCover("dice");
    picksElement.querySelectorAll("[data-dice-pick]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.dicePick === selected);
    });
  }

  function settle(values) {
    clearTimers();
    rolling = false;
    values.forEach((value, index) => setFace(index, value));
    const total = values[0] + values[1];
    const outcome = total === 7 ? "seven" : total >= 8 ? "high" : "low";
    const payout = outcome === selected ? (outcome === "seven" ? currentStake * 5 : currentStake * 2) : 0;
    const net = payout - currentStake;

    if (payout > 0) {
      casinoWallet.add(payout);
      wins += 1;
      streak += 1;
      statusElement.textContent = `${outcome.toUpperCase()} hit on ${total}. Paid ${casinoWallet.format(payout)}.`;
    } else {
      streak = 0;
      statusElement.textContent = `${outcome.toUpperCase()} hit on ${total}. You lost ${casinoWallet.format(currentStake)}.`;
    }

    profit += net;
    resultElement.textContent = `Last roll: ${values[0]} + ${values[1]} = ${total}`;
    currentStake = 0;
    render();
  }

  function roll() {
    if (rolling) return;
    const stake = casinoWallet.charge("dice");
    if (!stake) {
      statusElement.textContent = "Not enough chips for that dice bet. Refill or cut the stake.";
      render();
      return;
    }
    currentStake = stake;
    rolling = true;
    render();
    statusElement.textContent = `Dice rolling on ${casinoWallet.format(stake)}.`;

    clearTimers();
    faceElements.forEach((_, index) => {
      const timer = window.setInterval(() => {
        setFace(index, 1 + Math.floor(Math.random() * 6));
      }, 90 + index * 18);
      rollTimers.push(timer);
    });

    const finalValues = [
      1 + Math.floor(Math.random() * 6),
      1 + Math.floor(Math.random() * 6)
    ];
    settleTimer = window.setTimeout(() => {
      settle(finalValues);
    }, 1320);
  }

  function reset() {
    clearTimers();
    selected = "low";
    wins = 0;
    streak = 0;
    profit = 0;
    rolling = false;
    currentStake = 0;
    setFace(0, 1);
    setFace(1, 1);
    resultElement.textContent = "Last roll: none";
    statusElement.textContent = "Pick low, high, or lucky seven and roll the dice.";
    render();
  }

  picksElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dice-pick]");
    if (!button || rolling) return;
    selected = button.dataset.dicePick;
    render();
  });

  rollButton.addEventListener("click", roll);
  resetButton.addEventListener("click", reset);
  document.addEventListener("casino-wallet-change", render);
  reset();

  return {
    reset,
    stop() {
      clearTimers();
      rolling = false;
      render();
    }
  };
})();

memory.reset();
merge.reset();
snake.reset();
wordWarp.pickNewWord();
tapRush.stop(false, "Press start, then tap the bright cell before it jumps away.");
neonSlots.reset();
rouletteRush.reset();
videoPoker.reset();
diceDuel.reset();
casinoWallet.render();
renderPlaylist();
loadTrack(0, false);
if (currentThemePackKey === "custom" || currentWallpaperKey === "custom") {
  applyCustomWallpaper() || applyWallpaper("vel");
} else {
  applyWallpaper(currentWallpaperKey);
  applyThemePack(currentThemePackKey, false);
}
applyFont(currentFontKey);
applyDensity(currentDensityKey);
applyZoom(currentZoomKey);
applyTaskbarPosition(currentTaskbarPosition);
applyHomeClockPosition();
initHomeClockDrag();
if (velofySpotifySearch) {
  velofySpotifySearch.value = velofySpotifySearchQuery;
}
renderLauncherCatalog();
renderDesktopShortcuts();
renderRecentApps();
renderAiMessages();
initVelChat();
updateYouTubeGlobalImportUi();
renderLobbyState();
clearLobbyCanvas();
renderSoundboard();
initDraggableDrawers();
initScrollAssist();
initDraggableLyricsWidget();
setActiveLocalGame(activeLocalGame);
if (mediaSearchInput) {
  mediaSearchInput.value = mediaState.query;
}
renderMediaHub();
if (velHubSearchInput) {
  velHubSearchInput.value = velHubState.query;
}
setVelHubCinema(velHubState.cinema);
renderVelHubModernPicks();
renderVelHub();
renderVelofySpotifyResults();
showBootScreen();
updateClock();
renderNetworkState();
updateNowPlayingUi();
renderLyricsWidget();
syncTaskbarState();
window.setInterval(updateClock, 1000);
checkDevAccess({ silent: true });
reportDevPresence();
devPresenceTimer = window.setInterval(reportDevPresence, DEV_PRESENCE_POLL_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    sendDevPresenceLeave();
    return;
  }
  checkDevAccess({ silent: true, once: true });
  reportDevPresence();
});

window.addEventListener("pagehide", () => {
  sendDevPresenceLeave();
  stopScreenShare({ silent: true });
});

window.addEventListener("beforeunload", () => {
  sendDevPresenceLeave();
});
