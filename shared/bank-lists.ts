// ── Static Bank Lists for Stripe Countries ──────────────────────
// Paystack countries get dynamic lists from the Paystack API.
// Stripe countries use these static lists of major banks + "Other" for manual entry.

export interface StaticBank {
  name: string;
  code: string;
  country?: string;
  currency?: string;
  type?: string;
}

export const STATIC_BANK_LISTS: Record<string, StaticBank[]> = {
  // ── United States ──
  US: [
    { name: 'JPMorgan Chase', code: 'CHASE' },
    { name: 'Bank of America', code: 'BOA' },
    { name: 'Wells Fargo', code: 'WF' },
    { name: 'Citibank', code: 'CITI' },
    { name: 'U.S. Bancorp', code: 'USB' },
    { name: 'PNC Financial', code: 'PNC' },
    { name: 'Goldman Sachs', code: 'GS' },
    { name: 'Truist Financial', code: 'TRUIST' },
    { name: 'Capital One', code: 'CAPONE' },
    { name: 'TD Bank', code: 'TD' },
    { name: 'Charles Schwab', code: 'SCHWAB' },
    { name: 'Morgan Stanley', code: 'MS' },
    { name: 'HSBC USA', code: 'HSBC_US' },
    { name: 'Ally Financial', code: 'ALLY' },
    { name: 'Fifth Third Bank', code: 'FIFTH_THIRD' },
    { name: 'KeyBank', code: 'KEY' },
    { name: 'Regions Financial', code: 'REGIONS' },
    { name: 'M&T Bank', code: 'MT' },
    { name: 'Citizens Financial', code: 'CITIZENS' },
    { name: 'Silicon Valley Bank', code: 'SVB' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Canada ──
  CA: [
    { name: 'Royal Bank of Canada', code: 'RBC' },
    { name: 'Toronto-Dominion Bank', code: 'TD_CA' },
    { name: 'Bank of Nova Scotia', code: 'SCOTIABANK' },
    { name: 'Bank of Montreal', code: 'BMO' },
    { name: 'Canadian Imperial Bank of Commerce', code: 'CIBC' },
    { name: 'National Bank of Canada', code: 'NBC' },
    { name: 'Desjardins Group', code: 'DESJARDINS' },
    { name: 'HSBC Canada', code: 'HSBC_CA' },
    { name: 'Laurentian Bank', code: 'LAURENTIAN' },
    { name: 'Tangerine', code: 'TANGERINE' },
    { name: 'Simplii Financial', code: 'SIMPLII' },
    { name: 'EQ Bank', code: 'EQ' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── United Kingdom ──
  GB: [
    { name: 'Barclays', code: 'BARC' },
    { name: 'HSBC UK', code: 'HSBC' },
    { name: 'Lloyds Banking Group', code: 'LLOYDS' },
    { name: 'NatWest Group', code: 'NATWEST' },
    { name: 'Standard Chartered', code: 'STANCHART' },
    { name: 'Santander UK', code: 'SANTANDER_UK' },
    { name: 'Halifax', code: 'HALIFAX' },
    { name: 'Nationwide', code: 'NATIONWIDE' },
    { name: 'TSB Bank', code: 'TSB' },
    { name: 'Metro Bank', code: 'METRO' },
    { name: 'Monzo', code: 'MONZO' },
    { name: 'Starling Bank', code: 'STARLING' },
    { name: 'Revolut', code: 'REVOLUT' },
    { name: 'Virgin Money', code: 'VIRGIN' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Germany ──
  DE: [
    { name: 'Deutsche Bank', code: 'DEUTSCHE' },
    { name: 'Commerzbank', code: 'COMMERZ' },
    { name: 'DZ Bank', code: 'DZ' },
    { name: 'KfW', code: 'KFW' },
    { name: 'Sparkassen', code: 'SPARKASSEN' },
    { name: 'Postbank', code: 'POSTBANK' },
    { name: 'ING Germany', code: 'ING_DE' },
    { name: 'HypoVereinsbank', code: 'HVB' },
    { name: 'N26', code: 'N26' },
    { name: 'Volksbanken Raiffeisenbanken', code: 'VOLKSBANK' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── France ──
  FR: [
    { name: 'BNP Paribas', code: 'BNP' },
    { name: 'Crédit Agricole', code: 'CREDIT_AGRICOLE' },
    { name: 'Société Générale', code: 'SOCGEN' },
    { name: 'BPCE (Banque Populaire / Caisse d\'Épargne)', code: 'BPCE' },
    { name: 'Crédit Mutuel', code: 'CREDIT_MUTUEL' },
    { name: 'La Banque Postale', code: 'BANQUE_POSTALE' },
    { name: 'HSBC France', code: 'HSBC_FR' },
    { name: 'LCL', code: 'LCL' },
    { name: 'Boursorama', code: 'BOURSORAMA' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Spain ──
  ES: [
    { name: 'Banco Santander', code: 'SANTANDER' },
    { name: 'BBVA', code: 'BBVA' },
    { name: 'CaixaBank', code: 'CAIXABANK' },
    { name: 'Banco Sabadell', code: 'SABADELL' },
    { name: 'Bankinter', code: 'BANKINTER' },
    { name: 'Unicaja', code: 'UNICAJA' },
    { name: 'Kutxabank', code: 'KUTXABANK' },
    { name: 'Ibercaja', code: 'IBERCAJA' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Italy ──
  IT: [
    { name: 'Intesa Sanpaolo', code: 'INTESA' },
    { name: 'UniCredit', code: 'UNICREDIT' },
    { name: 'Banco BPM', code: 'BANCO_BPM' },
    { name: 'Monte dei Paschi di Siena', code: 'MPS' },
    { name: 'BPER Banca', code: 'BPER' },
    { name: 'Mediobanca', code: 'MEDIOBANCA' },
    { name: 'Crédit Agricole Italia', code: 'CA_IT' },
    { name: 'Fineco', code: 'FINECO' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Netherlands ──
  NL: [
    { name: 'ING Group', code: 'ING' },
    { name: 'Rabobank', code: 'RABOBANK' },
    { name: 'ABN AMRO', code: 'ABN_AMRO' },
    { name: 'de Volkbank', code: 'VOLKBANK' },
    { name: 'Triodos Bank', code: 'TRIODOS' },
    { name: 'bunq', code: 'BUNQ' },
    { name: 'Knab', code: 'KNAB' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Belgium ──
  BE: [
    { name: 'BNP Paribas Fortis', code: 'BNP_FORTIS' },
    { name: 'KBC', code: 'KBC' },
    { name: 'Belfius', code: 'BELFIUS' },
    { name: 'ING Belgium', code: 'ING_BE' },
    { name: 'Argenta', code: 'ARGENTA' },
    { name: 'Crelan', code: 'CRELAN' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Austria ──
  AT: [
    { name: 'Erste Group', code: 'ERSTE' },
    { name: 'Raiffeisen Bank International', code: 'RBI' },
    { name: 'BAWAG', code: 'BAWAG' },
    { name: 'Oberbank', code: 'OBERBANK' },
    { name: 'Bank Austria (UniCredit)', code: 'BANK_AUSTRIA' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Switzerland ──
  CH: [
    { name: 'UBS', code: 'UBS' },
    { name: 'Credit Suisse', code: 'CS' },
    { name: 'Zürcher Kantonalbank', code: 'ZKB' },
    { name: 'Raiffeisen Switzerland', code: 'RAIFFEISEN_CH' },
    { name: 'PostFinance', code: 'POSTFINANCE' },
    { name: 'Julius Baer', code: 'JULIUS_BAER' },
    { name: 'Banque Cantonale Vaudoise', code: 'BCV' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Sweden ──
  SE: [
    { name: 'Nordea', code: 'NORDEA_SE' },
    { name: 'SEB', code: 'SEB' },
    { name: 'Handelsbanken', code: 'HANDELS' },
    { name: 'Swedbank', code: 'SWEDBANK' },
    { name: 'Skandiabanken', code: 'SKANDIA' },
    { name: 'Länsförsäkringar Bank', code: 'LF_BANK' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Norway ──
  NO: [
    { name: 'DNB', code: 'DNB' },
    { name: 'Nordea Norway', code: 'NORDEA_NO' },
    { name: 'SpareBank 1', code: 'SPAREBANK1' },
    { name: 'Handelsbanken Norway', code: 'HANDELS_NO' },
    { name: 'Sbanken', code: 'SBANKEN' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Denmark ──
  DK: [
    { name: 'Danske Bank', code: 'DANSKE' },
    { name: 'Nordea Denmark', code: 'NORDEA_DK' },
    { name: 'Jyske Bank', code: 'JYSKE' },
    { name: 'Nykredit', code: 'NYKREDIT' },
    { name: 'Sydbank', code: 'SYDBANK' },
    { name: 'Lunar', code: 'LUNAR' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Finland ──
  FI: [
    { name: 'Nordea Finland', code: 'NORDEA_FI' },
    { name: 'OP Financial Group', code: 'OP' },
    { name: 'Danske Bank Finland', code: 'DANSKE_FI' },
    { name: 'S-Pankki', code: 'S_PANKKI' },
    { name: 'Aktia', code: 'AKTIA' },
    { name: 'Handelsbanken Finland', code: 'HANDELS_FI' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Ireland ──
  IE: [
    { name: 'Bank of Ireland', code: 'BOI' },
    { name: 'AIB', code: 'AIB' },
    { name: 'Permanent TSB', code: 'PTSB' },
    { name: 'Ulster Bank', code: 'ULSTER' },
    { name: 'KBC Ireland', code: 'KBC_IE' },
    { name: 'An Post Money', code: 'AN_POST' },
    { name: 'Revolut Ireland', code: 'REVOLUT_IE' },
    { name: 'N26 Ireland', code: 'N26_IE' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Portugal ──
  PT: [
    { name: 'Caixa Geral de Depósitos', code: 'CGD' },
    { name: 'Millennium BCP', code: 'BCP' },
    { name: 'Novo Banco', code: 'NOVO_BANCO' },
    { name: 'Santander Portugal', code: 'SANTANDER_PT' },
    { name: 'BPI (CaixaBank)', code: 'BPI' },
    { name: 'ActivoBank', code: 'ACTIVO' },
    { name: 'Other', code: 'OTHER' },
  ],

  // ── Australia ──
  AU: [
    { name: 'Commonwealth Bank', code: 'CBA' },
    { name: 'Westpac', code: 'WESTPAC' },
    { name: 'ANZ', code: 'ANZ' },
    { name: 'National Australia Bank', code: 'NAB' },
    { name: 'Macquarie Group', code: 'MACQUARIE' },
    { name: 'Bendigo and Adelaide Bank', code: 'BENDIGO' },
    { name: 'Bank of Queensland', code: 'BOQ' },
    { name: 'Suncorp Bank', code: 'SUNCORP' },
    { name: 'ING Australia', code: 'ING_AU' },
    { name: 'Up Bank', code: 'UP' },
    { name: 'Other', code: 'OTHER' },
  ],
};
