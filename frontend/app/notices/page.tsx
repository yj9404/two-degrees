"use client";

import { useEffect, useState } from "react";
import { listNotices } from "@/lib/api";
import { Notice } from "@/types/user";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, ChevronDown, ChevronUp } from "lucide-react";
import FAQSection from "@/components/FAQSection";

export default function NoticesPage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        const fetchNotices = async () => {
            try {
                const data = await listNotices();
                setNotices(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchNotices();
    }, []);

    const toggleNotice = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <main className="min-h-screen bg-slate-50 pb-20">
            <div className="max-w-md mx-auto px-4 pt-8 space-y-8">
                {/* 헤더 섹션 */}
                <div className="flex items-center gap-3 mb-2 px-1">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100 font-bold">
                        <Megaphone size={20} />
                    </div>
                    <div>
                        <h1 className="text-slate-900 font-bold text-xl tracking-tight leading-tight">공지사항</h1>
                        <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wider">TwoDegrees Announcements</p>
                    </div>
                </div>

                {/* 공지 목록 */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-4">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="text-slate-500 text-sm font-medium animate-pulse">불러오는 중...</p>
                        </div>
                    ) : notices.length === 0 ? (
                        <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <p className="text-slate-400 text-sm font-medium">등록된 공지가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notices.map((notice) => (
                                <div 
                                    key={notice.id} 
                                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                                        expandedId === notice.id 
                                        ? "border-blue-200 shadow-md ring-1 ring-blue-50" 
                                        : "border-slate-100 shadow-sm hover:border-slate-200"
                                    }`}
                                >
                                    <button 
                                        onClick={() => toggleNotice(notice.id)}
                                        className="w-full p-5 flex flex-col text-left transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {notice.is_popup && (
                                                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100">중요</span>
                                                )}
                                                <span className="text-[10px] text-slate-400 font-bold font-mono">#{notice.id}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <span className="text-[10px] font-medium">
                                                    {new Date(notice.created_at).toLocaleDateString()}
                                                </span>
                                                {expandedId === notice.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </div>
                                        </div>
                                        <h3 className={`font-bold text-sm sm:text-base tracking-tight ${expandedId === notice.id ? "text-blue-600" : "text-slate-900"}`}>
                                            {notice.title}
                                        </h3>
                                    </button>
                                    
                                    {expandedId === notice.id && (
                                        <div className="px-5 pb-6 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="h-px bg-slate-100 mb-4" />
                                            <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium break-keep">
                                                {notice.content}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FAQ 섹션 통합 */}
                <div className="pt-12 space-y-6">
                    <div className="px-1 text-center space-y-2">
                        <h3 className="text-slate-900 font-bold text-lg">자주 묻는 질문</h3>
                        <p className="text-slate-500 text-xs font-medium italic">서비스 이용 전 FAQ를 먼저 확인해 보세요.</p>
                    </div>
                    <FAQSection />
                </div>

                <div className="pt-12 text-center border-t border-slate-100">
                    <p className="text-slate-400 text-[10px] font-medium px-4 leading-relaxed tracking-tight">
                        궁금한 점이나 제안 사항은 카카오톡 채널을 통해 말씀해 주세요.<br />
                        © 2026 TwoDegrees Team.
                    </p>
                </div>
            </div>
        </main>
    );
}
