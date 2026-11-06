import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Pill } from '../../components/common/Pill.js';
import { MapPreview } from '../../components/common/MapPreview.js';
import {
  IconArrowLeft,
  IconLightbulb,
  IconRoad,
  IconTrash,
  IconCamera,
  IconPlus,
  IconMapPin,
  IconAlertTriangle,
  IconCheck,
  IconShield,
  IconClose
} from '../../components/common/Icons.js';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export interface CitizenReportScreenProps {
  navigate: (route: string) => void;
}

export const CitizenReportScreen: React.FC<CitizenReportScreenProps> = ({ navigate }) => {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  // Mode: Mobile Frame (390px) or Desktop Responsive
  const [isMobileFrame, setIsMobileFrame] = useState(false);

  // Wizard state: Step 1 = Category, Step 2 = Details & Photos & Location, Step 3 = Review & Submit
  const [currentStep, setCurrentStep] = useState<number>(2);

  // Form fields
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('cat-streetlight');
  const [title, setTitle] = useState<string>('Streetlight out on 5th Main');
  const [description, setDescription] = useState<string>(
    'Streetlight pole #42 on 5th Main road is completely dark. High pedestrian and vehicle traffic at night.'
  );

  // Photos
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=400&q=80'
  ]);

  // Location
  const [shareLocation, setShareLocation] = useState<boolean>(true);
  const [lat, setLat] = useState<number>(12.9719);
  const [lng, setLng] = useState<number>(77.5937);
  const [ward, setWard] = useState<string>('Ward 45 (Central)');
  const [addressHint, setAddressHint] = useState<string>('5th Main Road, near bus stop');

  // Near duplicate advisory hint
  const [duplicateHint, setDuplicateHint] = useState<string | null>(
    'Similar report 40 m away. Dark road near bus stop.'
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load categories from public API
    apiRequest('/public/categories')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
        }
      })
      .catch(() => {});
  }, []);

  // Check duplicate advisory
  useEffect(() => {
    if (shareLocation && lat && lng) {
      apiRequest('/reports/check-duplicate', {
        method: 'POST',
        body: JSON.stringify({ lat, lng, categoryId: selectedCategory, title })
      })
        .then((res) => {
          if (res.duplicates && res.duplicates.length > 0) {
            setDuplicateHint(res.duplicates[0].snippet);
          }
        })
        .catch(() => {});
    }
  }, [selectedCategory, lat, lng, shareLocation]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    if (photos.length >= 4) {
      showToast('Maximum 4 photos allowed per report.', 'info');
      return;
    }

    const availableSlots = 4 - photos.length;
    const toProcess = incoming.slice(0, availableSlots);

    const newPhotos: string[] = [];
    for (const file of toProcess) {
      if (!file.type.startsWith('image/')) {
        showToast(`"${file.name}" is not an image file.`, 'error');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast(`"${file.name}" exceeds 5MB limit.`, 'error');
        continue;
      }

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const maxDim = 1600;
              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                } else {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.86));
              } else {
                resolve(e.target?.result as string);
              }
            };
            img.onerror = () => resolve(e.target?.result as string);
            img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        newPhotos.push(dataUrl);
      } catch (err) {
        showToast(`Failed to process "${file.name}".`, 'error');
      }
    }

    if (newPhotos.length > 0) {
      setPhotos((prev) => [...prev, ...newPhotos]);
      showToast(`${newPhotos.length} photo(s) added. EXIF stripped.`, 'success');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePhotoUploadSim = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/reports', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          categoryId: selectedCategory,
          exactLat: shareLocation ? lat : undefined,
          exactLng: shareLocation ? lng : undefined,
          ward,
          addressHint,
          images: photos
        })
      });

      showToast(`Report submitted successfully (${res.report.referenceNumber})!`, 'success');
      navigate('/my-reports');
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please check your inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-6 px-4 flex flex-col items-center justify-center min-h-[85vh]">
      {/* Mobile Frame Toggle Banner */}
      <div className="mb-4 flex items-center gap-3 text-xs text-[#6A5D52]">
        <span>Layout preview:</span>
        <button
          onClick={() => setIsMobileFrame(false)}
          className={`px-3 py-1 rounded-[6px] border font-medium cursor-pointer ${
            !isMobileFrame
              ? 'bg-[#B03A0C] text-white border-[#B03A0C]'
              : 'bg-white text-[#1E1B18] border-[#E9DFD3]'
          }`}
        >
          Fluid Responsive
        </button>
        <button
          onClick={() => setIsMobileFrame(true)}
          className={`px-3 py-1 rounded-[6px] border font-medium cursor-pointer ${
            isMobileFrame
              ? 'bg-[#B03A0C] text-white border-[#B03A0C]'
              : 'bg-white text-[#1E1B18] border-[#E9DFD3]'
          }`}
        >
          Mobile 390x844 Frame
        </button>
      </div>

      {/* Main Container / Mobile Frame Wrapper */}
      <div
        className={`w-full transition-all ${
          isMobileFrame
            ? 'max-w-[390px] min-h-[844px] border-[8px] border-[#1E1B18] rounded-[36px] overflow-hidden bg-[#FBF6EF] shadow-2xl p-0'
            : 'max-w-xl'
        }`}
      >
        <div className="bg-[#FBF6EF] min-h-full flex flex-col p-4 sm:p-6">
          {/* Top Bar with back arrow, "Report an issue" and pill "Step 2 of 3" */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EFE6DA]">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-[#1E1B18] hover:bg-[#EFE6DA] rounded-[8px] transition-colors cursor-pointer"
              aria-label="Back"
            >
              <IconArrowLeft size={18} />
            </button>
            <h1 className="text-base font-semibold text-[#1E1B18]">Report an issue</h1>
            <Pill variant="neutral" label={`Step ${currentStep} of 3`} dot={false} />
          </div>

          {/* 3-segment progress bar */}
          <div className="grid grid-cols-3 gap-1.5 py-4">
            <div className={`h-[5px] rounded-[2px] ${currentStep >= 1 ? 'bg-[#B03A0C]' : 'bg-[#E9DFD3]'}`} />
            <div className={`h-[5px] rounded-[2px] ${currentStep >= 2 ? 'bg-[#B03A0C]' : 'bg-[#E9DFD3]'}`} />
            <div className={`h-[5px] rounded-[2px] ${currentStep >= 3 ? 'bg-[#B03A0C]' : 'bg-[#E9DFD3]'}`} />
          </div>

          {/* Heading "What needs fixing?" with subtext "Reports stay unverified until a moderator reviews them." */}
          <div className="mb-4">
            <h2 className="text-[22px] font-serif font-semibold text-[#1E1B18] leading-tight">
              What needs fixing?
            </h2>
            <p className="text-[13px] text-[#6A5D52] mt-1">
              Reports stay <span className="font-semibold text-[#755C43]">unverified</span> until a moderator reviews them.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-[#FBE4E4] border border-[#F4A582] rounded-[8px] text-xs font-semibold text-[#8F1D1D]">
              {error}
            </div>
          )}

          {/* Category tiles (Streetlight selected, Road, Waste) */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-2">
              Select Category
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('cat-streetlight')}
                className={`p-3 rounded-[10px] border flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer ${
                  selectedCategory === 'cat-streetlight'
                    ? 'border-[#B03A0C] bg-[#FFF1E6] text-[#B03A0C] font-semibold'
                    : 'border-[#E9DFD3] bg-white text-[#6A5D52] hover:border-[#D9C9B8]'
                }`}
              >
                <IconLightbulb size={22} className={selectedCategory === 'cat-streetlight' ? 'text-[#B03A0C]' : 'text-[#6A5D52]'} />
                <span className="text-xs">Streetlight</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('cat-road')}
                className={`p-3 rounded-[10px] border flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer ${
                  selectedCategory === 'cat-road'
                    ? 'border-[#B03A0C] bg-[#FFF1E6] text-[#B03A0C] font-semibold'
                    : 'border-[#E9DFD3] bg-white text-[#6A5D52] hover:border-[#D9C9B8]'
                }`}
              >
                <IconRoad size={22} className={selectedCategory === 'cat-road' ? 'text-[#B03A0C]' : 'text-[#6A5D52]'} />
                <span className="text-xs">Road</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('cat-waste')}
                className={`p-3 rounded-[10px] border flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer ${
                  selectedCategory === 'cat-waste'
                    ? 'border-[#B03A0C] bg-[#FFF1E6] text-[#B03A0C] font-semibold'
                    : 'border-[#E9DFD3] bg-white text-[#6A5D52] hover:border-[#D9C9B8]'
                }`}
              >
                <IconTrash size={22} className={selectedCategory === 'cat-waste' ? 'text-[#B03A0C]' : 'text-[#6A5D52]'} />
                <span className="text-xs">Waste</span>
              </button>
            </div>
          </div>

          {/* Title and Description */}
          <div className="space-y-3.5 mb-5">
            <div>
              <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                Issue Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of the issue..."
                className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] bg-white text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Give details about what is broken, hazards, or landmarks..."
                className="w-full p-3 rounded-[10px] border border-[#D9C9B8] bg-white text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
              />
            </div>
          </div>

          {/* Photo row (two thumbnails and a dashed "+ Photo") */}
          <div className="mb-5">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,image/jpg"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleLocalFiles(e.target.files);
              }}
            />
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#1E1B18] uppercase tracking-wider">
                Photos ({photos.length}/4)
              </label>
              <span className="text-[11px] text-[#6A5D52]">JPG, PNG under 5MB</span>
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {photos.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-[10px] overflow-hidden border border-[#E9DFD3] flex-shrink-0 group">
                  <img src={url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center text-[10px] cursor-pointer"
                    title="Remove"
                  >
                    ×
                  </button>
                  <span className="absolute bottom-1 right-1 bg-black/60 text-[9px] text-white px-1 rounded-[3px]">
                    EXIF stripped
                  </span>
                </div>
              ))}
              {photos.length < 4 && (
                <button
                  type="button"
                  onClick={handlePhotoUploadSim}
                  className="w-20 h-20 rounded-[10px] border-2 border-dashed border-[#D9C9B8] bg-white hover:bg-[#FFF1E6] hover:border-[#B03A0C] flex flex-col items-center justify-center gap-1 text-[#6A5D52] hover:text-[#B03A0C] transition-colors flex-shrink-0 cursor-pointer"
                >
                  <IconCamera size={20} />
                  <span className="text-[11px] font-semibold">+ Photo</span>
                </button>
              )}
            </div>
          </div>

          {/* Location card with mini map, "Share approximate location", helper "Optional. Photo GPS data is removed." and an switch */}
          <Card padding="sm" className="mb-4 bg-white border border-[#E9DFD3] rounded-[14px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <IconMapPin size={18} className="text-[#B03A0C]" />
                <span className="text-sm font-semibold text-[#1E1B18]">Share approximate location</span>
              </div>
              {/* Switch toggle */}
              <button
                type="button"
                onClick={() => setShareLocation(!shareLocation)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  shareLocation ? 'bg-[#0F766E]' : 'bg-[#D9C9B8]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    shareLocation ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-[12px] text-[#6A5D52] mb-3">
              Optional. Photo GPS data is removed. Public view is coarsened to ~100m.
            </p>

            {shareLocation && (
              <div className="h-36 rounded-[10px] overflow-hidden border border-[#E9DFD3]">
                <MapPreview
                  isMiniMap={true}
                  center={{ lat, lng }}
                  markers={[
                    {
                      id: 'user-pin',
                      referenceNumber: 'New',
                      title,
                      category: 'Selected',
                      priority: 'high',
                      status: 'submitted',
                      lat,
                      lng
                    }
                  ]}
                  showPrivacyNotice={false}
                  className="w-full h-full"
                />
              </div>
            )}
          </Card>

          {/* Amber hint "Similar report 40 m away. Dark road near bus stop." (advisory only) */}
          {duplicateHint && (
            <div className="mb-5 p-3 rounded-[10px] bg-[#FFF8EE] border border-[#FDEBC8] flex items-start gap-2.5 text-xs text-[#6B3E00]">
              <IconAlertTriangle size={16} className="text-[#6B3E00] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Notice: Nearby report detected</span>
                <span>{duplicateHint} You can still proceed if your issue is separate.</span>
              </div>
            </div>
          )}

          {/* Full-width "Continue" / Submit button */}
          <div className="mt-auto pt-2">
            <Button
              type="button"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              onClick={handleSubmit}
            >
              Continue & Submit Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

