import { escapeHtml } from './widgets';

export interface GalleryItem {
  id: string;
  src: string;
  title: string;
  detail: string;
  filename: string;
  createdAt: number;
}

export function mergeGalleryItems(items: GalleryItem[], item: GalleryItem, limit = 36): GalleryItem[] {
  const existing = items.find(entry => entry.id === item.id || entry.src === item.src);
  const next = existing
    ? items.map(entry => entry === existing ? { ...existing, ...item } : entry)
    : [...items, item];
  return next.sort((a, b) => a.createdAt - b.createdAt).slice(-limit);
}

export function renderGalleryItems(items: GalleryItem[]): string {
  return items.length
    ? items.slice().reverse().map(item => `
      <button class="gallery-item" type="button" data-gallery-id="${escapeHtml(item.id)}">
        <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.title)}">
        <span class="gallery-caption">${escapeHtml(item.title)}</span>
      </button>
    `).join('')
    : 'No photos yet.';
}
