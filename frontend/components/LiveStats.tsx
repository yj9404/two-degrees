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
                // 에러 무시 (Mockup 데이터 혹은 0 표시)
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

    return (
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
    );
}
