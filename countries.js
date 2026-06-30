// Shared country library. Used to populate the country filter dropdown
// and to center the map when a country is selected.
// This is intentionally a static list, not an API call, so the site
// works fully offline once loaded.

const COUNTRY_LIBRARY = [
  { name: "United States", lat: 38.0, lng: -97.0 },
  { name: "China", lat: 35.0, lng: 103.0 },
  { name: "Taiwan", lat: 23.7, lng: 121.0 },
  { name: "Japan", lat: 36.2, lng: 138.3 },
  { name: "South Korea", lat: 36.5, lng: 127.8 },
  { name: "North Korea", lat: 40.3, lng: 127.5 },
  { name: "Russia", lat: 61.5, lng: 105.3 },
  { name: "India", lat: 22.0, lng: 79.0 },
  { name: "European Union", lat: 50.8, lng: 4.3 },
  { name: "Germany", lat: 51.2, lng: 10.4 },
  { name: "France", lat: 46.6, lng: 2.2 },
  { name: "United Kingdom", lat: 54.0, lng: -2.0 },
  { name: "Netherlands", lat: 52.1, lng: 5.3 },
  { name: "Saudi Arabia", lat: 24.0, lng: 45.0 },
  { name: "Iran", lat: 32.4, lng: 53.7 },
  { name: "Israel", lat: 31.0, lng: 34.8 },
  { name: "Australia", lat: -25.0, lng: 133.0 },
  { name: "Indonesia", lat: -0.8, lng: 113.9 },
  { name: "Vietnam", lat: 14.1, lng: 108.3 },
  { name: "Philippines", lat: 12.9, lng: 121.8 },
  { name: "Brazil", lat: -14.2, lng: -51.9 },
  { name: "Mexico", lat: 23.6, lng: -102.5 },
  { name: "Canada", lat: 56.1, lng: -106.3 },
  { name: "South Africa", lat: -30.6, lng: 22.9 },
  { name: "Egypt", lat: 26.8, lng: 30.8 },
  { name: "Turkey", lat: 38.9, lng: 35.2 },
  { name: "Ukraine", lat: 48.4, lng: 31.2 },
  { name: "Poland", lat: 51.9, lng: 19.1 },
  { name: "Singapore", lat: 1.35, lng: 103.8 },
  { name: "Malaysia", lat: 4.2, lng: 101.9 }
];

const TOPIC_LIBRARY = [
  "Economic Security",
  "Trade",
  "Export Control",
  "Sanctions",
  "Supply Chain",
  "Semiconductor",
  "Rare Earth",
  "AI",
  "Energy",
  "Defense",
  "Cyber",
  "Investment Screening",
  "CBAM",
  "Human Rights",
  "Diplomacy"
];
