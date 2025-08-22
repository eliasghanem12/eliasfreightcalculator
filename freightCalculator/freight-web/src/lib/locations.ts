
export type PortLike = {
  id: string;
  name: string;
  country: string;
  type: "airport" | "seaport" | "warehouse";
  city?: string;
  notes?: string;
};

export const COUNTRY_NAMES: Record<string, string> = {
 AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AS: "American Samoa",
  AD: "Andorra",
  AO: "Angola",
  AI: "Anguilla",
  AQ: "Antarctica",
  AG: "Antigua and Barbuda",
  AR: "Argentina",
  AM: "Armenia",
  AW: "Aruba",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BY: "Belarus",
  BE: "Belgium",
  BZ: "Belize",
  BJ: "Benin",
  BM: "Bermuda",
  BT: "Bhutan",
  BO: "Bolivia",
  BA: "Bosnia and Herzegovina",
  BW: "Botswana",
  BR: "Brazil",
  BN: "Brunei Darussalam",
  BG: "Bulgaria",
  BF: "Burkina Faso",
  BI: "Burundi",
  KH: "Cambodia",
  CM: "Cameroon",
  CA: "Canada",
  CV: "Cape Verde",
  KY: "Cayman Islands",
  CF: "Central African Republic",
  TD: "Chad",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  KM: "Comoros",
  CG: "Congo",
  CD: "Congo, Democratic Republic",
  CR: "Costa Rica",
  CI: "Côte d'Ivoire",
  HR: "Croatia",
  CU: "Cuba",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  DJ: "Djibouti",
  DM: "Dominica",
  DO: "Dominican Republic",
  EC: "Ecuador",
  EG: "Egypt",
  SV: "El Salvador",
  GQ: "Equatorial Guinea",
  ER: "Eritrea",
  EE: "Estonia",
  ET: "Ethiopia",
  FJ: "Fiji",
  FI: "Finland",
  FR: "France",
  GA: "Gabon",
  GM: "Gambia",
  GE: "Georgia",
  DE: "Germany",
  GH: "Ghana",
  GR: "Greece",
  GD: "Grenada",
  GT: "Guatemala",
  GN: "Guinea",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HT: "Haiti",
  HN: "Honduras",
  HK: "Hong Kong",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IR: "Iran",
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",
  JM: "Jamaica",
  JP: "Japan",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KR: "Korea (South)",
  KW: "Kuwait",
  KG: "Kyrgyzstan",
  LA: "Lao PDR",
  LV: "Latvia",
  LB: "Lebanon",
  LR: "Liberia",
  LY: "Libya",
  LT: "Lithuania",
  LU: "Luxembourg",
  MO: "Macao",
  MG: "Madagascar",
  MW: "Malawi",
  MY: "Malaysia",
  MV: "Maldives",
  ML: "Mali",
  MT: "Malta",
  MQ: "Martinique",
  MR: "Mauritania",
  MU: "Mauritius",
  MX: "Mexico",
  MD: "Moldova",
  MC: "Monaco",
  MN: "Mongolia",
  ME: "Montenegro",
  MA: "Morocco",
  MZ: "Mozambique",
  MM: "Myanmar",
  NA: "Namibia",
  NP: "Nepal",
  NL: "Netherlands",
  NZ: "New Zealand",
  NI: "Nicaragua",
  NE: "Niger",
  NG: "Nigeria",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PA: "Panama",
  PG: "Papua New Guinea",
  PY: "Paraguay",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  QA: "Qatar",
  RO: "Romania",
  RU: "Russian Federation",
  RW: "Rwanda",
  SA: "Saudi Arabia",
  RS: "Serbia",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  ZA: "South Africa",
  ES: "Spain",
  LK: "Sri Lanka",
  SD: "Sudan",
  SE: "Sweden",
  CH: "Switzerland",
  SY: "Syria",
  TW: "Taiwan",
  TJ: "Tajikistan",
  TZ: "Tanzania",
  TH: "Thailand",
  TL: "Timor-Leste",
  TG: "Togo",
  TT: "Trinidad and Tobago",
  TN: "Tunisia",
  TR: "Türkiye",
  UG: "Uganda",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VE: "Venezuela",
  VN: "Viet Nam",
  YE: "Yemen",
  ZM: "Zambia",
  ZW: "Zimbabwe",
};
// --- GCC & North Africa: Key Hubs ---

export const AIRPORTS: PortLike[] = [
  // UAE
  { id:"DXB", name:"Dubai Intl (DXB)", country:"AE", type:"airport", city:"Dubai" },
  { id:"AUH", name:"Abu Dhabi Intl (AUH)", country:"AE", type:"airport", city:"Abu Dhabi" },
  { id:"SHJ", name:"Sharjah Intl (SHJ)", country:"AE", type:"airport", city:"Sharjah" },

  // Saudi Arabia
  { id:"RUH", name:"King Khalid Intl (RUH)", country:"SA", type:"airport", city:"Riyadh" },
  { id:"JED", name:"King Abdulaziz Intl (JED)", country:"SA", type:"airport", city:"Jeddah" },
  { id:"DMM", name:"King Fahd Intl (DMM)", country:"SA", type:"airport", city:"Dammam" },

  // Qatar
  { id:"DOH", name:"Hamad Intl (DOH)", country:"QA", type:"airport", city:"Doha" },

  // Kuwait
  { id:"KWI", name:"Kuwait Intl (KWI)", country:"KW", type:"airport", city:"Kuwait City" },

  // Oman
  { id:"MCT", name:"Muscat Intl (MCT)", country:"OM", type:"airport", city:"Muscat" },

  // Bahrain
  { id:"BAH", name:"Bahrain Intl (BAH)", country:"BH", type:"airport", city:"Manama" },

  // Egypt
  { id:"CAI", name:"Cairo Intl (CAI)", country:"EG", type:"airport", city:"Cairo" },
  { id:"ALY", name:"Alexandria Borg El Arab (HBE)", country:"EG", type:"airport", city:"Alexandria" },

  // Morocco
  { id:"CMN", name:"Casablanca Mohammed V Intl (CMN)", country:"MA", type:"airport", city:"Casablanca" },

  // Tunisia
  { id:"TUN", name:"Tunis Carthage Intl (TUN)", country:"TN", type:"airport", city:"Tunis" },

  // Algeria
  { id:"ALG", name:"Houari Boumediene (ALG)", country:"DZ", type:"airport", city:"Algiers" },
];

export const SEAPORTS: PortLike[] = [
  // UAE
  { id:"AEJEA", name:"Jebel Ali Port", country:"AE", type:"seaport", city:"Dubai" },
  { id:"AESHJ", name:"Port of Sharjah (Khalid)", country:"AE", type:"seaport", city:"Sharjah" },
  { id:"AEAUH", name:"Port Khalifa", country:"AE", type:"seaport", city:"Abu Dhabi" },

  // Saudi Arabia
  { id:"SAJED", name:"Jeddah Islamic Port", country:"SA", type:"seaport", city:"Jeddah" },
  { id:"SADMM", name:"King Abdulaziz Port", country:"SA", type:"seaport", city:"Dammam" },

  // Qatar
  { id:"QADOH", name:"Hamad Port", country:"QA", type:"seaport", city:"Doha" },

  // Oman
  { id:"OMMCT", name:"Port Sultan Qaboos", country:"OM", type:"seaport", city:"Muscat" },
  { id:"OMSLL", name:"Port of Salalah", country:"OM", type:"seaport", city:"Salalah" },

  // Bahrain
  { id:"BHMIN", name:"Mina Salman Port", country:"BH", type:"seaport", city:"Manama" },

  // Egypt
  { id:"EGALY", name:"Port of Alexandria", country:"EG", type:"seaport", city:"Alexandria" },
  { id:"EGPSD", name:"Port Said", country:"EG", type:"seaport", city:"Port Said" },
  { id:"EGAIN", name:"Ain Sokhna Port", country:"EG", type:"seaport", city:"Suez" },

  // Morocco
  { id:"MAPTM", name:"Port of Tangier Med", country:"MA", type:"seaport", city:"Tangier" },
  { id:"MACAS", name:"Port of Casablanca", country:"MA", type:"seaport", city:"Casablanca" },

  // Tunisia
  { id:"TNRAD", name:"Port of Radès", country:"TN", type:"seaport", city:"Tunis" },

  // Algeria
  { id:"DZALG", name:"Port of Algiers", country:"DZ", type:"seaport", city:"Algiers" },
];

export const WAREHOUSES: PortLike[] = [
  // UAE
  { id:"AE-DXB-WH1", name:"Dubai Logistics City", country:"AE", type:"warehouse", city:"Dubai" },
  { id:"AE-AUH-WH1", name:"KIZAD Logistics Zone", country:"AE", type:"warehouse", city:"Abu Dhabi" },

  // Saudi Arabia
  { id:"SA-RUH-WH1", name:"Riyadh Dry Port & Logistics Zone", country:"SA", type:"warehouse", city:"Riyadh" },
  { id:"SA-JED-WH1", name:"Jeddah Logistics Hub", country:"SA", type:"warehouse", city:"Jeddah" },

  // Qatar
  { id:"QA-DOH-WH1", name:"Qatar Logistics Village", country:"QA", type:"warehouse", city:"Doha" },

  // Oman
  { id:"OM-MCT-WH1", name:"Muscat Logistics Hub", country:"OM", type:"warehouse", city:"Muscat" },
  { id:"OM-SLL-WH1", name:"Salalah Free Zone", country:"OM", type:"warehouse", city:"Salalah" },

  // Egypt
  { id:"EG-CAI-WH1", name:"Cairo Dry Port", country:"EG", type:"warehouse", city:"Cairo" },
  { id:"EG-ALY-WH1", name:"Alexandria Logistics Hub", country:"EG", type:"warehouse", city:"Alexandria" },

  // Morocco
  { id:"MA-CAS-WH1", name:"Casablanca Logistics Free Zone", country:"MA", type:"warehouse", city:"Casablanca" },
  { id:"MA-TNG-WH1", name:"Tangier Med Logistics Zone", country:"MA", type:"warehouse", city:"Tangier" },
];






export const byCountry = (list: PortLike[], iso2?:string) =>
  !iso2 ? list : list.filter(x => x.country === (iso2||"").toUpperCase());
