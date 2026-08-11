import { memo, type Dispatch, type SetStateAction } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import ImageUploadDropzone from '@/components/ImageUploadDropzone';
import VideoUploadDropzone from '@/components/VideoUploadDropzone';

interface MediaStepProps {
  images: string[];
  onImagesChange: Dispatch<SetStateAction<string[]>>;
  imagesMetadata: Record<string, any>;
  onImagesMetadataChange: Dispatch<SetStateAction<Record<string, any>>>;
  videoUrls: string[];
  onVideoUrlsChange: Dispatch<SetStateAction<string[]>>;
  videoPlaceholder: string;
  onVideoPlaceholderChange: (value: string) => void;
  virtualTourPlaceholder: string;
  onVirtualTourPlaceholderChange: (value: string) => void;
  imagesError?: string;
}

function MediaStepComponent({
  images,
  onImagesChange,
  imagesMetadata,
  onImagesMetadataChange,
  videoUrls,
  onVideoUrlsChange,
  videoPlaceholder,
  onVideoPlaceholderChange,
  virtualTourPlaceholder,
  onVirtualTourPlaceholderChange,
  imagesError,
}: MediaStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <ImageIcon className="w-4 h-4" />
          <span>Paso 9: Galería y Multimedia</span>
        </h4>
        <p className="text-xs text-brand-gray-500 mt-0.5">Agrega las fotos oficiales y enlaces a recorridos virtuales 3D.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Imágenes <span className="text-red-500">*</span></span>
          <ImageUploadDropzone
            images={images}
            onChange={onImagesChange}
            imagesMetadata={imagesMetadata}
            onMetadataChange={onImagesMetadataChange}
          />
          {imagesError && (
            <p className="text-[10px] text-brand-rose mt-1 font-bold flex items-center gap-1 animate-in fade-in duration-200">
              <span>⚠</span> <span>{imagesError}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-brand-gray-500 uppercase tracking-wider">Video Local (MP4, MOV, WEBM)</span>
          <VideoUploadDropzone videoUrls={videoUrls} onChange={onVideoUrlsChange} maxVideos={5} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">Enlace a Video Recorrido</label>
          <input
            type="text"
            value={videoPlaceholder}
            onChange={(event) => onVideoPlaceholderChange(event.target.value)}
            placeholder="Ej. https://youtube.com/watch?v=..."
            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-brand-gray-500">Recorrido Virtual 3D (Matterport o YouTube)</label>
          <input
            type="url"
            value={virtualTourPlaceholder}
            onChange={(event) => onVirtualTourPlaceholderChange(event.target.value)}
            placeholder="https://my.matterport.com/show/?m=... o https://youtu.be/..."
            className="w-full p-3 rounded-xl bg-brand-gray-50 border border-brand-gray-200 text-xs font-semibold outline-none"
          />
          <p className="text-[10px] leading-relaxed text-brand-gray-400">Acepta Matterport y videos 360° o recorridos publicados en YouTube.</p>
        </div>
      </div>
    </motion.div>
  );
}

export const MediaStep = memo(MediaStepComponent);
