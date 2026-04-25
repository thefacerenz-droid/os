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

  shorts: {
    title: "Shorts Feed",
    tag: "Short Video",
    description: "A TikTok-style vertical feed powered by embeddable YouTube Shorts.",
    url: "about:blank",
    mode: "mediaProvider",
    provider: "shorts",
    embedBlocked: false,
    note: "This opens the vel.os Shorts feed because YouTube videos support official iframe embeds."
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

["youtube", "spotify", "shorts", "tiktok", "tubi", "pluto"].forEach((id) => {
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
  youtube: {
    title: "YouTube",
    label: "YouTube",
    badgeText: "YT",
    action: "panel",
    panel: "youtube"
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
  media: document.getElementById("mediaDrawer"),
  youtube: document.getElementById("youtubeDrawer"),
  web: document.getElementById("webDrawer"),
  music: document.getElementById("musicDrawer"),
  game: document.getElementById("gameDrawer"),
  network: document.getElementById("networkDrawer"),
  settings: document.getElementById("settingsDrawer")
};

const clockDay = document.getElementById("clockDay");
const clockTime = document.getElementById("clockTime");
const clockDate = document.getElementById("clockDate");
const bootScreen = document.getElementById("bootScreen");
const launcherGameSearch = document.getElementById("launcherGameSearch");
const launcherOfflineToggle = document.getElementById("launcherOfflineToggle");
const gameSourceTabs = document.getElementById("gameSourceTabs");
const gameSourceButtons = [...document.querySelectorAll("[data-game-source]")];
const launcherGameGrid = document.getElementById("launcherGameGrid");
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
const youtubeDrawer = document.getElementById("youtubeDrawer");
const youtubePanel = youtubeDrawer?.querySelector(".youtube-panel");
const youtubeAddressForm = document.getElementById("youtubeAddressForm");
const youtubeAddressInput = document.getElementById("youtubeAddressInput");
const youtubeSearchForm = document.getElementById("youtubeSearchForm");
const youtubeSearchInput = document.getElementById("youtubeSearchInput");
const youtubeResultsGrid = document.getElementById("youtubeResultsGrid");
const youtubeResultsTitle = document.getElementById("youtubeResultsTitle");
const youtubeStatus = document.getElementById("youtubeStatus");
const youtubeLoadMore = document.getElementById("youtubeLoadMore");
const youtubeClearHistoryButton = document.getElementById("youtubeClearHistoryButton");
const youtubeFrameWrap = document.getElementById("youtubeFrameWrap");
const youtubePlayerChannel = document.getElementById("youtubePlayerChannel");
const youtubePlayerTitle = document.getElementById("youtubePlayerTitle");
const youtubePlayerDescription = document.getElementById("youtubePlayerDescription");
const youtubeOpenTabButton = document.getElementById("youtubeOpenTabButton");
const youtubeFullscreenButton = document.getElementById("youtubeFullscreenButton");
const youtubeToggleResultsButton = document.getElementById("youtubeToggleResultsButton");
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
const velofyPlaylist = document.getElementById("velofyPlaylist");
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
const resetWindowsButton = document.querySelector("[data-reset-windows]");
const desktopNetworkStatus = document.getElementById("desktopNetworkStatus");
const networkVpnButton = document.getElementById("networkVpnButton");
const proxyNoteInput = document.getElementById("proxyNoteInput");
const proxyNoteSave = document.getElementById("proxyNoteSave");
const proxyNoteReadout = document.getElementById("proxyNoteReadout");

let activeLocalGame = "snake";
let activeWeb = "rocketgoal";
let activePanel = "";
let currentTrackIndex = 0;
let currentWallpaperKey = storage.get("vel-wallpaper", "vel");
let currentFontKey = storage.get("vel-font", "system");
let currentDensityKey = storage.get("vel-density", "roomy");
let currentZoomKey = storage.get("vel-zoom", "normal");
let currentWebUrl = "https://rocketgoal.io/";
let currentWebMirrorIndex = 0;
let feedVideoObserver = null;
let youtubePlayer = null;
let youtubeApiReadyPromise = null;
let youtubeAppPlayerHintTimer = null;
let mediaSearchDebounceTimer = null;
let launcherGameQuery = "";
let launcherOfflineOnly = storage.get("vel-launcher-offline-only", isLikelyIpad() ? "1" : "0") === "1";
let launcherGameSource = storage.get("vel-launcher-game-source", "all");
if (!gameSourceLabels[launcherGameSource]) {
  launcherGameSource = "all";
}
let networkNote = storage.get("vel-network-note", "");
const YOUTUBE_HISTORY_KEY = "vel-youtube-watch-history";
const YOUTUBE_HISTORY_LIMIT = 80;
const YOUTUBE_HOME_TOPIC_LIMIT = 3;
const YOUTUBE_GENERIC_QUERIES = new Set([
  "popular videos today",
  "music videos",
  "gaming videos",
  "trending music",
  "sports highlights",
  "learning videos",
  "news today"
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
  embedHost: storage.get("vel-youtube-embed-host", "privacy")
};
let youtubeWatchHistory = readStoredJson(YOUTUBE_HISTORY_KEY, []);
youtubeWatchHistory = Array.isArray(youtubeWatchHistory)
  ? youtubeWatchHistory.filter((item) => item?.id).slice(0, YOUTUBE_HISTORY_LIMIT)
  : [];
let velofySearchQuery = "";
let velofySpotifySearchQuery = storage.get("velofy-spotify-query", "Ken Carson");
let velofySpotifySearchResults = [];
let velofySpotifyLoading = false;
let velofySpotifyError = "";
let savedSpotifyTracks = readStoredJson("velofy-spotify-tracks", []);
let currentVelofyMode = "local";
let currentSpotifyTrackId = "";
let currentSpotifyTrack = null;
let recentApps = readStoredJson("vel-recent-apps", []);
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

function recordRecentApp(entry) {
  recentApps = [
    entry,
    ...recentApps.filter((item) => !(item.type === entry.type && item.id === entry.id))
  ].slice(0, 7);
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

  if (activePanel === "youtube") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="youtube"]')?.classList.add("is-active");
  }

  if (activePanel === "settings") {
    recentAppsTray?.querySelector('[data-recent-type="panel"][data-recent-id="settings"]')?.classList.add("is-active");
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

function openPanel(name) {
  pauseAllFeedMedia();

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

  if (name === "youtube") {
    recordRecentApp({ type: "panel", id: "youtube" });
  }

  if (name === "settings") {
    recordRecentApp({ type: "panel", id: "settings" });
  }

  if (name === "network") {
    recordRecentApp({ type: "panel", id: "network" });
    renderNetworkState();
  }

  if (name === "game" && activeLocalGame === "snake") {
    window.requestAnimationFrame(() => {
      snake.refresh();
    });
  }
}

function closeAllPanels() {
  Object.keys(drawers).forEach((key) => setDrawerState(key, false));
  activePanel = "";
  pauseDynamicGames("");
  pauseAllFeedMedia();
  setYouTubeFullscreen(false);
  setYouTubeVideoFullscreen(false);
  youtubePlayer?.destroy?.();
  youtubePlayer = null;
  syncTaskbarState();
}

function closePanel(name) {
  setDrawerState(name, false);
  if (name === "game") {
    pauseDynamicGames("");
  }
  if (name === "media") {
    pauseAllFeedMedia();
    youtubePlayer?.destroy?.();
    youtubePlayer = null;
  }
  if (name === "youtube") {
    setYouTubeFullscreen(false);
    setYouTubeVideoFullscreen(false);
  }
  if (activePanel === name) {
    activePanel = "";
  }
  syncTaskbarState();
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
    rel: "0",
    modestbranding: "1",
    playsinline: "1"
  });
  if (location.origin && /^https?:/i.test(location.origin)) {
    params.set("origin", location.origin);
  }
  return `https://${getYouTubeEmbedHost()}/embed/${encodeURIComponent(videoId)}?${params}`;
}

function clearYouTubePlayerHintTimer() {
  if (!youtubeAppPlayerHintTimer) return;
  window.clearTimeout(youtubeAppPlayerHintTimer);
  youtubeAppPlayerHintTimer = null;
}

function showYouTubePlayerHint(delay = 3200) {
  clearYouTubePlayerHintTimer();
  youtubeAppPlayerHintTimer = window.setTimeout(() => {
    youtubeFrameWrap?.querySelector("[data-youtube-player-hint]")?.classList.add("is-visible");
  }, delay);
}

function toggleYouTubeEmbedHost() {
  youtubeAppState.embedHost = youtubeAppState.embedHost === "standard" ? "privacy" : "standard";
  storage.set("vel-youtube-embed-host", youtubeAppState.embedHost);
  renderYouTubePlayer();
}

function getYouTubeFetchError(error) {
  const message = error?.message || "";
  if (location.protocol === "file:") {
    return "YouTube search needs the vel.os server. Run npm start and open http://localhost:3000 instead of opening index.html directly.";
  }
  if (/failed to fetch|load failed|networkerror/i.test(message)) {
    return "YouTube search API did not respond. Make sure /api/youtube/search exists and YOUTUBE_API_KEY is set in your hosting environment.";
  }
  return message || "YouTube search could not load.";
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
}

function getYouTubeHomeTopics() {
  const counts = new Map();
  youtubeWatchHistory.forEach((item, index) => {
    const topic = normalizeYouTubeTopic(item.topic) || inferYouTubeTopic(item);
    if (!topic) return;
    const current = counts.get(topic) || { topic, count: 0, newest: 0 };
    current.count += 1;
    current.newest = Math.max(current.newest, item.watchedAt || Date.now() - index);
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

async function fetchYouTubeSearchItems(query, pageToken = "") {
  const params = new URLSearchParams({ q: query });
  if (pageToken) params.set("pageToken", pageToken);
  const response = await fetch(`/api/youtube/search?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "YouTube search failed.");
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    nextPageToken: data.nextPageToken || ""
  };
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

async function loadYouTubeHome() {
  youtubeAppState.mode = "home";
  youtubeAppState.currentVideo = null;
  youtubeAppState.error = "";
  youtubeAppState.nextPageToken = "";
  youtubeAppState.homeTopics = getYouTubeHomeTopics();
  if (youtubeWatchHistory.length && !youtubeAppState.homeTopics.length) {
    youtubeAppState.homeTopics = ["music"];
  }
  youtubeAppState.query = youtubeAppState.homeTopics.length
    ? youtubeAppState.homeTopics.map(titleCaseYouTubeTopic).join(" + ")
    : "For You";
  if (youtubeSearchInput) youtubeSearchInput.value = "";

  if (!youtubeWatchHistory.length) {
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
    youtubeAppState.results = merged;
    youtubeAppState.error = merged.length ? "" : "Your Home feed is ready, but YouTube did not return videos for this history yet.";
  } catch (error) {
    youtubeAppState.error = getYouTubeFetchError(error);
  } finally {
    youtubeAppState.loading = false;
    youtubeAppState.didInitialLoad = true;
    renderYouTubeResults();
  }
}

function clearYouTubeHistory() {
  youtubeWatchHistory = [];
  persistYouTubeHistory();
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
  const shouldHideResults = isWatching && youtubeAppState.resultsHidden;
  youtubeDrawer?.classList.toggle("is-youtube-results-hidden", shouldHideResults);
  if (youtubeToggleResultsButton) {
    youtubeToggleResultsButton.hidden = !isWatching;
    youtubeToggleResultsButton.textContent = shouldHideResults ? "Show List" : "Hide List";
    youtubeToggleResultsButton.setAttribute("aria-pressed", String(shouldHideResults));
  }
  if (youtubeStatus) {
    youtubeStatus.textContent = youtubeAppState.loading
      ? "Loading"
      : youtubeAppState.error
        ? "Error"
        : youtubeAppState.mode === "history"
          ? `${youtubeWatchHistory.length} watched`
          : youtubeAppState.mode === "home" && !youtubeWatchHistory.length
            ? "No history"
            : `${youtubeAppState.results.length || 0} videos`;
  }
  if (youtubeResultsTitle) {
    youtubeResultsTitle.textContent = youtubeAppState.mode === "home"
      ? "For You"
      : youtubeAppState.mode === "history"
        ? "History"
        : youtubeAppState.query || "YouTube";
  }
  if (youtubeClearHistoryButton) {
    youtubeClearHistoryButton.hidden = youtubeAppState.mode !== "history" || !youtubeWatchHistory.length;
  }
  if (youtubeLoadMore) {
    youtubeLoadMore.hidden = youtubeAppState.mode !== "search" || !youtubeAppState.nextPageToken || youtubeAppState.loading;
  }
  if (youtubeAddressInput) {
    youtubeAddressInput.value = getYouTubeWatchUrl();
  }
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
      <div>
        <strong>If this stays black</strong>
        <span>This network is probably blocking YouTube playback. vel.os is using the official ${escapeHtml(getYouTubeEmbedModeLabel())} YouTube player, not a bypass.</span>
      </div>
      <div class="youtube-player-hint-actions">
        <button type="button" data-youtube-retry-embed>Try ${escapeHtml(getNextYouTubeEmbedModeLabel())}</button>
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
  const displayResults = youtubeAppState.mode === "history"
    ? youtubeWatchHistory
    : youtubeAppState.results;

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

  youtubeResultsGrid.innerHTML = displayResults.map((video) => `
    <button class="youtube-video-card${youtubeAppState.currentVideo?.id === video.id ? " is-active" : ""}" type="button" data-youtube-app-video="${escapeHtml(video.id)}">
      ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" />` : '<div class="youtube-video-thumb"></div>'}
      <span>
        <strong>${escapeHtml(video.title)}</strong>
        <span>${escapeHtml(video.channel || "YouTube")}</span>
        <span>${escapeHtml(youtubeAppState.mode === "history" ? `Watched ${formatYouTubeDate(video.watchedAt)}` : formatYouTubeDate(video.publishedAt))}</span>
      </span>
    </button>
  `).join("");
  renderYouTubeStatus();
}

function selectYouTubeAppVideo(video) {
  if (!video) return;
  youtubeAppState.currentVideo = video;
  storage.set("vel-youtube-last-video", video.id);
  recordYouTubeWatch(video);
  renderYouTubePlayer();
  renderYouTubeResults();
}

async function searchYouTubeApp({ append = false } = {}) {
  const typedQuery = (youtubeSearchInput?.value || "").trim();
  const fallbackQuery = youtubeAppState.mode === "home" || youtubeAppState.mode === "history"
    ? "music videos"
    : youtubeAppState.query || "music videos";
  const query = typedQuery || fallbackQuery;
  youtubeAppState.mode = "search";
  youtubeAppState.query = query;
  youtubeAppState.homeTopics = [];
  storage.set("vel-youtube-query", query);
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
    youtubeAppState.error = getYouTubeFetchError(error);
  } finally {
    youtubeAppState.loading = false;
    youtubeAppState.didInitialLoad = true;
    renderYouTubeResults();
  }
}

function openYouTubeApp() {
  openPanel("youtube");
  loadYouTubeHome();
}

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

function applyWallpaper(key) {
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

function loadTrack(index, shouldPlay = false) {
  showLocalVelofyPlayer();
  currentTrackIndex = (index + velofyTracks.length) % velofyTracks.length;
  const track = velofyTracks[currentTrackIndex];
  const wallpaper = wallpaperOptions[currentWallpaperKey] || wallpaperOptions.vel;
  velofyArtwork.src = wallpaper.path;
  velofyArtwork.alt = `${wallpaper.label} wallpaper`;
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
  renderLyricsWidget();
}

function renderPlaylist() {
  velofyPlaylist.innerHTML = "";

  const visibleTracks = velofyTracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => matchesSearchQuery([track.title, track.artist], velofySearchQuery));
  const visibleSpotifyTracks = savedSpotifyTracks
    .filter((track) => matchesSearchQuery([track.title, track.subtitle, "spotify"], velofySearchQuery));

  if (!visibleTracks.length && !visibleSpotifyTracks.length) {
    velofyPlaylist.innerHTML = '<p class="playlist-empty">No songs found.</p>';
    return;
  }

  if (visibleTracks.length) {
    const localLabel = document.createElement("p");
    localLabel.className = "playlist-group-label";
    localLabel.textContent = "Local MP3s";
    velofyPlaylist.appendChild(localLabel);
  }

  visibleTracks.forEach(({ track, index }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `track-button${currentVelofyMode === "local" && index === currentTrackIndex ? " is-active" : ""}`;
    button.dataset.trackIndex = String(index);
    button.innerHTML = `
      <strong>${track.title}</strong>
      <span>${track.artist}</span>
    `;
    velofyPlaylist.appendChild(button);
  });

  if (visibleSpotifyTracks.length) {
    const spotifyLabel = document.createElement("p");
    spotifyLabel.className = "playlist-group-label";
    spotifyLabel.textContent = "Saved Spotify";
    velofyPlaylist.appendChild(spotifyLabel);
  }

  visibleSpotifyTracks.forEach((track) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `track-button spotify-track-button${currentVelofyMode === "spotify" && track.id === currentSpotifyTrackId ? " is-active" : ""}`;
    button.dataset.spotifyTrackId = track.id;
    button.innerHTML = `
      <strong>${track.title}</strong>
      <span>${track.subtitle || "Spotify"} - Spotify</span>
    `;
    velofyPlaylist.appendChild(button);
  });
}

function playVelofyOffset(delta) {
  if (currentVelofyMode === "spotify" && savedSpotifyTracks.length) {
    const currentIndex = Math.max(0, savedSpotifyTracks.findIndex((track) => track.id === currentSpotifyTrackId));
    const nextTrack = savedSpotifyTracks[(currentIndex + delta + savedSpotifyTracks.length) % savedSpotifyTracks.length];
    openVelofySpotifyTrack(nextTrack);
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

  const localCards = localItems.map((game) => {
    const gameId = game.id;
    return `
      <button class="app-icon" type="button" data-launch-game="${escapeHtml(gameId)}">
        ${renderBadge({
          title: game.title,
          badgeSrc: createGameBadgeSrc(game.title, game.category),
          badgeText: game.title.slice(0, 2).toUpperCase()
        }, "app-badge")}
        <span class="icon-title">${escapeHtml(game.title)}</span>
        <span class="icon-meta">Local · ${escapeHtml(game.category)}</span>
      </button>
    `;
  });

  const webCards = webItems.map((game) => {
    const app = webApps[game.id];
    return `
      <button class="app-icon" type="button" data-open-web="${escapeHtml(game.id)}">
        ${renderBadge(app, "app-badge")}
        <span class="icon-title">${escapeHtml(game.title)}</span>
        <span class="icon-meta">${escapeHtml(getGameSourceLabel(game.source))} · ${escapeHtml(game.category)}</span>
      </button>
    `;
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
  const nextKey = ["normal", "out", "mini"].includes(key) ? key : "normal";
  currentZoomKey = nextKey;
  document.body.dataset.zoom = currentZoomKey;
  settingsZoomButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.zoomOption === currentZoomKey);
  });
  storage.set("vel-zoom", currentZoomKey);
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

function showBootScreen() {
  if (!bootScreen) return;
  document.body.classList.add("is-booting");
  window.setTimeout(() => {
    bootScreen.classList.add("is-hidden");
    document.body.classList.remove("is-booting");
  }, 3800);
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
    togglePanel(button.dataset.openPanel);
  });
});

closePanelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    closePanel(button.dataset.closePanel);
  });
});

launcherGameSearch?.addEventListener("input", () => {
  launcherGameQuery = launcherGameSearch.value;
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
  searchYouTubeApp();
});

youtubeAddressForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  handleYouTubeAddress(youtubeAddressInput?.value || "youtube.com");
});

youtubeResultsGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-youtube-app-video]");
  if (!button) return;
  const displayResults = youtubeAppState.mode === "history"
    ? youtubeWatchHistory
    : youtubeAppState.results;
  const video = displayResults.find((item) => item.id === button.dataset.youtubeAppVideo);
  selectYouTubeAppVideo(video);
});

youtubeFrameWrap?.addEventListener("click", (event) => {
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
  }
});

youtubeLoadMore?.addEventListener("click", () => {
  searchYouTubeApp({ append: true });
});

youtubeClearHistoryButton?.addEventListener("click", () => {
  clearYouTubeHistory();
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
    loadYouTubeHome();
    return;
  }

  const historyButton = event.target.closest("[data-youtube-history]");
  if (historyButton) {
    showYouTubeHistory();
    return;
  }

  const topicButton = event.target.closest("[data-youtube-topic]");
  if (!topicButton) return;
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
  const localButton = event.target.closest("button[data-launch-game]");
  if (localButton) {
    openGame(localButton.dataset.launchGame);
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
applyWallpaper(currentWallpaperKey);
applyFont(currentFontKey);
applyDensity(currentDensityKey);
applyZoom(currentZoomKey);
if (velofySpotifySearch) {
  velofySpotifySearch.value = velofySpotifySearchQuery;
}
renderLauncherCatalog();
renderRecentApps();
initDraggableDrawers();
initDraggableLyricsWidget();
setActiveLocalGame(activeLocalGame);
if (mediaSearchInput) {
  mediaSearchInput.value = mediaState.query;
}
renderMediaHub();
renderVelofySpotifyResults();
showBootScreen();
updateClock();
renderNetworkState();
updateNowPlayingUi();
renderLyricsWidget();
syncTaskbarState();
window.setInterval(updateClock, 1000);
