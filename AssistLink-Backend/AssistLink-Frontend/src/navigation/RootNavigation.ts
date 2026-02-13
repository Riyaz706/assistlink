import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
    if (navigationRef.isReady()) {
        navigationRef.navigate(name as any, params as any);
    } else {
        console.warn('RootNavigation not ready, cannot navigate to:', name);
    }
}
