import { CultureItem, RitualType } from '../types';

/**
 * Southeast Asia.
 *
 * The catalogue had one entry for the whole region — Ngaben in Bali — and zero
 * for Thailand, Vietnam, the Philippines, Myanmar, Cambodia, Laos, Malaysia
 * and Singapore combined. For an app about ritual and natural phenomena that
 * is a strange hole: mainland and maritime Southeast Asia carry one of the
 * densest festival calendars anywhere, and several of the world's better
 * natural spectacles.
 *
 * Dates follow the app's convention: a representative instance that
 * utils/eventSchedule projects forward. Anything set by a lunar or lunisolar
 * calendar — most of the Buddhist and Chinese-influenced calendar — is marked
 * movable so the UI says the date varies instead of asserting a wrong day.
 */

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

export const SOUTHEAST_ASIA_EVENTS: CultureItem[] = [
  // ── Thailand ────────────────────────────────────────────────────────────
  {
    id: 'th-yi-peng',
    title: 'Yi Peng and Loy Krathong',
    coordinates: [18.7883, 98.9853],
    ritualType: RitualType.FESTIVAL,
    subCategory: 'Light',
    startDate: '2026-11-24',
    endDate: '2026-11-26',
    verified: true,
    region: 'Chiang Mai, Thailand',
    preciseLocation: 'Chiang Mai old city and the Ping River',
    description:
      'Two festivals that fall together: krathong rafts of banana leaf and candles set on the river, and thousands of khom loi lanterns released into the sky. Held on the full moon of the twelfth lunar month.',
    insights:
      'The mass lantern releases sold to visitors are separate ticketed events outside the city; the temple observances in the old city are free, older and considerably less staged.',
    imageUrl: img('photo-1512553353614-82a7370096dc'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'th-songkran',
    title: 'Songkran',
    coordinates: [13.7563, 100.5018],
    ritualType: RitualType.FESTIVAL,
    subCategory: 'Water',
    startDate: '2027-04-13',
    endDate: '2027-04-15',
    verified: true,
    region: 'Bangkok, Thailand',
    preciseLocation: 'Nationwide; densest in Bangkok and Chiang Mai',
    description:
      'Thai new year. The water throwing everyone photographs descends from pouring scented water over Buddha images and the hands of elders, which still happens quietly in the mornings before the streets fill.',
    insights:
      'UNESCO-inscribed in 2023. Road deaths spike sharply across the holiday, which is why it is locally nicknamed the seven dangerous days.',
    imageUrl: img('photo-1552465011-b4e21bf6e79a'),
    mediaLinks: {}
  },
  {
    id: 'th-phi-ta-khon',
    title: 'Phi Ta Khon',
    coordinates: [17.2833, 101.1500],
    ritualType: RitualType.CEREMONY,
    subCategory: 'Ancestor',
    startDate: '2027-06-19',
    endDate: '2027-06-21',
    verified: true,
    region: 'Dan Sai, Loei, Thailand',
    preciseLocation: 'Dan Sai district, Loei province',
    description:
      'Masked spirit procession in the Isan northeast. Masks are built from sticky-rice steamers and coconut fronds, painted in loud colours, and worn to escort the spirits said to have followed the Buddha home.',
    insights:
      'The dates are not fixed. Town mediums consult the guardian spirit Chao Saen Muang and announce them only weeks ahead, so booking early means booking blind.',
    imageUrl: img('photo-1528181304800-259b08848526'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'th-naga-fireballs',
    title: 'Naga Fireballs',
    coordinates: [18.0000, 103.6500],
    ritualType: RitualType.PHENOMENON,
    subCategory: 'Light',
    startDate: '2026-10-25',
    endDate: '2026-10-26',
    verified: true,
    region: 'Nong Khai, Thailand',
    preciseLocation: 'Mekong River near Phon Phisai',
    description:
      'Reddish glowing orbs rise from the Mekong on the night that ends Buddhist Lent. Locally attributed to a naga in the river; the physical explanation is still argued over, with marsh gas the usual candidate.',
    insights:
      'Tied to the full moon of the eleventh lunar month, so the Gregorian date shifts each year. Crowds line the Thai bank; the Lao side is quieter.',
    imageUrl: img('photo-1470071459604-3b5ec3a7fe05'),
    mediaLinks: {},
    dateIsMovable: true
  },

  // ── Indonesia ───────────────────────────────────────────────────────────
  {
    id: 'id-nyepi',
    title: 'Nyepi and the Ogoh-Ogoh',
    coordinates: [-8.5069, 115.2625],
    ritualType: RitualType.SPIRITUAL,
    subCategory: 'Trance/Shamanic',
    startDate: '2027-03-19',
    endDate: '2027-03-20',
    verified: true,
    region: 'Bali, Indonesia',
    preciseLocation: 'Island-wide; effigy parades centred on Denpasar and Ubud',
    description:
      'Balinese Saka new year. Giant ogoh-ogoh demon effigies are paraded and burned the night before, then the entire island stops for twenty-four hours of silence: no travel, no work, no light, no fires.',
    insights:
      'The airport closes for the full day and the internet is switched off island-wide. Visitors are expected to stay inside their accommodation — this is enforced by village wardens, not merely requested.',
    imageUrl: img('photo-1537996194471-e657df975ab4'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'id-pasola',
    title: 'Pasola',
    coordinates: [-9.6500, 119.1500],
    ritualType: RitualType.CEREMONY,
    subCategory: 'Ancestor',
    startDate: '2027-02-20',
    endDate: '2027-02-22',
    verified: true,
    region: 'Sumba, Indonesia',
    preciseLocation: 'Lamboya and Wanukaka, West Sumba',
    description:
      'Mounted teams hurl wooden spears at each other across an open field. Part of the Marapu religion: blood spilled on the ground is held to secure the rice harvest.',
    insights:
      'Timed to the arrival of the nyale sea worms on the beach, which priests read to set the date — so it is announced only days in advance. Injuries are common and considered meaningful rather than accidental.',
    imageUrl: img('photo-1518709594023-6eab9bab7b23'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'id-bau-nyale',
    title: 'Bau Nyale Sea Worm Swarming',
    coordinates: [-8.8950, 116.3000],
    ritualType: RitualType.PHENOMENON,
    subCategory: 'Fauna',
    startDate: '2027-02-18',
    endDate: '2027-02-19',
    verified: true,
    region: 'Lombok, Indonesia',
    preciseLocation: 'Seger Beach, Kuta, south Lombok',
    description:
      'Palolo worms rise to the surface in their millions to spawn on a handful of nights each year. Thousands wade in before dawn to catch them, tied to the legend of Princess Mandalika who threw herself into the sea.',
    insights:
      'Predicted from the lunar calendar — the twentieth day of the tenth Sasak month — and highly sensitive to it. Arrive on the wrong night and the sea is simply empty.',
    imageUrl: img('photo-1559827260-dc66d52bef19'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'id-rambu-solo',
    title: 'Rambu Solo Funeral Rites',
    coordinates: [-2.9700, 119.9000],
    ritualType: RitualType.CEREMONY,
    subCategory: 'Ancestor',
    startDate: '2027-07-15',
    endDate: '2027-08-31',
    verified: true,
    region: 'Tana Toraja, Sulawesi, Indonesia',
    preciseLocation: 'Villages around Rantepao',
    description:
      'Torajan funerals run for days and are the largest events in the culture, with buffalo sacrifice, tau-tau effigies and cliff-face tombs. The deceased may be kept at home for months or years until the family can afford the rite.',
    insights:
      'These are private family occasions that outsiders attend as invited guests, not as ticket holders. Going through a local guide who has been asked in advance is the difference between being welcome and intruding.',
    imageUrl: img('photo-1596422846543-75c6fc197f07'),
    mediaLinks: {}
  },
  {
    id: 'id-kawah-ijen',
    title: 'Ijen Blue Fire',
    coordinates: [-8.0583, 114.2417],
    ritualType: RitualType.PHENOMENON,
    subCategory: 'Fire',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    verified: true,
    region: 'East Java, Indonesia',
    preciseLocation: 'Kawah Ijen crater, Banyuwangi',
    description:
      'Ignited sulphuric gases burn electric blue in the crater at night, alongside a turquoise acid lake. Miners carry 70–90kg loads of sulphur out of the same crater by hand.',
    insights:
      'Visible only in darkness, so the climb starts around 1am. The dry season from April to October gives the clearest air; gas masks are not optional.',
    imageUrl: img('photo-1601789318578-0b0e0e0d8b0f'),
    mediaLinks: {}
  },

  // ── Philippines ─────────────────────────────────────────────────────────
  {
    id: 'ph-ati-atihan',
    title: 'Ati-Atihan',
    coordinates: [11.7086, 122.3644],
    ritualType: RitualType.FESTIVAL,
    subCategory: 'Dance',
    startDate: '2027-01-17',
    endDate: '2027-01-17',
    verified: true,
    region: 'Kalibo, Aklan, Philippines',
    preciseLocation: 'Kalibo town centre',
    description:
      'The oldest of the Philippine street festivals, honouring the Santo Niño. Marchers blacken their faces with soot in reference to the Ati people and move to a relentless drum line for three days.',
    insights:
      'Held the third Sunday of January, the same weekend as Sinulog in Cebu and Dinagyang in Iloilo — the three are within a short flight of each other, which makes a rare cluster.',
    imageUrl: img('photo-1519671482749-fd09be7ccebf'),
    mediaLinks: {}
  },
  {
    id: 'ph-sinulog',
    title: 'Sinulog',
    coordinates: [10.3157, 123.8854],
    ritualType: RitualType.FESTIVAL,
    subCategory: 'Dance',
    startDate: '2027-01-17',
    endDate: '2027-01-17',
    verified: true,
    region: 'Cebu, Philippines',
    preciseLocation: 'Cebu City',
    description:
      'A million-strong procession for the Santo Niño, danced in a two-steps-forward, one-step-back rhythm said to imitate the current of a river.',
    insights:
      'The fluvial procession at dawn on the Saturday is the older and quieter half; the Sunday street parade is the spectacle.',
    imageUrl: img('photo-1555400038-63f5ba517a47'),
    mediaLinks: {}
  },
  {
    id: 'ph-moriones',
    title: 'Moriones',
    coordinates: [13.4767, 121.9032],
    ritualType: RitualType.CEREMONY,
    subCategory: 'Theatrical',
    startDate: '2027-03-22',
    endDate: '2027-03-28',
    verified: true,
    region: 'Marinduque, Philippines',
    preciseLocation: 'Boac, Gasan and Mogpog',
    description:
      'Holy Week penitents wear carved wooden Roman-centurion masks for the week, re-enacting the legend of Longinus, the blind soldier whose sight was restored at the crucifixion.',
    insights:
      'Falls with Easter, so it moves every year. Masks are carved from a single block of dapdap wood and often kept in families for decades.',
    imageUrl: img('photo-1552083375-1447ce886485'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'ph-donsol-whale-sharks',
    title: 'Whale Shark Aggregation',
    coordinates: [12.9100, 123.5980],
    ritualType: RitualType.PHENOMENON,
    subCategory: 'Fauna',
    startDate: '2027-02-01',
    endDate: '2027-05-31',
    verified: true,
    region: 'Donsol, Sorsogon, Philippines',
    preciseLocation: 'Donsol Bay',
    description:
      'Whale sharks gather to feed on plankton blooms in the bay. Donsol runs a strictly regulated interaction scheme: swimmers only, no scuba, no touching, limited boats.',
    insights:
      'Deliberately distinct from Oslob further south, where the sharks are hand-fed to keep them in place year-round — a practice marine biologists have criticised for altering their behaviour and migration.',
    imageUrl: img('photo-1544551763-46a013bb70d5'),
    mediaLinks: {}
  },

  // ── Vietnam ─────────────────────────────────────────────────────────────
  {
    id: 'vn-tet',
    title: 'Tết Nguyên Đán',
    coordinates: [21.0278, 105.8342],
    ritualType: RitualType.FESTIVAL,
    subCategory: 'Cultural',
    startDate: '2027-02-06',
    endDate: '2027-02-09',
    verified: true,
    region: 'Hanoi, Vietnam',
    preciseLocation: 'Nationwide',
    description:
      'Vietnamese lunar new year, and the year\'s one great homecoming. Kumquat trees and peach blossom into the house, graves swept, debts settled, and the first visitor across the threshold chosen with care.',
    insights:
      'Much of the country closes for a week and transport sells out months ahead. Visiting during Tết means seeing family life rather than commerce — most shops and many restaurants are shut.',
    imageUrl: img('photo-1583417319070-4a69db38a482'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'vn-perfume-pagoda',
    title: 'Perfume Pagoda Pilgrimage',
    coordinates: [20.6167, 105.7500],
    ritualType: RitualType.PILGRIMAGE,
    subCategory: 'Sacred Journey',
    startDate: '2027-02-12',
    endDate: '2027-03-31',
    verified: true,
    region: 'Hương Sơn, Hanoi, Vietnam',
    preciseLocation: 'Hương Tích cave complex, Mỹ Đức district',
    description:
      'The largest pilgrimage in northern Vietnam. Sampans are rowed up the Yến stream to a hillside of shrines, ending at a cave temple reached by a long stone stair.',
    insights:
      'Runs from the sixth day of the first lunar month for roughly three months, peaking in the first weeks. Off-peak visits get the same landscape without the queue up the mountain.',
    imageUrl: img('photo-1509030450996-dd1a26dda07a'),
    mediaLinks: {},
    dateIsMovable: true
  },

  // ── Myanmar ─────────────────────────────────────────────────────────────
  {
    id: 'mm-taunggyi-balloon',
    title: 'Taunggyi Fire Balloon Festival',
    coordinates: [20.7892, 97.0378],
    ritualType: RitualType.FESTIVAL,
    subCategory: 'Fire',
    startDate: '2026-11-20',
    endDate: '2026-11-24',
    verified: true,
    region: 'Taunggyi, Shan State, Myanmar',
    preciseLocation: 'Taunggyi festival grounds',
    description:
      'Enormous paper balloons carrying lanterns and fireworks are launched at night during Tazaungdaing, the festival of lights. Teams compete, and the balloons sometimes come down still burning.',
    insights:
      'Genuinely dangerous — there have been fatalities in the crowd. Watch from the outer edge of the field rather than the front.',
    imageUrl: img('photo-1509644851169-2acc08aa25b5'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'mm-phaung-daw-oo',
    title: 'Phaung Daw Oo Pagoda Festival',
    coordinates: [20.5333, 96.9167],
    ritualType: RitualType.CEREMONY,
    subCategory: 'Water',
    startDate: '2026-10-12',
    endDate: '2026-10-29',
    verified: true,
    region: 'Inle Lake, Shan State, Myanmar',
    preciseLocation: 'Inle Lake villages',
    description:
      'Four gilded Buddha images are carried around the lake on a royal barge shaped as a karaweik bird, towed by leg-rowers standing at the oar in the Intha style.',
    insights:
      'A fifth image stays permanently at the pagoda after a barge capsized carrying it — the story is that it returned to the shrine by itself.',
    imageUrl: img('photo-1540611025311-01df3cef54b5'),
    mediaLinks: {},
    dateIsMovable: true
  },

  // ── Cambodia and Laos ───────────────────────────────────────────────────
  {
    id: 'kh-bon-om-touk',
    title: 'Bon Om Touk Water Festival',
    coordinates: [11.5564, 104.9282],
    ritualType: RitualType.FESTIVAL,
    subCategory: 'Water',
    startDate: '2026-11-23',
    endDate: '2026-11-25',
    verified: true,
    region: 'Phnom Penh, Cambodia',
    preciseLocation: 'Confluence of the Tonlé Sap and Mekong',
    description:
      'Marks the reversal of the Tonlé Sap, when the river changes direction and drains back into the Mekong. Hundreds of longboats race the riverfront over three days.',
    insights:
      'The reversal is a genuine hydrological event and one of the largest of its kind, driving the fishery that feeds much of the country. The festival has been cancelled in years when the flood behaved abnormally.',
    imageUrl: img('photo-1563492065599-3520f775eeed'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'la-that-luang',
    title: 'Boun That Luang',
    coordinates: [17.9757, 102.6331],
    ritualType: RitualType.SPIRITUAL,
    subCategory: 'Light',
    startDate: '2026-11-22',
    endDate: '2026-11-24',
    verified: true,
    region: 'Vientiane, Laos',
    preciseLocation: 'Pha That Luang stupa',
    description:
      'The country\'s most important religious gathering. Thousands circle the golden stupa carrying wax castles decorated with flowers and candles, offered to the monks at dawn.',
    insights:
      'Held on the full moon of the twelfth lunar month. The dawn alms offering is the heart of it; the surrounding trade fair runs for a week.',
    imageUrl: img('photo-1528181304800-259b08848526'),
    mediaLinks: {},
    dateIsMovable: true
  },

  // ── Malaysia ────────────────────────────────────────────────────────────
  {
    id: 'my-thaipusam',
    title: 'Thaipusam at Batu Caves',
    coordinates: [3.2379, 101.6840],
    ritualType: RitualType.PILGRIMAGE,
    subCategory: 'Initiation',
    startDate: '2027-02-11',
    endDate: '2027-02-11',
    verified: true,
    region: 'Batu Caves, Selangor, Malaysia',
    preciseLocation: '272 steps to the Batu Caves temple',
    description:
      'Devotees carry kavadi — frames borne on the shoulders, many with skewers through cheeks and tongue — up the steps to the shrine of Murugan, having fasted for weeks beforehand.',
    insights:
      'Draws well over a million people. Photography of devotees in trance is tolerated but genuinely intrusive up close; the temple asks visitors to keep back from those under the burden.',
    imageUrl: img('photo-1518509562904-e7ef99cdcc86'),
    mediaLinks: {},
    dateIsMovable: true
  },
  {
    id: 'my-gawai-dayak',
    title: 'Gawai Dayak',
    coordinates: [1.5533, 110.3592],
    ritualType: RitualType.FESTIVAL,
    subCategory: 'Harvest',
    startDate: '2027-06-01',
    endDate: '2027-06-02',
    verified: true,
    region: 'Sarawak, Malaysia',
    preciseLocation: 'Longhouses across Sarawak; Kuching for the public events',
    description:
      'Iban and Bidayuh harvest festival. Longhouses open their doors, tuak rice wine is poured for every visitor, and the ngajat is danced through the night.',
    insights:
      'The longhouse celebrations are the real thing and run on invitation. The urban version in Kuching is open to anyone but is a much tamer affair.',
    imageUrl: img('photo-1518709594023-6eab9bab7b23'),
    mediaLinks: {}
  },
  {
    id: 'my-selangor-fireflies',
    title: 'Synchronous Fireflies of Kampung Kuantan',
    coordinates: [3.3400, 101.2500],
    ritualType: RitualType.PHENOMENON,
    subCategory: 'Fauna',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    verified: true,
    region: 'Kuala Selangor, Malaysia',
    preciseLocation: 'Berembang mangroves on the Selangor River',
    description:
      'Pteroptyx tener fireflies mass in the riverside berembang trees and flash in unison, turning individual trees into something like slow strobing lanterns. Viewed from silent rowed sampans.',
    insights:
      'Present all year but best on moonless nights without rain. The colonies are sensitive to riverbank development and light pollution, and several nearby sites have already gone dark.',
    imageUrl: img('photo-1470071459604-3b5ec3a7fe05'),
    mediaLinks: {}
  }
];
