import { useAlert as useAlertContext } from '../src/context/AlertContext';

export const useAlert = () => {
  return useAlertContext();
};
