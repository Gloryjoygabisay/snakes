import Phaser from 'phaser';

export interface GameController { destroy(): void; }

const CELL_SIZE = 20;
const COLS = 32;
const ROWS = 24;
const CANVAS_W = COLS * CELL_SIZE;
const CANVAS_H = ROWS * CELL_SIZE;
const FOOD_COUNT = 3;
const BASE_TICK_MS = 150;
const SPEED_BOOST_TICK_MS = 80;

// Human player color (set by createGame options, persists for all rounds)
let humanBodyColor = 0xe74c3c;
let humanHeadColor = 0xff6b6b;

type Direction = 'RIGHT' | 'LEFT' | 'UP' | 'DOWN';
interface Point { x: number; y: number; }

const OPPOSITE: Record<Direction, Direction> = { RIGHT: 'LEFT', LEFT: 'RIGHT', UP: 'DOWN', DOWN: 'UP' };
const DELTA: Record<Direction, Point> = {
  RIGHT: { x: 1, y: 0 }, LEFT: { x: -1, y: 0 }, UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }
};

const LEFT_OF: Record<Direction, Direction> = { RIGHT: 'UP', UP: 'LEFT', LEFT: 'DOWN', DOWN: 'RIGHT' };
const RIGHT_OF: Record<Direction, Direction> = { RIGHT: 'DOWN', DOWN: 'LEFT', LEFT: 'UP', UP: 'RIGHT' };

type PowerUpKind = 'speed' | 'shield' | 'none';
interface ActivePowerUp { kind: PowerUpKind; msRemaining: number; }

type FoodKind = 'apple' | 'speed' | 'shield' | 'skull' | 'star';
interface Food { x: number; y: number; kind: FoodKind; }

interface SnakeState {
  id: number;
  name: string;
  body: Point[];
  direction: Direction;
  nextDirection: Direction;
  alive: boolean;
  score: number;
  bodyColor: number;
  headColor: number;
  isHuman: boolean;
  powerUp: ActivePowerUp;
  stunnedMs: number;
  scoreElId: string;
}

interface Challenge {
  question: string;
  choices: string[];
  correct: number;
}

const CHALLENGES: Challenge[] = [
  // ── MATH (50) ──────────────────────────────────────────────────────────
  { question: 'What is 8 × 9?', choices: ['63', '72', '81', '64'], correct: 1 },
  { question: 'What is the square root of 144?', choices: ['11', '12', '13', '14'], correct: 1 },
  { question: 'How many minutes are in 2.5 hours?', choices: ['120', '135', '150', '160'], correct: 2 },
  { question: 'What is 15% of 200?', choices: ['25', '30', '35', '40'], correct: 1 },
  { question: 'What comes next: 2, 4, 8, 16, ___?', choices: ['24', '32', '30', '28'], correct: 1 },
  { question: 'TRUE or FALSE: A square is always a rectangle.', choices: ['TRUE', 'FALSE'], correct: 0 },
  { question: 'TRUE or FALSE: All rectangles are squares.', choices: ['TRUE', 'FALSE'], correct: 1 },
  { question: 'Is 37 a prime number?', choices: ['Yes', 'No'], correct: 0 },
  { question: 'What is 25% of 80?', choices: ['15', '20', '25', '30'], correct: 1 },
  { question: 'What is 7²?', choices: ['42', '49', '56', '64'], correct: 1 },
  { question: 'What is 100 ÷ 4?', choices: ['20', '25', '30', '40'], correct: 1 },
  { question: 'How many sides does an octagon have?', choices: ['6', '7', '8', '9'], correct: 2 },
  { question: 'What is 3³?', choices: ['9', '18', '27', '36'], correct: 2 },
  { question: 'What is the perimeter of a square with side 5?', choices: ['15', '20', '25', '30'], correct: 1 },
  { question: 'What is 0.5 × 0.5?', choices: ['0.1', '0.25', '0.5', '1.0'], correct: 1 },
  { question: 'What is 1000 − 375?', choices: ['525', '625', '725', '825'], correct: 1 },
  { question: 'What is the area of a rectangle 8 × 5?', choices: ['30', '35', '40', '45'], correct: 2 },
  { question: 'What is 12 × 12?', choices: ['132', '144', '156', '168'], correct: 1 },
  { question: 'What is 2/5 as a decimal?', choices: ['0.2', '0.4', '0.5', '0.6'], correct: 1 },
  { question: 'What is the next prime number after 7?', choices: ['9', '11', '13', '15'], correct: 1 },
  { question: 'How many degrees in a right angle?', choices: ['45', '90', '120', '180'], correct: 1 },
  { question: 'What is 5! (5 factorial)?', choices: ['60', '100', '120', '150'], correct: 2 },
  { question: 'What is the LCM of 4 and 6?', choices: ['8', '12', '16', '24'], correct: 1 },
  { question: 'What is 20% of 150?', choices: ['25', '30', '35', '40'], correct: 1 },
  { question: 'How many centimetres in 1 metre?', choices: ['10', '100', '1000', '10000'], correct: 1 },
  { question: 'What is −3 + 7?', choices: ['3', '4', '5', '10'], correct: 1 },
  { question: 'What is the sum of angles in a triangle?', choices: ['90°', '180°', '270°', '360°'], correct: 1 },
  { question: 'What is 144 ÷ 12?', choices: ['10', '11', '12', '13'], correct: 2 },
  { question: 'If x + 5 = 12, what is x?', choices: ['5', '6', '7', '8'], correct: 2 },
  { question: 'What is √81?', choices: ['7', '8', '9', '10'], correct: 2 },
  { question: 'How many zeros are in one million?', choices: ['4', '5', '6', '7'], correct: 2 },
  { question: 'What is 3/4 + 1/4?', choices: ['1/2', '3/4', '1', '5/4'], correct: 2 },
  { question: 'What is 50% of 90?', choices: ['40', '45', '50', '55'], correct: 1 },
  { question: 'What is the median of [3, 5, 7, 9, 11]?', choices: ['5', '7', '9', '11'], correct: 1 },
  { question: 'How many faces does a cube have?', choices: ['4', '6', '8', '12'], correct: 1 },
  { question: 'What is 2¹⁰?', choices: ['512', '1000', '1024', '2048'], correct: 2 },
  { question: 'What is 7 × 8?', choices: ['48', '54', '56', '64'], correct: 2 },
  { question: 'What is π rounded to 2 decimal places?', choices: ['3.12', '3.14', '3.16', '3.18'], correct: 1 },
  { question: 'What is 17 + 28?', choices: ['43', '45', '47', '49'], correct: 1 },
  { question: 'What is 5/8 of 40?', choices: ['20', '25', '30', '35'], correct: 1 },
  { question: 'How many millimetres in 1 centimetre?', choices: ['5', '10', '15', '20'], correct: 1 },
  { question: 'What is the GCF of 12 and 18?', choices: ['3', '6', '9', '12'], correct: 1 },
  { question: 'What is 75% of 200?', choices: ['125', '150', '175', '200'], correct: 1 },
  { question: 'What is the circumference formula of a circle?', choices: ['2πr', 'πr²', 'πd/2', '4πr'], correct: 0 },
  { question: 'What is 8 + 13 × 2?', choices: ['34', '42', '38', '26'], correct: 0 },
  { question: 'How many sides are in 3 pentagons combined?', choices: ['10', '12', '15', '18'], correct: 2 },
  { question: 'What is 0.1 + 0.2?', choices: ['0.2', '0.3', '0.4', '0.5'], correct: 1 },
  { question: 'What is 4² + 3²?', choices: ['18', '25', '30', '35'], correct: 1 },
  { question: 'TRUE or FALSE: Every even number is divisible by 2.', choices: ['TRUE', 'FALSE'], correct: 0 },
  { question: 'What is 1000 ÷ 8?', choices: ['100', '115', '125', '150'], correct: 2 },

  // ── SCIENCE (50) ───────────────────────────────────────────────────────
  { question: 'What planet is closest to the Sun?', choices: ['Venus', 'Mercury', 'Mars', 'Earth'], correct: 1 },
  { question: 'What gas do plants absorb during photosynthesis?', choices: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Hydrogen'], correct: 1 },
  { question: 'What is the chemical symbol for water?', choices: ['HO', 'H₂O', 'H₃O', 'OH'], correct: 1 },
  { question: 'How many bones are in the adult human body?', choices: ['196', '206', '216', '226'], correct: 1 },
  { question: 'What is the approximate speed of light?', choices: ['300,000 km/s', '150,000 km/s', '450,000 km/s', '600,000 km/s'], correct: 0 },
  { question: 'What gas do humans exhale?', choices: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Argon'], correct: 2 },
  { question: 'What is the powerhouse of the cell?', choices: ['Nucleus', 'Ribosome', 'Mitochondria', 'Vacuole'], correct: 2 },
  { question: 'Which planet currently has the most known moons?', choices: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], correct: 1 },
  { question: 'What is the atomic number of carbon?', choices: ['4', '6', '8', '12'], correct: 1 },
  { question: 'What organ pumps blood in the human body?', choices: ['Liver', 'Lung', 'Heart', 'Kidney'], correct: 2 },
  { question: 'What is the hardest natural substance on Earth?', choices: ['Gold', 'Iron', 'Diamond', 'Quartz'], correct: 2 },
  { question: 'What blood vessel carries blood away from the heart?', choices: ['Vein', 'Artery', 'Capillary', 'Lymph'], correct: 1 },
  { question: 'What is the chemical symbol for gold?', choices: ['Go', 'Gd', 'Au', 'Ag'], correct: 2 },
  { question: 'How many chromosomes do humans normally have?', choices: ['23', '46', '48', '92'], correct: 1 },
  { question: 'What force pulls objects toward Earth?', choices: ['Friction', 'Magnetism', 'Gravity', 'Tension'], correct: 2 },
  { question: 'What is the most abundant gas in Earth\'s atmosphere?', choices: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'], correct: 2 },
  { question: 'Which organ filters blood in humans?', choices: ['Liver', 'Spleen', 'Kidney', 'Pancreas'], correct: 2 },
  { question: 'What is photosynthesis?', choices: ['Making food from sunlight', 'Breaking down food', 'Absorbing minerals', 'Reproducing cells'], correct: 0 },
  { question: 'What planet is known as the Red Planet?', choices: ['Venus', 'Mercury', 'Mars', 'Jupiter'], correct: 2 },
  { question: 'What is the unit of electric current?', choices: ['Volt', 'Watt', 'Ampere', 'Ohm'], correct: 2 },
  { question: 'What is the chemical formula for table salt?', choices: ['NaCl', 'KCl', 'NaOH', 'CaCl₂'], correct: 0 },
  { question: 'What is the boiling point of water at sea level?', choices: ['90°C', '95°C', '100°C', '105°C'], correct: 2 },
  { question: 'Which planet is the largest in our solar system?', choices: ['Earth', 'Saturn', 'Jupiter', 'Uranus'], correct: 2 },
  { question: 'What process turns water vapour into liquid?', choices: ['Evaporation', 'Condensation', 'Sublimation', 'Precipitation'], correct: 1 },
  { question: 'What is DNA?', choices: ['A protein', 'A sugar', 'Genetic material', 'A vitamin'], correct: 2 },
  { question: 'What type of rock forms from cooled magma?', choices: ['Sedimentary', 'Metamorphic', 'Igneous', 'Composite'], correct: 2 },
  { question: 'How many chambers does the human heart have?', choices: ['2', '3', '4', '5'], correct: 2 },
  { question: 'What is the SI unit of force?', choices: ['Pascal', 'Joule', 'Newton', 'Watt'], correct: 2 },
  { question: 'What is a solid turning directly into gas called?', choices: ['Melting', 'Evaporation', 'Sublimation', 'Condensation'], correct: 2 },
  { question: 'What is the main energy source for Earth?', choices: ['Moon', 'Wind', 'Sun', 'Core heat'], correct: 2 },
  { question: 'What type of cell lacks a nucleus?', choices: ['Animal cell', 'Plant cell', 'Prokaryotic cell', 'Eukaryotic cell'], correct: 2 },
  { question: 'What is the freezing point of water?', choices: ['-10°C', '0°C', '10°C', '32°C'], correct: 1 },
  { question: 'What is the outermost layer of Earth called?', choices: ['Mantle', 'Core', 'Crust', 'Asthenosphere'], correct: 2 },
  { question: 'Which vitamin does sunlight help the body produce?', choices: ['Vitamin A', 'Vitamin B12', 'Vitamin C', 'Vitamin D'], correct: 3 },
  { question: 'What does Newton\'s 1st Law describe?', choices: ['Gravity', 'Action-Reaction', 'Inertia', 'Acceleration'], correct: 2 },
  { question: 'Which organ produces insulin?', choices: ['Liver', 'Kidney', 'Pancreas', 'Spleen'], correct: 2 },
  { question: 'Which gas makes up most of the Sun?', choices: ['Oxygen', 'Helium', 'Hydrogen', 'Carbon'], correct: 2 },
  { question: 'What are the primary colors of light?', choices: ['Red, Blue, Yellow', 'Red, Green, Blue', 'Cyan, Magenta, Yellow', 'Orange, Purple, Green'], correct: 1 },
  { question: 'What is the nearest star to Earth?', choices: ['Sirius', 'Alpha Centauri', 'The Sun', 'Betelgeuse'], correct: 2 },
  { question: 'Which blood type is the universal donor?', choices: ['A', 'B', 'AB', 'O'], correct: 3 },
  { question: 'What is the pH of pure water?', choices: ['5', '6', '7', '8'], correct: 2 },
  { question: 'How many planets are in our solar system?', choices: ['7', '8', '9', '10'], correct: 1 },
  { question: 'What is the function of red blood cells?', choices: ['Fight infection', 'Carry oxygen', 'Clot blood', 'Produce hormones'], correct: 1 },
  { question: 'TRUE or FALSE: Sound travels faster than light.', choices: ['TRUE', 'FALSE'], correct: 1 },
  { question: 'What is the chemical symbol for iron?', choices: ['Ir', 'Fe', 'In', 'Fr'], correct: 1 },
  { question: 'What type of energy is stored in food?', choices: ['Kinetic', 'Thermal', 'Chemical', 'Nuclear'], correct: 2 },
  { question: 'What is an ecosystem?', choices: ['A type of rock', 'A community of living things and their environment', 'A weather pattern', 'An ocean current'], correct: 1 },
  { question: 'What layer of Earth do tectonic plates float on?', choices: ['Outer core', 'Inner core', 'Mantle', 'Crust'], correct: 2 },
  { question: 'What is the chemical symbol for oxygen?', choices: ['Ox', 'O₂', 'O', 'Oy'], correct: 2 },
  { question: 'What process do green plants use to make food?', choices: ['Respiration', 'Digestion', 'Photosynthesis', 'Fermentation'], correct: 2 },

  // ── ENGLISH (50) ───────────────────────────────────────────────────────
  { question: 'What is a noun?', choices: ['An action word', 'A describing word', 'A person, place, or thing', 'A connecting word'], correct: 2 },
  { question: 'What is the plural of "child"?', choices: ['Childs', 'Children', 'Childen', 'Childrens'], correct: 1 },
  { question: 'Which word is a synonym of "happy"?', choices: ['Sad', 'Angry', 'Joyful', 'Tired'], correct: 2 },
  { question: 'What punctuation mark ends a question?', choices: ['.', '!', '?', ','], correct: 2 },
  { question: 'What is an antonym of "hot"?', choices: ['Warm', 'Mild', 'Cold', 'Lukewarm'], correct: 2 },
  { question: 'Which sentence is grammatically correct?', choices: ['She dont like it.', 'She doesn\'t likes it.', 'She doesn\'t like it.', 'She don\'t likes it.'], correct: 2 },
  { question: 'What is a verb?', choices: ['A person, place, or thing', 'An action word', 'A describing word', 'A preposition'], correct: 1 },
  { question: 'Which word is spelled correctly?', choices: ['Recieve', 'Receive', 'Receve', 'Recieive'], correct: 1 },
  { question: 'What is an adjective?', choices: ['An action word', 'A word that describes a noun', 'A connecting word', 'A time word'], correct: 1 },
  { question: 'What is the past tense of "run"?', choices: ['Runned', 'Ran', 'Running', 'Runs'], correct: 1 },
  { question: 'Which of these is a proper noun?', choices: ['city', 'mountain', 'London', 'river'], correct: 2 },
  { question: 'What does "benevolent" mean?', choices: ['Cruel', 'Kind and generous', 'Selfish', 'Lazy'], correct: 1 },
  { question: 'Which word is an adverb?', choices: ['Quick', 'Quickly', 'Quickness', 'Quicker'], correct: 1 },
  { question: 'What is the opposite of "ancient"?', choices: ['Old', 'Historic', 'Modern', 'Antique'], correct: 2 },
  { question: 'Which is a compound sentence?', choices: ['He ran.', 'She sang beautifully.', 'I cooked and she ate.', 'Running fast.'], correct: 2 },
  { question: 'What is a simile?', choices: ['A direct comparison', 'A comparison using "like" or "as"', 'An exaggeration', 'A hidden meaning'], correct: 1 },
  { question: 'Which word is a conjunction?', choices: ['Quickly', 'Beautiful', 'And', 'Over'], correct: 2 },
  { question: 'What is the plural of "mouse"?', choices: ['Mouses', 'Mices', 'Mice', 'Mouse'], correct: 2 },
  { question: 'Which sentence has correct punctuation?', choices: ['Its a nice day.', "It's a nice day.", "Its' a nice day.", "It's a nice, day"], correct: 1 },
  { question: 'What does "verbose" mean?', choices: ['Silent', 'Using too many words', 'Clear and brief', 'Angry'], correct: 1 },
  { question: 'Which word rhymes with "moon"?', choices: ['Run', 'Sun', 'Tune', 'Tone'], correct: 2 },
  { question: 'What is the subject of "The cat sat on the mat"?', choices: ['sat', 'mat', 'The cat', 'on'], correct: 2 },
  { question: 'What is an idiom?', choices: ['A new word', 'A phrase with a non-literal meaning', 'A grammar rule', 'A type of poem'], correct: 1 },
  { question: 'Which word is spelled correctly?', choices: ['Grammer', 'Grammarr', 'Grammar', 'Gramer'], correct: 2 },
  { question: 'Which word is a preposition?', choices: ['Run', 'Blue', 'Under', 'Happily'], correct: 2 },
  { question: 'What is alliteration?', choices: ['Repeating vowel sounds', 'Repeating consonant sounds at the start of words', 'A rhyme scheme', 'A metaphor'], correct: 1 },
  { question: 'What is the superlative form of "good"?', choices: ['Gooder', 'Better', 'Best', 'Most good'], correct: 2 },
  { question: 'Which is a metaphor?', choices: ['She is like a star', 'Life is a journey', 'He ran as fast as wind', 'The dog barked loudly'], correct: 1 },
  { question: 'What does "ambiguous" mean?', choices: ['Clear', 'Having more than one meaning', 'Simple', 'Angry'], correct: 1 },
  { question: 'What is the correct plural of "knife"?', choices: ['Knifes', 'Knives', "Knife's", 'Knieves'], correct: 1 },
  { question: 'Which sentence is in passive voice?', choices: ['She wrote the letter.', 'The letter was written by her.', 'She writes daily.', 'She will write.'], correct: 1 },
  { question: 'What is onomatopoeia?', choices: ['A figure of speech', 'Words that sound like what they describe', 'A metaphor', 'An exaggeration'], correct: 1 },
  { question: 'What is the antonym of "expand"?', choices: ['Grow', 'Stretch', 'Shrink', 'Widen'], correct: 2 },
  { question: 'Which word is a pronoun?', choices: ['Book', 'Run', 'She', 'Happy'], correct: 2 },
  { question: 'What is the past perfect tense of "eat"?', choices: ['Ate', 'Eats', 'Had eaten', 'Has eat'], correct: 2 },
  { question: 'What does "lucid" mean?', choices: ['Confusing', 'Clear and easy to understand', 'Dark', 'Slow'], correct: 1 },
  { question: 'Which is an example of hyperbole?', choices: ['The cat sat.', "I've told you a million times!", 'She sang like a bird.', 'The sun rose.'], correct: 1 },
  { question: 'What is a clause?', choices: ['A punctuation mark', 'A group of words with a subject and verb', 'A type of noun', 'A poem line'], correct: 1 },
  { question: 'What does "eloquent" mean?', choices: ['Quiet', 'Fluent and persuasive in speech', 'Rude', 'Confused'], correct: 1 },
  { question: 'What is the correct article to use before "apple"?', choices: ['a', 'an', 'the', 'any'], correct: 1 },
  { question: 'What is the synonym of "brave"?', choices: ['Cowardly', 'Timid', 'Courageous', 'Fearful'], correct: 2 },
  { question: 'What is the tone of a story?', choices: ['The moral lesson', "The author's attitude toward the subject", 'The plot', 'The setting'], correct: 1 },
  { question: 'Which word means "to make worse"?', choices: ['Improve', 'Enhance', 'Aggravate', 'Restore'], correct: 2 },
  { question: 'Which word is spelled correctly?', choices: ['Acommodate', 'Accommodate', 'Accomodate', 'Acomodate'], correct: 1 },
  { question: 'What is an oxymoron?', choices: ['A synonym pair', 'Two contradictory words together', 'An exaggeration', 'A repeated phrase'], correct: 1 },
  { question: 'What does "meticulous" mean?', choices: ['Careless', 'Very careful and precise', 'Loud', 'Speedy'], correct: 1 },
  { question: 'Which sentence is grammatically correct?', choices: ['Me and him went.', 'Him and me went.', 'He and I went.', 'I and he went.'], correct: 2 },
  { question: 'What is the theme of a story?', choices: ['The main character', 'The setting', 'The central message or idea', 'The climax'], correct: 2 },
  { question: 'What literary device is "the wind whispered"?', choices: ['Simile', 'Hyperbole', 'Personification', 'Alliteration'], correct: 2 },
  { question: 'What does "procrastinate" mean?', choices: ['To work quickly', 'To delay or postpone tasks', 'To study hard', 'To celebrate'], correct: 1 },

  // ── HISTORY (50) ───────────────────────────────────────────────────────
  { question: 'Who was the first President of the United States?', choices: ['John Adams', 'George Washington', 'Thomas Jefferson', 'Benjamin Franklin'], correct: 1 },
  { question: 'In what year did World War II end?', choices: ['1943', '1944', '1945', '1946'], correct: 2 },
  { question: 'Who invented the telephone?', choices: ['Thomas Edison', 'Nikola Tesla', 'Alexander Graham Bell', 'Guglielmo Marconi'], correct: 2 },
  { question: 'Which ancient wonder was located in Egypt?', choices: ['Colosseum', 'Great Wall', 'Great Pyramid of Giza', 'Hanging Gardens'], correct: 2 },
  { question: 'Who was the first man to walk on the Moon?', choices: ['Buzz Aldrin', 'Neil Armstrong', 'Yuri Gagarin', 'John Glenn'], correct: 1 },
  { question: 'In what year did World War I begin?', choices: ['1912', '1914', '1916', '1918'], correct: 1 },
  { question: 'Julius Caesar was part of which empire?', choices: ['Greek', 'Ottoman', 'Roman', 'Persian'], correct: 2 },
  { question: 'Who is the primary author of the Declaration of Independence?', choices: ['George Washington', 'John Adams', 'Benjamin Franklin', 'Thomas Jefferson'], correct: 3 },
  { question: 'What was the name of the famous ship that sank in 1912?', choices: ['Lusitania', 'Britannic', 'Titanic', 'Olympic'], correct: 2 },
  { question: 'Where did the Renaissance begin?', choices: ['France', 'Germany', 'Italy', 'Spain'], correct: 2 },
  { question: 'Who was the first woman to win a Nobel Prize?', choices: ['Florence Nightingale', 'Marie Curie', 'Amelia Earhart', 'Rosa Parks'], correct: 1 },
  { question: 'In what year did the Berlin Wall fall?', choices: ['1987', '1988', '1989', '1990'], correct: 2 },
  { question: 'Who was Napoleon Bonaparte?', choices: ['A British king', 'A French military leader', 'A Spanish explorer', 'A German philosopher'], correct: 1 },
  { question: 'The Cold War was primarily between which two powers?', choices: ['US and China', 'US and USSR', 'US and Germany', 'UK and USSR'], correct: 1 },
  { question: 'Which civilization built Machu Picchu?', choices: ['Aztec', 'Maya', 'Inca', 'Olmec'], correct: 2 },
  { question: 'In what year did Christopher Columbus arrive in the Americas?', choices: ['1488', '1490', '1492', '1494'], correct: 2 },
  { question: 'Which Egyptian queen allied with Julius Caesar?', choices: ['Nefertiti', 'Cleopatra', 'Hatshepsut', 'Isis'], correct: 1 },
  { question: 'What was the name of the first artificial satellite?', choices: ['Apollo', 'Vostok', 'Sputnik', 'Explorer'], correct: 2 },
  { question: 'Which war was fought between the North and South United States?', choices: ['Revolutionary War', 'War of 1812', 'Civil War', 'World War I'], correct: 2 },
  { question: 'Who led the Soviet Union during World War II?', choices: ['Lenin', 'Khrushchev', 'Stalin', 'Gorbachev'], correct: 2 },
  { question: 'The French Revolution took place in which country?', choices: ['England', 'Germany', 'France', 'Spain'], correct: 2 },
  { question: 'What was the name of the first Moon landing mission?', choices: ['Apollo 11', 'Apollo 13', 'Gemini 5', 'Mercury 7'], correct: 0 },
  { question: 'Who was Mahatma Gandhi?', choices: ['Indian military general', 'Leader of Indian independence movement', 'Pakistani president', 'British governor'], correct: 1 },
  { question: 'What year was the Magna Carta signed?', choices: ['1215', '1315', '1415', '1515'], correct: 0 },
  { question: 'Which country was the first to grant women the right to vote?', choices: ['USA', 'UK', 'New Zealand', 'France'], correct: 2 },
  { question: 'Who painted the Mona Lisa?', choices: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Botticelli'], correct: 2 },
  { question: 'What was the Silk Road?', choices: ['A type of cloth', 'An ancient trade route', 'A Roman road', 'A river in China'], correct: 1 },
  { question: 'Who was the first female Prime Minister of the United Kingdom?', choices: ['Queen Elizabeth', 'Margaret Thatcher', 'Theresa May', 'Jacinda Ardern'], correct: 1 },
  { question: 'Which ancient city was destroyed by Mount Vesuvius?', choices: ['Athens', 'Rome', 'Pompeii', 'Carthage'], correct: 2 },
  { question: 'What does "BCE" stand for in historical dates?', choices: ['Before Common Era', 'British Colonial Empire', 'Before Christian Era Only', 'Based on Calendar Events'], correct: 0 },
  { question: 'Who was the first Emperor of China?', choices: ['Confucius', 'Kublai Khan', 'Qin Shi Huang', 'Sun Yat-sen'], correct: 2 },
  { question: 'In what year did India gain independence?', choices: ['1945', '1946', '1947', '1948'], correct: 2 },
  { question: 'Who discovered penicillin?', choices: ['Louis Pasteur', 'Alexander Fleming', 'Joseph Lister', 'Edward Jenner'], correct: 1 },
  { question: 'What was the apartheid system in South Africa?', choices: ['A voting system', 'A racial segregation policy', 'A trade agreement', 'A religious system'], correct: 1 },
  { question: 'Who led Cuba starting in 1959?', choices: ['Che Guevara', 'Fulgencio Batista', 'Fidel Castro', 'Raúl Castro'], correct: 2 },
  { question: 'What sparked the start of World War I?', choices: ['Bombing of Pearl Harbor', 'Assassination of Archduke Franz Ferdinand', 'Invasion of Poland', 'Fall of Constantinople'], correct: 1 },
  { question: 'What was the Holocaust?', choices: ['A WWII battle', 'The Nazi genocide of Jewish people and others', 'A Russian famine', 'An atomic bomb attack'], correct: 1 },
  { question: 'Who was Martin Luther King Jr.?', choices: ['A US president', 'A civil rights leader', 'A Supreme Court judge', 'A British prime minister'], correct: 1 },
  { question: 'Which ancient empire was centered in modern-day Turkey?', choices: ['Persian', 'Byzantine', 'Ottoman', 'Mongol'], correct: 2 },
  { question: 'In what year did the first iPhone launch?', choices: ['2005', '2006', '2007', '2008'], correct: 2 },
  { question: 'Who was the first president of South Africa after apartheid?', choices: ['Desmond Tutu', 'Nelson Mandela', 'F.W. de Klerk', 'Thabo Mbeki'], correct: 1 },
  { question: 'Who was Genghis Khan?', choices: ['A Chinese emperor', 'A Mongol conqueror', 'A Japanese shogun', 'A Korean king'], correct: 1 },
  { question: 'In which city was the Eiffel Tower built?', choices: ['Lyon', 'Marseille', 'Paris', 'Nice'], correct: 2 },
  { question: 'What was the name of Hitler\'s political party?', choices: ['Communist Party', 'Democratic Party', 'National Socialist (Nazi) Party', 'Conservative Party'], correct: 2 },
  { question: 'What year did the United States declare independence?', choices: ['1774', '1776', '1778', '1780'], correct: 1 },
  { question: 'Which country launched the first human into space?', choices: ['USA', 'UK', 'USSR', 'China'], correct: 2 },
  { question: 'What was the Great Wall of China primarily built for?', choices: ['Irrigate farmland', 'Protect against northern invaders', 'Mark empire borders', 'Connect trade cities'], correct: 1 },
  { question: 'Who co-wrote "The Communist Manifesto"?', choices: ['Lenin and Stalin', 'Stalin and Mao', 'Karl Marx and Friedrich Engels', 'Mao and Engels'], correct: 2 },
  { question: 'What were the Crusades?', choices: ['Trade expeditions', 'Religious military campaigns', 'Scientific explorations', 'Diplomatic missions'], correct: 1 },
  { question: 'Which US president abolished slavery with the Emancipation Proclamation?', choices: ['George Washington', 'Ulysses S. Grant', 'Abraham Lincoln', 'Andrew Jackson'], correct: 2 },
];

function pickFoodKind(): FoodKind {
  const r = Math.random() * 100;
  if (r < 50) return 'apple';
  if (r < 70) return 'speed';
  if (r < 85) return 'shield';
  if (r < 95) return 'skull';
  return 'star';
}

class SnakeScene extends Phaser.Scene {
  private snakes: SnakeState[] = [];
  private foods: Food[] = [];
  private globalTickMs = BASE_TICK_MS;
  private elapsed = 0;
  private roundOver = false;
  private challengeActive = false;
  private activeChallenge: Challenge | null = null;
  private challengeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pointerPos: { x: number; y: number } | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private overlayText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private domListeners: Array<{ el: Element; event: string; fn: EventListener }> = [];
  private tonguePhase = 0; // ms counter for tongue animation (cycle: 700ms)

  constructor() {
    super({ key: 'SnakeScene' });
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.overlayText = this.add.text(CANVAS_W / 2, CANVAS_H / 2, '', {
      fontSize: '28px',
      color: '#ffffff',
      align: 'center',
      fontFamily: 'system-ui, sans-serif',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Finger-chase: track where the finger/cursor is; snake steers toward it each tick
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerPos = { x: p.x, y: p.y };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.pointerPos = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', () => { this.pointerPos = null; });
    this.input.on('pointercancel', () => { this.pointerPos = null; });

    this.resetGame();

    // Retry listener persists across rounds — set up AFTER resetGame() so it isn't cleared
    const retryHandler = () => { if (this.roundOver) this.resetGame(); };
    window.addEventListener('snake-retry', retryHandler);
    // Clean up when Phaser scene shuts down
    this.events.once('shutdown', () => window.removeEventListener('snake-retry', retryHandler));
    this.events.once('destroy',  () => window.removeEventListener('snake-retry', retryHandler));
  }

  private resetGame(): void {
    // Clear old DOM listeners from previous round
    for (const { el, event, fn } of this.domListeners) {
      el.removeEventListener(event, fn);
    }
    this.domListeners = [];

    this.snakes = [
      {
        id: 0, name: 'You',
        body: [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }],
        direction: 'RIGHT', nextDirection: 'RIGHT',
        alive: true, score: 0,
        bodyColor: humanBodyColor, headColor: humanHeadColor,
        isHuman: true,
        powerUp: { kind: 'none', msRemaining: 0 },
        stunnedMs: 0,
        scoreElId: 'p1-score',
      },
      {
        id: 1, name: 'AI Blue',
        body: [{ x: 25, y: 6 }, { x: 26, y: 6 }, { x: 27, y: 6 }],
        direction: 'LEFT', nextDirection: 'LEFT',
        alive: true, score: 0,
        bodyColor: 0x3498db, headColor: 0x74b9ff,
        isHuman: false,
        powerUp: { kind: 'none', msRemaining: 0 },
        stunnedMs: 0,
        scoreElId: 'p2-score',
      },
      {
        id: 2, name: 'AI Green',
        body: [{ x: 6, y: 17 }, { x: 5, y: 17 }, { x: 4, y: 17 }],
        direction: 'RIGHT', nextDirection: 'RIGHT',
        alive: true, score: 0,
        bodyColor: 0x00b894, headColor: 0x55efc4,
        isHuman: false,
        powerUp: { kind: 'none', msRemaining: 0 },
        stunnedMs: 0,
        scoreElId: 'p3-score',
      },
      {
        id: 3, name: 'AI Orange',
        body: [{ x: 25, y: 17 }, { x: 26, y: 17 }, { x: 27, y: 17 }],
        direction: 'LEFT', nextDirection: 'LEFT',
        alive: true, score: 0,
        bodyColor: 0xe17055, headColor: 0xfab1a0,
        isHuman: false,
        powerUp: { kind: 'none', msRemaining: 0 },
        stunnedMs: 0,
        scoreElId: 'p4-score',
      },
    ];

    this.foods = [];
    this.globalTickMs = BASE_TICK_MS;
    this.elapsed = 0;
    this.roundOver = false;
    this.challengeActive = false;

    if (this.challengeTimeoutId !== null) {
      clearTimeout(this.challengeTimeoutId);
      this.challengeTimeoutId = null;
    }
    this.activeChallenge = null;

    const overlay = document.getElementById('challenge-overlay');
    if (overlay) overlay.classList.add('hidden');
    document.getElementById('retry-btn')?.classList.add('hidden');

    this.overlayText.setText('');
    this.overlayGraphics.clear();

    for (let i = 0; i < FOOD_COUNT; i++) {
      this.spawnFood();
    }

    this.updateScoreDisplays();
    this.updatePowerUpHUD();
  }

  private allBodyCells(): Set<string> {
    const cells = new Set<string>();
    for (const snake of this.snakes) {
      if (snake.alive) {
        for (const p of snake.body) cells.add(`${p.x},${p.y}`);
      }
    }
    return cells;
  }

  private spawnFood(): void {
    const occupied = this.allBodyCells();
    for (const f of this.foods) occupied.add(`${f.x},${f.y}`);

    let fx = 0;
    let fy = 0;
    let attempts = 0;
    do {
      fx = Phaser.Math.Between(0, COLS - 1);
      fy = Phaser.Math.Between(0, ROWS - 1);
      attempts++;
    } while (occupied.has(`${fx},${fy}`) && attempts < 1000);

    this.foods.push({ x: fx, y: fy, kind: pickFoodKind() });
  }

  private queueDirection(snake: SnakeState, dir: Direction): void {
    if (dir !== OPPOSITE[snake.direction] && snake.stunnedMs <= 0) {
      snake.nextDirection = dir;
    }
  }

  private aiChooseDirection(snake: SnakeState): Direction {
    const occupied = new Set<string>();
    for (const s of this.snakes) {
      if (s.alive) {
        for (const p of s.body) occupied.add(`${p.x},${p.y}`);
      }
    }

    const head = snake.body[0];
    const candidates: Direction[] = [
      snake.direction,
      LEFT_OF[snake.direction],
      RIGHT_OF[snake.direction],
    ];

    const nearestFoodDist = (nx: number, ny: number): number => {
      let best = Infinity;
      for (const f of this.foods) {
        const d = Math.abs(f.x - nx) + Math.abs(f.y - ny);
        if (d < best) best = d;
      }
      return best;
    };

    let bestDir = snake.direction;
    let bestScore = Infinity;
    let foundValid = false;

    for (const dir of candidates) {
      const d = DELTA[dir];
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (occupied.has(`${nx},${ny}`)) continue;
      const score = nearestFoodDist(nx, ny);
      if (!foundValid || score < bestScore) {
        bestScore = score;
        bestDir = dir;
        foundValid = true;
      }
    }

    return bestDir;
  }

  private tick(): void {
    // AI direction selection
    for (const snake of this.snakes) {
      if (!snake.alive || snake.isHuman) continue;
      snake.nextDirection = this.aiChooseDirection(snake);
    }

    const alive = this.snakes.filter((s) => s.alive);

    // Commit directions (skip if stunned)
    for (const snake of alive) {
      if (snake.stunnedMs <= 0) {
        snake.direction = snake.nextDirection;
      }
    }

    // Compute new heads
    const newHeads = new Map<number, Point>();
    for (const snake of alive) {
      const head = snake.body[0];
      const d = DELTA[snake.direction];
      newHeads.set(snake.id, { x: head.x + d.x, y: head.y + d.y });
    }

    // Border collisions
    for (const snake of alive) {
      const nh = newHeads.get(snake.id)!;
      if (nh.x < 0 || nh.x >= COLS || nh.y < 0 || nh.y >= ROWS) {
        snake.alive = false;
      }
    }

    const stillAlive = alive.filter((s) => s.alive);

    // Determine which snakes eat food
    const foodSet = new Set<string>(this.foods.map((f) => `${f.x},${f.y}`));
    const eatingSnakes = new Set<number>();
    for (const snake of stillAlive) {
      const nh = newHeads.get(snake.id)!;
      if (foodSet.has(`${nh.x},${nh.y}`)) eatingSnakes.add(snake.id);
    }

    // Remove tails for non-eating snakes
    for (const snake of stillAlive) {
      if (!eatingSnakes.has(snake.id)) snake.body.pop();
    }

    // Build occupied cell set (after tail removal)
    const occupied = new Set<string>();
    for (const snake of stillAlive) {
      for (const p of snake.body) occupied.add(`${p.x},${p.y}`);
    }

    // Track where each new head is going (for head-head detection)
    const headCellToSnakes = new Map<string, SnakeState[]>();
    for (const snake of stillAlive) {
      const nh = newHeads.get(snake.id)!;
      const key = `${nh.x},${nh.y}`;
      if (!headCellToSnakes.has(key)) headCellToSnakes.set(key, []);
      headCellToSnakes.get(key)!.push(snake);
    }

    const toKill = new Set<number>();

    // Body collisions
    for (const snake of stillAlive) {
      const nh = newHeads.get(snake.id)!;
      const nhKey = `${nh.x},${nh.y}`;
      if (occupied.has(nhKey)) {
        if (snake.isHuman && snake.powerUp.kind === 'shield') {
          // Shield only absorbs hits against other snakes' bodies (not own body)
          const isOwnBody = snake.body.some((p) => `${p.x},${p.y}` === nhKey);
          if (!isOwnBody) {
            // Absorb the hit; shield expires
            snake.powerUp = { kind: 'none', msRemaining: 0 };
          } else {
            toKill.add(snake.id);
          }
        } else {
          toKill.add(snake.id);
        }
      }
    }

    // Head-head collisions (shield cannot block these)
    for (const [, snakesAtCell] of headCellToSnakes) {
      if (snakesAtCell.length > 1) {
        for (const s of snakesAtCell) toKill.add(s.id);
      }
    }

    for (const id of toKill) {
      this.snakes[id].alive = false;
    }

    // Prepend new heads for survivors; process food effects
    const survivors = stillAlive.filter((s) => s.alive);
    const foodsEaten: string[] = [];

    for (const snake of survivors) {
      const nh = newHeads.get(snake.id)!;
      snake.body.unshift(nh);

      if (eatingSnakes.has(snake.id)) {
        const foodKey = `${nh.x},${nh.y}`;
        const food = this.foods.find((f) => `${f.x},${f.y}` === foodKey);
        if (food) {
          foodsEaten.push(foodKey);
          switch (food.kind) {
            case 'apple':
              snake.score += 10;
              // tail preserved = natural growth ✓
              break;
            case 'speed':
              snake.score += 10;
              if (snake.isHuman) snake.powerUp = { kind: 'speed', msRemaining: 5000 };
              // tail preserved = grow ✓
              break;
            case 'shield':
              snake.score += 10;
              if (snake.isHuman) snake.powerUp = { kind: 'shield', msRemaining: 5000 };
              // tail preserved = grow ✓
              break;
            case 'skull':
              // Shrink by 3 (min length 1); tail was preserved so remove 3 from back
              for (let i = 0; i < 3; i++) {
                if (snake.body.length > 1) snake.body.pop();
              }
              break;
            case 'star':
              snake.score += 50;
              // No grow: tail was preserved by eating logic, so pop it back off
              if (snake.body.length > 1) snake.body.pop();
              break;
          }
        }
      }
    }

    // Remove eaten foods and respawn
    this.foods = this.foods.filter((f) => !foodsEaten.includes(`${f.x},${f.y}`));
    while (this.foods.length < FOOD_COUNT) {
      this.spawnFood();
    }

    // Accelerate global tick slightly per food eaten
    if (foodsEaten.length > 0) {
      this.globalTickMs = Math.max(80, this.globalTickMs - 2 * foodsEaten.length);
    }

    this.updateScoreDisplays();
    this.updatePowerUpHUD();
    this.checkWinCondition();
  }

  private checkWinCondition(): void {
    if (this.roundOver || this.challengeActive) return;
    const human = this.snakes[0];
    const aiAlive = this.snakes.filter((s) => !s.isHuman && s.alive);

    if (aiAlive.length === 0 && human.alive) {
      this.endRound('win', human.score);
    } else if (!human.alive) {
      // Give the player a second chance via a logic question
      this.triggerDeathChallenge();
    }
  }

  private endRound(result: 'win' | 'lose' | 'draw', score: number): void {
    this.roundOver = true;
    // Dismiss any active logic challenge so it doesn't block the game-over screen
    if (this.challengeActive) {
      if (this.challengeTimeoutId !== null) {
        clearTimeout(this.challengeTimeoutId);
        this.challengeTimeoutId = null;
      }
      const overlay = document.getElementById('challenge-overlay');
      if (overlay) overlay.classList.add('hidden');
      this.challengeActive = false;
    }
    this.overlayGraphics.fillStyle(0x000000, 0.65);
    this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    let msg: string;
    if (result === 'win') {
      msg = `You Win! 🏆\nScore: ${score}`;
    } else if (result === 'lose') {
      msg = `Game Over 💀\nScore: ${score}`;
    } else {
      msg = 'Draw! 🤝';
    }
    this.overlayText.setText(msg);
    document.getElementById('retry-btn')?.classList.remove('hidden');
  }

  private updateScoreDisplays(): void {
    for (const snake of this.snakes) {
      const el = document.getElementById(snake.scoreElId);
      if (el) el.textContent = String(snake.score);
    }
  }

  private updatePowerUpHUD(): void {
    const human = this.snakes[0];
    if (!human) return;
    const display = document.getElementById('powerup-display');
    const timer = document.getElementById('powerup-timer');
    if (!display || !timer) return;

    if (human.stunnedMs > 0) {
      display.textContent = '😵 Stunned';
      display.style.color = '#95a5a6';
      timer.textContent = `${Math.ceil(human.stunnedMs / 1000)}s`;
      return;
    }

    const pu = human.powerUp;
    if (pu.kind === 'speed') {
      display.textContent = '⚡ Speed Boost';
      display.style.color = '#f1c40f';
      timer.textContent = `${Math.ceil(pu.msRemaining / 1000)}s`;
    } else if (pu.kind === 'shield') {
      display.textContent = '🛡 Shield';
      display.style.color = '#00cec9';
      timer.textContent = `${Math.ceil(pu.msRemaining / 1000)}s`;
    } else {
      display.textContent = 'None';
      display.style.color = '';
      timer.textContent = '';
    }
  }

  private triggerDeathChallenge(): void {
    this.challengeActive = true;
    this.activeChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];

    const questionEl = document.getElementById('challenge-question');
    const choicesEl  = document.getElementById('challenge-choices');
    const overlay    = document.getElementById('challenge-overlay');

    if (questionEl) questionEl.textContent = this.activeChallenge.question;

    if (choicesEl) {
      choicesEl.innerHTML = '';

      // Restart the timer bar animation
      const timerBar = document.getElementById('challenge-timer-bar');
      if (timerBar) {
        timerBar.style.animation = 'none';
        void timerBar.offsetWidth; // force reflow
        timerBar.style.animation = '';
      }

      const challenge = this.activeChallenge;
      challenge.choices.forEach((choice, idx) => {
        const btn = document.createElement('button');
        btn.textContent = choice;
        const fn: EventListener = () => {
          if (!this.challengeActive) return;
          this.resolveDeathChallenge(idx === challenge.correct);
        };
        btn.addEventListener('click', fn);
        this.domListeners.push({ el: btn, event: 'click', fn });
        choicesEl.appendChild(btn);
      });
    }

    if (overlay) overlay.classList.remove('hidden');

    this.challengeTimeoutId = setTimeout(() => {
      if (this.challengeActive) this.resolveDeathChallenge(false);
    }, 6000);
  }

  private resolveDeathChallenge(correct: boolean): void {
    if (!this.challengeActive) return;
    if (this.challengeTimeoutId !== null) {
      clearTimeout(this.challengeTimeoutId);
      this.challengeTimeoutId = null;
    }
    this.activeChallenge = null;

    const overlay = document.getElementById('challenge-overlay');
    if (overlay) overlay.classList.add('hidden');

    this.challengeActive = false;

    const human = this.snakes[0];
    if (correct) {
      // Revive — respawn at starting position, keep score
      human.body = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
      human.direction = 'RIGHT';
      human.nextDirection = 'RIGHT';
      human.alive = true;
      human.stunnedMs = 0;
      human.powerUp = { kind: 'none', msRemaining: 0 };
      // Check if all AI are already dead — if so, the revived player wins
      const aiAlive = this.snakes.filter((s) => !s.isHuman && s.alive);
      if (aiAlive.length === 0) {
        this.endRound('win', human.score);
      }
    } else {
      // Wrong / timed out — real game over
      const aiAlive = this.snakes.filter((s) => !s.isHuman && s.alive);
      if (aiAlive.length === 0) {
        this.endRound('draw', 0);
      } else {
        this.endRound('lose', human.score);
      }
    }

    this.updateScoreDisplays();
    this.updatePowerUpHUD();
  }

  update(_time: number, delta: number): void {
    // Tongue animation cycle (700ms: out for 220ms, retracted for 480ms)
    this.tonguePhase = (this.tonguePhase + delta) % 700;

    // Decrement power-up and stun timers for all snakes
    for (const snake of this.snakes) {
      if (snake.powerUp.msRemaining > 0) {
        snake.powerUp.msRemaining = Math.max(0, snake.powerUp.msRemaining - delta);
        if (snake.powerUp.msRemaining === 0) snake.powerUp.kind = 'none';
      }
      if (snake.stunnedMs > 0) {
        snake.stunnedMs = Math.max(0, snake.stunnedMs - delta);
      }
    }

    if (this.roundOver) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.resetGame();
      this.draw();
      return;
    }

    if (this.challengeActive) {
      this.draw();
      return;
    }

    // Handle human input: finger-chase (pointer) + WASD keyboard fallback
    const human = this.snakes[0];
    if (human.alive) {
      if (this.pointerPos) {
        // Steer toward finger: compare angle from snake head to pointer
        const head = human.body[0];
        const hx = head.x * CELL_SIZE + CELL_SIZE / 2;
        const hy = head.y * CELL_SIZE + CELL_SIZE / 2;
        const dx = this.pointerPos.x - hx;
        const dy = this.pointerPos.y - hy;
        // Only turn if finger is at least one cell away (avoids jitter on tap)
        if (Math.max(Math.abs(dx), Math.abs(dy)) > CELL_SIZE) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            this.queueDirection(human, dx > 0 ? 'RIGHT' : 'LEFT');
          } else {
            this.queueDirection(human, dy > 0 ? 'DOWN' : 'UP');
          }
        }
      } else {
        // Keyboard fallback for desktop
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.keyD)) {
          this.queueDirection(human, 'RIGHT');
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.keyA)) {
          this.queueDirection(human, 'LEFT');
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keyW)) {
          this.queueDirection(human, 'UP');
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keyS)) {
          this.queueDirection(human, 'DOWN');
        }
      }
    }

    // Use speed boost tick rate if active
    const tickMs = (human.alive && human.powerUp.kind === 'speed')
      ? SPEED_BOOST_TICK_MS
      : this.globalTickMs;

    this.elapsed += delta;
    while (this.elapsed >= tickMs) {
      this.elapsed -= tickMs;
      this.tick();
      if (this.roundOver || this.challengeActive) break;
    }

    this.draw();
    this.updatePowerUpHUD();
  }

  /** Darken a packed RGB hex color by the given factor (0–1). */
  private darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * factor);
    const g2 = Math.floor(((color >> 8) & 0xff) * factor);
    const b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g2 << 8) | b;
  }

  private drawRealSnake(g: Phaser.GameObjects.Graphics, snake: SnakeState): void {
    const body = snake.body;
    if (body.length === 0) return;

    const BODY_R = 7;   // body segment radius
    const HEAD_R = 9;   // head radius (slightly larger)
    const TAIL_R = 4;   // tail tip radius (tapered)

    const isStunned = snake.isHuman && snake.stunnedMs > 0;
    const bodyColor = isStunned ? 0x95a5a6 : snake.bodyColor;
    const headColor = isStunned ? 0xb2bec3 : snake.headColor;
    const scaleColor = this.darkenColor(bodyColor, 0.72); // darker shade for scale texture
    const fwd = DELTA[snake.direction];
    const perp = { x: -fwd.y, y: fwd.x }; // perpendicular to direction

    // ── 1. Connecting bridges between consecutive segments ──────────────────
    // Draw filled rectangles between each pair of adjacent segment centres.
    // This fills the gap so body looks like a continuous smooth tube.
    g.fillStyle(bodyColor);
    for (let i = 0; i < body.length - 1; i++) {
      const a = body[i];
      const b2 = body[i + 1];
      const ax = a.x * CELL_SIZE + CELL_SIZE / 2;
      const ay = a.y * CELL_SIZE + CELL_SIZE / 2;
      const bx = b2.x * CELL_SIZE + CELL_SIZE / 2;
      const by = b2.y * CELL_SIZE + CELL_SIZE / 2;
      const segR = i === 0 ? HEAD_R : BODY_R;
      const nextR = i + 1 === body.length - 1 ? TAIL_R : BODY_R;
      const minR = Math.min(segR, nextR);
      if (Math.abs(ax - bx) > Math.abs(ay - by)) {
        // horizontal bridge
        g.fillRect(Math.min(ax, bx), Math.min(ay, by) - minR, Math.abs(ax - bx), minR * 2);
      } else {
        // vertical bridge
        g.fillRect(Math.min(ax, bx) - minR, Math.min(ay, by), minR * 2, Math.abs(ay - by));
      }
    }

    // ── 2. Body segment circles (tail → neck, skip head) ───────────────────
    for (let i = body.length - 1; i >= 1; i--) {
      const seg = body[i];
      const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;
      const r = i === body.length - 1 ? TAIL_R : BODY_R;
      // Alternate scale texture every 2 segments
      g.fillStyle(i % 2 === 0 ? bodyColor : scaleColor);
      g.fillCircle(cx, cy, r);
    }

    // ── 3. Head circle ──────────────────────────────────────────────────────
    const h = body[0];
    const hcx = h.x * CELL_SIZE + CELL_SIZE / 2;
    const hcy = h.y * CELL_SIZE + CELL_SIZE / 2;
    g.fillStyle(headColor);
    g.fillCircle(hcx, hcy, HEAD_R);

    // ── 4. Eyes ─────────────────────────────────────────────────────────────
    // Position eyes forward and perpendicular from head centre
    const EYE_FWD  = 3;   // px toward front
    const EYE_SIDE = 5;   // px perpendicular from centre
    const eye1 = {
      x: hcx + fwd.x * EYE_FWD + perp.x * EYE_SIDE,
      y: hcy + fwd.y * EYE_FWD + perp.y * EYE_SIDE,
    };
    const eye2 = {
      x: hcx + fwd.x * EYE_FWD - perp.x * EYE_SIDE,
      y: hcy + fwd.y * EYE_FWD - perp.y * EYE_SIDE,
    };
    g.fillStyle(0xffffff);
    g.fillCircle(eye1.x, eye1.y, 2.5);
    g.fillCircle(eye2.x, eye2.y, 2.5);
    // Pupils — offset slightly toward front for a "looking forward" look
    g.fillStyle(0x1a1a2e);
    g.fillCircle(eye1.x + fwd.x * 0.8, eye1.y + fwd.y * 0.8, 1.5);
    g.fillCircle(eye2.x + fwd.x * 0.8, eye2.y + fwd.y * 0.8, 1.5);

    // ── 5. Tongue (animated — flicks out every 700 ms cycle) ────────────────
    const tongueOut = this.tonguePhase < 220 && !isStunned;
    if (tongueOut) {
      const TONGUE_LEN = 9;
      const FORK_LEN  = 4;
      const FORK_SPREAD = 3;
      const baseX = hcx + fwd.x * (HEAD_R + 1);
      const baseY = hcy + fwd.y * (HEAD_R + 1);
      const tipX  = baseX + fwd.x * TONGUE_LEN;
      const tipY  = baseY + fwd.y * TONGUE_LEN;
      g.lineStyle(1.5, 0xff6b9d, 1);
      // Stem
      g.beginPath(); g.moveTo(baseX, baseY); g.lineTo(tipX, tipY); g.strokePath();
      // Left fork
      g.beginPath();
      g.moveTo(tipX, tipY);
      g.lineTo(tipX + fwd.x * FORK_LEN + perp.x * FORK_SPREAD,
               tipY + fwd.y * FORK_LEN + perp.y * FORK_SPREAD);
      g.strokePath();
      // Right fork
      g.beginPath();
      g.moveTo(tipX, tipY);
      g.lineTo(tipX + fwd.x * FORK_LEN - perp.x * FORK_SPREAD,
               tipY + fwd.y * FORK_LEN - perp.y * FORK_SPREAD);
      g.strokePath();
    }

    // ── 6. Shield ring around head ──────────────────────────────────────────
    if (snake.isHuman && snake.powerUp.kind === 'shield') {
      g.lineStyle(2.5, 0x00cec9, 1);
      g.strokeCircle(hcx, hcy, HEAD_R + 5);
    }
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();

    // Background
    g.fillStyle(0x0d1a0d);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Food
    for (const food of this.foods) {
      const cx = food.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = food.y * CELL_SIZE + CELL_SIZE / 2;
      const r = CELL_SIZE / 2 - 2;
      switch (food.kind) {
        case 'apple':
          g.fillStyle(0xe74c3c);
          g.fillCircle(cx, cy, r);
          break;
        case 'speed':
          g.fillStyle(0xf1c40f);
          g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
          g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);
          break;
        case 'shield':
          g.fillStyle(0x00cec9);
          g.fillRect(food.x * CELL_SIZE + 2, food.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
          g.fillStyle(0x0d1a0d);
          g.fillRect(food.x * CELL_SIZE + 6, food.y * CELL_SIZE + 6, CELL_SIZE - 12, CELL_SIZE - 12);
          break;
        case 'skull':
          g.fillStyle(0x6c5ce7);
          g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
          g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);
          break;
        case 'star':
          g.fillStyle(0xfdcb6e);
          g.fillCircle(cx, cy, r + 1);
          break;
      }
    }

    // Snakes — real snake rendering
    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      this.drawRealSnake(g, snake);
    }
  }

  shutdown(): void {
    for (const { el, event, fn } of this.domListeners) {
      el.removeEventListener(event, fn);
    }
    this.domListeners = [];
    if (this.challengeTimeoutId !== null) {
      clearTimeout(this.challengeTimeoutId);
      this.challengeTimeoutId = null;
    }
    const overlay = document.getElementById('challenge-overlay');
    if (overlay) overlay.classList.add('hidden');
  }
}

export function createGame(opts: { bodyColor?: number; headColor?: number } = {}): GameController {
  if (opts.bodyColor !== undefined) humanBodyColor = opts.bodyColor;
  if (opts.headColor !== undefined) humanHeadColor = opts.headColor;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: CANVAS_W,
    height: CANVAS_H,
    parent: 'game-root',
    backgroundColor: '#0d1a0d',
    scene: SnakeScene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  return {
    destroy(): void {
      game.destroy(true);
    },
  };
}
