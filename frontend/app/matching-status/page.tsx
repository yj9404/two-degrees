"use client";

import { useEffect, useState } from "react";
import { getDailyMatchingStats } from "@/lib/api";
import type { DailyMatchingStats } from "@/types/user";
import { Heart, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function MatchingStatusPage() {
    const [stats, setStats] = useState<DailyMatchingStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getDailyMatchingStats()
            .then((res) => {
                setStats(res.stats);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    return (
        <main className="min-h-[100dvh] py-12 px-6">
            <div className="space-y-8">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl mb-2">
                        <Heart size={24} fill="currentColor" />
                    </div>
                    <h1 className="text-slate-900 font-bold text-2xl tracking-tight">전체 매칭 현황</h1>
                    <p className="text-slate-500 text-sm break-keep">
                        TwoDegrees에서 탄생한 소중한 인연들의 기록입니다.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : stats.length > 0 ? (
                    <div className="flex flex-col items-center gap-3">
                        {stats.map((item) => (
                            <Card key={item.date} className="w-full max-w-[280px] border-0 shadow-sm bg-pink-50/50 overflow-hidden group hover:shadow-md transition-all hover:-translate-y-0.5">
                                <CardContent className="py-2 px-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 bg-white text-pink-500 rounded-lg flex items-center justify-center shadow-sm">
                                            <Calendar size={14} />
                                        </div>
                                        <div className="space-y-0">
                                            <p className="text-slate-900 font-bold text-[13px] leading-none">
                                                {item.date}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[15px] font-black text-pink-600 leading-none">
                                            {item.count}<span className="text-[10px] font-bold text-pink-400 ml-1">Matching</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <p className="text-slate-400 text-sm">아직 매칭 기록이 없습니다.</p>
                    </div>
                )}

                <div className="pt-8 text-center">
                    <p className="text-slate-400 text-[11px] leading-relaxed break-keep">
                        매칭 현황은 개인 정보를 보호하며 통계 목적으로만 공개됩니다.
                    </p>
                </div>
            </div>
        </main>
    );
}
