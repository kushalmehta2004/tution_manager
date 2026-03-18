import multer from 'multer';

const memoryStorage = multer.memoryStorage();

const imageMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const documentMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function buildFileFilter(allowedMimeTypes: Set<string>) {
  return (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Unsupported file type'));
      return;
    }

    cb(null, true);
  };
}

export const studentPhotoUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: buildFileFilter(imageMimeTypes),
});

export const studentDocumentUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: buildFileFilter(documentMimeTypes),
});
