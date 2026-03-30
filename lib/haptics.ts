import { Platform } from 'react-native';

// Safe haptic wrappers — no-op on web
export function hapticImpact() {
  if (Platform.OS === 'web') return;
  import('expo-haptics').then(Haptics =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  ).catch(() => {});
}

export function hapticSuccess() {
  if (Platform.OS === 'web') return;
  import('expo-haptics').then(Haptics =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  ).catch(() => {});
}

export function hapticLight() {
  if (Platform.OS === 'web') return;
  import('expo-haptics').then(Haptics =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  ).catch(() => {});
}
