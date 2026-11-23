import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Phone, 
  Mail, 
  HelpCircle,
  MessageCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { FeedbackItem, UserAccount, Language } from '../types';
import { playSound } from '../utils/audio';

interface SupportFeedbackSectionProps {
  currentUser: UserAccount | null;
  feedbacks: FeedbackItem[];
  onSubmitFeedback: (feedback: FeedbackItem) => void;
  onShowToast: (msg: string) => void;
  language?: Language;
  onClose?: () => void;
  onOpenAiChat?: () => void;
}

export const SupportFeedbackSection: React.FC<SupportFeedbackSectionProps> = ({
  currentUser,
  feedbacks,
  onSubmitFeedback,
  onShowToast,
  language = 'bn',
  onClose,
  onOpenAiChat
}) => {
  const isBn = language === 'bn';
  const [category, setCategory] = useState<FeedbackItem['category']>('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      playSound('error');
      return;
    }

    setIsSubmitting(true);
    playSound('coin');

    setTimeout(() => {
      const newFeedback: FeedbackItem = {
        id: 'FB-' + Math.floor(100 + Math.random() * 900),
        userId: currentUser?.id || 'USR-8921',
        userName: currentUser?.name || 'মেহেদী হাসান',
        userPhone: currentUser?.phone || '01712345678',
        category,
        subject,
        message,
        date: 'আজ, ' + new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        status: 'pending'
      };

      onSubmitFeedback(newFeedback);
      setIsSubmitting(false);
      setSubject('');
      setMessage('');
      playSound('success');
      onShowToast(isBn ? 'আপনার মতামত সফলভাবে গৃহীত হয়েছে! দ্রুত ব্যবস্থা নেওয়া হবে।' : 'Feedback submitted successfully!');
    }, 600);
  };

  const faqs = [
    {
      q: 'টাকা তুলতে কি কোনো ইনভেস্টমেন্ট বা ডিপোজিট প্রয়োজন?',
      a: 'না, MicroEarn BD সম্পূর্ণ ফ্রি প্ল্যাটফর্ম। কোনো মেম্বারশিপ ফি বা ডিপোজিট ছাড়াই কাজ ও রিসেল করে টাকা তুলতে পারবেন।'
    },
    {
      q: 'উইথড্র রিকোয়েস্ট দেওয়ার পর কতক্ষণে বিকাশ/নগদে টাকা আসে?',
      a: 'আমাদের অটোমেটেড পেআউট সিস্টেমের মাধ্যমে পাসওয়ার্ড ভেরিফিকেশনের পর সাধারণত ১৫ মিনিট থেকে সর্বোচ্চ ৩ ঘণ্টার মধ্যে আপনার বিকাশ, নগদ বা রকেটে টাকা পৌঁছায়।'
    },
    {
      q: 'রিসেলিং এস্ক্রো কমিশন কীভাবে রিলিজ হয়?',
      a: 'কাস্টমার পণ্য হাতে পেয়ে মূল্য পরিশোধ করার পর এডমিন অর্ডারটিকে "ডেলিভার্ড ও পেইড" অনুমোদন করলে পেন্ডিং এস্ক্রো ব্যালেন্স সরাসরি উত্তোলনযোগ্য মেইন ব্যালেন্সে চলে আসে।'
    },
    {
      q: 'ভুল নম্বরে ক্যাশআউট রিকোয়েস্ট দিলে রিফান্ড পাওয়া সম্ভব?',
      a: 'হ্যাঁ, এডমিন ড্যাশবোর্ড থেকে ভুল উইথড্রয়ালটি কারণ উল্লেখ করে বাতিল করলে স্বয়ংক্রিয়ভাবে পুরো টাকা আপনার মেইন একাউন্ট ব্যালেন্সে রিফান্ড হয়ে যাবে।'
    }
  ];

  return (
    <section id="support" className="w-full max-w-full overflow-x-clip pb-6 relative">
      {/* Sticky Sub-View Top Bar with Always-Visible Close (×) Button */}
      {onClose && (
        <div className="sticky top-[calc(60px+env(safe-area-inset-top,0px))] z-40 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
              মতামত ও অভিযোগ কেন্দ্র
            </span>
          </div>
          <button
            type="button"
            onClick={() => { playSound('click'); onClose(); }}
            className="w-11 h-11 rounded-2xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-slate-800 dark:hover:bg-rose-600 dark:text-slate-100 border-2 border-rose-200 dark:border-slate-700 font-black text-2xl leading-none flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
            aria-label="Close and return home"
            title="হোমে ফিরে যান (×)"
          >
            &times;
          </button>
        </div>
      )}

      <div className="w-full px-3.5 pt-5">
        
        {/* Banner with Prompt's Exact Required Text */}
        <div className="relative mb-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-bold uppercase tracking-wider mb-2.5 border border-teal-300 dark:border-teal-800">
              <MessageSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>সাপোর্ট ও মতামত কেন্দ্র</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              মতামত ও অভিযোগ বক্স
            </h2>
            {/* CRITICAL EXACT TEXT FROM USER REQUIREMENT */}
            <div className="mt-3 p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 text-teal-900 dark:text-teal-200 text-xs font-semibold leading-relaxed shadow-sm">
              "আপনার যেকোনো বিষয়ে মতামত বা অভিযোগ এখানে করুন। আমরা আপনার মতামত বিবেচনা করে দ্রুত ব্যবস্থা নেওয়ার চেষ্টা করব।"
            </div>
            {onOpenAiChat && (
              <div className="mt-3.5 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    onOpenAiChat();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{isBn ? 'তাৎক্ষণিক AI সাপোর্ট চ্যাট শুরু করুন' : 'Ask Instant AI Support Assistant'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          
          {/* Main Feedback Form */}
          <div className="min-w-0">
            <div className="glass-card p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Send className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>আপনার মতামত বা অভিযোগ পাঠান</span>
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Category Selector */}
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      বিষয়শ্রেণী (Category) *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      <option value="suggestion">💡 নতুন উন্নয়ন প্রস্তাব বা পরামর্শ (Suggestion)</option>
                      <option value="withdrawal_issue">💳 টাকা উত্তোলন / ক্যাশআউট সমস্যা (Withdrawal)</option>
                      <option value="job_issue">💼 মাইক্রো-জব ও টাস্ক রিওয়ার্ড সমস্যা (Jobs)</option>
                      <option value="reselling_help">📦 রিসেলিং ও কুরিয়ার ট্র্যাকিং হেল্প (Reselling)</option>
                      <option value="complaint">⚠️ সাধারণ অভিযোগ বা ত্রুটি রিপোর্ট (Complaint)</option>
                      <option value="other">💬 অন্যান্য বিষয়ে জানতে চাই (General)</option>
                    </select>
                  </div>

                  {/* Subject Input */}
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      সংক্ষিপ্ত বিষয় (Subject) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="যেমন: উইথড্রয়াল স্ট্যাটাস সম্পর্কে জানতে চাই..."
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Message Input */}
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      বিস্তারিত বার্তা বা অভিযোগের বিবরণ *
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="আপনার অভিযোগ বা পরামর্শের বিস্তারিত এখানে স্পষ্টভাবে লিখুন..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                    />
                  </div>

                  {/* User Phone Note */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-center justify-between flex-wrap gap-2">
                    <span>প্রেরক: <strong>{currentUser?.name || 'ব্যবহারকারী'}</strong> ({currentUser?.phone || '০১৭xxxxxxxx'})</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">আইডি: {currentUser?.id || 'USR'}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[48px] py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-teal-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span>বার্তা পাঠানো হচ্ছে...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>মতামত / অভিযোগ সাবমিট করুন</span>
                      </>
                    )}
                  </button>
                </form>
            </div>
          </div>

          {/* Sidebar Support Info & FAQs */}
          <div className="space-y-6">
            
            {/* Quick Contacts */}
            <div className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-md space-y-4">
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-teal-600" />
                <span>সরাসরি হেল্পলাইন</span>
              </h4>

              <div className="space-y-2.5 text-sm">
                <a
                  href="https://t.me/"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center gap-3 text-teal-900 dark:text-teal-200 hover:bg-teal-100 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5 text-teal-600 shrink-0" />
                  <div>
                    <div className="font-bold text-sm">অফিসিয়াল টেলিগ্রাম সাপোর্ট</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">২৪/৭ লাইভ এজেন্ট সহায়তা</div>
                  </div>
                </a>

                <a
                  href="https://wa.me/"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-sm">হোয়াটসঅ্যাপ হেল্পলাইন</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">+৮৮০১৭০০০০০০০০</div>
                  </div>
                </a>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center gap-3 text-slate-700 dark:text-slate-200">
                  <Mail className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div>
                    <div className="font-bold text-sm">অফিসিয়াল ইমেইল</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">support@microearnbd.com</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick FAQs */}
            <div className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-md">
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                <span>সাধারণ প্রশ্নাবলি (FAQ)</span>
              </h4>

              <div className="space-y-2.5">
                {faqs.map((faq, i) => (
                  <div key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-none pb-2.5">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full py-1.5 text-left text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2 hover:text-emerald-600 cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {openFaq === i ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                    </button>
                    {openFaq === i && (
                      <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                        {faq.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
