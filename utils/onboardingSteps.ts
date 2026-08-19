// Shared definitions for the provider onboarding guide.
// `key` must match the backend GET /provider/onboarding-status step keys.
export type OnboardingStepKey =
  | 'profile_photo'
  | 'work_zone'
  | 'skills'
  | 'availability'
  | 'identity'
  | 'notifications';

export interface OnboardingStepDef {
  key: OnboardingStepKey;
  title: string;
  desc: string;
  icon: string; // Ionicons name
  route: string;
  color: string;
  note?: string;
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    key: 'profile_photo',
    title: 'Complete your profile',
    desc: 'Add your name, a short bio and a clear profile photo so clients recognise and trust you.',
    icon: 'person-circle-outline',
    route: '/(tabs)/my-profile?tab=service',
    color: '#2563eb',
  },
  {
    key: 'work_zone',
    title: 'Set your work area',
    desc: 'Pick your base location and how far you are willing to travel (radius in miles). Clients nearby will find you.',
    icon: 'location-outline',
    route: '/(tabs)/service-area',
    color: '#10b981',
  },
  {
    key: 'skills',
    title: 'Add skills & prices',
    desc: 'List the services you offer, set your hourly rate, and upload photos of your past work for each skill.',
    icon: 'construct-outline',
    route: '/(tabs)/my-profile?tab=skills',
    color: '#7c3aed',
  },
  {
    key: 'availability',
    title: 'Set your availability',
    desc: 'Add the days and hours you can take jobs. You can also add one-time dates.',
    icon: 'calendar-outline',
    route: '/(tabs)/availability',
    color: '#f59e0b',
  },
  {
    key: 'identity',
    title: 'Verify your identity',
    desc: 'Confirm who you are with a photo of your ID and a quick selfie (Stripe Identity). Required to accept jobs.',
    icon: 'shield-checkmark-outline',
    route: '/identity',
    color: '#0891b2',
  },
  {
    key: 'notifications',
    title: 'Turn on notifications',
    desc: 'Connect Telegram to get instant alerts for new jobs and messages.',
    icon: 'notifications-outline',
    route: '/notifications',
    color: '#db2777',
    note: 'SMS notifications are coming soon.',
  },
];
