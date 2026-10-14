/**
 * badges.js
 * Badge definitions and evaluation for the "nest grows as you learn" loop.
 * Pure data + predicates; progress.js owns persistence and unlocking.
 */

export const BADGES = [
  {
    id: "hatchling",
    name: "Hatchling",
    desc: "Complete your first tutorial.",
    icon: "◍",
    test: (state) => readCount(state) >= 1,
  },
  {
    id: "curious",
    name: "Curious",
    desc: "Complete five tutorials.",
    icon: "◈",
    test: (state) => readCount(state) >= 5,
  },
  {
    id: "scholar",
    name: "Scholar",
    desc: "Complete ten tutorials.",
    icon: "✦",
    test: (state) => readCount(state) >= 10,
  },
  {
    id: "polyglot",
    name: "Polyglot",
    desc: "Read a tutorial from every topic.",
    icon: "⬡",
    test: (state, ctx) => {
      if (!ctx.allCategories || !ctx.allCategories.length) return false;
      const read = new Set(
        Object.values(state.read)
          .filter((entry) => entry.kind === "tutorial" && entry.category)
          .map((entry) => entry.category)
      );
      return ctx.allCategories.every((category) => read.has(category));
    },
  },
  {
    id: "paper-trail",
    name: "Paper Trail",
    desc: "Read every research paper.",
    icon: "▤",
    test: (state, ctx) => {
      if (!ctx.allPaperIds || !ctx.allPaperIds.length) return false;
      return ctx.allPaperIds.every((id) => Boolean(state.read[id]));
    },
  },
  {
    id: "perfectionist",
    name: "Perfectionist",
    desc: "Ace a quiz on the first try.",
    icon: "✓",
    test: (state) => Object.keys(state.perfect).length >= 1,
  },
  {
    id: "night-owl",
    name: "Night Owl",
    desc: "Finish a tutorial after midnight.",
    icon: "☾",
    test: (state) =>
      Object.values(state.read).some((entry) => {
        const hour = new Date(entry.at).getHours();
        return hour >= 0 && hour < 5;
      }),
  },
  {
    id: "streak-3",
    name: "On a Roll",
    desc: "Learn three days in a row.",
    icon: "≡",
    test: (state) => state.streak.count >= 3,
  },
  {
    id: "streak-7",
    name: "Devoted",
    desc: "Learn seven days in a row.",
    icon: "≣",
    test: (state) => state.streak.count >= 7,
  },
  {
    id: "egg-hunter",
    name: "Egg Hunter",
    desc: "Discover three hidden secrets.",
    icon: "?",
    secret: true,
    test: (state) => state.eggs.length >= 3,
  },
];

function readCount(state) {
  return Object.values(state.read).filter((entry) => entry.kind !== "paper").length;
}

export function getBadge(id) {
  return BADGES.find((badge) => badge.id === id) || null;
}

/** Return the ids of badges whose condition is now met and not yet unlocked. */
export function evaluateBadges(state, ctx = {}) {
  return BADGES.filter(
    (badge) => !state.badges.includes(badge.id) && badge.test(state, ctx)
  ).map((badge) => badge.id);
}
