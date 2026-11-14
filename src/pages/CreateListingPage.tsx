import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { apiFetch, type CategoryItem, type Product } from '../lib/api';
import { resolveImageUrl } from '../lib/demoImages';

interface CreateListingPageProps {
  defaultMode?: 'sell' | 'rent';
}

export function CreateListingPage({
  defaultMode = 'sell',
}: CreateListingPageProps) {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = Boolean(editId);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Academic');
  const [subcategory, setSubcategory] = useState('Textbooks');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<'New' | 'Like New' | 'Good' | 'Fair'>('Like New');
  const [listingType, setListingType] = useState<'sell' | 'rent' | 'both'>(defaultMode);

  const [sellingPrice, setSellingPrice] = useState('');
  const [negotiable, setNegotiable] = useState(false);

  const [rentalDaily, setRentalDaily] = useState('');
  const [rentalWeekly, setRentalWeekly] = useState('');
  const [rentalMonthly, setRentalMonthly] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('0');
  const [minRentalDays, setMinRentalDays] = useState('1');
  const [maxRentalDays, setMaxRentalDays] = useState('30');

  const [pickupLocation, setPickupLocation] = useState('PEC Central Library Steps');
  const [hostelOrDept, setHostelOrDept] = useState('Himalaya Hostel');
  const [images, setImages] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) {
      setListingType(defaultMode);
    }
  }, [defaultMode, isEdit]);

  useEffect(() => {
    apiFetch<{ categories: CategoryItem[] }>('/api/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) return;
    apiFetch<{ product: Product }>(`/api/products/${editId}`)
      .then((res) => {
        const p = res.product;
        setTitle(p.title);
        setCategory(p.category);
        setSubcategory(p.subcategory);
        setDescription(p.description);
        setCondition(p.condition);
        setListingType(p.listingType);
        setSellingPrice(p.sellingPrice ? String(p.sellingPrice) : '');
        setNegotiable(p.negotiable);
        setRentalDaily(p.rentalPriceDaily ? String(p.rentalPriceDaily) : '');
        setRentalWeekly(p.rentalPriceWeekly ? String(p.rentalPriceWeekly) : '');
        setRentalMonthly(p.rentalPriceMonthly ? String(p.rentalPriceMonthly) : '');
        setSecurityDeposit(String(p.securityDeposit));
        setMinRentalDays(String(p.minRentalDays));
        setMaxRentalDays(String(p.maxRentalDays));
        setPickupLocation(p.pickupLocation);
        setHostelOrDept(p.hostelOrDept);
        setImages(p.images || []);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Unable to load listing');
      });
  }, [editId]);

  const activeCategoryObj = categories.find((c) => c.name === category);
  const availableSubcategories = activeCategoryObj?.subcategories || ['General'];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          throw new Error(`"${file.name}" is not a supported image.`);
        }
        if (file.size > 4.5 * 1024 * 1024) {
          throw new Error(`"${file.name}" exceeds the 4.5 MB limit.`);
        }

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(file);
        });

        const uploaded = await apiFetch<{ url: string }>('/api/media/upload', {
          method: 'POST',
          body: JSON.stringify({
            mimeType: file.type,
            dataBase64: base64,
          }),
        });

        setImages((prev) => [...prev, uploaded.url]);
      }
      toast.success('Product image uploaded.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image upload failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (images.length === 0) {
      setError('Please upload at least one photograph of your product.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        subcategory,
        description: description.trim(),
        condition,
        listingType,
        sellingPrice:
          listingType === 'sell' || listingType === 'both'
            ? Number(sellingPrice) || null
            : null,
        negotiable,
        rentalPriceDaily:
          listingType === 'rent' || listingType === 'both'
            ? rentalDaily
              ? Number(rentalDaily)
              : null
            : null,
        rentalPriceWeekly:
          listingType === 'rent' || listingType === 'both'
            ? rentalWeekly
              ? Number(rentalWeekly)
              : null
            : null,
        rentalPriceMonthly:
          listingType === 'rent' || listingType === 'both'
            ? rentalMonthly
              ? Number(rentalMonthly)
              : null
            : null,
        securityDeposit:
          listingType === 'rent' || listingType === 'both'
            ? Number(securityDeposit) || 0
            : 0,
        minRentalDays: Number(minRentalDays) || 1,
        maxRentalDays: Number(maxRentalDays) || 30,
        pickupLocation: pickupLocation.trim(),
        hostelOrDept: hostelOrDept.trim(),
        images,
      };

      if (isEdit && editId) {
        const res = await apiFetch<{ product: Product }>(`/api/products/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Listing updated!');
        navigate(`/app/product/${res.product.productCode}`);
      } else {
        const res = await apiFetch<{ product: Product }>('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(
          `Listing published (${res.product.productCode}) with auto-generated PingME QR!`
        );
        navigate(`/app/product/${res.product.productCode}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save listing.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          {isEdit
            ? 'Edit Campus Listing'
            : listingType === 'rent'
              ? 'Rent Out an Item on PingME'
              : 'Sell an Item on PingME'}
        </h1>
        <p className="text-sm text-zinc-600 mt-1">
          Every published item receives a unique Product ID and printable
          PingME QR tag automatically.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 space-y-6"
      >
        {/* Basic Details */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2">
            01. Product Details
          </h2>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Product Name *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Casio FX-991EX Scientific Calculator"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const nextCat = e.target.value;
                  setCategory(nextCat);
                  const found = categories.find((c) => c.name === nextCat);
                  setSubcategory(found?.subcategories?.[0] || 'General');
                }}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                {categories.length > 0 ? (
                  categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Academic">Academic</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Hostel and Lifestyle">
                      Hostel and Lifestyle
                    </option>
                    <option value="Sports and Recreation">
                      Sports and Recreation
                    </option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Subcategory
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                {availableSubcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Condition *
              </label>
              <select
                value={condition}
                onChange={(e) =>
                  setCondition(
                    e.target.value as 'New' | 'Like New' | 'Good' | 'Fair'
                  )
                }
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <option value="New">New</option>
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              Description *
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Describe edition, specs, accessories included, and wear & tear..."
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            />
          </div>
        </div>

        {/* Product Photographs */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2">
            02. Product Photographs *
          </h2>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-xs font-medium text-zinc-700 hover:border-teal-600 hover:bg-teal-50/40 transition-colors">
              <Upload className="h-4 w-4 text-teal-700" />
              <span>{uploading ? 'Uploading photo...' : 'Upload Product Photo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="sr-only"
              />
            </label>
            <span className="text-xs text-zinc-500">
              PNG, JPG, or WebP up to 4.5 MB each.
            </span>
          </div>

          {images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {images.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="relative aspect-[4/3] rounded-lg border border-zinc-200 overflow-hidden bg-zinc-100 group"
                >
                  <img
                    src={resolveImageUrl(url) || url}
                    alt={`Uploaded product ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label="Remove image"
                    className="absolute right-1.5 top-1.5 rounded-md bg-zinc-900/75 p-1.5 text-white hover:bg-red-600 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">
              <ImagePlus className="h-4 w-4 text-zinc-400" />
              <span>Upload at least one clear photograph of your item.</span>
            </div>
          )}
        </div>

        {/* Transaction Type & Pricing */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2">
            03. Transaction Mode & Pricing (INR)
          </h2>

          <div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-100 p-1">
            {[
              { id: 'sell', label: 'Sell Only' },
              { id: 'rent', label: 'Rent Only' },
              { id: 'both', label: 'Sell & Rent' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() =>
                  setListingType(mode.id as 'sell' | 'rent' | 'both')
                }
                className={`rounded-md py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  listingType === mode.id
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {(listingType === 'sell' || listingType === 'both') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Selling Price (₹ INR) *
                </label>
                <Input
                  type="number"
                  min={1}
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="e.g. 250"
                  required
                  className="bg-white tabular-nums"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={negotiable}
                    onChange={(e) => setNegotiable(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-teal-600"
                  />
                  Open to student price offers (Negotiable)
                </label>
              </div>
            </div>
          )}

          {(listingType === 'rent' || listingType === 'both') && (
            <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Daily Rate (₹/day)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={rentalDaily}
                    onChange={(e) => setRentalDaily(e.target.value)}
                    placeholder="e.g. 25"
                    className="bg-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Weekly Rate (₹/week)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={rentalWeekly}
                    onChange={(e) => setRentalWeekly(e.target.value)}
                    placeholder="e.g. 140"
                    className="bg-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Monthly Rate (₹/month)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={rentalMonthly}
                    onChange={(e) => setRentalMonthly(e.target.value)}
                    placeholder="e.g. 450"
                    className="bg-white tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Refundable Deposit (₹)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(e.target.value)}
                    className="bg-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Min Rental (Days)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={minRentalDays}
                    onChange={(e) => setMinRentalDays(e.target.value)}
                    className="bg-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                    Max Rental (Days)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={maxRentalDays}
                    onChange={(e) => setMaxRentalDays(e.target.value)}
                    className="bg-white tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pickup Location */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2">
            04. Campus Pickup & Handover Spot
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                PEC Pickup Location *
              </label>
              <Input
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="e.g. LTC Foyer / Library Steps"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Hostel / Department
              </label>
              <Input
                value={hostelOrDept}
                onChange={(e) => setHostelOrDept(e.target.value)}
                placeholder="e.g. Himalaya Hostel"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || uploading}>
            {submitting
              ? isEdit
                ? 'Saving Changes...'
                : 'Publishing & Generating QR...'
              : isEdit
                ? 'Save Listing'
                : 'Publish Listing & Generate QR'}
          </Button>
        </div>
      </form>
    </div>
  );
}
