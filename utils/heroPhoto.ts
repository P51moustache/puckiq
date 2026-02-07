/**
 * Hero Photo Utility
 * Selects a background photo for the hero banner from bundled assets.
 * Photos rotate daily (same photo all day, different the next day).
 */

const HERO_PHOTOS = [
  require('../assets/images/topimages/image1.jpg'),
  require('../assets/images/topimages/image2.jpg'),
  require('../assets/images/topimages/image3.jpg'),
  require('../assets/images/topimages/image4.jpg'),
  require('../assets/images/topimages/image5.jpg'),
  require('../assets/images/topimages/image6.jpg'),
  require('../assets/images/topimages/image7.jpg'),
  require('../assets/images/topimages/image8.jpg'),
];

/**
 * Get today's hero photo. Returns the same image source all day,
 * cycles to a different one each day based on day-of-year.
 */
export function getHeroPhoto(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / 86400000,
  );
  return HERO_PHOTOS[dayOfYear % HERO_PHOTOS.length];
}

/**
 * Get a random hero photo (e.g., for pull-to-refresh variety).
 */
export function getRandomHeroPhoto(): number {
  return HERO_PHOTOS[Math.floor(Math.random() * HERO_PHOTOS.length)];
}

/** Total number of hero photos available. */
export const HERO_PHOTO_COUNT = HERO_PHOTOS.length;
