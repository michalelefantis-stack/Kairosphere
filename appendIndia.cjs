const fs = require('fs');

const items = [
  // --- MAJOR PAN-INDIAN & RELIGIOUS FESTIVALS ---
  {
    id: 'india-diwali',
    title: 'Diwali (Festival of Lights)',
    coordinates: [28.6139, 77.2090],
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-10-20',
    endDate: '2025-10-21',
    verified: true,
    region: 'India (Pan-India)',
    description: 'Celebrated across India; marks the victory of light over darkness.',
    insights: 'Millions of lamps, diyas, and fireworks illuminate the country in this ancient Hindu festival celebrating Rama\\'s return to Ayodhya.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Diwali_Diyas.jpg/960px-Diwali_Diyas.jpg'
  },
  {
    id: 'india-holi',
    title: 'Holi (Festival of Colors)',
    coordinates: [27.5369, 77.6698], // Mathura
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-03-14',
    endDate: '2025-03-14',
    verified: true,
    region: 'India (Pan-India)',
    description: 'A spring festival celebrated with vibrant powders and water.',
    insights: 'Celebrates the eternal and divine love of Radha Krishna and signifies the triumph of good over evil. The streets erupt in flying colored powders (gulal).',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Holi_Festival_of_Colors.jpg/960px-Holi_Festival_of_Colors.jpg'
  },
  {
    id: 'india-eid-ul-fitr',
    title: 'Eid-ul-Fitr',
    coordinates: [28.6507, 77.2334], // Jama Masjid, Delhi
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-03-30',
    endDate: '2025-03-31',
    verified: true,
    region: 'India / South Asia',
    description: 'Marks the end of Ramadan; a major celebration for the Muslim community.',
    insights: 'Commemorates the end of the dawn-to-sunset fasting of Ramadan. Celebrated with morning prayers, feasts of biryani and sheer khurma, and charity.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Jama_Masjid%2C_Delhi_during_Eid.jpg/960px-Jama_Masjid%2C_Delhi_during_Eid.jpg'
  },
  {
    id: 'india-durga-puja',
    title: 'Durga Puja',
    coordinates: [22.5726, 88.3639], // Kolkata
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-09-28',
    endDate: '2025-10-02',
    verified: true,
    region: 'West Bengal, India',
    description: 'Massive artistic pandals and rituals honoring Goddess Durga, primarily in West Bengal.',
    insights: 'Kolkata transforms into a massive open-air art gallery with thousands of temporary themed pavilions (pandals) housing elaborate idols of the goddess.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Durga_Puja_Kolkata.jpg/960px-Durga_Puja_Kolkata.jpg'
  },
  {
    id: 'india-ganesh-chaturthi',
    title: 'Ganesh Chaturthi',
    coordinates: [18.9750, 72.8258], // Mumbai
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-08-27',
    endDate: '2025-09-06',
    verified: true,
    region: 'Maharashtra, India',
    description: '10-day festival honoring Ganesha; famous for massive street processions in Maharashtra.',
    insights: 'Millions gather as massive, intricately carved clay idols of Lord Ganesha are carried through the streets to be immersed in the Arabian Sea (Visarjan) amidst drums and dancing.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Ganesh_Visarjan_Mumbai.jpg/960px-Ganesh_Visarjan_Mumbai.jpg'
  },
  {
    id: 'india-navratri',
    title: 'Navratri',
    coordinates: [23.0225, 72.5714], // Ahmedabad
    ritualType: 'RitualType.SPIRITUAL',
    startDate: '2025-09-22',
    endDate: '2025-10-02',
    verified: true,
    region: 'Gujarat, India',
    description: 'Nine nights of dance (Garba/Dandiya) and worship of the Divine Feminine.',
    insights: 'In Gujarat, the festival features ecstatic circular dances (Garba) performed by thousands of people in traditional, highly embroidered attire clashing wooden sticks (Dandiya).',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Garba_Dance.jpg/960px-Garba_Dance.jpg'
  },
  {
    id: 'india-maha-shivratri',
    title: 'Maha Shivratri',
    coordinates: [25.3176, 83.0062], // Varanasi
    ritualType: 'RitualType.PILGRIMAGE',
    startDate: '2025-02-26',
    endDate: '2025-02-26',
    verified: true,
    region: 'India (Pan-India)',
    description: 'A night of fasting and meditation honoring Lord Shiva.',
    insights: 'Devotees stay awake all night to perform pujas, chant the Om Namah Shivaya mantra, and bathe Shiva Lingams with milk, honey, and water in temples across the country.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Shiva_Lingam_Puja.jpg/500px-Shiva_Lingam_Puja.jpg'
  },
  {
    id: 'india-raksha-bandhan',
    title: 'Raksha Bandhan',
    coordinates: [26.9124, 75.7873], // Jaipur
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-08-09',
    endDate: '2025-08-09',
    verified: true,
    region: 'India (Pan-India)',
    description: 'A ceremony where sisters tie a protective thread (Rakhi) on their brothers\\' wrists.',
    insights: 'A widespread family observance reaffirming sibling bonds. The simple act of tying a thread signifies a brother\\'s vow to protect his sister.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Rakhi_Threads.jpg/500px-Rakhi_Threads.jpg'
  },
  {
    id: 'india-janmashtami',
    title: 'Janmashtami',
    coordinates: [19.0760, 72.8777], // Mumbai
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-08-15',
    endDate: '2025-08-16',
    verified: true,
    region: 'Maharashtra & UP, India',
    description: 'Celebrating the birth of Lord Krishna with "Dahi Handi" human pyramids.',
    insights: 'In Mumbai, hundreds of young men (Govindas) form massive human pyramids to break extremely high suspended clay pots filled with curd, mimicking Krishna\\'s legendary butter thefts.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Dahi_Handi_Festival.jpg/960px-Dahi_Handi_Festival.jpg'
  },
  {
    id: 'india-christmas-goa',
    title: 'Christmas in India',
    coordinates: [15.2993, 74.1240], // Goa
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-12-25',
    endDate: '2025-12-25',
    verified: true,
    region: 'Goa, Kerala, Northeast India',
    description: 'Celebrated with unique local flavors in Goa, Kerala, and the Northeast.',
    insights: 'Showcases Midnight Mass in coastal Portuguese-era basilicas, giant paper star lanterns hanging from palm trees, and feasts involving vindaloo and bebinca.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Goa_Church_Christmas.jpg/960px-Goa_Church_Christmas.jpg'
  },

  // --- REGIONAL HARVEST & NEW YEAR FESTIVALS ---
  {
    id: 'india-pongal',
    title: 'Pongal',
    coordinates: [13.0827, 80.2707], // Chennai
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-01-14',
    endDate: '2025-01-17',
    verified: true,
    region: 'Tamil Nadu, India',
    description: 'A four-day Tamil harvest festival featuring the boiling of first rice.',
    insights: 'The highlight is boiling freshly harvested rice with milk and jaggery in a decorated clay pot until it overflows, symbolizing abundance. Cows are honored and decorated.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Pongal_Pot.jpg/500px-Pongal_Pot.jpg'
  },
  {
    id: 'india-onam',
    title: 'Onam',
    coordinates: [8.5241, 76.9366], // Trivandrum
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-09-05',
    endDate: '2025-09-15',
    verified: true,
    region: 'Kerala, India',
    description: 'Kerala’s harvest festival featuring "Pookalam" (flower carpets) and boat races.',
    insights: 'Celebrates the mythical King Mahabali. Features massive snake boat races (Vallam Kali) on the backwaters and elaborate floral arrangements adorning homes.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Snake_Boat_Race_Kerala.jpg/960px-Snake_Boat_Race_Kerala.jpg'
  },
  {
    id: 'india-baisakhi',
    title: 'Baisakhi',
    coordinates: [31.6200, 74.8765], // Amritsar
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-04-13',
    endDate: '2025-04-13',
    verified: true,
    region: 'Punjab, India',
    description: 'The Sikh New Year and harvest festival in Punjab.',
    insights: 'Marks the formation of the Khalsa panth under Guru Gobind Singh. The Golden Temple is illuminated, and farmers celebrate the wheat harvest with energetic Bhangra dancing.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Bhangra_Dance.jpg/960px-Bhangra_Dance.jpg'
  },
  {
    id: 'india-bihu',
    title: 'Bihu',
    coordinates: [26.1445, 91.7362], // Guwahati
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-04-14',
    endDate: '2025-04-15',
    verified: true,
    region: 'Assam, India',
    description: 'Assamese festival celebrating the change of seasons through folk dance.',
    insights: 'The Rongali Bihu marks the Assamese New Year. Women in muga silk sarees perform the vigorous Bihu dance in open fields to celebrate fertility and youth.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Bihu_Dancers.jpg/960px-Bihu_Dancers.jpg'
  },
  {
    id: 'india-makar-sankranti',
    title: 'Makar Sankranti',
    coordinates: [23.0225, 72.5714], // Ahmedabad
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-01-14',
    endDate: '2025-01-14',
    verified: true,
    region: 'Gujarat & Rajasthan, India',
    description: 'A solar festival marked by kite flying, especially in Gujarat and Rajasthan.',
    insights: 'During the International Kite Festival (Uttarayan), the sky above Ahmedabad fills with millions of colorful kites as families engage in friendly aerial rooftop battles.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Makar_Sankranti_Kites.jpg/960px-Makar_Sankranti_Kites.jpg'
  },
  {
    id: 'india-poila-baisakh',
    title: 'Poila Baisakh',
    coordinates: [22.5726, 88.3639], // Kolkata
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-04-14',
    endDate: '2025-04-14',
    verified: true,
    region: 'West Bengal, India',
    description: 'The Bengali New Year marked by cultural programs and new ledgers.',
    insights: 'Traders open new accounting books (Haalkhata) sprinkled with holy water, and streets are filled with music processions singing Rabindra Sangeet.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Poila_Baisakh_Alpana.jpg/500px-Poila_Baisakh_Alpana.jpg'
  },
  {
    id: 'india-vishu',
    title: 'Vishu',
    coordinates: [9.9312, 76.2673], // Kochi
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-04-14',
    endDate: '2025-04-14',
    verified: true,
    region: 'Kerala, India',
    description: 'The Malayali New Year, centered around the "Vishukkani" (auspicious sight).',
    insights: 'The first thing one sees upon waking is an intricately arranged tray of golden laburnum flowers, fruits, and coins, believed to bring prosperity for the year.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Vishukkani.jpg/500px-Vishukkani.jpg'
  },
  {
    id: 'india-gudi-padwa',
    title: 'Gudi Padwa',
    coordinates: [18.5204, 73.8567], // Pune
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-03-30',
    endDate: '2025-03-30',
    verified: true,
    region: 'Maharashtra, India',
    description: 'The Marathi and Konkani New Year.',
    insights: 'Homes are decorated with a "Gudi"—a bright cloth tied to a bamboo stick with an inverted silver vessel and sugar crystals, symbolizing victory and warding off evil.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Gudi_Padwa.jpg/500px-Gudi_Padwa.jpg'
  },
  {
    id: 'india-ugadi',
    title: 'Ugadi',
    coordinates: [17.3850, 78.4867], // Hyderabad
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-03-30',
    endDate: '2025-03-30',
    verified: true,
    region: 'Andhra Pradesh & Karnataka, India',
    description: 'The New Year for people in Andhra Pradesh, Telangana, and Karnataka.',
    insights: 'Celebrated by making Ugadi Pachadi, a unique dish combining sweet, sour, salty, and bitter flavors, reminding families that life is a mixture of all experiences.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Ugadi_Pachadi.jpg/500px-Ugadi_Pachadi.jpg'
  },
  {
    id: 'india-lohri',
    title: 'Lohri',
    coordinates: [30.9009, 75.8572], // Ludhiana
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-01-13',
    endDate: '2025-01-13',
    verified: true,
    region: 'North India',
    description: 'A bonfire festival in North India marking the end of winter.',
    insights: 'Communities gather around towering bonfires to toss puffed rice and popcorn into the flames as offerings to Agni, the fire god, celebrating the harvested rabi crops.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Lohri_Bonfire.jpg/500px-Lohri_Bonfire.jpg'
  },

  // --- SPECTACLES, FAIRS & PROCESSIONS ---
  {
    id: 'india-kumbh-mela',
    title: 'Kumbh Mela',
    coordinates: [25.4358, 81.8463], // Prayagraj
    ritualType: 'RitualType.PILGRIMAGE',
    startDate: '2025-01-14',
    endDate: '2025-02-26', // Maha Kumbh Mela dates 2025
    verified: true,
    region: 'Prayagraj, India',
    description: 'The world’s largest peaceful gathering of pilgrims at river confluences.',
    insights: 'Occurs every 12 years. Over 100 million pilgrims, including legendary ash-smeared Naga Sadhus, bathe at the Triveni Sangam to cleanse themselves of earthly sins.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Kumbh_Mela_Naga_Sadhus.jpg/960px-Kumbh_Mela_Naga_Sadhus.jpg'
  },
  {
    id: 'india-pushkar-fair',
    title: 'Pushkar Camel Fair',
    coordinates: [26.4886, 74.5509], // Pushkar
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-10-31',
    endDate: '2025-11-05',
    verified: true,
    region: 'Rajasthan, India',
    description: 'A massive livestock fair and cultural fete in the Rajasthan desert.',
    insights: 'Tens of thousands of camels, horses, and cattle are traded in the desert. Features mustache competitions, camel racing, and vibrant Rajasthani folk music.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Pushkar_Camel_Fair.jpg/960px-Pushkar_Camel_Fair.jpg'
  },
  {
    id: 'india-rath-yatra',
    title: 'Rath Yatra',
    coordinates: [19.8134, 85.8312], // Puri
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-06-27',
    endDate: '2025-07-05',
    verified: true,
    region: 'Odisha, India',
    description: 'The "Chariot Festival" in Puri, Odisha, where deities are pulled in massive cars.',
    insights: 'Colossal, 45-foot tall wooden chariots carrying Lord Jagannath are pulled manually by millions of devotees in a visually overpowering street spectacle.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Rath_Yatra_Puri.jpg/960px-Rath_Yatra_Puri.jpg'
  },
  {
    id: 'india-thrissur-pooram',
    title: 'Thrissur Pooram',
    coordinates: [10.5280, 76.2167], // Thrissur
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-05-09',
    endDate: '2025-05-09',
    verified: true,
    region: 'Kerala, India',
    description: 'A grand assembly of caparisoned elephants and percussion in Kerala.',
    insights: 'Dozens of elephants adorned with golden headdresses line up face-to-face while massive orchestras of Chenda drummers create deafening, synchronized beats (Ilanjithara Melam).',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Thrissur_Pooram_Elephants.jpg/960px-Thrissur_Pooram_Elephants.jpg'
  },
  {
    id: 'india-hemis-festival',
    title: 'Hemis Festival',
    coordinates: [33.9168, 77.7018], // Hemis Monastery
    ritualType: 'RitualType.PERFORMANCE',
    startDate: '2025-06-25',
    endDate: '2025-06-26',
    verified: true,
    region: 'Ladakh, India',
    description: 'Cham masked dances by Buddhist monks in Ladakh.',
    insights: 'Monks wearing terrifying masks and flowing silk robes perform sacred Cham dances to crashing cymbals to celebrate Guru Padmasambhava\\'s victory over demons.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Cham_Dance_Hemis.jpg/500px-Cham_Dance_Hemis.jpg'
  },
  {
    id: 'india-hornbill-festival',
    title: 'Hornbill Festival',
    coordinates: [25.6179, 94.1030], // Kohima / Kisama
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-12-01',
    endDate: '2025-12-10',
    verified: true,
    region: 'Nagaland, India',
    description: 'The "Festival of Festivals" showcasing Naga tribal culture.',
    insights: 'Sixteen major warrior tribes of Nagaland convene to showcase their indigenous headhunting dances, spectacular feather headgears, and bamboo stilt walking.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Hornbill_Festival_Dancers.jpg/960px-Hornbill_Festival_Dancers.jpg'
  },
  {
    id: 'india-desert-festival',
    title: 'Desert Festival (Jaisalmer)',
    coordinates: [26.9157, 70.9083], // Jaisalmer
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-02-12',
    endDate: '2025-02-14',
    verified: true,
    region: 'Rajasthan, India',
    description: 'Showcasing Rajasthani folk music, camel races, and turban tying.',
    insights: 'Set against the backdrop of the Sam Sand Dunes, the festival features fire dancers, acrobats, and Mr. Desert body-building competitions on the dunes.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Jaisalmer_Desert_Festival.jpg/960px-Jaisalmer_Desert_Festival.jpg'
  },
  {
    id: 'india-rann-utsav',
    title: 'Rann Utsav',
    coordinates: [23.7337, 69.8597], // Great Rann of Kutch
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-11-01',
    endDate: '2026-02-28',
    verified: true,
    region: 'Gujarat, India',
    description: 'A winter-long celebration on the white salt desert of Kutch.',
    insights: 'A massive tent city is erected on the vast, blindingly white salt flats. Visitors experience Kutchi folk music and stargazing over the endless crystalline plains.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Rann_of_Kutch_White_Desert.jpg/960px-Rann_of_Kutch_White_Desert.jpg'
  },
  {
    id: 'india-tansen-samaroh',
    title: 'Tansen Music Festival',
    coordinates: [26.2183, 78.1828], // Gwalior
    ritualType: 'RitualType.PERFORMANCE',
    startDate: '2025-12-15',
    endDate: '2025-12-20',
    verified: true,
    region: 'Madhya Pradesh, India',
    description: 'A tribute to the legendary musician in Gwalior.',
    insights: 'The oldest and most prestigious Hindustani classical music festival. Maestros perform raags near the intricately carved tomb of Tansen to invoke his enduring spirit.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Tansen_Tomb_Gwalior.jpg/960px-Tansen_Tomb_Gwalior.jpg'
  },
  {
    id: 'india-jallikattu',
    title: 'Jallikattu',
    coordinates: [10.0437, 78.0163], // Madurai
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-01-15',
    endDate: '2025-01-17',
    verified: true,
    region: 'Tamil Nadu, India',
    description: 'A traditional bull-taming event during Pongal in Tamil Nadu.',
    insights: 'A dangerous and highly controversial ancient spectacle where thousands of young men attempt to grab the hump of massive Bos indicus bulls released into a highly crowded arena.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Jallikattu_Madurai.jpg/960px-Jallikattu_Madurai.jpg'
  },

  // --- SPIRITUAL & LOCAL RITUALS ---
  {
    id: 'india-ganga-aarti',
    title: 'Ganga Aarti',
    coordinates: [25.3076, 83.0122], // Dashashwamedh Ghat, Varanasi
    ritualType: 'RitualType.SPIRITUAL',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    verified: true,
    region: 'Varanasi, India',
    description: 'Daily evening fire ritual on the banks of the Ganges in Varanasi and Rishikesh.',
    insights: 'Every night at dusk, priests perform a choreographed, trance-inducing fire ritual involving towering brass lamps, conch shells, and incense to worship the holy river.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ganga_Aarti_Varanasi.jpg/960px-Ganga_Aarti_Varanasi.jpg'
  },
  {
    id: 'india-theyyam',
    title: 'Theyyam',
    coordinates: [11.8745, 75.3704], // Kannur
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-11-01',
    endDate: '2026-05-31',
    verified: true,
    region: 'Kerala, India',
    description: 'A ritual dance-drama from North Kerala where performers "become" deities.',
    insights: 'Performers bearing heavy, 30-foot tall headdresses and intricate red body paint undergo a spiritual trance, running on hot coals as locals consult them as living gods.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Theyyam_Kannur.jpg/960px-Theyyam_Kannur.jpg'
  },
  {
    id: 'india-chhath-puja',
    title: 'Chhath Puja',
    coordinates: [25.5941, 85.1376], // Patna
    ritualType: 'RitualType.SPIRITUAL',
    startDate: '2025-10-26',
    endDate: '2025-10-29',
    verified: true,
    region: 'Bihar & UP, India',
    description: 'Ancient Vedic festival dedicated to the Sun God, primarily in Bihar and UP.',
    insights: 'Millions of women completely fast for 36 hours and stand waist-deep in freezing rivers at dawn and dusk to offer fruit and holy water directly to the sun god, Surya.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Chhath_Puja_River.jpg/960px-Chhath_Puja_River.jpg'
  },
  {
    id: 'india-losar',
    title: 'Losar',
    coordinates: [34.1526, 77.5771], // Leh, Ladakh
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-02-28',
    endDate: '2025-03-02',
    verified: true,
    region: 'Himalayan India',
    description: 'The Tibetan/Himalayan Buddhist New Year.',
    insights: 'Celebrated with the firing of firecrackers to ward off evil and the hoisting of endless colorful prayer flags on snowy peaks to usher in positive karma.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Losar_Festival_Ladakh.jpg/960px-Losar_Festival_Ladakh.jpg'
  },
  {
    id: 'india-sangai-festival',
    title: 'Sangai Festival',
    coordinates: [24.8170, 93.9368], // Imphal
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-11-21',
    endDate: '2025-11-30',
    verified: true,
    region: 'Manipur, India',
    description: 'Cultural extravaganza in Manipur showcasing arts and handloom.',
    insights: 'Named after the endangered brow-antlered deer. It showcases aggressive martial arts (Thang-Ta), classical Manipur dance, and traditional indigenous polo matches.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Sangai_Festival_Manipur.jpg/500px-Sangai_Festival_Manipur.jpg'
  },
  {
    id: 'india-saga-dawa',
    title: 'Saga Dawa',
    coordinates: [27.3314, 88.6138], // Gangtok
    ritualType: 'RitualType.PILGRIMAGE',
    startDate: '2025-06-11',
    endDate: '2025-06-11',
    verified: true,
    region: 'Sikkim, India',
    description: 'Celebrating Buddha\\'s birth, enlightenment, and nirvana in Sikkim.',
    insights: 'Monks carry ancient, heavy holy texts around the city. Participants engage in massive acts of charity, refraining from eating meat or harming any living organism.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Saga_Dawa_Sikkim.jpg/500px-Saga_Dawa_Sikkim.jpg'
  },
  {
    id: 'india-teej',
    title: 'Teej',
    coordinates: [26.9124, 75.7873], // Jaipur
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-08-26',
    endDate: '2025-08-27',
    verified: true,
    region: 'Rajasthan, India',
    description: 'A monsoon festival for women in Rajasthan and Nepal.',
    insights: 'Women dress in bright green saris, apply intricate henna, and swing from tree branches adorned with flowers to celebrate the union of Parvati and Shiva during the monsoon rains.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Teej_Festival_Swing.jpg/960px-Teej_Festival_Swing.jpg'
  },
  {
    id: 'india-bonalu',
    title: 'Bonalu',
    coordinates: [17.3850, 78.4867], // Hyderabad
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-07-20',
    endDate: '2025-08-10',
    verified: true,
    region: 'Telangana, India',
    description: 'A Hindu festival honoring Goddess Mahakali in Hyderabad.',
    insights: 'Women carry heavy brass pots (Bonalu) decorated with neem leaves and turmeric on their heads. Ritual trance dances by "Potharajus" holding whips are fiercely energetic.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Bonalu_Potharaju.jpg/500px-Bonalu_Potharaju.jpg'
  },
  {
    id: 'india-paryushan',
    title: 'Paryushan',
    coordinates: [23.0225, 72.5714], // Gujarat
    ritualType: 'RitualType.SPIRITUAL',
    startDate: '2025-08-19',
    endDate: '2025-08-26',
    verified: true,
    region: 'India (Pan-India Jain community)',
    description: 'The most important annual holy event for Jains for purification and vows.',
    insights: 'Culminates in Samvatsari, the day of immense forgiveness, where millions of Jains utter "Micchami Dukkadam," asking forgiveness from all creatures for any intentional or unintentional harm.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Jain_Temple_Paryushan.jpg/960px-Jain_Temple_Paryushan.jpg'
  },
  {
    id: 'india-urs-ajmer',
    title: 'Urs of Ajmer Sharif',
    coordinates: [26.4499, 74.6399], // Ajmer
    ritualType: 'RitualType.PILGRIMAGE',
    startDate: '2025-12-21',
    endDate: '2025-12-26',
    verified: true,
    region: 'Rajasthan, India',
    description: 'Commemorating the death anniversary of Sufi saint Moinuddin Chishti.',
    insights: 'Millions gather at the Dargah. Sufi musicians known as Qawwals perform ecstatic, soul-stirring Qawwali music through the night in the marble courtyards.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Ajmer_Sharif_Dargah.jpg/960px-Ajmer_Sharif_Dargah.jpg'
  },

  // --- ART, DANCE & NICHE TRADITIONS ---
  {
    id: 'india-khajuraho-dance',
    title: 'Khajuraho Dance Festival',
    coordinates: [24.8318, 79.9199], // Khajuraho
    ritualType: 'RitualType.PERFORMANCE',
    startDate: '2025-02-20',
    endDate: '2025-02-26',
    verified: true,
    region: 'Madhya Pradesh, India',
    description: 'Classical dances performed against the backdrop of ancient temples.',
    insights: 'Features mesmerising Kathak, Bharatanatyam, and Odissi performances lit magnificently against the 10th-century temples renowned for their incredibly detailed erotic sculptures.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Khajuraho_Temple_Dance.jpg/960px-Khajuraho_Temple_Dance.jpg'
  },
  {
    id: 'india-mamallapuram-dance',
    title: 'Mamallapuram Indian Dance Festival',
    coordinates: [12.6208, 80.1945], // Mamallapuram
    ritualType: 'RitualType.PERFORMANCE',
    startDate: '2025-01-20',
    endDate: '2025-02-20',
    verified: true,
    region: 'Tamil Nadu, India',
    description: 'Folk and classical dance by the sea in Tamil Nadu.',
    insights: 'Set before Arjuna\\'s Penance, a massive monolithic rock carving facing the roaring Bay of Bengal, presenting an open-air spectacle of classical Indian dance.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Mahabalipuram_Shore_Temple.jpg/960px-Mahabalipuram_Shore_Temple.jpg'
  },
  {
    id: 'india-wangala',
    title: 'Wangala Festival',
    coordinates: [25.5146, 90.2036], // Tura, Meghalaya
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-11-07',
    endDate: '2025-11-09',
    verified: true,
    region: 'Meghalaya, India',
    description: 'The "100 Drums Festival" of the Garo tribe in Meghalaya.',
    insights: 'A post-harvest festival where 300 male drummers simultaneously beat massive elongated drums, creating a rhythmic thunder echoing across the fog-covered hills.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Wangala_Drums.jpg/960px-Wangala_Drums.jpg'
  },
  {
    id: 'india-sonepur-mela',
    title: 'Sonepur Mela',
    coordinates: [25.6983, 85.1764], // Sonepur
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-11-04',
    endDate: '2025-12-04',
    verified: true,
    region: 'Bihar, India',
    description: 'One of Asia\\'s largest cattle fairs held at the confluence of Ganges and Gandak.',
    insights: 'Historically the market where emperors bought their war elephants. Today, it remains a sprawling bazaar for horses, livestock, and a massive cultural fair running for a month.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Sonepur_Cattle_Fair.jpg/960px-Sonepur_Cattle_Fair.jpg'
  },
  {
    id: 'india-bali-jatra',
    title: 'Bali Jatra',
    coordinates: [20.4625, 85.8828], // Cuttack
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-11-05',
    endDate: '2025-11-12',
    verified: true,
    region: 'Odisha, India',
    description: 'Commemorating ancient maritime trade links between Odisha and Bali.',
    insights: 'Asia\\'s largest open-air trade fair. Devotees sail miniature boats made of banana stems and paper lit with lamps down the Mahanadi river at dawn to honor ancient sailors.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Bali_Jatra_Boats.jpg/500px-Bali_Jatra_Boats.jpg'
  },
  {
    id: 'india-ziro-festival',
    title: 'Ziro Festival of Music',
    coordinates: [27.5383, 93.8441], // Ziro Valley
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-09-25',
    endDate: '2025-09-28',
    verified: true,
    region: 'Arunachal Pradesh, India',
    description: 'An outdoor music festival in the valleys of Arunachal Pradesh.',
    insights: 'Hosted by the local Apatani tribe. The stages and entire infrastructure are built using locally sourced bamboo, making it one of the most eco-friendly music festivals in the world.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Ziro_Valley.jpg/960px-Ziro_Valley.jpg'
  },
  {
    id: 'india-goa-carnival',
    title: 'Goa Carnival',
    coordinates: [15.4909, 73.8278], // Panaji
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-03-01',
    endDate: '2025-03-04',
    verified: true,
    region: 'Goa, India',
    description: 'A legacy of Portuguese rule featuring floats, music, and dancing.',
    insights: 'Led by King Momo, who proclaims the decree to "eat, drink, and make merry." Three days of massive Latin-inspired parades, mask balls, and continuous street dancing before Lent.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Goa_Carnival_Float.jpg/960px-Goa_Carnival_Float.jpg'
  },
  {
    id: 'india-bathukamma',
    title: 'Bathukamma',
    coordinates: [17.3850, 78.4867], // Hyderabad
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-09-22',
    endDate: '2025-09-30',
    verified: true,
    region: 'Telangana, India',
    description: 'A vibrant flower festival celebrated by the women of Telangana.',
    insights: 'Women stack seasonal flowers into stunning concentric layers resembling temple gopurams. They sing folk songs in circles around the floral structures before floating them in lakes.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Bathukamma_Festival.jpg/500px-Bathukamma_Festival.jpg'
  },
  {
    id: 'india-kala-ghoda',
    title: 'Kala Ghoda Arts Festival',
    coordinates: [18.9288, 72.8335], // Mumbai
    ritualType: 'RitualType.FESTIVAL',
    startDate: '2025-02-01',
    endDate: '2025-02-09',
    verified: true,
    region: 'Maharashtra, India',
    description: 'A massive multicultural street festival in Mumbai.',
    insights: 'The entire heritage district of South Mumbai is pedestrianized and filled with massive contemporary art installations, street plays, and artisan stalls.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Kala_Ghoda_Installations.jpg/960px-Kala_Ghoda_Installations.jpg'
  },
  {
    id: 'india-attukal-pongala',
    title: 'Attukal Pongala',
    coordinates: [8.4834, 76.9493], // Trivandrum
    ritualType: 'RitualType.CEREMONY',
    startDate: '2025-02-13',
    endDate: '2025-02-13',
    verified: true,
    region: 'Kerala, India',
    description: 'The world\\'s largest gathering of women for a religious activity in Kerala.',
    insights: 'Over 2.5 million women line the streets spreading out over 5 kilometers, setting up individual brick hearths to simultaneously boil rice and jaggery as an offering to Goddess Bhadrakali.',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Attukal_Pongala_Women.jpg/960px-Attukal_Pongala_Women.jpg'
  }
];

let tsContent = items.map(item => \`  {
    id: '\${item.id}',
    title: '\${item.title.replace(/'/g, "\\'")}',
    coordinates: [\${item.coordinates[0]}, \${item.coordinates[1]}],
    ritualType: \${item.ritualType},
    startDate: '\${item.startDate}',
    endDate: '\${item.endDate}',
    verified: \${item.verified},
    region: '\${item.region.replace(/'/g, "\\'")}',
    description: '\${item.description.replace(/'/g, "\\'")}',
    insights: '\${item.insights.replace(/'/g, "\\'")}',
    imageUrl: '\${item.imageUrl}',
    mediaLinks: {}
  }\`).join(',\\n');

tsContent = ',\\n  // --- INDIA & SUBCONTINENT FESTIVALS --- \\n' + tsContent + '\\n];\\n';

let code = fs.readFileSync('mockData.ts', 'utf8');
code = code.replace(/\\n\\];\\s*$/, tsContent);
fs.writeFileSync('mockData.ts', code);
console.log('Successfully appended ' + items.length + ' Indian events!');
