"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { getSharedProfile, respondSharedMatching } from "@/lib/api";
import { SharedProfileRead, MatchStatus } from "@/types/user";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, Briefcase, Ruler, Sparkles, CheckCircle2, XCircle, GraduationCap, Building2, Fingerprint, Church, Cigarette, Wine, Dumbbell, Palette, Cake } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function SharedProfilePage() {
    const { token } = useParams<{ token: string }>();
    const [profile, setProfile] = useState<(SharedProfileRead & { expires_at?: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [responded, setResponded] = useState<MatchStatus | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [activePhotoIndex, setActivePhotoIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (scrollRef.current) {
            const scrollLeft = scrollRef.current.scrollLeft;
            const width = scrollRef.current.offsetWidth;
            const index = Math.round(scrollLeft / width);
            if (index !== activePhotoIndex) {
                setActivePhotoIndex(index);
            }
        }
    };

    const scrollToPhoto = (idx: number) => {
        if (scrollRef.current) {
            const width = scrollRef.current.offsetWidth;
            scrollRef.current.scrollTo({
                left: width * idx,
                behavior: "smooth"
            });
            setActivePhotoIndex(idx);
        }
    };

    useEffect(() => {
        if (token) {
            getSharedProfile(token)
                .then(setProfile)
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [token]);

    useEffect(() => {
        if (!profile?.expires_at) return;

        const updateTimer = () => {
            const now = new Date().getTime();
            const expiryStr = profile.expires_at!;
            const end = new Date(expiryStr.endsWith('Z') || expiryStr.includes('+') ? expiryStr : expiryStr + 'Z').getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft("만료됨");
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            const hStr = h.toString();
            const mStr = m.toString().padStart(2, '0');
            const sStr = s.toString().padStart(2, '0');

            setTimeLeft(`${hStr}:${mStr}:${sStr}`);
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);

        return () => clearInterval(timer);
    }, [profile?.expires_at]);

    const handleRespond = async (status: MatchStatus) => {
        if (!token) return;
        try {
            await respondSharedMatching(token, { status });
            setResponded(status);
        } catch (err: any) {
            alert(err.message || "응답 처리 중 오류가 발생했습니다.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center shadow-sm">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-slate-900 mb-2">접근할 수 없는 링크입니다.</h1>
                    <p className="text-slate-500 text-sm mb-6">{error || "만료되었거나 유효하지 않은 링크입니다."}</p>
                </Card>
            </div>
        );
    }

    if (responded) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center shadow-sm">
                    <CheckCircle2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-slate-900 mb-2">응답이 기록되었습니다.</h1>
                    <p className="text-slate-500 text-sm">상대방의 수락 여부에 따라 추후 안내될 예정입니다.</p>
                </Card>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-slate-50 select-none pb-24"
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="max-w-md mx-auto min-h-screen bg-white shadow-sm flex flex-col">
                {/* Expiration Banner */}
                {profile.expires_at && (
                    <div className="bg-baby-blue px-4 py-2.5 flex items-center justify-between border-b border-blue-200/50 shadow-sm font-nanum">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-700/80" />
                            <span className="text-[11px] text-blue-900 font-bold uppercase tracking-tight">
                                남은 시간
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-extrabold text-blue-900 tabular-nums tracking-wider">
                                {timeLeft}
                            </span>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto pb-4 select-none" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
                    {/* Photo Gallery with Swipe Capability */}
                    <div
                        ref={scrollRef}
                        className="relative aspect-[3/4] bg-slate-900 overflow-x-auto flex snap-x snap-mandatory scrollbar-hide"
                        onScroll={handleScroll}
                        style={{ WebkitTouchCallout: 'none', scrollBehavior: 'smooth' }}
                    >
                        {profile.photo_urls && profile.photo_urls.length > 0 ? (
                            profile.photo_urls.map((url, idx) => (
                                <div key={idx} className="relative w-full h-full flex-shrink-0 snap-center">
                                    {/* Blurred background for a premium look */}
                                    <Image
                                        src={url}
                                        alt=""
                                        fill
                                        className="object-cover blur-2xl opacity-40 scale-110"
                                        draggable={false}
                                    />
                                    <Image
                                        src={url}
                                        alt={`Profile Photo ${idx + 1}`}
                                        fill
                                        className="object-contain transition-all duration-300 relative z-10"
                                        priority={idx === 0}
                                        draggable={false}
                                    />
                                    {/* Touch Prevention Overlay - Moved inside each item to allow container scrolling */}
                                    <div
                                        className="absolute inset-0 z-20 bg-transparent"
                                        style={{ WebkitTouchCallout: 'none' }}
                                        onContextMenu={(e) => e.preventDefault()}
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 w-full h-full">
                                <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                                <span className="text-xs font-medium">프로필 사진이 없습니다.</span>
                            </div>
                        )}

                        {/* Information Belt (Stripe) Overlay - Fixed relative to the gallery area */}
                        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-black/40 backdrop-blur-md text-white border-t border-white/10 z-30 pointer-events-none">
                            <div className="flex items-baseline gap-2">
                                <h1 className="text-2xl font-bold tracking-tight">{profile.age}세</h1>
                                <span className="text-xs font-medium opacity-40">|</span>
                                <p className="text-sm font-medium opacity-90 truncate max-w-[220px]">{profile.job}</p>
                            </div>
                        </div>
                    </div>

                    {/* Thumbnail Strip */}
                    {profile.photo_urls && profile.photo_urls.length > 1 && (
                        <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-hide">
                            {profile.photo_urls.map((url, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => scrollToPhoto(idx)}
                                    className={`relative w-16 h-20 rounded-lg overflow-hidden shrink-0 cursor-pointer transition-all ${activePhotoIndex === idx
                                        ? "ring-2 ring-blue-500 ring-offset-2 scale-105"
                                        : "opacity-60 grayscale-[30%] hover:opacity-100"
                                        }`}
                                    style={{ WebkitTouchCallout: 'none' }}
                                >
                                    <Image
                                        src={url}
                                        alt={`Thumbnail ${idx + 1}`}
                                        fill
                                        className="object-cover"
                                        draggable={false}
                                    />
                                    {/* Security Layer for Thumbnails */}
                                    <div
                                        className="absolute inset-0 z-10 bg-transparent"
                                        onContextMenu={(e) => e.preventDefault()}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="px-6 space-y-1.5">
                        {profile.photo_urls && profile.photo_urls.length > 1 && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                사진을 옆으로 밀어서 볼 수 있습니다.
                            </p>
                        )}
                        <p className="text-[9px] text-slate-400 leading-tight">
                            * 프라이버시 보호를 위해 캡처 및 무단 저장을 금지하며, 위반 시 서비스 이용이 제한될 수 있습니다.
                        </p>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <InfoItem icon={<Briefcase />} label="직업" value={profile.job} />
                            <InfoItem icon={<Cake />} label="출생연도" value={`${profile.birth_year}년생`} />
                            <InfoItem icon={<MapPin />} label="주 활동지역" value={profile.active_area} />
                            <InfoItem icon={<Ruler />} label="키" value={profile.height ? `${profile.height}cm` : null} />
                            <InfoItem icon={<GraduationCap />} label="학력" value={profile.education} />
                            <InfoItem icon={<Building2 />} label="직장 또는 학교 위치" value={profile.workplace} />
                            <InfoItem icon={<Fingerprint />} label="MBTI" value={profile.mbti} />
                            <InfoItem icon={<Church />} label="종교" value={profile.religion} />
                            <InfoItem icon={<Dumbbell />} label="운동" value={profile.exercise} />
                            <InfoItem icon={<Palette />} label="취미" value={profile.hobbies} />
                            <InfoItem
                                icon={<Cigarette />}
                                label="흡연"
                                value={profile.smoking_status === "SMOKER" ? "흡연" : profile.smoking_status === "NON_SMOKER" ? "비흡연" : null}
                            />
                            <InfoItem
                                icon={<Wine />}
                                label="음주"
                                value={profile.drinking_status === "DRINKER" ? "자주 마심" : profile.drinking_status === "SOCIAL_DRINKER" ? "상황에 따라" : profile.drinking_status === "NON_DRINKER" ? "안 마심" : null}
                            />
                        </div>

                        {/* AI Recommendation Reason */}
                        <div className="space-y-3 pt-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1 px-2 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-tight">AI Matching Insight</div>
                            </div>
                            <Card className="border-none bg-blue-50/50 shadow-none">
                                <CardContent className={`p-4 pt-4 text-slate-700 text-sm leading-relaxed ${profile.ai_reason ? 'italic' : ''}`}>
                                    {profile.ai_reason ? `"${profile.ai_reason}"` : "관리자가 직접 매칭하였습니다."}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 pt-2 border-t border-slate-100 grid grid-cols-2 gap-3 fixed bottom-0 max-w-md w-full bg-white/80 backdrop-blur-md">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="h-12 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100 font-semibold">
                                거절하기
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>매칭을 거절하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    이 선택은 변경할 수 없으며, 확인을 누르면 링크가 즉시 만료됩니다.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleRespond("REJECTED")}
                                    className="bg-red-500 hover:bg-red-600 rounded-xl"
                                >
                                    거절 확정
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                                수락하기
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>매칭을 수락하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    상대방도 수락할 경우 서로의 연락처가 공개됩니다. 이 선택은 취소할 수 없으며, 확인을 누르면 링크가 즉시 만료됩니다.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleRespond("ACCEPTED")}
                                    className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                                >
                                    수락 확정
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number | null | undefined }) {
    if (!value) return null;
    return (
        <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
                {React.cloneElement(icon as React.ReactElement<any>, { className: "w-3.5 h-3.5" })}
                <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
            </div>
            <p className="text-slate-900 font-semibold text-sm leading-tight">{value}</p>
        </div>
    );
}
