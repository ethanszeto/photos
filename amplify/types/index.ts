export type UploadInitResponse = {
  uploadUrl: string;
  photoId: string;
  key: string;
};

export type GalleryPhoto = {
  photoId: string;
  key: string;
  url: string;
  uploadedAt?: string;
};

export type GalleryListResponse = {
  photos: GalleryPhoto[];
};
