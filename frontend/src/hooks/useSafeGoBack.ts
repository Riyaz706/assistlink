import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

/**
 * Returns a function that goes back when possible, otherwise navigates to the
 * correct home screen (CaregiverDashboard or CareRecipientDashboard).
 * Use instead of navigation.goBack() to avoid "GO_BACK was not handled" when
 * the screen was opened without history (e.g. from a notification or deep link).
 */
export function useSafeGoBack(): () => void {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      const home = (user?.role === 'caregiver' ? 'CaregiverDashboard' : 'CareRecipientDashboard') as never;
      navigation.navigate(home);
    }
  }, [navigation, user?.role]);
}
