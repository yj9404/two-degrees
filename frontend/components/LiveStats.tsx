"use client";

import { useEffect, useState } from "react";
import { getUserStats } from "@/lib/api";
import type { UserStatsResponse } from "@/types/user";
import { Users, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function LiveStats() {
    const [stats, setStats] = useState<UserStatsResponse | null>(null);

    useEffect(() => {
        getUserStats()
            .then(setStats)
            .catch(() => {
                // 에러 무시
            });
    }, []);

    const statsData = [
        {
            label: "소개팅 풀 등록자",
            value: stats?.total_users != null ? stats.total_users.toLocaleString() : "...",
            unit: "명",
            icon: <Users className="text-blue-600" size={20} />,
            bg: "bg-blue-50"
        },
        {
            label: "누적 매칭 제안",
            value: stats?.total_matchings != null ? stats.total_matchings.toLocaleString() : "...",
            unit: "건",
            icon: <Heart className="text-pink-600" size={20} />,
            bg: "bg-pink-50"
        }
    ];

    const maleRatio = stats?.male_ratio ?? 50;
    const femaleRatio = stats?.female_ratio ?? 50;
    const hasStats = stats != null;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                {statsData.map((s) => (
                    <Card key={s.label} className="border-0 shadow-sm bg-white overflow-hidden">
                        <CardContent className="p-5 flex flex-col items-center gap-2">
                            <div className={`w-10 h-10 ${s.bg} rounded-full flex items-center justify-center mb-1`}>
                                {s.icon}
                            </div>
                            <div className="text-2xl font-bold text-slate-900 tracking-tight">
                                {s.value}<span className="text-sm font-normal text-slate-500 ml-0.5">{s.unit}</span>
                            </div>
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {s.label}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* 성비 카드 */}
            <Card className="border-0 shadow-sm bg-white overflow-hidden">
                <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            활성 회원 성비
                        </span>
                        <span className="text-[10px] text-slate-400">
                            {hasStats ? `총 ${stats.total_active}명` : "..."}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-blue-600 w-10 text-right shrink-0">
                            {hasStats ? `${maleRatio}%` : "..."}
                        </span>
                        <div className="flex-1 h-2.5 flex rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-700"
                                style={{ width: hasStats ? `${maleRatio}%` : "50%" }}
                            />
                            <div
                                className="h-full bg-pink-400 transition-all duration-700"
                                style={{ width: hasStats ? `${femaleRatio}%` : "50%" }}
                            />
                        </div>
                        <span className="text-sm font-bold text-pink-500 w-10 shrink-0">
                            {hasStats ? `${femaleRatio}%` : "..."}
                        </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-medium px-13">
                        <span>👨 남성</span>
                        <span>여성 👩</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
