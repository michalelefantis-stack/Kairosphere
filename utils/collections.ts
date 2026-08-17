import { CultureItem } from '../types';

/**
 * Thematic collections — the browsing mode the app did not have.
 *
 * Everything else here answers "what can I get to, and when". That is the
 * right question for someone already on the road and the wrong one for
 * someone deciding where to go next, who has no date and no location in
 * mind and wants to be shown something worth crossing a continent for.
 *
 * The themes cut across the category taxonomy on purpose. "Fire & light"
 * holds a Shetland Viking galley burning, a Greek rocket war between rival
 * churches and a city of papier-mâché set alight in Valencia — three
 * different ritualTypes, one thing a traveller might actually want.
 *
 * Membership is matched on words, with hand-written corrections, because
 * 373 events is too many to curate by hand and regexes are too crude to
 * trust alone. Both halves are needed: the matcher found Rouketopolemos,
 * and only a human knows that "Battle of Flowers" is a parade.
 *
 * Word boundaries are not optional. An earlier draft matched "star" and put
 * Basler Fasnacht under astronomy, because its description says the parade
 * *starts* at four in the morning.
 *
 * Only "Great migrations" has had its members read one by one. The other six
 * were checked by sampling, so expect a few passengers — a collection is a
 * curatorial claim about what belongs together, and a regex cannot make one.
 * Reviewing the rest is a job for a person with the list in front of them:
 *   npx tsx -e "…" or the scratch script used for migrations.
 */

export interface Collection {
  id: string;
  title: string;
  /** One line, concrete. Names real events rather than describing a mood. */
  blurb: string;
  match: RegExp;
  /** Event ids the matcher wrongly includes. */
  exclude?: string[];
  /** Event ids the matcher misses, added by hand. */
  include?: string[];
}

export const COLLECTIONS: Collection[] = [
  {
    id: 'fire',
    title: 'Fire & light',
    blurb: 'A Viking galley burned in Shetland, rival churches firing rockets at each other, a city of papier-mâché set alight.',
    match: /\b(fire|fires|flame|flames|bonfire|bonfires|lantern|lanterns|torch|torches|torchlit|burning|burnt|firework|fireworks|candle|candles|pyre|pyres)\b/i
  },
  {
    id: 'migrations',
    title: 'Great migrations',
    blurb: 'Animals arriving in numbers, on schedules older than any calendar — red crabs, ridley turtles, the sardine run.',
    // Led by the animal, not by the word "migration". Matching that word put
    // Quandamooka and Manito Ahbee at the top of this collection: both are
    // Indigenous festivals whose descriptions speak of ancestral migration,
    // which is a different sense of an identical word.
    match: /\b(arribada|spawning|spawn|wildebeest|crabs?|butterfly|butterflies|monarch|whales?|salmon|falcons?|sardine|turtles?|swifts?|bats?|storks?|flamingos?|penguins?|seals?|caribou|reindeer|cranes?|geese|oilbird|swallows?|manta|sharks?)\b/i,
    // Four human festivals that mention an animal in passing. Merrie Monarch
    // is a hula competition named for a king; Manito Ahbee matched "Turtle"
    // from Turtle Island, which is a continent, not a migration.
    exclude: [
      'australia-quandamooka',
      'png-hiri-moale',
      'hawaii-merrie-monarch',
      'canada-manito-ahbee'
    ]
  },
  {
    id: 'nerve',
    title: 'Trials of nerve',
    blurb: 'Land diving from a wooden tower on vines, Florentine street football, a town-wide battle fought with oranges.',
    match: /\b(fighting|combat|wrestling|wrestlers|duel|bull-jumping|land diving|piercing|firewalking|whipping|flogging|joust|jousting|battle|battles)\b/i,
    // "Battle of Flowers" is a parade with flowers, not a trial of anything.
    exclude: ['colombia-barranquilla-carnival']
  },
  {
    id: 'masks',
    title: 'Masks & effigies',
    blurb: 'Faces built to be worn once, and figures built to be destroyed — Krampus, ogoh-ogoh, the horned Busó of Mohács.',
    match: /\b(mask|masks|masked|effigy|effigies|ogoh|krampus|puppets?)\b/i
  },
  {
    id: 'drums',
    title: 'Sound & drums',
    blurb: 'Events you hear before you see: massed drumming, throat singing, gongs that carry across a valley.',
    match: /\b(drum|drums|drumming|drummers|chant|chanting|chants|gong|gongs|throat singing|choir)\b/i
  },
  {
    id: 'ancestors',
    title: 'Rites for the dead',
    blurb: 'Public, and mostly joyful. Ancestors exhumed and re-wrapped in Madagascar, marigolds in Oaxaca, cremation towers in Bali.',
    match: /\b(funeral|funerals|ancestor|ancestors|ancestral|cremation|cremated|tomb|tombs|burial|obon|muertos)\b/i
  },
  {
    id: 'sky',
    title: 'Sky events',
    blurb: 'Timed by the solar system rather than by anyone — auroras, eclipses, and light through a doorway on one morning a year.',
    match: /\b(aurora|auroras|eclipse|eclipses|meteor|meteors|solstice|equinox|stars|comet|zodiacal|noctilucent|constellation)\b/i
  }
];

/** Everything the collection matches against. */
function haystack(item: CultureItem): string {
  return [
    item.title,
    item.description,
    (item as any).insights,
    item.subCategory,
    item.ritualType
  ].filter(Boolean).join(' ');
}

export function eventsInCollection(
  items: CultureItem[],
  collection: Collection
): CultureItem[] {
  const excluded = new Set(collection.exclude ?? []);
  const forced = new Set(collection.include ?? []);

  return items.filter(item => {
    if (excluded.has(item.id)) return false;
    if (forced.has(item.id)) return true;
    return collection.match.test(haystack(item));
  });
}

/**
 * Collections with enough members to be worth opening.
 *
 * A collection of four is a dead end — the reader taps a promising title and
 * lands on almost nothing. Three more themes were drafted and dropped for
 * exactly this: water and tide, blooms, and colour each matched six or seven
 * events.
 */
export const MIN_COLLECTION_SIZE = 8;

export interface PopulatedCollection extends Collection {
  events: CultureItem[];
}

export function populatedCollections(items: CultureItem[]): PopulatedCollection[] {
  return COLLECTIONS
    .map(c => ({ ...c, events: withPhotosFirst(eventsInCollection(items, c)) }))
    .filter(c => c.events.length >= MIN_COLLECTION_SIZE);
}

/**
 * Photographed events first.
 *
 * A collection is sold by its strip of four thumbnails, and 152 of the 373
 * events have no photograph we can vouch for. Leading with grey placeholders
 * makes a rich theme look empty. Nothing is hidden — the full list is one tap
 * away and unchanged — but the preview shows the members that can actually
 * show themselves.
 */
function withPhotosFirst(events: CultureItem[]): CultureItem[] {
  const shown = (e: CultureItem) => ((e as any).imageCredit && e.imageUrl ? 0 : 1);
  return [...events].sort((a, b) => shown(a) - shown(b));
}
