export interface NivaranModuleState {
  moduleKey: 'atharva-veda-nivaran';
  name: 'Atharva Veda: NIVARAN-AI';
  domain: 'Grievance Redressal & Institutional Well-Being';
  status: 'active';
  version: '1.0.0-MODULAR';
  isEnabled: boolean;
  internalRoutePrefix: '/modules/atharva-veda/nivaran';
}

export * from './grievance';
