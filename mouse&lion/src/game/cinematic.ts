export interface CinematicConfig {
  enabled: boolean;
  scenario: string;
}

export function getCinematicConfig(): CinematicConfig {
  const params = new URLSearchParams(window.location.search);
  return {
    enabled: params.get('mode') === 'cinematic',
    scenario: params.get('scenario') ?? 'default',
  };
}
