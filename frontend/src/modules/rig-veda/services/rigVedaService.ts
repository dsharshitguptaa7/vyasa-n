import { RigVedaModuleState } from '../types';

export const rigVedaService = {
  getModuleInfo(): RigVedaModuleState {
    return {
      moduleKey: 'rig-veda',
      name: 'Rig Veda',
      domain: 'Research & Knowledge Creation',
      status: 'planned',
      version: '0.1.0',
      isEnabled: false,
    };
  },
};
