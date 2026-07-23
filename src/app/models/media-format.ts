import { PLATFORM_TYPES } from './post';

export type MediaPlatformKey = (typeof PLATFORM_TYPES)[number]['type'];

export type MediaFormatSpec = {
  key: string;
  label: string;
  description: string;
  icon: string;
  width: number;
  height: number;
  aspectRatio: string;
};

export const MEDIA_PLATFORMS = PLATFORM_TYPES.map((platform) => ({
  key: platform.type as MediaPlatformKey,
  label: platform.label,
  type: platform.type,
}));

export const MEDIA_PLATFORM_FORMATS: Record<MediaPlatformKey, readonly MediaFormatSpec[]> = {
  linkedin: [
    {
      key: 'feed',
      label: 'Feed image',
      description: 'Landscape image for LinkedIn feed posts.',
      icon: 'crop_16_9',
      width: 1200,
      height: 627,
      aspectRatio: '1.91 / 1',
    },
    {
      key: 'square',
      label: 'Square post',
      description: 'Square visual for carousel or single-image posts.',
      icon: 'crop_square',
      width: 1080,
      height: 1080,
      aspectRatio: '1 / 1',
    },
    {
      key: 'article',
      label: 'Article cover',
      description: 'Cover image for LinkedIn articles and newsletters.',
      icon: 'crop_landscape',
      width: 1920,
      height: 1080,
      aspectRatio: '16 / 9',
    },
  ],
  facebook: [
    {
      key: 'feed',
      label: 'Feed image',
      description: 'Recommended size for Facebook feed posts.',
      icon: 'crop_16_9',
      width: 1200,
      height: 630,
      aspectRatio: '1.91 / 1',
    },
    {
      key: 'story',
      label: 'Story',
      description: 'Full-screen vertical story format.',
      icon: 'crop_portrait',
      width: 1080,
      height: 1920,
      aspectRatio: '9 / 16',
    },
    {
      key: 'square',
      label: 'Square post',
      description: 'Square image for feed or ads.',
      icon: 'crop_square',
      width: 1080,
      height: 1080,
      aspectRatio: '1 / 1',
    },
  ],
  instagram: [
    {
      key: 'square',
      label: 'Feed square',
      description: 'Classic square post for the Instagram feed.',
      icon: 'crop_square',
      width: 1080,
      height: 1080,
      aspectRatio: '1 / 1',
    },
    {
      key: 'portrait',
      label: 'Feed portrait',
      description: 'Portrait post with extra vertical space.',
      icon: 'crop_portrait',
      width: 1080,
      height: 1350,
      aspectRatio: '4 / 5',
    },
    {
      key: 'story',
      label: 'Story / Reel cover',
      description: 'Vertical format for stories and reel covers.',
      icon: 'crop_portrait',
      width: 1080,
      height: 1920,
      aspectRatio: '9 / 16',
    },
  ],
};

export function formatDimensionsLabel(format: MediaFormatSpec): string {
  return `${format.width} × ${format.height}px`;
}
