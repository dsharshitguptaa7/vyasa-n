import { SamaVedaModuleState } from '../types';

export const samaVedaService = {
  getModuleInfo(): SamaVedaModuleState {
    return {
      moduleKey: 'sama-veda',
      name: 'Sama Veda',
      domain: 'Research Recognition & Communication',
      status: 'planned',
      version: '0.1.0',
      isEnabled: false,
    };
  },
};
