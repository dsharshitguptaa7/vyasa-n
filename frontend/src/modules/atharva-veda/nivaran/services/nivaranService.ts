import { NivaranModuleState } from '../types';

export const nivaranService = {
  getModuleInfo(): NivaranModuleState {
    return {
      moduleKey: 'atharva-veda-nivaran',
      name: 'Atharva Veda: NIVARAN-AI',
      domain: 'Grievance Redressal & Institutional Well-Being',
      status: 'active',
      version: '1.0.0-MODULAR',
      isEnabled: true,
      internalRoutePrefix: '/modules/atharva-veda/nivaran',
    };
  },
};
