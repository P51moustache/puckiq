/**
 * PuckIQ illustrations — flat F1-style art on the paper (#F2F0EC) or carbon (#15151E)
 * palette, so they sit on screens without a visible box. Paper-backed art is snapped to
 * the exact app background (#F2F0EC) on export.
 */

export const ART = {
  /** Ice resurfacer on an empty rink — no games tonight / this week. */
  noGames: require('../assets/images/art/no-games.jpg'),
  /** Empty net with a puck — every slot is covered. */
  lineupFull: require('../assets/images/art/lineup-full.jpg'),
  /** Snapped stick — couldn't reach the NHL. */
  error: require('../assets/images/art/error.jpg'),
  /** Empty bench with a helmet — no roster yet. */
  emptyRoster: require('../assets/images/art/empty-roster.jpg'),
  /** Goal lamp on carbon — paywall hero. */
  goalLamp: require('../assets/images/art/goal-lamp.jpg'),
  /** Faint rink lines on carbon — texture behind dark panels (our "circuit map"). */
  rink: require('../assets/images/art/rink.jpg'),
  /** Transparent: the app-icon puck with red streaks, for brand kickers. */
  logoMark: require('../assets/images/art/logo-mark.png'),
  /** Transparent: flaming puck — hot-streak badge. */
  hotPuck: require('../assets/images/art/hot-puck.png'),
  /** Transparent: checkered flag on a stick — games final / week done. */
  checkeredFlag: require('../assets/images/art/checkered-flag.png'),
  /** Transparent: puck frozen in ice — cold-streak badge. */
  coldPuck: require('../assets/images/art/cold-puck.png'),
  /** Transparent: coach's whiteboard play — league setup. */
  whiteboard: require('../assets/images/art/whiteboard.png'),
  /** Transparent: generic trophy with a puck — ahead in the matchup. */
  trophy: require('../assets/images/art/trophy.png'),
  /** Transparent: goal lamp lighting up — clean lineup before lock. */
  goalLampBadge: require('../assets/images/art/goal-lamp-badge.png'),
} as const;

/** Width ÷ height of the transparent pieces, for sizing by height. */
export const ART_ASPECT = {
  logoMark: 360 / 122,
  hotPuck: 150 / 90,
  checkeredFlag: 240 / 259,
  coldPuck: 120 / 117,
  whiteboard: 480 / 319,
  trophy: 200 / 227,
  goalLampBadge: 200 / 216,
} as const;
