// Maps common book-publisher names to their primary website domain.
// Used by publisher-aware metadata lookup.

const PUBLISHER_DOMAINS: Array<{ match: RegExp; domain: string }> = [
  { match: /penguin\s*random\s*house|penguin\b|random\s*house|vintage|knopf|doubleday|crown(\s*publishing)?|bantam|dell\s*books?|del\s*rey|ballantine|berkley|arrow|century|razorbill|portfolio|putnam|riverhead|viking|plume|signet|ace|roc|daw/i, domain: 'penguinrandomhouse.com' },
  { match: /harper\s*collins|harper\s*one|harper\s*perennial|william\s*morrow|avon|harperteen|ecco|harpervoyager|mariner|amistad/i, domain: 'harpercollins.com' },
  { match: /simon\s*(&|and)\s*schuster|scribner|atria|pocket\s*books?|gallery\s*books?/i, domain: 'simonandschuster.com' },
  { match: /hachette|little,?\s*brown|orbit|grand\s*central|hyperion/i, domain: 'hachettebookgroup.com' },
  { match: /macmillan|st\.?\s*martin('s)?|tor(\s*books)?|tor\.com|farrar,?\s*straus|henry\s*holt|picador/i, domain: 'us.macmillan.com' },
  { match: /scholastic/i, domain: 'scholastic.com' },
  { match: /bloomsbury/i, domain: 'bloomsbury.com' },
  { match: /houghton\s*mifflin|hmh\s*books?/i, domain: 'hmhbooks.com' },
  { match: /w\.?\s*w\.?\s*norton/i, domain: 'wwnorton.com' },
  { match: /faber\s*(&|and)\s*faber|faber\s*books?/i, domain: 'faber.co.uk' },
  { match: /wiley/i, domain: 'wiley.com' },
  { match: /pearson/i, domain: 'pearson.com' },
  { match: /oxford\s*university\s*press|oxford\s*up\b/i, domain: 'global.oup.com' },
  { match: /cambridge\s*university\s*press/i, domain: 'cambridge.org' },
  { match: /mit\s*press/i, domain: 'mitpress.mit.edu' },
  { match: /princeton\s*university\s*press/i, domain: 'press.princeton.edu' },
  { match: /yale\s*university\s*press/i, domain: 'yalebooks.yale.edu' },
  { match: /chronicle\s*books?/i, domain: 'chroniclebooks.com' },
  { match: /workman/i, domain: 'workman.com' },
  { match: /sourcebooks/i, domain: 'sourcebooks.com' },
  { match: /quirk\s*books?/i, domain: 'quirkbooks.com' },
  { match: /tin\s*house/i, domain: 'tinhouse.com' },
  { match: /europa\s*editions/i, domain: 'europaeditions.com' },
  { match: /melville\s*house/i, domain: 'mhpbooks.com' },
  { match: /random\s*house\s*uk|penguin\s*uk|penguin\s*books?\s*uk/i, domain: 'penguin.co.uk' },
];

export function knownPublisherDomains() {
  return Array.from(new Set(PUBLISHER_DOMAINS.map((entry) => entry.domain)));
}

export function resolvePublisherDomain(publisher: string | null | undefined): string | null {
  if (!publisher) return null;
  const cleaned = publisher.trim();
  if (!cleaned) return null;

  for (const entry of PUBLISHER_DOMAINS) {
    if (entry.match.test(cleaned)) return entry.domain;
  }

  return null;
}
