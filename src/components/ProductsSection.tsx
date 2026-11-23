import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  SlidersHorizontal, 
  Copy, 
  Check, 
  Star, 
  Sparkles, 
  Truck, 
  ShieldCheck, 
  Eye, 
  Share2,
  Link2
} from 'lucide-react';
import { Product, Language } from '../types';
import { playSound } from '../utils/audio';

interface ProductsSectionProps {
  products: Product[];
  onSelectProductForOrder: (product: Product) => void;
  onShowToast: (msg: string) => void;
  language?: Language;
  onClose?: () => void;
}

export const ProductsSection: React.FC<ProductsSectionProps> = ({
  products,
  onSelectProductForOrder,
  onShowToast,
  language = 'bn',
  onClose
}) => {
  const isBn = language === 'bn';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'commission' | 'price_low' | 'popularity'>('commission');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAffiliateId, setCopiedAffiliateId] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Unified Filtering & Sorting (No Category Separation)
  const filteredProducts = products
    .filter((item) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(query) || 
               item.titleEn.toLowerCase().includes(query) ||
               item.description.toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'commission') return b.commission - a.commission;
      if (sortBy === 'price_low') return a.customerPrice - b.customerPrice;
      if (sortBy === 'popularity') return (b.soldCount ?? 0) - (a.soldCount ?? 0);
      return 0;
    });

  const handleCopyPost = (product: Product) => {
    playSound('coin');
    const template = `🔥 ${isBn ? product.title : product.titleEn}
💰 ${isBn ? 'দাম' : 'Price'}: ৳${product.customerPrice}
✅ ${isBn ? 'বৈশিষ্ট্যসমূহ' : 'Features'}:
${product.features.map(f => `• ${f}`).join('\n')}

🚚 ${isBn ? 'সারা বাংলাদেশে ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে টাকা দিন)।' : 'Cash on Delivery across Bangladesh.'}
📦 ${isBn ? 'অর্ডার করতে ইনবক্স করুন বা আপনার নাম, ঠিকানা ও মোবাইল নম্বর দিন!' : 'Send Name, Address & Phone to order!'}`;

    navigator.clipboard.writeText(template);
    setCopiedId(product.id);
    onShowToast(isBn ? `'${product.titleEn}' পণ্যের বিবরণ ক্লিপবোর্ডে কপি হয়েছে!` : `Product post details copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyAffiliateLink = (product: Product) => {
    playSound('coin');
    const affiliateUrl = `https://microearnbd.com/p/${product.id}?ref=MEHADI89`;
    navigator.clipboard.writeText(affiliateUrl);
    setCopiedAffiliateId(product.id);
    onShowToast(isBn ? `অ্যাফিলিয়েট লিংক তৈরি হয়েছে: ${affiliateUrl}` : `Affiliate link copied: ${affiliateUrl}`);
    setTimeout(() => setCopiedAffiliateId(null), 2500);
  };

  return (
    <section id="products" className="w-full max-w-full overflow-x-clip pb-6 relative">
      {/* Sticky Sub-View Top Bar with Always-Visible Close (×) Button */}
      {onClose && (
        <div className="sticky top-[calc(60px+env(safe-area-inset-top,0px))] z-40 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {isBn ? 'রিসেলিং পণ্য শপ' : 'Reselling Store'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="w-11 h-11 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
            aria-label="হোম ড্যাশবোর্ডে ফিরে যান"
            title={isBn ? 'হোমে ফিরে যান (×)' : 'Close & Return Home (×)'}
          >
            &times;
          </button>
        </div>
      )}

      <div className="w-full px-3.5 pt-5">
        
        {/* Section Header */}
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
              <ShoppingBag className="w-3.5 h-3.5" />
              {isBn ? 'রিসেলিং হাব ও হাই কমিশন' : 'Reseller Hub & High Commission'}
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isBn ? 'ট্রেন্ডিং পণ্য ও নিশ্চিত কমিশন' : 'Trending Products & Verified Commission'}
            </h2>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isBn 
                ? 'হোলসেল দামে পণ্যগুলো ফেসবুক, হোয়াটসঅ্যাপ বা টিকটকে শেয়ার করুন। প্রতিটি অর্ডারে ২০০-৫০০৳ প্রফিট পান!' 
                : 'Share products on social media at wholesale rates. Earn ৳200-৳500 profit per order!'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-3 py-2 rounded-xl self-start">
            <Truck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{isBn ? 'সারা দেশে ক্যাশ অন ডেলিভারি সার্ভিস উপলব্ধ' : 'Cash on Delivery Nationwide'}</span>
          </div>
        </div>

        {/* Unified Search and Sort Bar */}
        <div className="glass-card p-3.5 rounded-2xl mb-6 flex flex-col gap-3 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
              {isBn ? `মোট পণ্য: ${filteredProducts.length} টি` : `Total Products: ${filteredProducts.length}`}
            </span>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col min-[420px]:flex-row flex-1 sm:flex-initial items-stretch min-[420px]:items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative flex-1 sm:w-72 min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={isBn ? 'পণ্য খুঁজুন...' : 'Search products...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-[44px] pl-9 pr-3 py-2 text-base sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full min-[420px]:w-auto min-h-[44px] px-3 py-2 text-base sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
              >
                <option value="commission">{isBn ? 'কমিশন (সর্বোচ্চ)' : 'Highest Commission'}</option>
                <option value="popularity">{isBn ? 'জনপ্রিয়তা' : 'Popularity'}</option>
                <option value="price_low">{isBn ? 'দাম (কম-বেশি)' : 'Price: Low to High'}</option>
              </select>
            </div>
          </div>

        </div>

        {/* Products Grid or Empty Inventory State */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 sm:py-20 px-6 glass-panel rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-4 max-w-2xl mx-auto animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {isBn ? 'বর্তমানে কোনো পণ্য তালিকায় নেই' : 'No Products Available in Store'}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {isBn 
                  ? 'স্টোরটি সম্পূর্ণ ফাঁকা শুরু হয়েছে। এডমিন প্যানেল থেকে বাংলা নাম, ইংরেজি নাম, হোলসেল মূল্য ও রিসেলার কমিশনসহ পণ্য যুক্ত করা হলে এখানে লাইভ প্রদর্শিত হবে।' 
                  : 'The product inventory starts empty. Products added via the Admin Panel with wholesale price and reseller commission will appear here.'}
              </p>
            </div>
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>অর্ডার করার সাথে সাথে এস্ক্রো কমিশন ট্র্যাকিং সক্রিয় হবে</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProducts.map((product) => {
            const isCopied = copiedId === product.id;
            const isAffiliateCopied = copiedAffiliateId === product.id;

            return (
              <div
                key={product.id}
                className="glass-card rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 hover:shadow-xl transition-all duration-300 flex flex-col group"
              >
                {/* Image Container with Resilient Fallback */}
                <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                  <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  <img
                    src={product.image}
                    alt={product.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  
                  {/* High Contrast Commission Badge */}
                  <div className="absolute top-3 left-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1 rounded-xl text-xs font-black shadow-lg shadow-emerald-950/40 flex items-center gap-1 border border-white/20 tabular-nums">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isBn ? `কমিশন: ৳${product.commission}` : `Commission: ৳${product.commission}`}</span>
                  </div>

                  {/* Delivery tag */}
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums">
                    {isBn ? `ডেলিভারি ৳${product.deliveryChargeInside ?? 60}` : `Delivery ৳${product.deliveryChargeInside ?? 60}`}
                  </div>

                  {/* Quick View Button */}
                  <button
                    type="button"
                    onClick={() => setQuickViewProduct(product)}
                    className="absolute bottom-3 right-3 p-2.5 min-w-[40px] min-h-[40px] rounded-xl bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-white shadow-md sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:scale-105 cursor-pointer flex items-center justify-center"
                    title={isBn ? 'বিস্তারিত দেখুন' : 'Quick View'}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                {/* Card Content */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Supplier & Rating */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                      <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {product.supplier || 'MicroEarn Direct'}
                      </span>
                      <span className="flex items-center gap-1 text-amber-500 font-bold tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {product.rating || 4.9}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {isBn ? product.title : product.titleEn}
                    </h3>

                    {/* Price & Delivery Breakdown */}
                    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                        <span className="text-slate-500 dark:text-slate-400">{isBn ? 'ডেলিভারি:' : 'Delivery:'}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums text-right">
                          ৳{product.deliveryChargeInside ?? 60} (ঢাকা) / ৳{product.deliveryChargeOutside ?? 120} (বাইরে)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-slate-500 dark:text-slate-400">{isBn ? 'কাস্টমার মূল্য:' : 'Customer Price:'}</span>
                        <span className="font-extrabold text-base sm:text-lg text-emerald-600 dark:text-emerald-400 tabular-nums">৳{product.customerPrice}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    
                    {/* Order Now Button */}
                    <button
                      onClick={() => {
                        playSound('click');
                        onSelectProductForOrder(product);
                      }}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>{isBn ? `অর্ডার করুন (কমিশন ৳${product.commission})` : `Order Now (Profit ৳${product.commission})`}</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Copy Post Text Button */}
                      <button
                        onClick={() => handleCopyPost(product)}
                        className={`min-h-[40px] py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isCopied 
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300' 
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isBn ? 'কপি হয়েছে' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{isBn ? 'বিবরণ কপি' : 'Copy Post'}</span>
                          </>
                        )}
                      </button>

                      {/* Affiliate Link Generator Button */}
                      <button
                        onClick={() => handleCopyAffiliateLink(product)}
                        className={`min-h-[40px] py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isAffiliateCopied 
                            ? 'bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-950/40 dark:border-purple-700 dark:text-purple-300' 
                            : 'border-purple-200 dark:border-purple-900/60 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30'
                        }`}
                      >
                        {isAffiliateCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-purple-600" />
                            <span>{isBn ? 'লিংক কপিড' : 'Link Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3.5 h-3.5 text-purple-500" />
                            <span>{isBn ? 'অ্যাফিলিয়েট' : 'Affiliate'}</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


        {/* Quick View Modal */}
        {quickViewProduct && (
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] px-3 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="relative my-auto w-full max-w-[436px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px))] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                  {quickViewProduct.supplier}
                </span>
                <button
                  type="button"
                  onClick={() => { playSound('click'); setQuickViewProduct(null); }}
                  className="w-10 h-10 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
                  aria-label="বন্ধ করুন"
                  title={isBn ? 'বন্ধ করুন (×)' : 'Close (×)'}
                >
                  &times;
                </button>
              </div>

              <div className="relative h-56 rounded-2xl mb-4 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                <img 
                  src={quickViewProduct.image} 
                  alt={quickViewProduct.title} 
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="absolute inset-0 w-full h-full object-cover" 
                />
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {isBn ? quickViewProduct.title : quickViewProduct.titleEn}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                {quickViewProduct.description}
              </p>

              <div className="mt-4">
                <h4 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                  {isBn ? 'প্রধান ফিচারসমূহ:' : 'Key Features:'}
                </h4>
                <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                  {quickViewProduct.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    const prod = quickViewProduct;
                    setQuickViewProduct(null);
                    onSelectProductForOrder(prod);
                  }}
                  className="flex-1 min-h-[44px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md cursor-pointer"
                >
                  {isBn ? 'অর্ডার ফর্ম খুলুন' : 'Open Order Form'}
                </button>
                <button
                  onClick={() => handleCopyPost(quickViewProduct)}
                  className="min-h-[44px] px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold cursor-pointer"
                >
                  {isBn ? 'বিবরণ কপি' : 'Copy Post'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};

