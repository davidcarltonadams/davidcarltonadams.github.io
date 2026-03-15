// works-data.js — David Carlton Adams complete works catalogue
// Update links (score/audio/video) as they become available.
// highlighted: true marks major works for featured display.

const WORKS = [
  {
    id: "drownin-in-it",
    title: "Drownin' in it",
    year: 2026,
    duration: "30'",
    instrumentation: "Voices, viola, microtonal electric guitars, synthesizers, fretless bass, drums, electronics",
    forces: ["vocal", "electronics", "interdisciplinary"],
    premiere: {
      date: "2026-04-26",
      date_display: "April 26, 2026",
      performers: "John Jansen, Zach Lloyd, Aidan Walsh-King, Jude Botten, Wesley Catherine Hamilton, Elisheva Pront, David Carlton Adams",
      venue: "Le Mondo, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Le Mondo Spring 2026 residency centerpiece.",
    highlighted: true
  },
  {
    id: "murmuration-and-fugue",
    title: "Murmuration and Fugue",
    year: 2026,
    duration: "5'",
    instrumentation: "Flute, alto saxophone, cello",
    forces: ["chamber"],
    premiere: {
      date: "2026-03-23",
      date_display: "March 23, 2026",
      performers: "tacet(i) ensemble",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "kaleidoscope",
    title: "Kaleidoscope",
    year: 2026,
    duration: "~50'",
    instrumentation: "Fixed media, live electronics, spoken word, choreographed dancers",
    forces: ["electronics", "interdisciplinary"],
    premiere: {
      date: "2026-02-22",
      date_display: "February 22, 2026",
      performers: "Zoë Brielle Payne, ZBRI Dance Company, David Carlton Adams",
      venue: "Le Mondo, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Collaboration with Zoë Brielle Payne / ZBRI Dance Company.",
    highlighted: true
  },
  {
    id: "meditations-and-motivations",
    title: "Meditations and Motivations (full program)",
    year: 2026,
    duration: "~40'",
    instrumentation: "Violin, cello, soprano, baritone, electric guitar, electronics",
    forces: ["vocal", "electronics", "chamber"],
    premiere: {
      date: "2026-01-28",
      date_display: "January 28, 2026",
      performers: "Wesley Hamilton, Robert Karpay, Elisheva Pront, David Carlton Adams",
      venue: "Le Mondo, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "thinking-out-loud",
    title: "Thinking Out Loud",
    year: 2024,
    duration: "~7'",
    instrumentation: "Sinfonietta (15 musicians)",
    forces: ["large ensemble"],
    premiere: {
      date: "2024-04-23",
      date_display: "April 23, 2024",
      performers: "Old Bay New Music Ensemble",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: true
  },
  {
    id: "words-from-a-friend",

    title: "words (from a friend)",
    year: 2024,
    duration: "~6'30\"",
    instrumentation: "Violin, cello, singing fretless electric guitarist",
    forces: ["chamber", "vocal"],
    premiere: {
      date: "2024-07-12",
      date_display: "July 12, 2024",
      performers: "Kevin Rogers, Doug Machiz, David Carlton Adams",
      venue: "Walden School, Dublin, NH"
    },
    links: { score: "https://www.davidcarltonadams.com/s/Adams-words-from-a-friend-2025-11-17-22-52.pdf", audio: "", video: "" },
    notes: "Multiple performances.",
    highlighted: false
  },
  {
    id: "the-sum-of-its-parts",
    title: "the sum of its parts",
    year: 2024,
    duration: "~10'",
    instrumentation: "Prepared cello, solo",
    forces: ["solo"],
    premiere: {
      date: "2024-05-09",
      date_display: "May 9, 2024",
      performers: "Johannes Burghoff",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "play-nice",
    title: "Play Nice",
    year: 2023,
    duration: "~10'",
    instrumentation: "Flutes, tenor saxophone, percussion, electronics",
    forces: ["chamber", "electronics"],
    premiere: {
      date: "2023-06-28",
      date_display: "June 28, 2023",
      performers: "Wet Ink Ensemble (Erin Lesser, Alex Mincek, Ian Antonio, Sam Pluta, David Carlton Adams)",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "https://www.davidcarltonadams.com/s/David-Carlton-Adams-Play-Nice-2023-score-p9k4.pdf", audio: "https://soundcloud.com/davidcarltonadams/play-nice/s-jiAXF6YLleI", video: "" },
    notes: "Performed by Wet Ink Ensemble.",
    highlighted: true
  },
  {
    id: "emergent-1-2",
    title: "emergent 1.2",
    year: 2023,
    duration: "~17'",
    instrumentation: "Solo vocals, electric guitar, pedals, amplifiers, PA speaker",
    forces: ["solo", "electronics", "vocal"],
    premiere: {
      date: "2023-06-25",
      date_display: "June 25, 2023",
      performers: "David Carlton Adams",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "launch",
    title: "Launch",
    year: 2023,
    duration: "~8'",
    instrumentation: "Sample-based live electronics",
    forces: ["solo", "electronics"],
    premiere: {
      date: "2023-06-01",
      date_display: "June 1, 2023",
      performers: "David Carlton Adams",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "emergent-1-0",
    title: "emergent 1.0",
    year: 2023,
    duration: "~15'30\"",
    instrumentation: "Solo vocals, electric guitar, pedals, amplifiers",
    forces: ["solo", "electronics", "vocal"],
    premiere: {
      date: "2023-04-29",
      date_display: "April 29, 2023",
      performers: "David Carlton Adams",
      venue: "MICA, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "emergent-0-1",
    title: "emergent 0.1",
    year: 2023,
    duration: "~12'",
    instrumentation: "Solo vocals, electric guitar, pedals, amplifiers",
    forces: ["solo", "electronics", "vocal"],
    premiere: {
      date: "2023-04-07",
      date_display: "April 7, 2023",
      performers: "David Carlton Adams",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "what-did-it-feel-like-2023",
    title: "what did it feel like",
    year: 2023,
    duration: "~4'",
    instrumentation: "Soprano, violin",
    forces: ["chamber", "vocal"],
    premiere: {
      date: "2023-03-15",
      date_display: "March 15, 2023",
      performers: "Hayley Camp, Elisheva Pront",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Live premiere of work first composed in 2020.",
    highlighted: false
  },
  {
    id: "tarantula-nebula",
    title: "Tarantula Nebula",
    year: 2023,
    duration: "~8'",
    instrumentation: "Soprano, mezzo-soprano",
    forces: ["vocal"],
    premiere: {
      date: "2023-03-04",
      date_display: "March 4, 2023",
      performers: "Cynthia Hu, Rachel Steelman",
      venue: "Johns Hopkins University, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "electric-46",
    title: "Electric 46",
    year: 2023,
    duration: "~10'",
    instrumentation: "Two hammer dulcimers with pedals",
    forces: ["chamber"],
    premiere: {
      date: "2023-02-17",
      date_display: "February 17, 2023",
      performers: "David Carlton Adams, Cameron Church",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Co-composed with Cameron Church.",
    highlighted: false
  },
  {
    id: "break-on-through",
    title: "Break On Through",
    year: 2022,
    duration: "8'",
    instrumentation: "Flute, bassoon, prepared cello",
    forces: ["chamber"],
    premiere: {
      date: "2026-04-26",
      date_display: "April 26, 2026",
      performers: "Jack King, Soumili Mukherjee, Robert Karpay",
      venue: "Le Mondo, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Written for Dal Niente.",
    highlighted: false
  },
  {
    id: "communication-is-hard",
    title: "communication is hard for two performers, probably percussionists",
    year: 2022,
    duration: "~5'",
    instrumentation: "Two percussionists",
    forces: ["chamber", "percussion"],
    premiere: {
      date: "2022-10-12",
      date_display: "October 12, 2022",
      performers: "Cameron Church, Sebastian Suarez-Solis",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Multiple versions.",
    highlighted: false
  },
  {
    id: "for-filene",
    title: "for Filene",
    year: 2022,
    duration: "~8'30\"",
    instrumentation: "Percussion quartet",
    forces: ["chamber", "percussion"],
    premiere: {
      date: "2022-07-23",
      date_display: "July 23, 2022",
      performers: "Alexander Braud, Adams Clifton, Liz Fetzer, Graham Viegut",
      venue: "Princeton University, Princeton, NJ"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "do-for-mik",
    title: "\"do\" for Mik",
    year: 2022,
    duration: "~1'",
    instrumentation: "Piano",
    forces: ["solo"],
    premiere: {
      date: "2022-06-18",
      date_display: "June 18, 2022",
      performers: "Mikaela Livadiotis",
      venue: "Lake Dunmore, VT"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "inochi-for-kai",
    title: "\"inochi\" for Kai",
    year: 2022,
    duration: "~1'",
    instrumentation: "Solo clarinet",
    forces: ["solo"],
    premiere: {
      date: "2022-06-18",
      date_display: "June 18, 2022",
      performers: "Kaichi Hirayama",
      venue: "Lake Dunmore, VT"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "three-or-four-of-many",
    title: "three or four (of many)",
    year: 2022,
    duration: "~9'30\"",
    instrumentation: "String quartet",
    forces: ["chamber"],
    premiere: {
      date: "2022-06-08",
      date_display: "June 8, 2022",
      performers: "JACK Quartet (Chris Otto, Austin Wulliman, John Richards, Jay Campbell)",
      venue: "Lake Dunmore, VT"
    },
    links: { score: "", audio: "https://soundcloud.com/davidcarltonadams/three-or-four-of-many", video: "" },
    notes: "Performed by JACK Quartet.",
    highlighted: true
  },
  {
    id: "738-meet-julia",
    title: "738: meet Julia",
    year: 2022,
    duration: "~4'30\"",
    instrumentation: "Soprano, piano",
    forces: ["vocal", "chamber"],
    premiere: {
      date: "2022-04-29",
      date_display: "April 29, 2022",
      performers: "Tzu-Jung Wang, Hui-Chuan Chen",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Operatic fragment.",
    highlighted: false
  },
  {
    id: "tear",
    title: "Tear",
    year: 2022,
    duration: "~9'30\"",
    instrumentation: "Flute, viola, harp",
    forces: ["chamber"],
    premiere: {
      date: "2022-04-28",
      date_display: "April 28, 2022",
      performers: "Elma Meijer, Michelle Pritchard, Sabien Canton",
      venue: "Netherlands"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "fate-unfolding",
    title: "fate (unfolding)",
    year: 2022,
    duration: "~5'",
    instrumentation: "Solo cello",
    forces: ["solo"],
    premiere: {
      date: "2022-03-05",
      date_display: "March 5, 2022",
      performers: "Julia Kostraba",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Co-composed with Heng Lin and Soyoona Kim.",
    highlighted: false
  },
  {
    id: "in-the-rain",
    title: "in the Rain",
    year: 2022,
    duration: "~8'",
    instrumentation: "Laptop trio",
    forces: ["electronics"],
    premiere: {
      date: "2022-02-01",
      date_display: "February 1, 2022",
      performers: "David Carlton Adams, Cameron Church, Mary Price",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "anxiety-and-discovery",
    title: "Anxiety and Discovery",
    year: 2021,
    duration: "~5'",
    instrumentation: "Electric guitars, effects",
    forces: ["chamber", "electronics"],
    premiere: {
      date: "2021-12-03",
      date_display: "December 3, 2021",
      performers: "David Carlton Adams, Mike Begay, Sam Kohler",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "on-the-thin-ice",
    title: "On the Thin Ice of Modern Life",
    year: 2021,
    duration: "~10'",
    instrumentation: "Flutes, clarinets, cello",
    forces: ["chamber"],
    premiere: {
      date: "2021-10-30",
      date_display: "October 30, 2021",
      performers: "Talea Ensemble (Barry Crawford, Rane Moore, Chris Gross)",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Performed by Talea Ensemble.",
    highlighted: false
  },
  {
    id: "follow-the-sines",
    title: "Follow the Sines",
    year: 2021,
    duration: "~8'",
    instrumentation: "Laptop ensemble",
    forces: ["electronics"],
    premiere: {
      date: "2021-10-19",
      date_display: "October 19, 2021",
      performers: "Peabody Laptop Orchestra",
      venue: "Peabody Institute, Baltimore, MD"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Co-composed with Derrick Peng and Haoran Li.",
    highlighted: false
  },
  {
    id: "annunciation",
    title: "annunciation (two operatic scenes)",
    year: 2021,
    duration: "~16'",
    instrumentation: "Soprano, baritone, chorus, chamber ensemble, electronics",
    forces: ["vocal", "chamber", "electronics", "interdisciplinary"],
    premiere: {
      date: "2021-10-08",
      date_display: "October 8, 2021",
      performers: "Multiple performers (12 total)",
      venue: "Hybrid performance (recorded and live)"
    },
    links: { score: "", audio: "https://soundcloud.com/davidcarltonadams/sets/annunciation-2-scenes", video: "" },
    notes: "",
    highlighted: true
  },
  {
    id: "a-visit-from-the-warmth",
    title: "a visit from the warmth",
    year: 2021,
    duration: "~8'30\"",
    instrumentation: "String quartet, electronics",
    forces: ["chamber", "electronics"],
    premiere: {
      date: "2021-07-28",
      date_display: "July 28, 2021",
      performers: "Christabel Lin, Karli Leal, Shawn Sanders",
      venue: "YouTube"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "thickening",
    title: "thickening",
    year: 2021,
    duration: "~6'",
    instrumentation: "Telematic laptop ensemble",
    forces: ["electronics"],
    premiere: {
      date: "2021-03-15",
      date_display: "March 15, 2021",
      performers: "Peabody Laptop Orchestra",
      venue: "Zoom"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "when-it-came",
    title: "when it came…",
    year: 2020,
    duration: "~3'",
    instrumentation: "SSMz, chamber ensemble",
    forces: ["vocal", "chamber", "electronics"],
    premiere: {
      date: "2020-12-17",
      date_display: "December 17, 2020",
      performers: "Multiple performers (12 total)",
      venue: "Zoom"
    },
    links: { score: "", audio: "https://soundcloud.com/davidcarltonadams/adams-when-it/s-lSejxPX0kak", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "what-was",
    title: "what was…",
    year: 2020,
    duration: "~2'30\"",
    instrumentation: "SSMz, chamber ensemble",
    forces: ["vocal", "chamber", "electronics"],
    premiere: {
      date: "2020-12-17",
      date_display: "December 17, 2020",
      performers: "Multiple performers (10 total)",
      venue: "Zoom"
    },
    links: { score: "", audio: "https://soundcloud.com/davidcarltonadams/t3w-what-was", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "what-did-it-feel-like-2020",
    title: "what did it feel like",
    year: 2020,
    duration: "~2'30\"",
    instrumentation: "Violin, soprano",
    forces: ["vocal", "chamber"],
    premiere: {
      date: "2020-12-17",
      date_display: "December 17, 2020",
      performers: "Emma Rocheleau, Hayley Camp",
      venue: "Zoom"
    },
    links: { score: "", audio: "https://soundcloud.com/davidcarltonadams/adams-what-did", video: "" },
    notes: "Live premiere 2023 (see separate entry).",
    highlighted: false
  },
  {
    id: "loneliness-is-a-wasp-gall",
    title: "loneliness (is a wasp gall)",
    year: 2020,
    duration: "~3'30\"",
    instrumentation: "Soprano, chamber ensemble",
    forces: ["vocal", "chamber"],
    premiere: {
      date: "2020-12-17",
      date_display: "December 17, 2020",
      performers: "Sierra Leslie, Ashton Sady, Chih-Chun Wang, Ting-An Wei, Kyle Victor",
      venue: "Zoom"
    },
    links: { score: "", audio: "https://soundcloud.com/davidcarltonadams/adams-loneliness-aria", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "who-are-you",
    title: "who are you",
    year: 2020,
    duration: "~2'",
    instrumentation: "Two sopranos, electronics",
    forces: ["vocal", "electronics"],
    premiere: {
      date: "2020-11-10",
      date_display: "November 10, 2020",
      performers: "Marina Bien-Aimé, Erica D'Ancona",
      venue: "Zoom"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "the-same-day",
    title: "the same day…",
    year: 2020,
    duration: "~4'",
    instrumentation: "Mezzo-soprano, piano",
    forces: ["vocal"],
    premiere: {
      date: "2020-10-13",
      date_display: "October 13, 2020",
      performers: "Gayssie Lugo, David Carlton Adams",
      venue: "Zoom"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "i-have-always-wanted",
    title: "i have always wanted",
    year: 2020,
    duration: "~1'",
    instrumentation: "Soprano, bass clarinet, djembe",
    forces: ["vocal"],
    premiere: {
      date: "2020-06-28",
      date_display: "June 28, 2020",
      performers: "Sputterbox",
      venue: "Instagram"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "american-dances",
    title: "American Dances",
    year: 2018,
    duration: "~12'",
    instrumentation: "Saxophone quartet",
    forces: ["chamber"],
    premiere: {
      date: "2020-01-17",
      date_display: "January 17, 2020",
      performers: "Jamaica Plain Saxophone Quartet",
      venue: "Boston, MA"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Composed 2018; multiple performances.",
    highlighted: false
  },
  {
    id: "concerto-for-horn",
    title: "Concerto for Horn and Chamber Orchestra",
    year: 2018,
    duration: "~39'",
    instrumentation: "Horn, chamber orchestra (24 musicians)",
    forces: ["large ensemble"],
    premiere: {
      date: "2018-10-28",
      date_display: "October 28, 2018",
      performers: "Michael Mikulka with Density512",
      venue: "Bates Recital Hall, University of Texas, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: true
  },
  {
    id: "paytons-tune",
    title: "Payton's tune",
    year: 2018,
    duration: "~2'30\"",
    instrumentation: "Easy violin, piano",
    forces: ["chamber"],
    premiere: {
      date: "2018-05-24",
      date_display: "May 24, 2018",
      performers: "Payton Williams, David Carlton Adams",
      venue: "International School of Texas, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "getting-along",
    title: "Getting along",
    year: 2018,
    duration: "~3'",
    instrumentation: "Easy violin, piano",
    forces: ["chamber"],
    premiere: {
      date: "2018-05-24",
      date_display: "May 24, 2018",
      performers: "Avery and Chase Anson",
      venue: "International School of Texas, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "5-mystic-songs",
    title: "5 Mystic Songs",
    year: 2016,
    duration: "~13'",
    instrumentation: "Voice, string quartet",
    forces: ["vocal", "chamber"],
    premiere: {
      date: "2016-11-18",
      date_display: "November 18, 2016",
      performers: "One Ounce Opera with Angela Irving",
      venue: "Central Presbyterian Church, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "songs-of-love-and-loss",
    title: "Songs of Love and Loss",
    year: 2014,
    duration: "~6–7'",
    instrumentation: "Voice, piano",
    forces: ["vocal"],
    premiere: {
      date: "2014-04-26",
      date_display: "April 26, 2014",
      performers: "Multiple performers",
      venue: "Various venues"
    },
    links: { score: "", audio: "", video: "" },
    notes: "Multiple versions and performances.",
    highlighted: false
  },
  {
    id: "a-silver-lining",
    title: "A Silver Lining",
    year: 2014,
    duration: "~17'",
    instrumentation: "Violin, piano",
    forces: ["chamber"],
    premiere: {
      date: "2014-04-26",
      date_display: "April 26, 2014",
      performers: "Helen Bravenec, Bob Lewis",
      venue: "University of Texas, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "wail",
    title: "Wail",
    year: 2013,
    duration: "~5'30\"",
    instrumentation: "Trumpet, electronics, dancers",
    forces: ["solo", "electronics", "interdisciplinary"],
    premiere: {
      date: "2013-05-03",
      date_display: "May 3–4, 2013",
      performers: "Jarred Broussard; choreography by Audrey Halm",
      venue: "University of Texas, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "courante-pavanabande",
    title: "Courante & Pavanabande",
    year: 2013,
    duration: "~10'",
    instrumentation: "String quartet",
    forces: ["chamber"],
    premiere: {
      date: "2011-05-30",
      date_display: "May 30, 2011",
      performers: "ACC pickup quartet",
      venue: "Austin Community College, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "From Suite of Dances; revised 2013.",
    highlighted: false
  },
  {
    id: "courante",
    title: "Courante",
    year: 2013,
    duration: "~3'",
    instrumentation: "String quartet",
    forces: ["chamber"],
    premiere: {
      date: "2010-12-10",
      date_display: "December 10, 2010",
      performers: "ACC pickup quartet",
      venue: "Austin Community College, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "From Suite of Dances; revised 2013.",
    highlighted: false
  },
  {
    id: "3-garden-songs",
    title: "3 Garden Songs",
    year: 2010,
    duration: "~10'30\"",
    instrumentation: "Voice, piano",
    forces: ["vocal"],
    premiere: {
      date: "2010-12-10",
      date_display: "December 10, 2010",
      performers: "David Carlton Adams, Louise Avant",
      venue: "Austin Community College, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "incidental-music-madrigal",
    title: "Incidental music for a madrigal dinner",
    year: 2010,
    duration: "~5'",
    instrumentation: "Trombone quartet",
    forces: ["chamber"],
    premiere: {
      date: "2010-12-03",
      date_display: "December 3–4, 2010",
      performers: "Steven Sodders Trombone Quartet",
      venue: "Austin Community College, Austin, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  },
  {
    id: "elegiac-exercise",
    title: "Elegiac Exercise",
    year: 2008,
    duration: "~3'",
    instrumentation: "String ensemble",
    forces: ["chamber"],
    premiere: {
      date: "2008-06-13",
      date_display: "June 13, 2008",
      performers: "Marian Anderson String Quartet student ensemble",
      venue: "Bryan, TX"
    },
    links: { score: "", audio: "", video: "" },
    notes: "",
    highlighted: false
  }
];

// Force category display labels
const FORCE_LABELS = {
  solo: "Solo",
  chamber: "Chamber",
  "large ensemble": "Large Ensemble",
  electronics: "Electronics",
  vocal: "Vocal",
  percussion: "Percussion",
  interdisciplinary: "Interdisciplinary"
};

// All available force categories in display order
const FORCE_CATEGORIES = ["solo", "chamber", "large ensemble", "electronics", "vocal", "percussion", "interdisciplinary"];
