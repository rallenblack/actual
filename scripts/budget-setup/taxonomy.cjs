/**
 * Category taxonomy + auto-categorization rules for the household budget.
 *
 * EDIT THIS FILE to taste, then run `node scripts/budget-setup/setup.cjs`.
 * Re-running is safe (idempotent): existing groups/categories/rules are
 * detected by name and skipped, so you can tweak and re-run.
 *
 * `match` = list of substrings checked against a transaction's *imported
 * payee* (the raw text the bank sends). Matching is case-insensitive and
 * uses "contains", so keep entries short and distinctive. One rule is
 * created per category, OR-ing all of its match strings together.
 *
 * Notes on ambiguous merchants:
 *  - WALMART / COSTCO default to Groceries (most household spend lands there).
 *  - TARGET defaults to Shopping & Household (you have a Target card).
 *  Move them if your spending says otherwise.
 *
 * Merchant lists are seeded for a Utah household (Zions/UCCU) — adjust freely.
 */

/** @type {{group: string, is_income?: boolean, categories: {name: string, match?: string[]}[]}[]} */
const taxonomy = [
  {
    group: 'Income',
    is_income: true,
    categories: [
      { name: 'Paychecks', match: ['PAYROLL', 'DIRECT DEP', 'DIRECT DEPOSIT', 'DD ACH'] },
      { name: 'Interest', match: ['INTEREST PAYMENT', 'INTEREST EARNED', 'DIVIDEND'] },
      { name: 'Reimbursements' },
      { name: 'Other Income' },
    ],
  },
  {
    group: 'Bills & Utilities',
    categories: [
      { name: 'Mortgage / Rent' },
      { name: 'Electric', match: ['ROCKY MOUNTAIN POWER', 'ROCKY MTN POWER'] },
      { name: 'Gas / Heating', match: ['DOMINION ENERGY', 'DOMINION'] },
      { name: 'Water / Sewer / Trash' },
      { name: 'Internet', match: ['XFINITY', 'COMCAST', 'GOOGLE FIBER', 'CENTURYLINK', 'QUANTUM FIBER', 'UTOPIA'] },
      { name: 'Mobile Phone', match: ['VERIZON', 'T-MOBILE', 'TMOBILE', 'AT&T', 'VISIBLE', 'MINT MOBILE', 'XFINITY MOBILE'] },
      { name: 'Insurance', match: ['GEICO', 'STATE FARM', 'PROGRESSIVE', 'ALLSTATE', 'FARMERS INS', 'USAA', 'BEAR RIVER MUTUAL'] },
      { name: 'Subscriptions & Streaming', match: ['NETFLIX', 'HULU', 'DISNEYPLUS', 'DISNEY PLUS', 'SPOTIFY', 'YOUTUBEPREMIUM', 'HBO', 'PARAMOUNT+', 'PEACOCK', 'APPLE.COM/BILL', 'AMAZON PRIME', 'PRIME VIDEO', 'AUDIBLE', 'ADOBE', 'DROPBOX', 'CHATGPT', 'OPENAI'] },
    ],
  },
  {
    group: 'Everyday',
    categories: [
      { name: 'Groceries', match: ['WALMART', 'WAL-MART', 'SMITHS', "SMITH'S", 'HARMONS', 'MACEYS', "MACEY'S", 'KROGER', 'COSTCO WHSE', 'COSTCO', "SAM'S CLUB", 'SAMS CLUB', 'TRADER JOE', 'WHOLE FOODS', 'WINCO', 'SPROUTS', 'ALDI', 'INSTACART', 'ASSOCIATED FOOD'] },
      { name: 'Restaurants & Dining', match: ['MCDONALD', 'CHICK-FIL-A', 'CHICKFILA', 'TACO BELL', "WENDY'S", 'BURGER KING', 'CHIPOTLE', 'PANDA EXPRESS', 'SUBWAY', 'CAFE RIO', 'COSTA VIDA', 'OLIVE GARDEN', 'TEXAS ROADHOUSE', 'IN-N-OUT', 'IN N OUT', 'CRUMBL', 'DOORDASH', 'UBER EATS', 'UBEREATS', 'GRUBHUB', 'DOMINO', 'PIZZA', 'LITTLE CAESAR', 'PAPA JOHN'] },
      { name: 'Coffee & Treats', match: ['STARBUCKS', 'DUTCH BROS', 'SWIG', 'SODALICIOUS', 'BEANS & BREWS', 'FIIZ'] },
      { name: 'Fuel & Gas', match: ['MAVERIK', 'CHEVRON', 'SINCLAIR', 'SHELL OIL', 'SHELL SERVICE', 'EXXON', 'PHILLIPS 66', 'CONOCO', 'TEXACO', '7-ELEVEN', 'COSTCO GAS', 'PILOT', "LOVE'S"] },
      { name: 'Transportation & Parking', match: ['UBER ', 'LYFT', 'UTA ', 'UTAH TRANSIT', 'PARKING'] },
      { name: 'Auto & Maintenance', match: ['JIFFY LUBE', 'LES SCHWAB', 'BIG O TIRES', 'AUTOZONE', "O'REILLY", 'OREILLY', 'DISCOUNT TIRE', 'BURT BROTHERS', 'MASTER MUFFLER'] },
      { name: 'Shopping & Household', match: ['AMAZON', 'AMZN', 'TARGET', 'HOME DEPOT', 'LOWES', "LOWE'S", 'IKEA', 'DOLLAR TREE', 'DOLLAR GENERAL', 'BED BATH', 'BEST BUY'] },
      { name: 'Personal Care', match: ['GREAT CLIPS', 'ULTA', 'SEPHORA', 'SALON', 'BARBER', 'MASSAGE'] },
      { name: 'Health & Pharmacy', match: ['CVS', 'WALGREENS', 'RITE AID', 'INTERMOUNTAIN', 'REVERE HEALTH', 'MOUNTAINSTAR', 'DENTAL', 'PHARMACY'] },
      { name: 'Clothing', match: ['NIKE', 'OLD NAVY', 'KOHLS', "KOHL'S", 'ROSS STORE', 'TJ MAXX', 'TJMAXX', 'NORDSTROM', 'LULULEMON', 'DSW', 'FOOT LOCKER', 'H&M'] },
      { name: 'Pets', match: ['PETSMART', 'PETCO', 'CHEWY', 'BANFIELD'] },
    ],
  },
  {
    group: 'Lifestyle',
    categories: [
      { name: 'Entertainment', match: ['CINEMARK', 'MEGAPLEX', 'AMC ', 'STEAM GAMES', 'PLAYSTATION', 'XBOX', 'NINTENDO', 'TICKETMASTER', 'SEATGEEK', 'TOPGOLF'] },
      { name: 'Hobbies & Recreation', match: ['REI', 'SCHEELS', 'SPORTSMAN', 'CABELA', 'BASS PRO', 'HOBBY LOBBY', 'MICHAELS', 'JOANN', 'GUITAR CENTER'] },
      { name: 'Fitness', match: ['VASA', 'PLANET FIT', 'EOS FITNESS', 'LIFE TIME', "GOLD'S GYM", 'GOLDS GYM', 'CRUNCH FITNESS', 'ORANGETHEORY', 'PELOTON'] },
      { name: 'Travel & Vacation', match: ['DELTA AIR', 'SOUTHWEST', 'UNITED AIR', 'AMERICAN AIR', 'FRONTIER', 'ALLEGIANT', 'MARRIOTT', 'HILTON', 'HYATT', 'AIRBNB', 'VRBO', 'EXPEDIA', 'BOOKING.COM', 'ENTERPRISE RENT', 'HERTZ', 'TURO'] },
      { name: 'Gifts' },
      { name: 'Donations & Giving' },
      { name: 'Kids & Childcare' },
      { name: 'Education', match: ['TUITION', 'UDEMY', 'COURSERA', 'CHEGG'] },
    ],
  },
  {
    group: 'Financial',
    categories: [
      { name: 'Bank Fees', match: ['OVERDRAFT', 'SERVICE CHARGE', 'ATM FEE', 'NSF FEE', 'INTEREST CHARGE', 'ANNUAL FEE', 'LATE FEE'] },
      { name: 'Taxes', match: ['IRS ', 'TREAS TAX', 'UTAH STATE TAX', 'FRANCHISE TAX'] },
      { name: 'Investments & Savings', match: ['FIDELITY', 'VANGUARD', 'SCHWAB', 'ROBINHOOD', 'ACORNS', 'BETTERMENT', 'WEALTHFRONT'] },
    ],
  },
  {
    // Envelope categories for goals / rollover sinking funds (no auto-match —
    // you fund these from the budget each month).
    group: 'Savings Goals',
    categories: [
      { name: 'Emergency Fund' },
      { name: 'Vacation Fund' },
      { name: 'Car Replacement' },
      { name: 'Home Maintenance' },
      { name: 'Christmas & Gifts' },
      { name: 'Annual / Irregular Bills' },
    ],
  },
];

module.exports = { taxonomy };
