"use client";

import { useEffect, useState } from "react";
import { listNotices } from "@/lib/api";
import { Notice } from "@/types/user";
import { Card, CardContent } from "@/components/ui/card";
import { Megaphone } from "lucide-react";

export default function NoticesPage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <main className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-md mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-2 px-1">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                        <Megaphone size={20} />
                    </div>
                    <div>
                        <h1 className="text-slate-900 font-bold text-xl tracking-tight leading-tight">공지사항</h1>
                        <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wider">TwoDegrees Announcements</p>
                    </div>
                </div>

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
                    <div className="grid grid-cols-1 gap-4">
                        {notices.map((notice) => (
                            <Card key={notice.id} className="border-0 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden bg-white hover:ring-2 hover:ring-blue-100 transition-all active:scale-[0.98]">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            {notice.is_popup && (
                                                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">중요</span>
                                            )}
                                            <span className="text-[10px] text-slate-400 font-bold font-mono">#{notice.id}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            {new Date(notice.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h3 className="text-slate-900 font-bold text-base mb-2 group-hover:text-blue-600 transition-colors">{notice.title}</h3>
                                    <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap break-all font-medium italic">
                                        {notice.content}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="pt-8 text-center border-t border-slate-200">
                    <p className="text-slate-400 text-[10px] font-medium px-4 leading-relaxed">
                        중요한 업데이트 사항은 이 페이지와 팝업으로 안내드립니다.<br />
                        © 2026 TwoDegrees Team.
                    </p>
                </div>
            </div>
        </main>
    );
}
