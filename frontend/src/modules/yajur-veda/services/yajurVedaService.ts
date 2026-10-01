import { YajurVedaModuleState } from '../types';

export const yajurVedaService = {
  getModuleInfo(): YajurVedaModuleState {
    return {
      moduleKey: 'yajur-veda',
      name: 'Yajur Veda',
      domain: 'Research Administration & Incentives',
      status: 'planned',
      version: '0.1.0',
      isEnabled: false,
    };
  },
};
