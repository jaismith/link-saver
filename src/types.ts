export type SavedLink = {
  id: string;
  url: string;
  tags: string[];
  title?: string;
  savedAt: string;
};

export type LinkStore = {
  links: SavedLink[];
};
