/**
 * VYASA Ecosystem Institutional Branding Configuration
 * Centralized Single Source of Truth for CSJMU and VYASA
 */

export interface InstitutionDetails {
  readonly nameEnglish: string;
  readonly nameHindi: string;
  readonly shortName: string;
  readonly location: string;
  readonly accreditation: string;
  readonly logoPath: string;
}

export interface EcosystemBrandDetails {
  readonly productName: string;
  readonly taglineHindi: string;
  readonly taglineEnglish: string;
  readonly logoPath: string;
  readonly institution: InstitutionDetails;
}

export const CSJMU_INSTITUTION: InstitutionDetails = {
  nameEnglish: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
  nameHindi: 'छत्रपति शाहू जी महाराज विश्वविद्यालय, कानपुर',
  shortName: 'CSJMU',
  location: 'Kanpur, Uttar Pradesh',
  accreditation: 'State University of Uttar Pradesh',
  logoPath: '/assets/branding/csjmu/csjmu-logo.png',
};

export const VYASA_BRAND: EcosystemBrandDetails = {
  productName: 'VYASA',
  taglineHindi: 'ज्ञान से शोध तक, AI के साथ',
  taglineEnglish: 'From Knowledge to Research, with AI',
  logoPath: '/assets/branding/vyasa/vyasa-logo.png',
  institution: CSJMU_INSTITUTION,
};
