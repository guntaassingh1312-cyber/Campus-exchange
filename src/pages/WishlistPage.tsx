import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { ProductCard } from '../components/ProductCard';
import { apiFetch, type Product } from '../lib/api';

export function WishlistPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: Product[] }>('/api/wishlist');
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load wishlist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  const removeFromWishlist = async (productId: string) => {
    try {
      await apiFetch(`/api/wishlist/${productId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((item) => item.id !== productId));
      toast.success('Removed from wishlist.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove item.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          My Wishlist
        </h1>
        <p className="text-sm text-zinc-600 mt-0.5">
          Saved campus items you’re watching for purchase or semester rental.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading saved items...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <Heart className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-base font-semibold text-zinc-900">
            Your wishlist is empty
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            Tap the heart icon on any campus listing to bookmark it here.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/app/explore">Explore Marketplace</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              linkPrefix="/app/product"
              isWishlisted
              onToggleWishlist={removeFromWishlist}
            />
          ))}
        </div>
      )}
    </div>
  );
}
