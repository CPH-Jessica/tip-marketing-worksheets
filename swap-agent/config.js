// Clark Publishing House — swap agent configuration.
// Pen-name data sourced from the CPH Newsletter Swap Operations Guide and the
// swap-*.md prompt files. Edit here when magnets, lists, or genre rules change.

module.exports = {
  platforms: {
    bookclicker: {
      base: "https://www.bookclicker.com",
      swapsUrl: "https://www.bookclicker.com/my_swaps",
      marketplaceUrl: "https://www.bookclicker.com/marketplace",
    },
    bookswappy: {
      base: "https://bookswappy.com",
      swapsUrl: "https://bookswappy.com/dashboard/swaps",
      marketplaceUrl: "https://bookswappy.com/dashboard/marketplace",
    },
    bookfunnel: {
      base: "https://dashboard.bookfunnel.com",
      swapsUrl: "https://dashboard.bookfunnel.com/swaps",
      requestsUrl: "https://dashboard.bookfunnel.com/swaps/requests",
    },
  },

  // Rules that apply to every pen name when booking.
  globalRules: {
    freeOnly: true,            // never book anything with a dollar amount
    maxPerAuthor: 1,           // unique authors only (single-magnet pen names)
    excludeAlways: ["erotica", "lgbtq"],
  },

  penNames: {
    connie: {
      label: "Constance Ruth Clark",
      sendDay: "Wednesday",
      magnets: ["Hidden Heiress", "Wild Country"],
      bookclickerCalendarId: 33482,
      bookclickerList: "Constance Ruth Clark",
      bookswappyList: "Constance Ruth Clark",
      bookswappyCalendarId: "cml17iera00aqnz1dqszp3dje",
      genresInclude: ["small town", "contemporary", "billionaire", "romantic suspense", "sweet", "steamy contemporary"],
      genresExclude: ["dark", "mafia", "shifter", "pnr", "paranormal", "bdsm", "romantasy", "reverse harem", "clean only", "historical", "regency"],
    },
    ruthie: {
      label: "Ruthie Clark",
      sendDay: "Wednesday",
      magnets: ["Alpha Wolf", "Belle's Revelation"],
      bookclickerCalendarId: 38487,
      bookclickerList: "Ruthie Clark",
      bookswappyList: "Ruthie Clark Dive Into Darkness",
      bookswappyCalendarId: "cml17ieyz00bmnz1djkmglgtv",
      genresInclude: ["dark", "romantasy", "shifter", "fae", "fairytale", "monster", "pnr", "paranormal", "spicy"],
      genresExclude: ["clean", "sweet only", "historical", "regency", "contemporary only"],
    },
    sage: {
      label: "Sage Kennedy",
      sendDay: "Tuesday",
      magnets: ["Snowed In With My Billionaire Ex"],
      bookclickerCalendarId: 73586,
      bookclickerList: "Sage Kennedy",
      bookswappyList: "Sage Kennedy",
      bookswappyCalendarId: "cml17if1o00bwnz1dtjhbdven",
      genresInclude: ["rom-com", "romcom", "billionaire", "royal", "holiday", "sports", "hockey", "contemporary"],
      genresExclude: ["clean only", "historical", "regency", "dark", "pnr", "paranormal", "fantasy"],
    },
    marjorie: {
      label: "Marjorie Adams",
      sendDay: "Thursday",
      magnets: ["Not A Wicked Stepmother"],
      bookclickerCalendarId: 72438,
      bookclickerList: "Marjorie Adams",
      bookswappyList: "Marjorie's Tea & Tattle Newsletter",
      bookswappyCalendarId: "cml17if0s00bunz1duaqhszhq",
      genresInclude: ["regency", "historical", "sweet", "clean", "jaff", "period"],
      genresExclude: ["steamy", "spicy", "explicit", "dark", "pnr", "paranormal", "shifter", "fantasy", "billionaire"],
    },
    kelsey: {
      label: "Kelsey Croft",
      sendDay: null, // check schedule
      magnets: ["Before the Dawn"],
      bookclickerCalendarId: null,
      bookclickerList: "Kelsey Croft",
      bookswappyList: "Kelsey Croft",
      bookswappyCalendarId: null,
      genresInclude: ["vampire", "paranormal", "pnr", "rom-com", "romcom", "supernatural"],
      genresExclude: ["clean only", "historical", "regency", "non-paranormal"],
    },
    nora: {
      label: "Nora Brooks",
      sendDay: null, // set when her cadence is decided
      magnets: ["Sweet on the Fire Chief"],
      bookclickerCalendarId: null, // create her calendar, then fill in
      bookclickerList: "Nora Brooks",
      bookswappyList: "Nora Brooks",
      bookswappyCalendarId: null,
      genresInclude: ["sweet", "clean", "small town", "firefighter", "contemporary", "hometown"],
      genresExclude: ["steamy", "spicy", "explicit", "dark", "pnr", "paranormal", "historical"],
    },
    freebie: {
      label: "Jess's Freebie Finds",
      sendDay: "Friday",
      magnets: [],
      bookclickerCalendarId: 33481,
      bookclickerList: "Jess' Freebies",
      bookswappyList: "Freebie Friday",
      bookswappyCalendarId: "cml17if0700bsnz1dju7i3cs0",
      genresInclude: ["romance"], // wildcard — any romance
      genresExclude: [],
    },
  },
};
