import React, { useState, useRef } from 'react';
import {
  Plus,
  Upload,
  Camera,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Shield,
  ArrowRight,
  EyeOff,
  X,
  Loader2,
  FileImage
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export interface ReportProblemScreenProps {
  navigate: (route: string) => void;
}

// Client-side EXIF stripping & image optimization using HTML5 Canvas
const stripExifAndProcessImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Redraw on canvas to strip all EXIF, GPS, and camera metadata
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
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Generates clean JPEG data without any metadata
        const cleanDataUrl = canvas.toDataURL('image/jpeg', 0.86);
        resolve(cleanDataUrl);
      };
      img.onerror = () => {
        resolve(readerEvent.target?.result as string);
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const ReportProblemScreen: React.FC<ReportProblemScreenProps> = ({ navigate }) => {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('cat-streetlight');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [shareLocation, setShareLocation] = useState(true);
  const [ward, setWard] = useState('Ward 45 (Central Zone)');
  const [addressHint, setAddressHint] = useState('5th Main Road, near bus shelter');
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=400&q=80'
  ]);

  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<any | null>(null);

  const handleFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    if (photos.length >= 4) {
      showToast('Maximum 4 photos allowed per report.', 'info');
      return;
    }

    const availableSlots = 4 - photos.length;
    const toProcess = incoming.slice(0, availableSlots);

    if (incoming.length > availableSlots) {
      showToast(`Only ${availableSlots} more photo(s) can be added (max 4).`, 'info');
    }

    setIsProcessingPhotos(true);
    const newPhotos: string[] = [];

    for (const file of toProcess) {
      if (!file.type.startsWith('image/')) {
        showToast(`"${file.name}" is not an image file.`, 'error');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast(`"${file.name}" exceeds 5MB limit. Please select a smaller photo.`, 'error');
        continue;
      }

      try {
        const cleanUrl = await stripExifAndProcessImage(file);
        newPhotos.push(cleanUrl);
      } catch (err) {
        showToast(`Failed to process "${file.name}".`, 'error');
      }
    }

    if (newPhotos.length > 0) {
      setPhotos((prev) => [...prev, ...newPhotos]);
      showToast(
        `${newPhotos.length} photo(s) uploaded from local disk. EXIF & GPS stripped for privacy.`,
        'success'
      );
    }
    setIsProcessingPhotos(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      showToast('Please sign in or register to submit a problem report.', 'info');
      navigate('/login');
      return;
    }

    if (!title.trim() || !description.trim()) {
      showToast('Please provide a title and detailed description.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/reports', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          categoryId: category,
          exactLat: shareLocation ? 12.9719 : undefined,
          exactLng: shareLocation ? 77.5937 : undefined,
          ward,
          addressHint,
          images: photos,
          isAnonymous
        })
      });

      setSubmittedReport(res.report);
      showToast('Problem report submitted successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Submission failed. Please check inputs.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Screen
  if (submittedReport) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-[#EAF2EB] shadow-card p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#EAF2EB] text-[#287A58] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <span className="text-xs font-mono font-bold bg-[#FAF5EE] text-[#B93E16] px-3 py-1 rounded-full border border-[#E9DFD3]">
              {submittedReport.referenceNumber}
            </span>
            <h2 className="text-2xl font-serif font-bold text-[#25312B] mt-3">
              Report Submitted Successfully
            </h2>
            <p className="text-sm text-[#7D8981] mt-2 leading-relaxed">
              Your civic report has been queued for municipal review. It is currently labeled <strong className="text-[#B93E16]">Unverified</strong> until inspected by a dispatcher.
            </p>
          </div>

          <div className="p-4 bg-[#F7F7F1] rounded-2xl border border-[#EAF2EB] text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-[#7D8981]">Category:</span>
              <span className="font-semibold text-[#25312B]">{submittedReport.categoryName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7D8981]">Location:</span>
              <span className="font-semibold text-[#25312B]">{submittedReport.ward}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7D8981]">Identity Status:</span>
              <span className="font-semibold text-[#174B38]">
                {isAnonymous ? 'Confidential / Anonymous' : 'Protected Resident Profile'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => navigate('/my-activity')}
              className="flex-1 bg-[#174B38] hover:bg-[#11392A] text-white py-3 rounded-full text-sm font-semibold transition-all cursor-pointer"
            >
              Track in My Activity
            </button>
            <button
              onClick={() => {
                setSubmittedReport(null);
                setTitle('');
                setDescription('');
              }}
              className="flex-1 bg-white hover:bg-[#F7F7F1] border border-[#EAF2EB] text-[#25312B] py-3 rounded-full text-sm font-semibold transition-all cursor-pointer"
            >
              Report Another Problem
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F1] py-10 px-4 sm:px-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <span className="text-xs font-bold text-[#FF873E] uppercase tracking-wider bg-[#FFF1E6] px-3.5 py-1 rounded-full">
          Citizen Reporting Portal
        </span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#25312B] mt-2">
          Report a Problem in Your Neighbourhood
        </h1>
        <p className="text-sm text-[#7D8981] mt-1">
          Share details, photos, and location. Reports are tracked publicly to a recorded resolution.
        </p>
      </div>

      {!isAuthenticated && (
        <div className="mb-6 p-4 rounded-2xl bg-[#FFF1E6] border border-[#F4A582]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#9A3412]">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#E65D25] shrink-0" />
            <span>
              <strong>Sign in required to submit reports.</strong> Please sign in with your resident account or register to report community issues and track municipal SLA progress.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-full bg-[#174B38] text-white font-bold hover:bg-[#11392A] transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer shadow-xs"
          >
            Sign In / Register →
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-[#EAF2EB] p-6 sm:p-10 shadow-card space-y-8">
        {/* Title */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#25312B] mb-2">
            Problem Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Streetlight out on 5th Main corner"
            className="w-full h-12 px-4 rounded-xl border border-[#EAF2EB] bg-[#F7F7F1]/40 text-sm text-[#25312B] focus:outline-none focus:border-[#174B38]"
          />
        </div>

        {/* Category Picker */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#25312B] mb-2">
            Category *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'cat-streetlight', label: 'Streetlight' },
              { id: 'cat-road', label: 'Roads & Potholes' },
              { id: 'cat-waste', label: 'Waste Collection' },
              { id: 'cat-water', label: 'Water Leak' },
              { id: 'cat-drain', label: 'Open Drain' },
              { id: 'cat-infra', label: 'Public Infrastructure' },
              { id: 'cat-parks', label: 'Parks & Trees' },
              { id: 'cat-other', label: 'Other Concerns' }
            ].map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                  category === c.id
                    ? 'border-[#174B38] bg-[#EAF2EB] text-[#174B38] shadow-xs font-bold'
                    : 'border-[#EAF2EB] bg-white text-[#7D8981] hover:border-[#91B69C]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Description */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#25312B] mb-2">
            Detailed Description *
          </label>
          <textarea
            rows={4}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what is damaged, safety risks for pedestrians or vehicles, landmarks nearby..."
            className="w-full p-4 rounded-xl border border-[#EAF2EB] bg-[#F7F7F1]/40 text-sm text-[#25312B] focus:outline-none focus:border-[#174B38]"
          />
        </div>

        {/* Photo Upload Row with drag-and-drop & local file picker */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#25312B] flex items-center gap-1.5">
              <span>Photographs ({photos.length}/4)</span>
              <span className="text-[10px] text-[#287A58] bg-[#EAF2EB] font-bold px-2 py-0.5 rounded-full">
                EXIF Stripped
              </span>
            </label>
            <span className="text-[11px] text-[#7D8981]">JPG, PNG, WebP under 5MB</span>
          </div>

          {/* Hidden native file input for local uploads */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp,image/jpg"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files);
              }
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) {
                handleFiles(e.dataTransfer.files);
              }
            }}
            className={`p-3 rounded-2xl border-2 transition-all flex flex-wrap items-center gap-3 ${
              isDragging
                ? 'border-[#174B38] bg-[#EAF2EB]/60 ring-4 ring-[#174B38]/10'
                : 'border-transparent bg-transparent'
            }`}
          >
            {photos.map((p, i) => (
              <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-[#EAF2EB] shadow-xs group bg-[#FAF5EE]">
                <img src={p} alt={`Report upload ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-sm"
                  title="Remove photograph"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1 text-[9px] text-white text-center font-medium">
                  Photo #{i + 1}
                </div>
              </div>
            ))}

            {photos.length < 4 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhotos}
                className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#91B69C] bg-[#F7F7F1]/80 hover:bg-[#EAF2EB] hover:border-[#174B38] flex flex-col items-center justify-center text-[#174B38] gap-1 transition-all cursor-pointer group hover:scale-[1.02]"
              >
                {isProcessingPhotos ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-[#E65D25]" />
                    <span className="text-[10px] font-bold text-[#E65D25]">Processing...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-[#174B38] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold">+ Upload</span>
                    <span className="text-[8px] text-[#7D8981]">From device</span>
                  </>
                )}
              </button>
            )}
          </div>

          <p className="text-[11px] text-[#7D8981] mt-1.5 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-[#287A58]" />
            <span>Click <strong>+ Upload</strong> to choose photos from your device, or drag and drop images directly. Location metadata is removed before upload.</span>
          </p>
        </div>

        {/* Location Card */}
        <div className="p-5 rounded-2xl bg-[#F7F7F1] border border-[#EAF2EB] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[#25312B]">
              <MapPin className="w-4 h-4 text-[#E65D25]" />
              <span>Location Coordinates</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[#7D8981]">
              <span>Include approximate GPS</span>
              <input
                type="checkbox"
                checked={shareLocation}
                onChange={(e) => setShareLocation(e.target.checked)}
                className="rounded text-[#174B38] focus:ring-[#174B38]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <input
              type="text"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              placeholder="Ward name..."
              className="h-10 px-3.5 rounded-lg border border-[#EAF2EB] bg-white text-xs text-[#25312B]"
            />
            <input
              type="text"
              value={addressHint}
              onChange={(e) => setAddressHint(e.target.value)}
              placeholder="Landmark or street description..."
              className="h-10 px-3.5 rounded-lg border border-[#EAF2EB] bg-white text-xs text-[#25312B]"
            />
          </div>
        </div>

        {/* Anonymous Toggle & Privacy Disclaimer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#25312B]">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded text-[#174B38] focus:ring-[#174B38]"
            />
            <span className="flex items-center gap-1.5">
              <EyeOff className="w-4 h-4 text-[#7D8981]" />
              Report confidentially (hide my profile name on public views)
            </span>
          </label>

          <span className="text-[11px] text-[#287A58] flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Public coordinates are coarsened to ~100m for privacy.
          </span>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-[#F5F7F1]">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#174B38] hover:bg-[#11392A] text-white py-4 rounded-full font-bold text-base shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Submitting report...</span>
            ) : (
              <>
                <span>Submit Problem Report</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

